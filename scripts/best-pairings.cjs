#!/usr/bin/env node
// Pick the best-looking trait pairings and lay them out on one contact sheet.
//
// Only the new backgrounds are used (SCENES below); the original 29 scenes and
// their halftone copies in Enhanced_Backgrounds are left out. Every candidate
// follows the collection's pairing rules (generate_collection.js) and is scored by:
//   - separation: how clearly the outfit's outline reads against the scene
//     (CIE Lab colour difference across the silhouette edge, sampled around it),
//   - colour echo: a scene accent picked up by the outfit or the caption.
// The pick then spreads across scenes and outfits so the sheet is not 50
// variations of one look: every outfit appears at its best, and caps limit how
// often any one background or outfit repeats.
//
//   node scripts/best-pairings.cjs                 # 50 pairings into ./best_pairings
//   node scripts/best-pairings.cjs --count 30 --out dir --blur 3
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const { LAYERS, bodyFits, captionsFor } = require('../generate_collection.js');

const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const arg = (flag, fallback) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : fallback);
const COUNT = Number(arg('--count', 50));
const OUT = path.resolve(arg('--out', path.join(root, 'best_pairings')));
// The generator blurs backgrounds; off by default here so the halftone texture shows.
const BLUR = Number(arg('--blur', 0));

const MAX_PER_BACKGROUND = 9;
const MAX_PER_OUTFIT = 5;
const MAX_PER_RARE = 3;

// Scoring works on a downscaled copy; the band is the strip either side of the outline.
const W = 240, BAND = 6, BINS = 32;
const CHIN_Y = 148; // only the outline below the chin is scored; above it every normal has the same head
const MAX_DELTA_E = 25; // "clearly separate" is enough; past this MAGA red would win on colour alone

// Scene accent -> outfits whose own colour echoes it.
const ECHOES = {
  Red: ['MAGA'], Orange: ['MAGA'],
  Green: ['OG'],
  Blue: ['Android'], 'Light Blue': ['Android'], White: ['Android'],
};
const ECHO_BONUS = 6;
const CAPTION_BONUS = 3;

// The new backgrounds: five generated scenes, named after the designs listed when
// Enhanced_Backgrounds was set up, and the Earthrise photo. accent is the scene's
// colour (the rest are monochrome); moods are the expressions that suit it,
// rotated so neither a scene nor the sheet repeats one.
const SCENES = [
  { name: 'Spheres Spotlight', file: 'Assets/Enhanced_Backgrounds/goats_contest_mattrick (17).png', moods: ['Curious', 'Confused', 'Amused', 'Sour'] },
  { name: 'Cubes Cinematic', file: 'Assets/Enhanced_Backgrounds/goats_contest_mattrick (18).png', moods: ['Confused', 'Curious', 'Sour', 'Angry'] },
  { name: 'Pyramids Dunes', file: 'Assets/Enhanced_Backgrounds/goats_contest_mattrick (19).png', moods: ['Curious', 'Amused', 'Confused', 'Happy'] },
  { name: 'Wormhole Vortex', file: 'Assets/4fd01d63-2a0c-40cc-a521-72c432276a0b.png', moods: ['Surprised', 'Curious', 'Angry', 'Amused'] },
  { name: 'Cavern of Light', file: 'Assets/dd1fca4d-9ede-4449-81d9-68ab41ccc8c3.png', moods: ['Curious', 'Surprised', 'Chill', 'Sad'] },
  // A landscape photo: cropping from the right puts Earth beside the alien's head, not behind it.
  { name: 'Earthrise', file: 'Assets/art002e009288orig_20260409_184903.webp', accent: 'Blue', position: 'right', moods: ['Chill', 'Happy', 'Amused', 'Surprised'] },
].map((scene) => ({ ...scene, file: path.join(root, scene.file) }));

// The generator's rules read a scene's accent from the end of its name.
const asRuleBackground = (scene) => ({ name: [scene.name, scene.accent].filter(Boolean).join(' ') });
const expression = (name) => LAYERS.Expression.find((e) => e.name === name);

function lab(r, g, b) {
  const lin = (c) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const X = f((R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047);
  const Y = f(R * 0.2126 + G * 0.7152 + B * 0.0722);
  const Z = f((R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883);
  return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
}

const crop = (scene, size) => sharp(scene.file).resize(size, size, { fit: 'cover', position: scene.position || 'centre' });
const small = (input) => sharp(input).resize(W, W).ensureAlpha().raw().toBuffer();

// Distance of each pixel from the mask's outline, counted up to BAND.
function outlineDistance(mask) {
  const dist = new Int16Array(W * W).fill(BAND + 1), queue = [];
  const steps = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const across = (x, y, fn) => {
    for (const [dx, dy] of steps) {
      const X = x + dx, Y = y + dy;
      if (X >= 0 && Y >= 0 && X < W && Y < W) fn(Y * W + X);
    }
  };
  for (let i = 0; i < W * W; i++) {
    across(i % W, (i / W) | 0, (j) => {
      if (dist[i] !== 0 && mask[j] !== mask[i]) { dist[i] = 0; queue.push(i); }
    });
  }
  for (let h = 0; h < queue.length; h++) {
    const i = queue[h];
    if (dist[i] >= BAND) continue;
    across(i % W, (i / W) | 0, (j) => {
      if (mask[j] === mask[i] && dist[j] > dist[i] + 1) { dist[j] = dist[i] + 1; queue.push(j); }
    });
  }
  return dist;
}

async function figure(body) {
  const layers = body.kind === 'Rare' ? [body.file] : [body.file, LAYERS.Expression[0].file];
  const flat = await sharp({ create: { width: 960, height: 960, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(layers.map((input) => ({ input }))).png().toBuffer();
  const px = await small(flat);
  const mask = new Uint8Array(W * W);
  let cx = 0, cy = 0, n = 0;
  for (let i = 0; i < W * W; i++) {
    if (px[i * 4 + 3] > 128) { mask[i] = 1; cx += i % W; cy += (i / W) | 0; n++; }
  }
  return { px, mask, dist: outlineDistance(mask), cx: cx / n, cy: cy / n };
}

// Mean colour difference across the outline, averaged by direction from the
// figure's centre and weighted toward the weakest directions, so a figure that
// melts into the scene on one side scores low even if the rest is crisp.
function separation(fig, scene) {
  const bins = Array.from({ length: BINS }, () => ({ in: [0, 0, 0, 0], out: [0, 0, 0, 0] }));
  for (let i = 0; i < W * W; i++) {
    const x = i % W, y = (i / W) | 0;
    if (fig.dist[i] > BAND || y < CHIN_Y || y >= W - BAND) continue; // the bottom edge is the frame, not the scene
    const src = fig.mask[i] ? fig.px : scene;
    const side = bins[Math.floor(((Math.atan2(y - fig.cy, x - fig.cx) + Math.PI) / (2 * Math.PI)) * BINS) % BINS][fig.mask[i] ? 'in' : 'out'];
    const L = lab(src[i * 4], src[i * 4 + 1], src[i * 4 + 2]);
    side[0] += L[0]; side[1] += L[1]; side[2] += L[2]; side[3]++;
  }
  const diffs = bins.filter((b) => b.in[3] > 8 && b.out[3] > 8)
    .map((b) => Math.min(MAX_DELTA_E, Math.hypot(...[0, 1, 2].map((k) => b.in[k] / b.in[3] - b.out[k] / b.out[3]))))
    .sort((a, b) => a - b);
  const mean = diffs.reduce((s, d) => s + d, 0) / diffs.length;
  return 0.5 * mean + 0.5 * diffs[Math.floor(diffs.length * 0.2)];
}

async function candidates() {
  const bodies = [...LAYERS.Clothing.map((c) => ({ ...c, kind: 'Clothing' })), ...LAYERS.Rare.map((r) => ({ ...r, kind: 'Rare' }))];
  const figures = new Map(await Promise.all(bodies.map(async (b) => [b.name, await figure(b)])));
  const list = [];
  for (const background of SCENES) {
    const scene = await crop(background, W).ensureAlpha().raw().toBuffer();
    const rules = asRuleBackground(background);
    for (const body of bodies.filter((b) => bodyFits(rules, b))) {
      // Captions only where they echo a scene accent; monochrome scenes stay clean.
      const caption = background.accent ? captionsFor(rules, body)[0] : undefined;
      const echo = (ECHOES[background.accent] || []).includes(body.name);
      const score = separation(figures.get(body.name), scene) + (echo ? ECHO_BONUS : 0) + (caption ? CAPTION_BONUS : 0);
      list.push({ background, body, caption, score });
    }
  }
  return list.sort((a, b) => b.score - a.score);
}

function choose(list) {
  const perBackground = new Map(), perBody = new Map(), picked = [];
  const count = (map, key) => map.get(key) || 0;
  const fits = (c) => picked.length < COUNT && !picked.includes(c)
    && count(perBackground, c.background.name) < MAX_PER_BACKGROUND
    && count(perBody, c.body.name) < (c.body.kind === 'Rare' ? MAX_PER_RARE : MAX_PER_OUTFIT);
  const take = (c) => {
    picked.push(c);
    perBackground.set(c.background.name, count(perBackground, c.background.name) + 1);
    perBody.set(c.body.name, count(perBody, c.body.name) + 1);
  };
  // First the best pairing for every outfit (each on its own scene), then the next best overall.
  for (const c of list) if (!perBody.has(c.body.name) && !perBackground.has(c.background.name) && fits(c)) take(c);
  for (const c of list) if (fits(c)) take(c);
  picked.sort((a, b) => b.score - a.score);

  // Least used in this scene first, then least used on the whole sheet.
  const used = new Map();
  const uses = (key) => used.get(key) || 0;
  const rank = (scene, mood) => uses(`${scene}|${mood}`) * 100 + uses(mood);
  for (const c of picked) {
    if (c.body.kind === 'Rare') continue;
    const scene = c.background.name;
    const name = c.background.moods.reduce((best, m) => (rank(scene, m) < rank(scene, best) ? m : best));
    for (const key of [`${scene}|${name}`, name]) used.set(key, uses(key) + 1);
    c.expression = expression(name);
  }
  return picked;
}

const sceneCache = new Map();
function sceneBuffer(background) {
  if (!sceneCache.has(background.name)) {
    let img = crop(background, 960);
    if (BLUR) img = img.blur(BLUR);
    sceneCache.set(background.name, img.png().toBuffer());
  }
  return sceneCache.get(background.name);
}

async function render(c) {
  const layers = [c.body.file, c.expression && c.expression.file, c.caption && c.caption.file].filter(Boolean);
  const flat = await sharp(await sceneBuffer(c.background)).composite(layers.map((input) => ({ input }))).png().toBuffer();
  return sharp(flat).removeAlpha();
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const describe = (c) => [c.body.kind === 'Rare' ? `${c.body.name} (Rare)` : c.body.name, c.expression && c.expression.name, c.caption && c.caption.name].filter(Boolean).join(' · ');

async function sheet(picked, file) {
  const tile = 288, label = 52, cols = 10, header = 96, gap = 6;
  const rows = Math.ceil(picked.length / cols);
  const width = cols * tile + (cols + 1) * gap, height = header + rows * (tile + label) + (rows + 1) * gap;
  const tiles = await Promise.all(picked.map(async (c, i) => {
    const left = gap + (i % cols) * (tile + gap), top = header + gap + Math.floor(i / cols) * (tile + label + gap);
    const image = await (await render(c)).resize(tile, tile).png().toBuffer();
    const text = Buffer.from(`<svg width="${tile}" height="${label}">
      <text x="8" y="21" font-family="DejaVu Sans" font-weight="bold" font-size="15" fill="#7CFC9A">${i + 1}</text>
      <text x="${16 + String(i + 1).length * 10}" y="21" font-family="DejaVu Sans" font-weight="bold" font-size="14" fill="#fff">${esc(c.background.name)}</text>
      <text x="8" y="42" font-family="DejaVu Sans" font-size="12.5" fill="#b8c0cc">${esc(describe(c))}</text></svg>`);
    return [{ input: image, left, top }, { input: text, left, top: top + tile }];
  }));
  const title = Buffer.from(`<svg width="${width}" height="${header}">
    <text x="${gap + 4}" y="54" font-family="DejaVu Sans" font-weight="bold" font-size="40" fill="#fff">JUST ALIENS — ${picked.length} Best Pairings</text>
    <text x="${gap + 6}" y="82" font-family="DejaVu Sans" font-size="17" fill="#8a94a3">New backgrounds only · ranked by how clearly the alien reads against the scene, plus colour echoes between scene, outfit and caption</text></svg>`);
  await sharp({ create: { width, height, channels: 3, background: '#0b0d12' } })
    .composite([{ input: title, left: 0, top: 0 }, ...tiles.flat()])
    .jpeg({ quality: 88, mozjpeg: true })
    .toFile(file);
}

(async () => {
  const picked = choose(await candidates());
  fs.mkdirSync(OUT, { recursive: true });
  const rows = picked.map((c, i) => ({
    Rank: i + 1,
    Background: c.background.name,
    Type: c.body.kind === 'Rare' ? 'Rare' : 'Normal',
    Outfit: c.body.name,
    Expression: c.expression ? c.expression.name : '',
    Text: c.caption ? c.caption.name : '',
    Score: c.score.toFixed(1),
  }));
  const csv = [Object.keys(rows[0]).join(','), ...rows.map((r) => Object.values(r).join(','))].join('\n') + '\n';
  fs.writeFileSync(path.join(OUT, 'best_pairings.csv'), csv);
  await sheet(picked, path.join(OUT, 'best_pairings_sheet.jpg'));
  console.table(rows);
  console.log(`Sheet: ${path.join(OUT, 'best_pairings_sheet.jpg')}`);
})();

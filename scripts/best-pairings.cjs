#!/usr/bin/env node
// Pick the best-looking trait pairings and lay them out on one contact sheet.
//
// Uses only the new art: backgrounds from Assets/Enhanced_Backgrounds (without the
// three portrait photos), the recoloured heads in Assets/Expression_Colors, and the
// clothing and headwear fitted by scripts/fit-layers.cjs. Each tile is rendered by the
// collection's own layer stack (generate_collection.js), shadows included. Every
// candidate follows the collection's pairing rules and is scored by:
//   - separation: how clearly the dressed alien's outline reads against the scene
//     (CIE Lab colour difference across the silhouette edge, sampled around it),
//   - colour echo: a scene accent picked up by the skin, or by a matching caption.
// The pick then spreads across scenes, clothing, skins and headwear so the sheet is
// not 50 variations of one look: every clothing item, skin and headwear appears at
// its best, and caps limit how often any one of them repeats.
//
//   node scripts/best-pairings.cjs                 # 50 pairings into ./best_pairings
//   node scripts/best-pairings.cjs --count 30 --out dir --blur 3
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const { LAYERS, ACCENTS, bodyFits, captionsFor, sceneName, layerStack, renderStack } = require('../generate_collection.js');

const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const arg = (flag, fallback) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : fallback);
const COUNT = Number(arg('--count', 50));
const OUT = path.resolve(arg('--out', path.join(root, 'best_pairings')));
// The generator blurs backgrounds; off by default here so the halftone texture shows.
const BLUR = Number(arg('--blur', 0));

const MAX_PER_BACKGROUND = 2;
const MAX_PER_CLOTHING = 6;
const MAX_PER_SKIN = 6;
const MAX_PER_HEADWEAR = 6;

// Scoring works on a downscaled copy; the band is the strip either side of the outline.
const W = 240, BAND = 6, BINS = 32;
const MAX_DELTA_E = 25; // "clearly separate" is enough; past this a bright skin would win on colour alone

// Scene accent -> skins whose own colour echoes it.
const ECHOES = {
  Red: ['Coral Red'], Orange: ['Honey Gold', 'Coral Red'],
  Green: ['Lime', 'Forest Green'], Pink: ['Hot Pink', 'Violet'],
  Blue: ['Sky Blue', 'Cyan'], 'Light Blue': ['Sky Blue', 'Cyan'], White: ['Platinum', 'Cyan'],
};
const ECHO_BONUS = 6;
const CAPTION_BONUS = 3;

// The portrait photos in the folder are not scene art.
const PORTRAITS = ['Whiteboard Briefing', 'Cap Witness', 'Suit Hearing'];
const SCENES = LAYERS.Background.filter((b) =>
  path.dirname(b.file).endsWith('Enhanced_Backgrounds') && !PORTRAITS.includes(b.name));

// Expressions that suit each scene, rotated so neither a scene nor the sheet repeats one.
const MOODS = [
  [/^UFO/, ['Surprised', 'Curious', 'Confused', 'Amused']],
  [/^Cockpit/, ['Happy', 'Amused', 'Chill', 'Curious']],
  [/^Spaceship Corridor/, ['Curious', 'Sour', 'Angry', 'Chill']],
  [/^(Abyss|Celestial|Portal|Cove|Terra)$/, ['Chill', 'Curious', 'Sad', 'Surprised']],
  [/^(Cubes|Spheres|Pyramids)/, ['Confused', 'Curious', 'Amused', 'Sour']],
  [/^Neon/, ['Amused', 'Surprised', 'Happy', 'Angry']],
];
const moodsFor = (background) => (MOODS.find(([re]) => re.test(sceneName(background))) || [null, ['Chill', 'Happy']])[1];
const expression = (name) => LAYERS.Expression.find((e) => e.name === name);
const accentOf = (background) => ACCENTS.find((a) => sceneName(background).endsWith(` ${a}`));

function lab(r, g, b) {
  const lin = (c) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const X = f((R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047);
  const Y = f(R * 0.2126 + G * 0.7152 + B * 0.0722);
  const Z = f((R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883);
  return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
}

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

// The scoring figure: the dressed alien's layers flattened without a background
// (any expression will do: the heads share their outline).
async function figure(body) {
  const { layers } = layerStack({ ...body, Background: SCENES[0], Expression: LAYERS.Expression[0] });
  const flat = await sharp({ create: { width: 960, height: 960, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(layers.map((l) => ({ input: l.file }))).png().toBuffer();
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
    if (fig.dist[i] > BAND || y >= W - BAND) continue; // the bottom edge is the frame, not the scene
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

const key = (body) => [body.Clothing.name, body.Skin.name, body.Headwear ? body.Headwear.name : ''].join('|');

async function candidates() {
  const bodies = [];
  for (const Clothing of LAYERS.Clothing)
    for (const Skin of LAYERS.Skin)
      for (const Headwear of [null, ...(Clothing.over ? [] : LAYERS.Headwear)])
        bodies.push(Headwear ? { Clothing, Skin, Headwear } : { Clothing, Skin });
  const figures = new Map();
  for (const body of bodies) figures.set(key(body), await figure(body));
  const list = [];
  for (const background of SCENES) {
    const scene = await small(background.file);
    const accent = accentOf(background);
    for (const body of bodies) {
      if (!bodyFits(background, body.Clothing) || !bodyFits(background, body.Skin)) continue;
      // Captions only where they echo a scene accent; grey scenes stay clean.
      const caption = captionsFor(background)[0];
      const echo = (ECHOES[accent] || []).includes(body.Skin.name);
      const score = separation(figures.get(key(body)), scene) + (echo ? ECHO_BONUS : 0) + (caption ? CAPTION_BONUS : 0);
      list.push({ background, body, caption, score });
    }
  }
  return list.sort((a, b) => b.score - a.score);
}

function choose(list) {
  const counts = new Map(), picked = [];
  const count = (k) => counts.get(k) || 0;
  const keys = (c) => [`bg:${c.background.name}`, `cl:${c.body.Clothing.name}`, `sk:${c.body.Skin.name}`,
    `hw:${c.body.Headwear ? c.body.Headwear.name : 'none'}`];
  const fits = (c) => picked.length < COUNT && !picked.includes(c)
    && count(`bg:${c.background.name}`) < MAX_PER_BACKGROUND
    && count(`cl:${c.body.Clothing.name}`) < MAX_PER_CLOTHING
    && count(`sk:${c.body.Skin.name}`) < MAX_PER_SKIN
    && (!c.body.Headwear || count(`hw:${c.body.Headwear.name}`) < MAX_PER_HEADWEAR);
  const take = (c) => { picked.push(c); for (const k of keys(c)) counts.set(k, count(k) + 1); };
  // First the best pairing for every clothing item, skin and headwear (each on its
  // own scene), then the next best overall.
  for (const prefix of ['cl', 'sk', 'hw']) {
    for (const c of list) {
      const k = keys(c).find((x) => x.startsWith(`${prefix}:`));
      if (k !== 'hw:none' && !counts.has(k) && !counts.has(`bg:${c.background.name}`) && fits(c)) take(c);
    }
  }
  for (const c of list) if (fits(c)) take(c);
  picked.sort((a, b) => b.score - a.score);

  // Least used in this scene first, then least used on the whole sheet.
  const used = new Map();
  const uses = (k) => used.get(k) || 0;
  const rank = (scene, mood) => uses(`${scene}|${mood}`) * 100 + uses(mood);
  for (const c of picked) {
    const scene = c.background.name;
    const name = moodsFor(c.background).reduce((best, m) => (rank(scene, m) < rank(scene, best) ? m : best));
    for (const k of [`${scene}|${name}`, name]) used.set(k, uses(k) + 1);
    c.expression = expression(name);
  }
  return picked;
}

const traitsOf = (c) => ({ Background: c.background, ...c.body, Expression: c.expression, ...(c.caption ? { Text: c.caption } : {}) });
const render = (c) => renderStack(layerStack(traitsOf(c)), BLUR);

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const describe = (c) => [c.body.Clothing.name, c.body.Skin.name, c.expression.name,
  c.body.Headwear && c.body.Headwear.name, c.caption && c.caption.name].filter(Boolean).join(' · ');

async function sheet(picked, file) {
  const tile = 288, label = 52, cols = 10, header = 96, gap = 6;
  const rows = Math.ceil(picked.length / cols);
  const width = cols * tile + (cols + 1) * gap, height = header + rows * (tile + label) + (rows + 1) * gap;
  const tiles = [];
  for (const [i, c] of picked.entries()) {
    const left = gap + (i % cols) * (tile + gap), top = header + gap + Math.floor(i / cols) * (tile + label + gap);
    const image = await (await render(c)).resize(tile, tile).png().toBuffer();
    const text = Buffer.from(`<svg width="${tile}" height="${label}">
      <text x="8" y="21" font-family="DejaVu Sans" font-weight="bold" font-size="15" fill="#7CFC9A">${i + 1}</text>
      <text x="${16 + String(i + 1).length * 10}" y="21" font-family="DejaVu Sans" font-weight="bold" font-size="14" fill="#fff">${esc(sceneName(c.background))}</text>
      <text x="8" y="42" font-family="DejaVu Sans" font-size="11.5" fill="#b8c0cc">${esc(describe(c))}</text></svg>`);
    tiles.push({ input: image, left, top }, { input: text, left, top: top + tile });
  }
  const title = Buffer.from(`<svg width="${width}" height="${header}">
    <text x="${gap + 4}" y="54" font-family="DejaVu Sans" font-weight="bold" font-size="40" fill="#fff">JUST ALIENS — ${picked.length} Best Pairings</text>
    <text x="${gap + 6}" y="82" font-family="DejaVu Sans" font-size="17" fill="#8a94a3">Enhanced backgrounds, new skins, clothing and headwear · ranked by how clearly the alien reads against the scene, plus colour echoes</text></svg>`);
  await sharp({ create: { width, height, channels: 3, background: '#0b0d12' } })
    .composite([{ input: title, left: 0, top: 0 }, ...tiles])
    .jpeg({ quality: 88, mozjpeg: true })
    .toFile(file);
}

module.exports = { candidates, choose, render, traitsOf, describe };

if (require.main === module) (async () => {
  const picked = choose(await candidates());
  fs.mkdirSync(OUT, { recursive: true });
  const rows = picked.map((c, i) => ({
    Rank: i + 1,
    Background: sceneName(c.background),
    Clothing: c.body.Clothing.name,
    Skin: c.body.Skin.name,
    Expression: c.expression.name,
    Headwear: c.body.Headwear ? c.body.Headwear.name : '',
    Text: c.caption ? c.caption.name : '',
    Score: c.score.toFixed(1),
  }));
  const csv = [Object.keys(rows[0]).join(','), ...rows.map((r) => Object.values(r).join(','))].join('\n') + '\n';
  fs.writeFileSync(path.join(OUT, 'best_pairings.csv'), csv);
  await sheet(picked, path.join(OUT, 'best_pairings_sheet.jpg'));
  console.table(rows);
  console.log(`Sheet: ${path.join(OUT, 'best_pairings_sheet.jpg')}`);
})();

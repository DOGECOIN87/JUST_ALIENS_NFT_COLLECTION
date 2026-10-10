#!/usr/bin/env node

/**
 * generate_collection.js
 *
 * Builds the 1,000-piece Just Aliens collection from the layers in Assets/
 * into a folder ready for the launchpad uploader: one image per piece plus a
 * matching Metaplex JSON (1.webp + 1.json, 2.webp + 2.json, ...).
 *
 *   #1          Secret Rare still (Assets/SecretRare/SecretRare_1.png)
 *   #2 - #1000  Generated: Normal (Background > Clothing > Skin > Expression > Headwear? > Text?)
 *               or Rare (Background > Rare > Text?)
 *
 * The alien is one of the recoloured heads in Assets/Expression_Colors/:
 * Skin picks the colour folder and Expression picks the head inside it. Clothing
 * (Assets/Clothing) goes under the head and Headwear (Assets/Headwear) sits on
 * it. Every layer is 960x960 and fitted to the full-size heads by
 * scripts/fit-layers.cjs. Each piece casts a soft shadow onto what is under it:
 * the head onto the clothing, headwear onto the head.
 *
 * Odds follow rarity.html: Rare 3.57%, Text on 50% of pieces, Headwear on 25% of
 * Normal pieces. Counts are
 * exact rather than rolled, every trait combination is unique, backgrounds are
 * softly blurred behind the alien, pairings follow the look rules below, and a
 * fixed seed means re-running produces the identical collection.
 *
 * Usage:
 *   node generate_collection.js                 # all 1,000 into ./collection
 *   node generate_collection.js --limit 50      # first 50 only
 *   node generate_collection.js --sheet out.jpg # also write a contact sheet
 *   node generate_collection.js --out dir       # different output folder
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SUPPLY = 1000;
const SEED = 'just-aliens-1k';
const RARE_SHARE = 0.0357;
const TEXT_SHARE = 0.5;
const HEADWEAR_SHARE = 0.25;
const BACKGROUND_BLUR_SIGMA = 3;
const WEBP = { quality: 90, effort: 6, smartSubsample: true };

// Pairing rules, so every combination looks intentional (each was checked
// against renders of the art):
//
// Near-black backgrounds swallow dark aliens and leave floating eyes, so only
// skins and clothing that stand out against black go on them.
const DARK_BACKGROUNDS = ['Abyss', 'UFO Inverted'];
const SHOWS_ON_DARK = [
  'Android', 'OG',
  'Coral Red', 'Cyan', 'Forest Green', 'Honey Gold', 'Hot Pink', 'Lime', 'Platinum', 'Sky Blue', 'Violet',
  'Safari Jacket', 'Military Jacket', 'Camo Jacket', 'Spacesuit', 'Hoodie White',
];
// (Graphite heads, the Infantry rare, and the dark garments stay off near-black.)
// Coloured backgrounds get the caption in the same colour family (backgrounds and
// captions share colour names; the "White" ones glow cyan). Grey backgrounds take any.
const CAPTIONS_FOR_ACCENT = {
  'Light Blue': ['Light Blue Opaque', 'Blue Opaque'],
  Blue: ['Blue Opaque', 'Light Blue Opaque'],
  White: ['White Opaque', 'Light Blue Opaque'],
  Green: ['Green Opaque'],
  Pink: ['Pink Opaque'],
  Red: ['Red Solid', 'Orange Solid'],
  Orange: ['Orange Solid', 'Red Solid'],
};

const NAME_PREFIX = 'Just Aliens #';
const SYMBOL = 'JSTA';
const DESCRIPTION = 'Born from the buzz surrounding recent UFO disclosures. In a time when Aliens are dominating headlines, we offer a fun way to engage with the mystery, reminding everyone to chill out and enjoy the ride.';
const SELLER_FEE_BASIS_POINTS = 500;
const CREATORS = [{ address: 'Hn1i7bLb7oHpAL5AoyGvkn7YgwmWrVTbVsjXA1LYnELo', share: 100 }];

const ASSETS = path.join(__dirname, 'Assets');
const SECRET_RARE = path.join(ASSETS, 'SecretRare', 'SecretRare_1.png');

// The ten recoloured skin folders, in the order scripts/recolor-expressions.cjs wrote them.
const SKINS = [
  ['Platinum', 'Platinum'],
  ['Lime', 'Lime'],
  ['Sky_Blue', 'Sky Blue'],
  ['Coral_Red', 'Coral Red'],
  ['Violet', 'Violet'],
  ['Honey_Gold', 'Honey Gold'],
  ['Graphite', 'Graphite'],
  ['Forest_Green', 'Forest Green'],
  ['Hot_Pink', 'Hot Pink'],
  ['Cyan', 'Cyan'],
];

// Soft shadows: a layer casts this shadow onto the layers directly under it.
const HEAD_SHADOW = { drop: 26, blur: 18, opacity: 0.75 }; // the head onto the clothing
const HAT_SHADOW = { drop: 16, blur: 10, opacity: 0.7 };   // headwear onto the head

// Friendly names for the goats_contest_mattrick backgrounds (the halftone
// copies keep their scene name plus a "Halftone" suffix for uniqueness).
const BACKGROUND_NAMES = {
  'goats_contest_mattrick (17).png': 'Spheres Spotlight',
  'goats_contest_mattrick (18).png': 'Cubes Cinematic',
  'goats_contest_mattrick (19).png': 'Pyramids Dunes',
  'goats_contest_mattrick (20).png': 'Whiteboard Briefing',
  'goats_contest_mattrick (21).png': 'Cap Witness',
  'goats_contest_mattrick (22).png': 'Suit Hearing',
};

const args = process.argv.slice(2);
const arg = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i === -1 ? fallback : args[i + 1];
};
const OUT = path.resolve(arg('--out', path.join(__dirname, 'collection')));
const LIMIT = Number(arg('--limit', SUPPLY));
const SHEET = arg('--sheet', null);

// Seeded PRNG (mulberry32) so the collection is reproducible.
function rng(seed) {
  let h = 1779033703 ^ seed.length;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 3432918353), h = (h << 13) | (h >>> 19);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = rng(SEED);
const pick = (list) => list[Math.floor(random() * list.length)];
function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

// "Spaceship_Corridor_White" -> "Spaceship Corridor White", "AlienScuba" -> "Alien Scuba"
function displayName(file) {
  const base = path.parse(file).name;
  if (/^maga$/i.test(base)) return 'MAGA';
  return base
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(/[_\-\s]+/)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

const IMG_EXTS = ['.png', '.jpg', '.jpeg', '.webp'];
function layer(dir) {
  return fs.readdirSync(path.join(ASSETS, dir))
    .filter((f) => IMG_EXTS.includes(path.extname(f).toLowerCase()) && fs.statSync(path.join(ASSETS, dir, f)).isFile())
    .sort()
    .map((f) => ({ file: path.join(ASSETS, dir, f), name: displayName(f) }));
}

// All backgrounds: the original scenes, the halftone copies, and the new
// scenes and photo backgrounds.
function backgroundLayers() {
  const base = layer('Background');
  const enhanced = fs.readdirSync(path.join(ASSETS, 'Enhanced_Backgrounds'))
    .filter((f) => IMG_EXTS.includes(path.extname(f).toLowerCase()))
    .sort()
    .map((f) => {
      const override = BACKGROUND_NAMES[f];
      const name = override || displayName(f) + (f.startsWith('goats_contest_mattrick') ? '' : ' Halftone');
      return { file: path.join(ASSETS, 'Enhanced_Backgrounds', f), name };
    });
  return [...base, ...enhanced];
}

const LAYERS = {
  Background: backgroundLayers(),
  Clothing: layer('Clothing'),
  // A headwear item is one file, or a folder with one file per expression (named like
  // the expression heads) when the eyes or the crown it sits on move between heads.
  Headwear: [
    ...layer('Headwear'),
    ...fs.readdirSync(path.join(ASSETS, 'Headwear'))
      .filter((f) => fs.statSync(path.join(ASSETS, 'Headwear', f)).isDirectory())
      .map((f) => ({ dir: path.join(ASSETS, 'Headwear', f), name: displayName(f) })),
  ].sort((a, b) => a.name.localeCompare(b.name)),
  Skin: SKINS.map(([dir, name]) => ({ dir, name })),
  // The expression file names are the same in every skin folder; Platinum is read for the list.
  Expression: fs.readdirSync(path.join(ASSETS, 'Expression_Colors', 'Platinum'))
    .filter((f) => f.toLowerCase().endsWith('.png'))
    .sort()
    .map((f) => ({ file: f, name: displayName(f) })),
  Text: layer('Text'),
  Rare: layer('Rare'),
};

// The alien's image file: the expression head recoloured in the skin's folder.
function headFile(skin, expression) {
  return path.join(ASSETS, 'Expression_Colors', skin.dir, expression.file);
}

function plan() {
  const rareCount = Math.round(SUPPLY * RARE_SHARE);
  const normalCount = SUPPLY - 1 - rareCount;
  const withText = (type, count) => Array.from({ length: count }, (_, i) => ({ type, text: i < Math.round(count * TEXT_SHARE) }));
  const slots = shuffle([...withText('Rare', rareCount), ...withText('Normal', normalCount)]);
  const rareDeck = shuffle(Array.from({ length: rareCount }, (_, i) => LAYERS.Rare[i % LAYERS.Rare.length]));
  // Exactly HEADWEAR_SHARE of the Normal pieces wear headwear, spread independently of Text.
  const headwearDeck = shuffle(Array.from({ length: normalCount }, (_, i) => i < Math.round(normalCount * HEADWEAR_SHARE)));

  const pieces = [{ id: 1, type: 'Secret Rare', stack: null, attributes: [{ trait_type: 'Type', value: 'Secret Rare' }] }];
  const seen = new Set();
  for (const slot of slots) {
    const rare = slot.type === 'Rare' ? rareDeck.pop() : null;
    const wearsHeadwear = !rare && headwearDeck.pop();
    const usable = (background, body) => bodyFits(background, body) && (!slot.text || captionsFor(background).length > 0);
    let traits, stack;
    do {
      const background = pick(LAYERS.Background.filter((bg) =>
        (rare ? LAYERS.Rare : LAYERS.Clothing).some((body) => usable(bg, body)) &&
        (rare || LAYERS.Skin.some((s) => usable(bg, s)))));
      traits = { Background: background };
      if (rare) {
        const body = pick(LAYERS.Rare.filter((b) => usable(background, b)));
        traits['Rare Type'] = body;
      } else {
        traits.Clothing = pick(LAYERS.Clothing.filter((c) => usable(background, c)));
        traits.Skin = pick(LAYERS.Skin.filter((s) => usable(background, s)));
        traits.Expression = pick(LAYERS.Expression);
        if (wearsHeadwear) traits.Headwear = pick(LAYERS.Headwear);
      }
      if (slot.text) traits.Text = pick(captionsFor(background));
      stack = layerStack(traits);
    } while (seen.has(dna(traits)));
    seen.add(dna(traits));
    pieces.push({
      id: pieces.length + 1,
      type: slot.type,
      stack,
      attributes: [{ trait_type: 'Type', value: slot.type }, ...Object.entries(traits).map(([k, t]) => ({ trait_type: k, value: t.name }))],
    });
  }
  return pieces;
}

// Bottom-to-top layers for a set of traits. Each entry is a 960x960 file; `shadow`
// makes it cast a soft shadow onto the entries listed in `onto` (already below it).
function layerStack(traits) {
  const layers = [];
  if (traits['Rare Type']) {
    layers.push({ file: traits['Rare Type'].file });
  } else {
    const clothing = { file: traits.Clothing.file };
    const head = { file: headFile(traits.Skin, traits.Expression), shadow: HEAD_SHADOW, onto: [clothing] };
    layers.push(clothing, head);
    if (traits.Headwear) {
      const hw = traits.Headwear;
      layers.push({ file: hw.dir ? path.join(hw.dir, traits.Expression.file) : hw.file, shadow: HAT_SHADOW, onto: [head] });
    }
  }
  if (traits.Text) layers.push({ file: traits.Text.file });
  return { background: traits.Background.file, layers };
}

// The halftone copies follow the same look rules as the scene they were made from.
const sceneName = (background) => background.name.replace(/ Halftone$/, '');

function bodyFits(background, body) {
  if (DARK_BACKGROUNDS.includes(sceneName(background)) && !SHOWS_ON_DARK.includes(body.name)) return false;
  return true;
}

const ACCENTS = Object.keys(CAPTIONS_FOR_ACCENT).sort((a, b) => b.length - a.length); // "Light Blue" before "Blue"
function captionsFor(background) {
  const accent = ACCENTS.find((a) => sceneName(background).endsWith(` ${a}`));
  const allowed = CAPTIONS_FOR_ACCENT[accent];
  return allowed ? LAYERS.Text.filter((t) => allowed.includes(t.name)) : [];
}

function dna(traits) {
  return Object.entries(traits).map(([k, t]) => `${k}:${t.name}`).join('|');
}

const blurredBackgrounds = new Map();
function blurredBackground(file) {
  if (!blurredBackgrounds.has(file)) {
    blurredBackgrounds.set(file, sharp(file).blur(BACKGROUND_BLUR_SIGMA).png().toBuffer());
  }
  return blurredBackgrounds.get(file);
}

const SIZE = 960;
const alphas = new Map();
function alphaOf(file) {
  if (!alphas.has(file)) alphas.set(file, sharp(file).ensureAlpha().extractChannel('alpha').raw().toBuffer());
  return alphas.get(file);
}

// A black layer whose alpha is `file`'s silhouette dropped down, blurred and faded,
// kept only where it lands on the `onto` layers (so it never darkens the background).
async function castShadow(file, onto, { drop, blur, opacity }) {
  const moved = Buffer.alloc(SIZE * SIZE);
  (await alphaOf(file)).copy(moved, drop * SIZE, 0, (SIZE - drop) * SIZE);
  const shifted = await sharp(moved, { raw: { width: SIZE, height: SIZE, channels: 1 } }).blur(blur).raw().toBuffer();
  const below = await Promise.all(onto.map((l) => alphaOf(l.file)));
  const out = Buffer.alloc(SIZE * SIZE * 4);
  for (let i = 0; i < SIZE * SIZE; i++) {
    let cover = 0;
    for (const a of below) if (a[i] > cover) cover = a[i];
    out[i * 4 + 3] = Math.round((shifted[i] * cover * opacity) / 255);
  }
  return { input: out, raw: { width: SIZE, height: SIZE, channels: 4 } };
}

// Flatten a layer stack onto its (optionally blurred) background.
async function renderStack({ background, layers }, blur = BACKGROUND_BLUR_SIGMA) {
  const base = blur ? await blurredBackground(background) : await sharp(background).png().toBuffer();
  const composites = [];
  for (const layer of layers) {
    if (layer.shadow) composites.push(await castShadow(layer.file, layer.onto, layer.shadow));
    composites.push({ input: layer.file });
  }
  return sharp(await sharp(base).composite(composites).png().toBuffer()).removeAlpha();
}

async function render(piece) {
  if (piece.type === 'Secret Rare') return sharp(SECRET_RARE).removeAlpha().webp(WEBP).toBuffer();
  return (await renderStack(piece.stack)).webp(WEBP).toBuffer();
}

function metadata(piece) {
  const image = `${piece.id}.webp`;
  return {
    name: `${NAME_PREFIX}${piece.id}`,
    symbol: SYMBOL,
    description: DESCRIPTION,
    seller_fee_basis_points: SELLER_FEE_BASIS_POINTS,
    image,
    attributes: piece.attributes,
    properties: {
      files: [{ uri: image, type: 'image/webp' }],
      category: 'image',
      creators: CREATORS,
    },
  };
}

async function contactSheet(pieces, file) {
  const tile = 256, cols = 10, rows = Math.ceil(pieces.length / cols);
  const tiles = await Promise.all(pieces.map(async (p, i) => {
    const label = Buffer.from(`<svg width="${tile}" height="${tile}"><rect x="6" y="6" rx="6" width="${String(p.id).length * 11 + 16}" height="26" fill="rgba(0,0,0,0.7)"/><text x="14" y="25" font-family="DejaVu Sans" font-weight="bold" font-size="16" fill="#fff">${p.id}</text></svg>`);
    const input = await sharp(path.join(OUT, `${p.id}.webp`)).resize(tile, tile).composite([{ input: label }]).png().toBuffer();
    return { input, left: (i % cols) * tile, top: Math.floor(i / cols) * tile };
  }));
  await sharp({ create: { width: cols * tile, height: rows * tile, channels: 3, background: '#000' } })
    .composite(tiles)
    .jpeg({ quality: 90 })
    .toFile(file);
}

// The pairing rules are shared with scripts/best-pairings.cjs.
module.exports = { LAYERS, ACCENTS, bodyFits, captionsFor, sceneName, layerStack, renderStack };

if (require.main === module) (async () => {
  const pieces = plan();
  const selected = pieces.slice(0, LIMIT);
  fs.mkdirSync(OUT, { recursive: true });

  let done = 0, bytes = 0;
  const queue = [...selected];
  await Promise.all(Array.from({ length: 8 }, async () => {
    for (let piece; (piece = queue.shift());) {
      const image = await render(piece);
      fs.writeFileSync(path.join(OUT, `${piece.id}.webp`), image);
      fs.writeFileSync(path.join(OUT, `${piece.id}.json`), JSON.stringify(metadata(piece), null, 2));
      bytes += image.length;
      if (++done % 100 === 0 || done === selected.length) console.log(`Rendered ${done}/${selected.length}`);
    }
  }));

  const counts = {};
  for (const p of pieces) for (const { trait_type, value } of p.attributes) {
    counts[trait_type] = counts[trait_type] || {};
    counts[trait_type][value] = (counts[trait_type][value] || 0) + 1;
  }
  const withText = pieces.filter((p) => p.attributes.some((a) => a.trait_type === 'Text')).length;
  console.log(`\nPlanned ${pieces.length} unique pieces (${withText} with Text):`);
  for (const [trait, values] of Object.entries(counts)) console.log(`  ${trait}: ${Object.entries(values).map(([v, n]) => `${v} ${n}`).join(', ')}`);
  console.log(`\nWrote ${selected.length} pieces to ${OUT} (${(bytes / 1024 / 1024).toFixed(1)} MB of images)`);

  if (SHEET) {
    await contactSheet(selected, path.resolve(SHEET));
    console.log(`Contact sheet: ${path.resolve(SHEET)}`);
  }
})();

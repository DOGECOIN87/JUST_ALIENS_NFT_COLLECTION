#!/usr/bin/env node

/**
 * generate_collection.js
 *
 * Builds the 1,000-piece Just Aliens collection from the layers in Assets/
 * into a folder ready for the launchpad uploader: one image per piece plus a
 * matching Metaplex JSON (1.webp + 1.json, 2.webp + 2.json, ...).
 *
 *   #1          Secret Rare still (Assets/SecretRare/SecretRare_1.png)
 *   #2 - #1000  Generated: Normal (Background > Clothing > Expression > Text?)
 *               or Rare (Background > Rare > Text?)
 *
 * Odds follow rarity.html: Rare 3.57%, Text on 50% of pieces. Counts are
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
const BACKGROUND_BLUR_SIGMA = 3;
const WEBP = { quality: 90, effort: 6, smartSubsample: true };

// Pairing rules, so every combination looks intentional (each was checked
// against renders of the art):
//
// Near-black backgrounds swallow dark outfits and leave a floating head, so only
// bodies that stand out against black go on them.
const DARK_BACKGROUNDS = ['Abyss', 'UFO Inverted'];
const SHOWS_ON_DARK = ['Leather Jacket', 'Sports Jacket', 'MAGA', 'Android', 'OG'];
// The red MAGA hoodie clashes with green and pink scenes.
const BACKGROUNDS_TO_AVOID = { MAGA: /(Green|Pink)$/ };
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
// The caption sits over the chest. The "Opaque" captions have a see-through backing
// that washes out on light clothing, so light clothing only takes the "Solid" ones,
// and the MAGA print is never covered.
const CAPTIONS_FOR_CLOTHING = {
  'Leather Jacket': ['Red Solid', 'Orange Solid'],
  'Sports Jacket': ['Red Solid', 'Orange Solid'],
  MAGA: [],
};

const NAME_PREFIX = 'Just Aliens #';
const SYMBOL = 'JSTA';
const DESCRIPTION = 'Born from the buzz surrounding recent UFO disclosures. In a time when Aliens are dominating headlines, we offer a fun way to engage with the mystery, reminding everyone to chill out and enjoy the ride.';
const SELLER_FEE_BASIS_POINTS = 500;
const CREATORS = [{ address: 'Hn1i7bLb7oHpAL5AoyGvkn7YgwmWrVTbVsjXA1LYnELo', share: 100 }];

const ASSETS = path.join(__dirname, 'Assets');
const SECRET_RARE = path.join(ASSETS, 'SecretRare', 'SecretRare_1.png');

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

function layer(dir) {
  return fs.readdirSync(path.join(ASSETS, dir))
    .filter((f) => f.toLowerCase().endsWith('.png'))
    .sort()
    .map((f) => ({ file: path.join(ASSETS, dir, f), name: displayName(f) }));
}

const LAYERS = {
  Background: layer('Background'),
  Clothing: layer('Clothing'),
  Expression: layer('Expression'),
  Text: layer('Text'),
  Rare: layer('Rare'),
};

function plan() {
  const rareCount = Math.round(SUPPLY * RARE_SHARE);
  const normalCount = SUPPLY - 1 - rareCount;
  const withText = (type, count) => Array.from({ length: count }, (_, i) => ({ type, text: i < Math.round(count * TEXT_SHARE) }));
  const slots = shuffle([...withText('Rare', rareCount), ...withText('Normal', normalCount)]);
  const rareDeck = shuffle(Array.from({ length: rareCount }, (_, i) => LAYERS.Rare[i % LAYERS.Rare.length]));

  const pieces = [{ id: 1, type: 'Secret Rare', layers: [], attributes: [{ trait_type: 'Type', value: 'Secret Rare' }] }];
  const seen = new Set();
  for (const slot of slots) {
    const rare = slot.type === 'Rare' ? rareDeck.pop() : null;
    const bodies = rare ? [rare] : LAYERS.Clothing;
    const usable = (background, body) => bodyFits(background, body) && (!slot.text || captionsFor(background, body).length > 0);
    let traits;
    do {
      const background = pick(LAYERS.Background.filter((bg) => bodies.some((body) => usable(bg, body))));
      const body = pick(bodies.filter((b) => usable(background, b)));
      traits = rare ? { Background: background, 'Rare Type': body } : { Background: background, Clothing: body, Expression: pick(LAYERS.Expression) };
      if (slot.text) traits.Text = pick(captionsFor(background, body));
    } while (seen.has(dna(traits)));
    seen.add(dna(traits));
    pieces.push({
      id: pieces.length + 1,
      type: slot.type,
      layers: Object.values(traits).map((t) => t.file),
      attributes: [{ trait_type: 'Type', value: slot.type }, ...Object.entries(traits).map(([k, t]) => ({ trait_type: k, value: t.name }))],
    });
  }
  return pieces;
}

function bodyFits(background, body) {
  if (DARK_BACKGROUNDS.includes(background.name) && !SHOWS_ON_DARK.includes(body.name)) return false;
  const avoid = BACKGROUNDS_TO_AVOID[body.name];
  return !(avoid && avoid.test(background.name));
}

const ACCENTS = Object.keys(CAPTIONS_FOR_ACCENT).sort((a, b) => b.length - a.length); // "Light Blue" before "Blue"
function captionsFor(background, body) {
  const accent = ACCENTS.find((a) => background.name.endsWith(` ${a}`));
  const allowed = [CAPTIONS_FOR_ACCENT[accent], CAPTIONS_FOR_CLOTHING[body.name]].filter(Boolean);
  return LAYERS.Text.filter((t) => allowed.every((list) => list.includes(t.name)));
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

async function render(piece) {
  if (piece.type === 'Secret Rare') return sharp(SECRET_RARE).removeAlpha().webp(WEBP).toBuffer();
  const [background, ...overlays] = piece.layers;
  const flat = await sharp(await blurredBackground(background))
    .composite(overlays.map((input) => ({ input })))
    .png()
    .toBuffer();
  return sharp(flat).removeAlpha().webp(WEBP).toBuffer();
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

(async () => {
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

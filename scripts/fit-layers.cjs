#!/usr/bin/env node
// Build the 960x960 clothing and headwear layers from the clean originals in
// Assets/Source_Layers, sized and placed for the alien heads in Assets/Expression_Colors.
//
//   Assets/Clothing/<Name>.png               drawn under the head (jackets, suits)
//   Assets/Headwear/<Name>.png               drawn over the head, worn with any jacket
//   Assets/Headwear/<Name>/<Expression>.png  the same, fitted to each expression's head
//
// Heads are never resized: anything worn on the head is fitted to the full-size head.
// The expressions move the eyes (their centre ranges from y 386 to y 470) and the crown
// (y 107 to 133), so eyewear and hats are placed per expression (HEADS below).
//
//   node scripts/fit-layers.cjs
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const SOURCE = path.join(root, 'Assets/Source_Layers');
const SIZE = 960;
const JACKET = SIZE / 1254; // the originals are 1254 squares drawn on the same template

// scale: of the original; left/top: where its top-left corner lands on the 960 canvas.
const JACKETS = ['Bomber_Jacket', 'Camo_Jacket', 'Hoodie_Black', 'Hoodie_White', 'Leather_Jacket',
  'Military_Jacket', 'Safari_Jacket', 'Spacesuit', 'Tech_Jacket', 'Winter_Jacket'];
const HEADWEAR = {
  'Spiky_Hair': { scale: 0.30, left: 302, top: -15 },
  // Pushed up on the forehead: over the eyes the lenses are smaller than the alien's eyes.
  Goggles: { scale: 0.34, left: 274, top: 30 },
};
// Per-expression fits: the source point (sx, sy) lands dy below the expression's eye
// centre or the top of its crown, centred on the face.
const FITTED = {
  // Over the eyes, about as wide as the face.
  Aviator_Shades: { scale: 0.38, sx: 625, sy: 640, anchor: 'eyes', dy: 0 },
  // Pushed up on the forehead, like the Goggles.
  Red_Goggles: { scale: 0.36, sx: 626, sy: 620, anchor: 'crown', dy: 125 },
  // The cap's crown covers the dome and its brim ends just above the eyes.
  Snapback_Cap: { scale: 0.48, sx: 626, sy: 835, anchor: 'crown', dy: 190 },
  // Growing out of the upper sides of the dome (sy: the bottom of the horn bases); each
  // horn is moved `inset` px toward the centre so its base sits on the head.
  Devil_Horns: { scale: 0.40, sx: 627, sy: 769, anchor: 'crown', dy: 112, inset: 26 },
  // Rising from the top of the dome; short enough that the balls stay in frame.
  Blue_Antennae: { scale: 0.34, sx: 626, sy: 663, anchor: 'crown', dy: 50 },
};
const FACE_X = 486;

// Each expression's head, measured from the art: crown is the top of the head at the
// face centre; eyes is the centre of the eye line (for the squinting Angry, Confused and
// Sad, the line through the narrowed eyes and the brow just above them).
const HEADS = {
  'Amused.png': { crown: 127, eyes: 408 },
  'Angry.png': { crown: 108, eyes: 470 },
  'Chill.png': { crown: 127, eyes: 420 },
  'Confused.png': { crown: 122, eyes: 455 },
  'Curious.png': { crown: 107, eyes: 422 },
  'Happy.png': { crown: 112, eyes: 386 },
  'Sad.png': { crown: 109, eyes: 455 },
  'Sour.png': { crown: 133, eyes: 416 },
  'Surprised.png': { crown: 131, eyes: 428 },
};

const source = (name) => {
  const file = fs.readdirSync(SOURCE).find((f) => path.parse(f).name === name);
  if (!file) throw new Error(`Missing source layer: ${name}`);
  return path.join(SOURCE, file);
};

// Scale an image and place it on a transparent 960 canvas, clipping what falls outside.
async function place(input, scale, left, top) {
  const meta = await sharp(input).metadata();
  const w = Math.round(meta.width * scale), h = Math.round(meta.height * scale);
  left = Math.round(left); top = Math.round(top);
  const img = await sharp(input).ensureAlpha().resize(w, h, { kernel: 'lanczos3' }).png().toBuffer();
  const x0 = Math.max(0, -left), y0 = Math.max(0, -top);
  const cw = Math.min(w - x0, SIZE - Math.max(0, left)), ch = Math.min(h - y0, SIZE - Math.max(0, top));
  const piece = await sharp(img).extract({ left: x0, top: y0, width: cw, height: ch }).png().toBuffer();
  return sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: piece, left: Math.max(0, left), top: Math.max(0, top) }]);
}

// Move the left half of a source image right and its right half left by px (source pixels),
// for pieces that come as a separate pair (horns), so the pair can sit closer together.
async function pinch(input, px) {
  const { width, height } = await sharp(input).metadata();
  const half = Math.floor(width / 2);
  const left = await sharp(input).ensureAlpha().extract({ left: 0, top: 0, width: half, height }).png().toBuffer();
  const right = await sharp(input).ensureAlpha().extract({ left: half, top: 0, width: width - half, height }).png().toBuffer();
  return sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: left, left: px, top: 0 }, { input: right, left: half - px, top: 0 }]).png().toBuffer();
}

async function write(builder, rel) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await builder.png({ compressionLevel: 9 }).toFile(file);
  console.log(`wrote ${rel}`);
}

(async () => {
  for (const name of JACKETS) await write(await place(source(name), JACKET, 0, 0), `Assets/Clothing/${name}.png`);

  for (const [name, f] of Object.entries(HEADWEAR)) await write(await place(source(name), f.scale, f.left, f.top), `Assets/Headwear/${name}.png`);

  for (const [name, f] of Object.entries(FITTED)) {
    const art = f.inset ? await pinch(source(name), Math.round(f.inset / f.scale)) : source(name);
    for (const [file, head] of Object.entries(HEADS)) {
      const y = head[f.anchor] + f.dy;
      await write(await place(art, f.scale, FACE_X - f.sx * f.scale, y - f.sy * f.scale), `Assets/Headwear/${name}/${file}`);
    }
  }
})().catch((e) => { console.error(e.message); process.exitCode = 1; });

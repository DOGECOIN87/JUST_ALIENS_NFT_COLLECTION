#!/usr/bin/env node
// Build the 960x960 clothing and headwear layers from the clean originals in
// Assets/Source_Layers, sized and placed for the alien heads in Assets/Expression_Colors.
//
//   Assets/Clothing/<Name>.png       drawn under the head (jackets, suits)
//   Assets/Headwear/<Name>.png       drawn over the head, worn with any jacket
//
// Heads are never resized: anything worn on the head is fitted to the full-size head.
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
  Beanie: { scale: 0.635, left: 78, top: -119 },
  'Spiky_Hair': { scale: 0.30, left: 302, top: -15 },
  // Pushed up on the forehead: over the eyes the lenses are smaller than the alien's eyes.
  Goggles: { scale: 0.34, left: 274, top: 30 },
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

async function write(builder, rel) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await builder.png({ compressionLevel: 9 }).toFile(file);
  console.log(`wrote ${rel}`);
}

(async () => {
  for (const name of JACKETS) await write(await place(source(name), JACKET, 0, 0), `Assets/Clothing/${name}.png`);

  for (const [name, f] of Object.entries(HEADWEAR)) await write(await place(source(name), f.scale, f.left, f.top), `Assets/Headwear/${name}.png`);
})().catch((e) => { console.error(e.message); process.exitCode = 1; });

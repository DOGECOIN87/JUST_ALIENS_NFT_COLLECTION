#!/usr/bin/env node
// Build the 960x960 clothing and headwear layers from the clean originals in
// Assets/Source_Layers, sized and placed for the alien heads in Assets/Expression_Colors.
//
//   Assets/Clothing/<Name>.png       drawn under the head (jackets, suits)
//   Assets/Clothing/Over/<Name>.png  drawn over the head (the astronaut helmet)
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
  'Spiky_Hair': { scale: 0.318, left: 290, top: -21 },
  // Pushed up on the forehead: over the eyes the lenses are smaller than the alien's eyes.
  Goggles: { scale: 0.34, left: 274, top: 30 },
  // Cups against the sides of the head at eye height, band resting on the crown.
  Headphones: { scale: 0.70, left: 47, top: -66 },
};
// The helmet is sized so its visor shows the whole full-size face (eyes to mouth), and the
// spacesuit under it is enlarged and lowered so the helmet's neck ring rests on the suit's.
const HELMET = { scale: 0.69, visorTop: 205, faceX: 487 }; // visor in the original: x 202-1053, y 354-936
const HELMET_SUIT = { scale: 0.92, ringX: 625, ringY: 598 }; // the suit's neck ring in its original

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

// The helmet's visor is a transparent hole; fill it with the dark helmet interior so the
// background never shows through around the face.
async function visorInterior(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const inside = new Uint8Array(W * H), queue = [Math.round(H / 2) * W + (W >> 1)];
  inside[queue[0]] = 1;
  for (let k = 0; k < queue.length; k++) {
    const i = queue[k], x = i % W, y = (i / W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const X = x + dx, Y = y + dy, j = Y * W + X;
      if (X >= 0 && Y >= 0 && X < W && Y < H && !inside[j] && data[j * 4 + 3] < 128) { inside[j] = 1; queue.push(j); }
    }
  }
  const out = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) if (inside[i]) out.set([18, 20, 24, 255], i * 4);
  // grow it a little under the visor rim so no fringe of background survives at the edge
  return sharp(out, { raw: { width: W, height: H, channels: 4 } }).blur(3).png().toBuffer();
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

  const helmet = source('Astronaut_Helmet');
  const hLeft = HELMET.faceX - 627.5 * HELMET.scale, hTop = HELMET.visorTop - 354 * HELMET.scale;
  const ringTop = hTop + 985 * HELMET.scale; // where the helmet's neck ring begins
  const suit = await (await place(source('Spacesuit'), HELMET_SUIT.scale,
    HELMET.faceX - HELMET_SUIT.ringX * HELMET_SUIT.scale, ringTop + 20 - HELMET_SUIT.ringY * HELMET_SUIT.scale)).png().toBuffer();
  const interior = await (await place(await visorInterior(helmet), HELMET.scale, hLeft, hTop)).png().toBuffer();
  await write(sharp(suit).composite([{ input: interior }]), 'Assets/Clothing/Astronaut_Helmet.png');
  await write(await place(helmet, HELMET.scale, hLeft, hTop), 'Assets/Clothing/Over/Astronaut_Helmet.png');
})().catch((e) => { console.error(e.message); process.exitCode = 1; });

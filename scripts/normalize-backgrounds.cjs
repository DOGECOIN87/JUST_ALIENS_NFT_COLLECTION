#!/usr/bin/env node
// Bring every background to the 960x960 canvas the alien layers are drawn on.
// Larger or non-square images are scaled to cover the square and cropped (centred,
// unless CROP says otherwise); the file keeps its name and format.
//
//   node scripts/normalize-backgrounds.cjs
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const DIRS = ['Assets/Background', 'Assets/Enhanced_Backgrounds'];
const SIZE = 960;
// Earth sits left of centre in the photo; cropping from the right keeps it beside the head.
const CROP = { 'Earthrise.webp': 'right' };
const ENCODE = { '.png': (s) => s.png({ compressionLevel: 9 }), '.jpg': (s) => s.jpeg({ quality: 92, mozjpeg: true }),
  '.jpeg': (s) => s.jpeg({ quality: 92, mozjpeg: true }), '.webp': (s) => s.webp({ quality: 92 }) };

(async () => {
  const changed = new Map();
  for (const dir of DIRS) {
    for (const name of fs.readdirSync(path.join(root, dir)).sort()) {
      const ext = path.extname(name).toLowerCase();
      if (!ENCODE[ext]) continue;
      const file = path.join(root, dir, name);
      const { width, height } = await sharp(file).metadata();
      if (width === SIZE && height === SIZE) continue;
      const out = await ENCODE[ext](sharp(file).resize(SIZE, SIZE, { fit: 'cover', position: CROP[name] || 'centre', kernel: 'lanczos3' })).toBuffer();
      fs.writeFileSync(file, out);
      changed.set(name, crypto.createHash('sha256').update(out).digest('hex'));
      console.log(`${dir}/${name}: ${width}x${height} -> ${SIZE}x${SIZE}`);
    }
  }
  // Keep the enhancement manifest's record of the preserved files current.
  const manifestPath = path.join(root, 'Assets/Enhanced_Backgrounds/enhancement-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  for (const b of manifest.backgrounds) {
    if (changed.has(b.output)) Object.assign(b, { output_sha256: changed.get(b.output), width: SIZE, height: SIZE });
  }
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`${changed.size} backgrounds resized`);
})().catch((e) => { console.error(e.message); process.exitCode = 1; });

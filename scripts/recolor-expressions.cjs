#!/usr/bin/env node
// Recolour the grey Expression heads into the ten skin colours.
//
// The heads are flat-shaded greys: skin 132, shade ~97, deep shade ~17, eyes ~0,
// highlights above 132. Skin grey 132 becomes the skin colour, darker greys scale
// down from it (so shading and black eyes keep their depth) and lighter greys
// blend from it toward white (so highlights stay highlights). Alpha is untouched.
//
//   node scripts/recolor-expressions.cjs        # writes Assets/Expression_Colors/<Skin>/<Expression>.png
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const SOURCE = path.join(root, 'Assets/Expression');
const OUT = path.join(root, 'Assets/Expression_Colors');
const SKIN_GREY = 132;

const SKINS = {
  Platinum: '#868686',
  Lime: '#819846',
  'Sky Blue': '#5588B2',
  'Coral Red': '#BD4F54',
  Violet: '#855DA4',
  'Honey Gold': '#BA955A',
  Graphite: '#484847',
  'Forest Green': '#7CB575',
  'Hot Pink': '#C25C88',
  Cyan: '#58B4B5',
};

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

// Gradient map for one channel: black -> skin colour at SKIN_GREY -> white.
function lut(target) {
  return Uint8Array.from({ length: 256 }, (_, v) => Math.round(v <= SKIN_GREY
    ? (target * v) / SKIN_GREY
    : target + ((255 - target) * (v - SKIN_GREY)) / (255 - SKIN_GREY)));
}

(async () => {
  const expressions = fs.readdirSync(SOURCE).filter((f) => f.endsWith('.png')).sort();
  for (const [skin, hex] of Object.entries(SKINS)) {
    const maps = rgb(hex).map(lut);
    const dir = path.join(OUT, skin.replace(/ /g, '_'));
    fs.mkdirSync(dir, { recursive: true });
    for (const file of expressions) {
      const { data, info } = await sharp(path.join(SOURCE, file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      for (let i = 0; i < data.length; i += 4) {
        // The heads are grey, so any channel is the grey level; average guards stray tints.
        const v = Math.round((data[i] + data[i + 1] + data[i + 2]) / 3);
        data[i] = maps[0][v]; data[i + 1] = maps[1][v]; data[i + 2] = maps[2][v];
      }
      await sharp(data, { raw: info }).png({ compressionLevel: 9 }).toFile(path.join(dir, file));
    }
    console.log(`${skin}: ${expressions.length} heads`);
  }
})();

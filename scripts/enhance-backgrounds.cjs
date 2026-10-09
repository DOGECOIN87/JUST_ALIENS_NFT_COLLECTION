#!/usr/bin/env node
// Apply the supplied texture without regenerating the source artwork.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const sourceDir = path.join(root, 'Assets/Background');
const outputDir = path.join(root, 'Assets/Enhanced_Backgrounds');
const texturePath = path.join(root, 'Assets/halftone_grayscale.png');
const manifestPath = path.join(outputDir, 'enhancement-manifest.json');
const overlayOpacity = 0.30;
const vignetteStrength = 0.45;
const vignetteStart = 0.28;
const preservedCounterparts = {
  'Spheres.png': 'goats_contest_mattrick (17).png',
  'Cubes.png': 'goats_contest_mattrick (18).png',
  'Pyramids.png': 'goats_contest_mattrick (19).png',
};
const isImage = name => /\.(png|jpe?g|webp)$/i.test(name);
const key = name => path.parse(name).name.toLowerCase();
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

async function main() {
  await fs.mkdir(outputDir, {recursive: true});
  const sources = (await fs.readdir(sourceDir)).filter(isImage).sort();
  const existing = (await fs.readdir(outputDir)).filter(isImage).sort();
  const byName = new Map(existing.map(name => [key(name), name]));
  const before = new Map();
  for (const name of existing) before.set(name, hash(await fs.readFile(path.join(outputDir, name))));
  let previous = {};
  try { previous = JSON.parse(await fs.readFile(manifestPath, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const oldRecords = new Map((previous.backgrounds || []).map(item => [item.source, item]));
  const textureBytes = await fs.readFile(texturePath);
  const textureCache = new Map();
  const backgrounds = [];
  let created = 0;

  for (const source of sources) {
    const sourceBytes = await fs.readFile(path.join(sourceDir, source));
    const sourceSha256 = hash(sourceBytes);
    const counterpart = preservedCounterparts[source];
    const match = (counterpart && existing.includes(counterpart) && counterpart) || byName.get(key(source));
    if (match) {
      const old = oldRecords.get(source);
      backgrounds.push(old && old.output === match && old.source_sha256 === sourceSha256 && old.output_sha256 === before.get(match)
        ? old
        : {source, source_sha256: sourceSha256, output: match, output_sha256: before.get(match), status: 'preserved_existing'});
      console.log(`KEEP ${source} -> ${match}`);
      continue;
    }

    const {data: base, info} = await sharp(sourceBytes).toColourspace('srgb').ensureAlpha().raw().toBuffer({resolveWithObject: true});
    const {width, height, channels} = info;
    if (channels !== 4) throw new Error(`Unexpected channel count: ${source}`);
    const dimensions = `${width}x${height}`;
    if (!textureCache.has(dimensions)) {
      const texture = await sharp(textureBytes).resize(width, height, {fit: 'fill', kernel: 'lanczos3'})
        .toColourspace('srgb').ensureAlpha().raw().toBuffer();
      textureCache.set(dimensions, texture);
    }
    const texture = textureCache.get(dimensions);
    const pixels = Buffer.alloc(base.length);
    for (let y = 0; y < height; y++) {
      const ny = height > 1 ? (2 * y / (height - 1) - 1) : 0;
      for (let x = 0; x < width; x++) {
        const nx = width > 1 ? (2 * x / (width - 1) - 1) : 0;
        const radius = Math.hypot(nx, ny) / Math.SQRT2;
        const t = Math.max(0, Math.min(1, (radius - vignetteStart) / (1 - vignetteStart)));
        const falloff = t * t * (3 - 2 * t);
        const brightness = 1 - vignetteStrength * falloff;
        const i = (y * width + x) * 4;
        const opacity = overlayOpacity * texture[i + 3] / 255;
        for (let channel = 0; channel < 3; channel++) {
          pixels[i + channel] = Math.round((base[i + channel] * (1 - opacity) + texture[i + channel] * opacity) * brightness);
        }
        pixels[i + 3] = base[i + 3];
      }
    }

    const output = `${path.parse(source).name}.png`;
    const png = await sharp(pixels, {raw: {width, height, channels: 4}})
      .png({compressionLevel: 9, palette: false}).toBuffer();
    // Exclusive creation fails safely if a file appeared after the inventory.
    await fs.writeFile(path.join(outputDir, output), png, {flag: 'wx'});
    byName.set(key(output), output);
    backgrounds.push({source, source_sha256: sourceSha256, output, output_sha256: hash(png), width, height, status: 'composited'});
    created++;
    console.log(`ADD  ${source} -> ${output} (${dimensions})`);
  }

  for (const [name, digest] of before) {
    if (hash(await fs.readFile(path.join(outputDir, name))) !== digest) throw new Error(`Existing file changed: ${name}`);
  }
  const manifest = {
    source_directory: 'Assets/Background',
    texture: 'Assets/halftone_grayscale.png',
    texture_sha256: hash(textureBytes),
    settings: {
      blend_mode: 'normal', overlay_opacity: overlayOpacity,
      vignette_max_black_opacity: vignetteStrength, vignette_start_radius: vignetteStart,
      vignette_profile: 'smoothstep, elliptical radius normalized to the corners',
      texture_resize: 'Lanczos3 to source dimensions',
      output: 'lossless RGBA PNG; source dimensions and alpha preserved',
    },
    backgrounds,
  };
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify({source_backgrounds: sources.length, created, skipped: sources.length - created, preexisting_images_unchanged: before.size}, null, 2));
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });

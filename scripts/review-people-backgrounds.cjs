#!/usr/bin/env node
// Verify the reviewed people backgrounds and rebuild their before/after sheets.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'docs/people-backgrounds');
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const git = args => execFileSync('git', args, {cwd:root, maxBuffer:30e6});
const escape = s => s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');

async function pair(asset, before, after, tile) {
  const gap=12, width=tile*2+gap, height=tile+82;
  const title=Buffer.from(`<svg width="${width}" height="${height}"><style>text{font-family:DejaVu Sans,sans-serif;fill:#242424}</style><rect width="100%" height="100%" fill="#f4f3f0"/><text x="0" y="24" font-size="20" font-weight="bold">${escape(asset.label)}</text><text x="0" y="50" font-size="12" letter-spacing="1.5">BEFORE</text><text x="${tile+gap}" y="50" font-size="12" letter-spacing="1.5">AFTER · BLACK &amp; WHITE DRAWN</text><text x="0" y="${height-8}" font-size="10">${escape(path.basename(asset.file))} · ${asset.width} × ${asset.height}</text></svg>`);
  const thumbs=await Promise.all([before,after].map(input=>sharp(input).resize(tile,tile,{fit:'contain',background:'#deddd9'}).flatten({background:'#deddd9'}).png().toBuffer()));
  return sharp(title).composite([{input:thumbs[0],left:0,top:62},{input:thumbs[1],left:tile+gap,top:62}]).png().toBuffer();
}

async function main() {
  const manifest=JSON.parse(await fs.readFile(path.join(root,'Assets/people-backgrounds-manifest.json'),'utf8'));
  await fs.mkdir(path.join(out,'pairs'),{recursive:true});
  const cards=[], checks=[];
  for (const a of manifest.assets) {
    const before=git(['show',`${manifest.original_commit}:${a.file}`]);
    const after=await fs.readFile(path.join(root,a.file));
    if(hash(before)!==a.original_sha256||hash(after)!==a.output_sha256) throw new Error(`Hash mismatch: ${a.file}`);
    const meta=await sharp(after).metadata();
    if(meta.width!==a.width||meta.height!==a.height||meta.hasAlpha!==a.has_alpha) throw new Error(`Canvas mismatch: ${a.file}`);
    const old=await sharp(before).toColourspace('srgb').ensureAlpha().raw().toBuffer();
    const now=await sharp(after).toColourspace('srgb').ensureAlpha().raw().toBuffer();
    for(let i=0;i<now.length;i+=4) {
      if(now[i]!==now[i+1]||now[i]!==now[i+2]) throw new Error(`Color remains: ${a.file}`);
      if(now[i+3]!==old[i+3]) throw new Error(`Alpha changed: ${a.file}`);
    }
    checks.push({file:a.file,width:a.width,height:a.height,grayscale:true,original_alpha_preserved:true,hashes_verified:true});
    const big=await pair(a,before,after,600);
    await sharp(big).jpeg({quality:95}).toFile(path.join(out,'pairs',a.id+'.jpg'));
    cards.push(await pair(a,before,after,360));
  }
  for(let start=0;start<cards.length;start+=4) {
    const batch=cards.slice(start,start+4), cardWidth=732,cardHeight=442;
    const margin=30,gap=28,width=margin*2+cardWidth*2+gap,height=100+cardHeight*2+gap+margin;
    const header=Buffer.from(`<svg width="${width}" height="${height}"><rect width="100%" height="100%" fill="#f4f3f0"/><text x="30" y="38" font-family="DejaVu Sans,sans-serif" font-size="25" font-weight="bold" fill="#202020">JUST ALIENS — PEOPLE BACKGROUNDS</text><text x="30" y="66" font-family="DejaVu Sans,sans-serif" font-size="15" fill="#505050">Before &amp; after · pencil and ink · ${Math.floor(start/4)+1} / ${Math.ceil(cards.length/4)}</text></svg>`);
    await sharp(header).composite(batch.map((input,i)=>({input,left:margin+(i%2)*(cardWidth+gap),top:100+Math.floor(i/2)*(cardHeight+gap)}))).jpeg({quality:95}).toFile(path.join(out,`before-after-${Math.floor(start/4)+1}.jpg`));
  }
  const selected=new Set(manifest.assets.map(a=>a.file));
  const inventory=git(['ls-tree','-r','-z',manifest.original_commit,'--','Assets/Background','Assets/Enhanced_Backgrounds']).toString().split('\0').filter(Boolean);
  let unchanged=0;
  for(const row of inventory) {
    const [info,file]=row.split('\t');
    if(!/\.(png|jpe?g|webp)$/i.test(file)||selected.has(file)) continue;
    const actual=git(['hash-object',path.join(root,file)]).toString().trim();
    if(actual!==info.split(' ')[2]) throw new Error(`Unselected background changed: ${file}`);
    unchanged++;
  }
  const verification={people_backgrounds_verified:checks.length,other_backgrounds_unchanged:unchanged,checks};
  await fs.writeFile(path.join(out,'verification.json'),JSON.stringify(verification,null,2)+'\n');
  console.log(JSON.stringify({people_backgrounds_verified:checks.length,other_backgrounds_unchanged:unchanged,comparison_sheets:Math.ceil(cards.length/4),individual_pairs:cards.length}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});

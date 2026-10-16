// Register a canonical overlay to the chosen expression without distorting art.
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const review=require('./headwear-review.cjs');
const ROOT=path.resolve(__dirname,'..');
const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'Assets/Headwear/alignment-manifest.json')));
const cache=new Map();
async function alignedHeadwear(asset,expression='Amused') {
 if(review.excludedAsset(asset))throw new Error('Rejected headwear: '+asset.file);
 const corrected=review.expressionOverride(asset.file,expression);
 if(corrected)return fs.readFileSync(corrected);
 const key=asset.id+'/'+expression;
 if(!cache.has(key))cache.set(key,(async()=>{
  const fit=manifest.expressionFits[expression];
  if(!fit)throw new Error('Unreviewed expression: '+expression);
  if(expression==='Amused')return fs.readFileSync(path.join(ROOT,asset.file));
  const b=asset.placement,scale=Math.min(fit.scale,1248/b.width,1248/b.height);
  const width=Math.round(b.width*scale),height=Math.round(b.height*scale);
  const left=Math.max(3,Math.min(1251-width,Math.round(b.left*scale+fit.dx)));
  const top=Math.max(3,Math.min(1251-height,Math.round(b.top*scale+fit.dy)));
  const input=await sharp(path.join(ROOT,asset.file)).extract(b).resize(width,height,{kernel:'lanczos3'}).png().toBuffer();
  return sharp({create:{width:1254,height:1254,channels:4,background:'#0000'}}).composite([{input,left,top}]).png().toBuffer();
 })());
 return cache.get(key);
}
module.exports={alignedHeadwear};

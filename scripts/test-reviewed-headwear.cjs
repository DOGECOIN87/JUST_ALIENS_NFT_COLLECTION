'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),sharp=require('sharp');
const root=path.resolve(__dirname,'..'),review=require('./headwear-review.cjs'),generator=require('../generate_collection.js');
const mode=process.argv.includes('--headwear-fitted')?'fitted':process.argv.includes('--headwear-aligned')?'aligned':'default';
async function main(){
 let checked=0,first;
 for(let n=0;n<10;n++){
  const pieces=generator.plan();if(!first)first=pieces;assert.equal(pieces.length,1000);assert.equal(pieces.filter(p=>p.type==='Rare').length,36);assert.equal(pieces.filter(p=>p.type==='Normal').length,963);
  assert.equal(pieces.filter(p=>p.attributes.some(a=>a.trait_type==='Text')).length,500);
  const seen=new Set();for(const p of pieces){
   for(const file of p.layers)assert(!review.excludedFile(file),file);
   assert(!p.attributes.some(a=>['Clothing','Headwear'].includes(a.trait_type)&&/^(Beanie|Hooded Jacket (Grey|White|Camo|Gold|Black Red))$/.test(a.value)));
   const key=JSON.stringify(p.attributes);assert(!seen.has(key));seen.add(key);
   const h=p.attributes.find(a=>a.trait_type==='Headwear');if(h&&/Astronaut/.test(h.value))assert.equal(p.attributes.find(a=>a.trait_type==='Clothing').value,'Spacesuit');
   if(p.type==='Normal')assert(p.attributes.some(a=>a.trait_type==='Clothing'));
  }checked+=pieces.length;
 }
 const candidates=first.filter(p=>p.type==='Normal'&&(mode!=='fitted'||p.attributes.some(a=>a.trait_type==='Headwear'&&a.value==='original-Astronaut_Helmet'))).slice(0,2);
 for(const p of candidates){const image=await generator.render(p),m=await sharp(image).metadata();assert.equal(m.width,mode==='default'?960:1254);assert.equal(m.height,m.width);}
 const result={mode,passed:true,planned_pieces_checked:checked,rendered_pieces:candidates.length,rejected_sources_absent:true,helmet_requires_spacesuit:true};
 const out=path.join(root,'best_pairings','verification-'+mode+'.json');fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}
main().catch(e=>{console.error(e);process.exitCode=1;});

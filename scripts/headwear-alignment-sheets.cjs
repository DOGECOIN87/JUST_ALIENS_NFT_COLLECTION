#!/usr/bin/env node
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),sharp=require('sharp');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(ROOT,'headwear-alignment-preview');
const {alignedHeadwear}=require('./render-aligned-headwear.cjs');
const SIZE=1254,TILE=500,LABEL=46,COLS=5,HEADER=112;
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const cache=new Map();
async function full(file){if(!cache.has(file))cache.set(file,await sharp(path.join(ROOT,file)).resize(SIZE,SIZE,{fit:'fill',kernel:'lanczos3'}).png().toBuffer());return cache.get(file);}
function label(text,width=TILE){return Buffer.from(`<svg width="${width}" height="${LABEL}"><rect width="100%" height="100%" fill="#11151d"/><text x="18" y="30" font-family="DejaVu Sans" font-size="21" fill="#ffffff">${text}</text></svg>`);}
async function sheet(items,name,subtitle,file,tile=TILE,cols=COLS){
 const width=cols*tile,height=HEADER+Math.ceil(items.length/cols)*(tile+LABEL);
 const layers=[{input:Buffer.from(`<svg width="${width}" height="${HEADER}"><text x="24" y="47" font-family="DejaVu Sans" font-size="32" fill="#ffffff">${name}</text><text x="24" y="82" font-family="DejaVu Sans" font-size="22" fill="#aebacd">${subtitle}</text></svg>`),left:0,top:0}];
 for(let i=0;i<items.length;i++){const left=i%cols*tile,top=HEADER+Math.floor(i/cols)*(tile+LABEL);layers.push({input:items[i].image,left,top},{input:label(items[i].label,tile),left,top:top+tile});}
 const png=await sharp({create:{width,height,channels:3,background:'#11151d'}}).composite(layers).png().toBuffer();
 await sharp(png).raw().toBuffer();
 const jpg=await sharp(png).jpeg({quality:96,chromaSubsampling:'4:4:4'}).toBuffer();
 fs.writeFileSync(file+'.png.tmp',png);fs.renameSync(file+'.png.tmp',file+'.png');fs.writeFileSync(file+'.jpg',jpg);
}
async function catalog(assets,expression='Amused'){
 const head=await full(`Assets/Expression_Colors/Platinum/${expression}.png`),items=[];
 for(const a of assets){const b=await sharp({create:{width:SIZE,height:SIZE,channels:4,background:'#757981'}}).composite([{input:head},{input:await alignedHeadwear(a,expression)}]).png().toBuffer();items.push({image:await sharp(b).extract({left:167,top:0,width:920,height:920}).resize(380,380).removeAlpha().png().toBuffer(),label:a.id});}
 for(let i=0;i<items.length;i+=30)await sheet(items.slice(i,i+30),`HEADWEAR FIT REVIEW / ${expression}`,`Assets ${i+1}-${Math.min(i+30,items.length)} / reference: Assets/Headwear`,path.join(OUT,`review-${expression}-${Math.floor(i/30)+1}`),380,5);
}
async function main(){
 fs.mkdirSync(OUT,{recursive:true});const m=JSON.parse(fs.readFileSync(path.join(ROOT,'Assets/Headwear/alignment-manifest.json')));
 if(process.argv.includes('--review')){await catalog(m.assets,process.env.QA_EXPRESSION||'Amused');return;}
 const selected={american:[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,17,20,21,24,26,28,33,35,39,42],cultural:[1,2,3,4,5,6,7,8,11,12,13,16,18,20,23,24,26,29,31,32,33,35,37,42,45]};
 const all=[...m.assets,...m.held],wanted=Object.entries(selected).flatMap(([set,nums])=>nums.map(n=>set+'-'+String(n).padStart(2,'0'))),picked=wanted.map(id=>all.find(a=>a.id===id));
 const skins=['Platinum','Honey_Gold','Cyan','Coral_Red','Lime','Sky_Blue','Violet','Forest_Green','Hot_Pink','Graphite'];
 const moods=['Amused','Happy','Curious','Chill','Surprised','Angry','Confused','Sad','Sour'];
 const clothes=['Leather_Jacket','Bomber_Jacket','Tech_Jacket','Hoodie_Black','Hoodie_White','Winter_Jacket','Safari_Jacket','Military_Jacket','Camo_Jacket','Spacesuit'];
 const scenes=['Assets/Enhanced_Backgrounds/goats_contest_mattrick (17).png','Assets/Enhanced_Backgrounds/goats_contest_mattrick (18).png','Assets/Enhanced_Backgrounds/goats_contest_mattrick (19).png','Assets/Background/Cavern_of_Light.png','Assets/Background/Wormhole_Vortex.png'];
 const before=[],after=[],samples=[];
 for(let i=0;i<picked.length;i++){
  const a=picked[i],skin=skins[i%skins.length],expression=moods[i%moods.length],clothing=a.kind==='helmet'?'Spacesuit':clothes[i*3%clothes.length];
  const background=scenes[i%scenes.length],clothingFile=`Assets/Clothing/${clothing}.png`,headFile=`Assets/Expression_Colors/${skin}/${expression}.png`;
  const base=await sharp(await full(background)).composite([{input:await full(clothingFile)},{input:await full(headFile)}]).png().toBuffer();
  const record={sample:i+1,asset:a.id,description:a.description,reference:a.reference,skin,expression,clothing,background,clothingFile,headFile,baseSha256:hash(base),pair:[]};
  for(const state of ['before','after']){
   const held=state==='after'&&m.held.some(x=>x.id===a.id),headwear=held?null:state==='before'?a.source:a.file;
   const rendered=headwear?await sharp(base).composite([{input:state==='after'?await alignedHeadwear(a,expression):await full(headwear)}]).png().toBuffer():base;
   if(process.env.HEADWEAR_QA_INDIVIDUALS){const dir=path.join(process.env.HEADWEAR_QA_INDIVIDUALS,state);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,String(i+1).padStart(2,'0')+'.png'),rendered);}
   record.pair.push({state,headwear,renderedSha256:hash(rendered),...(held?{status:'excluded; source retained for rework'}:{})});
   (state==='before'?before:after).push({image:await sharp(rendered).resize(TILE).removeAlpha().png().toBuffer(),label:`${String(i+1).padStart(2,'0')}  ${a.id}  /  ${held?'EXCLUDED':expression}`});
  }
  samples.push(record);
 }
 await sheet(before,'JUST ALIENS / BEFORE','50 samples / original source headwear placement',path.join(OUT,'headwear-before-50'));
 await sheet(after,'JUST ALIENS / AFTER','Same 50 bases / revised headwear fit and exclusions',path.join(OUT,'headwear-after-50'));
 fs.writeFileSync(path.join(OUT,'samples.json'),JSON.stringify({count:50,artworkCanvas:SIZE,comparison:'Identical base layers; only the headwear overlay changes. Excluded traits render without headwear.',samples},null,2)+'\n');
 console.log('Saved paired 50-sample sheets.');
}
module.exports={sheet,catalog,full};
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});

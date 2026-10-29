#!/usr/bin/env node
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),sharp=require('sharp');
const root=path.resolve(__dirname,'..');process.chdir(root);
const review=require('./headwear-review.cjs'),{render}=require('./reviewed-pairings.cjs');
const previous=process.argv.includes('--reuse')?require('../docs/people-backgrounds/random-50-recipes.json'):null;
if(previous&&previous.combinations.length!==50)throw Error('Expected 50 saved combinations');
const seed=previous?previous.seed:crypto.randomBytes(12).toString('hex');let state=parseInt(seed.slice(0,8),16);
function random(){state|=0;state=state+0x6D2B79F5|0;let t=Math.imul(state^state>>>15,1|state);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;}
const pick=a=>a[Math.floor(random()*a.length)],shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
const bases=require('../best_pairings/reviewed-pairings.json').pairings.filter(p=>!review.excludedFile('Assets/Clothing/'+p.clothing+'.png')&&(!p.headwear||!review.excludedFile(p.headwear)));
const drawn=require('../Assets/people-backgrounds-manifest.json').assets.map(a=>a.file).filter(f=>!review.excludedFile(f));
const backgrounds=['Assets/Background','Assets/Enhanced_Backgrounds'].flatMap(dir=>fs.readdirSync(dir).filter(f=>/\.(png|jpg|jpeg|webp)$/i.test(f)&&!f.startsWith('.')).map(f=>dir+'/'+f)).filter(f=>!review.excludedFile(f));
const out='docs/people-backgrounds',records=[],tiles=[],seen=new Set();
function compatible(p,b){const n=path.basename(b).toLowerCase();if(!p.caption)return true;const color=path.basename(p.caption).toLowerCase();const accents=['light-blue','light_blue','blue','green','pink','red','orange'];const accent=accents.find(a=>n.includes(a));return !accent||color.includes(accent.replace('_','-'))||(accent.startsWith('light')&&color.includes('blue'))||(accent==='red'&&color.includes('orange'));}
(async()=>{
 const guaranteed=shuffle([...drawn]);let deck=[];
 while(records.length<50){if(!deck.length)deck=shuffle([...bases]);const base=previous?previous.combinations[records.length]:deck.pop();const bg=previous?base.background:(records.length<drawn.length?guaranteed[records.length]:pick(backgrounds.filter(b=>compatible(base,b))));
 const p={...base,background:bg},dna=JSON.stringify([p.skin,p.expression,p.clothing,p.headwear,p.background,p.caption]);if(seen.has(dna))continue;
 const result=await render(p);seen.add(dna);const n=records.length+1;
 records.push({number:n,skin:p.skin,expression:p.expression,clothing:p.clothing,headwear:p.headwear,headwear_placement:p.headwear_placement,background:bg,caption:p.caption,protected_face_pixels:result.check});
 const label=Buffer.from(`<svg width="400" height="432"><rect width="100%" height="100%" fill="#131923"/><text x="12" y="422" fill="white" font-family="DejaVu Sans" font-size="16">${String(n).padStart(2,'0')} · ${p.skin.replaceAll('_',' ')} / ${p.expression}</text></svg>`);
 tiles.push(await sharp(label).composite([{input:await sharp(result.png).resize(400,400).png().toBuffer(),left:0,top:0}]).png().toBuffer());
 }
 async function sheet(sub,file,small){const h=100+Math.ceil(sub.length/5)*432;const header=Buffer.from(`<svg width="2000" height="${h}"><rect width="100%" height="100%" fill="#131923"/><text x="24" y="43" fill="white" font-family="DejaVu Sans" font-size="32" font-weight="bold">JUST ALIENS · RANDOM 50 INSPECTION</text><text x="24" y="78" fill="#bac5d4" font-family="DejaVu Sans" font-size="21">Very faint background blur · characters and text stay sharp</text></svg>`);const raw=await sharp(header).composite(sub.map((input,i)=>({input,left:i%5*400,top:100+Math.floor(i/5)*432}))).png().toBuffer();let jpg;for(let quality=88;quality>=60;quality-=7){jpg=await sharp(raw).resize(small?1500:2000).jpeg({quality,mozjpeg:true}).toBuffer();if(jpg.length<1000000)break;}fs.writeFileSync(path.join(out,file),jpg);}
 await sheet(tiles,'random-50-sheet.jpg',true);await sheet(tiles.slice(0,25),'random-50-detail-01-25.jpg',false);await sheet(tiles.slice(25),'random-50-detail-26-50.jpg',false);
 if(records.some(p=>review.excludedFile(p.background)))throw Error('Excluded background selected');
 if(records.some(p=>p.headwear&&(/12\)\.png|space_flight_helmet|Astronaut_Helmet/i.test(p.headwear)||review.excludedFile(p.headwear))))throw Error('Excluded headwear selected');
 fs.writeFileSync(path.join(out,'random-50-recipes.json'),JSON.stringify({seed,background_blur_sigma:require('./background-style.cjs').backgroundBlurSigma,unique_combinations:seen.size,drawn_backgrounds_covered:drawn.filter(b=>records.some(p=>p.background===b)).length,combinations:records},null,2)+'\n');
 console.log(JSON.stringify({rendered:records.length,unique:seen.size,drawn_backgrounds:drawn.length,excluded_headwear:0,seed}));
})().catch(e=>{console.error(e);process.exitCode=1;});

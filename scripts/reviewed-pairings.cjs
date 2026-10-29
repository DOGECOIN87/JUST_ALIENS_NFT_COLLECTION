#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),sharp=require('sharp');
const root=path.resolve(__dirname,'..'),review=require('./headwear-review.cjs');
const {backgroundBlurSigma}=require('./background-style.cjs');
const argv=process.argv.slice(2),arg=(flag,fallback)=>argv.includes(flag)?argv[argv.indexOf(flag)+1]:fallback;
const out=path.resolve(arg('--out',path.join(root,'best_pairings'))),count=Number(arg('--count',50));
const baseline=JSON.parse(fs.readFileSync(path.join(root,'best_pairings/reviewed-pairings.json')));
const clear=()=>sharp({create:{width:960,height:960,channels:4,background:'#0000'}}),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const eyeRects={Amused:[[288,324,183,179],[520,322,174,179]],Angry:[[313,441,160,102],[511,429,167,111]],Chill:[[283,326,188,189],[513,326,181,190]],Confused:[[285,418,173,119],[510,405,158,125]],Curious:[[281,343,179,166],[512,334,164,162]],Happy:[[282,299,188,185],[516,297,169,186]],Sad:[[287,403,173,124],[514,384,167,134]],Sour:[[280,320,180,184],[501,329,186,178]],Surprised:[[283,351,177,164],[515,342,169,169]]};
async function registeredHat(p){
 if(!p.headwear)return null;
 if(review.excludedFile(p.headwear))throw Error('Rejected headwear in recipe '+p.id);
 if(p.headwear.includes('original-Astronaut_Helmet'))return sharp(review.helmetFile(p.expression)).resize(960,960).png().toBuffer();
 const corrected=review.expressionOverride(p.headwear,p.expression);if(corrected)return sharp(corrected).resize(960,960).png().toBuffer();
 const r=await sharp(path.join(root,p.headwear)).ensureAlpha().raw().toBuffer({resolveWithObject:true});let l=r.info.width,t=r.info.height,right=-1,bottom=-1;
 for(let y=0;y<r.info.height;y++)for(let x=0;x<r.info.width;x++)if(r.data[(y*r.info.width+x)*4+3]>=8){l=Math.min(l,x);t=Math.min(t,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
 const b=p.headwear_placement,input=await sharp(path.join(root,p.headwear)).extract({left:l,top:t,width:right-l+1,height:bottom-t+1}).resize(b.width,b.height).png().toBuffer(),canvas=b.canvas||960;
 const full=await sharp({create:{width:canvas,height:canvas,channels:4,background:'#0000'}}).composite([{input,left:b.left,top:b.top}]).png().toBuffer();return sharp(full).resize(960,960).png().toBuffer();
}
async function faceCheck(hat,expression){if(!hat)return{eyes:0,mouth:0};const r=await sharp(hat).ensureAlpha().raw().toBuffer();let eyes=0,mouth=0;
 for(const [x,y,w,h] of eyeRects[expression])for(let yy=y+Math.ceil(h*.22);yy<y+h-Math.ceil(h*.22);yy++)for(let xx=x+Math.ceil(w*.22);xx<x+w-Math.ceil(w*.22);xx++)if(r[(yy*960+xx)*4+3]>=128)eyes++;
 for(let y=546;y<586;y++)for(let x=455;x<515;x++)if(r[(y*960+x)*4+3]>=128)mouth++;
 if(eyes||mouth)throw Error('Obstructed face: '+expression+' '+JSON.stringify({eyes,mouth}));return{eyes,mouth};
}
async function render(p){
 if(review.excludedFile(p.background))throw Error('Rejected background in recipe '+p.id);
 if(review.excludedFile('Assets/Clothing/'+p.clothing+'.png'))throw Error('Rejected clothing in recipe '+p.id);
 const hat=await registeredHat(p),check=await faceCheck(hat,p.expression),layers=[{input:path.join(root,'Assets/Clothing',p.clothing+'.png')},{input:path.join(root,'Assets/Expression_Colors',p.skin,p.expression+'.png')}];
 if(hat)layers.push({input:hat});const foreground=await clear().composite(layers).png().toBuffer();
 const background=await sharp(path.join(root,p.background)).resize(960,960,{fit:'cover'}).removeAlpha().blur(backgroundBlurSigma).png().toBuffer(),overlays=[{input:foreground}];if(p.caption)overlays.push({input:path.join(root,p.caption)});
 return{png:await sharp(background).composite(overlays).png().toBuffer(),check};
}
async function main(){
 if(!Number.isInteger(count)||count<1||count>50)throw Error('Count must be between 1 and 50');
 fs.mkdirSync(path.join(out,'Images'),{recursive:true});fs.mkdirSync(path.join(out,'Recipes'),{recursive:true});const pieces=baseline.pairings.slice(0,count),parts=[],records=[];
 for(const p of pieces){const {png,check}=await render(p),file=`Images/${String(p.id).padStart(2,'0')}.png`;fs.writeFileSync(path.join(out,file),png);
  const index=Buffer.from(`<svg width="960" height="960"><rect x="16" y="16" width="58" height="38" rx="8" fill="#0a0e14" fill-opacity=".8"/><text x="45" y="43" text-anchor="middle" font-family="DejaVu Sans" font-weight="bold" font-size="24" fill="white">${String(p.id).padStart(2,'0')}</text></svg>`);
  const numbered=await sharp(png).composite([{input:index}]).png().toBuffer();parts.push({input:await sharp(numbered).resize(600,600).png().toBuffer(),left:(p.id-1)%5*600,top:Math.floor((p.id-1)/5)*600});
  const record={...p,file,protected_face_pixels:check,sha256:hash(png)};records.push(record);fs.writeFileSync(path.join(out,'Recipes',String(p.id).padStart(2,'0')+'.json'),JSON.stringify(record,null,2)+'\n');
 }
 const sheet=await sharp({create:{width:3000,height:Math.ceil(count/5)*600,channels:3,background:'#14191f'}}).composite(parts).png().toBuffer();fs.writeFileSync(path.join(out,'Just_Aliens_Best_Pairings_50.png'),sheet);
 await sharp(sheet).resize({width:1500}).jpeg({quality:92,mozjpeg:true}).toFile(path.join(out,'best_pairings_sheet.jpg'));fs.copyFileSync(path.join(out,'best_pairings_sheet.jpg'),path.join(out,'Just_Aliens_Best_Pairings_50_Preview.jpg'));
 const result={reviewed_at:baseline.reviewed_at,based_on_commit:baseline.based_on_commit,pairings:records};fs.writeFileSync(path.join(out,'pairings.json'),JSON.stringify(result,null,2)+'\n');
 const csv='Number,Skin,Expression,Clothing,Headwear,Background,Caption\n'+records.map(p=>[p.id,p.skin,p.expression,p.clothing,p.headwear||'',p.background,p.caption||''].map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\n')+'\n';fs.writeFileSync(path.join(out,'best_pairings.csv'),csv);fs.writeFileSync(path.join(out,'pairings.csv'),csv);
 console.log(JSON.stringify({rendered:count,reviewed:true,output:out}));return result;
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={render,faceCheck,main};

#!/usr/bin/env node
// Deterministic expression-specific fitting. Source artwork is preserved.
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const root=path.resolve(__dirname,'..'),out=path.join(root,'headwear-fitted');
const expressionDir=path.join(root,'Assets/Expression_Colors/Platinum');
const names=fs.readdirSync(expressionDir).filter(f=>f.endsWith('.png')).sort();
async function mask(file){const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});return {data,info};}
function silhouette(m, head=false){const {data,info}=m,w=info.width,h=info.height;const rows=[];let left=w,right=0,top=h,bottom=0;
 for(let y=0;y<h;y++){let l=w,r=-1,n=0;for(let x=0;x<w;x++){if(head&&(x<w*.20||x>w*.80||y<h*.08||y>h*.68))continue;if(data[(y*w+x)*4+3]>128){l=Math.min(l,x);r=x;n++;}}if(n>(head?50:8)){rows[y]={l,r,n};left=Math.min(left,l);right=Math.max(right,r);top=Math.min(top,y);bottom=y;}}
 return {left,right,top,bottom,width:right-left+1,height:bottom-top+1,rows};}
const median=a=>a.sort((a,b)=>a-b)[Math.floor(a.length/2)];
function crownContact(m,b){const w=m.info.width,h=m.info.height,ends=[];
 for(let x=Math.round((b.left+b.right)/2-b.width*.12);x<Math.round((b.left+b.right)/2+b.width*.12);x++){let started=false,gap=0,last=0;for(let y=b.top;y<=b.bottom;y++){const solid=m.data[(y*w+x)*4+3]>128;if(solid){started=true;gap=0;last=y;}else if(started&&++gap>5)break;}if(started)ends.push(last);}
 return median(ends);}
function category(desc){if(/cowboy|top hat|conical/.test(desc))return 'brim';if(/headphones/.test(desc))return 'headphones';if(/helmet/.test(desc))return 'helmet';if(/veil|hood/.test(desc))return 'open';if(/aviator|flight cap/.test(desc))return 'aviator';if(/crown|headband|beaded|cowrie/.test(desc))return 'band';if(/cylindrical|ceremonial cap|fez|embroidered cap|woven.*cap/.test(desc))return 'cylinder';if(/turban|headwrap|head wrap/.test(desc))return 'wrap';if(/bandana/.test(desc))return 'bandana';return 'cap';}
const assets=[];
for(const set of ['american','cultural'])for(const a of JSON.parse(fs.readFileSync(path.join(root,'Headwear-notprocessedyet',set,'manifest.json')))){assets.push({id:set+'-'+a.filename.slice(0,2),set,file:path.join('Headwear-notprocessedyet',set,a.filename),description:a.description,category:category(a.description)});}
for(const file of fs.readdirSync(path.join(root,'headwear-sized')).filter(f=>f.endsWith('.png')).sort())assets.push({id:'supplied-'+path.parse(file).name,set:'supplied',file:path.join('headwear-sized',file),description:path.parse(file).name.replaceAll('_',' '),category:'supplied'});
for(const name of ['Astronaut_Helmet','Beanie','Goggles','Spiky_Hair'])assets.push({id:'original-'+name,set:'original',file:'Assets/Clothing/'+name+'.png',description:name.replaceAll('_',' '),category:'original'});
(async()=>{
 fs.mkdirSync(out,{recursive:true});const heads={};
 for(const name of names){const m=await mask(path.join(expressionDir,name)),b=silhouette(m,true),k=1254/m.info.width;
 let eyeSum=0,eyeCount=0;
 for(let y=Math.round(b.top+b.height*.35);y<Math.round(b.top+b.height*.79);y++)for(let x=Math.round(b.left+b.width*.10);x<Math.round(b.right-b.width*.10);x++){
 const i=(y*m.info.width+x)*4;if(m.data[i+3]>128&&(m.data[i]+m.data[i+1]+m.data[i+2])/3<15){eyeSum+=y;eyeCount++;}}
 const upper=b.rows[Math.round(b.top+b.height*.20)];heads[path.parse(name).name]={left:b.left*k,right:b.right*k,top:b.top*k,bottom:b.bottom*k,width:b.width*k,height:b.height*k,cx:(upper.l+upper.r)/2*k,cy:(b.top+b.bottom)/2*k,eyeY:(eyeCount?eyeSum/eyeCount:b.top+b.height*.60)*k};}
 const reference=heads.Amused;
 const selected=process.env.FIT_ASSETS ? new Set(process.env.FIT_ASSETS.split(',')) : null;
 const previous=selected ? JSON.parse(fs.readFileSync(path.join(out,'manifest.json'))) : null;
 const records=previous ? previous.placements.filter(r=>!selected.has(r.asset)) : [];
 if(previous)for(const a of assets){const old=previous.assets.find(x=>x.id===a.id);if(old){a.sourceBounds=old.sourceBounds;a.contact=old.contact;}}
 for(const a of assets){if(selected&&!selected.has(a.id))continue;const m=await mask(path.join(root,a.file)),b=silhouette(m),contact=crownContact(m,b);a.sourceBounds={left:b.left,top:b.top,width:b.width,height:b.height};a.contact=contact;
 for(const [expression,head] of Object.entries(heads)){
 let sx,sy,sourceX=(b.left+b.right)/2,sourceY=contact,targetX=head.cx,targetY=head.top+head.height*.37;
 if(a.category==='supplied'||a.category==='original'){
  const k=1254/m.info.width;const factor=a.category==='supplied'?(a.id.includes('Pharaoh')?1.05:1.10):1;
  sx=k*factor*head.width/reference.width;sy=k*factor*head.height/reference.height;
  sourceX=m.info.width/2;sourceY=400/k;targetX=head.cx+(627-reference.cx)*head.width/reference.width;targetY=head.top+(400-reference.top)*head.height/reference.height;
  if(a.id==='original-Goggles'){
   sourceX=(b.left+b.right)/2;sourceY=(b.top+b.bottom)/2;
   targetX=(head.left+head.right)/2;targetY=head.eyeY;
   sx=head.width*1.10/b.width;sy=sx*head.height/reference.height*reference.width/head.width;
  }
 }else{
  let sourceSpan=b.width,targetSpan=head.width*1.10;
  if(/backwards/.test(a.description))targetY=head.top+head.height*.28;
  if(a.category==='brim'){sourceSpan=b.width*.62;targetY=head.top+head.height*.33;}
  if(a.category==='bandana'){sourceSpan=b.width*.82;targetY=head.top+head.height*.36;sourceX=(b.right+b.left+b.width*.10)/2;}
  if(a.category==='wrap'){sourceSpan=b.width*.94;targetY=head.top+head.height*.35;}
  if(a.category==='cylinder'){targetY=head.top+head.height*.28;}
  if(a.category==='band'){targetSpan=head.width*1.03;targetY=head.top+head.height*.24;}
  if(['open','aviator','headphones','helmet'].includes(a.category)){
   const sampleY=Math.min(b.bottom,Math.round(contact+b.height*.23));let l=Math.round(sourceX),r=l;
   while(l>b.left&&m.data[(sampleY*m.info.width+l)*4+3]<128)l--;
   while(r<b.right&&m.data[(sampleY*m.info.width+r)*4+3]<128)r++;
   sourceSpan=r-l; if(sourceSpan<b.width*.30)sourceSpan=b.width*.70;
   sourceX=(l+r)/2;targetSpan=head.width*1.01;
   targetY=head.top+head.height*(a.category==='open'?.25:.36);
   if(a.category==='open'){
    let best=sourceSpan;
    for(let y=Math.round(contact);y<=Math.round(b.top+b.height*.85);y++){
     let ll=Math.round((b.left+b.right)/2),rr=ll;
     if(m.data[(y*m.info.width+ll)*4+3]>128)continue;
     while(ll>b.left&&m.data[(y*m.info.width+ll)*4+3]<128)ll--;
     while(rr<b.right&&m.data[(y*m.info.width+rr)*4+3]<128)rr++;
     if(rr-ll<b.width*.90)best=Math.max(best,rr-ll);
    }
    sourceSpan=best;
   }
   if(a.category==='helmet'){sourceSpan=b.width;targetSpan=head.width*(a.description.includes('football')?1.30:1.24);}
   if(a.category==='headphones'){sourceY=b.top;targetY=head.top-15;}
  }
  sx=targetSpan/sourceSpan;sy=sx*(head.height/head.width)/(reference.height/reference.width);
  if(['cap','cylinder','bandana','wrap','brim','aviator'].includes(a.category)){
   sy=Math.max(sy,(targetY-head.top+16)/(contact-b.top));
  }
 }
 let width=Math.round(b.width*sx),height=Math.round(b.height*sy),left=Math.round(targetX-(sourceX-b.left)*sx),top=Math.round(targetY-(sourceY-b.top)*sy);
 // Keep the entire item inside the canvas; never silently crop the artwork.
 const reduction=Math.min(1,1246/width,1246/height);
 if(reduction<1){sx*=reduction;sy*=reduction;width=Math.round(b.width*sx);height=Math.round(b.height*sy);left=Math.round(targetX-(sourceX-b.left)*sx);top=Math.round(targetY-(sourceY-b.top)*sy);}
 left=Math.max(4,Math.min(1250-width,left));top=Math.max(4,Math.min(1250-height,top));
 const input=await sharp(path.join(root,a.file)).extract({left:b.left,top:b.top,width:b.width,height:b.height}).resize(width,height).png().toBuffer();
 const folder=path.join(out,expression,a.set);fs.mkdirSync(folder,{recursive:true});const file=path.join(folder,a.id+'.png');
 await sharp({create:{width:1254,height:1254,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input,left,top}]).png().toFile(file);
 records.push({asset:a.id,expression,file:path.relative(out,file),scaleX:sx,scaleY:sy,left,top,width,height});
 }
 console.log('Fitted',a.id);
 }
 fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({canvas:1254,heads,assets,placements:records},null,2)+'\n');
 // One sheet per expression, all 96 assets in the same order.
 const sheetDir=path.join(out,'sheets');fs.mkdirSync(sheetDir,{recursive:true});
 for(const name of names){const expression=path.parse(name).name,head=await sharp(path.join(expressionDir,name)).resize(240,240).png().toBuffer(),tiles=[];
 for(let i=0;i<assets.length;i++){const a=assets[i],r=records.find(r=>r.expression===expression&&r.asset===a.id);const hat=await sharp(path.join(out,r.file)).resize(240,240).png().toBuffer();const label=Buffer.from(`<svg width="240" height="265"><text x="6" y="258" font-size="12" fill="white">${a.id}</text></svg>`);const input=await sharp({create:{width:240,height:265,channels:3,background:'#777'}}).composite([{input:head,top:0,left:0},{input:hat,top:0,left:0},{input:label}]).png().toBuffer();tiles.push({input,left:i%8*240,top:Math.floor(i/8)*265});}
 await sharp({create:{width:1920,height:Math.ceil(assets.length/8)*265,channels:3,background:'#777'}}).composite(tiles).jpeg({quality:92}).toFile(path.join(sheetDir,expression+'.jpg'));console.log('Sheet',expression);
 }
})().catch(e=>{console.error(e);process.exitCode=1});

#!/usr/bin/env node
// Reproducible scale/translation only. Original source pixels remain archived.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('sharp');
const ROOT = path.resolve(__dirname, '..');
const SOURCE = 'Headwear-notprocessedyet';
const DEST = 'Assets/Headwear';
const SIZE = 1254;
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const median = values => values.sort((a,b) => a-b)[Math.floor(values.length/2)];
async function inspect(file) {
  const {data,info} = await sharp(path.join(ROOT,file)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const solid = (x,y) => x>=0 && y>=0 && x<info.width && y<info.height && data[(y*info.width+x)*4+3]>32;
  let left=info.width,top=info.height,right=-1,bottom=-1;
  for(let y=0;y<info.height;y++) for(let x=0;x<info.width;x++) if(solid(x,y)) {
    left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
  }
  if(right<0) throw new Error('Empty asset: '+file);
  const width=right-left+1,height=bottom-top+1,cx=(left+right)/2,ends=[];
  for(let x=Math.round(cx-width*.12);x<=Math.round(cx+width*.12);x++) {
    let started=false,gap=0,last=top;
    for(let y=top;y<=bottom;y++) {if(solid(x,y)){started=true;gap=0;last=y;}else if(started&&++gap>5)break;}
    if(started)ends.push(last);
  }
  const contact=median(ends),spans=[];
  for(let y=Math.round(top+(contact-top)*.45);y<=Math.round(top+(contact-top)*.7);y++) {
    let l=Math.round(cx),r=l;if(!solid(l,y))continue;
    while(l>left&&solid(l-1,y))l--;while(r<right&&solid(r+1,y))r++;
    spans.push({width:r-l+1,cx:(l+r)/2});
  }
  const crown=spans.length ? {width:median(spans.map(r=>r.width)),cx:median(spans.map(r=>r.cx))} : {width,cx};
  const openings=[];
  for(let y=Math.round(top+height*.2);y<Math.round(top+height*.9);y++) {
    let l=Math.round(cx),r=l;if(solid(l,y))continue;
    while(l>left&&!solid(l,y))l--;while(r<right&&!solid(r,y))r++;
    if(solid(l,y)&&solid(r,y)&&r-l>width*.3&&r-l<width*.9)openings.push({width:r-l,cx:(l+r)/2,y});
  }
  openings.sort((a,b)=>b.width-a.width);
  return {left,top,right,bottom,width,height,cx,contact,crown,opening:openings[Math.min(12,openings.length-1)]||{width:width*.72,cx,y:contact},info};
}
function profile(description) {
  const d=description.toLowerCase();
  if(/headphones/.test(d))return {ref:17,kind:'headphones'};
  if(/helmet/.test(d))return {ref:21,kind:'helmet'};
  if(/aviator|flight cap/.test(d))return {ref:17,kind:'aviator'};
  if(/veil|hood/.test(d))return {ref:12,kind:'hood'};
  if(/backwards/.test(d))return {ref:26,kind:'backwards'};
  if(/top hat/.test(d))return {ref:14,kind:'brim'};
  if(/cowboy|cavalry|conical/.test(d))return {ref:15,kind:'brim'};
  if(/bucket/.test(d))return {ref:13,kind:'brim'};
  if(/bandana/.test(d))return {ref:9,kind:'bandana'};
  if(/beanie|knit|skullcap/.test(d))return {ref:26,kind:'cap'};
  if(/open black and gold royal crown|ornate red and gold pointed royal crown/.test(d))return {ref:19,kind:'crown'};
  if(/crown|headband|beaded|cowrie/.test(d))return {ref:7,kind:'band'};
  if(/cylindrical|ceremonial cap|fez|embroidered cap|woven.*cap/.test(d))return {ref:8,kind:'cap'};
  if(/turban|headwrap|head wrap/.test(d))return {ref:6,kind:'wrap'};
  return {ref:26,kind:'cap'};
}
async function writePng(file,buffer) {
  await sharp(buffer).raw().toBuffer();
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file+'.tmp',buffer);fs.renameSync(file+'.tmp',file);
}
async function main() {
  const refs=new Map(),assets=[],held=[];
  const manifestFile=path.join(ROOT,DEST,'alignment-manifest.json');
  const reviewedOriginals=fs.existsSync(manifestFile)?JSON.parse(fs.readFileSync(manifestFile)).assets.filter(a=>a.id.startsWith('reviewed-original-')):[];
  const corrections=JSON.parse(fs.readFileSync(path.join(ROOT,'scripts/headwear-fit-overrides.json'),'utf8'));
  for(const set of ['american','cultural']) for(const a of JSON.parse(fs.readFileSync(path.join(ROOT,SOURCE,set,'manifest.json')))) {
    const id=set+'-'+a.filename.slice(0,2),source=path.posix.join(SOURCE,set,a.filename),file=path.posix.join(DEST,set+'-'+a.filename);
    const {ref,kind}=profile(a.description),reference=path.posix.join(DEST,`art-by-mattrick (${ref}).png`);
    if(!refs.has(reference))refs.set(reference,await inspect(reference));
    const r=refs.get(reference),b=await inspect(source),override=corrections[id]||{};
    let scale=r.width/b.width,sourceX=b.cx,sourceY=b.contact,targetX=r.cx,targetY=r.contact;
    if(kind==='hood'||kind==='aviator'){scale=r.opening.width/b.opening.width;sourceX=b.opening.cx;targetX=r.opening.cx;}
    if(kind==='bandana'){scale=r.crown.width/b.crown.width;sourceX=b.crown.cx;targetX=r.crown.cx;}
    if(kind==='helmet'){sourceY=b.top;targetY=r.top;}
    if(kind==='headphones'){scale=1.20;sourceX=b.cx;targetX=r.cx;sourceY=b.top;targetY=8;}
    if(kind==='crown')targetX=632;
    if(kind==='hood'){const fittedTop=targetY-(sourceY-b.top)*scale;targetY-=Math.max(0,fittedTop-(r.top-24));}
    // Reviewed, per-trait landmarks take precedence over automatic initialization.
    if(override.width)scale=override.width/b.width;
    if(override.scaleMultiplier)scale*=override.scaleMultiplier;
    if(override.sourceX!==undefined)sourceX=override.sourceX;
    if(override.sourceY!==undefined)sourceY=override.sourceY;
    if(override.targetX!==undefined)targetX=override.targetX;
    if(override.targetY!==undefined)targetY=override.targetY;
    if(override.dx)targetX+=override.dx;
    if(override.dy)targetY+=override.dy;
    const crop={left:Math.max(0,b.left-3),top:Math.max(0,b.top-3)};
    crop.width=Math.min(b.info.width,b.right+4)-crop.left;crop.height=Math.min(b.info.height,b.bottom+4)-crop.top;
    if(override.top!==undefined)targetY=override.top+(sourceY-crop.top)*scale;
    const maxScale=Math.min((targetX-3)/Math.max(1,sourceX-crop.left),(SIZE-3-targetX)/Math.max(1,crop.left+crop.width-sourceX),(targetY-3)/Math.max(1,sourceY-crop.top),(SIZE-3-targetY)/Math.max(1,crop.top+crop.height-sourceY));
    scale=Math.min(scale,maxScale);
    const width=Math.max(1,Math.round(crop.width*scale)),height=Math.max(1,Math.round(crop.height*scale));
    const left=Math.round(targetX-(sourceX-crop.left)*scale),top=Math.round(targetY-(sourceY-crop.top)*scale);
    const input=await sharp(path.join(ROOT,source)).extract(crop).resize(width,height,{kernel:'lanczos3'}).png().toBuffer();
    const output=await sharp({create:{width:SIZE,height:SIZE,channels:4,background:'#0000'}}).composite([{input,left,top}]).png().toBuffer();
    const record={id,description:a.description,source,sourceSha256:hash(fs.readFileSync(path.join(ROOT,source))),file,sha256:hash(output),reference,kind,sourceAnchor:[sourceX,sourceY],targetAnchor:[targetX,targetY],sourceCrop:crop,scale,placement:{left,top,width,height},review:override.reason||'Canonical fit checked against the same-category visual reference.'};
    if(override.hold){held.push({id,description:a.description,source,sourceSha256:record.sourceSha256,reference,kind,reason:override.reason});if(fs.existsSync(path.join(ROOT,file)))fs.unlinkSync(path.join(ROOT,file));}
    else {await writePng(path.join(ROOT,file),output);assets.push(record);}
  }
  assets.push(...reviewedOriginals);
  const references=[...refs].map(([file,r])=>({file,sha256:hash(fs.readFileSync(path.join(ROOT,file))),silhouette:{left:r.left,top:r.top,width:r.width,height:r.height},crownContact:r.contact,opening:r.opening}));
  const heads={};
  for(const name of fs.readdirSync(path.join(ROOT,'Assets/Expression_Colors/Platinum')).filter(f=>f.endsWith('.png')).sort()) {
    const {data,info}=await sharp(path.join(ROOT,'Assets/Expression_Colors/Platinum',name)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    let left=info.width,right=0,top=info.height,bottom=0;const rows=[];
    for(let y=Math.ceil(info.height*.08);y<=Math.floor(info.height*.68);y++) {
      let l=info.width,r=-1,n=0;
      for(let x=Math.ceil(info.width*.20);x<=Math.floor(info.width*.80);x++)if(data[(y*info.width+x)*4+3]>128){l=Math.min(l,x);r=x;n++;}
      if(n>50){rows[y]={l,r};left=Math.min(left,l);right=Math.max(right,r);top=Math.min(top,y);bottom=y;}
    }
    const k=SIZE/info.width,height=bottom-top+1,upper=rows[Math.round(top+height*.2)];
    heads[path.parse(name).name]={width:(right-left+1)*k,cx:(upper.l+upper.r)*.5*k,anchorY:(top+height*.35)*k};
  }
  const baseline=heads.Amused,expressionFits=Object.fromEntries(Object.entries(heads).map(([name,h])=>{const scale=h.width/baseline.width;return [name,{scale,dx:h.cx-baseline.cx*scale,dy:h.anchorY-baseline.anchorY*scale}];}));
  fs.writeFileSync(path.join(ROOT,DEST,'alignment-manifest.json'),JSON.stringify({canvas:{width:SIZE,height:SIZE,format:'RGBA PNG'},method:'Uniform scale and translation from visual references in Assets/Headwear; original art preserved.',sourceFolder:SOURCE,referenceExpression:'Amused',expressionFits,references,assets,held},null,2)+'\n');
  console.log(`Aligned ${assets.length}; held for rework ${held.length}.`);
}
module.exports={inspect,profile,writePng};
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});

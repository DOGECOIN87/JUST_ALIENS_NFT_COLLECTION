#!/usr/bin/env node
// Render supplied, positioned headwear without changing the source PNGs.
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'headwear-sized-preview');
const hats = ['Football_Helmet','Navy_Baseball_Cap','Red_Star_Bandana','Navy_White_Trucker_Cap','Pharaoh_Headdress'];
const skins = ['Platinum','Lime','Sky_Blue','Coral_Red','Violet','Honey_Gold','Graphite','Forest_Green','Hot_Pink','Cyan'];
const moods = ['Happy','Curious','Amused','Chill','Surprised'];
const scenes = ['Celestial.png','Cockpit_Blue.png','Cockpit_Green.png','Cavern_of_Light.png','Cockpit_Pink.png'];
(async () => {
 fs.mkdirSync(out,{recursive:true});
 const tiles = [], manifest = [];
 for(let s=0;s<skins.length;s++) for(let h=0;h<hats.length;h++) {
  const id = s*5+h+1;
  const bg = await sharp(path.join(root,'Assets/Background',scenes[(s+h)%5])).resize(1254,1254).png().toBuffer();
  const head = await sharp(path.join(root,'Assets/Expression_Colors',skins[s],moods[(s+h)%5]+'.png')).resize(1254,1254).png().toBuffer();
  const scale = h === 4 ? 1.05 : 1.10;
  const enlarged = Math.round(1254 * scale);
  const cropX = Math.round((enlarged - 1254) / 2);
  const cropY = Math.round(400 * (scale - 1));
  const hat = await sharp(path.join(root,'headwear-sized',hats[h]+'.png'))
    .resize(enlarged, enlarged).extract({left:cropX,top:cropY,width:1254,height:1254}).png().toBuffer();
  const file = String(id).padStart(2,'0')+'.png';
  await sharp(bg).composite([{input:head},{input:hat}]).png().toFile(path.join(out,file));
  const input = await sharp(path.join(out,file)).resize(300,300).png().toBuffer();
  tiles.push({input,left:(id-1)%10*300,top:Math.floor((id-1)/10)*300});
  manifest.push({id,file,headwear:hats[h],headwearScale:scale,skin:skins[s],expression:moods[(s+h)%5],background:scenes[(s+h)%5]});
 }
 await sharp({create:{width:3000,height:1500,channels:3,background:'#000'}}).composite(tiles).jpeg({quality:94}).toFile(path.join(out,'sheet-50.jpg'));
 fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 console.log('Rendered 50 aliens and sheet-50.jpg');
})().catch(e=>{console.error(e);process.exitCode=1});

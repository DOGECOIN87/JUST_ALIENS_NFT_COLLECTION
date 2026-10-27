'use strict';
// Usage: node tools/render-trait.cjs PROJECT_DIRECTORY INSPECTION_JSON OUTPUT.webp
const fs=require('fs'),path=require('path'),sharp=require('sharp'),assert=require('assert/strict');
async function main(){
 const [projectArg,recipeArg,outputArg]=process.argv.slice(2);
 if(!projectArg||!recipeArg||!outputArg)throw Error('Usage: node tools/render-trait.cjs PROJECT_DIRECTORY INSPECTION_JSON OUTPUT.webp');
 const kit=path.resolve(__dirname,'..'),project=path.resolve(projectArg),out=path.resolve(outputArg);
 const manifest=JSON.parse(fs.readFileSync(path.join(kit,'trait-manifest.json'))),meta=JSON.parse(fs.readFileSync(path.resolve(recipeArg)));
 const spec=JSON.parse(fs.readFileSync(path.join(project,'collection-spec.json'))),recipes=JSON.parse(fs.readFileSync(path.join(project,'curated-recipes.json'))).recipes;
 const attrs=Object.fromEntries(meta.attributes.map(t=>[t.trait_type,t.value]));
 const key=(group,value)=>{const v=spec.traits[group].find(t=>t.name===value);assert(v,'Unknown '+group+': '+value);return v.key;};
 const skin=key('Skin',attrs.Skin),expression=key('Expression',attrs.Expression),outfit=key('Outfit',attrs.Outfit);
 const background=recipes.find(r=>r.traits.Background===attrs.Background)?.background;assert(background,'Unknown background');
 const trait=manifest.traits.find(t=>t.id===meta.headwear_design_id);assert(trait&&trait.value===attrs.Headwear,'Unknown headwear');
 const placement=trait.expressions[expression];assert(placement,'Missing expression placement');
 const [w,h]=manifest.canvas,[x,y]=manifest.character_offset;
 const bg=await sharp(path.join(project,'inputs/backgrounds',background)).resize(w,h,{fit:'cover'}).png().toBuffer();
 const layers=[{input:path.join(project,'repaired_sources/Assets/Clothing',outfit+'.png'),left:x,top:y}];
 if(trait.back_layer)layers.push({input:path.join(kit,trait.back_layer),left:placement.translate_x,top:placement.translate_y});
 layers.push({input:path.join(project,'repaired_sources/Assets/Expression_Colors',skin,expression+'.png'),left:x,top:y},{input:path.join(kit,trait.front_layer),left:placement.translate_x,top:placement.translate_y});
 const image=sharp(bg).composite(layers);
 fs.mkdirSync(path.dirname(out),{recursive:true});
 if(path.extname(out).toLowerCase()==='.png')await image.png().toFile(out);else await image.webp({lossless:true,effort:2}).toFile(out);
 console.log(JSON.stringify({output:out,headwear:trait.value,expression,dimensions:[w,h]}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});

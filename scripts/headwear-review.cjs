'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),review=require('./headwear-review.json');
const relative=file=>path.relative(root,path.resolve(root,file)).split(path.sep).join('/');
function excludedFile(file){const p=relative(file);return review.removed_source_files.includes(p)||review.held_source_files.includes(p)||review.removed_fitted_asset_ids.some(id=>p.endsWith('/'+id+'.png'));}
function excludedAsset(asset){return review.removed_fitted_asset_ids.includes(asset.id)||excludedFile(asset.file);}
function helmetFile(expression){const file=review.helmet_files[expression];if(!file||!fs.existsSync(path.join(root,file)))throw Error('Missing reviewed helmet fit: '+expression);return path.join(root,file);}
function expressionOverride(file,expression){const item=review.expression_overrides[relative(file)]?.[expression];if(!item)return null;const resolved=path.join(root,item.file);if(!fs.existsSync(resolved))throw Error('Missing reviewed headwear fit: '+item.file);return resolved;}
module.exports={review,excludedFile,excludedAsset,helmetFile,expressionOverride};

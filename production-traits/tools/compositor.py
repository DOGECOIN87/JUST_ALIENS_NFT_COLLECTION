#!/usr/bin/env python3
"""Canonical Just Aliens compositor: exported full-size PNG layers only."""
import json,sys,argparse,hashlib
from pathlib import Path
from functools import lru_cache
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]

def config():return json.loads((ROOT/'render-config.json').read_text())
def manifest():return json.loads((ROOT/'trait-manifest.json').read_text())
@lru_cache(maxsize=160)
def layer(rel):
 p=(ROOT/rel).resolve()
 if not p.is_relative_to(ROOT):raise ValueError('Path escapes production kit')
 im=Image.open(p).convert('RGBA')
 if im.size!=(1254,1254):raise ValueError('Unregistered layer: '+rel)
 return im

def render(recipe,review=False,background_override=None):
 c=config();m=manifest();t=next((t for t in m['traits'] if t['id']==recipe['headwear_id']),None)
 if t is None:raise ValueError('Unknown headwear')
 if not review and t['status']!='production_ready':raise ValueError('Headwear is not released: '+t['value'])
 ex=recipe['expression']
 if ex not in t['variants']:raise ValueError('Unsupported expression')
 if background_override is not None:
  if isinstance(background_override,Image.Image):base=background_override.convert('RGBA')
  else:base=Image.new('RGBA',(1254,1254),background_override)
 else:
  bg=c['backgrounds'].get(recipe['background'])
  if not bg:raise ValueError('Unknown or excluded background')
  if bg['file'] in c['excluded_background_files']:raise ValueError('Excluded background')
  base=layer(bg['file']).copy()
 outfit=c['outfits'].get(recipe['outfit']);skin=c['skins'].get(recipe['skin'])
 if not outfit or not skin:raise ValueError('Unapproved skin/outfit')
 v=t['variants'][ex]
 for rel in [v['rear'],outfit['file'],f"Assets/Expressions/{recipe['skin']}/{ex}.png",v['front']]:base.alpha_composite(layer(rel))
 return base

def metadata(recipe,image_uri):
 c=config();m=manifest();t=next(t for t in m['traits'] if t['id']==recipe['headwear_id'])
 attrs={'Background':c['backgrounds'][recipe['background']]['name'],'Skin':c['skins'][recipe['skin']]['name'],'Expression':recipe['expression'],'Outfit':c['outfits'][recipe['outfit']]['name'],'Headwear':t['value'],'Caption':'None'}
 return {'name':f"Just Aliens - Inspection {recipe.get('id',0):02d}",'symbol':'JSTA','description':c['description'],'image':image_uri,'edition':recipe.get('id'),'headwear_design_id':t['id'],'attributes':[{'trait_type':k,'value':v} for k,v in attrs.items()],'properties':{'category':'image','files':[{'uri':image_uri,'type':'image/png'}]},'render':{'revision':m['revision'],'canvas':[1254,1254],'recipe':recipe,'front_sha256':t['variants'][recipe['expression']]['front_sha256'],'rear_sha256':t['variants'][recipe['expression']]['rear_sha256']}}

def main():
 ap=argparse.ArgumentParser();ap.add_argument('recipe');ap.add_argument('output');ap.add_argument('--review',action='store_true');args=ap.parse_args();r=json.loads(Path(args.recipe).read_text());r=r.get('render',{}).get('recipe',r)
 from build_layers import save_png
 im=render(r,review=args.review);p=Path(args.output);p.parent.mkdir(parents=True,exist_ok=True);save_png(im,p);print(str(p))
if __name__=='__main__':main()

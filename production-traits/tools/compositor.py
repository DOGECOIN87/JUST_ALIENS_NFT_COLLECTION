"""Canonical compositor. Registered assets and explicit head allowlist only."""
from pathlib import Path
from functools import lru_cache
import json, hashlib, argparse,os
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
def read(name):return json.loads((ROOT/name).read_text())
@lru_cache(maxsize=1)
def config():return read('render-config.json')
@lru_cache(maxsize=1)
def manifest():return read('trait-manifest.json')
@lru_cache(maxsize=1)
def policy():return read('selection-policy.json')
@lru_cache(maxsize=128)
def layer(rel):
 p=(ROOT/rel).resolve()
 if not p.is_relative_to(ROOT):raise ValueError('Path outside kit')
 im=Image.open(p).convert('RGBA')
 if im.size!=(1254,1254):raise ValueError('Unregistered layer '+rel)
 return im
def validate(recipe):
 fits=[f for f in policy()['approved_fits'] if all(f[k]==recipe.get(k) for k in ('headwear_id','skin','expression','approval_sample'))]
 if len(fits)!=1:raise ValueError('Head fit not explicitly approved')
 fit=fits[0]
 if recipe.get('outfit') not in fit['allowed_outfits']:raise ValueError('Outfit outside curated fit rules')
 c=config()
 if recipe.get('background') not in c['backgrounds']:raise ValueError('Background not approved')
 if recipe.get('text','None') not in ['None',*c['captions']]:raise ValueError('Unknown text')
 return fit
def character(recipe):
 validate(recipe);c=config();t=next(t for t in manifest()['traits'] if t['id']==recipe['headwear_id']);v=t['variants'][recipe['expression']]
 base=Image.new('RGBA',(1254,1254))
 for rel in [v['rear'],c['outfits'][recipe['outfit']]['file'],f"Assets/Expressions/{recipe['skin']}/{recipe['expression']}.png",v['front']]:base.alpha_composite(layer(rel))
 return base
def render(recipe):
 validate(recipe);c=config();base=layer(c['backgrounds'][recipe['background']]['file']).copy();base.alpha_composite(character(recipe))
 if recipe.get('text','None')!='None':base.alpha_composite(layer(c['captions'][recipe['text']]['file']))
 return base
def metadata(recipe):
 c=config();t=next(t for t in manifest()['traits'] if t['id']==recipe['headwear_id']);v=t['variants'][recipe['expression']];idx=recipe['id'];uri=f'{idx:03d}.png'
 a={'Background':c['backgrounds'][recipe['background']]['name'],'Skin':c['skins'][recipe['skin']]['name'],'Expression':recipe['expression'],'Outfit':c['outfits'][recipe['outfit']]['name'],'Headwear':t['value'],'Text':c['captions'][recipe['text']]['name'] if recipe['text']!='None' else 'None'}
 return {'name':f'Just Aliens #{idx:03d}','symbol':'JSTA','description':c['description'],'image':uri,'edition':idx,'attributes':[{'trait_type':k,'value':v} for k,v in a.items()],'properties':{'category':'image','files':[{'uri':uri,'type':'image/png'}]},'render':{'revision':manifest()['revision'],'canvas':[1254,1254],'approved_v3_sample':recipe['approval_sample'],'recipe':recipe,'front_sha256':v['front_sha256'],'rear_sha256':v['rear_sha256']}}
def save(image,path):
 path=Path(path);path.parent.mkdir(parents=True,exist_ok=True);tmp=path.with_suffix('.tmp')
 with tmp.open('wb') as f:
  image.save(f,format='PNG',compress_level=6);f.flush();os.fsync(f.fileno())
 with Image.open(tmp) as check:check.verify()
 tmp.replace(path)
if __name__=='__main__':
 ap=argparse.ArgumentParser();ap.add_argument('recipe');ap.add_argument('output');args=ap.parse_args();r=json.loads(Path(args.recipe).read_text());r=r.get('render',{}).get('recipe',r);save(render(r),args.output)

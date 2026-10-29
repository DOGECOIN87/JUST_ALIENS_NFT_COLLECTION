"""Deterministic palette curation; never changes approved source artwork."""
import json, hashlib, random, colorsys
from collections import Counter
from pathlib import Path
import numpy as np
from scipy.ndimage import binary_dilation, binary_erosion, gaussian_filter
from PIL import Image,ImageDraw,ImageFont
from compositor import ROOT,config,manifest,policy,layer,character,render,metadata,save
SIZE=250
def lum(rgb):
 s=np.asarray(rgb,dtype=np.float64)/255;s=np.where(s<=.04045,s/12.92,((s+.055)/1.055)**2.4)
 return s@np.array([.2126,.7152,.0722])
def oklab(rgb):
 x=np.asarray(rgb,dtype=np.float64)/255;x=np.where(x<=.04045,x/12.92,((x+.055)/1.055)**2.4)
 lms=x@np.array([[.4122214708,.2119034982,.0883024619],[.5363325363,.6806995451,.2817188376],[.0514459929,.1073969566,.6299787005]])
 return np.cbrt(lms)@np.array([[.2104542553,1.9779984951,.0259040371],[.7936177850,-2.4285922050,.7827717662],[-.0040720468,.4505937099,-.8086757660]])
def thumb(im):return np.asarray(im.resize((SIZE,SIZE),Image.Resampling.LANCZOS))
def main():
 c=config();p=policy();rng=random.Random(c['seed']);bgs={k:thumb(layer(v['file'])) for k,v in c['backgrounds'].items()}
 bg_lab={k:oklab(v[:,:,:3]) for k,v in bgs.items()};bg_lum={k:lum(v[:,:,:3]) for k,v in bgs.items()}
 all_candidates={};details={}
 for f in p['approved_fits']:
  candidates=[]
  for outfit in f['allowed_outfits']:
   r={k:f[k] for k in ['headwear_id','skin','expression','approval_sample']};r.update(outfit=outfit,background=f['background'],text='None')
   fg=thumb(character(r));mask=fg[:,:,3]>210;edge=mask&~binary_erosion(mask,iterations=2)
   # Head boundary matters more than the cropped lower garment edge.
   yy=np.indices(mask.shape)[0];edge&=(yy>12)&(yy<220);head=edge&(yy<155)
   fg_lab=oklab(fg[:,:,:3]);fg_l=lum(fg[:,:,:3])
   for bg in bgs:
    delta=np.linalg.norm(fg_lab-bg_lab[bg],axis=2);lr=(np.maximum(fg_l,bg_lum[bg])+.05)/(np.minimum(fg_l,bg_lum[bg])+.05)
    h=float(np.mean(delta[head]));e=float(np.mean(delta[edge]));clear=float(np.mean((delta[head]>.12)|(lr[head]>1.6)))
    score=3.7*h+1.7*e+.65*clear
    # Palette intent: repeat one cool/warm material accent, keep faces dominant.
    if bg=='StormCockpit' and (f['skin']=='Cyan' or outfit=='Tech_Jacket'):score+=.16
    if bg in ['SunsetCockpit','Corridor'] and (f['headwear_id'] in [7,8,13,22] or f['skin'] in ['Cyan','Violet']):score+=.12
    if f['skin']=='Graphite' and bg in ['Pyramids','Forest']:score-=.20
    if outfit=='Hoodie_White' and bg in ['Wormhole','Spiral','Cavern']:score+=.05
    if bg in ['Witness','Broadcaster','Analyst','Disclosure','LiveSignal','Whiteboard','Headset','Hearing']:score-=.025
    rr={**r,'background':bg};candidates.append({'recipe':rr,'score':round(score,6),'head_separation':round(h,5),'outline_clear_fraction':round(clear,5)})
  all_candidates[f['approval_sample']]=candidates
 # Diversity is an explicit part of curation, not random retries or text-only duplicates.
 selected=[];outfit_counts=Counter();bg_counts=Counter();combo_counts=Counter()
 for turn in range(max(f['target_count'] for f in p['approved_fits'])):
  fits=p['approved_fits'][:];rng.shuffle(fits)
  for f in fits:
   if turn>=f['target_count']:continue
   sample=f['approval_sample'];pool=all_candidates[sample];local=[x for x in selected if x['recipe']['approval_sample']==sample]
   oc=Counter(x['recipe']['outfit'] for x in local);bc=Counter(x['recipe']['background'] for x in local)
   def rank(x):
    r=x['recipe'];return x['score']-.052*oc[r['outfit']]-.055*bc[r['background']]-.009*outfit_counts[r['outfit']]-.009*bg_counts[r['background']]-.035*combo_counts[(r['outfit'],r['background'])]
   best=max(pool,key=rank);pool.remove(best);selected.append(best);r=best['recipe'];outfit_counts[r['outfit']]+=1;bg_counts[r['background']]+=1;combo_counts[(r['outfit'],r['background'])]+=1
 # Alternate uncaptioned and captioned per fit; assign any single odd remainder deterministically.
 captioned=[];uncaptioned=[]
 for f in p['approved_fits']:
  ss=[x for x in selected if x['recipe']['approval_sample']==f['approval_sample']]
  rng.shuffle(ss);n=len(ss)//2;captioned+=ss[:n];uncaptioned+=ss[n:]
 while len(captioned)<210:captioned.append(uncaptioned.pop())
 assert len(captioned)==210
 colors=Counter();text_rules={
 'Platinum':['Cyan','Lime','Vermilion','Magenta','Sky_Blue'],
 'Graphite':['Cyan','Vermilion','Lime','Sky_Blue','Magenta'],
 'Lime':['Lime','Cyan','Vermilion','Sky_Blue','Magenta'],
 'Cyan':['Cyan','Sky_Blue','Red','Vermilion','Magenta'],
 'Forest_Green':['Lime','Cyan','Vermilion','Sky_Blue'],
 'Coral_Red':['Red','Vermilion','Cyan','Magenta','Sky_Blue'],
 'Violet':['Magenta','Cyan','Vermilion','Sky_Blue','Lime']}
 for x in captioned:
  r=x['recipe'];preferred=text_rules[r['skin']][:]
  if r['headwear_id'] in [3,21]:preferred=['Red','Cyan','Vermilion','Sky_Blue']
  elif r['outfit']=='Tech_Jacket':preferred=['Cyan','Sky_Blue',*preferred]
  elif r['outfit'] in ['Safari_Jacket','Winter_Jacket'] or r['background'] in ['SunsetCockpit','Corridor']:preferred=['Vermilion',*preferred]
  elif r['outfit'] in ['Military_Jacket','Camo_Jacket'] and r['skin'] in ['Lime','Forest_Green','Graphite']:preferred=['Lime',*preferred]
  if r['outfit'] in ['Hoodie_White','Spacesuit']:preferred=['Red','Vermilion'] if r['skin'] in ['Cyan','Coral_Red'] or r['headwear_id']==21 else ['Vermilion','Red']
  preferred=list(dict.fromkeys(preferred));r['text']=max(preferred,key=lambda k:1-.10*preferred.index(k)-.018*colors[k]);colors[r['text']]+=1
 # Spread the 13 designs across mint order; deterministic shuffle.
 rng.shuffle(selected)
 for i,x in enumerate(selected,1):x['recipe']['id']=i
 recipes=[x['recipe'] for x in selected]
 assert len({tuple(r[k] for k in ['headwear_id','skin','expression','outfit','background']) for r in recipes})==420
 (ROOT/'recipes.json').write_text(json.dumps(recipes,indent=2)+'\n')
 (ROOT/'curation-metrics.json').write_text(json.dumps({'description':'Color/separation scores guide selection; these are not a claim of aesthetic objectivity. Final contact sheets require visual inspection.','selected':selected,'counts':{'outfits':dict(outfit_counts),'backgrounds':dict(bg_counts),'text':dict(colors)}},indent=2)+'\n')
 print('Selected 420 unique base compositions; text',dict(colors),flush=True)
 # Immediate proof: three genuinely selected exports for every approved source fit.
 preview=[]
 for f in p['approved_fits']:
  ss=[r for r in recipes if r['approval_sample']==f['approval_sample']]
  yes=[r for r in ss if r['text']!='None'];no=[r for r in ss if r['text']=='None']
  preview.extend([no[0],yes[0],yes[-1]])
 proof=ROOT/'proofs';proof.mkdir(exist_ok=True)
 tile=320;label=54;cols=9;rows=6;top=78
 sheet=Image.new('RGB',(cols*tile,top+rows*(tile+label)+34),'#142130');d=ImageDraw.Draw(sheet)
 font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';fnt=ImageFont.truetype(font,16);title=ImageFont.truetype(font,27)
 d.text((16,10),'JUST ALIENS — CURATED 420 / FIRST 54',font=title,fill='white')
 d.text((16,47),'18 approved head fits × 3 selected styles • tile labels reference your unmarked V3 samples',font=fnt,fill='#b9cbd8')
 for i,r in enumerate(preview):
  im=render(r);save(im,ROOT/'images'/f"{r['id']:03d}.png");(ROOT/'json').mkdir(exist_ok=True);(ROOT/'json'/f"{r['id']:03d}.json").write_text(json.dumps(metadata(r),indent=2)+'\n')
  x=i%cols*tile;y=top+i//cols*(tile+label);sheet.paste(im.resize((tile,tile),Image.Resampling.LANCZOS).convert('RGB'),(x,y))
  t=next(t for t in manifest()['traits'] if t['id']==r['headwear_id'])
  d.text((x+7,y+tile+4),f"#{r['id']:03d}  {t['value']}  · V3 {r['approval_sample']:02d}",font=fnt,fill='white')
  tx='No text' if r['text']=='None' else c['captions'][r['text']]['name']
  d.text((x+7,y+tile+27),f"{r['expression']} / {c['skins'][r['skin']]['name']} · {tx}",font=fnt,fill='#a8c2d2')
 d.text((16,sheet.height-27),'Actual registered production layers • no slashed head fits • approved head artwork retained',font=fnt,fill='#b9cbd8')
 path=proof/'Just_Aliens_Curated_54.png';sheet.save(path,compress_level=6)
 (proof/'preview-recipes.json').write_text(json.dumps(preview,indent=2)+'\n')
 print(path,flush=True)
if __name__=='__main__':main()

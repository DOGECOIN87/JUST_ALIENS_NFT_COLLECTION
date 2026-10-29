"""Export the fixed, curated plan. No random trait substitutions."""
import json,argparse,hashlib,csv
from collections import Counter
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import numpy as np
from concurrent.futures import ThreadPoolExecutor,as_completed
from compositor import ROOT,config,manifest,policy,validate,layer,character,render,metadata,save
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--proofs-only',action='store_true');args=ap.parse_args()
 recipes=json.loads((ROOT/'recipes.json').read_text());c=config();proof=ROOT/'proofs';proof.mkdir(exist_ok=True)
 if not args.proofs_only:
  def export_one(r):
   validate(r);dst=ROOT/'images'/f"{r['id']:03d}.png"
   meta=ROOT/'json'/f"{r['id']:03d}.json"
   valid=False
   if dst.exists() and meta.exists():
    try:
     with Image.open(dst) as check:check.verify()
     valid=json.loads(meta.read_text())==metadata(r)
    except (OSError,SyntaxError,ValueError):pass
   if not valid:save(render(r),dst)
   meta.parent.mkdir(exist_ok=True);meta.write_text(json.dumps(metadata(r),indent=2)+'\n')
  with ThreadPoolExecutor(max_workers=4) as pool:
   for i,future in enumerate(as_completed([pool.submit(export_one,r) for r in recipes]),1):
    future.result()
    if i%30==0:print(f'Exported {i}/420',flush=True)
 font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';fnt=ImageFont.truetype(font,15);title=ImageFont.truetype(font,25)
 names={t['id']:t['value'] for t in manifest()['traits']}
 for page in range(14):
  rr=recipes[page*30:(page+1)*30];tile=320;lab=58;cols=6;top=75
  im=Image.new('RGB',(cols*tile,top+5*(tile+lab)+30),'#142130');d=ImageDraw.Draw(im)
  d.text((14,9),f'JUST ALIENS — CURATED 420 / {page+1:02d} OF 14',font=title,fill='white')
  d.text((14,44),f"Tokens {rr[0]['id']:03d}–{rr[-1]['id']:03d} • exact approved head fits • actual full-size PNG exports",font=fnt,fill='#b9cbd8')
  for i,r in enumerate(rr):
   x=i%cols*tile;y=top+i//cols*(tile+lab)
   art=Image.open(ROOT/'images'/f"{r['id']:03d}.png");im.paste(art.resize((tile,tile),Image.Resampling.LANCZOS).convert('RGB'),(x,y))
   d.text((x+6,y+tile+3),f"#{r['id']:03d}  {names[r['headwear_id']]}",font=fnt,fill='white')
   d.text((x+6,y+tile+23),f"V3 {r['approval_sample']:02d} · {r['expression']} / {c['skins'][r['skin']]['name']}",font=fnt,fill='#abc4d1')
   tx='No text' if r['text']=='None' else c['captions'][r['text']]['name']
   d.text((x+6,y+tile+42),f"{c['backgrounds'][r['background']]['name']} · {tx}",font=fnt,fill='#abc4d1')
  im.save(proof/f'Just_Aliens_420_{page+1:02d}.png',compress_level=6)
  print(f'Proof {page+1}/14',flush=True)
 # Compact overview from the same actual exports; labels kept outside NFT artwork.
 tile=100;cols=21;rows=20;lab=18;top=70
 overview=Image.new('RGB',(cols*tile,top+rows*(tile+lab)),'#142130');d=ImageDraw.Draw(overview)
 d.text((14,10),'JUST ALIENS — ALL 420 CURATED COMBINATIONS',font=title,fill='white')
 d.text((14,44),'13 designs • 18 explicitly approved head fits • 420 unique compositions before text',font=fnt,fill='#b9cbd8')
 for i,r in enumerate(recipes):
  x=i%cols*tile;y=top+i//cols*(tile+lab);art=Image.open(ROOT/'images'/f"{r['id']:03d}.png");overview.paste(art.resize((tile,tile),Image.Resampling.LANCZOS).convert('RGB'),(x,y));d.text((x+4,y+tile),f"{r['id']:03d}",font=fnt,fill='white')
 overview.save(proof/'Just_Aliens_All_420.png',compress_level=6)
 with (ROOT/'selection.csv').open('w',newline='') as f:
  keys=['id','approval_sample','headwear_id','skin','expression','outfit','background','text'];w=csv.DictWriter(f,keys);w.writeheader();w.writerows([{k:r[k] for k in keys} for r in recipes])
 print('Complete',flush=True)
if __name__=='__main__':main()

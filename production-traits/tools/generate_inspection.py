#!/usr/bin/env python3
"""Export deterministic lossless inspection PNGs, metadata, and real fit proofs."""
import argparse,json,hashlib,sys,os,io
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
from compositor import ROOT,config,manifest,render,metadata
from build_layers import save_png

def font(size):
 for p in ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf','C:/Windows/Fonts/arial.ttf']:
  if Path(p).exists():return ImageFont.truetype(p,size)
 return ImageFont.load_default(size=size)
def write_json(p,data):
 p.parent.mkdir(parents=True,exist_ok=True);tmp=p.with_suffix('.tmp');data=(json.dumps(data,indent=2)+'\n').encode()
 with open(tmp,'wb') as f:f.write(data);f.flush();os.fsync(f.fileno())
 tmp.replace(p)
def recipe_set(count=50):
 c=config();traits=manifest()['traits'];skins=list(c['skins']);outfits=list(c['outfits']);bgs=list(c['backgrounds']);exs=manifest()['expression_keys'];recipes=[]
 # Every design twice; two extra difficult-fit samples. Inspection frequencies are not rarity.
 ids=[t['id'] for t in traits for _ in range(2)]+[17,23]
 for i in range(count):
  hid=ids[i%50];recipes.append({'id':i+1,'headwear_id':hid,'skin':skins[(i*3+i//10)%len(skins)],'expression':exs[(i*2+i//9)%len(exs)],'outfit':outfits[(i*3+i//10)%len(outfits)],'background':bgs[i%len(bgs)]})
 return recipes

def checker():
 y=__import__('numpy').indices((1254,1254));v=((y[0]//32+y[1]//32)%2)*42+173
 a=__import__('numpy').full((1254,1254,4),255,dtype='uint8');a[:,:,:3]=v[:,:,None];return Image.fromarray(a)
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--out',default=str(ROOT/'inspection'));ap.add_argument('--count',type=int,default=50);ap.add_argument('--proofs',action='store_true');ap.add_argument('--review',action='store_true');ap.add_argument('--proof-ids');ap.add_argument('--native-composites',action='store_true');a=ap.parse_args();out=Path(a.out).resolve();out.mkdir(parents=True,exist_ok=True);recipes=recipe_set(a.count);audit=[];m=manifest();c=config()
 for r in recipes:
  im=render(r,review=a.review);p=out/'images'/f"{r['id']:02d}.png";p.parent.mkdir(parents=True,exist_ok=True);save_png(im,p);decoded=Image.open(p).convert('RGBA');assert decoded.tobytes()==im.tobytes()
  meta=metadata(r,f"../images/{r['id']:02d}.png");write_json(out/'json'/f"{r['id']:02d}.json",meta);audit.append({'id':r['id'],'headwear_id':r['headwear_id'],'expression':r['expression'],'image_sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'pixel_sha256':hashlib.sha256(im.tobytes()).hexdigest(),'lossless_roundtrip':True})
  if r['id']%10==0:print('Inspection',r['id'],'/',len(recipes),flush=True)
 write_json(out/'inspection-recipes.json',recipes);write_json(out/'render-audit.json',audit)
 cols=10;tw=250;th=290;sheet=Image.new('RGB',(cols*tw,((len(recipes)+cols-1)//cols)*th),'#121c29');dr=ImageDraw.Draw(sheet)
 for i,r in enumerate(recipes):
  im=Image.open(out/'images'/f"{r['id']:02d}.png").convert('RGB').resize((tw,tw),Image.Resampling.LANCZOS);x=i%cols*tw;y=i//cols*th;sheet.paste(im,(x,y));name=next(t['value'] for t in m['traits'] if t['id']==r['headwear_id']);dr.text((x+7,y+253),f"{r['id']:02d}  {name}",font=font(15),fill='white');dr.text((x+7,y+273),r['expression']+' / '+c['skins'][r['skin']]['name'],font=font(11),fill='#aabccb')
 save_png(sheet,out/'Inspection_50_Numbered.png')
 if a.proofs:
  proofdir=out/'proofs';proofdir.mkdir(exist_ok=True);exs=m['expression_keys'];index=[];fits=proofdir/'Full_Size'
  if a.native_composites:fits.mkdir(exist_ok=True)
  for t in m['traits']:
   if a.proof_ids and t['id'] not in set(map(int,a.proof_ids.split(','))):continue
   # Exact native-scale 1254 x 900 crops, with all headwear silhouettes and face intact.
   native=Image.new('RGB',(1254*3,940*3),'#111c2b');dn=ImageDraw.Draw(native)
   thumb=Image.new('RGB',(420*3,340*3),'#111c2b');dt=ImageDraw.Draw(thumb)
   for j,ex in enumerate(exs):
    skin=list(c['skins'])[(j+t['id'])%len(c['skins'])];r={'headwear_id':t['id'],'skin':skin,'expression':ex,'outfit':list(c['outfits'])[(j+t['id'])%len(c['outfits'])],'background':'Cubes'}
    bg=['#f1f1f1','#646a70','#172332'][j%3];im=render(r,review=a.review,background_override=bg)
    if a.native_composites:save_png(im,fits/f"{t['id']:02d}_{ex}.png")
    native.paste(im.crop((0,0,1254,900)).convert('RGB'),((j%3)*1254,(j//3)*940));dn.text(((j%3)*1254+18,(j//3)*940+904),f"{t['id']:02d} {t['value']} | {ex} | {skin}",font=font(25),fill='white')
    th=im.crop((0,0,1254,900)).resize((420,301),Image.Resampling.LANCZOS);x=j%3*420;y=j//3*340;thumb.paste(th.convert('RGB'),(x,y));dt.text((x+10,y+308),ex+' / '+skin,font=font(17),fill='white')
    index.append({'headwear_id':t['id'],'expression':ex,'skin':skin,'native_sheet':f"{t['id']:02d}_Fit_Proof_Native.png",'thumbnail_sheet':f"{t['id']:02d}_Fit_Proof_Thumbnail.png",'cell':[j%3,j//3],'native_crop':[0,0,1254,900],'front':t['variants'][ex]['front'],'rear':t['variants'][ex]['rear']})
   save_png(native,proofdir/f"{t['id']:02d}_Fit_Proof_Native.png");save_png(thumb,proofdir/f"{t['id']:02d}_Fit_Proof_Thumbnail.png");print('Fit proof',t['id'],'/24',flush=True)

  if a.proof_ids and (proofdir/'fit-coverage.json').exists():
   previous=json.loads((proofdir/'fit-coverage.json').read_text());updated={(v['headwear_id'],v['expression']):v for v in previous};updated.update({(v['headwear_id'],v['expression']):v for v in index});index=list(updated.values())
  write_json(proofdir/'fit-coverage.json',index)
  # Actual exported alpha layers on black, white, checkerboard.
  ck=checker()
  for name,bg in [('Black','#000000'),('White','#ffffff'),('Checkerboard',ck)]:
   edge=Image.new('RGB',(400*6,445*4),'#263140');de=ImageDraw.Draw(edge)
   for j,t in enumerate(m['traits']):
    base=bg.copy() if isinstance(bg,Image.Image) else Image.new('RGBA',(1254,1254),bg)
    v=t['variants']['Chill'];base.alpha_composite(Image.open(ROOT/v['rear']).convert('RGBA'));base.alpha_composite(Image.open(ROOT/v['front']).convert('RGBA'));tile=base.resize((400,400),Image.Resampling.LANCZOS);x=j%6*400;y=j//6*445;edge.paste(tile.convert('RGB'),(x,y));de.text((x+8,y+409),f"{t['id']:02d} {t['value']}",font=font(17),fill='white')
   save_png(edge,proofdir/f'Alpha_Edges_{name}.png')
 print('Export complete:',out,flush=True)
if __name__=='__main__':main()

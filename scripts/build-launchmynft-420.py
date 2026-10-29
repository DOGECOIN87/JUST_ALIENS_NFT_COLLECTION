#!/usr/bin/env python3
"""Build a frozen, audited LMNFT upload from explicitly approved production fits."""
import sys,json,hashlib,random,csv,zipfile,math,io
from pathlib import Path
from collections import Counter,defaultdict
from functools import lru_cache
from concurrent.futures import ThreadPoolExecutor,as_completed
import numpy as np
from PIL import Image,ImageFilter,ImageDraw,ImageFont

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'production-traits/tools'))
from compositor import character,validate,config,manifest,layer,save
OUT=ROOT/'launchmynft-release'; UP=OUT/'Just_Aliens_LaunchMyNFT/upload'; AUDIT=OUT/'Just_Aliens_LaunchMyNFT/audit'; PROOFS=OUT/'Just_Aliens_LaunchMyNFT/proofs'
for p in (UP,AUDIT,PROOFS):p.mkdir(parents=True,exist_ok=True)
SEED='just-aliens-lmnft-420-approved-final-v1'; rng=random.Random(SEED); C=config(); M=manifest(); N=1254
SIGMA=1.2*N/960
CREATOR='Hn1i7bLb7oHpAL5AoyGvkn7YgwmWrVTbVsjXA1LYnELo'
DESC=C['description']
def digest(b):return hashlib.sha256(b).hexdigest()
def write(p,x):p.write_text(json.dumps(x,indent=2,ensure_ascii=False)+'\n')
human={
 'Witness':('DeLonge','Assets/Background/Beanie_Portrait.png'),
 'Broadcaster':('Bledsoe','Assets/Background/TV_Interview.png'),
 'Analyst':('Lazar','Assets/Background/Man_At_Desk.png'),
 'Disclosure':('Burchett','Assets/Background/Press_Conference.jpg'),
 'LiveSignal':('Elizondo','Assets/Enhanced_Backgrounds/goats_contest_mattrick (20).png'),
 'Whiteboard':('Roder','Assets/Background/Black_Shirt_Portrait.png'),
 'Headset':('Quirk','Assets/Enhanced_Backgrounds/goats_contest_mattrick (21).png'),
 'Hearing':('Grusch','Assets/Enhanced_Backgrounds/goats_contest_mattrick (22).png'),
 'Night':('Nighttime Photo','Assets/Background/art-by-mattrick.png'),
 'Comic':('Comic Cover','Assets/Background/art-by-mattrick (5).png')}
space={k:(v['name'],'production-traits/'+v['file']) for k,v in C['backgrounds'].items() if not v['people']}
BG={**space,**human}; traits={t['id']:t for t in M['traits']}
assert not any('warzone' in p.lower() or 'gorlock' in p.lower() for _,p in BG.values())
for t in M['traits']:
 assert not any(x in t['value'].lower() for x in ['space helmet','astronaut helmet','purple-and-gold hood'])
 for v in t['variants'].values():
  for side in ['front','rear']:
   assert digest((ROOT/'production-traits'/v[side]).read_bytes())==v[side+'_sha256']
source=json.loads((ROOT/'production-traits/recipes.json').read_text()); groups=defaultdict(list)
for r in source:validate(r);groups[r['headwear_id']].append(r)
ids=sorted(groups); extra=rng.choice(ids); normal=[]
for tid in ids:
 g=list(groups[tid]);rng.shuffle(g);normal.extend(dict(x) for x in g[:32 if tid==extra else 31])
assert len(normal)==404
rng.shuffle(normal)
# Preserve 49 people-background editions across the 420-item release.
people_deck=[k for k in human for _ in range(5)][:49];rng.shuffle(people_deck)
human_slots=set(rng.sample(range(404),49));seen=set();human_index=0
for i,r in enumerate(normal):
 choices=list(human) if i in human_slots else list(space)
 desired=people_deck[human_index] if i in human_slots else r['background']
 if i in human_slots:human_index+=1
 if desired in choices:choices.remove(desired);rng.shuffle(choices);choices.insert(0,desired)
 else:rng.shuffle(choices)
 for bg in choices:
  dna=(r['headwear_id'],r['skin'],r['expression'],r['outfit'],bg)
  if dna not in seen:seen.add(dna);r['background']=bg;break
 else:raise ValueError('No unique background assignment')
 # Canonical fit validation does not depend on the replacement background bytes.
 check=dict(r);check['background']=next(iter(C['backgrounds']));validate(check)
 r['kind']='Normal';r['text']='None';r['captioned']=False
for i in rng.sample(range(404),202):normal[i]['captioned']=True
rare=[]
for typ in ['Android','Infantry','OG']:
 choices=list(space);rng.shuffle(choices)
 for j,bg in enumerate(choices[:5]):rare.append({'kind':'Rare','rare_type':typ,'background':bg,'text':'None','captioned':False})
for i in rng.sample(range(15),8):rare[i]['captioned']=True
plan=normal+rare+[{'kind':'Secret Rare','rare_type':'Close-Up','background':'SecretPortrait','text':'None','captioned':False}]
rng.shuffle(plan)
for i,r in enumerate(plan,1):r['id']=i
assert Counter(x['kind'] for x in plan)=={'Normal':404,'Rare':15,'Secret Rare':1}
assert sum(x['captioned'] for x in plan)==210

@lru_cache(maxsize=32)
def background(key):
 im=Image.open(ROOT/BG[key][1]).convert('RGBA'); im=ImageOps_fit(im,(N,N));return im.filter(ImageFilter.GaussianBlur(SIGMA))
def ImageOps_fit(im,size):
 from PIL import ImageOps
 return ImageOps.fit(im,size,method=Image.Resampling.LANCZOS)
@lru_cache(maxsize=8)
def rare_layer(typ):return Image.open(ROOT/'Assets/Rare'/f'{typ}.png').convert('RGBA').resize((N,N),Image.Resampling.LANCZOS)
@lru_cache(maxsize=8)
def text_array(key):
 im=layer(C['captions'][key]['file']);a=np.asarray(im.resize((314,314),Image.Resampling.LANCZOS)).astype(np.float32)/255
 return a,(a[:,:,3]>.8)&((a[:,:,:3]@np.array([.2126,.7152,.0722]))>.35)
def caption(base,r):
 if not r['captioned']:return 'None',None
 if r.get('outfit') in ['Hoodie_White','Spacesuit']:pool=['Red','Vermilion']
 else:pool={'Lime':['Lime','Cyan'],'Forest_Green':['Lime','Cyan'],'Coral_Red':['Red','Vermilion'],'Violet':['Magenta','Sky_Blue'],'Cyan':['Cyan','Sky_Blue'],'Graphite':['Sky_Blue','Red'],'Platinum':['Cyan','Sky_Blue']}.get(r.get('skin'),['Cyan','Red','Vermilion'])
 a=np.asarray(base.resize((314,314),Image.Resampling.LANCZOS).convert('RGB')).astype(np.float32)/255;lum=a@np.array([.2126,.7152,.0722]);scores={}
 for k in pool:
  t,mask=text_array(k);tl=t[:,:,:3]@np.array([.2126,.7152,.0722]);scores[k]=float(np.abs(tl-lum)[mask].mean())
 best=max(scores,key=scores.get);return best,round(scores[best],6)
def metadata(r):
 a=[('Type',r['kind'])]
 if r['kind']=='Normal':
  a += [('Background',BG[r['background']][0]),('Skin',C['skins'][r['skin']]['name']),('Expression',r['expression']),('Outfit',C['outfits'][r['outfit']]['name']),('Headwear',traits[r['headwear_id']]['value'])]
 elif r['kind']=='Rare':a += [('Rare Type',r['rare_type']),('Background',BG[r['background']][0])]
 else:a += [('Rare Type','Close-Up'),('Background','Secret Rare Portrait')]
 a += [('Text',C['captions'][r['text']]['name'] if r['text']!='None' else 'None')]
 uri=f"{r['id']}.png"
 return {'name':f"Just Aliens #{r['id']}",'symbol':'JSTA','description':DESC,'image':uri,'seller_fee_basis_points':500,'attributes':[{'trait_type':k,'value':v} for k,v in a],'properties':{'category':'image','files':[{'uri':uri,'type':'image/png'}],'creators':[{'address':CREATOR,'share':100}]}}
def export(r):
 dst=UP/f"{r['id']}.png";meta_path=UP/f"{r['id']}.json"
 if dst.exists() and meta_path.exists():
  try:
   with Image.open(dst) as check:check.verify()
   old=json.loads(meta_path.read_text());name=next(a['value'] for a in old['attributes'] if a['trait_type']=='Text')
   r['text']='None' if name=='None' else next(k for k,v in C['captions'].items() if v['name']==name)
   assert old==metadata(r)
   with Image.open(dst) as check:pixels=check.convert('RGB').tobytes()
   r['caption_contrast']=None
   return r['id'],digest(dst.read_bytes()),digest(pixels)
  except (OSError,SyntaxError,ValueError,AssertionError,StopIteration):pass
 if r['kind']=='Secret Rare':im=Image.open(ROOT/'Assets/SecretRare/SecretRare_1.png').convert('RGBA').resize((N,N),Image.Resampling.LANCZOS);r['caption_contrast']=None
 else:
  im=background(r['background']).copy()
  if r['kind']=='Normal':
   check=dict(r);check['background']=next(iter(C['backgrounds']));im.alpha_composite(character(check))
  else:im.alpha_composite(rare_layer(r['rare_type']))
  r['text'],r['caption_contrast']=caption(im,r)
  if r['text']!='None':im.alpha_composite(layer(C['captions'][r['text']]['file']))
 opaque=Image.new('RGB',(N,N),'black');opaque.paste(im,mask=im.getchannel('A'))
 save(opaque,dst)
 m=metadata(r);write(UP/f"{r['id']}.json",m)
 return r['id'],digest(dst.read_bytes()),digest(opaque.tobytes())

if __name__=='__main__':
 results={}
 with ThreadPoolExecutor(max_workers=4) as pool:
  for n,f in enumerate(as_completed([pool.submit(export,r) for r in plan]),1):
   ident,filehash,pixelhash=f.result();results[ident]={'sha256':filehash,'pixel_sha256':pixelhash}
   if n%30==0:print(f'Verified/rendered {n}/420',flush=True)
 assert len({x['pixel_sha256'] for x in results.values()})==420
 bytrait=defaultdict(Counter);token_attrs={};all_meta=[]
 for r in plan:
  i=r['id'];p=UP/f'{i}.png'
  with Image.open(p) as im:im.verify()
  m=json.loads((UP/f'{i}.json').read_text());assert m==metadata(r);assert m['image']==f'{i}.png';assert m['properties']['files'][0]['uri']==m['image'];assert m['properties']['files'][0]['type']=='image/png';assert len(m['name'].encode())<=32
  a={v['trait_type']:v['value'] for v in m['attributes']};assert len(a)==len(m['attributes']);token_attrs[i]=a;all_meta.append(m)
  for k,v in a.items():bytrait[k][v]+=1
 keys=sorted(bytrait)
 for i,a in token_attrs.items():
  for k in keys:
   if k not in a:bytrait[k]['(not applicable)']+=1
 scored=[]
 for i,a in token_attrs.items():scored.append((i,sum(420/bytrait[k][a.get(k,'(not applicable)')] for k in keys)))
 scored.sort(key=lambda x:(-x[1],x[0]));ranks={i:(rank,score) for rank,(i,score) in enumerate(scored,1)}
 with (AUDIT/'trait-frequencies.csv').open('w',newline='') as f:
  w=csv.writer(f);w.writerow(['trait_type','value','count','percentage_of_420'])
  for k in keys:
   for v,n in sorted(bytrait[k].items()):w.writerow([k,v,n,round(100*n/420,6)])
 with (AUDIT/'rarity-ranking.csv').open('w',newline='') as f:
  w=csv.writer(f);w.writerow(['edition','frequency_rarity_rank','frequency_rarity_score','type','type_rarity_note'])
  for r in plan:w.writerow([r['id'],ranks[r['id']][0],round(ranks[r['id']][1],8),r['kind'],'Frequency score is separate from the declared Type tier'])
 assert bytrait['Type']==Counter({'Normal':404,'Rare':15,'Secret Rare':1})
 assert bytrait['Rare Type']['Android']==bytrait['Rare Type']['Infantry']==bytrait['Rare Type']['OG']==5
 assert sum(r['text']!='None' for r in plan)==210
 assert sum(r['background'] in human for r in plan)==49
 assert len(list(UP.glob('*.png')))==len(list(UP.glob('*.json')))==420
 used={BG[r['background']][1] for r in plan if r['kind']!='Secret Rare'}|{'Assets/SecretRare/SecretRare_1.png'}|{f'Assets/Rare/{t}.png' for t in ['Android','Infantry','OG']}
 for r in plan:
  if r['kind']=='Normal':
   v=traits[r['headwear_id']]['variants'][r['expression']]
   used.update('production-traits/'+p for p in [v['front'],v['rear'],C['outfits'][r['outfit']]['file'],f"Assets/Expressions/{r['skin']}/{r['expression']}.png"])
  if r['text']!='None':used.add('production-traits/'+C['captions'][r['text']]['file'])
 write(AUDIT/'source-hashes.json',{p:digest((ROOT/p).read_bytes()) for p in sorted(used)})
 write(AUDIT/'recipes.json',plan);write(AUDIT/'image-checksums.json',results)
 report={'supply':420,'normal':{'count':404,'percent':404/420*100},'rare':{'count':15,'percent':15/420*100,'variants':{'Android':5,'Infantry':5,'OG':5}},'secret_rare':{'count':1,'percent':1/420*100},'captioned':210,'uncaptioned':210,'people_background_editions':49,'unique_images':420,'unique_normal_base_combinations':404,'headwear_designs':len(ids),'approved_head_fits_used':len({(r['headwear_id'],r['skin'],r['expression'],r['approval_sample']) for r in normal}),'headwear_design_counts':dict(Counter(r['headwear_id'] for r in normal)),'canvas':[N,N],'format':'lossless RGB PNG','background_blur_sigma_at_960px':1.2,'foreground_layers_blurred':False,'gorlock_backgrounds':0,'space_helmets':0,'purple_gold_hoods':0,'json_pairs_verified':420,'invalid_placeholder_gifs_used':0,'royalty_basis_points':500,'creator_address':CREATOR,'source_main_commit':'a4ecaa2c6c3be2bbacbd578ab605e92bd398b5dc','strict_approval_commit':'0f6dbef59270d6591dbd02366ec733e472bef137','seed':SEED,'launchpad_live_import_tested':False,'frequency_rank_method':'Sum of inverse attribute frequencies across all categories; missing attributes counted as not applicable; deterministic edition order breaks ties. Declared Type tier is separate.'}
 write(AUDIT/'verification.json',report)
 write(AUDIT/'launch-settings.json',{'network':'Solana mainnet','collection_name':'Just Aliens','symbol':'JSTA','supply':420,'mint_price_sol':0.005,'mint_price_lamports':5000000,'royalty_percent':5,'creator_address':CREATOR,'creator_share_percent':100,'upload_folder':'upload','numbering':'1 through 420; matching PNG and JSON basenames','mint_order':'Randomized recommended; token filenames are already shuffled across tiers','action_performed':'Files generated only; no upload, wallet signing, mint or deployment'})
 # Proofs contain the actual exported images, never substituted previews.
 font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',15);title=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',25)
 overview=Image.new('RGB',(2100,2470),'#142130');d=ImageDraw.Draw(overview);d.text((15,10),'JUST ALIENS — LAUNCHMYNFT 420',font=title,fill='white');d.text((15,44),'404 normal · 15 rare · 1 secret rare · approved fits · faint background blur',font=font,fill='#bac9d9')
 for i in range(1,421):
  with Image.open(UP/f'{i}.png') as art:
   x=(i-1)%21*100;y=70+(i-1)//21*120;overview.paste(art.resize((100,100),Image.Resampling.LANCZOS),(x,y));d.text((x+3,y+101),str(i),font=font,fill='white')
 overview.save(PROOFS/'All_420.jpg',quality=94)
 for page in range(14):
  sheet=Image.new('RGB',(1800,1700),'#142130');d=ImageDraw.Draw(sheet);d.text((15,10),f'JUST ALIENS — FINAL EXPORTS {page*30+1}–{(page+1)*30}',font=title,fill='white')
  for j in range(30):
   i=page*30+j+1;r=plan[i-1];x=j%6*300;y=65+j//6*325
   with Image.open(UP/f'{i}.png') as art:sheet.paste(art.resize((300,300),Image.Resampling.LANCZOS),(x,y))
   d.text((x+6,y+302),f"#{i} · {r['kind']}",font=font,fill='white')
  sheet.save(PROOFS/f'Proof_{page+1:02d}.jpg',quality=94)
 special=[r for r in plan if r['kind']!='Normal'];s=Image.new('RGB',(1600,1800),'#142130');d=ImageDraw.Draw(s);d.text((15,10),'ALL RARES AND THE SECRET RARE',font=title,fill='white')
 for j,r in enumerate(special):
  x=j%4*400;y=65+j//4*430
  with Image.open(UP/f"{r['id']}.png") as art:s.paste(art.resize((400,400),Image.Resampling.LANCZOS),(x,y))
  d.text((x+6,y+403),f"#{r['id']} · {r['kind']} · {r['rare_type']}",font=font,fill='white')
 s.save(PROOFS/'All_Rares.jpg',quality=94)
 readme=f'''JUST ALIENS — LAUNCHMYNFT UPLOAD PACKAGE
420 lossless 1254 × 1254 PNGs, each with matching standard Metaplex JSON.

EXTRACT all four upload archives to the SAME folder. They share the root
Just_Aliens_LaunchMyNFT/upload/. Upload only its 840 PNG/JSON files using
LaunchMyNFT > Create > New Collection > Solana > upload your existing assets.
Do not upload audit files, proof images, or this readme as NFT assets.
Keep each N.png beside N.json; filenames run 1 through 420.
Image fields use matching local filenames for the launchpad to replace with hosted URIs.

SETTINGS
Supply: 420. Mint price: 0.005 SOL. Symbol: JSTA. Royalties: 5%.
Existing repository creator/payout address: {CREATOR}; share: 100%.
Use the correct wallet and verify these settings on the launchpad before signing.
JSON royalties are metadata; configure royalties in the launchpad as well.
No wallet transaction, hosting upload, mint, or deployment has been performed.
Platform-side import has not been executed; package validation is local.

EXACT RARITIES
404 Normal = 96.190476%; 15 Rare = 3.571429%; 1 Secret Rare = 0.238095%.
Rare types: Android 5; Infantry 5; OG 5. Captions: 210 yes, 210 none.
One secret in 420 cannot equal the legacy 0.07% website percentage.
Normal headwear: 13 approved designs, 31 or 32 appearances each, restricted
to the 18 explicitly approved headwear/skin/expression fits.
49 editions use people backgrounds. The Gorlock/Warzone background, rejected
purple/gold hood and space helmets are excluded. Backgrounds alone receive
the very faint blur. Existing registered foreground layers remain untouched.

AUDIT
verification.json contains counts and checks. trait-frequencies.csv lists each
actual trait count and percentage. rarity-ranking.csv is an inverse-frequency
trait score, separate from the declared Type rarity tier. It is not uploaded
as an NFT attribute or a promised marketplace rank. recipes.json and source/
image hashes identify every input and output. All images and metadata are unique.

Sources: https://generator.launchmynft.io/ (supported output details),
https://docs.launchmynft.io/ (upload-existing-assets workflow), and
https://www.metaplex.com/docs/smart-contracts/token-metadata/token-standard
(off-chain JSON fields). Standard PNG is retained losslessly instead of WebP.
'''
 (OUT/'Just_Aliens_LaunchMyNFT/README.txt').write_text(readme)
 for part in range(4):
  dst=OUT/f'Just_Aliens_LM_PART_{part+1:02d}.zip'
  with zipfile.ZipFile(dst,'w',compression=zipfile.ZIP_STORED,allowZip64=True) as z:
   z.write(OUT/'Just_Aliens_LaunchMyNFT/README.txt','Just_Aliens_LaunchMyNFT/README.txt')
   for i in range(part*105+1,(part+1)*105+1):
    for ext in ['png','json']:p=UP/f'{i}.{ext}';z.write(p,'Just_Aliens_LaunchMyNFT/upload/'+p.name)
 with zipfile.ZipFile(OUT/'Just_Aliens_LM_Audit_and_Proofs.zip','w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as z:
  for p in sorted(AUDIT.rglob('*'))+sorted(PROOFS.rglob('*'))+[OUT/'Just_Aliens_LaunchMyNFT/README.txt']:
   if p.is_file():z.write(p,str(p.relative_to(OUT)))
 for p in sorted(OUT.glob('*.zip')):
  with zipfile.ZipFile(p) as z:assert z.testzip() is None
  print(p.name,round(p.stat().st_size/1024**2,2),'MiB',flush=True)
 print(json.dumps(report),flush=True)

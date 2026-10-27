#!/usr/bin/env python3
"""Verify geometry, paired layers, provenance, release gates and inspection outputs."""
from pathlib import Path
import argparse,json,hashlib,sys
from collections import Counter
from PIL import Image
import numpy as np
from scipy import ndimage
from compositor import ROOT,config,manifest,render,metadata

def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--inspection',default=str(ROOT/'inspection'));ap.add_argument('--review',action='store_true');a=ap.parse_args();m=manifest();c=config();reg=json.load(open(ROOT/'registration.json'));issues=[];checks=[]
 assert len(m['traits'])==24 and len({t['id'] for t in m['traits']})==24
 assert reg['source_to_production']['scale']==1254/960 and reg['source_to_production']['translate']==[0,0]
 old=json.load(open(ROOT/'Provenance/Original_Pack/trait-manifest.json'));approved={t['id']:t for t in old['traits']}
 for t in m['traits']:
  assert t['value']==approved[t['id']]['value'],'Display name changed'
  assert sha(ROOT/t['original'])==approved[t['id']]['native_sha256'],'Original changed'
  assert set(t['variants'])==set(m['expression_keys'])
  if not a.review and t['status']!='production_ready':issues.append({'id':t['id'],'issue':'not released'})
  for ex,v in t['variants'].items():
   layers=[]
   for part in ['front','rear']:
    p=ROOT/v[part];Image.open(p).verify();im=Image.open(p)
    assert im.size==(1254,1254) and im.mode=='RGBA'
    assert sha(p)==v[part+'_sha256']
    ar=np.array(im);layers.append(ar)
    assert ar[:,:,3].min()==0,'Transparent margins missing'
    if np.any(ar[:4,:,3]) or np.any(ar[-4:,:,3]) or np.any(ar[:,:4,3]) or np.any(ar[:,-4:,3]):issues.append({'id':t['id'],'expression':ex,'issue':part+' touches border'})
   f,b=layers;assert not np.any((f[:,:,3]>0)&(b[:,:,3]>0)),'Paired mattes overlap'
   assert np.any(f[:,:,3]),'Empty front layer'
   alpha=f[:,:,3]>=128;eyes=0;rect_pixels=0;reference=np.array(Image.open(ROOT/f'Assets/Expressions/Platinum/{ex}.png'))
   for e in reg['heads'][ex]['eyes']:
    x,y,w,h=map(round,e['roi']);rect_pixels+=int(alpha[y:y+h,x:x+w].sum());a0=reference[y:y+h,x:x+w];dark=(a0[:,:,:3].mean(2)<30)&(a0[:,:,3]>128);lab,n=ndimage.label(dark);sizes=np.bincount(lab.ravel());sizes[0]=0;region=ndimage.binary_fill_holes(lab==sizes.argmax());mask=np.zeros(alpha.shape,bool);mask[y:y+h,x:x+w]=region;mask=ndimage.binary_dilation(mask,iterations=4);eyes+=int((mask&alpha).sum())
   mouth=0
   if 'mouth' in reg['heads'][ex]:
    l,tp,rr,bt=map(round,reg['heads'][ex]['mouth']['bbox']);mouth=int(alpha[tp:bt,l:rr].sum())
   if eyes or mouth:issues.append({'id':t['id'],'expression':ex,'issue':'facial obstruction','actual_eye_contour_plus_4px_overlap':eyes,'bounding_eye_rect_corner_overlap_advisory':rect_pixels,'mouth_pixels':mouth})
   # Closed crowns must cover the upper cranium. Open visor, headphone arch,
   # and the spaces between separate crest blades deliberately expose it.
   scalp=0
   if t['id'] not in [16,17,23]:
    head=np.array(Image.open(ROOT/f'Assets/Expressions/Platinum/{ex}.png'))[:,:,3]>128
    lab,n=ndimage.label(head);sz=np.bincount(lab.ravel());sz[0]=0;head=lab==sz.argmax();yy=np.indices(alpha.shape)[0]
    scalp=int((head&~alpha&(yy<v['placement']['contact'][1]-60)).sum())
    if scalp>20:issues.append({'id':t['id'],'expression':ex,'issue':'upper scalp visible through closed crown','pixels':scalp})
   checks.append({'id':t['id'],'expression':ex,'dimensions':True,'transparent_margins':True,'hashes':True,'paired_mattes_disjoint':True,'actual_eye_contour_plus_4px_overlap':eyes,'bounding_eye_rect_corner_overlap_advisory':rect_pixels,'mouth_pixels':mouth,'upper_scalp_pixels':scalp})
 for group in ['outfits','backgrounds']:
  for k,t in c[group].items():
   p=ROOT/t['file'];Image.open(p).verify();im=Image.open(p);assert im.size==(1254,1254) and im.mode=='RGBA'
 for p in (ROOT/'Assets/Expressions').glob('*/*.png'):
  Image.open(p).verify();im=Image.open(p);assert im.size==(1254,1254) and im.mode=='RGBA'
 support=json.load(open(ROOT/'support-source-map.json'))
 for record in support:
  p=ROOT/record['original'];assert sha(p)==record['source_sha256'],'Approved original changed'
  expected=Image.open(p).convert('RGBA').resize((1254,1254),Image.Resampling.LANCZOS)
  assert expected.tobytes()==Image.open(ROOT/record['production']).convert('RGBA').tobytes(),'Support artwork differs from whole-canvas resize'
 visual=json.load(open(ROOT/'visual-review.json'))
 assert len(visual['combinations'])==216
 for record in visual['combinations']:
  t=next(t for t in m['traits'] if t['id']==record['headwear_id']);v=t['variants'][record['expression']]
  assert record['front_sha256']==v['front_sha256'] and record['rear_sha256']==v['rear_sha256'],'Visual review is stale'
  assert record['native_review']=='passed' and record['thumbnail_review']=='passed'
 ins=Path(a.inspection);inspection=[]
 if ins.exists():
  recipes=json.load(open(ins/'inspection-recipes.json'));assert len(recipes)==50
  assert set(r['headwear_id'] for r in recipes)==set(range(1,25))
  counts=Counter(r['headwear_id'] for r in recipes);assert min(counts.values())>=2
  assert len({r['skin'] for r in recipes})==10 and len({r['expression'] for r in recipes})==9
  assert len({r['background'] for r in recipes})==18 and len({r['outfit'] for r in recipes})==10
  assert len(list((ins/'images').glob('*.png')))==50 and len(list((ins/'json').glob('*.json')))==50
  for r in recipes:
   p=ins/'images'/f"{r['id']:02d}.png";Image.open(p).verify();im=Image.open(p).convert('RGBA');assert im.size==(1254,1254);expected=render(r,review=a.review)
   if expected.tobytes()!=im.tobytes():issues.append({'inspection_id':r['id'],'issue':'export differs from actual compositor'})
   meta=json.load(open(ins/'json'/f"{r['id']:02d}.json"));assert meta==metadata(r,f"../images/{r['id']:02d}.png")
   assert len([t for t in meta['attributes'] if t['trait_type']=='Headwear'])==1
   inspection.append({'id':r['id'],'lossless_exact_pixels':expected.tobytes()==im.tobytes(),'image_sha256':sha(p),'metadata_sha256':sha(ins/'json'/f"{r['id']:02d}.json")})
  coverage=json.load(open(ins/'proofs/fit-coverage.json'))
  assert {(v['headwear_id'],v['expression']) for v in coverage}=={(id,ex) for id in range(1,25) for ex in m['expression_keys']}
  for v in coverage:
   assert (ins/'proofs'/v['native_sheet']).exists() and (ins/'proofs'/v['thumbnail_sheet']).exists()
  for id in range(1,25):
   for mode in ['Native','Thumbnail']:Image.open(ins/'proofs'/f'{id:02d}_Fit_Proof_{mode}.png').verify()
 report={'revision':m['revision'],'automated_status':'passed' if not issues else 'failed','logical_traits':24,'expression_combinations':len(checks),'production_layers':len(checks)*2,'original_masters_sha256_exact':True,'support_originals_preserved':len(support),'support_artwork_pixels_exact_to_whole_canvas_resize':True,'visual_review_current':True,'approved_display_names_exact':True,'fixed_registration':True,'inspection_composites':len(inspection),'checks':checks,'inspection_checks':inspection,'issues':issues,'scope':'Automated checks complement, and do not replace, the recorded visual review.'}
 (ROOT/'verification.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:report[k] for k in ['automated_status','logical_traits','expression_combinations','production_layers','inspection_composites','issues']},indent=2));return bool(issues)
if __name__=='__main__':sys.exit(main())

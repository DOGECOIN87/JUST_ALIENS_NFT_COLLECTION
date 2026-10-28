"""QA for exact approved fits, exported pixels, metadata, alpha, and caption contrast."""
import json,hashlib
from pathlib import Path
from collections import Counter
from concurrent.futures import ThreadPoolExecutor,as_completed
from PIL import Image
import numpy as np
from scipy.ndimage import binary_erosion,minimum_filter
from compositor import ROOT,config,manifest,policy,validate,layer,render,metadata
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def lum(rgb):
 v=rgb.astype(np.float64)/255;v=np.where(v<=.04045,v/12.92,((v+.055)/1.055)**2.4)
 return v@np.array([.2126,.7152,.0722])
def main():
 c=config();m=manifest();p=policy();rr=json.loads((ROOT/'recipes.json').read_text());issues=[]
 assert len(rr)==420 and {r['id'] for r in rr}==set(range(1,421))
 assert len({tuple(r[k] for k in ['headwear_id','skin','expression','outfit','background']) for r in rr})==420
 assert sum(r['text']!='None' for r in rr)==210
 assert len(m['traits'])==13 and len(p['approved_fits'])==18
 reference=json.loads((ROOT/'Provenance/source-comparison.json').read_text())['unchanged_registered_files']
 for rel,s in reference.items():assert sha(ROOT/rel)==s,('Source changed',rel)
 layers=set()
 for t in m['traits']:
  for ex,v in t['variants'].items():
   for side in ['front','rear']:
    rel=v[side];assert sha(ROOT/rel)==v[side+'_sha256'];layers.add(rel)
    with Image.open(ROOT/rel) as im:
     im.verify()
    a=np.asarray(layer(rel))[:,:,3]
    assert not np.any(a[:4,:]) and not np.any(a[-4:,:]) and not np.any(a[:,:4]) and not np.any(a[:,-4:]),('Headwear touches canvas',rel)
 assert {str(x.relative_to(ROOT)) for x in (ROOT/'Layers').rglob('*.png')}==layers
 # The renderer rejects every non-allowlisted head triple, even if that skin/expression is otherwise present.
 rejected_tests=0;fitkeys={(f['headwear_id'],f['skin'],f['expression']) for f in p['approved_fits']}
 for r0 in rr[:18]:
  for skin in c['skins']:
   r={**r0,'skin':skin}
   if (r['headwear_id'],skin,r['expression']) in fitkeys:continue
   try:validate(r);raise AssertionError('Unapproved skin accepted')
   except ValueError:rejected_tests+=1
 masks={}
 for key,v in c['captions'].items():
  im=layer(v['file']);a=np.asarray(im);glyph=(a[:,:,3]>215)&(a[:,:,:3].max(2)>130)&((a[:,:,:3].max(2)-a[:,:,:3].min(2)>70)|(a[:,:,:3].min(2)>140))
  glyph=binary_erosion(glyph,iterations=2);ys,xs=np.where(glyph)
  assert ys.min()>950 and xs.min()>20 and xs.max()<1234 and ys.max()<1234
  masks[key]=glyph
 def verify_one(r):
  validate(r);file=ROOT/'images'/f"{r['id']:03d}.png";j=ROOT/'json'/f"{r['id']:03d}.json"
  with Image.open(file) as im:im.verify()
  a=np.asarray(Image.open(file).convert('RGBA'));expected=np.asarray(render(r))
  assert a.shape==(1254,1254,4) and (a[:,:,3]==255).all()
  assert np.array_equal(a,expected),('Export differs from recipe',r['id'])
  meta=json.loads(j.read_text());assert meta==metadata(r)
  assert sum(x['trait_type']=='Headwear' for x in meta['attributes'])==1
  result={'id':r['id'],'sha256':sha(file),'pixels_sha256':hashlib.sha256(a.tobytes()).hexdigest()}
  if r['text']!='None':
   ll=lum(a[960:1235,310:1000,:3]);near_dark=minimum_filter(ll,size=29,mode='nearest');mask=masks[r['text']][960:1235,310:1000]
   ratios=(ll[mask]+.05)/(near_dark[mask]+.05);median=float(np.median(ratios));low=float(np.quantile(ratios,.1))
   result.update(text=r['text'],caption_local_contrast_median=round(median,3),caption_local_contrast_p10=round(low,3))
   if median<4.5 or low<2.7:result['contrast_review_required']=True
  return result
 records=[]
 with ThreadPoolExecutor(max_workers=4) as pool:
  for i,f in enumerate(as_completed([pool.submit(verify_one,r) for r in rr]),1):
   records.append(f.result())
   if i%60==0:print(f'Verified {i}/420',flush=True)
 records.sort(key=lambda x:x['id'])
 assert len({r['pixels_sha256'] for r in records})==420
 contrast_flags=[x for x in records if x.get('contrast_review_required')]
 result={'revision':m['revision'],'supply':420,'status':'technical_checks_passed' if not contrast_flags else 'caption_review_required','unique_pre_text_compositions':420,'unique_exported_images':420,'approved_head_fits':18,'approved_designs':13,'removed_samples':32,'removed_designs':11,'headwear_layer_files':len(layers),'supporting_source_hashes_unchanged':len(reference),'blocked_unapproved_skin_tests':rejected_tests,'dimensions':'all 1254×1254 RGBA','alpha':'composites opaque; production layers full transparent canvases','png_crc':'passed','metadata':'all 420 exact recipe matches and one Headwear attribute','text_count':210,'text_obstruction':'all text glyphs below y950; no face obstruction','contrast_method':'Median and 10th percentile of native glyph luminance vs darkest local 29px neighborhood; a caption readability diagnostic, not a claim of WCAG certification.','contrast_flags':contrast_flags,'visual_review':'See VISUAL_REVIEW.md; technical checks do not certify aesthetic quality.','records':records}
 (ROOT/'verification.json').write_text(json.dumps(result,indent=2)+'\n')
 print('Verification status:',result['status'],'contrast flags',len(contrast_flags),flush=True)
 return result
if __name__=='__main__':main()

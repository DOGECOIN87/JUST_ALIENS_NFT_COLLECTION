#!/usr/bin/env python3
"""Build full-canvas coordinated layers from individually fitted artwork masters."""
from pathlib import Path
from PIL import Image
from scipy import ndimage
import numpy as np,json,hashlib,io,os,sys
ROOT=Path(__file__).resolve().parents[1];N=1254

def save_png(im,p):
 p=Path(p);b=io.BytesIO();im.save(b,format='PNG');data=b.getvalue();tmp=p.with_suffix('.tmp');
 with open(tmp,'wb') as f:f.write(data);f.flush();os.fsync(f.fileno())
 tmp.replace(p);Image.open(p).verify()

def sha(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()

def clean_master(p):
 a=np.array(Image.open(p).convert('RGBA')); alpha=a[:,:,3].copy()
 labels,n=ndimage.label(alpha>16); sizes=np.bincount(labels.ravel());sizes[0]=0
 main=labels==sizes.argmax(); footprint=ndimage.binary_dilation(main,iterations=2)
 # Remove disconnected extraction dust, preserving the real silhouette's alpha.
 a[~footprint]=0;a[a[:,:,3]<4]=0
 solid=a[:,:,3]>=128
 inner=ndimage.binary_erosion(solid,iterations=4)
 dist,idx=ndimage.distance_transform_edt(~inner,return_indices=True)
 rim=(a[:,:,3]>0)&~inner&(dist<=7)
 # Edge RGB decontamination only; opaque interior texture is unchanged.
 rgb=a[:,:,:3].copy(); sample=rgb[idx[0],idx[1]]
 delta=np.max(rgb.astype(int)-sample.astype(int),axis=2)-np.min(rgb.astype(int)-sample.astype(int),axis=2)
 bad=rim&(delta>65)
 a[:,:,:3][bad]=sample[bad]
 labels,n=ndimage.label(a[:,:,3]>16); sizes=np.bincount(labels.ravel());sizes[0]=0; main=labels==sizes.argmax();a[~ndimage.binary_dilation(main,iterations=2)]=0
 ys,xs=np.where(a[:,:,3]>0);box=[int(xs.min()),int(ys.min()),int(xs.max()+1),int(ys.max()+1)]
 return Image.fromarray(a),box,{'dust_pixels_removed':int(np.count_nonzero((alpha>0)&(a[:,:,3]==0))),'edge_rgb_pixels_decontaminated':int(bad.sum())}

def place(im,w,cx,cy,source_contact,yscale=1):
 k=w/im.width; ky=k*yscale; h=round(im.height*ky);part=im.resize((round(w),h),Image.Resampling.LANCZOS)
 left=round(cx-w/2); top=round(cy-source_contact*ky)
 full=Image.new('RGBA',(N,N));full.alpha_composite(part,(left,top));return full,{'left':left,'top':top,'width':round(w),'height':h,'scale':k,'scale_x':k,'scale_y':ky,'vertical_fit_factor':yscale,'contact':[round(cx,2),round(cy,2)]}

def build():
 reg=json.loads((ROOT/'registration.json').read_text());log=json.loads((ROOT/'generation-log.json').read_text());params=json.loads((ROOT/'fit-parameters.json').read_text());records=[]
 selected={int(v) for v in sys.argv[1:]}
 old=json.loads((ROOT/'trait-manifest.json').read_text()) if (ROOT/'trait-manifest.json').exists() else None
 baseline=reg['heads']['Chill'];ref=baseline['contour_rows']['forehead'];refwidth=ref['right']-ref['left'];refcx=(ref['right']+ref['left'])/2
 for t in log:
  id=str(t['id'])
  if selected and t['id'] not in selected:
   records.append(next(a for a in old['traits'] if a['id']==t['id']));continue
  p=params[id];im,box,cleanup=clean_master(ROOT/t['source']);im=im.crop(box);contact=p.get('source_contact',t['source_contact_y'])-box[1]
  cleanpath=ROOT/'Source_Masters/Cleaned'/Path(t['source']).name;cleanpath.parent.mkdir(parents=True,exist_ok=True)
  # Kept at native resolution; production consumers use only Layers/.
  save_png(im,cleanpath)
  trait={'id':t['id'],'trait_type':'Headwear','value':t['name'],'status':'under_review','source':str(cleanpath.relative_to(ROOT)),'original':t['original'],'artwork_redrawn':t['edited'],'cleanup':cleanup,'variants':{}}
  for ex,head in reg['heads'].items():
   hrow=head['contour_rows']['forehead'];factor=(hrow['right']-hrow['left'])/refwidth;cx=(hrow['right']+hrow['left'])/2 + p.get('dx',0)
   # Individual hat width + expression contour sizing, with no change to character.
   w=p['width']*factor;cy=hrow['y']+p.get('dy',0)
   if t['id']==17:cy=head['production_head_bbox'][1]+10
   overrides=p.get('expressions',{}).get(ex,{})
   w*=overrides.get('scale',1);cx+=overrides.get('dx',0);cy+=overrides.get('dy',0)
   full,placement=place(im,w,cx,cy,contact,overrides.get('yscale',1))
   a=np.array(full);yy,xx=np.indices((N,N));source_y=(yy-placement['top'])/placement['scale_y'];source_x=(xx-placement['left'])/placement['scale'];u=(source_x-im.width/2)/(im.width/2)
   # Rear returns remain complete. The split seam is hidden by the approved head.
   split=contact+p.get('rear_curve',0.06)*im.width*u*u
   front=source_y<=split
   if t['id']==16:
    front=source_y >= p['strap_split']-box[1]
   if t['id']==17:
    # Band and outer shells in front; inner cushions behind the temples.
    front=(source_y<im.height*.45)|(source_x<im.width*.18)|(source_x>im.width*.82)
   f=a.copy();b=a.copy();f[~front]=0;b[front]=0
   fp=ROOT/'Layers'/ex/'Front'/Path(t['source']).name;bp=ROOT/'Layers'/ex/'Rear'/Path(t['source']).name
   fp.parent.mkdir(parents=True,exist_ok=True);bp.parent.mkdir(parents=True,exist_ok=True)
   save_png(Image.fromarray(f),fp);save_png(Image.fromarray(b),bp)
   trait['variants'][ex]={'front':str(fp.relative_to(ROOT)),'rear':str(bp.relative_to(ROOT)),'placement':placement,'front_sha256':sha(fp),'rear_sha256':sha(bp),'split':'pixel-disjoint complementary mattes; not independent metadata traits'}
  if old:
   prior=next((a for a in old['traits'] if a['id']==t['id']),None)
   if prior and prior['status']=='production_ready' and all(prior['variants'][ex]['front_sha256']==v['front_sha256'] and prior['variants'][ex]['rear_sha256']==v['rear_sha256'] for ex,v in trait['variants'].items()):trait['status']='production_ready'
  records.append(trait);print('Built',t['id'],t['name'],flush=True)
 manifest={'schema_version':2,'collection':'Just Aliens','revision':'verified-fit-v2','canvas':[N,N],'registration':'registration.json','layer_order':reg['layer_order'],'expression_keys':list(reg['heads']),'traits':records,'selection_policy':'Only traits with status=production_ready are selectable by default. Under-review renders require explicit review mode.'}
 (ROOT/'trait-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
if __name__=='__main__':build()

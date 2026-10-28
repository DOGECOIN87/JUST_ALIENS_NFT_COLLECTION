import json,textwrap
from pathlib import Path
import curate
from compositor import ROOT,config,policy,render,metadata,save
recipes=json.loads((ROOT/'recipes.json').read_text());changed=[]
for r in recipes:
 if r['text']!='None' and r['outfit'] in ['Hoodie_White','Spacesuit'] and r['text'] not in ['Red','Vermilion']:
  r['text']='Red' if r['skin'] in ['Cyan','Coral_Red'] or r['headwear_id']==21 else 'Vermilion';changed.append(r['id'])
(ROOT/'recipes.json').write_text(json.dumps(recipes,indent=2)+'\n')
metrics=json.loads((ROOT/'curation-metrics.json').read_text());by_id={r['id']:r for r in recipes}
for x in metrics['selected']:x['recipe']=by_id[x['recipe']['id']]
from collections import Counter
metrics['counts']['text']=dict(Counter(r['text'] for r in recipes if r['text']!='None'))
(ROOT/'curation-metrics.json').write_text(json.dumps(metrics,indent=2)+'\n')
# Reuse exact lossless exports when their metadata still matches the selected recipe.
def cached_render(r):
 p=ROOT/'images'/f"{r['id']:03d}.png";j=ROOT/'json'/f"{r['id']:03d}.json"
 if p.exists() and j.exists() and json.loads(j.read_text())==metadata(r):
  from PIL import Image
  return Image.open(p).convert('RGBA')
 return render(r)
ns=vars(curate).copy();ns.update(c=config(),p=policy(),recipes=recipes,render=cached_render)
code=Path(curate.__file__).read_text();start=code.index(' # Immediate proof:');end=code.index("\nif __name__",start)
exec(textwrap.dedent(code[start:end]),ns)
print('Updated contrast:',changed,flush=True)

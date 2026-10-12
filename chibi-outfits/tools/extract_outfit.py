"""Turn a model render of the armless base into outfit layers registered to the
base pose frame (1254 x 1254):

  <stem>.png         goes between the base pose and the arms layer
  <stem>_front.png   parts that sit over the top of the arm (shoulder armor, armhole edges)

The render should be tools/masks/armless_base_green.png dressed by the image model. A flat
#00FF00 background is keyed out; if the model painted scenery instead, the figure is
separated along its outline automatically.

usage: python tools/extract_outfit.py <render.png> <outfit stem> [green|magenta]
   e.g. python tools/extract_outfit.py renders/render_004_clockwork_artisan.png \
            outfits/004_clockwork_artisan/outfit_004_clockwork_artisan
"""
import sys
from pathlib import Path

import numpy as np
import cv2
from PIL import Image
from skimage.morphology import remove_small_objects, remove_small_holes
from skimage.segmentation import watershed

sys.path.insert(0, str(Path(__file__).resolve().parent))
import kit  # noqa: E402

render_path, out_stem = sys.argv[1], sys.argv[2]
key = sys.argv[3] if len(sys.argv) > 3 else 'green'
Path(out_stem).parent.mkdir(parents=True, exist_ok=True)

poses = kit.bases()
armmasks = kit.arm_masks()
armfull = kit.armfull_pose1()
base = poses[0]
H, W = base.shape[:2]
bal = base[..., 3]
keep = cv2.GaussianBlur((~armfull).astype(np.float32), (0, 0), 0.7)
armless_alpha = bal * np.minimum(keep, 1.0)
bg_col = np.array([0.0, 1.0, 0.0]) if key == 'green' else np.array([1.0, 0.0, 1.0])
armless = base[..., :3] * armless_alpha[..., None] + bg_col * (1 - armless_alpha[..., None])

# ---------------- register the render to the base frame (head = anchor) ----------------
r = np.array(Image.open(render_path).convert('RGB')).astype(np.float32) / 255
r = cv2.resize(r, (W, H), interpolation=cv2.INTER_AREA if r.shape[0] > H else cv2.INTER_CUBIC)

def gray(x):
    return cv2.cvtColor((np.clip(x, 0, 1) * 255).astype(np.uint8), cv2.COLOR_RGB2GRAY).astype(np.float32) / 255

jaw = np.array([(430, 0), (830, 0), (830, 455), (699, 461), (691, 464), (682, 467), (670, 470),
                (659, 473), (644, 476), (628, 478), (612, 476), (597, 473), (584, 470), (573, 467),
                (564, 464), (555, 461), (430, 455)], np.int32)
head_zone = np.zeros((H, W), np.uint8); cv2.fillPoly(head_zone, [jaw], 1)
head_alpha = bal * head_zone                      # opaque head pixels (incl. AA edge)
head_sil = head_alpha > 0.3

# anchor on the head silhouette only, so a painted background can't pull the fit
anchor = cv2.erode(head_sil.astype(np.uint8), np.ones((9, 9), np.uint8))
warp = np.eye(2, 3, dtype=np.float32)
cc, warp = cv2.findTransformECC(gray(base[..., :3] * bal[..., None]), gray(r), warp, cv2.MOTION_AFFINE,
                                (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 500, 1e-7), anchor, 5)
reg = np.clip(cv2.warpAffine(r, warp, (W, H), flags=cv2.INTER_LANCZOS4 | cv2.WARP_INVERSE_MAP,
                             borderMode=cv2.BORDER_REPLICATE), 0, 1)
pts = np.array([[470, 300], [790, 300], [628, 145], [628, 460]], np.float32)
shift = np.abs((warp[:, :2] @ pts.T).T + warp[:, 2] - pts).max()

# ---------------- chroma key, despill, unmix ----------------
R, G, B = reg[..., 0], reg[..., 1], reg[..., 2]
spill = (G - np.maximum(R, B)) if key == 'green' else (np.minimum(R, B) - G)
alpha = np.clip((0.85 - spill) / 0.7, 0, 1)
fg = reg.copy()
if key == 'green':
    fg[..., 1] = np.minimum(G, np.maximum(R, B) + 0.02)
else:
    cap = G + 0.02
    fg[..., 0] = np.minimum(R, np.maximum(cap, R - (1 - alpha) * (R - cap)))
    fg[..., 2] = np.minimum(B, np.maximum(cap, B - (1 - alpha) * (B - cap)))
fg = np.clip(fg, 0, 1)

# ---------------- painted-background fallback ----------------
# If the model painted scenery instead of keeping the flat key colour, separate the
# figure by flooding the background up to the figure's dark outline.
from scipy import ndimage as ndi
body = armless_alpha > 0.5
dist_body = cv2.distanceTransform((~(body | head_sil)).astype(np.uint8), cv2.DIST_L2, 5)
keyed = spill > 0.25
far = dist_body >= 230
scene_mode = keyed[far].mean() < 0.9
if scene_mode:
    Lc = cv2.cvtColor(reg.astype(np.float32), cv2.COLOR_RGB2LAB)[..., 0]
    gm = np.hypot(cv2.Sobel(Lc, cv2.CV_32F, 1, 0, ksize=3), cv2.Sobel(Lc, cv2.CV_32F, 0, 1, ksize=3))
    barrier = cv2.dilate(((Lc < 18) | (gm > 110)).astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
    seeds = keyed | far
    seeds[0, :] = seeds[-1, :] = True; seeds[:, 0] = seeds[:, -1] = True
    passable = ~barrier | seeds
    lab_, _ = ndi.label(passable)
    bgl = np.unique(lab_[seeds & passable]); bgl = bgl[bgl > 0]
    fig = ~np.isin(lab_, bgl) & ~head_sil
    # any non-background piece overlapping the base body is figure (incl. the neck pocket
    # enclosed by the jaw and collar outlines)
    core = cv2.erode((body & ~head_sil).astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
    lab2, _ = ndi.label(fig)
    kl = np.unique(lab2[core]); kl = kl[kl > 0]
    fig = ndi.binary_fill_holes(np.isin(lab2, kl))
    # the barrier dilation added 1 px of scenery outside the outline: trim it there
    scen_bg = ~fig & ~keyed
    near_scen = cv2.dilate(scen_bg.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
    fig_e = cv2.erode(fig.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
    m = np.where(near_scen, fig_e, fig).astype(np.float32)
    m = np.clip(cv2.GaussianBlur(m, (0, 0), 0.7) * 1.2, 0, 1)
    alpha = alpha * m

# ---------------- base regions ----------------
neck_skin = np.zeros((H, W), np.uint8)
cv2.fillPoly(neck_skin, [np.array([(584, 466), (672, 466), (670, 494), (652, 512), (628, 520),
                                   (604, 512), (586, 494)], np.int32)], 1)
neck_skin = neck_skin.astype(bool) & body & ~head_sil
legs_skin = body.copy(); legs_skin[:888] = False
skin = neck_skin | legs_skin

diff = np.abs(cv2.GaussianBlur(reg, (0, 0), 1.5) - cv2.GaussianBlur(base[..., :3], (0, 0), 1.5)).max(-1)
changed = (diff > 0.10) & skin
changed = cv2.morphologyEx(changed.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
changed = cv2.morphologyEx(changed, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))) > 0
changed = remove_small_objects(changed, 150)

# skin-like render pixels hugging the head silhouette are head drift, not outfit
lab = cv2.cvtColor(fg.astype(np.float32), cv2.COLOR_RGB2LAB)
skin_lab = np.array([84.0, 12.0, 22.0])
skinlike = np.linalg.norm(lab - skin_lab, axis=-1) < 14
near_head = (cv2.dilate(head_sil.astype(np.uint8), np.ones((9, 9), np.uint8)) > 0) & ~head_sil

char = alpha > 0.5
outfit = char & ~head_sil & ~(skin & ~changed) & ~(near_head & skinlike)
outfit = remove_small_objects(outfit, 120)
outfit = remove_small_holes(outfit, 300)

# ---------------- cover base pixels the model removed (e.g. toes outside narrow boots) --------
body_union = np.zeros((H, W), bool)
for i, p in enumerate(poses):
    arm_i = (armmasks[i] > 0.02) | (armfull if i == 0 else armfull & (np.arange(H)[:, None] < 560))
    body_union |= (p[..., 3] > 0.3) & ~arm_i
body_union &= ~head_sil
# bare shoulders/upper arms (outside the tank-top straps) are meant to show: never force-cover them
yy, xx = np.mgrid[0:H, 0:W]
shoulder_skin = (yy < 680) & ((xx <= 538) | (xx >= 717))
neck_poly = np.zeros((H, W), np.uint8)
cv2.fillPoly(neck_poly, [np.array([(584, 466), (672, 466), (670, 494), (652, 512), (628, 520),
                                   (604, 512), (586, 494)], np.int32)], 1)
jaw_zone = cv2.dilate(head_sil.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))) > 0
removed = (body_union & ~outfit & ~(skin & ~changed & char) & ~shoulder_skin
           & ~neck_poly.astype(bool) & ~jaw_zone)
dist = cv2.distanceTransform((~outfit).astype(np.uint8), cv2.DIST_L2, 5)
cover = removed & (dist <= 14)
cover = cv2.dilate(cover.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
cover &= ~outfit & ~head_sil
filled = fg.copy()
if cover.any():
    from scipy.ndimage import distance_transform_edt
    core = cv2.erode(outfit.astype(np.uint8), np.ones((9, 9), np.uint8)) > 0   # skip the outline
    _, (iy, ix) = distance_transform_edt(~core, return_indices=True)
    near = cv2.GaussianBlur(fg[iy, ix], (0, 0), 1.5)
    filled[cover] = near[cover]
    # redraw an outline along the new outer edge so the extension reads as part of the piece
    newmask = (outfit | cover).astype(np.uint8)
    rim = (newmask - cv2.erode(newmask, np.ones((5, 5), np.uint8))) > 0
    rim &= cover
    filled[rim] = near[rim] * 0.28
uncovered_far = int((removed & (dist > 14)).sum())

mask = outfit | cover
soft = np.clip(cv2.GaussianBlur(mask.astype(np.float32), (0, 0), 0.8) * 1.6, 0, 1)
a_out = np.where(cover, 1.0, alpha) * soft
a_out *= (1 - head_alpha)                                # outfit sits behind the head edge
# Along the chin, where the collar meets the head's soft edge, use the render's own
# jaw-to-collar pixels so no background leaks through the head's anti-aliasing.
jaw_aa = (head_alpha > 0.02) & (head_alpha < 0.98) & (yy > 440)
collar_near = cv2.dilate((mask & (a_out > 0.5)).astype(np.uint8),
                         cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))) > 0
seam = jaw_aa & collar_near & (alpha > 0.5)
a_out[seam] = 1.0
filled[seam] = reg[seam]
a_out = np.clip(a_out, 0, 1)

# ---------------- split shoulder pieces into a front layer ----------------
zone = np.zeros((H, W), bool)
for i in range(5):
    zone |= armmasks[i] > 0.02
zone |= armfull
zone[:480] = False; zone[650:] = False
zone = cv2.dilate(zone.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
zo = zone & (a_out > 0.5)
front = np.zeros((H, W), bool)
armhole_sides = []
if zo.any():
    elev = cv2.GaussianBlur(1 - lab[..., 0] / 100.0, (0, 0), 0.8)
    mk = np.zeros((H, W), np.int32)
    top = zo.copy(); top[522:] = False
    bot = zo.copy(); bot[:618] = False
    mk[top] = 1; mk[bot] = 2
    if top.any():
        ws = watershed(elev, markers=mk, mask=zo)
        front = remove_small_objects(ws == 1, 60)
        # Keep a front piece only where a drawn outline separates it from what hangs below
        # (a pauldron). If the split runs through plain fabric, the piece is continuous
        # (a coat's side panel) and belongs behind the arm.
        Lf = lab[..., 0].astype(np.float32)
        # black-hat: thin lines darker than their surroundings (outlines), not flat dark fabric
        bh = cv2.morphologyEx(Lf, cv2.MORPH_BLACKHAT, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
        bh = cv2.dilate(bh, np.ones((3, 3), np.uint8))
        # only the piece's lower edge matters: front pixels with 'behind' pixels just below them
        behind = ws == 2
        below = np.zeros_like(behind)
        for k in (1, 2, 3):
            below[:-k] |= behind[k:]
        b1 = front & below
        for side in (xx < W // 2, xx >= W // 2):
            bs = b1 & side
            if bs.sum() < 5:
                continue
            dark_frac = float((bh[bs] > 10).mean())
            print(f'  front split {"left " if side[0, 0] else "right"}: boundary px {int(bs.sum())}, '
                  f'outlined {dark_frac:.2f} -> {"keep" if dark_frac >= 0.6 else "drop"}')
            if dark_frac < 0.6:
                # continuous fabric: coat sits over the top of the arm down a curved armhole
                # line (shoulder point -> armpit); below it the arm passes in front.
                left = bool(side[0, 0])
                x0, x1 = (513.0, 542.0) if left else (743.0, 714.0)
                t = np.clip((yy - 538) / 78.0, 0, 1) ** 2
                xc = x0 + (x1 - x0) * t
                inside = (xx > xc) if left else (xx < xc)
                over_arm = (yy < 538) | ((yy <= 616) & inside)
                front = (front & ~side) | (zo & side & over_arm)
                armhole_sides.append(side)
front = remove_small_objects(front, 30)
front_rgb = filled.copy()
if armhole_sides:
    # where the armhole line cuts through fabric, draw an outline so it reads as a hem
    Lf = lab[..., 0].astype(np.float32)
    bh = cv2.dilate(cv2.morphologyEx(Lf, cv2.MORPH_BLACKHAT,
                                     cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))),
                    np.ones((3, 3), np.uint8))
    # only where an arm will actually be visible next to the cut (any pose), not where the
    # front piece just meets the same fabric underneath
    arm_any = np.zeros((H, W), np.uint8)
    for m_ in armmasks:
        arm_any |= (m_ > 0.5).astype(np.uint8)
    arm_any = cv2.erode(arm_any, np.ones((5, 5), np.uint8)) > 0
    behind_fabric = (a_out > 0.5) & ~front & arm_any
    edge = front & (cv2.dilate(behind_fabric.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0)
    edge = cv2.dilate(edge.astype(np.uint8), np.ones((2, 2), np.uint8)) > 0
    edge &= front & (bh < 10)
    sel = np.zeros((H, W), bool)
    for s in armhole_sides:
        sel |= s
    edge &= sel
    front_rgb[edge] = front_rgb[edge] * 0.28
f_soft = cv2.GaussianBlur(front.astype(np.float32), (0, 0), 0.7)
a_front = a_out * np.clip(f_soft * 1.3, 0, 1)

kit.save_rgba(filled, a_out, f'{out_stem}.png')
kit.save_rgba(front_rgb, a_front, f'{out_stem}_front.png')
print(f'scene_mode={scene_mode}  ECC cc={cc:.4f}  head shift {shift:.1f}px  outfit px {int((a_out > 0.5).sum())}  '
      f'covered {int(cover.sum())}px  front px {int((a_front > 0.5).sum())}  '
      f'base px left uncovered far from outfit {uncovered_far}')

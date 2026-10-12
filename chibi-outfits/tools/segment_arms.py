"""One-time step: cut the forearms/hands out of each aligned base pose.

Writes
  tools/masks/armmask_0N.png      per-pose arm mask (feathered from the armpit line, y=540..562)
  tools/masks/armfull_pose1.png   pose 1's whole arm incl. shoulder cap
  tools/masks/armless_base_green.png   pose 1 with no arms, on #00FF00 (the image the model dresses)
  arms/arms_00N_*.png             the arms layers (base pixels x arm mask)

The marker coordinates below were placed by hand for these five bases; rerun only if
the bases change.   usage: python tools/segment_arms.py
"""
import sys
from pathlib import Path

import cv2
import numpy as np
from skimage.morphology import remove_small_holes
from skimage.segmentation import watershed

sys.path.insert(0, str(Path(__file__).resolve().parent))
import kit  # noqa: E402

ARM_NAMES = ['arms_001_neutral', 'arms_002_viewer_left_vertical_grip',
             'arms_003_viewer_right_vertical_grip', 'arms_004_viewer_left_palm_up',
             'arms_005_centered_two_hand_grip']
TOP, FEATHER = 540, 22       # arm layer starts at the armpit line, feathered over 22 px


def disk(lbl, pts, r, v):
    for (x, y) in pts:
        cv2.circle(lbl, (int(x), int(y)), r, v, -1)


def line(lbl, p, q, v, t=5):
    cv2.line(lbl, (int(p[0]), int(p[1])), (int(q[0]), int(q[1])), v, t)


def elevation(a):
    lab = cv2.cvtColor(a[..., :3].astype(np.float32), cv2.COLOR_RGB2LAB)
    return cv2.GaussianBlur(1 - lab[..., 0] / 100.0, (0, 0), 0.8)


def segment(i, a):
    H, W = a.shape[:2]
    al = a[..., 3]
    m = np.zeros((H, W), np.int32)
    opaque = al > 0.5
    hn = opaque.copy(); hn[515:] = False; m[hn] = 1    # head / neck
    lg = opaque.copy(); lg[:885] = False; m[lg] = 1    # legs / feet
    if i < 4:
        cv2.rectangle(m, (575, 545), (680, 690), 1, -1)        # torso, inside the clothing
        cv2.rectangle(m, (532, 700), (723, 875), 1, -1)        # shorts
        cv2.fillPoly(m, [np.array([(495, 548), (530, 548), (536, 628), (486, 628)], np.int32)], 2)
        cv2.fillPoly(m, [np.array([(726, 548), (762, 548), (770, 628), (720, 628)], np.int32)], 2)
        sub = opaque.copy(); sub[:628] = False                 # forearms/hands below y=628
        _, lb = cv2.connectedComponents(sub.astype(np.uint8), 8)
        body = lb[700, 628]
        arms_ = (lb > 0) & (lb != body)
        m[cv2.erode(arms_.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0] = 2
    else:                                                       # pose 5: hands in front of the body
        cv2.fillPoly(m, [np.array([(572, 545), (683, 545), (683, 640), (660, 690), (600, 690), (572, 655)],
                                  np.int32)], 1)
        disk(m, [(535, 790), (550, 830), (570, 860), (585, 800), (560, 775), (590, 860),
                 (720, 790), (705, 830), (680, 860), (678, 805), (695, 770), (665, 860), (628, 850)], 6, 1)
        cv2.fillPoly(m, [np.array([(496, 540), (538, 540), (542, 640), (500, 650)], np.int32)], 2)
        cv2.fillPoly(m, [np.array([(716, 540), (760, 540), (760, 645), (714, 640)], np.int32)], 2)
        line(m, (606, 688), (650, 688), 1, 3)
        line(m, (601, 702), (652, 702), 1, 1)
        line(m, (535, 670), (585, 725), 2); line(m, (715, 680), (668, 735), 2)
        disk(m, [(625, 740), (630, 800)], 7, 2)
    ws = watershed(elevation(a), markers=m, mask=al > 0.02)
    arm = cv2.dilate((ws == 2).astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))) > 0
    arm &= al > 0.01
    arm = remove_small_holes(arm, 40)
    ramp = np.clip((np.arange(H) - TOP) / FEATHER, 0, 1)[:, None]
    alpha = cv2.GaussianBlur(arm.astype(np.float32) * ramp, (0, 0), 0.6)
    alpha *= arm | (cv2.dilate(arm.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0)
    return np.clip(alpha, 0, 1)


def full_arm_pose1(a, armmask):
    """Whole arm of pose 1 including the shoulder cap (no feather)."""
    H, W = a.shape[:2]
    al = a[..., 3]
    m = np.zeros((H, W), np.int32)
    op = al > 0.5
    hn = op.copy(); hn[490:] = False; m[hn] = 1
    cv2.fillPoly(m, [np.array([(556, 500), (698, 500), (698, 690), (556, 690)], np.int32)], 1)
    cv2.rectangle(m, (532, 700), (723, 875), 1, -1)
    lg = op.copy(); lg[:885] = False; m[lg] = 1
    cv2.fillPoly(m, [np.array([(530, 520), (540, 518), (540, 620), (492, 620), (503, 560)], np.int32)], 2)
    cv2.fillPoly(m, [np.array([(716, 518), (726, 520), (752, 560), (764, 620), (716, 620)], np.int32)], 2)
    m[cv2.erode((armmask > 0.5).astype(np.uint8), np.ones((5, 5), np.uint8)) > 0] = 2
    ws = watershed(elevation(a), markers=m, mask=al > 0.02)
    arm = cv2.dilate((ws == 2).astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))) > 0
    return arm & (al > 0.01)


def main():
    kit.MASKS.mkdir(parents=True, exist_ok=True)
    B = kit.bases()
    masks = []
    for i, a in enumerate(B):
        alpha = segment(i, a)
        masks.append(alpha)
        kit.save_gray(alpha, kit.MASKS / f'armmask_{i + 1:02d}.png')
        kit.save_rgba(a[..., :3], a[..., 3] * alpha, kit.ARMS / f'{ARM_NAMES[i]}.png')
        print(f'pose {i + 1}: arm px {int((alpha > 0.5).sum())}')
    full = full_arm_pose1(B[0], masks[0])
    kit.save_gray(full.astype(np.float32), kit.MASKS / 'armfull_pose1.png')
    keep = cv2.GaussianBlur((~full).astype(np.float32), (0, 0), 0.7)
    a_less = B[0][..., 3] * np.minimum(keep, 1.0)
    green = np.array([0.0, 1.0, 0.0])
    rgb = B[0][..., :3] * a_less[..., None] + green * (1 - a_less[..., None])
    from PIL import Image
    Image.fromarray(np.round(np.clip(rgb, 0, 1) * 255).astype(np.uint8), 'RGB').save(
        kit.MASKS / 'armless_base_green.png', optimize=True)
    print(f'pose 1 full arm px {int(full.sum())}')


if __name__ == '__main__':
    main()

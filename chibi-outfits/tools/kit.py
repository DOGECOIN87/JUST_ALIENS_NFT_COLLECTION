"""Shared paths and loaders for the chibi outfit kit.

Everything is 1254 x 1254 RGBA in one coordinate frame (pose 1 is the reference).
"""
from pathlib import Path

import numpy as np
from PIL import Image

KIT = Path(__file__).resolve().parent.parent
BASES = KIT / 'bases'
ARMS = KIT / 'arms'
MASKS = KIT / 'tools' / 'masks'
OUTFITS = KIT / 'outfits'

POSE_NAMES = ['pose 1 - neutral', 'pose 2 - left grip', 'pose 3 - right grip',
              'pose 4 - left palm up', 'pose 5 - two-hand grip']


def load_rgba(path):
    return np.array(Image.open(path).convert('RGBA')).astype(np.float32) / 255


def load_gray(path):
    return np.array(Image.open(path).convert('L')).astype(np.float32) / 255


def save_rgba(rgb, alpha, path):
    img = np.round(np.dstack([np.clip(rgb, 0, 1), np.clip(alpha, 0, 1)]) * 255).astype(np.uint8)
    img[..., :3][img[..., 3] == 0] = 0
    Image.fromarray(img, 'RGBA').save(path, optimize=True)


def save_gray(arr, path):
    Image.fromarray(np.round(np.clip(arr, 0, 1) * 255).astype(np.uint8), 'L').save(path, optimize=True)


def bases():
    """The five aligned base poses, in pose order."""
    return [load_rgba(p) for p in sorted(BASES.glob('*.png'))]


def arms():
    """The five arms layers, in pose order (same order as bases())."""
    return [load_rgba(p) for p in sorted(ARMS.glob('*.png'))]


def arm_masks():
    """Per-pose forearm/hand masks (0..1), feathered from the armpit line down."""
    return [load_gray(MASKS / f'armmask_{i:02d}.png') for i in range(1, 6)]


def armfull_pose1():
    """Pose 1's whole arm including the shoulder cap (used to build the armless base)."""
    return load_gray(MASKS / 'armfull_pose1.png') > 0.5


def outfit_layers(stem):
    """(outfit, front) RGBA layers for an outfit stem such as
    outfits/004_clockwork_artisan/outfit_004_clockwork_artisan"""
    stem = Path(stem)
    return load_rgba(f'{stem}.png'), load_rgba(f'{stem}_front.png')


def over(dst, src):
    a = src[..., 3:4]
    return dst * (1 - a) + src[..., :3] * a


def composite(pose, outfit=None, front=None, bg=(0.90, 0.91, 0.94), base_list=None, arm_list=None):
    """Stack: background -> base pose -> outfit -> arms layer -> outfit front. Returns RGB float."""
    B = base_list if base_list is not None else bases()
    A = arm_list if arm_list is not None else arms()
    H, W = B[pose].shape[:2]
    img = np.ones((H, W, 3), np.float32) * np.array(bg, np.float32)
    img = over(img, B[pose])
    if outfit is not None:
        img = over(img, outfit)
    img = over(img, A[pose])
    if front is not None:
        img = over(img, front)
    return img

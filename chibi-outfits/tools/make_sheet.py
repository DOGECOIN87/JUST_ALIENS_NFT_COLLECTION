"""Contact sheet: every outfit in outfits/ on all five poses, one row per outfit,
styled like the 1/1 contact sheet (dark page, label above each tile).

usage: python tools/make_sheet.py [out.jpg]      (default: previews/contact_sheet_outfits.jpg)
"""
import colorsys
import re
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parent))
import kit  # noqa: E402

TILE = 480          # px per tile on the sheet
GAP = 6             # gap between tiles
LABEL_H = 26        # label band above each tile
MARGIN = 6
PAGE = (14, 12, 18)
CROP = (115, 1175, 98, 1158)   # y0, y1, x0, x1: square around the figure in the 1254 frame


def font(size, bold=False):
    name = 'DejaVuSans-Bold.ttf' if bold else 'DejaVuSans.ttf'
    try:
        return ImageFont.truetype(f'/usr/share/fonts/truetype/dejavu/{name}', size)
    except OSError:
        return ImageFont.load_default()


def outfit_list():
    items = []
    for d in sorted(kit.OUTFITS.iterdir()):
        stem = d / f'outfit_{d.name}'
        if Path(f'{stem}.png').exists():
            m = re.match(r'(\d+)_(.*)', d.name)
            num, name = (m.group(1), m.group(2)) if m else ('', d.name)
            items.append((num, name.replace('_', ' ').title(), stem))
    return items


def backdrop(outfit, H, W):
    """Soft radial backdrop tinted from the outfit's own dominant colour, with a floor shadow."""
    a = outfit[..., 3] > 0.8
    px = outfit[..., :3][a]
    lum = px.mean(-1)
    px = px[(lum > 0.12) & (lum < 0.85)]
    r, g, b = px.mean(0) if len(px) else (0.3, 0.3, 0.35)
    h, s, _ = colorsys.rgb_to_hsv(r, g, b)
    s = min(max(s, 0.35), 0.7)
    inner = np.array(colorsys.hsv_to_rgb(h, s * 0.85, 0.36))
    outer = np.array(colorsys.hsv_to_rgb(h, s, 0.08))
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    d = np.sqrt(((xx - W * 0.5) / (W * 0.55)) ** 2 + ((yy - H * 0.47) / (H * 0.62)) ** 2)
    t = np.clip(d, 0, 1)[..., None] ** 1.4
    bg = inner * (1 - t) + outer * t
    shadow = np.zeros((H, W), np.float32)
    cv2.ellipse(shadow, (W // 2, 1138), (150, 22), 0, 0, 360, 1.0, -1)
    shadow = cv2.GaussianBlur(shadow, (0, 0), 14)[..., None]
    return bg * (1 - 0.55 * shadow)


def main():
    out_path = Path(sys.argv[1]) if len(sys.argv) > 1 else kit.KIT / 'previews' / 'contact_sheet_outfits.jpg'
    B, A = kit.bases(), kit.arms()
    H, W = B[0].shape[:2]
    items = outfit_list()
    cols, rows = 5, len(items)
    sw = MARGIN * 2 + cols * TILE + (cols - 1) * GAP
    sh = MARGIN * 2 + rows * (LABEL_H + TILE) + (rows - 1) * GAP
    sheet = Image.new('RGB', (sw, sh), PAGE)
    d = ImageDraw.Draw(sheet)
    f_num, f_name = font(15, True), font(15)
    y0, y1, x0, x1 = CROP
    for r, (num, name, stem) in enumerate(items):
        O, F = kit.outfit_layers(stem)
        bg = backdrop(O, H, W)
        for c in range(cols):
            img = bg.copy()
            img = kit.over(img, B[c]); img = kit.over(img, O)
            img = kit.over(img, A[c]); img = kit.over(img, F)
            tile = Image.fromarray((np.clip(img[y0:y1, x0:x1], 0, 1) * 255).astype(np.uint8))
            tile = tile.resize((TILE, TILE), Image.LANCZOS)
            x = MARGIN + c * (TILE + GAP)
            y = MARGIN + r * (LABEL_H + TILE + GAP)
            d.text((x + 2, y + 5), num, font=f_num, fill=(235, 235, 240))
            nx = x + 2 + d.textlength(num + '  ', font=f_num)
            d.text((nx, y + 5), f'{name}  ·  pose {c + 1}', font=f_name, fill=(200, 200, 210))
            sheet.paste(tile, (x, y + LABEL_H))
    out_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out_path, quality=93, subsampling=0, optimize=True)
    print(out_path, sheet.size, f'{rows} outfits x {cols} poses')


if __name__ == '__main__':
    main()

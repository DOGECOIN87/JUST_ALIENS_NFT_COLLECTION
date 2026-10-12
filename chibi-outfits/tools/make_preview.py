"""Preview strip for one outfit: the outfit layers alone, then the outfit on all five poses.

usage: python tools/make_preview.py <outfit stem> "<title>" <out.png>
   e.g. python tools/make_preview.py outfits/004_clockwork_artisan/outfit_004_clockwork_artisan \
            "Outfit: sleeveless Clockwork Artisan (from 1/1 #004)" previews/preview_004_clockwork_artisan.png
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parent))
import kit  # noqa: E402


def font(size, bold=False):
    name = 'DejaVuSans-Bold.ttf' if bold else 'DejaVuSans.ttf'
    try:
        return ImageFont.truetype(f'/usr/share/fonts/truetype/dejavu/{name}', size)
    except OSError:
        return ImageFont.load_default()


def main():
    stem, title, out_path = sys.argv[1], sys.argv[2], sys.argv[3]
    O, F = kit.outfit_layers(stem)
    B, A = kit.bases(), kit.arms()
    H, W = O.shape[:2]
    chk = np.repeat(((np.indices((H, W)).sum(0) // 20) % 2)[..., None] * 0.06 + 0.86, 3, -1)
    tiles = [kit.over(kit.over(chk, O), F)]
    tiles += [kit.composite(i, O, F, base_list=B, arm_list=A) for i in range(5)]
    crop = (slice(120, 1170), slice(290, 965))
    tiles = [t[crop] for t in tiles]
    sc = 0.36
    th, tw = tiles[0].shape[:2]
    tw2, th2 = int(tw * sc), int(th * sc)
    pad, top = 16, 54
    canvas = Image.new('RGB', (pad + (tw2 + pad) * 6, top + th2 + 40), (255, 255, 255))
    d = ImageDraw.Draw(canvas)
    d.text((pad, 16), title, font=font(20, True), fill=(20, 20, 20))
    labels = ['outfit layers only', 'pose 1', 'pose 2', 'pose 3', 'pose 4', 'pose 5']
    for i, (t, label) in enumerate(zip(tiles, labels)):
        im = Image.fromarray((np.clip(t, 0, 1) * 255).astype(np.uint8)).resize((tw2, th2), Image.LANCZOS)
        x = pad + i * (tw2 + pad)
        canvas.paste(im, (x, top))
        d.text((x, top + th2 + 8), label, font=font(15), fill=(70, 70, 70))
    canvas.save(out_path, optimize=True)
    print(out_path, canvas.size)


if __name__ == '__main__':
    main()

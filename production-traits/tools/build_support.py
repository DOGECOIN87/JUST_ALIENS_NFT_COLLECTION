#!/usr/bin/env python3
"""Rebuild approved character/clothing/background canvases without art changes."""
import hashlib
import json
from pathlib import Path
from PIL import Image
from build_layers import ROOT, save_png


def main():
    records = json.loads((ROOT / 'support-source-map.json').read_text())
    for record in records:
        source = ROOT / record['original']
        assert hashlib.sha256(source.read_bytes()).hexdigest() == record['source_sha256']
        image = Image.open(source).convert('RGBA')
        image = image.resize((1254, 1254), Image.Resampling.LANCZOS)
        target = ROOT / record['production']
        target.parent.mkdir(parents=True, exist_ok=True)
        save_png(image, target)
    print(f'Rebuilt {len(records)} approved support canvases; no filters or recoloring.')


if __name__ == '__main__':
    main()

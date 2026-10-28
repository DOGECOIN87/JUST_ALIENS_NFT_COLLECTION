# Enhanced Backgrounds — Just Aliens

This folder contains 26 backgrounds composited from `Assets/Background/` and six pre-existing enhanced images. The collection generator reads both background folders. The people backgrounds now use a black-and-white pencil-and-ink treatment; see [the before/after review](../../docs/people-backgrounds/README.md).

## Applied settings

- Texture: the supplied `Assets/halftone_grayscale.png`, resized to the source canvas.
- Texture layer: **30% opacity**, normal alpha compositing (not the Overlay blend mode).
- Vignette: a smooth black edge fade reaching **45% opacity at the corners**; the center stays clear.
- New files: lossless **960 × 960 RGBA PNG**, preserving source dimensions, composition, and alpha.

## Existing images take priority

These existing enhanced counterparts are retained instead of creating duplicates:

| Source background | Retained enhanced file |
| --- | --- |
| `Spheres.png` | `goats_contest_mattrick (17).png` |
| `Cubes.png` | `goats_contest_mattrick (18).png` |
| `Pyramids.png` | `goats_contest_mattrick (19).png` |

The portrait backgrounds `(20)`, `(21)`, and `(22)` retain their filenames, original dimensions, and alpha channels. Their black-and-white drawn versions use the supplied halftone at 30% opacity and the smooth corner vignette reaching 45%. The original color images are preserved in Git history at the commit recorded in `Assets/people-backgrounds-manifest.json`.

## Reproduce or add new backgrounds

With the repository's `sharp` dependency installed, run:

```sh
node scripts/enhance-backgrounds.cjs
```

The script skips existing filenames and the mapped counterparts above before generating anything. It never overwrites an existing image. `enhancement-manifest.json` records source/output hashes, settings, and which images were preserved.

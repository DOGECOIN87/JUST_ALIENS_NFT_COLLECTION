# Enhanced Backgrounds — Just Aliens

This folder contains 26 backgrounds composited from `Assets/Background/` and six pre-existing enhanced images. The source backgrounds and all six existing enhanced files remain unchanged. These files are not automatically wired into the collection generator.

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

The existing portrait backgrounds `(20)`, `(21)`, and `(22)` are also retained byte-for-byte, with their original dimensions.

## Reproduce or add new backgrounds

With the repository's `sharp` dependency installed, run:

```sh
node scripts/enhance-backgrounds.cjs
```

The script skips existing filenames and the mapped counterparts above before generating anything. It never overwrites an existing image. `enhancement-manifest.json` records source/output hashes, settings, and which images were preserved.

# Headwear overlays

This folder contains 19 remaining original visual reference PNGs and 82 aligned additions. Overlays use a transparent 1254 × 1254 RGBA canvas. The user rejected original items 10 and 16; those files are removed. The Angry expression has a reviewed override for the camo bucket hat (13).

The 87 source images are preserved byte for byte in [Headwear-notprocessedyet](../../Headwear-notprocessedyet). Five unsuitable traits are excluded from the active additions and remain there for artwork rework.

## Placement

The existing overlays in this folder are the visual reference. Match the part that sits on the head: forehead band for caps, crown seating line for brimmed hats, and face opening for hoods and aviator caps. Hanging jewels, knots, and drapes are not reliable seating landmarks.

`alignment-manifest.json` records source, reference, scale, position, hashes, and review decision. Artwork is uniformly scaled and translated; colors, proportions, and designs are preserved. Per-trait corrections live in `scripts/headwear-fit-overrides.json`.

| Type | Reference numbers |
| --- | --- |
| Wraps / turbans | 6 |
| Bands / crowns | 7, 19 |
| Cylindrical caps | 8 |
| Bandanas | 9 |
| Hoods / veils | 12 |
| Bucket, top, and cowboy hats | 13, 14, 15 |
| Backwards caps | 26 (replacement reference after item 16 was rejected) |
| Aviator caps | 17 |
| Helmets | 21 |
| Baseball caps / knit caps | 26 |

The PNGs fit the canonical Amused head. The supplied renderer applies a small uniform scale and translation for each of the other eight expressions, using skull width and a forehead anchor. Use it when mixing expressions; do not trim and independently stretch the head or headwear.

`scripts/headwear-review.json` records the annotated user review. Rejected source items and the nine fitted beanie variants are removed from the active repository. The generator filters the rejection list even if a deleted file is accidentally restored. Reviewed helmet fits are retained per expression, and helmets always have a Spacesuit torso. The existing bronze hood is held out of generation because its opening obstructs the face.

Composite whole canvases at 1254 × 1254: background → clothing → colored expression head → headwear. Avoid clothing that already includes a raised hood or another hat. The optional aligned generator mode applies those exclusions.

## Traits held for rework

| Trait | Reason |
| --- | --- |
| cultural-13 | Shell-band side drapes overlap the eyes; they need a separate rear layer. |
| cultural-18 | The red hood opening tapers across the outer eyes. |
| cultural-37 | Headphone ear cups obscure the eyes; rear/front layer separation is needed. |
| cultural-38 | The black/gold hood opening tapers across the outer eyes. |
| cultural-45 | Inner black drapes obstruct the outer eyes on the Happy expression. |

These IDs are under `held`, never under `assets`, and are not selected by `--headwear-aligned`. Their source artwork has not been deleted.

## Reproduce and review

```sh
npm run align-headwear
npm run headwear-sheets
node scripts/headwear-alignment-sheets.cjs --review
QA_EXPRESSION=Happy node scripts/headwear-alignment-sheets.cjs --review
node generate_collection.js --headwear-aligned --limit 50 --out collection-aligned
```

The paired sheets in [headwear-alignment-preview](../../headwear-alignment-preview) use the same 50 background, clothing, skin, and expression combinations. Before uses original source placement; after uses the corrected overlay and expression registration. Excluded samples are labeled `EXCLUDED` and shown without that trait. `samples.json` records both sides and their hashes.

JPEG previews are committed; the script also writes full PNG sheets locally. The default generator and legacy `--headwear-fitted` mode remain available. Use `--headwear-aligned` for this reviewed set, and choose only one headwear mode at a time.

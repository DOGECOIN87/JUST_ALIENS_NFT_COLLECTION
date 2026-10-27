# JUST ALIENS — verified production traits v2

This kit supplies 24 headwear designs, fitted individually to the approved JUST ALIENS character, with nine expression-specific front/rear pairs per design. Every production PNG uses a shared 1254 × 1254 RGBA canvas. Source masters are separate from the registered layers.

Twenty designs received artwork reconstruction. Sundown Boater, Acid Rain, Deepwater Sailor, and First Contact retain their source artwork with individual registration, alpha cleanup, and coordinated depth layers. See `CHANGELOG.md` for each design.

## Render the supplied assets

Use Python 3.11 or newer. The reviewed environment used Python 3.12.14, Pillow 12.3.0, NumPy 2.3.5, and SciPy 1.17.0.

```bash
python3 -m pip install -r requirements.txt
python3 tools/compositor.py inspection/json/01.json recreated_01.png
python3 tools/verify.py --inspection inspection
```

The production ZIP contains `inspection/images/01.png` through `50.png`, matching `inspection/json/` metadata and `inspection/Inspection_50_Numbered.png`. The companion `Just_Aliens_Fit_Proofs_v2.zip` adds 24 native plus 24 thumbnail nine-expression proof sheets and the three edge boards in `inspection/proofs/`. Extract both ZIPs into the same parent folder; they share the `Just_Aliens_Production_v2/` root. This separates the downloads to stay below the file-size limit. Each native proof cell contains an exact 1254 × 900 crop of the rendered canvas with the complete hat, face, and upper shoulders. The 50 inspection images retain the complete 1254 × 1254 canvas.

To reproduce the inspection exports and sheets from the production layers:

```bash
python3 tools/generate_inspection.py --out inspection --count 50 --proofs
```

In the GitHub repository, the same renderer is integrated before the legacy generator loads its asset pools:

```bash
python3 -m pip install -r production-traits/requirements.txt
npm run inspect-production
npm run verify-production
# Equivalent direct entry:
node generate_collection.js --production-traits --limit 50 --proofs --out production-traits/inspection
```

The numbered inspection set is a deterministic QA sample, not a rarity distribution or mint allocation. It shows every design twice, plus additional Zero-G Audio and Skyline Crest samples, and covers all nine expressions, ten approved skins, ten approved outfits, and eighteen approved backgrounds. Generate a specific character by passing a recipe JSON to the compositor. A bare recipe has `headwear_id`, `expression`, `skin`, `outfit`, and `background` keys; the included metadata embeds its exact recipe at `render.recipe`.

## Registration and depth

The approved 960 × 960 character source canvas maps to 1254 × 1254 by scaling the entire canvas once by **209/160**, with **zero translation**. The character does not move, shrink, rotate, or change color between hat designs. The old archive's 960px-at-[147,294] placement is recorded as rejected in `registration.json`; it is not used.

`registration.json` records the measured head contours, crown, forehead, temples, eyes, mouth, clothing silhouettes, collar contact, and shoulder samples. The approved head source contains no separate neck; the garment collar provides the neck contact. `Reference/` supplies the registration preview.

The actual draw order is background → headwear rear → clothing → skin/expression → headwear front. `trait-manifest.json` resolves each expression directly to full-canvas PNGs; consumers must draw those files at (0,0) without additional transforms. `fit-parameters.json` and `generation-log.json` explain how the exports were constructed. Do not composite the unpositioned `Source_Masters/` files.

A front and rear pair is **one Headwear attribute**. The visor's open top, headphone arch, and gaps between separate crest blades deliberately expose the real character. Genuine dark fabric, leather, metal, and underside shadows remain opaque. Rear brim and cushion masks sit behind the character.

All nine expressions are supported. The renderer only accepts the approved allowlists in `render-config.json`; removed hooded jackets, space/astronaut helmets, rejected legacy headwear, and the Warzone background are absent from selection. Approved lowered hoodies remain approved outfits. Historical generator modes and historical provenance files are outside this kit's release scope.

## Originals and rebuilding

`Source_Masters/Originals/` preserves all 24 original headwear PNGs byte for byte. `Source_Masters/Character_Originals/` preserves the 118 approved expression, clothing, and background source PNGs used by this kit. SHA-256 identities and source paths are recorded in the manifest, `support-source-map.json`, and `source-inventory.csv`. `Provenance/Original_Pack/` retains the incoming fitted layers, alignment data, configuration, and previous reports for comparison. Those historical reports are not the current verification result.

Artwork edits are baked into `Source_Masters/Edited/`; the prompts are provenance, not a requirement to regenerate art. Rebuilding is deterministic from the included edited masters:

```bash
python3 tools/build_support.py
python3 tools/build_layers.py
python3 tools/generate_inspection.py --out inspection --count 50 --proofs
python3 tools/verify.py --inspection inspection
```

A layer rebuild preserves the release gate only when all exported front/rear hashes are unchanged. Changed art returns to `under_review`; explicit `--review` permits QA exports, and the verifier rejects a stale visual review. A new artwork change needs another visual review before release.

## Verification records

`VERIFICATION.md` is the short report. `verification.json` records all 216 automated fit checks and all 50 exact compositor comparisons. `visual-review.json` records the native/thumbnail review and binds it to the actual layer hashes. `inspection/proofs/fit-coverage.json` maps every design/expression to its proof sheet and cell. `PACKAGE_SHA256.json` in the release ZIP inventories the packaged files.

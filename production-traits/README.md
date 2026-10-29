# Just Aliens — curated 420

This set uses only the 18 unmarked headwear/skin/expression fits on the user's annotated V3 approval sheet. Approval does not extend to other heads or expressions. The 32 marked samples and their unapproved fits cannot be selected by this compositor. Eleven designs with no approved sample are absent from the production manifest and layer folders.

The exact head artwork, expression, skin, and fitted headwear are retained. Outfits, backgrounds and the original caption color variants are coordinated around those fixed heads. Source archives remain untouched; their hashes and the annotated approval evidence are recorded in `selection-policy.json` and `Provenance/`.

`recipes.json` is the frozen 420-piece selection. Every headwear/skin/expression/outfit/background tuple is unique before text is added. There are 210 captioned and 210 uncaptioned pieces. Six original text colors are used; White_Opaque is correctly described as Electric Cyan. The deep-blue variant is excluded for weak luminance. White outfits and spacesuits use the original solid-backed red or vermilion captions for readability. Lettering, source colors, skin and clothing have not been redrawn or recolored.

## Reproduce

Python 3 with Pillow and NumPy is sufficient to render the fixed plan. SciPy is used for the caption contrast checks and the development palette scoring script.

```sh
python3 -m pip install Pillow==12.3.0 numpy==2.3.5 scipy==1.17.0
python3 tools/export_collection.py
python3 tools/verify_collection.py
```

The exporter creates `images/001.png` through `images/420.png`, matching `json/` metadata, and numbered proof sheets built from those actual exports. All images are 1254×1254 lossless PNG. The production layers remain full-canvas transparent RGBA. Composite PNGs are opaque because each includes its approved background.

For a single recipe or exported metadata file:

```sh
python3 tools/compositor.py json/001.json output.png
```

The layer order is background, coordinated rear headwear, outfit, approved skin/expression, front headwear, optional caption. Front/rear pieces remain a single Headwear metadata attribute. Unsupported heads, expressions, outfits, backgrounds and text colors raise an error rather than falling back to random selections.

The proof sheet labels live outside the NFT images. `V3 NN` identifies the original approved sample; `#NNN` identifies the new collection token. Text/no-text choices do not create otherwise duplicate characters against the same background.

The metadata uses local image basenames. Hosting or mint infrastructure may replace those with final uploaded image URIs; no mint, deploy, pricing or chain configuration is changed by this art package.

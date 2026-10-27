# Just Aliens — 24 new headwear traits

Headwear/ contains 24 individual 1254 × 1254 transparent PNG masters, named with their design number and trait name. These are individual full-resolution generations from the two approved concept sheets.

Fitted/Front/ and Fitted/Back/ contain matching 1254 × 1254 render layers for the Chill baseline. Rear pieces for the ushanka and rain hat sit behind the head; headphones also sit behind the head. Use the same trait name for its front and back pieces. An empty headphone front layer is intentional.

Render order: background → clothing → headwear back → skin/expression → headwear front. Place the original 960 × 960 clothing and expression layers at [147, 294] on the 1254 × 1254 canvas. Character pixels retain their original dimensions and colors. The larger canvas provides space for tall silhouettes.

trait-manifest.json defines each asset and the translation to use for all nine expressions. metadata/ contains individual trait records. The Headwear value is the display name; the leading number is a stable asset identifier. Native masters are not pre-positioned layers.

The 50 inspection samples show every new trait twice, with extra checks for headphones and crest, all ten skins, all nine expressions and all eighteen approved backgrounds. Sample counts are for inspection, not collection rarity. The inspection set has separate images/ and json/ folders.

The 420-edition collection is preserved separately. generation-prompts.json records the built-in image-generation prompts. verification.json records transparency, fit and lossless export checks.

To reproduce an inspection sample with Node and sharp available, run:

```sh
node tools/render-trait.cjs /path/to/Just_Aliens_420_Curation_Project /path/to/json/01.json /path/to/output.webp
```

The project directory is the restored detail-repair-v1 curation project. The renderer reads the fitted layers and expression translations from trait-manifest.json.

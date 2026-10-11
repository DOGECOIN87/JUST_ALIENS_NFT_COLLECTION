# Expression-specific headwear

96 headwear assets × 9 expressions = 864 transparent PNG layers, all on a 1254 × 1254 canvas.

Folders are organized as `<Expression>/<american|cultural|supplied|original>/<asset-id>.png`. Use the folder matching the alien's expression. Scale the existing 960 × 960 head, background and clothing layers to 1254 × 1254 before compositing, then place the fitted headwear at (0, 0). All ten skin colors share the same expression geometry.

`sheets/` contains a labeled comparison sheet of all 96 items for each expression. `manifest.json` records source artwork, measured head geometry and the placement of every fitted layer. The source PNGs remain unchanged.

Rebuild fitted layers and sheets:

```sh
node scripts/fit-headwear.cjs
```

Generate a preview collection with expression-specific headwear:

```sh
node generate_collection.js --headwear-fitted --limit 50 --out fitted-preview --sheet fitted-preview.jpg
```

This option adds a separate Headwear trait above the matching head and excludes the four existing headwear items from the Clothing pool to avoid stacking two headwear layers. Rare and Secret Rare pieces retain their existing artwork.

The fitting uses measured crown position, skull width and height, plus category-specific contact points. Caps and wraps cover the crown, wide brims extend beyond the skull, and hoods and helmets use their face openings. The supplied pieces use their larger preview fit as the reference. Artwork is scaled and positioned without redrawing it.

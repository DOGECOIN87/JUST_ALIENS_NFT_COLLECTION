# Chibi outfit kit

Layered assets for the bald chibi base character: five base poses that differ only in
the forearms and hands, plus sleeveless outfits that fit all five poses from a single layer.

All images are 1254 x 1254 RGBA and share one coordinate frame (pose 1 is the reference).

## Layer order (bottom to top)

| # | Layer | Folder |
|---|-------|--------|
| 1 | Background | — |
| 2 | Base pose (pick 1 of 5) | `bases/` |
| 3 | Outfit | `outfits/<name>/outfit_<name>.png` |
| 4 | Arms layer — **must match the pose picked in step 2** | `arms/` |
| 5 | Outfit front (parts over the top of the arm: shoulder armor, armhole edges) | `outfits/<name>/outfit_<name>_front.png` |
| 6 | Hair / headwear / face items | — |

Pose → arms pairing:

| Base pose | Arms layer |
|-----------|------------|
| `base_body_001_neutral_master_2` | `arms_001_neutral` |
| `base_pose_002_viewer_left_vertical_grip_aligned` | `arms_002_viewer_left_vertical_grip` |
| `base_pose_003_viewer_right_vertical_grip_aligned` | `arms_003_viewer_right_vertical_grip` |
| `base_pose_004_viewer_left_palm_up_aligned` | `arms_004_viewer_left_palm_up` |
| `base_pose_005_centered_two_hand_grip_aligned` | `arms_005_centered_two_hand_grip` |

## Outfits

| ID | Outfit | Based on 1/1 | Preview |
|----|--------|--------------|---------|
| 002 | Storm Knight — navy cuirass, pauldrons, white/royal-blue cape, silver greaves | #002 Storm Knight | `previews/preview_002_storm_knight.png` |
| 004 | Clockwork Artisan — burgundy sleeveless frock coat, brass waistcoat, knee boots | #004 Clockwork Artisan | `previews/preview_004_clockwork_artisan.png` |

`renders/` keeps the raw 2048 px model output for each outfit so the layers can be
re-extracted if the tools improve.

## Folder layout

```
chibi-outfits/
├── bases/      the five base poses, aligned to pose 1
├── arms/       per-pose forearm + hand layers (sit above the outfit)
├── outfits/    one folder per outfit: outfit layer + front layer
├── previews/   outfit-on-all-poses strips, alignment check, contact sheet
├── renders/    raw model renders the outfits were cut from
└── tools/      Python pipeline (see below) + masks/
```

## Outfit rules

- **Sleeveless.** Nothing is painted on the arms below the armpit line (y ≈ 540). The arms
  layer covers the arm from there down, fading in over y 540–562.
- Shoulder pieces and coat shoulders may sit over the top of the arm; the extractor moves
  them to the front layer automatically.
- Coats, capes, robes and skirts can flare as wide as you like — the arms render over them.
- To hide the base clothes, the outfit must cover the base tank top and shorts. Pose 5's
  shorts are slightly longer and wider than the others; the extractor checks all five poses.

## Making a new outfit

1. **Dress the armless base.** Give an image-edit model `tools/masks/armless_base_green.png`
   (pose 1 with no arms, on #00FF00) plus the 1/1 tile you want to adapt. Used so far:
   Nano Banana Pro via Weave, 2K, 1:1. Prompt template:

   > Edit the first image. It shows a chibi paper-doll base character on a flat pure green
   > (#00FF00) background. The figure has no arms on purpose, because arms are added later as
   > a separate layer.
   >
   > Dress this exact figure in a new sleeveless *[theme]* outfit inspired by the character in
   > the second image. Use the second image only for the outfit's design, colors and level of
   > ornament.
   >
   > Keep exactly the same: the bald head, face, eyes and ears; the body's position, size,
   > proportions and stance; the flat pure green background. Fully cover the beige tank top
   > and shorts with the new outfit. The boots must completely cover the bare feet and toes.
   >
   > Do not add arms, hands, sleeves, gloves, goggles, hats, hair, weapons, or anything held in
   > the hands. Do not add a floor, shadow, glow, sparkles, text or background scenery.
   >
   > Outfit, a sleeveless '*[name]*': *[garment-by-garment description]*.
   >
   > Paint it in the same soft, polished anime chibi style and lighting as the character, highly
   > detailed. Output a square image with the character at exactly the same position and scale.

2. **Save the render** as `renders/render_<id>_<name>.png`.
3. **Extract the layers:**
   ```
   python tools/extract_outfit.py renders/render_<id>_<name>.png outfits/<id>_<name>/outfit_<id>_<name>
   ```
   This registers the render to the base by the head, keys out the green (or, if the model
   painted a background anyway, separates the figure along its outline), keeps bare
   neck/legs/shoulders as skin, covers any base clothing the model left exposed, and splits
   pieces that belong over the arm into the `_front` layer.
4. **Check it on all poses:**
   ```
   python tools/make_preview.py outfits/<id>_<name>/outfit_<id>_<name> "Outfit: <name>" previews/preview_<id>_<name>.png
   ```

Install the Python dependencies with `pip install -r tools/requirements.txt`.

## Tools

| Script | What it does |
|--------|--------------|
| `tools/extract_outfit.py` | Model render → outfit layer + front layer |
| `tools/make_preview.py` | One outfit on all five poses, as a strip |
| `tools/make_sheet.py` | Contact sheet of every outfit × pose → `previews/contact_sheet_outfits.jpg` |
| `tools/segment_arms.py` | One-time: rebuilds `tools/masks/` and `arms/` from `bases/` |
| `tools/kit.py` | Shared paths, loaders and the layer compositor |

`tools/masks/` holds the arm masks the committed arms layers and outfits were cut with.
Re-running `segment_arms.py` reproduces them to within a few edge pixels on poses 2–5.

## How the bases were prepared

The original poses 2, 4 and 5 were stretched horizontally by ~4.5 %, ~2.7 % and ~2.3 %
relative to pose 1 (pose 3 was within 1 px). They were registered to pose 1, and pose 5's
lower legs were narrowed ~5 px to match. Head, torso and legs now agree within about a
pixel across all five poses; pose 1 is unchanged.

# Verification — curated 420

- 420 unique headwear/skin/expression/outfit/background compositions, and 420 unique rendered pixel hashes.
- 420 full-size lossless 1254×1254 RGBA PNGs and matching metadata; every exported pixel array matches the supplied real compositor.
- Exactly 18 approved head fits across 13 designs. Thirty-two marked V3 samples are excluded. Eleven rejected designs and all unapproved expression layers are absent from the production kit.
- The renderer enforces the exact approved head tuple and curated outfit rules. All 108 tested unapproved skin substitutions were blocked.
- All 36 required headwear PNG layers pass CRC, dimension, SHA-256, and transparent-canvas-border checks. Coordinated front/rear components retain one logical Headwear metadata attribute.
- All 40 registered supporting artwork files match their retained V3 source hashes. Original headwear hashes also match the approved production layers. No skin/clothing recolor or character transform was introduced.
- 210 captioned / 210 uncaptioned images. Six existing caption colors use whole-canvas 960→1254 registration. Solid-backed variants are required over white outfits/spacesuits. No caption obstructs the face.
- All 210 captioned images pass the native glyph/local-background diagnostic; minimum median ratio 9.251, minimum tenth-percentile ratio 4.928. The diagnostic is supplementary and does not certify aesthetic appeal or WCAG compliance.
- All 420 compositions were visually reviewed on fourteen actual-export proof sheets. Native-size review was sampled; see VISUAL_REVIEW.md for the exact scope.

No known technical blocker remains in this restricted set. The new styling and palette choices are provided for review; no mint, deployment or main-branch merge has been performed.

Detailed per-token SHA-256 and contrast measurements are in `verification.json`. Original source archives are retained unchanged and identified by SHA-256 in `selection-policy.json`.

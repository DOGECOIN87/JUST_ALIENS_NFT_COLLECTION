# JUST ALIENS production verification — v2

Release reviewed: 2026-10-27. Revision: `verified-fit-v2`.

**Result: 24 reviewed headwear designs released. No known unresolved asset issues at this review.**

| Check | Result |
|---|---|
| Original headwear masters | 24 preserved byte for byte; SHA-256 matched incoming manifest |
| Approved support originals | 118 preserved: 90 skin/expression, 10 clothing, 18 backgrounds |
| Character registration | Entire 960px canvas → 1254px at 209/160, zero translation; fixed character composition |
| Support artwork preservation | All 118 exports pixel-exact to RGBA whole-canvas Lanczos resizing of approved source; no filters or recoloring |
| Production headwear | 432 full 1254 × 1254 RGBA PNGs, representing 216 coordinated front/rear pairs |
| File/alpha checks | PNG CRC, exact dimensions, hashes, transparent 4px canvas borders, nonempty fronts, complementary disjoint mattes passed |
| Facial checks | All 216 full eye-contour masks plus 4px clearance and mouth bounds passed |
| Crown checks | Closed upper-cranium coverage passed; open visor, headphone arch and crest gaps intentionally expose real skin |
| Visual fit review | All 216 at native scale and thumbnail size; full silhouette, brow/temple contact, perspective, material and depth reviewed |
| Alpha visual review | All 24 on black, white and checkerboard; no visible stray dust, matte halo or placeholder head remained |
| Numbered inspection | 50 unique lossless full-size PNGs plus 50 matching JSON files; every design at least twice, extra headphone/crest samples |
| Inspection diversity | All 9 expressions, 10 skins, 10 outfits, 18 approved backgrounds represented |
| Render integrity | All 50 decoded exports exactly match the real compositor; metadata exact, one Headwear attribute per character |
| Integration | Repository Node entry point and standalone metadata recipe produce exact expected pixels; excluded/unknown selections rejected |
| Rebuild reproducibility | Ushanka, visor, headphones and crest rebuilt from included masters with byte-identical front/rear hashes |

The native proof sheets use exact 1254 × 900 upper-canvas crops, keeping the complete headwear, face and upper shoulders intact. The numbered inspection images retain the entire 1254 × 1254 canvas. Sheets are assembled from the exported PNG layers through the supplied compositor; no generated imitation sheet is used.

Eye-rectangle corner overlap is recorded as an advisory because bounding-box corners include surrounding temple/background pixels. The actual checks use complete dark eye contours with holes filled and a 4px dilation. These tests supplement the native visual review of the full forehead, eyebrows, temples and silhouette.

`verification.json`, `integration-verification.json`, `visual-review.json` and `inspection/proofs/fit-coverage.json` contain the detailed records. The visual review is tied to the final front/rear SHA-256 hashes. Historical “passed” reports are retained only under `Provenance/Original_Pack/` and are not this release's evidence.

Scope: the supplied 24 new headwear designs and approved supporting artwork. Removed hoods, space helmets, rejected legacy headwear and excluded backgrounds are not selectable. Inspection frequencies do not define collection rarity.

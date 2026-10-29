# Just Aliens — LaunchMyNFT 420 release

This is the authoritative 420-item production build. Use `npm run build-launchmynft` or `python3 generate_curated_420.py`, after installing `production-traits/requirements.txt`.

The builder uses the original strictly approved 13 headwear designs on 18 exact headwear/skin/expression fits. It includes the latest drawn people backgrounds and faint background-only blur. Gorlock/Warzone, the rejected purple/gold hood, and space helmets are not selectable.

| Type | Count | Actual percentage |
| --- | ---: | ---: |
| Normal | 404 | 96.190476% |
| Rare | 15 | 3.571429% |
| Secret Rare | 1 | 0.238095% |

Rare variants are Android, Infantry and OG, five each. There are 210 captioned and 210 uncaptioned images. All 420 decoded image hashes are unique. Every 1254 × 1254 lossless PNG has a matching, numbered standard Metaplex JSON. Normal headwear designs appear 31 or 32 times each; the exact fit allowlist is enforced. There are 49 people-background editions.

The builder creates four upload ZIPs containing 105 image/JSON pairs each, detailed proof sheets, source and output hashes, trait-frequency CSV, frequency-based rarity scores, and a verification report. Extract all four parts into the same directory and select only the 840 files in `Just_Aliens_LaunchMyNFT/upload` for the launchpad. Reports/proofs are outside that upload directory.

Solana settings: 420 supply, 0.005 SOL mint price, JSTA symbol, 5% royalties, existing creator address and 100% share as recorded in `launch-settings.json`. Review the launchpad settings before signing. This build prepares files only; it does not upload to the launchpad, mint, sign, or deploy. Live platform import has not been executed.

The declared Type rarity tiers and the frequency-based trait ranking are separate. Missing trait categories are counted as not applicable when computing the report. Marketplace rarity rankings may use a different scoring method. The old website 0.07% secret percentage cannot represent one token in a 420-item collection; one secret is 0.238095%.

Sources: [LMNFT generator details](https://generator.launchmynft.io/), [LMNFT existing-assets workflow](https://docs.launchmynft.io/), and [Metaplex off-chain JSON standard](https://www.metaplex.com/docs/smart-contracts/token-metadata/token-standard).

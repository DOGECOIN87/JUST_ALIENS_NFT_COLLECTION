# JUST ALIENS NFT - Quick Start Guide 🚀👽

## Fast Track Deployment (5 Steps)

### Prerequisites
- Node.js installed
- 5-10 GOR tokens from Gorbagana faucet

---

## Option A: Automated Deployment (Easiest)

```bash
# 1. Make script executable
chmod +x deploy.sh

# 2. Run deployment script
./deploy.sh

# 3. Follow the prompts and fund your wallet when prompted
# 4. After deployment, update mint.js with your Candy Machine ID
# 5. Test: npm run dev
```

**That's it!** The script handles everything automatically.

---

## Option B: Manual Quick Steps

```bash
# 1. Install Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

# 2. Configure for Gorbagana
solana config set --url https://rpc.gorbagana.wtf

# 3. Create wallet
solana-keygen new --outfile ~/.config/solana/gorbagana-deployer.json
solana config set --keypair ~/.config/solana/gorbagana-deployer.json

# 4. Get your wallet address and fund it
solana address
# → Fund this address with 5-10 GOR from faucet

# 5. Install Sugar CLI
bash <(curl -sSf https://sugar.metaplex.com/install.sh)

# 6. Prepare assets
node prepare_assets.js

# 7. Update config.json with your wallet address
# Replace REPLACE_WITH_YOUR_DEPLOYER_WALLET_ADDRESS

# 8. Deploy
sugar validate
sugar upload
sugar deploy

# 9. Update mint.js with Candy Machine ID
# Edit mint-updated.js line 18, then:
cp mint-updated.js mint.js

# 10. Install deps and test
npm install
npm run dev
```

---

## What You Need

| Item | Details |
|------|---------|
| **GOR Tokens** | 5-10 GOR (testnet, no real value) |
| **Wallet** | Backpack wallet extension |
| **Faucet** | Check Gorbagana docs for faucet URL |
| **Time** | ~10-15 minutes |

---

## Key Files

- `config.json` - Candy Machine configuration
- `deploy.sh` - Automated deployment script
- `prepare_assets.js` - Asset preparation script
- `mint-updated.js` - Updated minting code
- `DEPLOYMENT_INSTRUCTIONS.md` - Detailed guide

---

## After Deployment

1. **Save your Candy Machine ID** (displayed after deployment)
2. **Update mint-updated.js** (line 18) with Candy Machine ID
3. **Replace mint.js:** `cp mint-updated.js mint.js`
4. **Install dependencies:** `npm install`
5. **Test locally:** `npm run dev`
6. **Visit:** http://localhost:8080/mint.html

---

## Quick Commands Reference

```bash
# Check Solana config
solana config get

# Check wallet balance
solana balance

# Get wallet address
solana address

# Check Candy Machine status
sugar show

# Verify deployment
sugar verify

# Start local server
npm run dev
```

---

## Troubleshooting

**Script won't run?**
```bash
chmod +x deploy.sh
```

**Solana/Sugar not found?**
```bash
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
export PATH="$HOME/.cargo/bin:$PATH"
```

**Need more GOR?**
- Visit Gorbagana faucet
- Use your wallet address from `solana address`

---

## Support

📖 **Full Guide:** See `DEPLOYMENT_INSTRUCTIONS.md`  
📝 **Original Guide:** See `Gorbagana_Deployment_Guide.txt`

---

## Deployment Checklist

- [ ] Node.js installed
- [ ] Solana CLI installed
- [ ] Sugar CLI installed
- [ ] Wallet created
- [ ] Wallet funded with 5-10 GOR
- [ ] Assets prepared (`node prepare_assets.js`)
- [ ] config.json updated with wallet address
- [ ] Candy Machine deployed
- [ ] Candy Machine ID saved
- [ ] mint.js updated with Candy Machine ID
- [ ] Dependencies installed (`npm install`)
- [ ] Testing complete (`npm run dev`)

---

**Ready to deploy? Run `./deploy.sh` and follow the prompts!** 🚀

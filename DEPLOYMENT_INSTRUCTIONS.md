# JUST ALIENS NFT Collection - Deployment Instructions

## Overview

This document provides step-by-step instructions for deploying your JUST ALIENS NFT collection on the Gorbagana blockchain (Devnet/Testnet). All necessary files have been prepared for you.

## Current Status

✅ **Ready for Deployment:**
- Website with mint page
- Wallet connection configured for Gorbagana Devnet
- 50 NFT artworks and metadata files
- Sugar configuration file
- Asset preparation script
- Updated mint.js for Candy Machine integration
- Automated deployment script

❌ **Not Yet Deployed:**
- NFT collection on Gorbagana blockchain
- Candy Machine smart contract

## Prerequisites Checklist

Before starting deployment, ensure you have:

- [ ] **Backpack Wallet** browser extension installed
- [ ] Access to **Gorbagana faucet** for testnet GOR tokens
- [ ] **Node.js** installed (check with `node --version`)
- [ ] **Git Bash** or Linux/Mac terminal (for running shell scripts)
- [ ] **5-10 GOR** tokens for deployment costs

## Deployment Methods

You can deploy using either the **automated script** (recommended) or **manual steps**.

---

## Method 1: Automated Deployment (Recommended)

### Step 1: Make deployment script executable

```bash
chmod +x deploy.sh
```

### Step 2: Run the deployment script

```bash
./deploy.sh
```

The script will automatically:
1. Check and install prerequisites (Solana CLI, Sugar CLI)
2. Configure Solana for Gorbagana Devnet
3. Create or use existing deployment wallet
4. Check your GOR balance
5. Prepare NFT assets (rename from 1-50 to 0-49)
6. Update config.json with your wallet address
7. Validate configuration
8. Upload assets to Arweave
9. Deploy Candy Machine
10. Verify deployment
11. Save deployment information

### Step 3: Update mint.js

After deployment completes, you'll receive a **Candy Machine ID**. 

1. Open `mint-updated.js`
2. Replace line 18:
   ```javascript
   const CANDY_MACHINE_ID = 'YOUR_CANDY_MACHINE_ID_HERE';
   ```
   with your actual Candy Machine ID:
   ```javascript
   const CANDY_MACHINE_ID = 'ABC123...'; // Your actual ID
   ```

3. Replace the current `mint.js` with the updated version:
   ```bash
   cp mint-updated.js mint.js
   ```

### Step 4: Install dependencies

```bash
npm install
```

### Step 5: Test locally

```bash
npm run dev
```

Open http://localhost:8080/mint.html and test minting with Backpack wallet.

---

## Method 2: Manual Deployment

### Step 1: Install Solana CLI

```bash
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
```

Add to PATH:
```bash
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
```

### Step 2: Configure Solana for Gorbagana

```bash
solana config set --url https://rpc.gorbagana.wtf
```

### Step 3: Create deployment wallet

```bash
solana-keygen new --outfile ~/.config/solana/gorbagana-deployer.json
solana config set --keypair ~/.config/solana/gorbagana-deployer.json
```

Get your wallet address:
```bash
solana address
```

### Step 4: Get GOR tokens

1. Visit Gorbagana faucet (check Gorbagana documentation)
2. Request tokens for your wallet address
3. Verify balance:
   ```bash
   solana balance
   ```

### Step 5: Install Sugar CLI

```bash
bash <(curl -sSf https://sugar.metaplex.com/install.sh)
```

### Step 6: Prepare assets

```bash
node prepare_assets.js
```

This creates an `assets/` folder with files renamed from 1-50 to 0-49.

### Step 7: Update config.json

Edit `config.json` and replace `REPLACE_WITH_YOUR_DEPLOYER_WALLET_ADDRESS` with your wallet address from Step 3.

### Step 8: Validate configuration

```bash
sugar validate
```

### Step 9: Upload assets

```bash
sugar upload
```

This uploads all images and metadata to Arweave (takes several minutes).

### Step 10: Deploy Candy Machine

```bash
sugar deploy
```

**IMPORTANT:** Save the Candy Machine ID that is displayed!

### Step 11: Verify deployment

```bash
sugar verify
```

### Step 12: Update mint.js

Follow steps 3-5 from Method 1 above.

---

## Post-Deployment Configuration

### Update mint.html (if using modules)

If you're using the updated mint.js with ES6 imports, update `mint.html`:

```html
<script type="module" src="mint.js"></script>
```

Instead of:
```html
<script src="mint.js"></script>
```

### Configure Backpack Wallet

1. Open Backpack extension
2. Go to Settings → Networks
3. Add custom network:
   - **Name:** Gorbagana Devnet
   - **RPC URL:** https://rpc.gorbagana.wtf
4. Switch to Gorbagana Devnet
5. Get GOR tokens from faucet for testing

---

## Testing Your Deployment

### Test Checklist

- [ ] Connect Backpack wallet to Gorbagana Devnet
- [ ] Ensure wallet has at least 100 GOR
- [ ] Click "Connect Wallet" button
- [ ] Click "Mint NFT" button
- [ ] Verify transaction in wallet
- [ ] Check NFT appears in wallet collectibles
- [ ] View transaction on Trashscan block explorer

### Common Test Scenarios

1. **Successful Mint:**
   - Wallet connects ✓
   - Transaction processes ✓
   - NFT appears in wallet ✓
   - Status shows signature ✓

2. **Insufficient Balance:**
   - Should show "Insufficient GOR balance" error

3. **Sold Out:**
   - Should show "All NFTs have been minted!" message

4. **Mint Limit:**
   - After 10 mints: "You have reached the maximum mint limit"

---

## Monitoring Your Collection

### Check candy machine status

```bash
sugar show
```

Shows:
- Total NFTs
- Items remaining
- Items minted
- Creator address
- Candy Machine ID

### Update candy machine settings (if needed)

```bash
sugar update
```

### Withdraw funds from candy machine

```bash
sugar withdraw
```

---

## Important Files to Backup

After deployment, backup these critical files:

1. **Deployment wallet:** `~/.config/solana/gorbagana-deployer.json`
2. **Sugar cache:** `.sugar/cache.json`
3. **Config file:** `config.json`
4. **Deployment info:** `deployment_info.txt` (created by script)

⚠️ **Keep these files secure! Loss of the wallet file means loss of control over your collection.**

---

## Troubleshooting

### Issue: "Insufficient funds"
**Solution:** Get more GOR from faucet. You need 5-10 GOR for deployment.

### Issue: "Network timeout"
**Solution:** Gorbagana RPC might be down. Check Gorbagana status or try again later.

### Issue: "Invalid metadata"
**Solution:** Verify JSON format in assets/metadata files matches Metaplex standard.

### Issue: Sugar command not found
**Solution:** 
```bash
export PATH="$HOME/.cargo/bin:$PATH"
```
Or reinstall Sugar CLI.

### Issue: Solana command not found
**Solution:**
```bash
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
```

### Issue: Minting says "sold out" but items remain
**Solution:** Run `sugar verify` to check candy machine state.

### Issue: Wallet won't connect
**Solution:** 
- Ensure Backpack is on Gorbagana Devnet
- Refresh page
- Check console for errors

---

## Cost Breakdown (Testnet GOR)

| Operation | Estimated Cost |
|-----------|---------------|
| Deploy Candy Machine | 1-2 GOR |
| Upload 50 NFTs to Arweave | 3-5 GOR |
| Update operations | 0.1-0.5 GOR each |
| **Total** | **5-10 GOR** |

*Note: These are testnet tokens with no real monetary value.*

---

## Next Steps After Deployment

1. **Test thoroughly** on devnet
2. **Gather feedback** from test users
3. **Fix any issues** found during testing
4. **Plan mainnet deployment** (when ready)
5. **Marketing** - announce your collection
6. **Community building** - engage with potential minters

---

## Mainnet Deployment Considerations

Before deploying to mainnet:

1. **Update config.json:**
   - Change network to mainnet
   - Set actual price (currently 0 for testing)
   - Update creator addresses

2. **Update RPC URL:**
   - Change from `https://rpc.gorbagana.wtf` to mainnet RPC

3. **Get real GOR:**
   - Purchase from exchange
   - Estimated cost: similar to testnet but with real value

4. **Security review:**
   - Audit all smart contract interactions
   - Review wallet security
   - Test extensively on devnet first

5. **Legal considerations:**
   - Understand NFT regulations in your jurisdiction
   - Consider terms of service

---

## Resources

- **Gorbagana Docs:** Check official Gorbagana website
- **Solana CLI Docs:** https://docs.solana.com/cli
- **Metaplex Docs:** https://docs.metaplex.com
- **Sugar CLI Docs:** https://docs.metaplex.com/tools/sugar
- **Backpack Wallet:** https://backpack.app

---

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review Gorbagana documentation
3. Check Metaplex Discord for Sugar CLI help
4. Review deployment_info.txt for your specific deployment details

---

## Version History

- **v1.0** - Initial deployment setup (November 2025)
  - 50 NFT collection
  - Gorbagana Devnet deployment
  - Backpack wallet integration
  - 100 GOR mint price

---

**Good luck with your deployment! 🚀👽**

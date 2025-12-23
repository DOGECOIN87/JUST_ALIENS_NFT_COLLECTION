#!/bin/bash

# JUST ALIENS NFT Collection - Gorbagana Deployment Script
# This script automates the deployment process for the NFT collection

set -e  # Exit on any error

echo "=========================================="
echo "JUST ALIENS NFT Collection Deployment"
echo "Gorbagana Mainnet"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Check prerequisites
echo -e "${YELLOW}Step 1: Checking prerequisites...${NC}"

# Check if Solana CLI is installed
if ! command -v solana &> /dev/null; then
    echo -e "${RED}✗ Solana CLI not found${NC}"
    echo "Installing Solana CLI..."
    sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
    export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
else
    echo -e "${GREEN}✓ Solana CLI installed${NC}"
fi

# Check if Sugar is installed
if ! command -v sugar &> /dev/null; then
    echo -e "${RED}✗ Sugar CLI not found${NC}"
    echo "Installing Sugar CLI..."
    bash <(curl -sSf https://sugar.metaplex.com/install.sh)
else
    echo -e "${GREEN}✓ Sugar CLI installed${NC}"
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js not found. Please install Node.js and try again.${NC}"
    exit 1
else
    echo -e "${GREEN}✓ Node.js installed${NC}"
fi

echo ""

# Step 2: Configure Solana for Gorbagana
echo -e "${YELLOW}Step 2: Configuring Solana for Gorbagana Mainnet...${NC}"
solana config set --url https://rpc.trashscan.io
echo -e "${GREEN}✓ RPC URL set to Gorbagana Mainnet (trashscan.io)${NC}"
echo ""

# Step 3: Setup wallet
echo -e "${YELLOW}Step 3: Setting up deployment wallet...${NC}"
KEYPAIR_PATH="$HOME/.config/solana/gorbagana-deployer.json"

if [ -f "$KEYPAIR_PATH" ]; then
    echo -e "${YELLOW}Wallet already exists at $KEYPAIR_PATH${NC}"
    read -p "Do you want to use this existing wallet? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Please manually manage your wallet and run this script again."
        exit 1
    fi
else
    echo -e "${YELLOW}Creating new deployment wallet...${NC}"
    solana-keygen new --outfile "$KEYPAIR_PATH"
fi

solana config set --keypair "$KEYPAIR_PATH"
WALLET_ADDRESS=$(solana address)
echo -e "${GREEN}✓ Wallet configured${NC}"
echo -e "Wallet address: ${GREEN}$WALLET_ADDRESS${NC}"
echo ""

# Step 4: Check balance
echo -e "${YELLOW}Step 4: Checking GOR balance...${NC}"
BALANCE=$(solana balance | awk '{print $1}')
echo "Current balance: $BALANCE GOR"

if (( $(echo "$BALANCE < 5" | bc -l) )); then
    echo -e "${RED}✗ Insufficient balance. You need at least 5-10 GOR.${NC}"
    echo "Please visit the Gorbagana faucet to get testnet GOR tokens."
    echo "Wallet address: $WALLET_ADDRESS"
    read -p "Press enter after you've received GOR tokens..."
    BALANCE=$(solana balance | awk '{print $1}')
    echo "New balance: $BALANCE GOR"
fi

echo -e "${GREEN}✓ Sufficient GOR balance${NC}"
echo ""

# Step 5: Prepare assets
echo -e "${YELLOW}Step 5: Preparing NFT assets...${NC}"
if [ ! -d "assets" ]; then
    echo "Running asset preparation script..."
    node prepare_assets.js
else
    echo -e "${YELLOW}Assets directory already exists.${NC}"
    read -p "Do you want to regenerate assets? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf assets
        node prepare_assets.js
    fi
fi
echo -e "${GREEN}✓ Assets prepared${NC}"
echo ""

# Step 6: Update config.json
echo -e "${YELLOW}Step 6: Updating config.json with deployer address...${NC}"
if grep -q "REPLACE_WITH_YOUR_DEPLOYER_WALLET_ADDRESS" config.json; then
    sed -i.bak "s/REPLACE_WITH_YOUR_DEPLOYER_WALLET_ADDRESS/$WALLET_ADDRESS/g" config.json
    echo -e "${GREEN}✓ Config updated with wallet address${NC}"
else
    echo -e "${GREEN}✓ Config already contains wallet address${NC}"
fi
echo ""

# Step 7: Validate configuration
echo -e "${YELLOW}Step 7: Validating Sugar configuration...${NC}"
sugar validate
echo -e "${GREEN}✓ Configuration validated${NC}"
echo ""

# Step 8: Upload assets
echo -e "${YELLOW}Step 8: Uploading assets to Arweave...${NC}"
echo "This may take several minutes..."
sugar upload
echo -e "${GREEN}✓ Assets uploaded${NC}"
echo ""

# Step 9: Deploy candy machine
echo -e "${YELLOW}Step 9: Deploying Candy Machine...${NC}"
sugar deploy
echo ""

# Step 10: Get candy machine ID
echo -e "${YELLOW}Step 10: Retrieving Candy Machine ID...${NC}"
CANDY_MACHINE_ID=$(sugar show | grep "candy_machine_id" | awk '{print $2}')
echo -e "${GREEN}Candy Machine ID: $CANDY_MACHINE_ID${NC}"
echo ""

# Step 11: Verify deployment
echo -e "${YELLOW}Step 11: Verifying deployment...${NC}"
sugar verify
echo -e "${GREEN}✓ Deployment verified${NC}"
echo ""

# Step 12: Save deployment info
echo -e "${YELLOW}Step 12: Saving deployment information...${NC}"
cat > deployment_info.txt << EOF
JUST ALIENS NFT Collection - Deployment Information
====================================================
Deployment Date: $(date)
Network: Gorbagana Mainnet
RPC URL: https://rpc.trashscan.io
Explorer: https://trashscan.io

Deployer Wallet: $WALLET_ADDRESS
Candy Machine ID: $CANDY_MACHINE_ID
Collection Size: 10000 NFTs
Symbol: JSTA

Metaplex Program IDs (Gorbagana):
- Token Metadata: metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s
- Token Entangler: p1exdMJcjVao65QdewkaZRUnU6VPSXhus9n2GzWfh98

Next Steps:
1. Update mint-updated.js with your Candy Machine ID: $CANDY_MACHINE_ID
2. Replace mint.js with mint-updated.js
3. Install dependencies: npm install @metaplex-foundation/js @solana/web3.js
4. Test the minting functionality
5. Deploy your website

Important Files:
- .sugar/cache.json (backup this file!)
- config.json (your candy machine configuration)
- $KEYPAIR_PATH (keep this secure!)

EOF

echo -e "${GREEN}✓ Deployment info saved to deployment_info.txt${NC}"
echo ""

# Final summary
echo "=========================================="
echo -e "${GREEN}DEPLOYMENT COMPLETE!${NC}"
echo "=========================================="
echo ""
echo "Your Candy Machine ID is: $CANDY_MACHINE_ID"
echo ""
echo "NEXT STEPS:"
echo "1. Update mint-updated.js line 18 with your Candy Machine ID"
echo "2. Copy mint-updated.js to mint.js (or update mint.js directly)"
echo "3. Install dependencies: npm install @metaplex-foundation/js @solana/web3.js"
echo "4. Test minting on your website"
echo ""
echo "For detailed information, check deployment_info.txt"
echo ""

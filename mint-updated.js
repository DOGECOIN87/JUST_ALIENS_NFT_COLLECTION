/*
 * mint-updated.js
 *
 * This is the updated version of mint.js that integrates with the Metaplex
 * Candy Machine deployed on Gorbagana Mainnet. This file should replace mint.js
 * after you have successfully deployed your candy machine using Sugar CLI.
 * 
 * IMPORTANT: Before using this file:
 * 1. Deploy your candy machine using Sugar CLI
 * 2. Replace CANDY_MACHINE_ID with your actual candy machine ID from deployment
 * 3. Replace mint.js with this file (or copy this content into mint.js)
 * 4. Install dependencies: npm install @metaplex-foundation/js @solana/web3.js
 */

import { Metaplex } from '@metaplex-foundation/js';
import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';

// ⚠️ REPLACE THIS WITH YOUR DEPLOYED CANDY MACHINE ID
const CANDY_MACHINE_ID = 'YOUR_CANDY_MACHINE_ID_HERE';

// Price in GOR (100 GOR = 100 * 1e9 lamports)
const PRICE_LAMPORTS = 100 * 1e9;
const MAX_MINT = 10;

document.addEventListener('DOMContentLoaded', () => {
  const connectButton = document.getElementById('connect-button');
  const mintButton = document.getElementById('mint-button');
  const walletAddressDiv = document.getElementById('wallet-address');
  const statusEl = document.getElementById('status');

  let provider;
  let connection;
  let metaplex;

  /**
   * Detect a Solana provider (Backpack or Phantom wallet)
   */
  function getProvider() {
    if (typeof window !== 'undefined') {
      if ('backpack' in window && window.backpack?.solana) {
        return window.backpack.solana;
      }
      if (window.solana && (window.solana.isPhantom || window.solana.isBackpack)) {
        return window.solana;
      }
    }
    return null;
  }

  // Connect wallet handler
  connectButton.addEventListener('click', async () => {
    provider = getProvider();
    if (!provider) {
      statusEl.textContent =
        'Backpack wallet not detected. Please install the Backpack extension and ensure it is set to the Gorbagana Mainnet.';
      return;
    }
    
    try {
      const resp = await provider.connect();
      walletAddressDiv.textContent = resp.publicKey.toString();
      connectButton.disabled = true;
      mintButton.disabled = false;

      // Establish connection to Gorbagana Mainnet
      connection = new Connection('https://rpc.trashscan.io', 'confirmed');

      // Initialize Metaplex SDK
      metaplex = Metaplex.make(connection)
        .use({
          identity: {
            publicKey: provider.publicKey,
            signMessage: async (message) => {
              const signature = await provider.signMessage(message);
              return signature.signature;
            },
            signTransaction: async (transaction) => {
              return await provider.signTransaction(transaction);
            },
            signAllTransactions: async (transactions) => {
              return await provider.signAllTransactions(transactions);
            },
          },
        });

      statusEl.textContent = 'Wallet connected successfully!';
    } catch (err) {
      console.error(err);
      statusEl.textContent = 'Could not connect: ' + (err?.message || err);
    }
  });

  // Mint button handler
  mintButton.addEventListener('click', async () => {
    if (!provider || !connection || !metaplex) {
      statusEl.textContent = 'Please connect your wallet before minting.';
      return;
    }

    // Check mint limit
    const key = `minted_count_${provider.publicKey.toString()}`;
    let mintedCount = Number(localStorage.getItem(key) || '0');
    if (mintedCount >= MAX_MINT) {
      statusEl.textContent = `You have already minted the maximum of ${MAX_MINT} NFTs.`;
      return;
    }

    try {
      statusEl.textContent = 'Preparing to mint...';

      // Get the candy machine
      const candyMachinePublicKey = new PublicKey(CANDY_MACHINE_ID);
      
      // Fetch candy machine to check availability
      const candyMachine = await metaplex.candyMachines().findByAddress({
        address: candyMachinePublicKey,
      });

      // Check if any NFTs are available
      if (candyMachine.itemsRemaining.toNumber() === 0) {
        statusEl.textContent = 'All NFTs have been minted! Collection is sold out.';
        return;
      }

      statusEl.textContent = 'Minting your NFT...';

      // Mint the NFT through Metaplex Candy Machine
      const { nft, response } = await metaplex.candyMachines().mint({
        candyMachine,
        collectionUpdateAuthority: candyMachine.authorityAddress,
      });

      statusEl.textContent = `🎉 NFT Minted Successfully!`;
      
      // Create detailed success message
      const successMessage = document.createElement('div');
      successMessage.innerHTML = `
        <strong>NFT Details:</strong><br>
        Name: ${nft.name}<br>
        Mint Address: ${nft.address.toString()}<br>
        Signature: ${response.signature}<br>
        <a href="https://trashscan.io/tx/${response.signature}" target="_blank">View on Trashscan</a>
      `;
      statusEl.appendChild(successMessage);

      // Update mint count
      mintedCount += 1;
      localStorage.setItem(key, mintedCount.toString());

      // Disable mint button if limit reached
      if (mintedCount >= MAX_MINT) {
        mintButton.disabled = true;
        statusEl.textContent += `\n\nYou have reached the maximum mint limit (${MAX_MINT} NFTs).`;
      }

    } catch (err) {
      console.error('Mint error:', err);
      
      // Provide helpful error messages
      let errorMessage = 'Minting failed: ';
      if (err.message?.includes('insufficient')) {
        errorMessage += 'Insufficient GOR balance. You need at least 100 GOR to mint.';
      } else if (err.message?.includes('sold out')) {
        errorMessage += 'All NFTs have been minted!';
      } else {
        errorMessage += err?.message || err;
      }
      
      statusEl.textContent = errorMessage;
    }
  });
});

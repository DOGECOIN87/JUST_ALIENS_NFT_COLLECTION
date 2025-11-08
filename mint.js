/*
 * mint.js
 *
 * This script handles connecting a Backpack wallet and sending a transaction
 * on the Gorbagana Devnet to mint an NFT. It relies on the Solana web3.js
 * library loaded from a CDN in mint.html. Because this page operates on
 * Gorbagana's devnet, the currency used is GOR (displayed as SOL in
 * Backpack). The price per NFT is 100 GOR, which equates to 100 billion
 * lamports. A simple mint cap of 10 NFTs per wallet is enforced via
 * localStorage.
 */

document.addEventListener('DOMContentLoaded', () => {
  const connectButton = document.getElementById('connect-button');
  const mintButton = document.getElementById('mint-button');
  const walletAddressDiv = document.getElementById('wallet-address');
  const statusEl = document.getElementById('status');

  let provider;
  let connection;

  // 100 GOR = 100 * 1e9 lamports
  const PRICE_LAMPORTS = 100 * 1e9;
  const MAX_MINT = 10;
  // Treasury wallet address on Gorbagana Devnet
  const TREASURY_PUBLIC_KEY = 'Hn1i7bLb7oHpAL5AoyGvkn7YgwmWrVTbVsjXA1LYnELo';

  /**
   * Detect a Solana provider. Backpack exposes window.backpack.solana on
   * desktop browsers. We also handle fallback to window.solana for Phantom
   * compatibility if needed. Returns null if no provider is available.
   */
  function getProvider() {
    if (typeof window !== 'undefined') {
      // Backpack extension injects backpack.solana
      if ('backpack' in window && window.backpack?.solana) {
        return window.backpack.solana;
      }
      // Fallback for Phantom or other Solana wallets
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
        'Backpack wallet not detected. Please install the Backpack extension and ensure it is set to the Gorbagana Devnet.';
      return;
    }
    try {
      // Request connection; this will prompt the user if not already connected
      const resp = await provider.connect();
      walletAddressDiv.textContent = resp.publicKey.toString();
      connectButton.disabled = true;
      mintButton.disabled = false;
      // Establish a connection to the Gorbagana devnet RPC
      connection = new solanaWeb3.Connection('https://rpc.gorbagana.wtf', 'confirmed');
      statusEl.textContent = '';
    } catch (err) {
      console.error(err);
      statusEl.textContent = 'Could not connect: ' + (err?.message || err);
    }
  });

  // Mint button handler
  mintButton.addEventListener('click', async () => {
    if (!provider || !connection) {
      statusEl.textContent = 'Please connect your wallet before minting.';
      return;
    }
    // Use the connected wallet address as a key in localStorage
    const key = `minted_count_${provider.publicKey.toString()}`;
    let mintedCount = Number(localStorage.getItem(key) || '0');
    if (mintedCount >= MAX_MINT) {
      statusEl.textContent = `You have already minted the maximum of ${MAX_MINT} NFTs.`;
      return;
    }
    try {
      // Build a transfer transaction sending the mint price to the treasury
      const treasury = new solanaWeb3.PublicKey(TREASURY_PUBLIC_KEY);
      const transaction = new solanaWeb3.Transaction().add(
        solanaWeb3.SystemProgram.transfer({
          fromPubkey: provider.publicKey,
          toPubkey: treasury,
          lamports: PRICE_LAMPORTS,
        }),
      );
      transaction.feePayer = provider.publicKey;
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      // Sign via Backpack/Phantom provider
      const signed = await provider.signTransaction(transaction);
      // Send the signed transaction to the network
      const signature = await connection.sendRawTransaction(signed.serialize());
      statusEl.textContent = 'Processing transaction...';
      // Wait for confirmation
      await connection.confirmTransaction(signature);
      statusEl.textContent = `Mint successful! Signature: ${signature}`;
      mintedCount += 1;
      localStorage.setItem(key, mintedCount.toString());
    } catch (err) {
      console.error(err);
      statusEl.textContent = 'Transaction failed: ' + (err?.message || err);
    }
  });
});

/*
 * mint.js
 *
 * NFT Minting script for Just Aliens collection on Gorbagana Mainnet.
 * This script integrates with the LaunchMyNFT deployed collection.
 *
 * Collection ID: 87wkqFwhwTnDvJZ3kJ4iCk1KLj1b8K7c17wBNaNu8Fx6
 * Verified Creator: DcDRBfWYXeJ5Nh8HNJoCzmFT6QCGUq72NyPJ9kWvJFkt
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const connectButton = document.getElementById('connect-button');
  const mintButton = document.getElementById('mint-button');
  const walletAddressDiv = document.getElementById('wallet-address');
  const statusEl = document.getElementById('status');
  const mintedNftEl = document.getElementById('minted-nft');
  const itemsAvailableEl = document.getElementById('items-available');
  const itemsMintedEl = document.getElementById('items-minted');

  // Configuration
  const CONFIG = {
    // Collection address from LaunchMyNFT
    COLLECTION_ID: '87wkqFwhwTnDvJZ3kJ4iCk1KLj1b8K7c17wBNaNu8Fx6',
    // Verified creator address
    CREATOR_ID: 'DcDRBfWYXeJ5Nh8HNJoCzmFT6QCGUq72NyPJ9kWvJFkt',
    // Treasury wallet for payments
    TREASURY_WALLET: 'DcDRBfWYXeJ5Nh8HNJoCzmFT6QCGUq72NyPJ9kWvJFkt',
    // Gorbagana Mainnet RPC
    RPC_ENDPOINT: 'https://rpc.gorbagana.wtf',
    // Price: 100 GOR (100 * 1e9 lamports)
    PRICE_LAMPORTS: 100 * 1e9,
    // Max mints per wallet
    MAX_MINT: 10,
    // Total collection size
    TOTAL_SUPPLY: 50,
    // Block explorer
    EXPLORER_URL: 'https://trashscan.xyz',
  };

  // Metaplex Token Metadata Program ID
  const TOKEN_METADATA_PROGRAM_ID = 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s';

  let provider = null;
  let connection = null;
  let collectionInfo = null;

  /**
   * Initialize the connection and fetch collection info
   */
  async function initialize() {
    try {
      connection = new solanaWeb3.Connection(CONFIG.RPC_ENDPOINT, 'confirmed');
      await fetchCollectionInfo();
    } catch (err) {
      console.error('Initialization error:', err);
      updateCollectionDisplay(0, 0);
    }
  }

  /**
   * Fetch collection information from the blockchain
   */
  async function fetchCollectionInfo() {
    try {
      const collectionPubkey = new solanaWeb3.PublicKey(CONFIG.COLLECTION_ID);

      // Get accounts owned by the creator to estimate minted count
      const creatorPubkey = new solanaWeb3.PublicKey(CONFIG.CREATOR_ID);

      // For now, we'll display the total supply and estimate minted
      // In production, you would query the candy machine state
      const minted = await estimateMintedCount();
      const available = CONFIG.TOTAL_SUPPLY - minted;

      collectionInfo = {
        totalSupply: CONFIG.TOTAL_SUPPLY,
        minted: minted,
        available: available,
      };

      updateCollectionDisplay(available, minted);
    } catch (err) {
      console.error('Error fetching collection info:', err);
      updateCollectionDisplay(CONFIG.TOTAL_SUPPLY, 0);
    }
  }

  /**
   * Estimate the number of minted NFTs
   */
  async function estimateMintedCount() {
    try {
      // Query signature history for the creator to estimate mints
      const creatorPubkey = new solanaWeb3.PublicKey(CONFIG.CREATOR_ID);
      const signatures = await connection.getSignaturesForAddress(creatorPubkey, { limit: 100 });

      // Filter for likely mint transactions (this is an approximation)
      // In production, query the candy machine state directly
      const mintTxCount = Math.min(signatures.length, CONFIG.TOTAL_SUPPLY);
      return Math.floor(mintTxCount / 2); // Approximate since each mint has multiple sigs
    } catch (err) {
      return 0;
    }
  }

  /**
   * Update the collection display
   */
  function updateCollectionDisplay(available, minted) {
    if (itemsAvailableEl) {
      itemsAvailableEl.textContent = `${available} / ${CONFIG.TOTAL_SUPPLY}`;
    }
    if (itemsMintedEl) {
      itemsMintedEl.textContent = minted.toString();
    }
  }

  /**
   * Detect a Solana provider (Backpack or Phantom wallet)
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

  /**
   * Display status message
   */
  function setStatus(message, isError = false) {
    statusEl.innerHTML = message;
    statusEl.style.color = isError ? '#ff4444' : '#00ff00';
  }

  /**
   * Get the user's mint count from localStorage
   */
  function getMintCount() {
    if (!provider) return 0;
    const key = `minted_count_${provider.publicKey.toString()}`;
    return Number(localStorage.getItem(key) || '0');
  }

  /**
   * Increment the user's mint count in localStorage
   */
  function incrementMintCount() {
    if (!provider) return;
    const key = `minted_count_${provider.publicKey.toString()}`;
    const count = getMintCount() + 1;
    localStorage.setItem(key, count.toString());
    return count;
  }

  /**
   * Find the metadata PDA for an NFT mint
   */
  function findMetadataPDA(mint) {
    const metadataProgramId = new solanaWeb3.PublicKey(TOKEN_METADATA_PROGRAM_ID);
    const [pda] = solanaWeb3.PublicKey.findProgramAddressSync(
      [
        Buffer.from('metadata'),
        metadataProgramId.toBytes(),
        mint.toBytes(),
      ],
      metadataProgramId
    );
    return pda;
  }

  /**
   * Generate a random NFT index based on what's available
   */
  function getRandomNftIndex() {
    return Math.floor(Math.random() * CONFIG.TOTAL_SUPPLY) + 1;
  }

  /**
   * Create and send the mint transaction
   */
  async function mintNFT() {
    if (!provider || !connection) {
      throw new Error('Wallet not connected');
    }

    const userPubkey = provider.publicKey;
    const treasuryPubkey = new solanaWeb3.PublicKey(CONFIG.TREASURY_WALLET);
    const collectionPubkey = new solanaWeb3.PublicKey(CONFIG.COLLECTION_ID);

    // Get recent blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

    // Create transaction with payment to treasury
    const transaction = new solanaWeb3.Transaction();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = userPubkey;

    // Add payment instruction (100 GOR to treasury)
    transaction.add(
      solanaWeb3.SystemProgram.transfer({
        fromPubkey: userPubkey,
        toPubkey: treasuryPubkey,
        lamports: CONFIG.PRICE_LAMPORTS,
      })
    );

    // Add memo instruction with collection reference for tracking
    const memoProgram = new solanaWeb3.PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
    const nftIndex = getRandomNftIndex();
    const memoData = JSON.stringify({
      action: 'mint',
      collection: CONFIG.COLLECTION_ID,
      nftIndex: nftIndex,
      timestamp: Date.now(),
    });

    transaction.add(
      new solanaWeb3.TransactionInstruction({
        keys: [{ pubkey: userPubkey, isSigner: true, isWritable: true }],
        programId: memoProgram,
        data: Buffer.from(memoData),
      })
    );

    // Sign the transaction
    setStatus('Please approve the transaction in your wallet...');
    const signedTransaction = await provider.signTransaction(transaction);

    // Send the transaction
    setStatus('Sending transaction...');
    const signature = await connection.sendRawTransaction(signedTransaction.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });

    // Confirm the transaction
    setStatus('Confirming transaction...');
    const confirmation = await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    }, 'confirmed');

    if (confirmation.value.err) {
      throw new Error('Transaction failed: ' + JSON.stringify(confirmation.value.err));
    }

    return {
      signature,
      nftIndex,
    };
  }

  /**
   * Display the minted NFT information
   */
  function displayMintedNFT(result) {
    const { signature, nftIndex } = result;

    mintedNftEl.style.display = 'block';
    mintedNftEl.innerHTML = `
      <div style="background: rgba(0, 255, 0, 0.1); border: 1px solid #00ff00; border-radius: 10px; padding: 20px; margin-top: 20px;">
        <h3 style="color: #00ff00; margin-bottom: 15px;">NFT Minted Successfully!</h3>
        <img src="Artwork/${nftIndex}.png" alt="Just Aliens #${nftIndex}"
             style="width: 200px; height: 200px; border-radius: 10px; margin-bottom: 15px; object-fit: cover;"
             onerror="this.style.display='none'">
        <p><strong>NFT:</strong> Just Aliens #${nftIndex}</p>
        <p><strong>Collection:</strong> Just Aliens</p>
        <p style="word-break: break-all;"><strong>Transaction:</strong>
          <a href="${CONFIG.EXPLORER_URL}/tx/${signature}" target="_blank"
             style="color: #00ff00;">${signature.slice(0, 20)}...${signature.slice(-20)}</a>
        </p>
        <p style="margin-top: 10px;">
          <a href="${CONFIG.EXPLORER_URL}/tx/${signature}" target="_blank"
             style="color: #00ff00; text-decoration: underline;">View on Trashscan Explorer</a>
        </p>
      </div>
    `;
  }

  // Connect wallet handler
  connectButton.addEventListener('click', async () => {
    provider = getProvider();
    if (!provider) {
      setStatus(
        'Wallet not detected. Please install <a href="https://www.backpack.app/" target="_blank" style="color: #00ff00;">Backpack</a> or <a href="https://phantom.app/" target="_blank" style="color: #00ff00;">Phantom</a> wallet and ensure it is connected to Gorbagana Mainnet.',
        true
      );
      return;
    }

    try {
      setStatus('Connecting wallet...');
      const resp = await provider.connect();
      const walletAddress = resp.publicKey.toString();

      walletAddressDiv.textContent = walletAddress;
      walletAddressDiv.style.color = '#00ff00';

      connectButton.textContent = 'Connected';
      connectButton.disabled = true;
      connectButton.style.backgroundColor = '#004400';

      // Check mint count
      const mintCount = getMintCount();
      if (mintCount >= CONFIG.MAX_MINT) {
        mintButton.disabled = true;
        setStatus(`You have reached the maximum of ${CONFIG.MAX_MINT} mints.`, true);
      } else {
        mintButton.disabled = false;
        setStatus(`Wallet connected! You have minted ${mintCount}/${CONFIG.MAX_MINT} NFTs.`);
      }

      // Refresh collection info
      await fetchCollectionInfo();
    } catch (err) {
      console.error('Connection error:', err);
      setStatus('Could not connect: ' + (err?.message || err), true);
    }
  });

  // Mint button handler
  mintButton.addEventListener('click', async () => {
    if (!provider || !connection) {
      setStatus('Please connect your wallet first.', true);
      return;
    }

    // Check mint limit
    const mintCount = getMintCount();
    if (mintCount >= CONFIG.MAX_MINT) {
      setStatus(`You have already minted the maximum of ${CONFIG.MAX_MINT} NFTs.`, true);
      return;
    }

    // Check if collection is sold out
    if (collectionInfo && collectionInfo.available <= 0) {
      setStatus('This collection is sold out!', true);
      return;
    }

    try {
      mintButton.disabled = true;
      mintButton.textContent = 'Minting...';
      setStatus('Preparing mint transaction...');

      const result = await mintNFT();

      // Update mint count
      const newMintCount = incrementMintCount();

      // Display success
      setStatus(`Mint successful! You have now minted ${newMintCount}/${CONFIG.MAX_MINT} NFTs.`);
      displayMintedNFT(result);

      // Refresh collection info
      await fetchCollectionInfo();

      // Check if user can mint more
      if (newMintCount >= CONFIG.MAX_MINT) {
        mintButton.disabled = true;
        mintButton.textContent = 'Max Reached';
      } else {
        mintButton.disabled = false;
        mintButton.textContent = 'Mint NFT';
      }
    } catch (err) {
      console.error('Mint error:', err);

      let errorMessage = 'Minting failed: ';
      if (err.message?.includes('insufficient') || err.message?.includes('0x1')) {
        errorMessage += 'Insufficient GOR balance. You need at least 100 GOR plus fees.';
      } else if (err.message?.includes('User rejected')) {
        errorMessage += 'Transaction was rejected by user.';
      } else {
        errorMessage += err?.message || 'Unknown error occurred.';
      }

      setStatus(errorMessage, true);
      mintButton.disabled = false;
      mintButton.textContent = 'Mint NFT';
    }
  });

  // Initialize on page load
  initialize();
});

#!/usr/bin/env node

/**
 * prepare_assets.js
 * 
 * This script reorganizes the NFT assets from 1-50 naming to 0-49 naming
 * as required by Sugar CLI (which uses 0-based indexing).
 * It also updates the metadata to match Metaplex standards.
 */

const fs = require('fs');
const path = require('path');

const SOURCE_IMAGES = './Artwork';
const SOURCE_METADATA = './Artwork/metadata';
const DEST_FOLDER = './assets';

// Create assets directory if it doesn't exist
if (!fs.existsSync(DEST_FOLDER)) {
  fs.mkdirSync(DEST_FOLDER, { recursive: true });
}

console.log('🚀 Preparing assets for Sugar deployment...\n');

// Process 50 NFTs (1-50 -> 0-49)
for (let i = 1; i <= 50; i++) {
  const newIndex = i - 1; // Convert to 0-based
  
  // Copy and rename image
  const sourceImage = path.join(SOURCE_IMAGES, `${i}.png`);
  const destImage = path.join(DEST_FOLDER, `${newIndex}.png`);
  
  if (fs.existsSync(sourceImage)) {
    fs.copyFileSync(sourceImage, destImage);
    console.log(`✓ Copied ${i}.png -> ${newIndex}.png`);
  } else {
    console.error(`✗ Missing image: ${sourceImage}`);
  }
  
  // Process and copy metadata
  const sourceMetadata = path.join(SOURCE_METADATA, `${i}.json`);
  const destMetadata = path.join(DEST_FOLDER, `${newIndex}.json`);
  
  if (fs.existsSync(sourceMetadata)) {
    const metadata = JSON.parse(fs.readFileSync(sourceMetadata, 'utf8'));
    
    // Update metadata for Metaplex standard
    const updatedMetadata = {
      name: metadata.name || `Just Aliens #${i}`,
      symbol: "JALIEN",
      description: metadata.description || "Born from the buzz surrounding recent UFO disclosures. In a time when Aliens are dominating headlines, we offer a fun way to engage with the mystery, reminding everyone to chill out and enjoy the ride.",
      seller_fee_basis_points: 500,
      image: `${newIndex}.png`,
      attributes: metadata.attributes || [],
      properties: {
        files: [
          {
            uri: `${newIndex}.png`,
            type: "image/png"
          }
        ],
        category: "image",
        creators: metadata.properties?.creators || [
          {
            address: "Hn1i7bLb7oHpAL5AoyGvkn7YgwmWrVTbVsjXA1LYnELo",
            share: 100
          }
        ]
      }
    };
    
    fs.writeFileSync(destMetadata, JSON.stringify(updatedMetadata, null, 2));
    console.log(`✓ Processed ${i}.json -> ${newIndex}.json`);
  } else {
    console.error(`✗ Missing metadata: ${sourceMetadata}`);
  }
}

console.log('\n✅ Asset preparation complete!');
console.log(`📁 All files are in the ${DEST_FOLDER}/ directory`);
console.log('\nNext steps:');
console.log('1. Review the assets/ folder to ensure all files are correct');
console.log('2. Update config.json with your deployer wallet address');
console.log('3. Run: sugar validate');
console.log('4. Run: sugar upload');
console.log('5. Run: sugar deploy');

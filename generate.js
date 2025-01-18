const fs = require('fs-extra');
const path = require('path');
const sharp = require('sharp');

// Asset paths
const ASSETS_DIR = './Assets';
const OUTPUT_DIR = './output';
const STATE_FILE = path.join(OUTPUT_DIR, 'generation_state.json');

// Ensure output directory exists
fs.ensureDirSync(OUTPUT_DIR);

// Load previous state if it exists
async function loadState() {
    try {
        if (fs.existsSync(STATE_FILE)) {
            const state = await fs.readJson(STATE_FILE);
            console.log(`Found previous state. Last generated NFT: #${state.lastId}`);
            return state;
        }
    } catch (error) {
        console.error('Error loading state:', error);
    }
    return null;
}

// Save current state
async function saveState(lastId, usedCombinations) {
    try {
        await fs.writeJson(STATE_FILE, {
            lastId,
            usedCombinations: Array.from(usedCombinations)
        }, { spaces: 2 });
    } catch (error) {
        console.error('Error saving state:', error);
    }
}

// Helper function to get color from filename
function getColor(filename) {
    const colorMatch = filename.match(/(Blue|Green|Light-Blue|Pink|Red|White|Orange)/);
    return colorMatch ? colorMatch[1] : 'greyscale';
}

// Helper function to check if filename is solid
function isSolid(filename) {
    return filename.includes('Solid');
}

// Read all assets
async function getAssets() {
    const assets = {
        backgrounds: fs.readdirSync(path.join(ASSETS_DIR, 'Backgound')),
        clothing: fs.readdirSync(path.join(ASSETS_DIR, 'Clothing')),
        expressions: fs.readdirSync(path.join(ASSETS_DIR, 'Expression')),
        rare: fs.readdirSync(path.join(ASSETS_DIR, 'Rare')),
        secretRare: fs.readdirSync(path.join(ASSETS_DIR, 'SecretRare')),
        text: fs.readdirSync(path.join(ASSETS_DIR, 'Text'))
    };
    return assets;
}

// Validate combination based on rules
function isValidCombination(background, clothing, text) {
    // Get colors
    const bgColor = getColor(background);
    const textColor = getColor(text);
    
    // Rule: Maga clothing can't have text
    if (clothing && clothing.includes('Maga')) {
        return false;
    }
    
    // Rule: LeatherJacket and SportsJacket only with Solid text
    if (clothing && (clothing.includes('LeatherJacket') || clothing.includes('SportsJacket')) && !isSolid(text)) {
        return false;
    }
    
    // Rule: Color matching
    if (bgColor !== 'greyscale' && textColor !== 'greyscale' && bgColor !== textColor) {
        return false;
    }
    
    // Rule: Maga only with greyscale or Red
    if (clothing && clothing.includes('Maga') && bgColor !== 'greyscale' && bgColor !== 'Red') {
        return false;
    }
    
    // Rule: OG only with Green or greyscale
    if (clothing === 'OG.png' && bgColor !== 'greyscale' && bgColor !== 'Green') {
        return false;
    }
    
    return true;
}

// Helper function to generate hash for combination
function getCombinationHash(combo) {
    return `${combo.background || ''}-${combo.clothing || ''}-${combo.expression || ''}-${combo.text || ''}-${combo.rare || ''}`;
}

// Generate combinations
async function generateCombinations() {
    const assets = await getAssets();
    const combinations = [];
    let currentId = 1;
    let usedCombinations = new Set();
    const totalNFTs = 100; // Test with 100 NFTs to verify distribution

    // Try to load previous state
    const previousState = await loadState();
    if (previousState) {
        currentId = previousState.lastId + 1;
        usedCombinations = new Set(previousState.usedCombinations);
        console.log(`Resuming from NFT #${currentId}`);
    }

    // Calculate counts for each type
    const rareCount = Math.floor((totalNFTs - 7) * 0.0357); // 3.57% of total minus secret rare (maximum possible)
    const normalCount = totalNFTs - 7 - rareCount; // Remaining after rare and secret rare
    
    console.log('\nTarget NFT Distribution:');
    console.log('------------------------');
    console.log(`Normal NFTs: ${normalCount} (${((normalCount/totalNFTs)*100).toFixed(2)}%)`);
    console.log(`Rare NFTs: ${rareCount} (${((rareCount/totalNFTs)*100).toFixed(2)}%)`);
    console.log(`Secret Rare NFTs: 7 (${((7/totalNFTs)*100).toFixed(2)}%)`);
    console.log(`Total: ${totalNFTs}`);
    console.log('------------------------\n');

    // Generate rare combinations (with rare asset)
    while (combinations.length < rareCount) {
        // Required: Background and Rare asset
        const background = assets.backgrounds[Math.floor(Math.random() * assets.backgrounds.length)];
        const rare = assets.rare[Math.floor(Math.random() * assets.rare.length)];
        
        // Optional: Text (50% chance)
        const includeText = Math.random() > 0.5;
        const text = includeText ? assets.text[Math.floor(Math.random() * assets.text.length)] : null;

        // Skip if text color doesn't match
        if (text && !isValidCombination(background, null, text)) {
            continue;
        }

        const combo = {
            id: currentId,
            background,
            rare,
            text,
            isRare: true
        };

        const hash = getCombinationHash(combo);
        if (!usedCombinations.has(hash)) {
            console.log(`Generated Rare NFT #${currentId}:`, {
                background,
                rare,
                text: text || 'none'
            });
            usedCombinations.add(hash);
            combinations.push(combo);
            currentId++;
        }
    }

    // Generate normal combinations
    while (combinations.length < rareCount + normalCount) {
        // Required: Background, Clothing, and Expression (all must be present)
        const background = assets.backgrounds[Math.floor(Math.random() * assets.backgrounds.length)];
        const clothing = assets.clothing[Math.floor(Math.random() * assets.clothing.length)];
        const expression = assets.expressions[Math.floor(Math.random() * assets.expressions.length)];
        
        // Ensure we have all required assets before proceeding
        if (!background || !clothing || !expression) {
            continue;
        }
        
        // Optional: Text (50% chance)
        const includeText = Math.random() > 0.5;
        const text = includeText ? assets.text[Math.floor(Math.random() * assets.text.length)] : null;

        // Skip if text color doesn't match
        if (text && !isValidCombination(background, clothing, text)) {
            continue;
        }

        // Create combo only if we have all required assets
        const combo = {
            id: currentId,
            background,
            clothing,
            expression,
            text,
            type: 'normal' // Add type for extra validation
        };

        const hash = getCombinationHash(combo);
        if (!usedCombinations.has(hash)) {
            console.log(`Generated Normal NFT #${currentId}:`, {
                background,
                clothing,
                expression,
                text: text || 'none'
            });
            usedCombinations.add(hash);
            combinations.push(combo);
            currentId++;
        }
    }

    // Add Secret Rare at the end
    assets.secretRare.forEach(secretRare => {
        combinations.push({
            id: currentId,
            isSecretRare: true,
            file: secretRare
        });
        currentId++;
    });

    return combinations;
}

// Generate metadata for an NFT
function generateMetadata(combo) {
    const attributes = [];
    
    if (combo.isSecretRare) {
        attributes.push({
            trait_type: "Type",
            value: "Secret Rare"
        });
        attributes.push({
            trait_type: "Artwork",
            value: combo.file.replace(/\.[^/.]+$/, "") // Remove file extension
        });
    } else if (combo.isRare) {
        attributes.push({
            trait_type: "Type",
            value: "Rare"
        });
        attributes.push({
            trait_type: "Background",
            value: combo.background.replace(/\.[^/.]+$/, "")
        });
        attributes.push({
            trait_type: "Rare Type",
            value: combo.rare.replace(/\.[^/.]+$/, "")
        });
        if (combo.text) {
            attributes.push({
                trait_type: "Text",
                value: combo.text.replace(/\.[^/.]+$/, "")
            });
        }
    } else {
        attributes.push({
            trait_type: "Type",
            value: "Normal"
        });
        attributes.push({
            trait_type: "Background",
            value: combo.background.replace(/\.[^/.]+$/, "")
        });
        attributes.push({
            trait_type: "Clothing",
            value: combo.clothing.replace(/\.[^/.]+$/, "")
        });
        attributes.push({
            trait_type: "Expression",
            value: combo.expression.replace(/\.[^/.]+$/, "")
        });
        if (combo.text) {
            attributes.push({
                trait_type: "Text",
                value: combo.text.replace(/\.[^/.]+$/, "")
            });
        }
    }

    return {
        name: `Just Aliens #${combo.id}`,
        description: "Born from the buzz surrounding recent UFO disclosures. In a time when Aliens are dominating headlines, we offer a fun way to engage with the mystery, reminding everyone to chill out and enjoy the ride.",
        image: `${combo.id}.${combo.isSecretRare && combo.file.endsWith('.gif') ? 'gif' : 'png'}`,
        attributes,
        symbol: "JSTA",
        properties: {
            creators: [
                {
                    address: "Hn1i7bLb7oHpAL5AoyGvkn7YgwmWrVTbVsjXA1LYnELo",
                    share: 100
                }
            ],
            royalty: 5,
            files: [
                {
                    uri: `${combo.id}.${combo.isSecretRare && combo.file.endsWith('.gif') ? 'gif' : 'png'}`,
                    type: combo.isSecretRare && combo.file.endsWith('.gif') ? 'image/gif' : 'image/png'
                }
            ]
        }
    };
}

// Generate images and metadata
async function generateImages(combinations) {
    // Create metadata directory
    const metadataDir = path.join(OUTPUT_DIR, 'metadata');
    fs.ensureDirSync(metadataDir);

    for (const combo of combinations) {
        try {
            if (combo.isSecretRare) {
                // Handle Secret Rare with direct file copy
                const sourcePath = path.join(ASSETS_DIR, 'SecretRare', combo.file);
                const targetPath = path.join(OUTPUT_DIR, `${combo.id}.${combo.file.endsWith('.gif') ? 'gif' : 'png'}`);
                
                try {
                    // Verify source file exists and has content
                    const stats = await fs.stat(sourcePath);
                    if (stats.size === 0) {
                        throw new Error(`Secret Rare file ${combo.file} is empty`);
                    }

                    // Copy file synchronously to ensure complete binary copy
                    fs.copyFileSync(sourcePath, targetPath);

                    // Verify the copied file
                    const copiedStats = await fs.stat(targetPath);
                    if (copiedStats.size !== stats.size) {
                        throw new Error(`Secret Rare file ${combo.file} was not copied correctly (${copiedStats.size} != ${stats.size} bytes)`);
                    }

                    console.log(`Generated Secret Rare NFT #${combo.id}: ${combo.file} (${stats.size} bytes)`);
                } catch (error) {
                    console.error(`Error handling Secret Rare ${combo.file}:`, error);
                    throw error;
                }
            } else if (combo.isRare) {
                // Verify required assets for rare NFTs
                if (!combo.background || !combo.rare) {
                    throw new Error(`Missing required assets for Rare NFT #${combo.id}`);
                }

                // Build and verify layer paths for rare NFTs
                const backgroundPath = path.join(ASSETS_DIR, 'Backgound', combo.background);
                const rarePath = path.join(ASSETS_DIR, 'Rare', combo.rare);
                const textPath = combo.text ? path.join(ASSETS_DIR, 'Text', combo.text) : null;

                // Verify files exist
                if (!fs.existsSync(backgroundPath)) {
                    throw new Error(`Missing background file: ${backgroundPath} for Rare NFT #${combo.id}`);
                }
                if (!fs.existsSync(rarePath)) {
                    throw new Error(`Missing rare file: ${rarePath} for Rare NFT #${combo.id}`);
                }
                if (textPath && !fs.existsSync(textPath)) {
                    throw new Error(`Missing text file: ${textPath} for Rare NFT #${combo.id}`);
                }

                try {
                    // Prepare layers
                    const layers = [];
                    
                    // Background (always first)
                    console.log(`Processing background for Rare NFT #${combo.id}: ${combo.background}`);
                    const bgBuffer = await fs.readFile(backgroundPath);
                    
                    // Rare asset (always second)
                    console.log(`Processing rare asset for NFT #${combo.id}: ${combo.rare}`);
                    const rareBuffer = await fs.readFile(rarePath);
                    layers.push({ input: rareBuffer, top: 0, left: 0 });
                    
                    // Text (optional, always last)
                    if (textPath) {
                        console.log(`Processing text for Rare NFT #${combo.id}: ${combo.text}`);
                        const textBuffer = await fs.readFile(textPath);
                        layers.push({ input: textBuffer, top: 0, left: 0 });
                    }

                    // Combine all layers at once
                    const outputPath = path.join(OUTPUT_DIR, `${combo.id}.png`);
                    await sharp(bgBuffer)
                        .composite(layers)
                        .toFile(outputPath);
                    
                    // Verify the output
                    const outputStats = await fs.stat(outputPath);
                    if (outputStats.size === 0) {
                        throw new Error(`Generated image for Rare NFT #${combo.id} is empty`);
                    }
                    
                    console.log(`Successfully generated Rare NFT #${combo.id} with layers:`, {
                        background: combo.background,
                        rare: combo.rare,
                        text: combo.text || 'none'
                    });
                } catch (error) {
                    throw new Error(`Error compositing layers for Rare NFT #${combo.id}: ${error.message}`);
                }
            } else {
                // Double verify required assets for normal NFTs
                if (!combo.background || !combo.clothing || !combo.expression || combo.type !== 'normal') {
                    throw new Error(`Missing required assets for Normal NFT #${combo.id}`);
                }

                // Build and verify layer paths
                const backgroundPath = path.join(ASSETS_DIR, 'Backgound', combo.background);
                const clothingPath = path.join(ASSETS_DIR, 'Clothing', combo.clothing);
                const expressionPath = path.join(ASSETS_DIR, 'Expression', combo.expression);
                const textPath = combo.text ? path.join(ASSETS_DIR, 'Text', combo.text) : null;

                // Verify each required file exists
                if (!fs.existsSync(backgroundPath)) {
                    throw new Error(`Missing background file: ${backgroundPath} for NFT #${combo.id}`);
                }
                if (!fs.existsSync(clothingPath)) {
                    throw new Error(`Missing clothing file: ${clothingPath} for NFT #${combo.id}`);
                }
                if (!fs.existsSync(expressionPath)) {
                    throw new Error(`Missing expression file: ${expressionPath} for NFT #${combo.id}`);
                }
                if (textPath && !fs.existsSync(textPath)) {
                    throw new Error(`Missing text file: ${textPath} for NFT #${combo.id}`);
                }

                try {
                    // Prepare all layers upfront
                    const layers = [];
                    
                    // Background (always first)
                    console.log(`Processing background for NFT #${combo.id}: ${combo.background}`);
                    const bgBuffer = await fs.readFile(backgroundPath);
                    
                    // Clothing (always second)
                    console.log(`Processing clothing for NFT #${combo.id}: ${combo.clothing}`);
                    const clothingBuffer = await fs.readFile(clothingPath);
                    layers.push({ input: clothingBuffer, top: 0, left: 0 });
                    
                    // Expression (always third)
                    console.log(`Processing expression for NFT #${combo.id}: ${combo.expression}`);
                    const expressionBuffer = await fs.readFile(expressionPath);
                    layers.push({ input: expressionBuffer, top: 0, left: 0 });
                    
                    // Text (optional, always last)
                    if (textPath) {
                        console.log(`Processing text for NFT #${combo.id}: ${combo.text}`);
                        const textBuffer = await fs.readFile(textPath);
                        layers.push({ input: textBuffer, top: 0, left: 0 });
                    }

                    // Combine all layers at once
                    const outputPath = path.join(OUTPUT_DIR, `${combo.id}.png`);
                    await sharp(bgBuffer)
                        .composite(layers)
                        .toFile(outputPath);
                    
                    // Verify the output
                    const outputStats = await fs.stat(outputPath);
                    if (outputStats.size === 0) {
                        throw new Error(`Generated image for NFT #${combo.id} is empty`);
                    }
                    
                    console.log(`Successfully generated Normal NFT #${combo.id} with all layers:`, {
                        background: combo.background,
                        clothing: combo.clothing,
                        expression: combo.expression,
                        text: combo.text || 'none'
                    });
                } catch (error) {
                    throw new Error(`Error compositing layers for NFT #${combo.id}: ${error.message}`);
                }
            }

            // Generate and save metadata
            const metadata = generateMetadata(combo);
            await fs.writeJson(
                path.join(metadataDir, `${combo.id}.json`),
                metadata,
                { spaces: 2 }
            );

            // Save state after each successful NFT generation
            await saveState(combo.id, usedCombinations);

            // Log progress
            if (combo.id % 100 === 0) {
                console.log(`Generated ${combo.id} NFTs...`);
            }
        } catch (error) {
            console.error(`Error generating NFT #${combo.id}:`, error);
            throw error; // Re-throw to stop the process
        }
    }
}

// Main function
async function main() {
    try {
        console.log('Generating combinations...');
        const combinations = await generateCombinations();
        
        console.log('Generating images...');
        await generateImages(combinations);
        
        console.log('Done! Generated', combinations.length, 'NFTs');
    } catch (error) {
        console.error('Error:', error);
    }
}

main();

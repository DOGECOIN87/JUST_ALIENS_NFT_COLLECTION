const fs = require('fs-extra');
const path = require('path');
const sharp = require('sharp');

// Asset paths
const ASSETS_DIR = './Assets';
const OUTPUT_DIR = './Artwork';
const STATE_FILE = path.join(OUTPUT_DIR, 'generation_state.json');

// Ensure output directory exists
fs.ensureDirSync(OUTPUT_DIR);

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
        backgrounds: fs.readdirSync(path.join(ASSETS_DIR, 'Background')),
        clothing: fs.readdirSync(path.join(ASSETS_DIR, 'Clothing')),
        expressions: fs.readdirSync(path.join(ASSETS_DIR, 'Expression')),
        rare: fs.readdirSync(path.join(ASSETS_DIR, 'Rare')),
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

// Global state
let usedCombinations = new Set();

// Generate combinations
async function generateCombinations() {
    const assets = await getAssets();
    const combinations = [];
    let currentId = 1;
    const totalNFTs = 50; // Reduced to 50 NFTs

    // Calculate counts for each type
    const rareCount = Math.floor(totalNFTs * 0.0357); // 3.57% of total
    const normalCount = totalNFTs - rareCount; // Remaining after rare
    
    console.log('\nTarget NFT Distribution:');
    console.log('------------------------');
    console.log(`Normal NFTs: ${normalCount} (${((normalCount/totalNFTs)*100).toFixed(2)}%)`);
    console.log(`Rare NFTs: ${rareCount} (${((rareCount/totalNFTs)*100).toFixed(2)}%)`);
    console.log(`Total: ${totalNFTs}`);
    console.log('------------------------\n');

    // Generate rare combinations (with rare asset)
    while (combinations.length < rareCount) {
        const background = assets.backgrounds[Math.floor(Math.random() * assets.backgrounds.length)];
        const rare = assets.rare[Math.floor(Math.random() * assets.rare.length)];
        const includeText = Math.random() > 0.5;
        const text = includeText ? assets.text[Math.floor(Math.random() * assets.text.length)] : null;

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
    while (combinations.length < totalNFTs) {
        const background = assets.backgrounds[Math.floor(Math.random() * assets.backgrounds.length)];
        const clothing = assets.clothing[Math.floor(Math.random() * assets.clothing.length)];
        const expression = assets.expressions[Math.floor(Math.random() * assets.expressions.length)];
        
        if (!background || !clothing || !expression) {
            continue;
        }
        
        const includeText = Math.random() > 0.5;
        const text = includeText ? assets.text[Math.floor(Math.random() * assets.text.length)] : null;

        if (text && !isValidCombination(background, clothing, text)) {
            continue;
        }

        const combo = {
            id: currentId,
            background,
            clothing,
            expression,
            text,
            type: 'normal'
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

    return combinations;
}

// Generate metadata for an NFT
function generateMetadata(combo) {
    const attributes = [];
    
    if (combo.isRare) {
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
        image: `${combo.id}.png`,
        attributes,
        properties: {
            symbol: "JSTA",
            creators: [
                {
                    address: "Hn1i7bLb7oHpAL5AoyGvkn7YgwmWrVTbVsjXA1LYnELo",
                    share: 100
                }
            ],
            royalty: 500,
            files: [
                {
                    uri: `${combo.id}.png`,
                    type: 'image/png'
                }
            ]
        }
    };
}

// Generate images and metadata
async function generateImages(combinations) {
    const metadataDir = path.join(OUTPUT_DIR, 'metadata');
    fs.ensureDirSync(metadataDir);

    for (const combo of combinations) {
        try {
            if (combo.isRare) {
                if (!combo.background || !combo.rare) {
                    throw new Error(`Missing required assets for Rare NFT #${combo.id}`);
                }

                const backgroundPath = path.join(ASSETS_DIR, 'Background', combo.background);
                const rarePath = path.join(ASSETS_DIR, 'Rare', combo.rare);
                const textPath = combo.text ? path.join(ASSETS_DIR, 'Text', combo.text) : null;

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
                    const layers = [];
                    
                    console.log(`Processing background for Rare NFT #${combo.id}: ${combo.background}`);
                    const bgBuffer = await fs.readFile(backgroundPath);
                    
                    console.log(`Processing rare asset for NFT #${combo.id}: ${combo.rare}`);
                    const rareBuffer = await fs.readFile(rarePath);
                    layers.push({ input: rareBuffer, top: 0, left: 0 });
                    
                    if (textPath) {
                        console.log(`Processing text for Rare NFT #${combo.id}: ${combo.text}`);
                        const textBuffer = await fs.readFile(textPath);
                        layers.push({ input: textBuffer, top: 0, left: 0 });
                    }

                    const outputPath = path.join(OUTPUT_DIR, `${combo.id}.png`);
                    await sharp(bgBuffer)
                        .composite(layers)
                        .toFile(outputPath);
                    
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
                if (!combo.background || !combo.clothing || !combo.expression || combo.type !== 'normal') {
                    throw new Error(`Missing required assets for Normal NFT #${combo.id}`);
                }

                const backgroundPath = path.join(ASSETS_DIR, 'Background', combo.background);
                const clothingPath = path.join(ASSETS_DIR, 'Clothing', combo.clothing);
                const expressionPath = path.join(ASSETS_DIR, 'Expression', combo.expression);
                const textPath = combo.text ? path.join(ASSETS_DIR, 'Text', combo.text) : null;

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
                    const layers = [];
                    
                    console.log(`Processing background for NFT #${combo.id}: ${combo.background}`);
                    const bgBuffer = await fs.readFile(backgroundPath);
                    
                    console.log(`Processing clothing for NFT #${combo.id}: ${combo.clothing}`);
                    const clothingBuffer = await fs.readFile(clothingPath);
                    layers.push({ input: clothingBuffer, top: 0, left: 0 });
                    
                    console.log(`Processing expression for NFT #${combo.id}: ${combo.expression}`);
                    const expressionBuffer = await fs.readFile(expressionPath);
                    layers.push({ input: expressionBuffer, top: 0, left: 0 });
                    
                    if (textPath) {
                        console.log(`Processing text for NFT #${combo.id}: ${combo.text}`);
                        const textBuffer = await fs.readFile(textPath);
                        layers.push({ input: textBuffer, top: 0, left: 0 });
                    }

                    const outputPath = path.join(OUTPUT_DIR, `${combo.id}.png`);
                    await sharp(bgBuffer)
                        .composite(layers)
                        .toFile(outputPath);
                    
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

        } catch (error) {
            console.error(`Error generating NFT #${combo.id}:`, error);
            throw error;
        }
    }
}

// Main function
async function main() {
    try {
        console.log('Generating combinations...');
        const combinations = await generateCombinations();
        
        console.log(`Successfully generated ${combinations.length} combinations`);
        console.log('Starting image generation...');
        
        await generateImages(combinations);
        
        console.log('Done! Successfully generated', combinations.length, 'NFTs');
    } catch (error) {
        console.error('Fatal error:', error);
        process.exit(1);
    }
}

main();

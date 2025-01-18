const fs = require('fs');
const path = require('path');

// Read all assets
const backgrounds = fs.readdirSync(path.join('Assets', 'Background'));
const clothing = fs.readdirSync(path.join('Assets', 'Clothing'));
const expressions = fs.readdirSync(path.join('Assets', 'Expression'));
const text = fs.readdirSync(path.join('Assets', 'Text'));
const rare = fs.readdirSync(path.join('Assets', 'Rare'));

// Helper function to get color from filename
function getColor(filename) {
    const colorMatch = filename.match(/(Blue|Green|Light-Blue|Pink|Red|White|Orange)/);
    return colorMatch ? colorMatch[1] : 'greyscale';
}

// Count valid combinations
let totalCombinations = 0;
let normalWithoutText = 0;
let normalWithText = 0;
let rareCount = 0;

// Calculate normal combinations
backgrounds.forEach(bg => {
    const bgColor = getColor(bg);
    
    clothing.forEach(cloth => {
        expressions.forEach(expr => {
            // First count without text
            if (cloth.includes('Maga')) {
                // Maga only with greyscale or Red
                if (bgColor === 'greyscale' || bgColor === 'Red') {
                    normalWithoutText++;
                }
            } else if (cloth === 'OG.png') {
                // OG only with Green or greyscale
                if (bgColor === 'greyscale' || bgColor === 'Green') {
                    normalWithoutText++;
                }
            } else {
                normalWithoutText++;
            }

            // Then count with text
            text.forEach(t => {
                const textColor = getColor(t);
                const isSolidText = t.includes('Solid');
                
                // Skip if Maga (can't have text)
                if (cloth.includes('Maga')) {
                    return;
                }

                // LeatherJacket and SportsJacket only with Solid text
                if ((cloth.includes('LeatherJacket') || cloth.includes('SportsJacket')) && !isSolidText) {
                    return;
                }

                // Color matching rules
                if (bgColor !== 'greyscale' && textColor !== 'greyscale' && bgColor !== textColor) {
                    return;
                }

                normalWithText++;
            });
        });
    });
});

// Calculate rare combinations in detail
console.log('\nRare Combinations Breakdown:');
console.log('----------------------------');

let rareBreakdown = {};
rare.forEach(r => {
    let rareAssetCount = 0;
    let withTextCount = 0;
    let byBackground = {};

    backgrounds.forEach(bg => {
        const bgColor = getColor(bg);
        
        // Count without text
        rareAssetCount++;
        byBackground[bg] = { withoutText: 1, withText: [] };
        
        // Count with text
        text.forEach(t => {
            const textColor = getColor(t);
            
            // Color matching rules
            if (bgColor !== 'greyscale' && textColor !== 'greyscale' && bgColor !== textColor) {
                return;
            }
            
            withTextCount++;
            byBackground[bg].withText.push(t);
        });
    });

    rareBreakdown[r] = {
        totalWithoutText: rareAssetCount,
        totalWithText: withTextCount,
        total: rareAssetCount + withTextCount,
        byBackground
    };

    console.log(`\nRare Asset: ${r}`);
    console.log(`- Combinations without text: ${rareAssetCount}`);
    console.log(`- Combinations with text: ${withTextCount}`);
    console.log(`- Total combinations: ${rareAssetCount + withTextCount}`);
});

// Calculate total rare combinations
rareCount = Object.values(rareBreakdown).reduce((sum, item) => sum + item.total, 0);
totalCombinations = normalWithoutText + normalWithText + rareCount;

console.log('\nOverall Summary:');
console.log('----------------');
console.log('Normal NFTs without text:', normalWithoutText);
console.log('Normal NFTs with text:', normalWithText);
console.log('Total Rare NFT combinations:', rareCount);
console.log('Total possible unique combinations:', totalCombinations);

console.log('\nAsset Counts:');
console.log('------------');
console.log('Backgrounds:', backgrounds.length);
console.log('Clothing:', clothing.length);
console.log('Expressions:', expressions.length);
console.log('Text options:', text.length);
console.log('Rare assets:', rare.length);

// Calculate maximum possible rare NFTs
const maxRarePercentage = (rareCount / totalCombinations) * 100;
console.log(`\nMaximum possible rare percentage: ${maxRarePercentage.toFixed(2)}%`);

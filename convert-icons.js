const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sizes = [16, 48, 128];

async function convertSvgToPng() {
  for (const size of sizes) {
    const svgPath = path.join(__dirname, 'icons', `icon${size}.svg`);
    const pngPath = path.join(__dirname, 'icons', `icon${size}.png`);
    
    if (fs.existsSync(svgPath)) {
      try {
        const svgBuffer = fs.readFileSync(svgPath);
        
        await sharp(svgBuffer)
          .resize(size, size)
          .png()
          .toFile(pngPath);
        
        console.log(`✓ Created icon${size}.png (${size}x${size})`);
      } catch (error) {
        console.error(`✗ Failed to convert icon${size}.svg:`, error.message);
      }
    } else {
      console.error(`✗ File not found: ${svgPath}`);
    }
  }
  
  // Also convert main icon.svg to icon128.png if needed
  const mainIconPath = path.join(__dirname, 'icon.svg');
  if (fs.existsSync(mainIconPath)) {
    try {
      const svgBuffer = fs.readFileSync(mainIconPath);
      await sharp(svgBuffer)
        .resize(128, 128)
        .png()
        .toFile(path.join(__dirname, 'icon.png'));
      console.log('✓ Created icon.png (128x128)');
    } catch (error) {
      console.error('✗ Failed to convert icon.svg:', error.message);
    }
  }
}

convertSvgToPng().then(() => {
  console.log('\nAll icons converted successfully!');
}).catch(err => {
  console.error('Error:', err);
});

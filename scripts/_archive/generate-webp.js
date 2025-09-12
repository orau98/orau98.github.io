#!/usr/bin/env node

/**
 * Script to generate WebP versions of images for better performance
 * Requires: npm install sharp
 */

const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');

const IMAGE_DIRECTORIES = [
  'public/images/insects',
  'public/images/butterflies',
  'public/images/beetles',
  'public/images/leafbeetles'
];

const SUPPORTED_FORMATS = ['.jpg', '.jpeg', '.png'];

async function convertToWebP(inputPath, outputPath, quality = 85) {
  try {
    await sharp(inputPath)
      .webp({ quality })
      .toFile(outputPath);
    
    const inputStats = await fs.stat(inputPath);
    const outputStats = await fs.stat(outputPath);
    const reduction = ((1 - outputStats.size / inputStats.size) * 100).toFixed(1);
    
    console.log(`✓ Converted: ${path.basename(inputPath)} → ${path.basename(outputPath)} (${reduction}% smaller)`);
    return true;
  } catch (error) {
    console.error(`✗ Failed to convert ${inputPath}:`, error.message);
    return false;
  }
}

async function processDirectory(dirPath) {
  try {
    const files = await fs.readdir(dirPath);
    let converted = 0;
    let skipped = 0;
    
    console.log(`\nProcessing directory: ${dirPath}`);
    console.log(`Found ${files.length} files`);
    
    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      
      if (SUPPORTED_FORMATS.includes(ext)) {
        const inputPath = path.join(dirPath, file);
        const outputPath = path.join(dirPath, file.replace(ext, '.webp'));
        
        // Check if WebP already exists
        try {
          await fs.access(outputPath);
          const inputStats = await fs.stat(inputPath);
          const outputStats = await fs.stat(outputPath);
          
          // Skip if WebP is newer than source
          if (outputStats.mtime > inputStats.mtime) {
            skipped++;
            continue;
          }
        } catch (e) {
          // WebP doesn't exist, will create it
        }
        
        const success = await convertToWebP(inputPath, outputPath);
        if (success) converted++;
      }
    }
    
    console.log(`Completed: ${converted} converted, ${skipped} skipped`);
    return { converted, skipped };
  } catch (error) {
    console.error(`Error processing directory ${dirPath}:`, error);
    return { converted: 0, skipped: 0 };
  }
}

async function generateResponsiveImages(inputPath, sizes = [400, 800, 1200]) {
  const ext = path.extname(inputPath);
  const basename = path.basename(inputPath, ext);
  const dir = path.dirname(inputPath);
  
  for (const width of sizes) {
    const outputPath = path.join(dir, `${basename}_${width}w${ext}`);
    
    try {
      await sharp(inputPath)
        .resize(width, null, {
          withoutEnlargement: true,
          fit: 'inside'
        })
        .toFile(outputPath);
      
      console.log(`✓ Generated responsive image: ${width}w`);
    } catch (error) {
      console.error(`✗ Failed to generate ${width}w:`, error.message);
    }
  }
}

async function main() {
  console.log('🖼️  WebP Image Optimization Script');
  console.log('==================================\n');
  
  let totalConverted = 0;
  let totalSkipped = 0;
  
  // Check if sharp is installed
  try {
    require.resolve('sharp');
  } catch (e) {
    console.error('Error: sharp is not installed.');
    console.log('Please run: npm install sharp');
    process.exit(1);
  }
  
  // Process each directory
  for (const dir of IMAGE_DIRECTORIES) {
    const stats = await processDirectory(dir);
    totalConverted += stats.converted;
    totalSkipped += stats.skipped;
  }
  
  // Generate responsive images for hero image
  const heroImagePath = 'public/images/insects/Cucullia_argentea.jpg';
  try {
    await fs.access(heroImagePath);
    console.log('\nGenerating responsive versions for hero image...');
    await generateResponsiveImages(heroImagePath);
    
    // Also generate WebP versions of responsive images
    const basename = 'Cucullia_argentea';
    const dir = 'public/images/insects';
    for (const width of [400, 800, 1200]) {
      const jpgPath = path.join(dir, `${basename}_${width}w.jpg`);
      const webpPath = path.join(dir, `${basename}_${width}w.webp`);
      
      try {
        await fs.access(jpgPath);
        await convertToWebP(jpgPath, webpPath, 90);
      } catch (e) {
        // Responsive image doesn't exist yet
      }
    }
  } catch (e) {
    console.log('Hero image not found, skipping responsive generation');
  }
  
  console.log('\n==================================');
  console.log(`✅ Total converted: ${totalConverted}`);
  console.log(`⏭️  Total skipped: ${totalSkipped}`);
  console.log('==================================\n');
}

// Run the script
main().catch(console.error);
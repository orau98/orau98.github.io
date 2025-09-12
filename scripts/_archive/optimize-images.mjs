#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '..');

const ORIGINALS_DIR = path.join(ROOT_DIR, 'images', 'originals');
const OUTPUT_DIR = path.join(ROOT_DIR, 'public', 'images');
const LARGE_ORIGINALS_DIR = path.join(OUTPUT_DIR, 'originals');

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif'];
const MAX_ORIGINAL_SIZE = 2 * 1024 * 1024; // 2MB

const config = {
  webp: {
    quality: 82,
    effort: 4
  },
  avif: {
    quality: 60,
    effort: 4
  },
  resize: {
    maxWidth: 1920,
    maxHeight: 1080,
    withoutEnlargement: true,
    fit: 'inside'
  }
};

let stats = {
  processed: 0,
  skipped: 0,
  errors: [],
  totalSaved: 0
};

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function getImageSize(filePath) {
  try {
    const stats = await fs.stat(filePath);
    return stats.size;
  } catch {
    return 0;
  }
}

async function processImage(inputPath, relativePath) {
  const basename = path.basename(inputPath, path.extname(inputPath));
  const category = path.dirname(relativePath);
  
  const outputBase = path.join(OUTPUT_DIR, category);
  await ensureDir(outputBase);
  
  const webpPath = path.join(outputBase, `${basename}.webp`);
  const avifPath = path.join(outputBase, `${basename}.avif`);
  
  try {
    const originalSize = await getImageSize(inputPath);
    console.log(`  Processing: ${relativePath} (${(originalSize / 1024 / 1024).toFixed(2)} MB)`);
    
    const image = sharp(inputPath);
    const metadata = await image.metadata();
    
    // Skip if already optimized formats
    if (inputPath.endsWith('.webp') || inputPath.endsWith('.avif')) {
      console.log(`    Skipping: Already optimized format`);
      stats.skipped++;
      return;
    }
    
    // Check if conversions already exist
    const webpExists = await fs.access(webpPath).then(() => true).catch(() => false);
    const avifExists = await fs.access(avifPath).then(() => true).catch(() => false);
    
    if (webpExists && avifExists) {
      console.log(`    Skipping: Optimized versions already exist`);
      stats.skipped++;
      return;
    }
    
    // Resize if needed
    let pipeline = image;
    if (metadata.width > config.resize.maxWidth || metadata.height > config.resize.maxHeight) {
      pipeline = pipeline.resize(config.resize);
    }
    
    // Generate WebP
    if (!webpExists) {
      await pipeline.webp(config.webp).toFile(webpPath);
      const webpSize = await getImageSize(webpPath);
      console.log(`    ✓ WebP: ${(webpSize / 1024).toFixed(1)} KB`);
    }
    
    // Generate AVIF
    if (!avifExists) {
      await pipeline.avif(config.avif).toFile(avifPath);
      const avifSize = await getImageSize(avifPath);
      console.log(`    ✓ AVIF: ${(avifSize / 1024).toFixed(1)} KB`);
    }
    
    // If original is >2MB, create a smaller JPEG copy in public
    if (originalSize > MAX_ORIGINAL_SIZE) {
      const publicOriginalPath = path.join(LARGE_ORIGINALS_DIR, category, `${basename}.jpg`);
      await ensureDir(path.dirname(publicOriginalPath));
      
      const publicOriginalExists = await fs.access(publicOriginalPath).then(() => true).catch(() => false);
      
      if (!publicOriginalExists) {
        await pipeline.jpeg({ quality: 85, progressive: true }).toFile(publicOriginalPath);
        const publicSize = await getImageSize(publicOriginalPath);
        console.log(`    ✓ Public original: ${(publicSize / 1024 / 1024).toFixed(2)} MB`);
      }
    }
    
    // Calculate savings
    const webpSize = await getImageSize(webpPath);
    const avifSize = await getImageSize(avifPath);
    const saved = originalSize - Math.min(webpSize, avifSize);
    stats.totalSaved += saved;
    
    console.log(`    Saved: ${(saved / 1024).toFixed(1)} KB (${Math.round(saved / originalSize * 100)}%)`);
    stats.processed++;
    
  } catch (error) {
    console.error(`    ✗ Error: ${error.message}`);
    stats.errors.push({ file: relativePath, error: error.message });
  }
}

async function findImages(dir, baseDir = dir) {
  const images = [];
  
  try {
    const items = await fs.readdir(dir, { withFileTypes: true });
    
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      
      if (item.isDirectory()) {
        images.push(...await findImages(fullPath, baseDir));
      } else {
        const ext = path.extname(item.name).toLowerCase();
        if (IMAGE_EXTENSIONS.includes(ext)) {
          images.push({
            path: fullPath,
            relative: path.relative(baseDir, fullPath)
          });
        }
      }
    }
  } catch (error) {
    console.warn(`Could not read directory ${dir}: ${error.message}`);
  }
  
  return images;
}

async function processNewImages(specificPath = null) {
  console.log('🖼️  Image Optimization Tool\n');
  
  let imagesToProcess = [];
  
  if (specificPath) {
    // Process specific file or directory
    const fullPath = path.resolve(specificPath);
    const stat = await fs.stat(fullPath);
    
    if (stat.isDirectory()) {
      imagesToProcess = await findImages(fullPath);
    } else {
      const ext = path.extname(fullPath).toLowerCase();
      if (IMAGE_EXTENSIONS.includes(ext)) {
        imagesToProcess = [{
          path: fullPath,
          relative: path.basename(fullPath)
        }];
      }
    }
  } else {
    // Process all images in originals directory
    await ensureDir(ORIGINALS_DIR);
    imagesToProcess = await findImages(ORIGINALS_DIR);
  }
  
  if (imagesToProcess.length === 0) {
    console.log('No images found to process.');
    return;
  }
  
  console.log(`Found ${imagesToProcess.length} images to process.\n`);
  
  for (const img of imagesToProcess) {
    await processImage(img.path, img.relative);
  }
  
  // Generate report
  console.log('\n✅ Optimization complete!\n');
  console.log('📊 Summary:');
  console.log(`   - Images processed: ${stats.processed}`);
  console.log(`   - Images skipped: ${stats.skipped}`);
  console.log(`   - Total space saved: ${(stats.totalSaved / 1024 / 1024).toFixed(2)} MB`);
  
  if (stats.errors.length > 0) {
    console.log(`   - Errors: ${stats.errors.length}`);
    console.log('\n❌ Errors:');
    stats.errors.forEach(e => {
      console.log(`   - ${e.file}: ${e.error}`);
    });
  }
}

// Handle command line arguments
const args = process.argv.slice(2);

if (args.includes('--help')) {
  console.log(`
Usage: node optimize-images.mjs [options] [path]

Options:
  --help     Show this help message
  [path]     Specific file or directory to process (optional)

Examples:
  node optimize-images.mjs                    # Process all images in images/originals/
  node optimize-images.mjs path/to/image.jpg  # Process specific image
  node optimize-images.mjs path/to/dir        # Process all images in directory
`);
  process.exit(0);
}

// Check if sharp is installed
try {
  await import('sharp');
} catch {
  console.error('❌ Error: sharp is not installed.');
  console.error('Please run: npm install sharp');
  process.exit(1);
}

// Main execution
processNewImages(args[0]).catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
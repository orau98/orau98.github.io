#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '..');

const inventory = {
  toDelete: [],
  toArchive: {
    data: [],
    misc: []
  },
  images: {
    originals: [],
    large: []
  },
  stats: {
    totalFiles: 0,
    csvFiles: 0,
    imageFiles: 0,
    testFiles: 0
  }
};

const NOISE_PATTERNS = [
  /^\.DS_Store$/,
  /^\._.*/,
  /^__MACOSX/,
  /\.map$/
];

const ARCHIVE_PATTERNS = {
  csv: [
    /_final\.csv$/,
    /_fixed\.csv$/,
    /_corrected\.csv$/,
    /_master.*\.csv$/,
    /_integrated\.csv$/
  ],
  test: [
    /test/i,
    /sample/i,
    /trial/i,
    /sandbox/i,
    /icon-test/i,
    /butterfly/i,
    /debug/i,
    /temp/i,
    /tmp/i
  ]
};

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.svg'];

async function walkDirectory(dir, baseDir = dir) {
  const files = [];
  const items = await fs.readdir(dir, { withFileTypes: true });
  
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    const relativePath = path.relative(ROOT_DIR, fullPath);
    
    // Skip node_modules and .git
    if (item.name === 'node_modules' || item.name === '.git') continue;
    
    if (item.isDirectory()) {
      files.push(...await walkDirectory(fullPath, baseDir));
    } else {
      files.push({
        path: fullPath,
        relative: relativePath,
        name: item.name,
        dir: path.dirname(relativePath)
      });
    }
  }
  
  return files;
}

async function analyzeFile(file) {
  const stats = await fs.stat(file.path);
  file.size = stats.size;
  
  // Check for noise files
  for (const pattern of NOISE_PATTERNS) {
    if (pattern.test(file.name)) {
      inventory.toDelete.push({
        ...file,
        reason: 'Noise file (OS/build artifact)'
      });
      return;
    }
  }
  
  // Check for CSV files to archive
  if (file.name.endsWith('.csv')) {
    inventory.stats.csvFiles++;
    
    for (const pattern of ARCHIVE_PATTERNS.csv) {
      if (pattern.test(file.name) && !file.relative.includes('archive')) {
        inventory.toArchive.data.push({
          ...file,
          reason: 'Legacy/duplicate CSV version'
        });
        return;
      }
    }
  }
  
  // Check for test/sample files
  for (const pattern of ARCHIVE_PATTERNS.test) {
    if (pattern.test(file.name) && !file.relative.includes('node_modules')) {
      inventory.stats.testFiles++;
      inventory.toArchive.misc.push({
        ...file,
        reason: 'Test/sample/temporary file'
      });
      return;
    }
  }
  
  // Check for images
  const ext = path.extname(file.name).toLowerCase();
  if (IMAGE_EXTENSIONS.includes(ext)) {
    inventory.stats.imageFiles++;
    
    // Large images (>2MB)
    if (file.size > 2 * 1024 * 1024) {
      inventory.images.large.push({
        ...file,
        sizeMB: (file.size / 1024 / 1024).toFixed(2)
      });
    }
    
    // Images not in optimized locations
    if (!file.relative.includes('public/images') && 
        !file.relative.includes('images/originals') &&
        !file.relative.includes('node_modules')) {
      inventory.images.originals.push(file);
    }
  }
  
  inventory.stats.totalFiles++;
}

async function generateReport() {
  const report = [];
  
  report.push('# Cleanup Inventory Report');
  report.push(`Generated: ${new Date().toISOString()}\n`);
  
  report.push('## Statistics');
  report.push(`- Total files analyzed: ${inventory.stats.totalFiles}`);
  report.push(`- CSV files: ${inventory.stats.csvFiles}`);
  report.push(`- Image files: ${inventory.stats.imageFiles}`);
  report.push(`- Test/sample files: ${inventory.stats.testFiles}\n`);
  
  report.push('## Files to Delete (Noise)');
  report.push(`Count: ${inventory.toDelete.length}`);
  if (inventory.toDelete.length > 0) {
    report.push('```');
    inventory.toDelete.slice(0, 20).forEach(f => {
      report.push(`${f.relative} (${f.reason})`);
    });
    if (inventory.toDelete.length > 20) {
      report.push(`... and ${inventory.toDelete.length - 20} more`);
    }
    report.push('```\n');
  }
  
  report.push('## Files to Archive');
  
  report.push('### Data Archive (CSV versions)');
  report.push(`Count: ${inventory.toArchive.data.length}`);
  if (inventory.toArchive.data.length > 0) {
    report.push('```');
    inventory.toArchive.data.slice(0, 10).forEach(f => {
      report.push(`${f.relative}`);
    });
    if (inventory.toArchive.data.length > 10) {
      report.push(`... and ${inventory.toArchive.data.length - 10} more`);
    }
    report.push('```\n');
  }
  
  report.push('### Misc Archive (test/sample files)');
  report.push(`Count: ${inventory.toArchive.misc.length}`);
  if (inventory.toArchive.misc.length > 0) {
    report.push('```');
    inventory.toArchive.misc.slice(0, 10).forEach(f => {
      report.push(`${f.relative}`);
    });
    if (inventory.toArchive.misc.length > 10) {
      report.push(`... and ${inventory.toArchive.misc.length - 10} more`);
    }
    report.push('```\n');
  }
  
  report.push('## Images');
  
  report.push('### Large Images (>2MB)');
  report.push(`Count: ${inventory.images.large.length}`);
  if (inventory.images.large.length > 0) {
    report.push('```');
    inventory.images.large.slice(0, 10).forEach(f => {
      report.push(`${f.relative} (${f.sizeMB} MB)`);
    });
    if (inventory.images.large.length > 10) {
      report.push(`... and ${inventory.images.large.length - 10} more`);
    }
    report.push('```\n');
  }
  
  report.push('### Images to Move to Originals');
  report.push(`Count: ${inventory.images.originals.length}`);
  if (inventory.images.originals.length > 0) {
    report.push('```');
    inventory.images.originals.slice(0, 10).forEach(f => {
      report.push(f.relative);
    });
    if (inventory.images.originals.length > 10) {
      report.push(`... and ${inventory.images.originals.length - 10} more`);
    }
    report.push('```\n');
  }
  
  return report.join('\n');
}

async function main() {
  console.log('🔍 Analyzing repository structure...\n');
  
  try {
    const files = await walkDirectory(ROOT_DIR);
    
    console.log(`Found ${files.length} files. Analyzing...`);
    
    for (const file of files) {
      await analyzeFile(file);
    }
    
    // Save inventory as JSON
    await fs.writeFile(
      path.join(ROOT_DIR, 'reports', 'cleanup-inventory.json'),
      JSON.stringify(inventory, null, 2)
    );
    
    // Generate and save report
    const report = await generateReport();
    await fs.writeFile(
      path.join(ROOT_DIR, 'reports', 'cleanup-inventory.md'),
      report
    );
    
    console.log('\n✅ Inventory complete!');
    console.log('📊 Reports saved to:');
    console.log('   - reports/cleanup-inventory.json');
    console.log('   - reports/cleanup-inventory.md');
    
    console.log('\n📈 Summary:');
    console.log(`   - Files to delete: ${inventory.toDelete.length}`);
    console.log(`   - Files to archive: ${inventory.toArchive.data.length + inventory.toArchive.misc.length}`);
    console.log(`   - Large images: ${inventory.images.large.length}`);
    console.log(`   - Images to organize: ${inventory.images.originals.length}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
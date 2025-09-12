#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '..');

const args = process.argv.slice(2);
const isDryRun = !args.includes('--apply');
const verbose = args.includes('--verbose');

let actions = {
  deleted: [],
  archived: [],
  moved: [],
  errors: []
};

async function ensureDir(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (error) {
    console.error(`Failed to create directory ${dir}:`, error.message);
  }
}

async function moveFile(from, to) {
  if (isDryRun) {
    console.log(`  [DRY-RUN] Would move: ${from} → ${to}`);
    return true;
  }
  
  try {
    await ensureDir(path.dirname(to));
    await fs.rename(from, to);
    if (verbose) console.log(`  ✓ Moved: ${from} → ${to}`);
    return true;
  } catch (error) {
    console.error(`  ✗ Failed to move ${from}:`, error.message);
    actions.errors.push({ file: from, error: error.message });
    return false;
  }
}

async function deleteFile(file) {
  if (isDryRun) {
    console.log(`  [DRY-RUN] Would delete: ${file}`);
    return true;
  }
  
  try {
    await fs.unlink(file);
    if (verbose) console.log(`  ✓ Deleted: ${file}`);
    return true;
  } catch (error) {
    console.error(`  ✗ Failed to delete ${file}:`, error.message);
    actions.errors.push({ file, error: error.message });
    return false;
  }
}

async function loadInventory() {
  try {
    const data = await fs.readFile(
      path.join(ROOT_DIR, 'reports', 'cleanup-inventory.json'),
      'utf-8'
    );
    return JSON.parse(data);
  } catch (error) {
    console.error('Failed to load inventory. Run cleanup-inventory.mjs first.');
    process.exit(1);
  }
}

async function processDeletes(inventory) {
  console.log('\n🗑️  Processing deletions...');
  
  for (const file of inventory.toDelete) {
    const fullPath = path.join(ROOT_DIR, file.relative);
    
    try {
      await fs.access(fullPath);
      if (await deleteFile(fullPath)) {
        actions.deleted.push(file.relative);
      }
    } catch {
      // File doesn't exist, skip
    }
  }
  
  console.log(`  Deleted: ${actions.deleted.length} files`);
}

async function processArchives(inventory) {
  console.log('\n📦 Processing archives...');
  
  // Create archive directories
  const dataArchive = path.join(ROOT_DIR, 'data', 'archive');
  const miscArchive = path.join(ROOT_DIR, 'misc', 'archive');
  
  if (!isDryRun) {
    await ensureDir(dataArchive);
    await ensureDir(miscArchive);
  }
  
  // Archive data files
  console.log('  Archiving CSV versions...');
  for (const file of inventory.toArchive.data) {
    const from = path.join(ROOT_DIR, file.relative);
    const to = path.join(dataArchive, path.basename(file.relative));
    
    try {
      await fs.access(from);
      if (await moveFile(from, to)) {
        actions.archived.push({
          from: file.relative,
          to: path.relative(ROOT_DIR, to)
        });
      }
    } catch {
      // File doesn't exist, skip
    }
  }
  
  // Archive misc files
  console.log('  Archiving test/sample files...');
  for (const file of inventory.toArchive.misc) {
    const from = path.join(ROOT_DIR, file.relative);
    const relativePath = file.relative.replace(/^\.\//, '');
    const to = path.join(miscArchive, relativePath);
    
    try {
      await fs.access(from);
      if (await moveFile(from, to)) {
        actions.archived.push({
          from: file.relative,
          to: path.relative(ROOT_DIR, to)
        });
      }
    } catch {
      // File doesn't exist, skip
    }
  }
  
  console.log(`  Archived: ${actions.archived.length} files`);
}

async function processImages(inventory) {
  console.log('\n🖼️  Processing images...');
  
  const originalsDir = path.join(ROOT_DIR, 'images', 'originals');
  
  if (!isDryRun) {
    await ensureDir(originalsDir);
  }
  
  console.log('  Moving images to originals directory...');
  for (const file of inventory.images.originals) {
    const from = path.join(ROOT_DIR, file.relative);
    const category = file.relative.includes('insects') ? 'insects' : 
                     file.relative.includes('plants') ? 'plants' : 'misc';
    const targetDir = path.join(originalsDir, category);
    const to = path.join(targetDir, path.basename(file.relative));
    
    try {
      await fs.access(from);
      if (await moveFile(from, to)) {
        actions.moved.push({
          from: file.relative,
          to: path.relative(ROOT_DIR, to)
        });
      }
    } catch {
      // File doesn't exist, skip
    }
  }
  
  console.log(`  Moved: ${actions.moved.length} images`);
}

async function generateReport() {
  const report = [];
  
  report.push('# Cleanup Execution Report');
  report.push(`Date: ${new Date().toISOString()}`);
  report.push(`Mode: ${isDryRun ? 'DRY RUN' : 'APPLIED'}\n`);
  
  report.push('## Summary');
  report.push(`- Files deleted: ${actions.deleted.length}`);
  report.push(`- Files archived: ${actions.archived.length}`);
  report.push(`- Images moved: ${actions.moved.length}`);
  report.push(`- Errors: ${actions.errors.length}\n`);
  
  if (actions.deleted.length > 0) {
    report.push('## Deleted Files');
    report.push('```');
    actions.deleted.slice(0, 20).forEach(f => report.push(f));
    if (actions.deleted.length > 20) {
      report.push(`... and ${actions.deleted.length - 20} more`);
    }
    report.push('```\n');
  }
  
  if (actions.archived.length > 0) {
    report.push('## Archived Files');
    report.push('```');
    actions.archived.slice(0, 20).forEach(f => {
      report.push(`${f.from} → ${f.to}`);
    });
    if (actions.archived.length > 20) {
      report.push(`... and ${actions.archived.length - 20} more`);
    }
    report.push('```\n');
  }
  
  if (actions.moved.length > 0) {
    report.push('## Moved Images');
    report.push('```');
    actions.moved.slice(0, 20).forEach(f => {
      report.push(`${f.from} → ${f.to}`);
    });
    if (actions.moved.length > 20) {
      report.push(`... and ${actions.moved.length - 20} more`);
    }
    report.push('```\n');
  }
  
  if (actions.errors.length > 0) {
    report.push('## Errors');
    report.push('```');
    actions.errors.forEach(e => {
      report.push(`${e.file}: ${e.error}`);
    });
    report.push('```\n');
  }
  
  return report.join('\n');
}

async function main() {
  console.log('🧹 Repository Cleanup Tool');
  console.log(`Mode: ${isDryRun ? 'DRY RUN (use --apply to execute)' : 'APPLY CHANGES'}`);
  
  if (!isDryRun) {
    console.log('\n⚠️  WARNING: This will modify your repository!');
    console.log('Press Ctrl+C to cancel, or wait 3 seconds to continue...\n');
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  
  const inventory = await loadInventory();
  
  // Process in order
  await processDeletes(inventory);
  await processArchives(inventory);
  await processImages(inventory);
  
  // Generate report
  const report = await generateReport();
  const reportPath = path.join(
    ROOT_DIR, 
    'reports', 
    `cleanup-${isDryRun ? 'dryrun' : 'applied'}-${Date.now()}.md`
  );
  
  await fs.writeFile(reportPath, report);
  
  console.log('\n✅ Cleanup complete!');
  console.log(`📊 Report saved to: ${path.relative(ROOT_DIR, reportPath)}`);
  
  console.log('\n📈 Final Summary:');
  console.log(`   - Files deleted: ${actions.deleted.length}`);
  console.log(`   - Files archived: ${actions.archived.length}`);
  console.log(`   - Images moved: ${actions.moved.length}`);
  
  if (actions.errors.length > 0) {
    console.log(`   - ⚠️  Errors: ${actions.errors.length}`);
  }
  
  if (isDryRun) {
    console.log('\n💡 This was a dry run. Use --apply to execute changes.');
  }
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
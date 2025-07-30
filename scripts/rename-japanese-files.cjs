const fs = require('fs');
const Papa = require('papaparse');
const path = require('path');

/**
 * 和名ファイルを学名ベースのファイル名にリネームするスクリプト
 */

// 和名から学名へのマッピングを作成
const createJapaneseToScientificMapping = () => {
  console.log('📋 Creating Japanese to Scientific name mapping...');
  
  const csvFiles = [
    'ListMJ_hostplants_master.csv',
    'buprestidae_host.csv',
    'hamushi_species_integrated.csv',
    'butterfly_host.csv'
  ];
  
  const mapping = new Map();
  
  csvFiles.forEach(filename => {
    const csvPath = path.join(__dirname, '..', 'public', filename);
    if (!fs.existsSync(csvPath)) {
      console.log(`⚠️  File not found: ${filename}`);
      return;
    }
    
    const csvData = fs.readFileSync(csvPath, 'utf8');
    const parsed = Papa.parse(csvData, { header: true, skipEmptyLines: true });
    
    parsed.data.forEach(row => {
      const japaneseName = row['和名']?.trim();
      const scientificName = row['学名']?.trim();
      
      if (japaneseName && scientificName) {
        mapping.set(japaneseName, scientificName);
      }
    });
  });
  
  console.log(`📊 Created mapping for ${mapping.size} species`);
  return mapping;
};

// 学名をファイル名に適したフォーマットに変換
const scientificNameToFilename = (scientificName) => {
  if (!scientificName) return '';
  
  // Remove author and year information (everything in parentheses)
  let cleaned = scientificName.replace(/\s*\([^)]*\)\s*/g, '');
  
  // Remove trailing punctuation and extra spaces
  cleaned = cleaned.replace(/[.,;]\s*$/, '').trim();
  
  // Replace spaces with underscores
  cleaned = cleaned.replace(/\s+/g, '_');
  
  // Remove any remaining special characters except underscores
  cleaned = cleaned.replace(/[^a-zA-Z0-9_]/g, '');
  
  return cleaned;
};

// 現在の和名ファイルを取得
const getJapaneseImageFiles = () => {
  const imagesDir = path.join(__dirname, '..', 'public', 'images', 'insects');
  const files = fs.readdirSync(imagesDir);
  
  // 日本語文字を含むファイルを検出（ひらがな、カタカナ、漢字）
  const japaneseFiles = files.filter(filename => {
    return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(filename);
  });
  
  console.log(`🔍 Found ${japaneseFiles.length} Japanese filename images:`);
  japaneseFiles.forEach(file => console.log(`  - ${file}`));
  
  return japaneseFiles;
};

// メイン処理
const main = () => {
  console.log('🚀 Starting Japanese filename to Scientific filename conversion...');
  
  const mapping = createJapaneseToScientificMapping();
  const japaneseFiles = getJapaneseImageFiles();
  
  if (japaneseFiles.length === 0) {
    console.log('✅ No Japanese filename images found.');
    return;
  }
  
  const renames = [];
  const imagesDir = path.join(__dirname, '..', 'public', 'images', 'insects');
  
  japaneseFiles.forEach(filename => {
    // Extract Japanese name from filename (remove extension and extra info)
    const nameWithoutExt = path.parse(filename).name;
    
    // Try to extract just the Japanese name part (before any scientific name or extra info)
    let japaneseName = nameWithoutExt;
    
    // Remove scientific name parts if they exist in the filename
    japaneseName = japaneseName.replace(/\s+[A-Z][a-z]+\s+[a-z]+.*$/, '').trim();
    japaneseName = japaneseName.replace(/\s*\([^)]*\).*$/, '').trim();
    japaneseName = japaneseName.replace(/\s*\(\d+\)$/, '').trim(); // Remove (1), (2), etc.
    
    console.log(`\n🔍 Processing: ${filename}`);
    console.log(`   Extracted name: "${japaneseName}"`);
    
    const scientificName = mapping.get(japaneseName);
    if (scientificName) {
      const scientificFilename = scientificNameToFilename(scientificName);
      const extension = path.extname(filename);
      const newFilename = scientificFilename + extension;
      
      console.log(`   Scientific name: ${scientificName}`);
      console.log(`   New filename: ${newFilename}`);
      
      // Check if target file already exists
      const oldPath = path.join(imagesDir, filename);
      const newPath = path.join(imagesDir, newFilename);
      
      if (fs.existsSync(newPath)) {
        console.log(`   ⚠️  Target file already exists: ${newFilename}`);
        console.log(`   📁 Will backup existing file`);
        
        // Create backup of existing file
        const backupFilename = `${scientificFilename}_backup${extension}`;
        const backupPath = path.join(imagesDir, backupFilename);
        fs.copyFileSync(newPath, backupPath);
        console.log(`   💾 Created backup: ${backupFilename}`);
      }
      
      renames.push({
        oldPath,
        newPath,
        oldFilename: filename,
        newFilename,
        japaneseName,
        scientificName
      });
    } else {
      console.log(`   ❌ No scientific name found for: "${japaneseName}"`);
    }
  });
  
  if (renames.length === 0) {
    console.log('\n⚠️  No files to rename. Please check the mapping.');
    return;
  }
  
  console.log(`\n📋 Summary: ${renames.length} files to rename`);
  renames.forEach(rename => {
    console.log(`  ${rename.oldFilename} → ${rename.newFilename}`);
  });
  
  // Ask for confirmation
  console.log('\n⚠️  This will rename the files. Continue? (This script will proceed automatically)');
  
  // Perform renames
  let successCount = 0;
  renames.forEach(rename => {
    try {
      fs.renameSync(rename.oldPath, rename.newPath);
      console.log(`✅ Renamed: ${rename.oldFilename} → ${rename.newFilename}`);
      successCount++;
    } catch (error) {
      console.log(`❌ Failed to rename ${rename.oldFilename}: ${error.message}`);
    }
  });
  
  console.log(`\n🎯 Rename complete: ${successCount}/${renames.length} files renamed successfully`);
  
  if (successCount > 0) {
    console.log('\n📝 Next steps:');
    console.log('1. Update image_extensions.json if needed');
    console.log('2. Test the website to ensure images still display');
    console.log('3. Commit and deploy the changes');
  }
};

// Execute
main();
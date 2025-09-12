const fs = require('fs');
const path = require('path');

/**
 * 残り9件の和名ファイルを学名ベースのファイル名にリネームするスクリプト
 * マッピングを直接指定して確実にリネーム
 */

// 和名から学名への直接マッピング（CSVから抽出）
const japaneseToScientificMapping = new Map([
  ['アオマダラタマムシ', 'Nipponobuprestis_amabilis'],
  ['クロハナコヤガ', 'Aventiola_pusilla'],
  ['ナシイラガ', 'Narosoideus_flavidorsalis'],
  ['ヒメスズメ', 'Deilephila_askoldensis'],
  ['フタスジエグリアツバ', 'Gonepatica_opalina'],
  ['ベニスズメ', 'Deilephila_elpenor'],
  ['マダラキボシキリガ', 'Dimorphicosmia_variegata'],
  ['ヨモギオオホソハマキ', 'Phtheochroides_clandestina'],
  ['ルイスヒラタチビタマムシ', 'Habroloma_lewisii']
]);

// 現在の和名ファイルを取得
const getRemainingJapaneseFiles = () => {
  const imagesDir = path.join(__dirname, '..', 'public', 'images', 'insects');
  const files = fs.readdirSync(imagesDir);
  
  // 残り9件の和名ファイルを検出
  const targetNames = Array.from(japaneseToScientificMapping.keys());
  const japaneseFiles = files.filter(filename => {
    const baseName = path.parse(filename).name;
    // Remove extra info like "(2)" or scientific names in parentheses
    const cleanName = baseName.replace(/\s*\([^)]*\).*$/, '').trim();
    return targetNames.includes(cleanName);
  });
  
  console.log(`🔍 Found ${japaneseFiles.length} remaining Japanese filename images:`);
  japaneseFiles.forEach(file => console.log(`  - ${file}`));
  
  return japaneseFiles;
};

// メイン処理
const main = () => {
  console.log('🚀 Starting remaining Japanese filename to Scientific filename conversion...');
  
  const japaneseFiles = getRemainingJapaneseFiles();
  
  if (japaneseFiles.length === 0) {
    console.log('✅ No remaining Japanese filename images found.');
    return;
  }
  
  const renames = [];
  const imagesDir = path.join(__dirname, '..', 'public', 'images', 'insects');
  
  japaneseFiles.forEach(filename => {
    // Extract Japanese name from filename (remove extension and extra info)
    const nameWithoutExt = path.parse(filename).name;
    
    // Remove extra info like scientific names or numbers in parentheses
    let japaneseName = nameWithoutExt.replace(/\s*\([^)]*\).*$/, '').trim();
    
    console.log(`\n🔍 Processing: ${filename}`);
    console.log(`   Extracted name: "${japaneseName}"`);
    
    const scientificName = japaneseToScientificMapping.get(japaneseName);
    if (scientificName) {
      const extension = path.extname(filename);
      const newFilename = scientificName + extension;
      
      console.log(`   Scientific name: ${scientificName}`);
      console.log(`   New filename: ${newFilename}`);
      
      // Check if target file already exists
      const oldPath = path.join(imagesDir, filename);
      const newPath = path.join(imagesDir, newFilename);
      
      if (fs.existsSync(newPath)) {
        console.log(`   ⚠️  Target file already exists: ${newFilename}`);
        console.log(`   📁 Will backup existing file`);
        
        // Create backup of existing file
        const backupFilename = `${scientificName}_backup${extension}`;
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
      console.log(`   ❌ No scientific name mapping found for: "${japaneseName}"`);
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
    console.log('1. Update image_extensions.json with new filenames');
    console.log('2. Test the website to ensure images still display');
    console.log('3. Commit and deploy the changes');
  }
};

// Execute
main();
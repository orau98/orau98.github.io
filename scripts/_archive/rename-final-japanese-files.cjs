const fs = require('fs');
const path = require('path');

/**
 * 最後の5件の和名ファイルを学名ベースのファイル名にリネームするスクリプト
 */

// 和名から学名への直接マッピング
const japaneseToScientificMapping = new Map([
  ['ナシイラガ', 'Narosoideus_flavidorsalis'],
  ['ヒメスズメ', 'Deilephila_askoldensis'],
  ['フタスジエグリアツバ', 'Gonepatica_opalina'],
  ['ベニスズメ', 'Deilephila_elpenor'],
  ['ヨモギオオホソハマキ', 'Phtheochroides_clandestina']
]);

// 現在の和名ファイルを取得
const getFinalJapaneseFiles = () => {
  const imagesDir = path.join(__dirname, '..', 'public', 'images', 'insects');
  const files = fs.readdirSync(imagesDir);
  
  // 和名を含むファイルを検出
  const japaneseFiles = files.filter(filename => {
    // Check if filename contains Japanese characters
    return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(filename);
  });
  
  console.log(`🔍 Found ${japaneseFiles.length} final Japanese filename images:`);
  japaneseFiles.forEach(file => console.log(`  - ${file}`));
  
  return japaneseFiles;
};

// メイン処理
const main = () => {
  console.log('🚀 Starting final Japanese filename to Scientific filename conversion...');
  
  const japaneseFiles = getFinalJapaneseFiles();
  
  if (japaneseFiles.length === 0) {
    console.log('✅ No final Japanese filename images found.');
    return;
  }
  
  const renames = [];
  const imagesDir = path.join(__dirname, '..', 'public', 'images', 'insects');
  
  japaneseFiles.forEach(filename => {
    // Extract Japanese name from filename (get the first part before space or scientific name)
    const nameWithoutExt = path.parse(filename).name;
    
    // Extract Japanese name (first part before space or scientific name)
    let japaneseName = nameWithoutExt.split(' ')[0].trim();
    
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
  
  console.log(`\n🎯 Final rename complete: ${successCount}/${renames.length} files renamed successfully`);
  
  if (successCount > 0) {
    console.log('\n🎉 All Japanese filename images have been converted to scientific names!');
    console.log('\n📝 Next steps:');
    console.log('1. Update image_extensions.json with all new filenames');
    console.log('2. Test the website to ensure images still display');
    console.log('3. Commit and deploy the changes');
  }
};

// Execute
main();
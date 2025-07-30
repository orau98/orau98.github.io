const fs = require('fs');
const Papa = require('papaparse');
const path = require('path');

/**
 * 安全なCSV修正スクリプト
 * 検出された問題を慎重に修正する
 */

const BACKUP_SUFFIX = '_original_backup';

function fixScientificName(scientificName) {
  if (!scientificName) return scientificName;
  
  let fixed = scientificName.trim();
  
  // Fix pattern: (Butler. 1875) -> (Butler, 1875)
  fixed = fixed.replace(/\(([^,)]+)\.(\s*\d{4})\)/g, '($1,$2)');
  
  // Fix pattern: (Author,"1878) -> (Author, 1878)
  fixed = fixed.replace(/,\"(\d{4})\)/g, ', $1)');
  
  // Fix pattern: ,1878) -> , 1878)
  fixed = fixed.replace(/,(\d{4})\)$/g, ', $1)');
  
  // Known fixes
  const knownFixes = {
    'Diphtherocome autumnalis (Chang,"サクラ類': 'Diphtherocome autumnalis (Chang, 1991)',
    'Arcte coerula (Guenée': 'Arcte coerula (Guenée, 1852)'
  };
  
  for (const [broken, correct] of Object.entries(knownFixes)) {
    if (fixed.includes(broken)) {
      fixed = correct;
      break;
    }
  }
  
  return fixed;
}

function fixColumnMisalignment(row) {
  const japaneseName = row['和名']?.trim() || '';
  const scientificName = row['学名']?.trim() || '';
  const hostPlants = row['食草']?.trim() || '';
  const source = row['出典']?.trim() || '';
  
  // Detect misalignment: 学名 has general terms, 食草 has reference info
  if ((scientificName === '広食性' || scientificName === '不明' || 
       scientificName.includes('科') || scientificName.includes('種') ||
       scientificName.includes('属') || scientificName.includes('草')) &&
      (hostPlants.includes('図鑑') || hostPlants.includes('標準') || 
       hostPlants === '日本産蛾類標準図鑑1')) {
    
    console.log(`🔧 Fixing column misalignment for: ${japaneseName}`);
    console.log(`   Before: 学名="${scientificName}", 食草="${hostPlants}", 出典="${source}"`);
    
    // Shift data to correct positions
    const fixed = {
      ...row,
      '学名': '', // Clear incorrect scientific name
      '食草': scientificName, // Move to correct column
      '出典': hostPlants, // Move source info to correct column
      '備考': source || '' // Move to remarks
    };
    
    console.log(`   After:  学名="${fixed['学名']}", 食草="${fixed['食草']}", 出典="${fixed['出典']}"`);
    return fixed;
  }
  
  return row;
}

function fixCSVFile(filename) {
  console.log(`\n🔧 Processing ${filename}...`);
  
  const csvPath = path.join(__dirname, '..', 'public', filename);
  if (!fs.existsSync(csvPath)) {
    console.log(`❌ File not found: ${filename}`);
    return false;
  }

  // Create backup first
  const backupPath = csvPath.replace('.csv', `${BACKUP_SUFFIX}.csv`);
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(csvPath, backupPath);
    console.log(`💾 Created backup: ${path.basename(backupPath)}`);
  }

  const csvData = fs.readFileSync(csvPath, 'utf8');
  const parsed = Papa.parse(csvData, { header: true, skipEmptyLines: true });
  
  if (parsed.errors.length > 0) {
    console.log(`⚠️  Parse errors: ${parsed.errors.length} (continuing...)`);
  }

  let scientificNameFixes = 0;
  let columnAlignmentFixes = 0;
  let totalChanges = 0;

  const fixedData = parsed.data.map((row, index) => {
    const originalScientificName = row['学名']?.trim() || '';
    
    // Fix scientific name format issues
    const fixedScientificName = fixScientificName(originalScientificName);
    if (fixedScientificName !== originalScientificName) {
      console.log(`🔧 Row ${index + 2}: Fixed scientific name`);
      console.log(`   "${originalScientificName}" -> "${fixedScientificName}"`);
      row['学名'] = fixedScientificName;
      scientificNameFixes++;
      totalChanges++;
    }
    
    // Fix column misalignment
    const fixedRow = fixColumnMisalignment(row);
    if (fixedRow !== row) {
      columnAlignmentFixes++;
      totalChanges++;
      return fixedRow;
    }
    
    return row;
  });

  if (totalChanges === 0) {
    console.log(`✅ No issues found in ${filename}`);
    return true;
  }

  // Write fixed data back to file
  const fixedCsv = Papa.unparse(fixedData, { header: true, skipEmptyLines: true });
  fs.writeFileSync(csvPath, fixedCsv, 'utf8');
  
  console.log(`✅ Fixed ${filename}:`);
  console.log(`   📝 Scientific name fixes: ${scientificNameFixes}`);
  console.log(`   📝 Column alignment fixes: ${columnAlignmentFixes}`);
  console.log(`   📝 Total changes: ${totalChanges}`);
  
  return true;
}

// Main execution
console.log('🚀 Starting CSV cleanup...');
console.log('🛡️  Safety measures:');
console.log('   - Backups will be created automatically');
console.log('   - Only files with detected issues will be modified');
console.log('   - All changes will be logged');

const targetFiles = [
  'ListMJ_hostplants_master.csv' // Only this file has issues based on analysis
];

let successCount = 0;
let totalFiles = targetFiles.length;

targetFiles.forEach(filename => {
  if (fixCSVFile(filename)) {
    successCount++;
  }
});

console.log(`\n🎯 CLEANUP SUMMARY:`);
console.log(`   ✅ Successfully processed: ${successCount}/${totalFiles} files`);
console.log(`   💾 Backups created for safety`);
console.log(`   🔍 Review changes before testing`);

if (successCount === totalFiles) {
  console.log('\n🎉 CSV cleanup completed successfully!');
  console.log('Next steps:');
  console.log('1. Test the website to ensure everything works');
  console.log('2. If successful, remove cleaning logic from App.jsx');
  console.log('3. If issues occur, restore from backups');
} else {
  console.log('\n⚠️  Some files had issues. Please review before proceeding.');
}
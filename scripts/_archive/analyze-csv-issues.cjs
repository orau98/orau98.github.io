const fs = require('fs');
const Papa = require('papaparse');
const path = require('path');

/**
 * CSVファイルの問題を分析するスクリプト
 * App.jsxで修正されている問題を実際に検出する
 */

const csvFiles = [
  'ListMJ_hostplants_master.csv',
  'leafbeetle_hostplants.csv',
  'hamushi_species_integrated.csv',
  'buprestidae_host.csv',
  'butterfly_host.csv'
];

const issuePatterns = {
  scientificNameIssues: [
    /,\"(\d{4})\)/,  // Pattern: (Author,"1878)
    /,(\d{4})\)$/,   // Pattern: ,1878) without space
    /\([^,)]+\d{4}\)$/, // Pattern: (Author1878) without comma
    /\([^)]*".*\)/,     // Pattern: contains quotes in parentheses
    /で飼育/,           // Pattern: contains breeding info
    /;.*\d{4}/,         // Pattern: contains semicolon with year
  ],
  columnMisalignment: [
    /^(広食性|不明|科|種|属|草)/,  // 学名 field starts with these patterns
    /図鑑|標準|日本産蛾類/,        // 食草 field contains reference info
  ],
  knownBrokenNames: [
    'Diphtherocome autumnalis (Chang,"サクラ類',
    'Arcte coerula (Guenée'
  ]
};

function analyzeCSV(filename) {
  console.log(`\n🔍 Analyzing ${filename}...`);
  
  const csvPath = path.join(__dirname, '..', 'public', filename);
  if (!fs.existsSync(csvPath)) {
    console.log(`❌ File not found: ${filename}`);
    return;
  }

  const csvData = fs.readFileSync(csvPath, 'utf8');
  const parsed = Papa.parse(csvData, { header: true, skipEmptyLines: true });
  
  if (parsed.errors.length > 0) {
    console.log(`⚠️  Parse errors: ${parsed.errors.length}`);
  }

  console.log(`📊 Total rows: ${parsed.data.length}`);
  
  let scientificNameIssues = 0;
  let columnMisalignmentIssues = 0;
  let knownBrokenIssues = 0;
  let issueDetails = [];

  parsed.data.forEach((row, index) => {
    const japaneseName = row['和名']?.trim() || '';
    const scientificName = row['学名']?.trim() || '';
    const hostPlants = row['食草']?.trim() || '';
    
    // Check for scientific name format issues
    issuePatterns.scientificNameIssues.forEach(pattern => {
      if (pattern.test(scientificName)) {
        scientificNameIssues++;
        issueDetails.push({
          type: 'scientific_name',
          row: index + 2,
          japaneseName,
          scientificName,
          issue: pattern.source
        });
      }
    });

    // Check for column misalignment
    if (issuePatterns.columnMisalignment[0].test(scientificName) && 
        issuePatterns.columnMisalignment[1].test(hostPlants)) {
      columnMisalignmentIssues++;
      issueDetails.push({
        type: 'column_misalignment',
        row: index + 2,
        japaneseName,
        scientificName,
        hostPlants
      });
    }

    // Check for known broken names
    issuePatterns.knownBrokenNames.forEach(brokenName => {
      if (scientificName.includes(brokenName)) {
        knownBrokenIssues++;
        issueDetails.push({
          type: 'known_broken',
          row: index + 2,
          japaneseName,
          scientificName
        });
      }
    });
  });

  console.log(`🔴 Scientific name issues: ${scientificNameIssues}`);
  console.log(`🔴 Column misalignment: ${columnMisalignmentIssues}`);
  console.log(`🔴 Known broken names: ${knownBrokenIssues}`);

  // Show first few examples of each type
  ['scientific_name', 'column_misalignment', 'known_broken'].forEach(type => {
    const examples = issueDetails.filter(issue => issue.type === type).slice(0, 3);
    if (examples.length > 0) {
      console.log(`\n📝 Examples of ${type}:`);
      examples.forEach(example => {
        console.log(`  Row ${example.row}: ${example.japaneseName}`);
        console.log(`    学名: "${example.scientificName}"`);
        if (example.hostPlants) console.log(`    食草: "${example.hostPlants}"`);
      });
    }
  });

  return {
    filename,
    totalRows: parsed.data.length,
    scientificNameIssues,
    columnMisalignmentIssues,
    knownBrokenIssues,
    issueDetails
  };
}

// Main execution
console.log('🚀 Starting CSV analysis...');
console.log('📋 Files to analyze:', csvFiles);

const results = csvFiles.map(analyzeCSV).filter(Boolean);

console.log('\n📊 SUMMARY:');
results.forEach(result => {
  const totalIssues = result.scientificNameIssues + result.columnMisalignmentIssues + result.knownBrokenIssues;
  console.log(`${result.filename}: ${totalIssues} total issues`);
});

const grandTotal = results.reduce((sum, result) => 
  sum + result.scientificNameIssues + result.columnMisalignmentIssues + result.knownBrokenIssues, 0);

console.log(`\n🎯 TOTAL ISSUES FOUND: ${grandTotal}`);
console.log('✅ Analysis complete. Review the issues before proceeding with cleanup.');
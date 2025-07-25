const fs = require('fs');
const Papa = require('papaparse');

// Read the actual CSV file
let csvText = fs.readFileSync('public/日本のフユシャク.csv', 'utf-8');

// Remove BOM if present
if (csvText.charCodeAt(0) === 0xFEFF) {
  csvText = csvText.substring(1);
}

console.log('First 300 chars of CSV:');
console.log(csvText.substring(0, 300));
console.log('\n');

// Parse with different options to see what happens
const parseResults = Papa.parse(csvText, {
  header: true,
  skipEmptyLines: 'greedy',
  delimiter: ',',
  quoteChar: '"',
  escapeChar: '"'
});

console.log('Parse results:');
console.log('Total rows:', parseResults.data.length);
console.log('Errors count:', parseResults.errors.length);

// Find クロスジフユエダシャク row
const kurosujiFuyuedashaku = parseResults.data.find(row => 
  row['和名']?.includes('クロスジフユエダシャク')
);

if (kurosujiFuyuedashaku) {
  console.log('\nFound クロスジフヒシャク:');
  console.log('Full object keys:', Object.keys(kurosujiFuyuedashaku));
  console.log('Full object:', kurosujiFuyuedashaku);
  
  // Check for additional fields
  const allKeys = Object.keys(kurosujiFuyuedashaku);
  console.log('Number of keys:', allKeys.length);
  
  allKeys.forEach((key, index) => {
    console.log(`Key ${index}: "${key}" = "${kurosujiFuyuedashaku[key]}"`);
  });
}

// Also try parsing without header to see raw data
console.log('\n=== Parsing without header ===');
const rawParse = Papa.parse(csvText, {
  header: false,
  skipEmptyLines: 'greedy',
  delimiter: ',',
  quoteChar: '"',
  escapeChar: '"'
});

// Find the クロスジフユエダシャク row (should be row 7, 0-indexed)
const kurosujiFuyuedashakuRaw = rawParse.data.find(row => 
  row[0] === 'クロスジフユエダシャク'
);

if (kurosujiFuyuedashakuRaw) {
  console.log('Raw data for クロスジフユエダシャク:');
  kurosujiFuyuedashakuRaw.forEach((field, index) => {
    console.log(`Field ${index}: "${field}"`);
  });
}
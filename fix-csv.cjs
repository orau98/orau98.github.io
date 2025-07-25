// Script to fix the malformed フユシャク CSV
const fs = require('fs');

// Read the malformed CSV
let csvText = fs.readFileSync('public/日本のフユシャク.csv', 'utf-8');

// Remove BOM if present
if (csvText.charCodeAt(0) === 0xFEFF) {
  csvText = csvText.substring(1);
}

// Process the CSV to fix the structure
const lines = csvText.split(/\r?\n/).filter(line => line.trim());

// Fix header (remove quotes)
const fixedLines = [];
if (lines[0] === '"和名,学名,食草,食草に関する備考,成虫の発生時期"') {
  fixedLines.push('和名,学名,食草,食草に関する備考,成虫の発生時期');
} else {
  fixedLines.push(lines[0]);
}

// Process data lines
for (let i = 1; i < lines.length; i++) {
  const line = lines[i];
  if (!line.trim()) continue;
  
  // Remove outer quotes
  let cleanLine = line;
  if (cleanLine.startsWith('"') && cleanLine.endsWith('"')) {
    cleanLine = cleanLine.slice(1, -1);
  }
  
  // Fix double quotes to single quotes for CSV fields
  // Replace "" with " but be careful with the structure
  cleanLine = cleanLine.replace(/""/g, '"');
  
  fixedLines.push(cleanLine);
}

// Join and write the fixed CSV
const fixedCsv = fixedLines.join('\n');
fs.writeFileSync('public/日本のフユシャク.csv', fixedCsv, 'utf-8');

console.log('Fixed CSV written successfully');
console.log('Original lines:', lines.length);
console.log('Fixed lines:', fixedLines.length);

// Test parsing the fixed CSV
const Papa = require('papaparse');
const testParsed = Papa.parse(fixedCsv, {
  header: true,
  skipEmptyLines: 'greedy',
  delimiter: ',',
  quoteChar: '"',
  escapeChar: '"'
});

console.log('Test parsing result:');
console.log('Rows:', testParsed.data.length);
console.log('Errors:', testParsed.errors.length);
if (testParsed.errors.length > 0) {
  console.log('Errors:', testParsed.errors);
}

// Find クロスジフユエダシャク
const kurosujiFuyuedashaku = testParsed.data.find(row => 
  row['和名']?.includes('クロスジフユエダシャク')
);

if (kurosujiFuyuedashaku) {
  console.log('\nFound クロスジフユエダシャク:');
  console.log('和名:', kurosujiFuyuedashaku['和名']);
  console.log('学名:', kurosujiFuyuedashaku['学名']);
  console.log('食草:', kurosujiFuyuedashaku['食草']);
  console.log('備考:', kurosujiFuyuedashaku['食草に関する備考']);
  console.log('成虫の発生時期:', kurosujiFuyuedashaku['成虫の発生時期']);
}
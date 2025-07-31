// Test script to verify フユシャク data loading
const fs = require('fs');
const Papa = require('papaparse');

// Read the フユシャク CSV
const fuyushakuText = fs.readFileSync('public/日本の冬尺蛾.csv', 'utf-8');

console.log('フユシャク CSV loaded, length:', fuyushakuText.length);
console.log('First 200 chars:', fuyushakuText.substring(0, 200));

// Parse CSV
const fuyushakuParsed = Papa.parse(fuyushakuText, {
  header: true,
  skipEmptyLines: 'greedy',
  delimiter: ',',
  quoteChar: '"',
  escapeChar: '"'
});

console.log('Parsed rows:', fuyushakuParsed.data.length);
console.log('Header:', Object.keys(fuyushakuParsed.data[0] || {}));

// Look for クロスジフユエダシャク
const kurosujiFuyuedashaku = fuyushakuParsed.data.find(row => 
  row['和名']?.includes('クロスジフユエダシャク') || 
  row['学名']?.includes('Pachyerannis obliquaria')
);

console.log('Found クロスジフユエダシャク:', kurosujiFuyuedashaku);

if (kurosujiFuyuedashaku) {
  console.log('和名:', kurosujiFuyuedashaku['和名']);
  console.log('学名:', kurosujiFuyuedashaku['学名']);
  console.log('食草:', kurosujiFuyuedashaku['食草']);
  console.log('成虫の発生時期:', kurosujiFuyuedashaku['成虫の発生時期']);
}

// Also show all species for verification
console.log('\nAll species in フユシャク CSV:');
fuyushakuParsed.data.forEach((row, index) => {
  if (row['和名']) {
    console.log(`${index}: ${row['和名']} (${row['学名']})`);
  }
});
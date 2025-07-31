// Test script to verify フユシャク data loading
const fs = require('fs');
const Papa = require('papaparse');

// Read the フユシャク CSV
let fuyushakuText = fs.readFileSync('public/日本の冬尺蛾.csv', 'utf-8');
// Remove BOM if present
if (fuyushakuText.charCodeAt(0) === 0xFEFF) {
  fuyushakuText = fuyushakuText.substring(1);
}

console.log('フユシャク CSV loaded, length:', fuyushakuText.length);
console.log('First 200 chars:', fuyushakuText.substring(0, 200));

// Use the same manual parsing logic as in App.jsx
const lines = fuyushakuText.split(/\r?\n/).filter(line => line.trim());

// Skip the first line which is the quoted header
const dataLines = lines.slice(1);

// Manually parse each line since Papa Parse fails with this structure
const fuyushakuData = [];
for (const line of dataLines) {
  if (!line.trim()) continue;
  
  // Remove outer quotes and split manually
  const cleanLine = line.startsWith('"') && line.endsWith('"') ? line.slice(1, -1) : line;
  
  // Split by comma but respect quoted sections
  const parts = [];
  let current = '';
  let inQuotes = false;
  let i = 0;
  
  while (i < cleanLine.length) {
    const char = cleanLine[i];
    const nextChar = cleanLine[i + 1];
    
    if (char === '"' && nextChar === '"') {
      // Double quote escape
      current += '"';
      i += 2;
    } else if (char === '"') {
      // Toggle quote state
      inQuotes = !inQuotes;
      i++;
    } else if (char === ',' && !inQuotes) {
      // Field separator outside quotes
      parts.push(current);
      current = '';
      i++;
    } else {
      current += char;
      i++;
    }
  }
  parts.push(current); // Add the last part
  
  // Map to proper structure
  if (parts.length >= 3) {
    fuyushakuData.push({
      '和名': parts[0] || '',
      '学名': parts[1] || '',
      '食草': parts[2] || '',
      '食草に関する備考': parts[3] || '',
      '成虫の発生時期': parts[4] || ''
    });
  }
}

// Fix parsing issues caused by commas in scientific names
const fixedFuyushakuData = fuyushakuData.map(row => {
  // Check if the scientific name field is incomplete (missing year)
  if (row['学名'] && row['食草'] && 
      row['学名'].includes('(') && !row['学名'].includes(')') &&
      row['食草'].match(/^\s*\d{4}\)/)) {
    // The year part got split into the food plants field
    const year = row['食草'];
    const fixedScientificName = row['学名'] + ', ' + year;
    
    // The emergence time data might be in __parsed_extra
    let emergenceTime = '';
    if (row.__parsed_extra && row.__parsed_extra.length > 0) {
      emergenceTime = row.__parsed_extra[0];
    } else if (Object.keys(row).length > 5) {
      // Try to get from additional fields
      const keys = Object.keys(row);
      emergenceTime = row[keys[5]] || '';
    }
    
    // Shift the fields back to their correct positions
    return {
      '和名': row['和名'],
      '学名': fixedScientificName,
      '食草': row['食草に関する備考'] || '',
      '食草に関する備考': row['成虫の発生時期'] || '',
      '成虫の発生時期': emergenceTime
    };
  }
  return row;
});

console.log('Parsed rows:', fixedFuyushakuData.length);
console.log('Header:', Object.keys(fixedFuyushakuData[0] || {}));

// Look for クロスジフユエダシャク - first show raw data
const kurosujiFuyuedashakuRaw = fuyushakuData.find(row => 
  row['和名']?.includes('クロスジフユエダシャク') || 
  row['学名']?.includes('Pachyerannis obliquaria')
);

console.log('Raw クロスジフユエダシャク data:', kurosujiFuyuedashakuRaw);
console.log('All keys in raw data:', Object.keys(kurosujiFuyuedashakuRaw || {}));

// Then show fixed data
const kurosujiFuyuedashaku = fixedFuyushakuData.find(row => 
  row['和名']?.includes('クロスジフユエダシャク') || 
  row['学名']?.includes('Pachyerannis obliquaria')
);

console.log('Fixed クロスジフユエダシャク:', kurosujiFuyuedashaku);

if (kurosujiFuyuedashaku) {
  console.log('和名:', kurosujiFuyuedashaku['和名']);
  console.log('学名:', kurosujiFuyuedashaku['学名']);
  console.log('食草:', kurosujiFuyuedashaku['食草']);
  console.log('備考:', kurosujiFuyuedashaku['食草に関する備考']);
  console.log('成虫の発生時期:', kurosujiFuyuedashaku['成虫の発生時期']);
}

// Also show all species for verification
console.log('\nAll species in フユシャク CSV:');
fixedFuyushakuData.forEach((row, index) => {
  if (row['和名']) {
    console.log(`${index}: ${row['和名']} (${row['学名']})`);
  }
});
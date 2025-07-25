const Papa = require('papaparse');

// Test parsing just the クロスジフユエダシャク line
const csvHeader = '和名,学名,食草,食草に関する備考,成虫の発生時期';
const csvLine = 'クロスジフユエダシャク,Pachyerannis obliquaria (Motschulsky, 1861),"クリ、コナラ、ミズナラ、クヌギ、アベマキ、カシワ、フモトミズナラ、タカオカエデ",,"関東平地では12月中旬頃~1月中旬。ピークは12月下旬。"';

const testCsv = csvHeader + '\n' + csvLine;

console.log('Test CSV:');
console.log(testCsv);
console.log();

const parsed = Papa.parse(testCsv, {
  header: true,
  skipEmptyLines: 'greedy',
  delimiter: ',',
  quoteChar: '"',
  escapeChar: '"'
});

console.log('Parse result:');
console.log('Data length:', parsed.data.length);
console.log('Errors:', parsed.errors);
console.log('Data:', parsed.data[0]);
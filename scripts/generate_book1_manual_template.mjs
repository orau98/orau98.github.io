import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

// Generate a manual template CSV for Book1 emergence/ecology gaps
// Reads reports/book1_species_without_emergence.csv and outputs tmp/book1_missing_manual.csv

const REPORT = path.join('reports', 'book1_species_without_emergence.csv');
const OUT = path.join('tmp', 'book1_missing_manual.csv');

function main() {
  if (!fs.existsSync(REPORT)) {
    console.error('Report not found:', REPORT);
    process.exit(2);
  }
  const text = fs.readFileSync(REPORT, 'utf8');
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true, transformHeader: h => h.trim(), transform: v => (v ?? '').toString().trim() });
  const rows = parsed.data || [];
  // Build template rows with empty period/remarks
  const outRows = rows.map(r => ({
    '和名': r.japanese_name || '',
    '学名': r.scientific_name || '',
    '成虫発生時期': '',
    '備考': ''
  }));
  // De-duplicate by 和名+学名
  const seen = new Set();
  const uniq = [];
  for (const r of outRows) {
    const key = `${r['和名']}|${r['学名']}`;
    if (seen.has(key)) continue;
    seen.add(key); uniq.push(r);
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const csv = Papa.unparse(uniq, { header: true });
  fs.writeFileSync(OUT, csv, 'utf8');
  console.log(`Template written: ${OUT} (rows=${uniq.length})`);
}

main();


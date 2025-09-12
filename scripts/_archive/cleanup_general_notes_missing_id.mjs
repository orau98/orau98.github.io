import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

const FILES = [
  path.join(process.cwd(), 'public', 'general_notes.csv'),
  path.join(process.cwd(), 'normalized_data', 'general_notes.csv'),
];
const REPORT = path.join(process.cwd(), 'reports', 'general_notes_missing_insect_id.csv');

function loadCSV(p) {
  return Papa.parse(fs.readFileSync(p, 'utf8'), { header: true, skipEmptyLines: false }).data;
}
function saveCSV(p, rows) {
  const fields = Object.keys(rows[0] || {});
  const csv = Papa.unparse(rows, { header: true, columns: fields });
  fs.writeFileSync(p, csv, 'utf8');
}

function run() {
  const pub = loadCSV(FILES[0]);
  const norm = loadCSV(FILES[1]);
  const missing = pub.filter(r => (r.insect_id || '').trim() === 'species-');
  if (missing.length === 0) {
    console.log('No missing insect_id rows to remove.');
    return;
  }
  // 出力レポート
  const reportCsv = Papa.unparse(missing, { header: true });
  fs.mkdirSync(path.dirname(REPORT), { recursive: true });
  fs.writeFileSync(REPORT, reportCsv, 'utf8');
  console.log(`Wrote report: ${path.relative(process.cwd(), REPORT)} (${missing.length} rows)`);

  const noteIds = new Set(missing.map(r => r.record_id));
  const pub2 = pub.filter(r => !noteIds.has(r.record_id));
  const norm2 = norm.filter(r => !noteIds.has(r.record_id));
  saveCSV(FILES[0], pub2);
  saveCSV(FILES[1], norm2);
  console.log(`Removed ${missing.length} rows with insect_id='species-'`);
}

run();


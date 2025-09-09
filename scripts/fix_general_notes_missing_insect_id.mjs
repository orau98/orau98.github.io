import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

const FILES = [
  path.join(process.cwd(), 'public', 'general_notes.csv'),
  path.join(process.cwd(), 'normalized_data', 'general_notes.csv'),
];

function loadCSV(p) {
  return Papa.parse(fs.readFileSync(p, 'utf8'), { header: true, skipEmptyLines: false }).data;
}
function saveCSV(p, rows) {
  const fields = Object.keys(rows[0] || {});
  const csv = Papa.unparse(rows, { header: true, columns: fields });
  fs.writeFileSync(p, csv, 'utf8');
}

function trim(s) { return (s ?? '').trim(); }

function runOne(file) {
  const rows = loadCSV(file);
  // インデックス: note_type + content + reference -> insect_id set（species-以外）
  const key = (r) => [trim(r.note_type), trim(r.content), trim(r.reference)].join('||');
  const idx = new Map();
  for (const r of rows) {
    const id = trim(r.insect_id);
    if (!id || id === 'species-') continue;
    const k = key(r);
    if (!k) continue;
    if (!idx.has(k)) idx.set(k, new Set());
    idx.get(k).add(id);
  }
  let fixed = 0;
  for (const r of rows) {
    if (trim(r.insect_id) !== 'species-') continue;
    const k = key(r);
    if (!k) continue;
    const cand = idx.get(k);
    if (cand && cand.size === 1) {
      const [id] = Array.from(cand);
      r.insect_id = id;
      fixed++;
    }
  }
  saveCSV(file, rows);
  console.log(`${path.relative(process.cwd(), file)}: reassigned ${fixed} missing insect_id`);
}

for (const f of FILES) runOne(f);


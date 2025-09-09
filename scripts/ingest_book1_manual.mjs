import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

// Ingest supplemental Book1 notes from a manual CSV (和名, 学名, 成虫発生時期, 備考)
// Usage: node scripts/ingest_book1_manual.mjs tmp/book1_missing_manual.csv

const INSECTS_PUB = path.join('public', 'insects.csv');
const NOTES_PUB = path.join('public', 'general_notes.csv');
const NOTES_NORM = path.join('normalized_data', 'general_notes.csv');

const REF = '日本産蛾類標準図鑑1';

function loadCSV(p) {
  const text = fs.readFileSync(p, 'utf8');
  return Papa.parse(text, { header: true, skipEmptyLines: true, transformHeader: h => h.trim(), transform: v => (v ?? '').toString().trim() }).data;
}

function saveCSV(p, rows) {
  const fields = Object.keys(rows[0] || {});
  const csv = Papa.unparse(rows, { header: true, columns: fields });
  fs.writeFileSync(p, csv, 'utf8');
}

function toBinomial(sci) {
  if (!sci) return '';
  let cleaned = String(sci).replace(/[\*_`]/g, '').replace(/\s+/g, ' ').trim();
  cleaned = cleaned.replace(/\s*\([^)]*\)\s*$/, '').trim();
  const parts = cleaned.split(/\s+/);
  if (parts.length >= 2) return `${parts[0]} ${parts[1]}`;
  return parts[0] || '';
}

function nextNoteId(rows) {
  let mx = 0;
  for (const r of rows) {
    const m = String(r.record_id || '').match(/^note-(\d{6})$/);
    if (m) mx = Math.max(mx, parseInt(m[1], 10));
  }
  return `note-${String(mx + 1).padStart(6, '0')}`;
}

function main() {
  const inputPath = process.argv[2] || path.join('tmp', 'book1_missing_manual.csv');
  if (!fs.existsSync(inputPath)) {
    console.error('Manual CSV not found:', inputPath);
    process.exit(2);
  }
  const insects = loadCSV(INSECTS_PUB);
  const notesPub = loadCSV(NOTES_PUB);
  const notesNorm = loadCSV(NOTES_NORM);

  const bin2id = new Map();
  const ja2id = new Map();
  insects.forEach(r => {
    const id = r.insect_id;
    if (!id) return;
    const bin = toBinomial(r.scientific_name || `${r.genus || ''} ${r.species || ''}`);
    if (bin) bin2id.set(bin, id);
    const ja = (r.japanese_name || '').trim();
    if (ja) ja2id.set(ja, id);
  });

  const manual = loadCSV(inputPath);
  let added = 0, unmatched = 0;

  for (const r of manual) {
    const ja = (r['和名'] || '').trim();
    const sci = (r['学名'] || '').trim();
    const period = (r['成虫発生時期'] || '').trim();
    const note = (r['備考'] || '').trim();
    const id = ja2id.get(ja) || bin2id.get(toBinomial(sci));
    if (!id) { unmatched++; continue; }

    const insert = (type, content) => {
      if (!content) return;
      const exists = notesPub.some(n => n.insect_id === id && n.note_type === type && String(n.content || '').trim() === content && n.reference === REF);
      if (!exists) {
        const rec = { record_id: nextNoteId(notesPub), insect_id: id, note_type: type, content, reference: REF, page: '', year: '' };
        notesPub.push(rec); notesNorm.push({ ...rec }); added++;
      }
    };
    insert('出現時期', period);
    insert('生態情報', note);
  }
  saveCSV(NOTES_PUB, notesPub);
  saveCSV(NOTES_NORM, notesNorm);
  console.log(`Manual ingest complete. added=${added} unmatched=${unmatched}`);
}

main();


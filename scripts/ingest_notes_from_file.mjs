import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

// Usage: node scripts/ingest_notes_from_file.mjs [inputPath]
// Accepts Markdown table or CSV with headers: 学名, 成虫発生時期, 成虫発生時期に関する備考

const REF = '日本蛾類標準図鑑3';
const inputPath = process.argv[2] || path.join('tmp', 'standard3_notes.md');

function loadText(p) { return fs.readFileSync(p, 'utf8'); }
function loadCSV(p) { return Papa.parse(fs.readFileSync(p, 'utf8'), { header: true, skipEmptyLines: false }).data; }
function saveCSV(p, rows) {
  const fields = Object.keys(rows[0] || {});
  const csv = Papa.unparse(rows, { header: true, columns: fields });
  fs.writeFileSync(p, csv, 'utf8');
}
function toBinomial(sci) {
  if (!sci) return '';
  const t = sci.replace(/\s*\([^)]*\)\s*$/, '').trim();
  const parts = t.split(/\s+/);
  if (parts.length >= 2) return `${parts[0]} ${parts[1]}`;
  return parts[0] || '';
}
function parseMarkdown(md) {
  const lines = md.split(/\r?\n/).filter(l => l.trim().startsWith('|'));
  const out = [];
  for (const l of lines.slice(2)) {
    const cells = l.split('|').map(c => c.trim());
    if (cells.length < 4) continue;
    const sci = cells[1];
    const period = cells[2] && cells[2] !== '情報なし' ? cells[2] : '';
    const note = cells[3] || '';
    if (!sci) continue;
    out.push({ sci, period, note });
  }
  return out;
}
function parseFile(p, stdinText = null) {
  const ext = path.extname(p).toLowerCase();
  if (ext === '.csv') {
    return loadCSV(p).map(r => ({
      sci: (r['学名'] || '').trim(),
      period: (r['成虫発生時期'] || '').trim(),
      note: (r['成虫発生時期に関する備考'] || '').trim(),
    }));
  }
  const md = stdinText != null ? stdinText : loadText(p);
  return parseMarkdown(md);
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
  let stdin = null;
  if (inputPath === '-') {
    stdin = fs.readFileSync(0, 'utf8');
  } else if (!fs.existsSync(inputPath)) {
    console.error(`Input not found: ${inputPath}`);
    process.exit(2);
  }
  const insects = loadCSV(path.join('public', 'insects.csv'));
  const notesPub = loadCSV(path.join('public', 'general_notes.csv'));
  const notesNorm = loadCSV(path.join('normalized_data', 'general_notes.csv'));

  const bin2id = new Map();
  insects.forEach(r => {
    const b = toBinomial(r.scientific_name || `${r.genus || ''} ${r.species || ''}`);
    if (b && r.insect_id) bin2id.set(b, r.insect_id);
  });

  const rows = parseFile(inputPath, stdin);
  // 表記揺れエイリアス
  const alias = new Map([
    ['Paramartyria immaculata', 'Paramartyria immaculatella'],
    ['Platymatopus japonicus', 'Phymatopus japonicus'],
  ]);

  let matched = 0, unmatched = 0, added = 0;
  const unmatchedList = [];
  for (const r of rows) {
    let b = toBinomial(r.sci);
    let id = bin2id.get(b);
    if (!id && alias.has(b)) id = bin2id.get(alias.get(b));
    if (!id) { unmatched++; unmatchedList.push(r.sci); continue; }
    matched++;
    if (r.period) {
      const exists = notesPub.some(n => n.insect_id === id && n.note_type === '出現時期' && String(n.content || '').trim() === r.period.trim());
      if (!exists) {
        const rec = { record_id: nextNoteId(notesPub), insect_id: id, note_type: '出現時期', content: r.period, reference: REF, page: '', year: '' };
        notesPub.push(rec); notesNorm.push({ ...rec }); added++;
      }
    }
    if (r.note) {
      const exists2 = notesPub.some(n => n.insect_id === id && n.note_type === '生態情報' && String(n.content || '').trim() === r.note.trim());
      if (!exists2) {
        const rec2 = { record_id: nextNoteId(notesPub), insect_id: id, note_type: '生態情報', content: r.note, reference: REF, page: '', year: '' };
        notesPub.push(rec2); notesNorm.push({ ...rec2 }); added++;
      }
    }
  }
  saveCSV(path.join('public', 'general_notes.csv'), notesPub);
  saveCSV(path.join('normalized_data', 'general_notes.csv'), notesNorm);

  if (unmatchedList.length > 0) {
    fs.mkdirSync('reports', { recursive: true });
    fs.writeFileSync(path.join('reports', 'standard3_unmatched_species.txt'), unmatchedList.join('\n'), 'utf8');
  }
  console.log(`matched=${matched} unmatched=${unmatched} added=${added}`);
}

main();

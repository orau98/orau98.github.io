import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

const REF = '日本蛾類標準図鑑3';

const ITEMS = [
  {
    binomial: 'Coleophora gryphipennella',
    period: '7月',
    remark: '1世代満1年と満2年の個体がある。'
  }
];

function loadCSV(p) {
  return Papa.parse(fs.readFileSync(p, 'utf8'), { header: true, skipEmptyLines: false }).data;
}
function saveCSV(p, rows) {
  const fields = Object.keys(rows[0] || {});
  const csv = Papa.unparse(rows, { header: true, columns: fields });
  fs.writeFileSync(p, csv, 'utf8');
}
function toBinomial(sci, genus, species) {
  let s = sci ? String(sci) : '';
  if (s) s = s.replace(/\s*\([^)]*\)\s*$/, '').trim();
  if (!s) s = [genus || '', species || ''].join(' ').trim();
  const parts = s.split(/\s+/).filter(Boolean);
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

function run() {
  const insects = loadCSV(path.join('public', 'insects.csv'));
  const notesPub = loadCSV(path.join('public', 'general_notes.csv'));
  const notesNorm = loadCSV(path.join('normalized_data', 'general_notes.csv'));

  const bin2id = new Map();
  for (const r of insects) {
    const b = toBinomial(r.scientific_name, r.genus, r.species);
    if (b && r.insect_id) bin2id.set(b, r.insect_id);
  }

  let added = 0;
  for (const it of ITEMS) {
    const id = bin2id.get(it.binomial);
    if (!id) { console.warn('No insect_id for', it.binomial); continue; }
    if (it.period) {
      const exists = notesPub.some(n => n.insect_id === id && n.note_type === '出現時期' && String(n.content || '').trim() === it.period.trim());
      if (!exists) {
        const rec = { record_id: nextNoteId(notesPub), insect_id: id, note_type: '出現時期', content: it.period, reference: REF, page: '', year: '' };
        notesPub.push(rec); notesNorm.push({ ...rec }); added++;
      }
    }
    if (it.remark) {
      const exists2 = notesPub.some(n => n.insect_id === id && n.note_type === '生態情報' && String(n.content || '').trim() === it.remark.trim());
      if (!exists2) {
        const rec2 = { record_id: nextNoteId(notesPub), insect_id: id, note_type: '生態情報', content: it.remark, reference: REF, page: '', year: '' };
        notesPub.push(rec2); notesNorm.push({ ...rec2 }); added++;
      }
    }
  }

  if (added > 0) {
    saveCSV(path.join('public', 'general_notes.csv'), notesPub);
    saveCSV(path.join('normalized_data', 'general_notes.csv'), notesNorm);
  }
  console.log('appended notes:', added);
}

run();


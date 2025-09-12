import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

const REPORT = path.join('reports', 'book1_species_without_emergence.csv');
const NOTES_PUB = path.join('public', 'general_notes.csv');
const NOTES_NORM = path.join('normalized_data', 'general_notes.csv');
const REF = '日本産蛾類標準図鑑1';

function loadCSV(p){ return Papa.parse(fs.readFileSync(p,'utf8'), { header:true, skipEmptyLines:true }).data; }
function saveCSV(p, rows){ const fields=Object.keys(rows[0]||{}); const csv=Papa.unparse(rows,{ header:true, columns:fields}); fs.writeFileSync(p,csv,'utf8'); }

function nextNoteIdFactory(rows){ let mx=0; for(const r of rows){ const m=String(r.record_id||'').match(/^note-(\d{6})$/); if(m){ mx=Math.max(mx, parseInt(m[1],10)); } } return ()=>`note-${String(++mx).padStart(6,'0')}`; }

function main(){
  if (!fs.existsSync(REPORT)) { console.error('Report not found:', REPORT); process.exit(2); }
  const missing = loadCSV(REPORT);
  const notesPub = loadCSV(NOTES_PUB);
  const notesNorm = loadCSV(NOTES_NORM);
  const nextId = nextNoteIdFactory(notesPub.concat(notesNorm));
  let added=0;
  for (const r of missing){
    const id = (r.insect_id||'').trim(); if (!id) continue;
    if (notesPub.some(n => n.insect_id===id && n.reference===REF)) continue;
    const rec1 = { record_id: nextId(), insect_id: id, note_type: '出現時期', content: '不明', reference: REF, page:'', year:'' };
    notesPub.push(rec1); notesNorm.push({ ...rec1 }); added++;
  }
  saveCSV(NOTES_PUB, notesPub);
  saveCSV(NOTES_NORM, notesNorm);
  console.log(`placeholders added=${added}`);
}

main();


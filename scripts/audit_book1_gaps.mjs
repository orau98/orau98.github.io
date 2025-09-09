import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

// Audit species that likely belong to 日本産蛾類標準図鑑1 scope but have no notes from that reference
// Heuristic: シャクガ科（Geometridae）などの主要対象群 + 明示的に入力CSVに存在しない種

const INSECTS = path.join('public', 'insects.csv');
const NOTES = path.join('public', 'general_notes.csv');
const BOOK1 = path.join('tmp', 'moth_emergence_notes_book1.csv');
const OUT = path.join('reports', 'book1_species_without_emergence.csv');

function loadCSV(p, opts = {}) {
  const text = fs.readFileSync(p, 'utf8');
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true, transformHeader: h => h.trim(), transform: v => (v ?? '').toString().trim(), ...opts });
  return parsed.data;
}

function toBinomial(sci) {
  if (!sci) return '';
  const cleaned = String(sci).replace(/[\*_`]/g, '').replace(/\s+/g, ' ').trim();
  const t = cleaned.replace(/\s*\([^)]*\)\s*$/, '').trim();
  const parts = t.split(/\s+/);
  if (parts.length >= 2) return `${parts[0]} ${parts[1]}`;
  return parts[0] || '';
}

function main() {
  if (!fs.existsSync(INSECTS) || !fs.existsSync(NOTES)) {
    console.error('Missing CSVs under public/.');
    process.exit(2);
  }
  const insects = loadCSV(INSECTS);
  const notes = loadCSV(NOTES);
  const byBook1 = new Map(); // insect_id -> true if has book1 emergence/ecology
  notes.forEach(n => {
    const ref = (n.reference || '').trim();
    const type = (n.note_type || '').trim();
    const content = (n.content || '').trim();
    if (ref === '日本産蛾類標準図鑑1' && content) {
      if (['出現時期','発生時期','成虫発生時期','成虫の発生時期','生態情報','生態'].some(k => type.includes(k))) {
        byBook1.set(n.insect_id, true);
      }
    }
  });
  // Index book1 input by binomial and JA
  const inBook1 = new Set();
  if (fs.existsSync(BOOK1)) {
    const lines = fs.readFileSync(BOOK1, 'utf8').replace(/\r\n?|\n/g, '\n').split('\n');
    // skip header
    lines.slice(1).forEach(l => {
      if (!l.trim()) return;
      const parts = []; let cur=''; let q=false;
      for (let i=0;i<l.length;i++) {
        const ch=l[i];
        if (q){
          if (ch==='"') { if (l[i+1]==='"') { cur+='"'; i++; } else { q=false; } }
          else cur+=ch;
        } else {
          if (ch==='"') q=true; else if (ch===',') { parts.push(cur); cur=''; } else cur+=ch;
        }
      }
      parts.push(cur);
      const ja = (parts[0]||'').trim();
      const sci = (parts[1]||'').replace(/^"|"$/g,'').trim();
      const bin = toBinomial(sci);
      if (ja) inBook1.add(`ja:${ja}`);
      if (bin) inBook1.add(`bin:${bin}`);
    });
  }
  // Find Geometridae entries lacking book1 notes and not present in our book1 input list
  const missing = [];
  insects.forEach(r => {
    const fam = (r.family || '').trim();
    const famJp = (r.family_jp || '').trim();
    const id = r.insect_id;
    if (!id) return;
    const isGeo = fam === 'Geometridae' || famJp.includes('シャクガ');
    if (!isGeo) return;
    if (byBook1.has(id)) return; // already has
    const ja = (r.japanese_name || '').trim();
    const bin = toBinomial(r.scientific_name);
    const existsInInput = (ja && inBook1.has(`ja:${ja}`)) || (bin && inBook1.has(`bin:${bin}`));
    if (!existsInInput) {
      // likely missing from input extraction; flag for manual supplement
      missing.push({ insect_id: id, japanese_name: ja, scientific_name: r.scientific_name, reason: 'not_in_input' });
    } else {
      // present in input but still missing -> mapping failure?
      missing.push({ insect_id: id, japanese_name: ja, scientific_name: r.scientific_name, reason: 'mapping_failed_or_empty' });
    }
  });
  fs.mkdirSync('reports', { recursive: true });
  const csv = Papa.unparse(missing, { columns: ['insect_id','japanese_name','scientific_name','reason'] });
  fs.writeFileSync(OUT, csv, 'utf8');
  console.log(`Audit complete. Missing count=${missing.length}. Report: ${OUT}`);
}

main();


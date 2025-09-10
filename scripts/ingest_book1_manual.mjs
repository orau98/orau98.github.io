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

function sanitizeInline(s) {
  if (s == null) return '';
  let t = String(s);
  t = t.replace(/[\u201C\u201D]/g, '"');
  // Remove quotes around single English tokens inside scientific names like "Epiplema"
  t = t.replace(/"([A-Za-z][A-Za-z-]*)"/g, '$1');
  // Collapse whitespace and newlines
  t = t.replace(/\r?\n+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  return t;
}

function parseManualLine(line) {
  // Heuristic parser for lines shaped like: 和名,学名,成虫発生時期,備考
  // 学名が未引用でカンマを含む場合でも、時期カラムを検出して分割する
  if (!line || !line.trim()) return null;
  const firstComma = line.indexOf(',');
  if (firstComma < 0) return null;
  let ja = sanitizeInline(line.slice(0, firstComma));
  let rest = line.slice(firstComma + 1);
  // If next segment starts with quote, read quoted scientific name
  if (rest.startsWith('"')) {
    let i = 1; let sci = '';
    while (i < rest.length) {
      const ch = rest[i];
      if (ch === '"') {
        if (rest[i + 1] === '"') { sci += '"'; i += 2; continue; }
        i++; break;
      }
      sci += ch; i++;
    }
    // Skip following comma
    if (rest[i] === ',') i++;
    const tail = rest.slice(i);
    const lastComma = tail.lastIndexOf(',');
    let period = '', note = '';
    if (lastComma >= 0) {
      period = sanitizeInline(tail.slice(0, lastComma));
      note = sanitizeInline(tail.slice(lastComma + 1));
    } else {
      period = sanitizeInline(tail);
    }
    return { ja, sci: sanitizeInline(sci), period, note };
  }
  // Unquoted: split by commas, detect which part looks like period
  const parts = rest.split(',').map(s => sanitizeInline(s));
  const looksLikePeriod = (s) => {
    if (!s) return false;
    return /(\d+\s*[~〜]?\s*\d*\s*月)|月|不明|春|夏|秋|冬|年間|上旬|中旬|下旬|頃|日|〜|~/.test(s);
  };
  let k = -1;
  for (let i = 0; i < parts.length; i++) { if (looksLikePeriod(parts[i])) { k = i; break; } }
  let sci = '', period = '', note = '';
  if (k === -1) {
    sci = parts[0] || '';
    period = parts[1] || '';
    note = parts.slice(2).join(',');
  } else {
    sci = parts.slice(0, k).join(',');
    period = parts[k] || '';
    note = parts.slice(k + 1).join(',');
  }
  return { ja, sci: sanitizeInline(sci), period: sanitizeInline(period), note: sanitizeInline(note) };
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
  const genusMap = new Map(); // genus -> [{id, bin, jaSet}]
  insects.forEach(r => {
    const id = r.insect_id;
    if (!id) return;
    const bin = toBinomial(r.scientific_name || `${r.genus || ''} ${r.species || ''}`);
    if (bin) bin2id.set(bin, id);
    const ja = (r.japanese_name || '').trim();
    if (ja) ja2id.set(ja, id);
    const names = new Set();
    const addJa = (s) => { if (s && s.trim()) names.add(s.trim()); };
    addJa(r.japanese_name);
    addJa(r.old_japanese_name);
    (r.alternative_name || '').split(/[;、，,]/).forEach(addJa);
    const g = (bin.split(' ')[0] || '').trim();
    if (g) {
      if (!genusMap.has(g)) genusMap.set(g, []);
      genusMap.get(g).push({ id, bin, jaSet: names });
    }
  });

  // Try robust line-based parsing to handle unquoted commas in 学名
  const raw = fs.readFileSync(inputPath, 'utf8').replace(/\r\n?|\n/g, '\n');
  const lines = raw.split('\n');
  // skip header line
  const manual = [];
  for (let i = 1; i < lines.length; i++) {
    const rec = parseManualLine(lines[i]);
    if (rec && (rec.ja || rec.sci)) manual.push({
      ja: rec.ja,
      sci: rec.sci,
      period: rec.period,
      note: rec.note
    });
  }
  let added = 0, unmatched = 0;

  for (const r of manual) {
    const ja = sanitizeInline(r.ja || '');
    const sci = sanitizeInline(r.sci || '');
    const period = sanitizeInline(r.period || '');
    const note = sanitizeInline(r.note || '');
    let id = ja2id.get(ja) || bin2id.get(toBinomial(sci));
    if (!id && sci) {
      const bin = toBinomial(sci);
      const [g, s] = bin.split(' ');
      const cands = genusMap.get(g) || [];
      const lev = (a,b)=>{a=a||'';b=b||'';const m=a.length,n=b.length;const dp=Array.from({length:m+1},()=>Array(n+1).fill(0));for(let i=0;i<=m;i++)dp[i][0]=i;for(let j=0;j<=n;j++)dp[0][j]=j;for(let i=1;i<=m;i++)for(let j=1;j<=n;j++)dp[i][j]=Math.min(dp[i-1][j]+1,dp[i][j-1]+1,dp[i-1][j-1]+(a[i-1]===b[j-1]?0:1));return dp[m][n];};
      let best=null; let tie=false;
      for (const c of cands){ const s2=c.bin.split(' ')[1]||''; const d=lev((s||'').toLowerCase(), s2.toLowerCase()); if (d<=1){ if (!best||d<best.d){best={id:c.id,d}; tie=false;} else if (d===best.d){ tie=true; } } }
      if (best && !tie) id = best.id;
    }
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
  // Report unmatched if any
  if (unmatched > 0) {
    const OUT = path.join('reports', 'unmatched_manual_book1.csv');
    fs.mkdirSync('reports', { recursive: true });
    const csv = Papa.unparse(manual.filter(r => !(ja2id.get(sanitizeInline(r.ja||'')) || bin2id.get(toBinomial(sanitizeInline(r.sci||''))))), { header: true });
    fs.writeFileSync(OUT, csv, 'utf8');
    console.log(`unmatched written: ${OUT}`);
  }
  saveCSV(NOTES_PUB, notesPub);
  saveCSV(NOTES_NORM, notesNorm);
  console.log(`Manual ingest complete. added=${added} unmatched=${unmatched}`);
}

main();

import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

// Usage: node scripts/ingest_notes_from_file.mjs [inputPath|-] [--ref="日本産蛾類標準図鑑1"]
// Accepts Markdown table or CSV with headers: 学名, 成虫発生時期, 成虫発生時期に関する備考

// Simple args parsing
let REF = '日本蛾類標準図鑑3';
let inputPath = path.join('tmp', 'standard3_notes.md');
for (const arg of process.argv.slice(2)) {
  if (arg.startsWith('--ref=')) {
    REF = arg.substring('--ref='.length).replace(/^"|"$/g, '');
  } else if (!arg.startsWith('-')) {
    inputPath = arg;
  }
}

function loadText(p) { return fs.readFileSync(p, 'utf8'); }
function loadCSV(p) { return Papa.parse(fs.readFileSync(p, 'utf8'), { header: true, skipEmptyLines: false }).data; }
function saveCSV(p, rows) {
  const fields = Object.keys(rows[0] || {});
  const csv = Papa.unparse(rows, { header: true, columns: fields });
  fs.writeFileSync(p, csv, 'utf8');
}
function stripDiacritics(s='') {
  try {
    return s.normalize('NFKD').replace(/\p{Diacritic}/gu, '');
  } catch { return s; }
}
function collapseSubgenus(sci='') {
  // Genus (Subgenus) species -> Genus species
  const m = sci.match(/^([A-Z][a-z-]+)\s*\([^)]*\)\s*([a-z-]+)(.*)$/);
  if (m) return `${m[1]} ${m[2]}${m[3] || ''}`;
  return sci;
}
function toBinomial(sci) {
  if (!sci) return '';
  // Remove markdown italics or underscores and surrounding backticks
  let cleaned = String(sci)
    .replace(/[\*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  cleaned = stripDiacritics(cleaned);
  cleaned = collapseSubgenus(cleaned);
  const t = cleaned.replace(/\s*\([^)]*\)\s*$/, '').trim();
  const parts = t.split(/\s+/);
  if (parts.length >= 2) return `${parts[0]} ${parts[1]}`;
  return parts[0] || '';
}
function parseMarkdown(md) {
  const all = md.split(/\r?\n/);
  const tableLines = all.filter(l => l.trim().startsWith('|'));
  if (tableLines.length < 2) return [];
  // Header detection
  const headerCellsRaw = tableLines[0].split('|').map(c => c.trim());
  const headerCells = headerCellsRaw.map(h => h.replace(/[\*_`]/g, '').trim());
  const idxJa = headerCells.findIndex(h => h.includes('和名'));
  const idxSci = headerCells.findIndex(h => h.includes('学名'));
  const idxPeriod = headerCells.findIndex(h => h.includes('成虫発生時期'));
  const idxNote = headerCells.findIndex(h => h.includes('備考'));
  const out = [];
  for (const l of tableLines.slice(2)) { // skip header and separator row
    const cells = l.split('|').map(c => c.trim());
    // Guard for leading/trailing pipes
    if (idxSci === -1) continue;
    const ja = idxJa !== -1 ? (cells[idxJa] || '') : '';
    const sci = cells[idxSci] || '';
    const periodRaw = idxPeriod !== -1 ? (cells[idxPeriod] || '') : '';
    const noteRaw = idxNote !== -1 ? (cells[idxNote] || '') : '';
    const period = periodRaw && periodRaw !== '情報なし' ? periodRaw : '';
    const note = noteRaw || '';
    if (!sci) continue;
    out.push({ ja, sci, period, note });
  }
  return out;
}
function parseFile(p, stdinText = null) {
  const ext = path.extname(p).toLowerCase();
  if (ext === '.csv') {
    return loadCSV(p).map(r => ({
      ja: (r['和名'] || '').trim(),
      sci: (r['学名'] || '').trim(),
      period: (r['成虫発生時期'] || '').trim(),
      note: (r['成虫発生時期に関する備考'] || '').trim(),
    }));
  }
  const md = stdinText != null ? stdinText : loadText(p);
  // Try markdown table, but also support CSV-looking markdown without extension
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
  const ja2id = new Map();
  const genusMap = new Map(); // genus -> [{id, bin, jaSet}]
  insects.forEach(r => {
    const id = r.insect_id;
    if (!id) return;
    const sci = r.scientific_name || `${r.genus || ''} ${r.species || ''}`;
    const b = toBinomial(sci);
    if (b) bin2id.set(b, id);
    // synonyms column may contain multiple values separated by delimiters
    const synonyms = (r.synonyms || '').split(/[;、，,]/).map(s => s.trim()).filter(Boolean);
    for (const syn of synonyms) {
      const sb = toBinomial(syn);
      if (sb && !bin2id.has(sb)) bin2id.set(sb, id);
    }
    // Build Japanese name map (main + variants)
    const names = new Set();
    const addJa = (s) => {
      if (!s) return;
      let t = String(s).trim();
      t = t.replace(/（[^）]*）/g, '').replace(/\([^\)]*\)/g, '').trim();
      if (t) names.add(t);
    };
    addJa(r.japanese_name);
    addJa(r.old_japanese_name);
    (r.alternative_name || '').split(/[;、，,]/).forEach(addJa);
    (r.other_names || '').split(/[;、，,]/).forEach(addJa);
    for (const n of names) {
      if (!ja2id.has(n)) ja2id.set(n, id);
    }
    const g = b.split(' ')[0];
    if (g) {
      if (!genusMap.has(g)) genusMap.set(g, []);
      genusMap.get(g).push({ id, bin: b, jaSet: names });
    }
  });

  const rows = parseFile(inputPath, stdin);
  // 表記揺れエイリアス
  const alias = new Map([
    ['Paramartyria immaculata', 'Paramartyria immaculatella'],
    ['Platymatopus japonicus', 'Phymatopus japonicus'],
    // Common typos / orthographic variants detected
    ['Mesoleuca mandschuricata', 'Mesoleuca mandshuricata'],
    ['Eulithis convergenuata', 'Eulithis convergenata'],
  ]);

  // Load additional alias suggestions (distance=1 only) if available
  try {
    const suggestionsPath = path.join('reports', 'alias_suggestions_from_unmatched.csv');
    if (fs.existsSync(suggestionsPath)) {
      const text = fs.readFileSync(suggestionsPath, 'utf8');
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
      for (const row of parsed.data || []) {
        const src = (row.source || '').trim();
        const dst = (row.target || '').trim();
        const dist = parseInt(row.distance || '0', 10);
        if (src && dst && dist === 1) {
          alias.set(src, dst);
        }
      }
    }
  } catch (e) {
    // non-fatal
  }

  let matched = 0, unmatched = 0, added = 0;
  const unmatchedList = [];
  const normEpithet = (s='') => s.toLowerCase().replace(/ae/g, 'e').replace(/oe/g, 'e').replace(/u/g, 'u');
  const levenshtein = (a,b) => {
    a = a.toLowerCase(); b = b.toLowerCase();
    const m=a.length,n=b.length; const dp=Array.from({length:m+1},()=>Array(n+1).fill(0));
    for(let i=0;i<=m;i++) dp[i][0]=i; for(let j=0;j<=n;j++) dp[0][j]=j;
    for(let i=1;i<=m;i++) for(let j=1;j<=n;j++) dp[i][j]=Math.min(
      dp[i-1][j]+1, dp[i][j-1]+1, dp[i-1][j-1]+(a[i-1]===b[j-1]?0:1)
    );
    return dp[m][n];
  };

  for (const r of rows) {
    const ja = (r.ja || '').trim().replace(/（[^）]*）/g, '').trim();
    let b = toBinomial(r.sci);
    let id = bin2id.get(b);
    if (!id && alias.has(b)) id = bin2id.get(alias.get(b));
    // Fallback: Japanese name map
    if (!id && ja) {
      const viaJa = ja2id.get(ja);
      if (viaJa) id = viaJa;
    }
    // Fuzzy within-genus (distance<=1) when unique and optionally Japanese matches one candidate's jaSet
    if (!id && b && b.includes(' ')) {
      const [g, s] = b.split(' ');
      const cands = genusMap.get(g) || [];
      let best = null; let tie = false;
      for (const c of cands) {
        const s2 = c.bin.split(' ')[1] || '';
        const d = levenshtein(normEpithet(s), normEpithet(s2));
        if (d <= 1) {
          if (!best || d < best.d) { best = { id: c.id, d, jaSet: c.jaSet }; tie = false; }
          else if (d === best.d) { tie = true; }
        }
      }
      if (best && !tie) {
        // If Japanese name is provided, ensure consistency when possible
        if (!ja || best.jaSet.has(ja)) {
          id = best.id;
        }
      }
    }
    if (!id) {
      unmatched++;
      unmatchedList.push({
        original: String(r.sci || ''),
        normalized_binomial: toBinomial(r.sci || ''),
        japanese: String(r.ja || '')
      });
      continue;
    }
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
    const slug = REF.replace(/[^\w\u3040-\u30FF\u4E00-\u9FFF]+/g, '_');
    // Legacy TXT (original only)
    const fileTxt = `unmatched_${slug}.txt`;
    fs.writeFileSync(
      path.join('reports', fileTxt),
      unmatchedList.map(u => u.original).join('\n'),
      'utf8'
    );
    // Detailed CSV (original + normalized + japanese)
    const fileCsv = `unmatched_detailed_${slug}.csv`;
    const csv = Papa.unparse(unmatchedList, { columns: ['original','normalized_binomial','japanese'] });
    fs.writeFileSync(path.join('reports', fileCsv), csv, 'utf8');
  }
  console.log(`matched=${matched} unmatched=${unmatched} added=${added}`);
}

main();

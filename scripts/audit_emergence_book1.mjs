import fs from 'fs';
import path from 'path';

// Audits tmp/moth_emergence_notes_book1.csv against normalized_data/general_notes.csv
// Reports any missing period/ecology notes per insect_id

const INSECTS_CSV = path.join('normalized_data', 'insects.csv');
const NOTES_CSV = path.join('normalized_data', 'general_notes.csv');
const INPUT_CSV = path.join('tmp', 'moth_emergence_notes_book1.csv');
const REPORT = path.join('reports', 'missing_from_book1.csv');
const REF = '日本産蛾類標準図鑑1';

function read(pathname) {
  return fs.readFileSync(pathname, 'utf8').replace(/\r\n?|\n/g, '\n').split('\n');
}
function parseCsvLine(line) {
  const out = []; let cur = ''; let q = false;
  for (let i=0;i<line.length;i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"') {
        if (line[i+1] === '"') { cur += '"'; i++; }
        else { q = false; }
      } else cur += ch;
    } else {
      if (ch === '"') q = true;
      else if (ch === ',') { out.push(cur); cur = ''; }
      else cur += ch;
    }
  }
  out.push(cur);
  return out;
}
function extractGS(sci) {
  if (!sci) return '';
  const cleaned = sci.replace(/\([^)]*\)/g, '').trim();
  const t = cleaned.split(/\s+/);
  return t.length >= 2 ? `${t[0]} ${t[1]}` : '';
}
function sanitize(s) {
  if (s == null) return '';
  return String(s).replace(/\r?\n+/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

function buildMaps() {
  const lines = read(INSECTS_CSV);
  const head = parseCsvLine(lines[0]);
  const idx = {
    insect_id: head.indexOf('insect_id'),
    japanese_name: head.indexOf('japanese_name'),
    scientific_name: head.indexOf('scientific_name'),
    old_japanese_name: head.indexOf('old_japanese_name'),
    alternative_name: head.indexOf('alternative_name'),
  };
  const byJa = new Map();
  const byJaOld = new Map();
  const byJaAlt = new Map();
  const bySci = new Map();
  const byGS = new Map();
  for (let i=1;i<lines.length;i++) {
    const l = lines[i]; if (!l) continue;
    const c = parseCsvLine(l);
    const id = c[idx.insect_id];
    const ja = c[idx.japanese_name]?.trim();
    const jaOld = idx.old_japanese_name>=0 ? c[idx.old_japanese_name]?.trim() : '';
    const alt = idx.alternative_name>=0 ? c[idx.alternative_name]?.trim() : '';
    const sci = c[idx.scientific_name]?.trim().replace(/^"|"$/g,'');
    if (ja) byJa.set(ja, id);
    if (jaOld) byJaOld.set(jaOld, id);
    if (alt) alt.split(/[、,;；]/).map(s=>s.trim()).filter(Boolean).forEach(a=>byJaAlt.set(a,id));
    if (sci) {
      bySci.set(sci, id);
      const gs = extractGS(sci);
      if (gs) {
        const arr = byGS.get(gs) || []; arr.push(id); byGS.set(gs, arr);
      }
    }
  }
  return { byJa, byJaOld, byJaAlt, bySci, byGS };
}

function loadNotesIndex() {
  const lines = read(NOTES_CSV);
  const head = parseCsvLine(lines[0]);
  const idx = {
    insect_id: head.indexOf('insect_id'),
    note_type: head.indexOf('note_type'),
    content: head.indexOf('content'),
    reference: head.indexOf('reference'),
  };
  const set = new Set();
  for (let i=1;i<lines.length;i++) {
    const l = lines[i]; if (!l) continue;
    const c = parseCsvLine(l);
    const key = `${c[idx.insect_id]}|${c[idx.note_type]}|${sanitize(c[idx.content])}|${c[idx.reference]}`;
    set.add(key);
  }
  return set;
}

function resolveId(maps, ja, sci) {
  let id = maps.byJa.get(ja) || maps.byJaOld.get(ja) || maps.byJaAlt.get(ja);
  if (!id && sci) id = maps.bySci.get(sci);
  if (!id && sci) {
    const gs = extractGS(sci); const arr = maps.byGS.get(gs) || [];
    if (arr.length === 1) id = arr[0];
  }
  return id;
}

function main() {
  if (!fs.existsSync(INPUT_CSV)) {
    console.error('Input missing:', INPUT_CSV); process.exit(2);
  }
  const maps = buildMaps();
  const have = loadNotesIndex();
  const lines = read(INPUT_CSV).slice(1).filter(Boolean);
  function parseBook1Line(line) {
    const firstComma = line.indexOf(',');
    if (firstComma < 0) return null;
    const ja = sanitize(line.slice(0, firstComma));
    const firstQuote = line.indexOf('"', firstComma + 1);
    const secondQuote = firstQuote >= 0 ? line.indexOf('"', firstQuote + 1) : -1;
    let sci = '', period = '', remarks = '';
    if (firstQuote >= 0 && secondQuote > firstQuote) {
      sci = sanitize(line.slice(firstQuote + 1, secondQuote));
      let rest = line.slice(secondQuote + 1);
      if (rest.startsWith(',')) rest = rest.slice(1);
      const lastComma = rest.lastIndexOf(',');
      if (lastComma >= 0) {
        period = sanitize(rest.slice(0, lastComma)).replace(/^"|"$/g, '');
        remarks = sanitize(rest.slice(lastComma + 1)).replace(/^"|"$/g, '');
      } else {
        period = sanitize(rest).replace(/^"|"$/g, '');
      }
    } else {
      // Fallback: determine which segment looks like period
      const parts = line.split(',').map(s => s.trim());
      const ja2 = sanitize(parts[0] || '');
      const looksLikePeriod = (s) => /(\d+\s*[~〜]?\s*\d*\s*月)|月|不明|春|夏|秋|冬|年間|上旬|中旬|下旬|頃|日|〜|~/.test(s || '');
      let k = -1;
      for (let i = 1; i < parts.length; i++) { if (looksLikePeriod(parts[i])) { k = i; break; } }
      sci = sanitize(parts.slice(1, k === -1 ? 2 : k).join(','));
      period = sanitize(k === -1 ? (parts[2] || '') : parts[k] || '').replace(/^"|"$/g, '');
      remarks = sanitize(k === -1 ? parts.slice(3).join(',') : parts.slice(k + 1).join(',')).replace(/^"|"$/g, '');
      if (!sci && parts[1]) sci = sanitize(parts[1]);
      if (!ja) ja = ja2;
    }
    return { ja, sci, period, remarks };
  }
  const missing = [];
  for (const line of lines) {
    const rec = parseBook1Line(line);
    if (!rec) continue;
    const { ja, sci, period, remarks } = rec;
    const id = resolveId(maps, ja, sci);
    if (!id) continue; // unmatched species are handled elsewhere
    if (period) {
      const k = `${id}|出現時期|${period}|${REF}`;
      if (!have.has(k)) missing.push({ insect_id: id, type: '出現時期', content: period, reference: REF, ja, sci });
    }
    if (remarks) {
      const k2 = `${id}|生態情報|${remarks}|${REF}`;
      if (!have.has(k2)) missing.push({ insect_id: id, type: '生態情報', content: remarks, reference: REF, ja, sci });
    }
  }
  fs.mkdirSync('reports', { recursive: true });
  const header = ['insect_id','note_type','content','reference','ja','sci'];
  const toCsv = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s;
  };
  const linesOut = [header.join(',')].concat(
    missing.map(m => [m.insect_id, m.type, m.content, m.reference, m.ja, m.sci].map(toCsv).join(','))
  );
  fs.writeFileSync(REPORT, linesOut.join('\n'), 'utf8');
  console.log(`Missing count=${missing.length}. Report: ${REPORT}`);
}

main();

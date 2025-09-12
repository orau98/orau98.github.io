import fs from 'fs';
import Papa from 'papaparse';

const INSECTS = 'public/insects.csv';
const INSECTS_NORM = 'normalized_data/insects.csv';
const NOTES = 'public/general_notes.csv';
const OVERRIDES = 'public/emergence_overrides.csv';

const readCsv = (file) => Papa.parse(fs.readFileSync(file, 'utf8'), { header: true, skipEmptyLines: true }).data;

// Split a CSV line robustly (simple parser tolerant of unquoted commas inside fields we later rejoin)
const splitCsvLine = (line) => {
  const out = [];
  let buf = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === ',' && !inQuotes) { out.push(buf); buf=''; }
    else { buf += ch; }
  }
  out.push(buf);
  return out.map(s => s.trim());
};

const containsCJK = (s) => /[\u3040-\u30FF\u3400-\u9FFF]/.test(s || '');
const dequote = (s) => (s || '').replace(/^"|"$/g, '').trim();
const isTimeLike = (s) => {
  const t = (s || '').trim();
  if (!t) return false;
  return /月|上旬|中旬|下旬|頃|春|夏|秋|冬|通年|年間|年中|\d+\s*-\s*\d+\s*月|\d+月/.test(t);
};

const normalizeJapaneseName = (s) => {
  if (!s) return '';
  let t = String(s).trim();
  // Remove any full/half width parenthetical commentary
  t = t.replace(/（[^）]*）/g, '').replace(/\([^)]*\)/g, '').trim();
  // Collapse spaces
  t = t.replace(/\s+/g, '');
  return t;
};

const canonicalScientific = (s) => {
  if (!s) return '';
  let t = String(s).trim();
  // Remove author/year parentheses segment at end if any
  t = t.replace(/\s*\([^)]*\)\s*$/, '').trim();
  // Handle Genus (Subgenus) species -> Genus species
  const gss = t.match(/^([A-Z][a-z]+)\s*\([^)]*\)\s+([a-z-]+)/);
  if (gss) return `${gss[1]} ${gss[2]}`;
  // Extract up to Genus + species (+ optional subspecies)
  const m = t.match(/^([A-Z][a-z]+)\s+([a-z-]+)(?:\s+([a-z-]+))?/);
  if (m) return `${m[1]} ${m[2]}${m[3] ? ' ' + m[3] : ''}`;
  return t;
};

const parseOverrides = (text) => {
  const lines = text.replace(/\r\n?|\n/g, '\n').split('\n');
  let start = 0;
  if ((lines[0] || '').includes('和名') && (lines[0] || '').includes('学名')) start = 1;
  const result = [];
  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    if (!line || /^\s*$/.test(line)) continue;
    const tokens = splitCsvLine(line);
    if (tokens.length < 2) continue;
    const jnameRaw = dequote(tokens[0]);
    const jname = jnameRaw;
    let idx = 1; const sciParts = [];
    for (; idx < tokens.length; idx++) { const tk = tokens[idx]; if (containsCJK(tk)) break; sciParts.push(tk); }
    let sci = dequote(sciParts.join(',').trim()); if (!sci && tokens[1]) sci = dequote(tokens[1]);
    let rest = tokens.slice(idx).map(dequote); while (rest.length && !rest[rest.length - 1]) rest.pop();
    let time = '', notes = '';
    if (rest.length === 1) time = rest[0] || '';
    else if (rest.length > 1) {
      const last = rest[rest.length - 1];
      const looksTime = isTimeLike(last) && !/(?:年\d化|年\s*\d+化|\d+化|多化|可能|思われ|越冬|越夏|昼|昼飛|灯火|害虫|記録|採集|地域|標高)/.test(last);
      if (looksTime) time = rest.join('、'); else { notes = last; time = rest.slice(0, -1).join('、'); }
    }
    if (!jname && !sci) continue;
    // 時期が未詳/不明でも、備考があれば生態情報として活用するため残す
    if (!time || time === '未詳' || time === '不明') {
      if ((notes || '').trim()) {
        result.push({ jname, jnameKey: normalizeJapaneseName(jname), sci, sciCanon: canonicalScientific(sci), time: '', notes });
      }
      continue;
    }
    result.push({ jname, jnameKey: normalizeJapaneseName(jname), sci, sciCanon: canonicalScientific(sci), time, notes });
  }
  return result;
};

function main() {
  const insects = readCsv(INSECTS);
  const insectsNorm = fs.existsSync(INSECTS_NORM) ? readCsv(INSECTS_NORM) : [];
  const notesCsv = fs.readFileSync(NOTES, 'utf8');
  const overridesCsv = fs.readFileSync(OVERRIDES, 'utf8');

  const idByJ = new Map();
  const idBySci = new Map();
  const idByJKey = new Map();
  const idBySciCanon = new Map();

  const addToMaps = (r) => {
    const id = (r['insect_id'] || '').trim();
    const jn = (r['japanese_name'] || '').trim();
    const sci = (r['scientific_name'] || '').trim();
    if (id && jn) idByJ.set(jn, id);
    if (id && jn) idByJKey.set(normalizeJapaneseName(jn), id);
    if (id && sci) {
      idBySci.set(sci, id);
      const cleaned = sci.replace(/\s*\([^)]*\)\s*$/, '').trim();
      if (cleaned && cleaned !== sci) idBySci.set(cleaned, id);
      idBySciCanon.set(canonicalScientific(sci), id);
    }
  };

  insects.forEach(addToMaps);
  // 補完: normalized_data からもIDマップを拡張（未収載の種を拾う）
  insectsNorm.forEach(addToMaps);

  const overrides = parseOverrides(overridesCsv);
  const { data: notes } = Papa.parse(notesCsv, { header: true, skipEmptyLines: false });

  const existingById = new Map();
  const ecologyById = new Map(); // Map<id, Set<content>> for 生態情報重複防止
  notes.forEach((n, idx) => {
    const id = (n['insect_id'] || '').trim();
    const type = (n['note_type'] || '').trim();
    if (!id || !type) return;
    const key = `${id}::${type}`;
    if (!existingById.has(key)) existingById.set(key, idx);
    if (type === '生態情報') {
      const c = (n['content'] || '').trim();
      if (!ecologyById.has(id)) ecologyById.set(id, new Set());
      if (c) ecologyById.get(id).add(c);
    }
  });

  let changes = 0;
  overrides.forEach(o => {
    const id = idByJ.get(o.jname) || idByJKey.get(o.jnameKey) || idBySci.get(o.sci) || idBySci.get(o.sciCanon) || idBySciCanon.get(o.sciCanon);
    if (!id) return;
    const key = `${id}::出現時期`;
    const idx = existingById.get(key);
    if (idx != null) {
      // Force unify: if overrides has concrete time, overwrite content and reference
      const cur = notes[idx];
      const content = (cur['content'] || '').trim();
      if (o.time) {
        if (content !== o.time) {
          cur['content'] = o.time;
          changes++;
        }
        // Always set reference to 図鑑1
        if ((cur['reference'] || '').trim() !== '日本産蛾類標準図鑑1') {
          cur['reference'] = '日本産蛾類標準図鑑1';
          changes++;
        }
      } else if (!o.time && content === '') {
        // Repair accidental empty content to '不明'
        cur['content'] = '不明';
        changes++;
      }
    } else if (o.time) {
      // Append new row
      notes.push({
        record_id: `note-ovr-${Date.now()}-${Math.floor(Math.random()*100000)}`,
        insect_id: id,
        note_type: '出現時期',
        content: o.time,
        reference: '日本産蛾類標準図鑑1',
        page: '',
        year: ''
      });
      changes++;
    }

    // 生態情報の追記（notesがある場合）。重複はスキップ
    const ec = (o.notes || '').trim();
    if (ec) {
      const ecSet = ecologyById.get(id) || new Set();
      if (!ecSet.has(ec)) {
        notes.push({
          record_id: `note-ovr-eco-${Date.now()}-${Math.floor(Math.random()*100000)}`,
          insect_id: id,
          note_type: '生態情報',
          content: ec,
          reference: '日本産蛾類標準図鑑1',
          page: '',
          year: ''
        });
        if (!ecologyById.has(id)) ecologyById.set(id, new Set());
        ecologyById.get(id).add(ec);
        changes++;
      }
    }
  });

  // Pass to update any existing rows added previously as ユーザー提供 to 図鑑1 for overrides-derived notes
  overrides.forEach(o => {
    const id = idByJ.get(o.jname) || idByJKey.get(o.jnameKey) || idBySci.get(o.sci) || idBySci.get(o.sciCanon) || idBySciCanon.get(o.sciCanon);
    if (!id) return;
    // Update 生態情報 reference if content matches and reference was ユーザー提供
    for (const n of notes) {
      if ((n['insect_id'] || '').trim() !== id) continue;
      const type = (n['note_type'] || '').trim();
      const content = (n['content'] || '').trim();
      const ref = (n['reference'] || '').trim();
      if (type === '生態情報' && o.notes && content === o.notes.trim() && (!ref || ref === 'ユーザー提供')) {
        n['reference'] = '日本産蛾類標準図鑑1';
        changes++;
      }
      if (type === '出現時期' && o.time && content === o.time.trim() && (!ref || ref === 'ユーザー提供')) {
        n['reference'] = '日本産蛾類標準図鑑1';
        changes++;
      }
    }
  });

  if (changes > 0) {
    const out = Papa.unparse(notes, { quotes: true });
    fs.writeFileSync(NOTES, out);
    console.log(`sync_overrides_to_general_notes: updated ${changes} rows in ${NOTES}`);
  } else {
    console.log('sync_overrides_to_general_notes: no changes needed');
  }
}

main();

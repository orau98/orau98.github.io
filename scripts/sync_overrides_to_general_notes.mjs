import fs from 'fs';
import Papa from 'papaparse';

const INSECTS = 'public/insects.csv';
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
    const jname = dequote(tokens[0]);
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
    if (!time || time === '未詳' || time === '不明') continue;
    result.push({ jname, sci, time, notes });
  }
  return result;
};

function main() {
  const insects = readCsv(INSECTS);
  const notesCsv = fs.readFileSync(NOTES, 'utf8');
  const overridesCsv = fs.readFileSync(OVERRIDES, 'utf8');

  const idByJ = new Map();
  const idBySci = new Map();
  insects.forEach(r => {
    const id = (r['insect_id'] || '').trim();
    const jn = (r['japanese_name'] || '').trim();
    const sci = (r['scientific_name'] || '').trim();
    if (id && jn) idByJ.set(jn, id);
    if (id && sci) {
      idBySci.set(sci, id);
      const cleaned = sci.replace(/\s*\([^)]*\)\s*$/, '').trim();
      if (cleaned && cleaned !== sci) idBySci.set(cleaned, id);
    }
  });

  const overrides = parseOverrides(overridesCsv);
  const { data: notes } = Papa.parse(notesCsv, { header: true, skipEmptyLines: false });

  const existingById = new Map();
  notes.forEach((n, idx) => {
    const id = (n['insect_id'] || '').trim();
    const type = (n['note_type'] || '').trim();
    if (!id || !type) return;
    const key = `${id}::${type}`;
    if (!existingById.has(key)) existingById.set(key, idx);
  });

  let changes = 0;
  overrides.forEach(o => {
    const id = idByJ.get(o.jname) || idBySci.get(o.sci);
    if (!id) return;
    const key = `${id}::出現時期`;
    const idx = existingById.get(key);
    if (idx != null) {
      // Update only if unknown/empty
      const cur = notes[idx];
      const content = (cur['content'] || '').trim();
      if (!content || content === '不明' || content === '未詳') {
        cur['content'] = o.time;
        cur['reference'] = cur['reference'] && cur['reference'].trim() ? cur['reference'] : 'ユーザー提供';
        changes++;
      }
    } else {
      // Append new row
      notes.push({
        record_id: `note-ovr-${Date.now()}-${Math.floor(Math.random()*100000)}`,
        insect_id: id,
        note_type: '出現時期',
        content: o.time,
        reference: 'ユーザー提供',
        page: '',
        year: ''
      });
      changes++;
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


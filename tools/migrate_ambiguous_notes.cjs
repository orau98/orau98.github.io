/*
  Migrate ambiguous general ecology sentences from hostplants notes to general_notes.
  - Reads reports/migrated_general_notes_ambiguous.json
  - For each insect_id, removes those sentences from notes in hostplants CSVs (public and normalized_data)
  - Adds a consolidated 生態情報 note: "広食性。" + combined tails per species
*/
const fs = require('fs');
const Papa = require('papaparse');

function loadCsv(path) {
  const text = fs.readFileSync(path, 'utf8');
  return Papa.parse(text, { header: true, skipEmptyLines: false });
}

function saveCsv(path, rows) {
  const out = Papa.unparse(rows, { header: true });
  fs.writeFileSync(path, out, 'utf8');
}

function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function stripLead(t) {
  let x = String(t).trim();
  x = x.replace(/^(比較的)?広食性(だ|で)?が、?/, '');
  x = x.replace(/^非常に広食性で、?/, '');
  x = x.replace(/^広食性で、?/, '');
  return x.trim();
}

function composeContent(tails) {
  const uniq = [];
  const set = new Set();
  for (let tail of tails) {
    tail = tail.trim();
    if (!tail) continue;
    if (!/[。.]$/.test(tail)) tail = tail + '。';
    if (!set.has(tail)) { set.add(tail); uniq.push(tail); }
  }
  const body = uniq.join(' ');
  return '広食性。' + (body ? (' ' + body) : '');
}

function migrate(hpPath, gnPath, ambiMap) {
  const hp = loadCsv(hpPath); const rows = hp.data;
  const gn = loadCsv(gnPath); const gnRows = gn.data;
  const existing = new Set(gnRows.map(r => (r.insect_id || '') + '|' + (r.content || '').trim()));
  const ts = (() => { const d = new Date(); const p = n => String(n).padStart(2, '0'); return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + p(d.getHours()) + p(d.getMinutes()); })();
  let rec = 1, numMod = 0, numAdd = 0;

  for (const [insect_id, list] of Object.entries(ambiMap)) {
    const tails = [];
    const refCount = new Map();
    for (const r of rows) {
      if (!r || r.insect_id !== insect_id) continue;
      let notes = (r.notes || '');
      if (!notes) continue;
      let changed = false;
      for (const s of list) {
        if (!s) continue;
        const sent = s.trim().replace(/[。]+$/, '');
        const re = new RegExp(escRe(sent) + '[。\.]*');
        if (re.test(notes)) {
          const tail = stripLead(sent);
          if (tail) tails.push(tail);
          notes = notes.replace(re, '');
          changed = true;
          const ref = (r.reference || '').trim();
          if (ref) refCount.set(ref, (refCount.get(ref) || 0) + 1);
        }
      }
      if (changed) {
        r.notes = notes.trim();
        numMod++;
      }
    }
    if (tails.length) {
      const content = composeContent(tails).trim();
      if (content && !existing.has(insect_id + '|' + content)) {
        let bestRef = ''; let best = -1;
        for (const [ref, c] of refCount.entries()) { if (c > best) { best = c; bestRef = ref; } }
        const recId = `note-MIG2-${ts}-${String(rec).padStart(3, '0')}`;
        gnRows.push({ record_id: recId, insect_id, note_type: '生態情報', content, reference: bestRef, page: '', year: '' });
        existing.add(insect_id + '|' + content); rec++; numAdd++;
      }
    }
  }
  saveCsv(hpPath, rows);
  saveCsv(gnPath, gnRows);
  console.log(hpPath, 'modified', numMod, 'added', numAdd);
}

function main() {
  const ambi = JSON.parse(fs.readFileSync('reports/migrated_general_notes_ambiguous.json', 'utf8'));
  migrate('public/hostplants.csv', 'public/general_notes.csv', ambi);
  migrate('normalized_data/hostplants.csv', 'normalized_data/general_notes.csv', ambi);
}

main();


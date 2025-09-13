#!/usr/bin/env node
// Dedupe Criocerinae (クビボソハムシ亜科) in public/insects.csv
// - Group by genus/species/subspecies (even if subfamily missing)
// - Prefer rows with filled subfamily/tribe; then smallest H id
// - Merge missing author/year/scientific_name/classification from alternates
// - Update hostplants/general_notes insect_id references accordingly

import fs from 'fs';
import path from 'path';

const INSECTS = path.join('public', 'insects.csv');
const HOSTP = path.join('public', 'hostplants.csv');
const HOST_N = path.join('normalized_data', 'hostplants.csv');
const NOTES = path.join('public', 'general_notes.csv');
const NOTES_N = path.join('normalized_data', 'general_notes.csv');
const REPORT = path.join('reports', 'criocerinae_dedupe_report.json');

function parseCsvLine(line) {
  const out = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === '"') { if (line[i+1] === '"') { cur += '"'; i++; } else { q = false; } } else cur += ch; }
    else { if (ch === '"') q = true; else if (ch === ',') { out.push(cur); cur = ''; } else cur += ch; }
  }
  out.push(cur);
  return out;
}

function csvEscape(s) {
  const str = (s ?? '').toString();
  return /[",\n]/.test(str) ? '"' + str.replace(/"/g, '""') + '"' : str;
}

function loadCsv(fp) {
  const text = fs.readFileSync(fp, 'utf-8').replace(/\r\n?|\n/g, '\n');
  const lines = text.split('\n');
  const header = lines[0];
  const rows = [];
  for (let i=1;i<lines.length;i++) {
    const line = lines[i]; if (!line || !line.trim()) continue;
    rows.push(parseCsvLine(line));
  }
  return { header, rows };
}

function writeCsv(fp, header, rows) {
  const out = [header, ...rows.map(r => r.map(csvEscape).join(','))].join('\n') + '\n';
  fs.writeFileSync(fp, out);
}

function canonicalKey(r) {
  const genus = (r[7]||'').trim();
  let species = (r[9]||'').trim();
  let subspecies = (r[10]||'').trim();
  if (!subspecies && /\s/.test(species)) {
    const parts = species.split(/\s+/).filter(Boolean);
    species = parts[0];
    subspecies = parts.slice(1).join(' ');
  }
  return [genus, species, subspecies].join('|');
}

function completenessScore(r) {
  const fields = [1,2,3,4,5,6,11,12,17]; // family/family_jp/subfamily/subfamily_jp/tribe/tribe_jp/author/year/scientific_name
  return fields.reduce((acc, idx) => acc + ((r[idx]||'').trim() ? 1 : 0), 0);
}

function isCriocerinaeRow(r) {
  const fam = (r[1]||'').trim();
  const subfam = (r[3]||'').trim();
  const genus = (r[7]||'').trim();
  if (fam === 'Chrysomelidae' && subfam === 'Criocerinae') return true;
  // include genus-based catch-all for incomplete entries
  return ['Lilioceris','Oulema','Lema','Crioceris','Syneta'].includes(genus);
}

function mergePreferred(base, alt) {
  // If base lacks key classification or author/year, fill from alt
  const preferIfEmpty = (idx) => { if (!(base[idx]||'').trim() && (alt[idx]||'').trim()) base[idx] = alt[idx]; };
  // classification
  [1,2,3,4,5,6,7,8,9,10].forEach(preferIfEmpty);
  // author/year/scientific_name
  [11,12,17].forEach(preferIfEmpty);
}

function main() {
  const ins = loadCsv(INSECTS);
  const groups = new Map();
  for (const r of ins.rows) {
    if (!isCriocerinaeRow(r)) continue;
    const key = canonicalKey(r);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  const idOf = (r)=> (r[0]||'');
  const hidNum = (id)=> parseInt((id.match(/^species-H(\d+)/)||[,'999999'])[1],10)||999999;
  const mapping = {}; // oldId -> keepId
  const removed = [];

  for (const [key, arr] of groups.entries()) {
    if (arr.length <= 1) continue;
    // choose best by completeness then smallest H id
    const sorted = arr.slice().sort((a,b)=>{
      const sa = completenessScore(a), sb = completenessScore(b);
      if (sa !== sb) return sb - sa;
      return hidNum(idOf(a)) - hidNum(idOf(b));
    });
    const keep = sorted[0];
    for (let i=1;i<sorted.length;i++) mergePreferred(keep, sorted[i]);
    const keepId = idOf(keep);
    for (let i=1;i<sorted.length;i++) {
      const id = idOf(sorted[i]);
      mapping[id] = keepId;
      removed.push(id);
    }
  }

  // Apply mapping: remove duplicate rows and keep merged keep rows
  const filtered = [];
  const toRemove = new Set(Object.keys(mapping));
  for (const r of ins.rows) {
    const id = idOf(r);
    if (toRemove.has(id)) continue;
    filtered.push(r);
  }
  // Backup and write insects
  const backupInsects = INSECTS + '.bak.dedupe_criocerinae_' + new Date().toISOString().replace(/[-:TZ.]/g,'').slice(0,14);
  fs.copyFileSync(INSECTS, backupInsects);
  writeCsv(INSECTS, ins.header, filtered);

  // Update references in hostplants/general_notes
  const applyMapToFile = (fp) => {
    if (!fs.existsSync(fp)) return 0;
    const { header, rows } = loadCsv(fp);
    // find insect_id column index
    const headerCols = parseCsvLine(header).map(h => h.replace(/^\"|\"$/g,'').trim());
    const idxInsect = headerCols.indexOf('insect_id');
    let changed = 0;
    for (const r of rows) {
      const old = (idxInsect>=0? r[idxInsect] : r[1]) || '';
      if (mapping[old]) { r[idxInsect>=0? idxInsect : 1] = mapping[old]; changed++; }
    }
    const backup = fp + '.bak.dedupe_criocerinae_' + new Date().toISOString().replace(/[-:TZ.]/g,'').slice(0,14);
    fs.copyFileSync(fp, backup);
    writeCsv(fp, header, rows);
    return changed;
  };
  const ch1 = applyMapToFile(HOSTP);
  const ch2 = applyMapToFile(HOST_N);
  const ch3 = applyMapToFile(NOTES);
  const ch4 = applyMapToFile(NOTES_N);

  const report = { removed, mapping, referencesUpdated: { public_hostplants: ch1, normalized_hostplants: ch2, public_notes: ch3, normalized_notes: ch4 }, backupInsects };
  fs.mkdirSync(path.dirname(REPORT), { recursive: true });
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));
  console.log('Criocerinae dedupe complete. Removed:', removed.length, 'Updated refs:', ch1+ch2+ch3+ch4);
}

main();


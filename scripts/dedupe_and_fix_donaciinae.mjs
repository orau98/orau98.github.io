#!/usr/bin/env node
// Dedupe Donaciinae rows in public/insects.csv and fix malformed Plateumaris entry (H638)

import fs from 'fs';
import path from 'path';

const FP = path.join('public', 'insects.csv');

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

function canonicalKey(r) {
  const genus = (r[7]||'').trim();
  let species = (r[9]||'').trim();
  let subspecies = (r[10]||'').trim();
  // If species contains a space and subspecies empty, split
  if (!subspecies && /\s/.test(species)) {
    const parts = species.split(/\s+/).filter(Boolean);
    species = parts[0] || species;
    subspecies = parts.slice(1).join(' ');
  }
  const subfam = (r[3]||'').trim();
  const fam = (r[1]||'').trim();
  return [fam, subfam, genus, species, subspecies].join('|');
}

const raw = fs.readFileSync(FP, 'utf-8').replace(/\r\n?|\n/g, '\n');
const lines = raw.split('\n');
const header = lines[0];
const rows = [];
for (let i=1;i<lines.length;i++) {
  const line = lines[i];
  if (!line || !line.trim()) continue;
  const cols = parseCsvLine(line);
  rows.push(cols);
}

// Fix H638 if needed by borrowing values from the correct Plateumaris sericea sibirica row (if present)
const idIndex = rows.findIndex(r => (r[0]||'') === 'species-H638');
let replacedH638From = null;
if (idIndex >= 0) {
  const r = rows[idIndex];
  const sci = (r[17] || '').trim();
  const malformed = !r[3] && /Plateumaris\s+sericea/i.test(sci);
  if (malformed) {
    const donorIdx = rows.findIndex(x => (x[7]||'') === 'Plateumaris' && (x[9]||'') === 'sericea' && (x[10]||'') === 'sibirica');
    if (donorIdx >= 0) {
      const d = rows[donorIdx];
      const keepId = r[0];
      // Copy all fields except insect_id
      const newRow = d.slice();
      newRow[0] = keepId;
      rows[idIndex] = newRow;
      // Mark donor for deletion later by setting insect_id to ''
      rows[donorIdx][0] = '';
      replacedH638From = d[0];
    } else {
      // If donor not found, minimally fix classification fields
      r[1] = 'Chrysomelidae'; r[2] = 'ハムシ科';
      r[3] = 'Donaciinae'; r[4] = 'ネクイハムシ亜科';
      r[5] = 'Donaciini'; r[6] = 'ネクイハムシ族';
      r[7] = 'Plateumaris'; r[8] = '';
      r[9] = 'sericea'; r[10] = '';
      r[13] = 'キヌツヤミズクサハムシ';
    }
  }
}

// Dedupe Donaciinae by canonical key; keep smallest numeric H id when duplicates
const groups = new Map();
for (const r of rows) {
  const fam = (r[1]||'').trim();
  const subfam = (r[3]||'').trim();
  if (fam !== 'Chrysomelidae' || subfam !== 'Donaciinae') continue;
  const k = canonicalKey(r);
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(r);
}

const toDelete = new Set();
for (const [k, arr] of groups.entries()) {
  if (arr.length <= 1) continue;
  // Choose smallest H id (numerically) as canonical
  const withIds = arr.map(r => ({ r, id: (r[0]||'') }));
  withIds.sort((a,b)=>{
    const na = parseInt((a.id.match(/^species-H(\d+)/)||[,'999999'])[1],10)||999999;
    const nb = parseInt((b.id.match(/^species-H(\d+)/)||[,'999999'])[1],10)||999999;
    return na - nb;
  });
  const keep = withIds[0].id;
  for (let i=1;i<withIds.length;i++) toDelete.add(withIds[i].id);
}

const filtered = rows.filter(r => (r[0]||'') && !toDelete.has(r[0]));

const backup = FP + '.bak.dedupe_donaciinae_' + new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0,14);
fs.copyFileSync(FP, backup);
const out = [header, ...filtered.map(r => r.map(csvEscape).join(','))].join('\n') + '\n';
fs.writeFileSync(FP, out);

console.log(`Deduped Donaciinae. Removed ${toDelete.size} rows. Fixed H638 using ${replacedH638From || 'inline fix'}. Backup: ${backup}`);


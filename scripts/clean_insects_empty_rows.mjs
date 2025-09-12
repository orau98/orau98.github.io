#!/usr/bin/env node
// Remove empty rows (missing insect_id) from public/insects.csv in-place
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

const raw = fs.readFileSync(FP, 'utf-8').replace(/\r\n?|\n/g, '\n');
const lines = raw.split('\n');
const header = lines[0];
const out = [header];
let removed = 0;
for (let i = 1; i < lines.length; i++) {
  const line = lines[i];
  if (!line || !line.trim()) { removed++; continue; }
  const cols = parseCsvLine(line);
  const id = (cols[0] || '').trim();
  if (!id) { removed++; continue; }
  out.push(line);
}
const backup = FP + '.bak.clean_' + new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
fs.copyFileSync(FP, backup);
fs.writeFileSync(FP, out.join('\n') + '\n');
console.log(`Removed ${removed} empty lines from public/insects.csv. Backup: ${backup}`);


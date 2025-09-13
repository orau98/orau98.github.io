#!/usr/bin/env node
// Audit duplicates by japanese_name in public/insects.csv
// Optional args: --family=Chrysomelidae --subfamily=Criocerinae

import fs from 'fs';
import path from 'path';

const args = Object.fromEntries(process.argv.slice(2).map(s=>{
  const m = s.match(/^--([^=]+)=(.*)$/); return m ? [m[1], m[2]] : [s,true];
}));

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

const txt = fs.readFileSync(FP, 'utf-8').replace(/\r\n?|\n/g, '\n');
const lines = txt.split('\n');
const header = parseCsvLine(lines[0]);
const rows = [];
for (let i=1;i<lines.length;i++) { const l=lines[i]; if (!l || !l.trim()) continue; rows.push(parseCsvLine(l)); }

const famFilter = (args.family || '').trim();
const subfamFilter = (args.subfamily || '').trim();

const map = new Map();
for (const r of rows) {
  const fam = (r[1]||'').trim();
  const subfam = (r[3]||'').trim();
  if (famFilter && fam !== famFilter) continue;
  if (subfamFilter && subfam !== subfamFilter) continue;
  const ja = (r[13]||'').trim(); if (!ja) continue;
  if (!map.has(ja)) map.set(ja, []);
  map.get(ja).push({ id: r[0], fam, subfam, genus: r[7], species: r[9], subspecies: r[10] });
}

const dups = [...map.entries()].filter(([k,v]) => v.length > 1).map(([k,v]) => ({ japanese_name: k, entries: v }));
console.log(JSON.stringify({ total_duplicates: dups.length, duplicates: dups }, null, 2));


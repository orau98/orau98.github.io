#!/usr/bin/env node
// Audit name collisions across japanese_name, old_japanese_name, alternative_name, other_names
// Options: --family=, --subfamily=, --limit=100

import fs from 'fs';
import path from 'path';

const args = Object.fromEntries(process.argv.slice(2).map(s=>{
  const m = s.match(/^--([^=]+)=(.*)$/); return m ? [m[1], m[2]] : [s,true];
}));

const FP = path.join('public','insects.csv');
const REPORT = path.join('reports','name_collisions.json');

function parseCsvLine(line){
  const out=[]; let cur=''; let q=false;
  for(let i=0;i<line.length;i++){
    const ch=line[i];
    if(q){ if(ch==='"'){ if(line[i+1]==='"'){cur+='"'; i++;} else { q=false; } } else cur+=ch; }
    else { if(ch==='"') q=true; else if(ch===','){ out.push(cur); cur=''; } else cur+=ch; }
  }
  out.push(cur); return out;
}

function splitNames(s){
  if(!s) return [];
  return s.split(/[、,，;；\n]/).map(x=>x.trim()).filter(Boolean);
}

const raw = fs.readFileSync(FP,'utf-8').replace(/\r\n?|\n/g,'\n');
const lines = raw.split('\n');
const header = parseCsvLine(lines[0]);
const rows = [];
for(let i=1;i<lines.length;i++){ const l=lines[i]; if(!l||!l.trim()) continue; rows.push(parseCsvLine(l)); }

const idx = {
  id: 0, family: 1, subfamily: 3, genus: 7, species: 9, subspecies: 10,
  japanese: 13, old: 14, alt: 15, other: 16
};

const famFilter = (args.family||'').trim();
const subfamFilter = (args.subfamily||'').trim();

const nameMap = new Map(); // name -> [{id, field, family, subfamily, genus, species, subspecies}]

for(const r of rows){
  const fam = (r[idx.family]||'').trim();
  const subfam = (r[idx.subfamily]||'').trim();
  if(famFilter && fam!==famFilter) continue;
  if(subfamFilter && subfam!==subfamFilter) continue;
  const id = (r[idx.id]||'').trim(); if(!id) continue;
  const names = [];
  const primary = (r[idx.japanese]||'').trim(); if(primary) names.push({name:primary, field:'japanese_name'});
  const old = (r[idx.old]||'').trim(); if(old) names.push({name:old, field:'old_japanese_name'});
  splitNames(r[idx.alt]).forEach(n=>names.push({name:n, field:'alternative_name'}));
  splitNames(r[idx.other]).forEach(n=>names.push({name:n, field:'other_names'}));
  for(const {name, field} of names){
    if(!nameMap.has(name)) nameMap.set(name, []);
    nameMap.get(name).push({ id, field, family: fam, subfamily: subfam, genus: (r[idx.genus]||'').trim(), species: (r[idx.species]||'').trim(), subspecies: (r[idx.subspecies]||'').trim() });
  }
}

const collisions = [];
for(const [name, entries] of nameMap.entries()){
  if(entries.length <= 1) continue;
  // Only report if entries belong to different insect_id or used in different rows
  const ids = Array.from(new Set(entries.map(e=>e.id)));
  if(ids.length <= 1) continue;
  const hasPrimary = entries.some(e=>e.field==='japanese_name');
  const hasOldOrAlt = entries.some(e=>e.field!=='japanese_name');
  if(hasPrimary && hasOldOrAlt) {
    collisions.push({ name, count: entries.length, ids, entries });
  } else if (!hasPrimary) {
    // name only appears in aliases across multiple IDs
    collisions.push({ name, count: entries.length, ids, entries });
  }
}

collisions.sort((a,b)=>b.count-a.count || a.name.localeCompare(b.name));

const limit = parseInt(args.limit||'100',10)||100;
const summary = collisions.slice(0, limit);
fs.mkdirSync(path.dirname(REPORT), { recursive: true });
fs.writeFileSync(REPORT, JSON.stringify({ total: collisions.length, collisions: summary }, null, 2));
console.log(`Collisions: ${collisions.length}. See ${REPORT}`);


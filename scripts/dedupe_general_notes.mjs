#!/usr/bin/env node
import fs from 'fs';
import Papa from 'papaparse';

const FILE='normalized_data/general_notes.csv';
const text=fs.readFileSync(FILE,'utf8');
const {data}=Papa.parse(text,{header:true,skipEmptyLines:false});
const out=[]; const seen=new Set();
for(const r of data){ if(!r) continue; const key=[r.insect_id||'', r.note_type||'', r.content||'', r.reference||''].join('|'); if(key==='|||') { out.push(r); continue; } if(seen.has(key)) continue; seen.add(key); out.push(r); }
const csv=Papa.unparse(out,{quotes:true});
fs.writeFileSync(FILE,csv,'utf8');
console.log('deduped rows:', data.length, '->', out.length);


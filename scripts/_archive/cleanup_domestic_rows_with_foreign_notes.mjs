#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

const FILE = path.join('normalized_data','hostplants.csv');

const txt = fs.readFileSync(FILE,'utf8');
const { data, meta } = Papa.parse(txt,{ header:true, skipEmptyLines:false });

const foreignKeys = ['オーストラリアでは','ロシアでは','ヨーロッパでは','海外では','国外では'];
let removed=0;
const out=[];
for (const r of data){
  if (!r || Object.keys(r).length===0){ out.push(r); continue; }
  const obs = r.observation_type || '';
  const plant = (r.plant_name||'').trim();
  const notes = r.notes || '';
  if (obs.includes('野外（国内）') && !plant && foreignKeys.some(k => notes.includes(k))){
    removed++;
    continue; // drop redundant domestic row that only carries foreign info
  }
  out.push(r);
}

const csv = Papa.unparse(out,{ header:true, columns: meta?.fields });
fs.writeFileSync(FILE,csv,'utf8');
console.log('cleanup_domestic_rows_with_foreign_notes: removed', removed);


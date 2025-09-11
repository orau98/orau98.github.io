#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

const FILE = path.join('normalized_data','hostplants.csv');

const txt = fs.readFileSync(FILE,'utf8');
const { data, meta } = Papa.parse(txt,{ header:true, skipEmptyLines:false });

let changed=0;
for (const r of data){
  if (!r || Object.keys(r).length===0) continue;
  const plant = (r.plant_name||'').trim();
  const notes = (r.notes||'').trim();
  if (!plant && notes === '未知'){
    r.plant_name = '不明';
    r.notes = '';
    changed++;
  }
}

const out = Papa.unparse(data,{ header:true, columns: meta?.fields });
fs.writeFileSync(FILE,out,'utf8');
console.log('fix_hostplants_unknown_plant_name: changed', changed);


#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

const FILE = path.join('normalized_data','general_notes.csv');

const text = fs.readFileSync(FILE,'utf8');
const { data } = Papa.parse(text,{ header:true, skipEmptyLines:false });
let changes=0;
for (const r of data){
  if (!r) continue;
  if ((r.reference||'') !== '日本産蛾類標準図鑑2') continue;
  if (!r.content) continue;
  let c = String(r.content);
  const c0 = c;
  // collapse multiple quotes and strip leading/trailing quotes chars
  c = c.replace(/"{2,}/g, '"');
  c = c.replace(/^"+/, '').replace(/"+$/, '');
  // collapse extra spaces
  c = c.replace(/\s{2,}/g, ' ').trim();
  if (c !== c0){ r.content = c; changes++; }
}
const out = Papa.unparse(data, { header:true, quotes:true });
fs.writeFileSync(FILE, out, 'utf8');
console.log('Cleaned Book2 note contents:', changes);


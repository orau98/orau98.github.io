#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

const NORM = path.join('normalized_data','hostplants.csv');
const PUB = path.join('public','hostplants.csv');

function sanitizeField(v){
  if (v == null) return '';
  let s = String(v);
  // Replace embedded CR/LF with a single space; collapse multiple spaces
  s = s.replace(/[\r\n]+/g,' ').replace(/\s{2,}/g,' ').trim();
  // Normalize lone double-quote artifacts
  if (s === '"') return '';
  return s;
}

function sanitizeFile(file){
  const txt = fs.readFileSync(file,'utf8');
  const { data, meta } = Papa.parse(txt,{ header:true, skipEmptyLines:false });
  const out = data.map(row => {
    if (!row) return row;
    const o = {};
    for (const k of (meta?.fields || Object.keys(row))) o[k] = sanitizeField(row[k]);
    return o;
  });
  const csv = Papa.unparse(out,{ header:true, columns: meta?.fields });
  fs.writeFileSync(file, csv, 'utf8');
}

sanitizeFile(NORM);
console.log('Sanitized', NORM);
try { sanitizeFile(PUB); console.log('Sanitized', PUB); } catch {}


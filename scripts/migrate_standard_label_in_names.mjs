#!/usr/bin/env node
// Move '標準図鑑：...' fragments from name fields into changes_since_standard
// Targets: public/insects.csv, normalized_data/insects.csv
// Report: reports/migrated_standard_labels_in_names.csv

import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

const FILES = [
  path.join('public', 'insects.csv'),
  path.join('normalized_data', 'insects.csv'),
];
const REPORT = path.join('reports', 'migrated_standard_labels_in_names.csv');

const NAME_FIELDS = ['japanese_name','old_japanese_name','alternative_name','other_names'];
const CHANGES_FIELD = 'changes_since_standard';
const STD_RE = /標準図鑑\s*[:：]\s*([^,、;；]*)/g; // capture the phrase following label until next delimiter

function readCsv(fp){
  const text = fs.readFileSync(fp,'utf8');
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: false });
  return { rows: parsed.data.filter(r => Object.keys(r).length>0), fields: parsed.meta?.fields || [] };
}

function writeCsv(fp, rows){
  const fields = rows.length ? Object.keys(rows[0]) : [];
  const csv = Papa.unparse(rows, { header: true, columns: fields });
  fs.writeFileSync(fp, csv + '\n');
}

function cleanupDelimiters(s){
  return (s||'')
    .replace(/^\s*[、,;；]\s*/,'')
    .replace(/\s*[、,;；]\s*$/,'')
    .trim();
}

function migrateOneFile(fp){
  const { rows, fields } = readCsv(fp);
  const out = [];
  const changed = [];
  for(const row of rows){
    const orig = { ...row };
    let moved = [];
    for(const f of NAME_FIELDS){
      let val = row[f] || '';
      if(!val || !/標準図鑑/.test(val)) continue;
      // collect all matches
      let m; const found = [];
      while((m = STD_RE.exec(val))){
        const phrase = (m[1]||'').trim();
        if(phrase) found.push(phrase);
      }
      if(found.length === 0) continue;
      moved.push(...found.map(p => `標準図鑑: ${p}`));
      // remove the matched label segments from the source field
      val = val.replace(/標準図鑑\s*[:：]\s*[^,、;；]*/g, '').replace(/\s{2,}/g,' ').trim();
      row[f] = cleanupDelimiters(val);
    }
    if(moved.length){
      const prev = (row[CHANGES_FIELD]||'').trim();
      row[CHANGES_FIELD] = cleanupDelimiters([prev, ...moved].filter(Boolean).join(' / '));
      out.push(row);
      changed.push({ insect_id: row['insect_id'], moved: moved.join(' | ') });
    } else {
      out.push(row);
    }
  }
  if(changed.length){
    const stamp = new Date().toISOString().replace(/[-:TZ.]/g,'').slice(0,14);
    fs.copyFileSync(fp, fp + '.bak.' + stamp);
    writeCsv(fp, out);
  }
  return { file: fp, count: changed.length };
}

function main(){
  fs.mkdirSync('reports', { recursive: true });
  const impacts = [];
  for(const fp of FILES){
    const r = migrateOneFile(fp);
    impacts.push(r);
  }
  const lines = ['file,count'].concat(impacts.map(i => `${i.file},${i.count}`));
  fs.writeFileSync(REPORT, lines.join('\n') + '\n');
  console.log('Migration summary:', impacts);
}

main();


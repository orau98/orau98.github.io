#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const FILE = path.join('normalized_data','insects.csv');

function parseCsv(text){
  const lines = text.replace(/\r\n?|\n/g,'\n').split('\n');
  const header = lines[0].split(',');
  const rows = lines.slice(1).map(l=>l.split(',')).filter(a=>a.length>1);
  return { header, rows };
}
function toCsv(header, rows){ return [header.join(',')].concat(rows.map(r=>r.join(','))).join('\n'); }

function main(){
  const text = fs.readFileSync(FILE,'utf8');
  const { header, rows } = parseCsv(text);
  const idx = {
    family: header.indexOf('family'),
    subfamily: header.indexOf('subfamily'),
    subfamily_jp: header.indexOf('subfamily_jp'),
    tribe: header.indexOf('tribe'),
    tribe_jp: header.indexOf('tribe_jp'),
  };
  let changes=0;
  for (const r of rows){
    if (r[idx.family] !== 'Noctuidae') continue;
    if (r[idx.subfamily] === 'Subfamily') { r[idx.subfamily] = r[idx.subfamily_jp]; r[idx.subfamily_jp] = ''; changes++; }
    if (r[idx.tribe] === 'Tribe') { r[idx.tribe] = r[idx.tribe_jp]; r[idx.tribe_jp] = ''; changes++; }
  }
  fs.writeFileSync(FILE, toCsv(header, rows), 'utf8');
  console.log('Fixed Noctuidae subfamily/tribe columns:', changes);
}

main();


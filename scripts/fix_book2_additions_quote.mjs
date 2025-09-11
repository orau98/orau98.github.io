#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const SRC = path.join('tmp', 'moth_emergence_notes_book2_additions.csv');
const DST = path.join('tmp', 'moth_emergence_notes_book2_additions_fixed.csv');

const looksLikePeriod = (s) => /(\d+\s*[~〜]?\s*\d*\s*月)|月|不明|春|夏|秋|冬|年間|年中|通年|上旬|中旬|下旬|頃|日|〜|~/.test((s||'').trim());

function splitCSV(line){
  // naive split (we will rebuild anyway)
  return line.split(',');
}

function fixLine(line){
  if (!line || /^\s*$/.test(line)) return line;
  if (line.startsWith('和名,')) return line; // header
  const raw = splitCSV(line);
  if (raw.length <= 2) return line;
  const ja = raw[0].trim();
  // find index of period-like token from col1 onward
  let k=-1;
  for (let i=1;i<raw.length;i++){
    if (looksLikePeriod(raw[i])) { k=i; break; }
  }
  if (k===-1){
    // fallback: assume last col is remarks
    const sci = raw.slice(1, raw.length-2).join(',').trim();
    const period = (raw[raw.length-2]||'').trim();
    const notes = raw.slice(raw.length-1).join(',').trim();
    const sciQ = '"'+sci.replace(/"/g,'""')+'"';
    const notesQ = notes? ('"'+notes.replace(/"/g,'""')+'"') : '';
    return [ja, sciQ, period, notesQ].join(',');
  }
  const sci = raw.slice(1, k).join(',').trim();
  const period = (raw[k]||'').trim();
  const notes = raw.slice(k+1).join(',').trim();
  const sciQ = '"'+sci.replace(/"/g,'""')+'"';
  const notesQ = notes? ('"'+notes.replace(/"/g,'""')+'"') : '';
  return [ja, sciQ, period, notesQ].join(',');
}

function main(){
  const text = fs.readFileSync(SRC,'utf8').replace(/\r\n?|\n/g,'\n');
  const out = text.split('\n').map(fixLine).join('\n');
  fs.writeFileSync(DST, out, 'utf8');
  console.log('Wrote fixed CSV:', DST);
}

main();


#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const REPORT = path.join('reports','unmatched_moth_emergence_book2.csv');
const BASE = path.join('tmp','moth_emergence_notes_book2.csv');
const ADD_FIX = path.join('tmp','moth_emergence_notes_book2_additions_fixed.csv');

function lines(p){ return fs.readFileSync(p,'utf8').replace(/\r\n?|\n/g,'\n').split('\n'); }

function parseCsvLine(line){
  const out=[]; let cur=''; let q=false;
  for(let i=0;i<line.length;i++){
    const ch=line[i];
    if(q){ if(ch==='"'){ if(line[i+1]==='"'){ cur+='"'; i++; } else { q=false; } } else { cur+=ch; } }
    else { if(ch==='"'){ q=true; } else if(ch===','){ out.push(cur); cur=''; } else { cur+=ch; } }
  }
  out.push(cur); return out;
}

function main(){
  if(!fs.existsSync(REPORT)){ console.error('Report not found'); process.exit(1); }
  const report = lines(REPORT).slice(1).filter(Boolean).map(l=>parseCsvLine(l)[0]); // Japanese names
  const addMap = new Map();
  for(const l of lines(ADD_FIX)){
    if(!l || l.startsWith('和名,')) continue;
    const ja = parseCsvLine(l)[0];
    addMap.set(ja,l);
  }
  let base = lines(BASE);
  let removed=0, added=0;
  for(const ja of report){
    if(!ja) continue;
    const fixed = addMap.get(ja);
    if(!fixed) continue;
    const before = base.length;
    base = base.filter((line,idx)=> idx===0 || !line.startsWith(ja+','));
    removed += (before - base.length);
    base.push(fixed);
    added += 1;
  }
  fs.writeFileSync(BASE, base.join('\n'), 'utf8');
  console.log(`Repaired tmp CSV using additions: removed ${removed}, added ${added}`);
}

main();


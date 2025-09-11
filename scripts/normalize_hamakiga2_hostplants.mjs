#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

const FILE = path.join('normalized_data','hostplants.csv');
const REF = '日本のハマキガ2';

const text = fs.readFileSync(FILE,'utf8');
const { data: rows } = Papa.parse(text,{ header:true, skipEmptyLines:false });

function nextIdFactory(list){
  let mx=0; for(const r of list){ const m=String(r.record_id||'').match(/^hostplant-(\d{6})$/); if(m){ const n=parseInt(m[1],10); if(n>mx) mx=n; } }
  return ()=> `hostplant-${String(++mx).padStart(6,'0')}`;
}

const nextId = nextIdFactory(rows);

function splitItems(notes){
  if(!notes) return [];
  let s = String(notes).trim();
  // capture trailing (○○科) for whole list
  let commonFamily = '';
  const mTrail = s.match(/\(([^\)]+科)\)\s*$/);
  if(mTrail){ commonFamily = mTrail[1]; s = s.slice(0,mTrail.index).trim(); }
  const foreignRe = /国外|ヨーロッパ|オーストラリア|海外|中国|台湾|朝鮮|ロシア|外地|異国/;
  // split by commas
  const parts = s.split(/\s*,\s*/).filter(Boolean);
  // propagate abbreviated genus like "B. koshevnikovii"
  let lastGenus='';
  const out=[];
  for(let p of parts){
    // skip foreign-only fragments
    if (foreignRe.test(p)) continue;
    // remove ending qualifiers like など, からも記録がある
    p = p.replace(/(など|からも記録がある|の草本類|の記録では.*)$/,'').trim();
    if(!p) continue;
    // pattern: 和名 Latin or 和名 Genus sp.
    let jp=''; let fam='';
    const famMatch = p.match(/\(([^\)]+科)\)/);
    if(famMatch){ fam = famMatch[1]; p = p.replace(/\([^)]*\)/g,'').trim(); }
    const m = p.match(/^([^A-Za-z\s]+)\s+([A-Z][a-zA-Z\.]*)(?:\s+([a-z-]+|sp\.|subsp\.|cf\.))?.*$/);
    if(m){
      jp = m[1].trim();
      let genus = m[2].replace(/\.$/,'');
      if(genus.length===1 && lastGenus) genus = lastGenus; else lastGenus = genus;
      const bin = m[3] && !/sp\.|subsp\.|cf\./.test(m[3]) ? `${genus} ${m[3]}` : genus;
      out.push({ plant_name: jp, plant_family: fam || commonFamily, sci: bin });
      continue;
    }
    // pattern: ○○属 Genus
    const m2 = p.match(/^([^\s]+)属\s*([A-Z][a-zA-Z]+)$/);
    if(m2){ jp = m2[1]+'属'; out.push({ plant_name: jp, plant_family: fam || commonFamily, sci: m2[2] }); continue; }
    // pattern: 単独和名のみ（例: 枯葉, 未知）→ skip
    if(/未知|枯葉/.test(p)) continue;
    // try only Latin genus present
    const m3 = p.match(/^([A-Z][a-zA-Z]+)$/);
    if(m3){ out.push({ plant_name: m3[1], plant_family: fam || commonFamily, sci: m3[1] }); continue; }
  }
  return out;
}

const keySet = new Set(rows.map(r => `${r.insect_id||''}|${r.plant_name||''}|${r.plant_family||''}|${r.observation_type||''}|${r.plant_part||''}|${r.life_stage||''}|${r.reference||''}`));

let added=0, updated=0;
const out=[];
for(const r of rows){
  if (!r || Object.keys(r).length===0){ out.push(r); continue; }
  if ((r.reference||'')!==REF){ out.push(r); continue; }
  const hasName = (r.plant_name||'').trim().length>0;
  const items = !hasName ? splitItems(r.notes||'') : [];
  if (!hasName && items.length>0){
    // remove original row (notes-only), replace with one row per item
    for(const it of items){
      const nr = { ...r };
      nr.record_id = nextId();
      nr.plant_name = it.plant_name;
      if (!nr.plant_family && it.plant_family) nr.plant_family = it.plant_family;
      // Keep part/life_stage as-is; clear notes to avoid duplication
      nr.notes = '';
      const k = `${nr.insect_id||''}|${nr.plant_name||''}|${nr.plant_family||''}|${nr.observation_type||''}|${nr.plant_part||''}|${nr.life_stage||''}|${nr.reference||''}`;
      if (!keySet.has(k)) { out.push(nr); keySet.add(k); added++; }
    }
    // do not push original
    continue;
  }
  // Otherwise keep as is
  out.push(r);
}

const csv = Papa.unparse(out,{ header:true });
fs.writeFileSync(FILE,csv,'utf8');
console.log(`normalize_hamakiga2_hostplants: added=${added}, updated=${updated}`);

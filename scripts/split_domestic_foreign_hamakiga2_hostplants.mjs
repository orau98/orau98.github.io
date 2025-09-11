#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

const FILE = path.join('normalized_data','hostplants.csv');
const REF = '日本のハマキガ2';

const txt = fs.readFileSync(FILE,'utf8');
const { data, meta } = Papa.parse(txt,{ header:true, skipEmptyLines:false });

function nextIdFactory(list){
  let mx=0; for(const r of list){ const m=String(r.record_id||'').match(/^hostplant-(\d{6})$/); if(m){ const n=parseInt(m[1],10); if(n>mx) mx=n; } }
  return ()=> `hostplant-${String(++mx).padStart(6,'0')}`;
}
const nextId = nextIdFactory(data);

const foreignTags = ['オーストラリアでは','ロシアでは','ヨーロッパでは','海外では','国外では'];

function extractForeignPlant(note){
  if (!note) return null;
  const s = String(note);
  for (const tag of foreignTags){
    const idx = s.indexOf(tag);
    if (idx>=0){
      const seg = s.slice(idx + tag.length).trim();
      // e.g., Drypetes属 (ツゲモドキ科)
      const m = seg.match(/([^,，。\s]+?)\s*\(([^\)]+科)\)/);
      if (m){
        return { plant_name: m[1], plant_family: m[2] };
      }
      // fallback: Genus 属 だけ
      const m2 = seg.match(/([^,，。\s]+?属)/);
      if (m2){
        return { plant_name: m2[1], plant_family: '' };
      }
    }
  }
  return null;
}

let changed=0, added=0;
const out=[];
for (const r of data){
  if (!r || Object.keys(r).length===0){ out.push(r); continue; }
  if ((r.reference||'')!==REF){ out.push(r); continue; }
  const obs = r.observation_type || '';
  const notes = r.notes || '';
  const hasDomesticUnknown = /国内では未知/.test(notes);
  const hasForeign = foreignTags.some(t => notes.includes(t));
  if (obs.includes('野外（国内）') && hasDomesticUnknown && hasForeign){
    // 1) Update current row as domestic unknown
    const nr = { ...r };
    nr.plant_name = '';
    nr.plant_family = '';
    nr.notes = '未知';
    out.push(nr);
    // 2) Add foreign row
    const f = extractForeignPlant(notes);
    if (f){
      const fr = { ...r };
      fr.record_id = nextId();
      fr.observation_type = '野外（国外）';
      fr.plant_name = f.plant_name;
      if (f.plant_family) fr.plant_family = f.plant_family;
      fr.notes = '';
      out.push(fr);
      added++;
    } else {
      out.push(r); // fallback: keep original untouched
    }
    changed++;
    continue;
  }
  out.push(r);
}

const csv = Papa.unparse(out,{ header:true, columns: meta?.fields });
fs.writeFileSync(FILE,csv,'utf8');
console.log(`split_domestic_foreign_hamakiga2_hostplants: changed=${changed}, added=${added}`);


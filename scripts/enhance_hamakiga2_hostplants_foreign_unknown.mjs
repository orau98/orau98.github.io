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

const foreignMap = [
  { key:'オーストラリアでは', label:'オーストラリア' },
  { key:'ロシアでは', label:'ロシア' },
  { key:'ヨーロッパでは', label:'ヨーロッパ' },
  { key:'海外では', label:'海外' },
  { key:'国外では', label:'国外' },
];

function extractItemsFromSegment(seg){
  // Expect patterns like: 和名 Latin (○○科) or Genus属 (○○科)
  const out=[];
  // Split by commas/ideographic comma and Japanese punctuation
  const parts = seg.split(/[、,，。]/).map(s=>s.trim()).filter(Boolean);
  for(let p of parts){
    // Match like: カバノキ属 Betula (カバノキ科)
    let m = p.match(/^([^\s\(\)]+?)\s+[A-Z][a-zA-Z.]*\s*\(([^\)]+科)\)/);
    if (m){ out.push({ name:m[1], family:m[2] }); continue; }
    // Match like: Drypetes属 (ツゲモドキ科)
    m = p.match(/^([^\s，、\.]+?属)\s*\(([^\)]+科)\)/);
    if (m){ out.push({ name:m[1], family:m[2] }); continue; }
    // Match minimal: ○○属 only
    m = p.match(/^([^\s，、\.]+?属)$/);
    if (m){ out.push({ name:m[1], family:'' }); continue; }
  }
  return out;
}

const keySet = new Set(data.map(r => `${r.insect_id||''}|${r.plant_name||''}|${r.plant_family||''}|${r.observation_type||''}|${r.life_stage||''}|${r.reference||''}|${r.notes||''}`));

let changed=0, added=0, updatedUnknown=0;
const out=[];
for (const r of data){
  if (!r || Object.keys(r).length===0){ out.push(r); continue; }
  if ((r.reference||'')!==REF){ out.push(r); continue; }
  let rowChanged=false;
  // 1) 国内では未知 → plant_name=不明, notes空
  if ((r.observation_type||'').includes('野外（国内）') && /国内では未知/.test(r.notes||'')){
    const nr = { ...r };
    nr.plant_name = '不明';
    nr.plant_family = (nr.plant_family||'');
    nr.notes = '';
    out.push(nr);
    updatedUnknown++;
    // proceed to add foreign segments from original notes as well
    const foreignSegText = String(r.notes||'');
    for (const fm of foreignMap){
      const idx = foreignSegText.indexOf(fm.key);
      if (idx>=0){
        const seg = foreignSegText.slice(idx + fm.key.length).trim();
        const items = extractItemsFromSegment(seg);
        for (const it of items){
          const fr = { ...r };
          fr.record_id = nextId();
          fr.observation_type = '野外（国外）';
          fr.plant_name = it.name;
          if (it.family) fr.plant_family = it.family;
          fr.notes = fm.label;
          const k = `${fr.insect_id||''}|${fr.plant_name||''}|${fr.plant_family||''}|${fr.observation_type||''}|${fr.life_stage||''}|${fr.reference||''}|${fr.notes||''}`;
          if (!keySet.has(k)) { out.push(fr); keySet.add(k); added++; }
        }
        rowChanged=true;
      }
    }
    changed += rowChanged?1:0;
    continue;
  }
  // 2) 国内では未知がなくても、外国セグメントがあるなら国外行を生成
  let foreignAdded=false;
  for (const fm of foreignMap){
    const s = String(r.notes||'');
    const idx = s.indexOf(fm.key);
    if (idx>=0){
      const seg = s.slice(idx + fm.key.length).trim();
      const items = extractItemsFromSegment(seg);
      for (const it of items){
        const fr = { ...r };
        fr.record_id = nextId();
        fr.observation_type = '野外（国外）';
        fr.plant_name = it.name;
        if (it.family) fr.plant_family = it.family;
        fr.notes = fm.label;
        const k = `${fr.insect_id||''}|${fr.plant_name||''}|${fr.plant_family||''}|${fr.observation_type||''}|${fr.life_stage||''}|${fr.reference||''}|${fr.notes||''}`;
        if (!keySet.has(k)) { out.push(fr); keySet.add(k); added++; foreignAdded=true; }
      }
    }
  }
  out.push(r);
}

const csv = Papa.unparse(out,{ header:true, columns: meta?.fields });
fs.writeFileSync(FILE,csv,'utf8');
console.log(`enhance_hamakiga2_hostplants_foreign_unknown: updatedUnknown=${updatedUnknown}, foreignAdded=${added}`);


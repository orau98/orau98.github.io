#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

const FILE = path.join('normalized_data','insects.csv');

const toSci = (genus,species,author,year) => `${genus} ${species} (${author}, ${year})`;

const ENTRIES = [
  { genus:'Lacanobia', species:'splendens', author:'Hübner', year:'[1808]', ja:'エゾチャイロヨトウ' },
  { genus:'Sideridis', species:'incommoda', author:'Staudinger', year:'1888', ja:'アサギリヨトウ' },
  { genus:'Mythimna', species:'pudorina', author:'Denis & Schiffermüller', year:'1775', ja:'ウスベニキヨトウ' },
  { genus:'Mythimna', species:'compta', author:'Moore', year:'1881', ja:'アトジロキヨトウ' },
  { genus:'Mythimna', species:'inouei', author:'Sugi', year:'1965', ja:'アマミキヨトウ' },
  { genus:'Mythimna', species:'curvilinea', author:'Hampson', year:'1891', ja:'ウスアカキヨトウ' },
  { genus:'Mythimna', species:'separata', author:'Walker', year:'1865', ja:'アワヨトウ' },
  { genus:'Mythimna', species:'postica', author:'Hampson', year:'1905', ja:'アカスジキヨトウ' },
  { genus:'Mythimna', species:'inanis', author:'Oberthür', year:'1880', ja:'ウスイロキヨトウ' },
  { genus:'Actebia', species:'fennica', author:'Tauscher', year:'1806', ja:'アトウスヤガ' },
  { genus:'Euxoa', species:'ochrogaster', author:'Guenée', year:'1852', ja:'クモマウスグロヤガ' },
  { genus:'Diarsia', species:'dahlii', author:'Hübner', year:'[1813]', ja:'エゾオオバコヤガ' },
  { genus:'Xestia', species:'speciosa', author:'Hübner', year:'[1813]', ja:'アルプスヤガ' },
  { genus:'Xestia', species:'sincera', author:'Herrich-Schäffer', year:'1851', ja:'アトジロアルプスヤガ' },
  { genus:'Xestia', species:'descripta', author:'Bremer', year:'1861', ja:'アサマウスモンヤガ' },
];

const text = fs.readFileSync(FILE,'utf8');
const parsed = Papa.parse(text,{header:true,skipEmptyLines:false});
const rows = parsed.data;
// find max species numeric id
let max = 0;
for(const r of rows){
  const id = (r['insect_id']||'');
  const m = /^species-(\d{1,5})$/.exec(id);
  if(m){ const n = parseInt(m[1],10); if(n>max) max=n; }
}

const header = parsed.meta.fields;
function blank(){ const o={}; for(const h of header) o[h]=''; return o; }
const out = rows.filter(r=>r && Object.keys(r).length>0);

for(const e of ENTRIES){
  // Skip if already present by exact sci or japanese_name
  const sci = toSci(e.genus,e.species,e.author,e.year);
  const exists = out.find(r => (r['scientific_name']||'').replace(/^"|"$/g,'')===sci || (r['japanese_name']||'')===e.ja);
  if (exists) continue;
  max += 1;
  const r = blank();
  r['insect_id'] = `species-${String(max)}`;
  r['family'] = 'Noctuidae';
  r['family_jp'] = 'ヤガ科';
  r['genus'] = e.genus;
  r['species'] = e.species;
  r['author'] = e.author;
  r['year'] = e.year;
  r['japanese_name'] = e.ja;
  r['scientific_name'] = sci;
  out.push(r);
}

const csv = Papa.unparse(out,{quotes:true,columns:header});
fs.writeFileSync(FILE,csv,'utf8');
console.log('Appended species:', ENTRIES.length);


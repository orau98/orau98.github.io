#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const LIST_URL = 'http://listmj.mothprog.com/list.html';
const INSECTS = path.join('normalized_data','insects.csv');
import { execSync } from 'child_process';
function fetch(url){ return execSync(`curl -sL ${url}`, { maxBuffer: 20*1024*1024 }).toString(); }

function stripTags(s){ return s.replace(/<[^>]+>/g,''); }

function findContext(html, binomial){
  const marker = `<span class="sciname">${binomial}</span>`;
  const idx = html.indexOf(marker);
  if (idx < 0) return null;
  const head = html.slice(0, idx);
  // Find nearest tribe and subfamily blocks
  const tribeIdx = head.lastIndexOf('<div class="tribe">');
  const subIdx = head.lastIndexOf('<div class="subfamily">');
  const famIdx = head.lastIndexOf('<div class="family">');
  const tribe = tribeIdx>=0 ? stripTags(html.slice(tribeIdx, head.indexOf('</div>', tribeIdx)+6)).trim() : '';
  const sub = subIdx>=0 ? stripTags(html.slice(subIdx, head.indexOf('</div>', subIdx)+6)).trim() : '';
  const fam = famIdx>=0 ? stripTags(html.slice(famIdx, head.indexOf('</div>', famIdx)+6)).trim() : '';
  function parseLabel(t){
    if (!t) return { en:'', jp:'' };
    let s = t.replace(/\b(Subfamily|Family|Tribe)\b/gi,'').trim();
    // e.g., "Noctuinae ヤガ亜科" or just "Hadeninae"
    const m2 = s.match(/([A-Za-z][A-Za-z-]+)(?:\s+([^\x00-\x7F\s]+))?/);
    if (m2) return { en: m2[1], jp: m2[2] || '' };
    return { en:'', jp:'' };
  }
  const subL = parseLabel(sub);
  const triL = parseLabel(tribe);
  return { subfamily: subL.en, subfamily_jp: subL.jp, tribe: triL.en, tribe_jp: triL.jp };
}

function parseCsv(text){
  const lines = text.replace(/\r\n?|\n/g,'\n').split('\n');
  const header = lines[0].split(',');
  const rows = lines.slice(1).map(l=>l.split(',')).filter(a=>a.length>1);
  return { header, rows, raw: lines };
}
function toCsv(header, rows){ return [header.join(',')].concat(rows.map(r=>r.join(','))).join('\n'); }

function main(){
  const html = fetch(LIST_URL);
  const text = fs.readFileSync(INSECTS,'utf8');
  const { header, rows } = parseCsv(text);
  const idx = {
    insect_id: header.indexOf('insect_id'),
    family: header.indexOf('family'),
    genus: header.indexOf('genus'),
    species: header.indexOf('species'),
    subfamily: header.indexOf('subfamily'),
    subfamily_jp: header.indexOf('subfamily_jp'),
    tribe: header.indexOf('tribe'),
    tribe_jp: header.indexOf('tribe_jp'),
    scientific_name: header.indexOf('scientific_name'),
  };
  const targets = new Set(['Lacanobia splendens','Sideridis incommoda','Mythimna pudorina','Mythimna compta','Mythimna inouei','Mythimna curvilinea','Mythimna separata','Mythimna postica','Mythimna inanis','Actebia fennica','Euxoa ochrogaster','Diarsia dahlii','Xestia speciosa','Xestia sincera','Xestia descripta']);
  let changes=0;
  for (const r of rows){
    const fam = r[idx.family];
    if (fam !== 'Noctuidae') continue;
    const bin = `${r[idx.genus]} ${r[idx.species]}`;
    if (!targets.has(bin)) continue;
    const subf = r[idx.subfamily] || '';
    const subfJa = r[idx.subfamily_jp] || '';
    const trib = r[idx.tribe] || '';
    const tribJa = r[idx.tribe_jp] || '';
    const ctx = findContext(html, bin);
    if (!ctx) continue;
    if ((!subf && ctx.subfamily) || (!subfJa && ctx.subfamily_jp)) {
      if (!subf && ctx.subfamily) r[idx.subfamily] = ctx.subfamily;
      if (!subfJa && ctx.subfamily_jp) r[idx.subfamily_jp] = ctx.subfamily_jp;
      changes++;
    }
    if ((!trib && ctx.tribe) || (!tribJa && ctx.tribe_jp)) {
      if (!trib && ctx.tribe) r[idx.tribe] = ctx.tribe;
      if (!tribJa && ctx.tribe_jp) r[idx.tribe_jp] = ctx.tribe_jp;
      changes++;
    }
  }
  fs.writeFileSync(INSECTS, toCsv(header, rows), 'utf8');
  console.log('Filled from ListMJ (subfamily/tribe) changes:', changes);
}

main();

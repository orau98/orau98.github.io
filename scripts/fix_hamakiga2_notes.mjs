#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

const NOTES = path.join('normalized_data','general_notes.csv');
const HOSTS = path.join('normalized_data','hostplants.csv');
const REF = '日本のハマキガ2';

const textN = fs.readFileSync(NOTES,'utf8');
const { data: notes } = Papa.parse(textN,{ header:true, skipEmptyLines:false });
const textH = fs.readFileSync(HOSTS,'utf8');
const { data: hosts } = Papa.parse(textH,{ header:true, skipEmptyLines:false });

const hostNoteSet = new Set();
for (const h of hosts){
  if (!h) continue;
  if ((h.reference||'')!==REF) continue;
  const key = `${h.insect_id||''}::${(h.notes||'').trim()}`;
  hostNoteSet.add(key);
}

let changed=0, removed=0;
const out=[];
const isPlantList = (s) => {
  if (!s) return false;
  const t = String(s);
  // Heuristics: contains a family marker (科) or mentions 属, or Latin genus + species with comma separation
  return /(\(.*科\))|属|[A-Z][a-z]+\s+[a-z]+/.test(t);
};
const isFeedingSentence = (s) => {
  if (!s) return false;
  const t = String(s);
  return /幼虫.*(潜|摂食|食|寄主)/.test(t);
};
const looksLikePeriod = (s) => /(\d+|[一二三四五六七八九十〜~\-])(月|上旬|中旬|下旬)/.test(String(s));

for (const n of notes){
  if (!n || Object.keys(n).length===0) { out.push(n); continue; }
  if ((n.reference||'')!==REF) { out.push(n); continue; }
  const key = `${n.insect_id||''}::${(n.content||'').trim()}`;
  // 1) 生態情報 だが食性（植物リスト）の場合で、hostplants 側に同内容がある → 削除
  if ((n.note_type||'')==='生態情報' && isPlantList(n.content) && hostNoteSet.has(key)){
    removed++; continue; // drop from general_notes
  }
  // 2) 出現時期 だが食性（幼虫は～食・潜）で、期間表現を含まない → 生態情報へ変更
  if ((n.note_type||'')==='出現時期' && isFeedingSentence(n.content) && !looksLikePeriod(n.content)){
    n.note_type = '生態情報';
    changed++;
  }
  out.push(n);
}

const csv = Papa.unparse(out, { header:true, quotes:true });
fs.writeFileSync(NOTES, csv, 'utf8');
console.log(`fix_hamakiga2_notes: changed=${changed}, removed=${removed}`);


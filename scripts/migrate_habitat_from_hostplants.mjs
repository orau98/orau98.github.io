#!/usr/bin/env node
// Move habitat-like notes from hostplants.csv to general_notes.csv
// Criteria: rows whose plant_family is empty AND plant_name matches certain patterns (habitat/behavior phrases)
// Affects: public/hostplants.csv, normalized_data/hostplants.csv -> remove matched rows
//          public/general_notes.csv, normalized_data/general_notes.csv -> append new 生態情報 notes
// Report: reports/migrated_habitat_from_hostplants.csv

import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

const PUB_HP = path.join('public', 'hostplants.csv');
const NORM_HP = path.join('normalized_data', 'hostplants.csv');
const PUB_NOTES = path.join('public', 'general_notes.csv');
const NORM_NOTES = path.join('normalized_data', 'general_notes.csv');
const REPORT = path.join('reports', 'migrated_habitat_from_hostplants.csv');

function ensureDir(p){ if(!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

function readCsv(fp){
  if(!fs.existsSync(fp)) return { data: [], meta: { fields: [] } };
  const text = fs.readFileSync(fp, 'utf8');
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: false });
  const data = parsed.data.filter(r => Object.keys(r).length > 0);
  return { data, meta: parsed.meta };
}

function writeCsv(fp, rows){
  const header = rows.length ? Object.keys(rows[0]) : [];
  const csv = Papa.unparse(rows, { header: true, columns: header });
  fs.writeFileSync(fp, csv + '\n');
}

function nextId(existingIds){
  // Generate unique note id with timestamp prefix to avoid collision
  const ts = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 12);
  let i = 1;
  while(true){
    const id = `note-HA${ts}-${String(i).padStart(3,'0')}`;
    if(!existingIds.has(id)) return id;
    i++;
  }
}

function buildPatterns(){
  const words = [
    '沼沢地','泥炭地','湿地','湿原','草地','荒地','河原','河川敷','湖畔','海岸','海辺','砂地','砂丘','崖地','岩場','渓流','渓谷','沢沿い',
    '林縁','林内','林道','二次林','人工林','照葉樹林','常緑広葉樹林','落葉広葉樹林','針葉樹林','遷移',
    '高山','亜高山','低地','山地','平地',
    'に生息','に産し','のみに産し','のみ産し','に多い','で見られる','につく点で特異',
    // 行動/生活史の誤混入も対象
    '単食性','狭食性','雄花','雌花','地面へ落下','枯れた部分を食べ','産卵','蛹化','幼虫期','成虫','集団をなす','大発生'
  ];
  return new RegExp(words.map(w=>w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'));
}

function migrate(hpRows, notesRows){
  const habitatRe = buildPatterns();
  const outHp = [];
  const moved = [];
  const existingNoteIds = new Set(notesRows.map(r=>r.record_id));

  for(const r of hpRows){
    const plantName = (r.plant_name||'').trim();
    const plantFam = (r.plant_family||'').trim();
    if(plantName && !plantFam && habitatRe.test(plantName)){
      const id = nextId(existingNoteIds); existingNoteIds.add(id);
      const content = [plantName, (r.notes||'').trim()].filter(Boolean).join(' ');
      moved.push({
        record_id: id,
        insect_id: (r.insect_id||'').trim(),
        note_type: '生態情報',
        content,
        reference: (r.reference||'').trim(),
        page: '',
        year: ''
      });
    } else {
      outHp.push(r);
    }
  }
  const outNotes = notesRows.concat(moved);
  return { outHp, outNotes, moved };
}

function main(){
  ensureDir('reports');
  const pubHp = readCsv(PUB_HP); const normHp = readCsv(NORM_HP);
  const pubNotes = readCsv(PUB_NOTES); const normNotes = readCsv(NORM_NOTES);

  const mPub = migrate(pubHp.data, pubNotes.data);
  const mNorm = migrate(normHp.data, normNotes.data);

  if(mPub.moved.length === 0 && mNorm.moved.length === 0){
    console.log('No habitat-like rows found to migrate.');
    return;
  }

  // backup originals
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g,'').slice(0,14);
  for(const fp of [PUB_HP, NORM_HP, PUB_NOTES, NORM_NOTES]){
    if(fs.existsSync(fp)) fs.copyFileSync(fp, fp + '.bak.' + stamp);
  }

  // write outputs
  writeCsv(PUB_HP, mPub.outHp);
  writeCsv(NORM_HP, mNorm.outHp);
  writeCsv(PUB_NOTES, mPub.outNotes);
  writeCsv(NORM_NOTES, mNorm.outNotes);

  // report
  const reportRows = [
    ['file','record_id','insect_id','content','reference']
  ];
  for(const r of mPub.moved){ reportRows.push(['public/general_notes.csv', r.record_id, r.insect_id, r.content, r.reference]); }
  for(const r of mNorm.moved){ reportRows.push(['normalized_data/general_notes.csv', r.record_id, r.insect_id, r.content, r.reference]); }
  fs.writeFileSync(REPORT, reportRows.map(row => row.map(cell => {
    const s = (cell??'').toString();
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s;
  }).join(',')).join('\n') + '\n');

  console.log(`Migrated habitat-like entries: public=${mPub.moved.length} normalized=${mNorm.moved.length}. Report: ${REPORT}`);
}

main();

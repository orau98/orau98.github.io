#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

const NORM = path.join('normalized_data', 'general_notes.csv');

const TARGET_FIELDS = ['record_id','insect_id','note_type','content','reference','page','year'];

const loadCSV = (p) => Papa.parse(fs.readFileSync(p, 'utf8'), { header: true, skipEmptyLines: true }).data;
const saveCSV = (p, rows) => {
  const sanitize = (v) => {
    if (v == null) return '';
    let s = String(v);
    s = s.replace(/\r?\n+/g, ' ').replace(/\s{2,}/g, ' ').trim();
    if (s === '"') return '';
    return s;
  };
  const mapped = rows.map(r => {
    const o = {};
    for (const k of TARGET_FIELDS) o[k] = sanitize(r[k]);
    // fix corrupted year fields accidentally containing record ids or non-year tokens
    if (o.year && /note-\d{6}/.test(o.year)) o.year = '';
    return o;
  });
  const csv = Papa.unparse(mapped, { header: true, columns: TARGET_FIELDS });
  fs.writeFileSync(p, csv, 'utf8');
};

function isEmptyRow(r) {
  if (!r) return true;
  return TARGET_FIELDS.every(k => !String(r[k] || '').trim());
}

function main() {
  if (!fs.existsSync(NORM)) {
    console.error('normalized_data/general_notes.csv not found');
    process.exit(1);
  }
  const rows = loadCSV(NORM);
  const cleaned = rows.filter(r => !isEmptyRow(r));
  saveCSV(NORM, cleaned);
  console.log(`Cleaned normalized_data/general_notes.csv (rows=${cleaned.length}).`);
}

main();

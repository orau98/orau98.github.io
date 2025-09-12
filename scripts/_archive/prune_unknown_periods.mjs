#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

const FILES = [
  path.join('normalized_data', 'general_notes.csv'),
  path.join('public', 'general_notes.csv'),
];

const loadCSV = (p) => Papa.parse(fs.readFileSync(p, 'utf8'), { header: true, skipEmptyLines: false }).data;
const saveCSV = (p, rows) => {
  const sanitize = (v) => {
    if (v == null) return '';
    let s = String(v);
    s = s.replace(/\r?\n+/g, ' ').replace(/\s{2,}/g, ' ').trim();
    if (s === '"') return '';
    return s;
  };
  const fields = ['record_id','insect_id','note_type','content','reference','page','year'];
  const out = rows.map(r => {
    const o = {};
    for (const k of fields) o[k] = sanitize(r[k]);
    return o;
  });
  const csv = Papa.unparse(out, { header: true, columns: fields });
  fs.writeFileSync(p, csv, 'utf8');
};

function pruneUnknownPeriods(rows) {
  const isPeriod = (r) => String(r.note_type || '').trim() === '出現時期';
  const isUnknown = (r) => isPeriod(r) && String(r.content || '').trim() === '不明';
  // Build availability map per insect_id: has any non-unknown period?
  const hasBetter = new Set();
  for (const r of rows) {
    if (isPeriod(r)) {
      const content = String(r.content || '').trim();
      if (content && content !== '不明' && r.insect_id) hasBetter.add(r.insect_id);
    }
  }
  // Filter out unknowns where better exists
  const filtered = rows.filter(r => !(isUnknown(r) && hasBetter.has(r.insect_id)));
  return filtered;
}

function dedupeByRecordId(rows) {
  const seen = new Set();
  const out = [];
  for (const r of rows) {
    const rid = String(r.record_id || '');
    if (rid) {
      if (seen.has(rid)) continue; // keep first occurrence
      seen.add(rid);
    }
    out.push(r);
  }
  return out;
}

function main() {
  for (const file of FILES) {
    if (!fs.existsSync(file)) { console.error('Missing file:', file); continue; }
    let rows = loadCSV(file);
    const before = rows.length;
    rows = dedupeByRecordId(rows);
    rows = pruneUnknownPeriods(rows);
    saveCSV(file, rows);
    console.log(`Pruned '不明' periods and deduped in ${file}: ${before} -> ${rows.length}`);
  }
}

main();


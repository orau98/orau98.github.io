#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

const PUB = path.join('public', 'general_notes.csv');
const NORM = path.join('normalized_data', 'general_notes.csv');

const loadCSV = (p) => Papa.parse(fs.readFileSync(p, 'utf8'), { header: true, skipEmptyLines: false }).data;
const saveCSV = (p, rows, headerOrder = null) => {
  // sanitize fields to keep 1 line per record
  const sanitize = (v) => {
    if (v == null) return '';
    let s = String(v);
    s = s.replace(/\r?\n+/g, ' ').replace(/\s{2,}/g, ' ').trim();
    if (s === '"') return '';
    return s;
  };
  const out = rows.map(r => {
    const o = {};
    const keys = headerOrder && headerOrder.length ? headerOrder : Object.keys(r || {});
    for (const k of keys) o[k] = sanitize(r[k]);
    return o;
  });
  const fields = headerOrder && headerOrder.length ? headerOrder : Object.keys(out[0] || {});
  const csv = Papa.unparse(out, { header: true, columns: fields });
  fs.writeFileSync(p, csv, 'utf8');
};

function keyOf(r) {
  return [r.insect_id || '', r.note_type || '', r.content || '', r.reference || ''].join('|');
}

function main() {
  if (!fs.existsSync(PUB)) {
    console.error('public/general_notes.csv not found');
    process.exit(1);
  }
  if (!fs.existsSync(NORM)) {
    console.error('normalized_data/general_notes.csv not found');
    process.exit(1);
  }
  const pub = loadCSV(PUB);
  const norm = loadCSV(NORM);
  // determine header from normalized file's header line
  const normHeaderLine = fs.readFileSync(NORM, 'utf8').split(/\r?\n/, 1)[0];
  const headerOrder = (normHeaderLine || 'record_id,insect_id,note_type,content,reference,page,year').split(',');
  const pubKeys = new Set(pub.map(keyOf));
  const normById = new Map();
  norm.forEach(r => { if (r && r.record_id) normById.set(String(r.record_id), r); });
  // First, reconcile public rows by record_id against normalized (normalized is source of truth)
  const reconciled = pub.map(r => {
    const rid = r && r.record_id ? String(r.record_id) : '';
    if (rid && normById.has(rid)) {
      const src = normById.get(rid);
      return src;
    }
    return r;
  });
  // Replace pub with reconciled rows and recompute key set
  let pubArr = reconciled;
  const pubKeySet = new Set(pubArr.map(keyOf));
  let added = 0;
  for (const r of norm) {
    const k = keyOf(r);
    if (!k) continue;
    if (!pubKeySet.has(k)) {
      pubArr.push(r); // preserve record_id from normalized
      pubKeySet.add(k);
      added += 1;
    }
  }
  // Always rewrite public with sanitized, normalized header order to eliminate stray artifacts
  saveCSV(PUB, pubArr, headerOrder);
  if (added > 0) {
    console.log(`Synced ${added} new notes from normalized to public.`);
  } else {
    console.log('No new notes to sync (file rewritten for normalization).');
  }
}

main();

#!/usr/bin/env node
// Remove rows in hostplants.csv and general_notes.csv that reference unknown insect_id
// Sources: public/*.csv and normalized_data/*.csv
// Output: in-place filtered CSVs and a report at reports/pruned_unknown_insect_refs.csv

import fs from 'fs';
import path from 'path';

const REPORT_PATH = path.join('reports', 'pruned_unknown_insect_refs.csv');

function ensureDir(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else { inQuotes = false; }
      } else cur += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { out.push(cur); cur = ''; }
      else cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function csvEscape(s) {
  const str = (s ?? '').toString();
  return /[",\n]/.test(str) ? '"' + str.replace(/"/g, '""') + '"' : str;
}

function loadValidInsectIds(files) {
  const ids = new Set();
  for (const fp of files) {
    if (!fs.existsSync(fp)) continue;
    const raw = fs.readFileSync(fp, 'utf-8').replace(/\r\n?|\n/g, '\n');
    const lines = raw.split('\n');
    if (lines.length === 0) continue;
    // insects.csv: insect_id is first column
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line || !line.trim()) continue;
      const cols = parseCsvLine(line);
      const id = (cols[0] || '').trim();
      if (id) ids.add(id);
    }
  }
  return ids;
}

function processFile(filePath, validIds, columns) {
  if (!fs.existsSync(filePath)) return { file: filePath, skipped: true };
  const raw = fs.readFileSync(filePath, 'utf-8').replace(/\r\n?|\n/g, '\n');
  const lines = raw.split('\n');
  if (lines.length === 0) return { file: filePath, empty: true };

  const header = lines[0];
  const headerCols = parseCsvLine(header).map(h => h.replace(/^\"|\"$/g, '').trim());
  const idxInsect = headerCols.indexOf('insect_id');
  const idxPlantName = headerCols.indexOf('plant_name');
  const idxNoteType = headerCols.indexOf('note_type');

  const out = [header];
  const pruned = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.trim()) continue;
    const cols = parseCsvLine(line);
    const insect_id = (cols[idxInsect] || '').trim();
    if (insect_id && !validIds.has(insect_id)) {
      // Collect report info
      const plant = idxPlantName >= 0 ? (cols[idxPlantName] || '').trim() : '';
      const ntype = idxNoteType >= 0 ? (cols[idxNoteType] || '').trim() : '';
      pruned.push({
        file: filePath,
        row: i + 1,
        insect_id,
        plant_name: plant,
        note_type: ntype
      });
      continue; // drop this line
    }
    out.push(line);
  }

  if (pruned.length > 0) {
    const backupPath = filePath + '.bak.' + new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
    fs.copyFileSync(filePath, backupPath);
    fs.writeFileSync(filePath, out.join('\n') + '\n');
  }
  return { file: filePath, pruned: pruned };
}

function main() {
  ensureDir('reports');
  const validIds = loadValidInsectIds([
    path.join('public', 'insects.csv')
  ]);

  const targets = [
    path.join('public', 'hostplants.csv'),
    path.join('normalized_data', 'hostplants.csv'),
    path.join('public', 'general_notes.csv'),
    path.join('normalized_data', 'general_notes.csv')
  ];

  const allPruned = [];
  for (const t of targets) {
    const result = processFile(t, validIds);
    if (result?.pruned?.length) allPruned.push(...result.pruned);
  }

  // Write report
  const header = ['file','row','insect_id','plant_name','note_type'];
  const csv = [header.join(',')].concat(allPruned.map(r => [r.file, r.row, r.insect_id, r.plant_name, r.note_type].map(csvEscape).join(','))).join('\n') + '\n';
  fs.writeFileSync(REPORT_PATH, csv);
  console.log(`Pruned ${allPruned.length} rows referencing unknown insect_id. Report: ${REPORT_PATH}`);
}

main();


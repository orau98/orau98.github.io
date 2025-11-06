#!/usr/bin/env node
// Fill empty plant_family in hostplants CSVs when the same plant_name
// elsewhere has exactly one non-empty family (i.e., unambiguous).
// Targets: public/hostplants.csv, normalized_data/hostplants.csv
// Report: reports/filled_hostplant_family.csv and reports/conflicting_hostplant_family.csv

import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

const FILES = [
  path.join('public', 'hostplants.csv'),
  path.join('normalized_data', 'hostplants.csv'),
];

const REPORT_FILLED = path.join('reports', 'filled_hostplant_family.csv');
const REPORT_CONFLICT = path.join('reports', 'conflicting_hostplant_family.csv');

function readCsv(fp) {
  const text = fs.readFileSync(fp, 'utf8');
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: false });
  const rows = parsed.data.filter(r => Object.keys(r).length > 0);
  const fields = parsed.meta?.fields || [];
  return { rows, fields };
}

function writeCsv(fp, rows) {
  const fields = rows.length ? Object.keys(rows[0]) : [];
  const csv = Papa.unparse(rows, { header: true, columns: fields });
  fs.writeFileSync(fp, csv + '\n');
}

function ensureReportsDir() { fs.mkdirSync('reports', { recursive: true }); }

function collectFamilyMap() {
  const nameToFamilies = new Map();
  for (const fp of FILES) {
    const { rows } = readCsv(fp);
    for (const r of rows) {
      const name = (r.plant_name || '').trim();
      const fam = (r.plant_family || '').trim();
      if (!name) continue;
      if (!nameToFamilies.has(name)) nameToFamilies.set(name, new Set());
      if (fam) nameToFamilies.get(name).add(fam);
    }
  }
  return nameToFamilies;
}

function main() {
  ensureReportsDir();
  const nameToFamilies = collectFamilyMap();

  // Derive resolvable families: exactly one unique family for the name
  const resolvable = new Map();
  const conflicts = [];
  for (const [name, famSet] of nameToFamilies.entries()) {
    const fams = Array.from(famSet);
    if (fams.length === 1) {
      resolvable.set(name, fams[0]);
    } else if (fams.length > 1) {
      conflicts.push({ plant_name: name, families: fams.join(' | '), count: fams.length });
    }
  }

  // Write conflicts report (for operator review)
  const conflictCsv = Papa.unparse(conflicts, { header: true });
  fs.writeFileSync(REPORT_CONFLICT, (conflicts.length ? conflictCsv : 'plant_name,families,count\n'), 'utf8');

  const filledRows = [];
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);

  for (const fp of FILES) {
    const { rows } = readCsv(fp);
    let changed = false;
    rows.forEach((r, idx) => {
      const name = (r.plant_name || '').trim();
      const fam = (r.plant_family || '').trim();
      if (!name || fam) return;
      const targetFam = resolvable.get(name);
      if (targetFam) {
        r.plant_family = targetFam;
        changed = true;
        filledRows.push({ file: fp, row: idx + 2, record_id: r.record_id || '', plant_name: name, filled_family: targetFam });
      }
    });
    if (changed) {
      // backup and write
      fs.copyFileSync(fp, fp + '.bak.' + stamp);
      writeCsv(fp, rows);
    }
  }

  const reportCsv = Papa.unparse(filledRows, { header: true });
  fs.writeFileSync(REPORT_FILLED, (filledRows.length ? reportCsv : 'file,row,record_id,plant_name,filled_family\n'), 'utf8');

  console.log(`Filled families: ${filledRows.length}. Conflicts: ${conflicts.length}.`);
  if (filledRows.length === 0) console.log('No unambiguous fills found.');
  console.log('Reports:', REPORT_FILLED, REPORT_CONFLICT);
}

main();


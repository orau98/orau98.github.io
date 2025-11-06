#!/usr/bin/env node
// Unify hostplant plant_family to YList (ylist-lite.json) when available.
// - If YList has a family for plant_name (or its canonical via alias), set plant_family to YList's value.
// - Applies to both public/hostplants.csv and normalized_data/hostplants.csv
// - Writes reports of changes.

import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

const HOSTPLANT_FILES = [
  path.join('public', 'hostplants.csv'),
  path.join('normalized_data', 'hostplants.csv'),
];
const YLIST_JSON = path.join('public', 'assets', 'data-lite', 'ylist-lite.json');
const REPORT = path.join('reports', 'unified_hostplant_family_ylist.csv');

function readCsv(fp) {
  const text = fs.readFileSync(fp, 'utf8');
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: false });
  const rows = parsed.data.filter(r => Object.keys(r).length > 0);
  return { rows, fields: parsed.meta?.fields || [] };
}

function writeCsv(fp, rows) {
  const fields = rows.length ? Object.keys(rows[0]) : [];
  const csv = Papa.unparse(rows, { header: true, columns: fields });
  fs.writeFileSync(fp, csv + '\n');
}

function loadYList() {
  const lite = JSON.parse(fs.readFileSync(YLIST_JSON, 'utf8'));
  const plants = lite?.plants || {};
  const aliasToCanonical = lite?.aliasToCanonical || {};
  return { plants, aliasToCanonical };
}

function canonicalize(name, aliasMap, plants) {
  if (!name) return '';
  if (plants[name]) return name;
  if (aliasMap[name]) return aliasMap[name];
  // Strip typical suffix like "類" (group), try again
  const stripped = name.replace(/類$/, '');
  if (plants[stripped]) return stripped;
  if (aliasMap[stripped]) return aliasMap[stripped];
  return '';
}

function main() {
  fs.mkdirSync('reports', { recursive: true });
  const { plants, aliasToCanonical } = loadYList();
  const changes = [];
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);

  for (const fp of HOSTPLANT_FILES) {
    const { rows } = readCsv(fp);
    let changed = false;
    rows.forEach((r, idx) => {
      const name = (r.plant_name || '').trim();
      let fam = (r.plant_family || '').trim();
      if (!name) return;
      const canonical = canonicalize(name, aliasToCanonical, plants);
      if (!canonical) return;
      const y = plants[canonical] || {};
      const yFam = (y.familyJp || y.family || '').trim();
      if (!yFam) return;
      if (fam !== yFam) {
        changes.push({ file: fp, row: idx + 2, record_id: r.record_id || '', plant_name: name, before: fam, after: yFam, canonical });
        r.plant_family = yFam;
        changed = true;
      }
    });
    if (changed) {
      fs.copyFileSync(fp, fp + '.bak.' + stamp);
      writeCsv(fp, rows);
    }
  }

  const csv = Papa.unparse(changes, { header: true });
  fs.writeFileSync(REPORT, (changes.length ? csv : 'file,row,record_id,plant_name,before,after,canonical\n'), 'utf8');
  console.log(`Unified ${changes.length} hostplant family entries to YList. Report: ${REPORT}`);
}

main();


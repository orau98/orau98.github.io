#!/usr/bin/env node
// Fill empty plant_family values in normalized_data/hostplants.csv only when
// the local YList-lite snapshot gives an unambiguous family and existing
// non-empty rows for the same plant_name do not conflict.

import fs from 'node:fs';
import path from 'node:path';
import Papa from 'papaparse';

const ROOT = path.join(import.meta.dirname, '..');
const HOSTPLANTS_CSV = path.join(ROOT, 'normalized_data', 'hostplants.csv');
const YLIST_LITE_JSON = path.join(ROOT, 'public', 'assets', 'data-lite', 'ylist-lite.json');
const REPORT_FILLED = path.join(ROOT, 'reports', 'filled_hostplant_family_ylist_2026-05-01.csv');
const REPORT_CONFLICT = path.join(ROOT, 'reports', 'conflicting_hostplant_family_ylist_2026-05-01.csv');

const readCsv = (filePath) => {
  const text = fs.readFileSync(filePath, 'utf8');
  const hasBom = text.charCodeAt(0) === 0xfeff;
  const parsed = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.replace(/^\uFEFF/, '').trim(),
  });
  return {
    rows: parsed.data || [],
    fields: parsed.meta?.fields || [],
    hasBom,
  };
};

const writeCsv = (filePath, rows, fields, hasBom) => {
  const csv = Papa.unparse(rows, { header: true, columns: fields });
  fs.writeFileSync(filePath, `${hasBom ? '\uFEFF' : ''}${csv}\n`, 'utf8');
};

const normalize = (value) => String(value || '').trim();

const loadYListFamilyLookup = () => {
  const ylistLite = JSON.parse(fs.readFileSync(YLIST_LITE_JSON, 'utf8'));
  const plants = ylistLite.plants || {};
  const aliasToCanonical = ylistLite.aliasToCanonical || {};
  return { plants, aliasToCanonical };
};

const resolveYListFamily = (plantName, plants, aliasToCanonical) => {
  const name = normalize(plantName);
  if (!name) return null;
  const canonical = plants[name] ? name : aliasToCanonical[name];
  const detail = canonical ? plants[canonical] : null;
  const family = normalize(detail?.familyJp);
  if (!canonical || !family) return null;
  return {
    canonical,
    family,
    scientificName: normalize(detail?.scientificName),
  };
};

const main = () => {
  const { rows, fields, hasBom } = readCsv(HOSTPLANTS_CSV);
  const { plants, aliasToCanonical } = loadYListFamilyLookup();

  const familiesByPlant = new Map();
  rows.forEach((row) => {
    const plantName = normalize(row.plant_name);
    const family = normalize(row.plant_family);
    if (!plantName || !family) return;
    if (!familiesByPlant.has(plantName)) familiesByPlant.set(plantName, new Set());
    familiesByPlant.get(plantName).add(family);
  });

  const filled = [];
  const conflicts = [];

  rows.forEach((row, index) => {
    const plantName = normalize(row.plant_name);
    const currentFamily = normalize(row.plant_family);
    if (!plantName || currentFamily) return;

    const ylist = resolveYListFamily(plantName, plants, aliasToCanonical);
    if (!ylist) return;

    const existingFamilies = Array.from(familiesByPlant.get(plantName) || []);
    if (existingFamilies.length > 0 && !existingFamilies.includes(ylist.family)) {
      conflicts.push({
        row: index + 2,
        record_id: row.record_id || '',
        insect_id: row.insect_id || '',
        plant_name: plantName,
        ylist_canonical: ylist.canonical,
        ylist_family: ylist.family,
        existing_families: existingFamilies.join(' | '),
        ylist_scientific_name: ylist.scientificName,
      });
      return;
    }

    row.plant_family = ylist.family;
    filled.push({
      row: index + 2,
      record_id: row.record_id || '',
      insect_id: row.insect_id || '',
      plant_name: plantName,
      filled_family: ylist.family,
      ylist_canonical: ylist.canonical,
      ylist_scientific_name: ylist.scientificName,
      factcheck_source: 'public/assets/data-lite/ylist-lite.json',
    });
  });

  writeCsv(HOSTPLANTS_CSV, rows, fields, hasBom);

  fs.mkdirSync(path.join(ROOT, 'reports'), { recursive: true });
  fs.writeFileSync(
    REPORT_FILLED,
    `${Papa.unparse(filled, {
      header: true,
      columns: [
        'row',
        'record_id',
        'insect_id',
        'plant_name',
        'filled_family',
        'ylist_canonical',
        'ylist_scientific_name',
        'factcheck_source',
      ],
    })}\n`,
    'utf8',
  );
  fs.writeFileSync(
    REPORT_CONFLICT,
    `${Papa.unparse(conflicts, {
      header: true,
      columns: [
        'row',
        'record_id',
        'insect_id',
        'plant_name',
        'ylist_canonical',
        'ylist_family',
        'existing_families',
        'ylist_scientific_name',
      ],
    })}\n`,
    'utf8',
  );

  console.log(`Filled ${filled.length} hostplant family cells from YList-lite.`);
  console.log(`Skipped ${conflicts.length} conflicting rows.`);
  console.log(`Report: ${path.relative(ROOT, REPORT_FILLED)}`);
  console.log(`Conflicts: ${path.relative(ROOT, REPORT_CONFLICT)}`);
};

main();

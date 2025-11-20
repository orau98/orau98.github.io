#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

const DATA_PATH = path.join('data', 'moth_ecology_book2_batch2.csv');
const INSECT_PATH = path.join('public', 'insects.csv');
const TARGETS = [
  path.join('public', 'hostplants.csv'),
  path.join('normalized_data', 'hostplants.csv'),
];
const REPORT_PATH = path.join('reports', 'book2_batch2_hostplants_report.json');
const REFERENCE = '日本産蛾類標準図鑑2';
const OBSERVATION_TYPE = '野外（国内）';
const PLANT_PART = '葉';
const LIFE_STAGE = '幼虫';
const SKIP_PATTERN = /(未知|不明|未詳)/;

function loadCsv(file) {
  const text = fs.readFileSync(file, 'utf8');
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: false });
  const rows = parsed.data
    .map(row => row || {})
    .filter(row => Object.values(row).some(value => (value ?? '').toString().trim() !== ''));
  return { rows, header: parsed.meta.fields };
}

function writeCsv(file, rows) {
  const csv = Papa.unparse(rows, {
    columns: ['record_id', 'insect_id', 'plant_name', 'plant_family', 'observation_type', 'plant_part', 'life_stage', 'reference', 'notes'],
  });
  fs.writeFileSync(file, csv + '\n', 'utf8');
}

function buildInsectIndex() {
  const text = fs.readFileSync(INSECT_PATH, 'utf8');
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: false });
  const byJapanese = new Map();
  const byScientific = new Map();
  const byGenusSpecies = new Map();
  for (const row of parsed.data) {
    if (!row) continue;
    const insectId = (row.insect_id || '').trim();
    if (!insectId) continue;
    const jp = (row.japanese_name || '').trim();
    if (jp && !byJapanese.has(jp)) byJapanese.set(jp, insectId);
    const sci = (row.scientific_name || '').trim().replace(/\s+/g, ' ');
    if (sci && !byScientific.has(sci)) byScientific.set(sci, insectId);
    const genus = (row.genus || '').trim();
    const species = (row.species || '').trim();
    if (genus && species) {
      const key = `${genus} ${species}`.toLowerCase();
      if (!byGenusSpecies.has(key)) byGenusSpecies.set(key, insectId);
    }
  }
  return { byJapanese, byScientific, byGenusSpecies };
}

function guessInsectId(indexes, japaneseName, scientificName) {
  const jp = (japaneseName || '').trim();
  if (jp && indexes.byJapanese.has(jp)) return indexes.byJapanese.get(jp);
  const sciRaw = (scientificName || '').trim().replace(/\s+/g, ' ');
  if (sciRaw && indexes.byScientific.has(sciRaw)) return indexes.byScientific.get(sciRaw);
  const match = sciRaw.match(/^([A-Za-z\.-]+)\s+([a-z0-9\.-]+)/);
  if (match) {
    const key = `${match[1]} ${match[2]}`.toLowerCase();
    if (indexes.byGenusSpecies.has(key)) return indexes.byGenusSpecies.get(key);
  }
  return null;
}

function extractHostSegment(ecologyRaw) {
  if (!ecologyRaw) return '';
  const clean = ecologyRaw.replace(/"/g, '').trim();
  const match = clean.match(/寄主植物:\s*(.+)/);
  if (!match) return '';
  let segment = match[1].trim();
  segment = segment.replace(/[。．]+$/u, '').trim();
  return segment;
}

function cleanText(value) {
  return (value || '')
    .replace(/"/g, '')
    .replace(/[。．]+$/u, '')
    .trim();
}

function cleanFamily(value) {
  return cleanText(value).replace(/^.*?：/, '').trim();
}

function cleanPlantName(value) {
  return cleanText(value)
    .replace(/^・+/, '')
    .replace(/^又は/, '')
    .trim();
}

function parseHostList(text) {
  if (!text) return [];
  const normalized = text
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/，/g, '、')
    .replace(/,/g, '、');
  const tokens = normalized.split('、').map(tok => tok.trim()).filter(Boolean);
  const pending = [];
  const seen = new Set();
  const results = [];

  const addEntry = (name, family) => {
    const plant = cleanPlantName(name);
    if (!plant || SKIP_PATTERN.test(plant)) return;
    let fam = cleanFamily(family);
    if (!fam && /科$/.test(plant)) fam = plant;
    const key = `${plant}|${fam}`;
    if (seen.has(key)) return;
    seen.add(key);
    results.push({ plant_name: plant, plant_family: fam });
  };

  const flushPending = family => {
    if (pending.length === 0) return;
    for (const name of pending) addEntry(name, family);
    pending.length = 0;
  };

  for (const token of tokens) {
    const match = token.match(/^(.*?)(?:\s*\((.+)\))?$/);
    const name = match ? match[1].trim() : token;
    let note = match && match[2] ? match[2].trim() : '';
    if (note) note = note.replace(/^以上/, '').trim();

    if (match && match[2] && /^以上/.test(match[2].trim())) {
      if (name) pending.push(name);
      flushPending(note);
      continue;
    }

    if (note) {
      addEntry(name, note);
    } else if (name) {
      pending.push(name);
    }
  }

  flushPending('');
  return results;
}

function sortHostRows(rows) {
  return [...rows].sort((a, b) => {
    const ai = (a.insect_id || '').localeCompare(b.insect_id || '');
    if (ai !== 0) return ai;
    const pn = (a.plant_name || '').localeCompare(b.plant_name || '');
    if (pn !== 0) return pn;
    return (a.record_id || '').localeCompare(b.record_id || '');
  });
}

function nextIdGenerator(rows) {
  let max = 0;
  for (const row of rows) {
    const match = (row.record_id || '').match(/^hostplant-(\d+)/);
    if (match) max = Math.max(max, Number(match[1]));
  }
  let current = max;
  return () => `hostplant-${String(++current).padStart(6, '0')}`;
}

function main() {
  if (!fs.existsSync(DATA_PATH)) {
    console.error(`Data file not found: ${DATA_PATH}`);
    process.exit(1);
  }

  const { rows: dataRows } = loadCsv(DATA_PATH);
  const indexes = buildInsectIndex();
  const { rows: hostRows } = loadCsv(TARGETS[0]);
  const nextId = nextIdGenerator(hostRows);

  const existingKeys = new Set(
    hostRows.map(row => `${(row.insect_id || '').trim()}|${(row.plant_name || '').trim()}|${(row.plant_family || '').trim()}`)
  );

  const additions = [];
  const unmatched = [];
  let skipped = 0;

  for (const row of dataRows) {
    const insectId = guessInsectId(indexes, row['和名'], row['学名']);
    if (!insectId) {
      unmatched.push({ japanese_name: row['和名'], scientific_name: row['学名'] });
      continue;
    }

    const hostSegment = extractHostSegment(row['生態の備考']);
    const hostEntries = parseHostList(hostSegment);
    if (hostEntries.length === 0) {
      if (hostSegment) skipped += 1;
      continue;
    }

    for (const entry of hostEntries) {
      const key = `${insectId}|${entry.plant_name}|${entry.plant_family}`;
      if (existingKeys.has(key)) continue;
      existingKeys.add(key);
      additions.push({
        record_id: nextId(),
        insect_id: insectId,
        plant_name: entry.plant_name,
        plant_family: entry.plant_family,
        observation_type: OBSERVATION_TYPE,
        plant_part: PLANT_PART,
        life_stage: LIFE_STAGE,
        reference: REFERENCE,
        notes: '',
      });
    }
  }

  if (additions.length === 0) {
    console.log('No hostplant rows to add.');
  } else {
    const sortedAdditions = sortHostRows(additions);
    for (const target of TARGETS) {
      const { rows } = loadCsv(target);
      writeCsv(target, [...rows, ...sortedAdditions]);
      console.log(`Updated ${target} (+${additions.length})`);
    }
  }

  const report = {
    source: DATA_PATH,
    reference: REFERENCE,
    added_rows: additions.length,
    skipped_segments: skipped,
    unmatched,
    timestamp: new Date().toISOString(),
  };
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(`Wrote report to ${REPORT_PATH}`);
}

main();

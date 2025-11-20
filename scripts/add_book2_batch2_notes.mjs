#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

const DATA_PATH = path.join('data', 'moth_ecology_book2_batch2.csv');
const INSECT_PATH = path.join('public', 'insects.csv');
const TARGETS = [
  path.join('public', 'general_notes.csv'),
  path.join('normalized_data', 'general_notes.csv'),
];
const REPORT_PATH = path.join('reports', 'book2_batch2_notes_report.json');
const REFERENCE = '日本産蛾類標準図鑑2';
const SKIP_WORDS = new Set(['', '未詳', '不明']);

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
    columns: ['record_id', 'insect_id', 'note_type', 'content', 'reference', 'page', 'year'],
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

function normalizeContent(text) {
  const trimmed = (text || '').trim();
  if (!trimmed) return '';
  if (/[。．.!！?？]$/.test(trimmed)) return trimmed;
  return `${trimmed}。`;
}

function cleanValue(value) {
  return (value || '').trim().replace(/^"|"$/g, '').trim();
}

function shouldSkip(value) {
  const trimmed = cleanValue(value);
  return SKIP_WORDS.has(trimmed);
}

function sortNotes(rows) {
  return [...rows].sort((a, b) => {
    const ai = (a.insect_id || '').localeCompare(b.insect_id || '');
    if (ai !== 0) return ai;
    const nt = (a.note_type || '').localeCompare(b.note_type || '');
    if (nt !== 0) return nt;
    return (a.record_id || '').localeCompare(b.record_id || '');
  });
}

function parseBatchData() {
  if (!fs.existsSync(DATA_PATH)) {
    console.error(`Data file not found: ${DATA_PATH}`);
    process.exit(1);
  }
  const { rows } = loadCsv(DATA_PATH);
  return rows.map(row => ({
    japanese: cleanValue(row['和名']),
    scientific: cleanValue(row['学名']),
    adult: cleanValue(row['成虫時期']),
    ecology: cleanValue(row['生態の備考']),
  })).filter(row => row.japanese);
}

function main() {
  const batchRows = parseBatchData();
  const indexes = buildInsectIndex();

  const { rows: publicNotes } = loadCsv(TARGETS[0]);
  const existing = new Set(
    publicNotes.map(r => `${(r.insect_id || '').trim()}|${(r.note_type || '').trim()}|${(r.content || '').trim()}`)
  );

  const timestamp = (() => {
    const d = new Date();
    const pad = n => n.toString().padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}`;
  })();

  let emergenceCounter = 1;
  let ecologyCounter = 1;
  let skippedEmergence = 0;
  let skippedEcology = 0;
  const additions = [];
  const unmatched = [];

  for (const row of batchRows) {
    const insectId = guessInsectId(indexes, row.japanese, row.scientific);
    if (!insectId) {
      unmatched.push({ japanese_name: row.japanese, scientific_name: row.scientific });
      continue;
    }

    const emergenceRaw = cleanValue(row.adult);
    if (emergenceRaw && !shouldSkip(emergenceRaw)) {
      const content = normalizeContent(emergenceRaw);
      const key = `${insectId}|出現時期|${content}`;
      if (!existing.has(key)) {
        const recordId = `note-B2B2-E-${timestamp}-${String(emergenceCounter++).padStart(3, '0')}`;
        additions.push({
          record_id: recordId,
          insect_id: insectId,
          note_type: '出現時期',
          content,
          reference: REFERENCE,
          page: '',
          year: '',
        });
        existing.add(key);
      }
    } else if (emergenceRaw) {
      skippedEmergence += 1;
    }

    const ecologyRaw = cleanValue(row.ecology);
    if (ecologyRaw && !shouldSkip(ecologyRaw)) {
      const content = normalizeContent(ecologyRaw);
      const key = `${insectId}|生態情報|${content}`;
      if (!existing.has(key)) {
        const recordId = `note-B2B2-Eco-${timestamp}-${String(ecologyCounter++).padStart(3, '0')}`;
        additions.push({
          record_id: recordId,
          insect_id: insectId,
          note_type: '生態情報',
          content,
          reference: REFERENCE,
          page: '',
          year: '',
        });
        existing.add(key);
      }
    } else if (ecologyRaw) {
      skippedEcology += 1;
    }
  }

  if (additions.length === 0) {
    console.log('No new notes to add.');
    return;
  }

  for (const target of TARGETS) {
    const { rows } = loadCsv(target);
    const merged = sortNotes([...rows, ...additions]);
    writeCsv(target, merged);
    console.log(`Updated ${target} (+${additions.length})`);
  }

  const report = {
    source: DATA_PATH,
    reference: REFERENCE,
    added_notes: additions.length,
    skipped_emergence: skippedEmergence,
    skipped_ecology: skippedEcology,
    unmatched,
    timestamp: new Date().toISOString(),
  };
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(`Wrote report to ${REPORT_PATH}`);
}

main();

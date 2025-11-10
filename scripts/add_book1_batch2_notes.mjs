#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

const DATA_PATH = path.join('data', 'moth_ecology_book1_batch2.csv');
const INSECT_PATH = path.join('public', 'insects.csv');
const TARGETS = [
  path.join('public', 'general_notes.csv'),
  path.join('normalized_data', 'general_notes.csv'),
];
const REFERENCE = '日本産蛾類標準図鑑1';
const SKIP_WORDS = new Set(['', '未詳', '不明']);

function loadCsv(file) {
  const text = fs.readFileSync(file, 'utf8');
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: false });
  const rows = parsed.data.filter(row => row && Object.values(row).some(v => (v ?? '').toString().trim() !== ''));
  return { rows, header: parsed.meta.fields };
}

function writeCsv(file, rows) {
  const csv = Papa.unparse(rows, { columns: ['record_id', 'insect_id', 'note_type', 'content', 'reference', 'page', 'year'] });
  fs.writeFileSync(file, csv + '\n', 'utf8');
}

function buildInsectIndex() {
  const text = fs.readFileSync(INSECT_PATH, 'utf8');
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: false });
  const rows = parsed.data;
  const byJapanese = new Map();
  const byScientific = new Map();
  const byGenusSpecies = new Map();
  for (const row of rows) {
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
  if (/。$/.test(trimmed) || /[.!?！？]$/.test(trimmed)) return trimmed;
  return trimmed + '。';
}

function cleanValue(value) {
  return (value || '').trim();
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

function loadBatch2Data() {
  if (!fs.existsSync(DATA_PATH)) {
    console.error(`Data file not found: ${DATA_PATH}`);
    process.exit(1);
  }
  const raw = fs.readFileSync(DATA_PATH, 'utf8').split(/\r?\n/);
  const header = raw.shift();
  const rows = [];
  for (const line of raw) {
    if (!line || !line.trim()) continue;
    const sanitized = line.replace(/\\"/g, '"');
    const lastComma = sanitized.lastIndexOf(',');
    if (lastComma === -1) continue;
    const ecologyRaw = sanitized.slice(lastComma + 1).trim();
    const beforeEco = sanitized.slice(0, lastComma);
    const secondLastComma = beforeEco.lastIndexOf(',');
    if (secondLastComma === -1) continue;
    const adultRaw = beforeEco.slice(secondLastComma + 1).trim();
    const prefix = beforeEco.slice(0, secondLastComma);
    const firstComma = prefix.indexOf(',');
    if (firstComma === -1) continue;
    const japanese = prefix.slice(0, firstComma).trim();
    const scientific = prefix.slice(firstComma + 1).trim();
    const cleanField = (value) => value.replace(/^\"/, '').replace(/\"$/, '').trim();
    rows.push({
      '和名': japanese,
      '学名': scientific,
      '成虫時期': cleanField(adultRaw),
      '生態の備考': cleanField(ecologyRaw),
    });
  }
  return rows;
}

function main() {
  const dataRows = loadBatch2Data();
  const { byJapanese, byScientific, byGenusSpecies } = buildInsectIndex();
  const indexes = { byJapanese, byScientific, byGenusSpecies };

  const publicNotes = loadCsv(TARGETS[0]).rows;
  const existing = new Set(publicNotes.map(r => `${(r.insect_id || '').trim()}|${(r.note_type || '').trim()}|${(r.content || '').trim()}`));

  const timestamp = (() => {
    const d = new Date();
    const pad = n => n.toString().padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}`;
  })();
  let emergenceCounter = 1;
  let ecologyCounter = 1;

  const additions = [];
  const unmatched = [];
  let skippedEmergence = 0;
  let skippedEcology = 0;

  for (const row of dataRows) {
    const insectId = guessInsectId(indexes, row['和名'], row['学名']);
    if (!insectId) {
      unmatched.push({ japanese_name: row['和名'], scientific_name: row['学名'] });
      continue;
    }

    const emergenceRaw = cleanValue(row['成虫時期']);
    if (emergenceRaw && !shouldSkip(emergenceRaw)) {
      const content = normalizeContent(emergenceRaw);
      const key = `${insectId}|出現時期|${content}`;
      if (!existing.has(key)) {
        const recordId = `note-B1B2-E-${timestamp}-${String(emergenceCounter++).padStart(3, '0')}`;
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
      skippedEmergence++;
    }

    const ecologyRaw = cleanValue(row['生態の備考']);
    if (ecologyRaw && !shouldSkip(ecologyRaw)) {
      const content = normalizeContent(ecologyRaw);
      const key = `${insectId}|生態情報|${content}`;
      if (!existing.has(key)) {
        const recordId = `note-B1B2-Eco-${timestamp}-${String(ecologyCounter++).padStart(3, '0')}`;
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
      skippedEcology++;
    }
  }

  for (const file of TARGETS) {
    const { rows } = loadCsv(file);
    const merged = sortNotes(rows.concat(additions));
    writeCsv(file, merged);
  }

  const reportPath = path.join('reports', 'book1_batch2_notes_report.json');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  const report = {
    source: DATA_PATH,
    added_records: additions.length,
    added_emergence: emergenceCounter - 1,
    added_ecology: ecologyCounter - 1,
    skipped_emergence_due_to_placeholder: skippedEmergence,
    skipped_ecology_due_to_placeholder: skippedEcology,
    unmatched_entries: unmatched,
  };
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`Added ${additions.length} notes from ${DATA_PATH}.`);
  if (unmatched.length) {
    console.warn(`Unmatched entries: ${unmatched.length}. See ${reportPath}`);
  }
}

main();

#!/usr/bin/env node
/**
 * Append missing 生態情報 notes from data/moth_ecology_book1.csv into
 * public/general_notes.csv and normalized_data/general_notes.csv.
 *
 * Rules:
 *  - Only add when 生態の備考 is non-empty and not "未詳"/"不明".
 *  - Skip species that already have 生態情報 with reference 日本産蛾類標準図鑑1.
 *  - Match species primarily by japanese_name, falling back to scientific_name or genus+species.
 */
import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

const DATA_PATH = path.join('data', 'moth_ecology_book1.csv');
const INSECT_PATH = path.join('public', 'insects.csv');
const TARGET_FILES = [
  path.join('public', 'general_notes.csv'),
  path.join('normalized_data', 'general_notes.csv'),
];
const REFERENCE = '日本産蛾類標準図鑑1';
const NOTE_TYPE = '生態情報';
const NOTE_PREFIX = 'note-ECOJP1';

function readCsv(file) {
  const text = fs.readFileSync(file, 'utf8');
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: false });
  return parsed.data
    .map(row => row || {})
    .filter(row => Object.values(row).some(v => (v ?? '').toString().trim() !== ''));
}

function writeCsv(file, rows) {
  const csv = Papa.unparse(rows, {
    columns: ['record_id', 'insect_id', 'note_type', 'content', 'reference', 'page', 'year'],
  });
  fs.writeFileSync(file, csv + '\n', 'utf8');
}

const insectRows = readCsv(INSECT_PATH);
const indexByJapanese = new Map();
const indexByScientific = new Map();
const indexByGenusSpecies = new Map();

for (const row of insectRows) {
  const insectId = (row.insect_id || '').trim();
  if (!insectId) continue;
  const jp = (row.japanese_name || '').trim();
  if (jp && !indexByJapanese.has(jp)) indexByJapanese.set(jp, insectId);
  const sci = (row.scientific_name || '').trim().replace(/\s+/g, ' ');
  if (sci && !indexByScientific.has(sci)) indexByScientific.set(sci, insectId);
  const genus = (row.genus || '').trim();
  const species = (row.species || '').trim();
  if (genus && species) {
    const key = `${genus} ${species}`.toLowerCase();
    if (!indexByGenusSpecies.has(key)) indexByGenusSpecies.set(key, insectId);
  }
}

function guessInsectId(jpName, sciName) {
  const jp = (jpName || '').trim();
  if (jp && indexByJapanese.has(jp)) return indexByJapanese.get(jp);
  const sci = (sciName || '').trim().replace(/\s+/g, ' ');
  if (sci && indexByScientific.has(sci)) return indexByScientific.get(sci);
  const match = sci.match(/^([A-Za-z.-]+)\s+([a-z0-9.-]+)/);
  if (match) {
    const key = `${match[1]} ${match[2]}`.toLowerCase();
    if (indexByGenusSpecies.has(key)) return indexByGenusSpecies.get(key);
  }
  return null;
}

const notesPublic = readCsv(TARGET_FILES[0]);
const hasBook1Ecology = new Set(
  notesPublic
    .filter(row => (row.note_type || '').trim() === NOTE_TYPE && (row.reference || '').trim() === REFERENCE)
    .map(row => (row.insect_id || '').trim())
);

const additions = [];
const unmatched = [];
const dataRowsRaw = readCsv(DATA_PATH);
const timestamp = (() => {
  const d = new Date();
  const pad = n => n.toString().padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}`;
})();
let counter = 1;

for (const row of dataRowsRaw) {
  const extra = Array.isArray(row.__parsed_extra) ? row.__parsed_extra : [];
  const rawNote = extra.length ? extra.join(',').trim() : (row['生態の備考'] || '').trim();
  if (!rawNote || rawNote === '未詳' || rawNote === '不明') continue;

  const sciPart1 = (row['学名'] || '').trim();
  const sciPart2 = (row['成虫時期'] || '').trim();
  const sciCombined =
    sciPart1 && sciPart2 && /^\d{3,4}\)?$/.test(sciPart2.replace(/\s+/g, ''))
      ? `${sciPart1},${sciPart2}`
      : sciPart1;

  const insectId = guessInsectId(row['和名'], sciCombined);
  if (!insectId) {
    unmatched.push({
      japanese_name: row['和名'],
      scientific_name: sciCombined || row['学名'],
      note: rawNote,
    });
    continue;
  }
  if (hasBook1Ecology.has(insectId)) continue;

  const content = /[。．.！!？?]$/.test(rawNote) ? rawNote : `${rawNote}。`;
  const recordId = `${NOTE_PREFIX}-${timestamp}-${String(counter).padStart(3, '0')}`;
  counter += 1;
  hasBook1Ecology.add(insectId);
  additions.push({
    record_id: recordId,
    insect_id: insectId,
    note_type: NOTE_TYPE,
    content: content,
    reference: REFERENCE,
    page: '',
    year: '',
  });
}

for (const file of TARGET_FILES) {
  const rows = readCsv(file);
  const newRows = rows.concat(additions);
  writeCsv(file, newRows);
}

const reportPath = path.join('reports', 'book1_ecology_additions.json');
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(
  reportPath,
  JSON.stringify(
    {
      source: DATA_PATH,
      added_notes: additions.length,
      unmatched_entries: unmatched,
    },
    null,
    2
  )
);

console.log(`Added ${additions.length} ecology notes from ${DATA_PATH}.`);
if (unmatched.length) {
  console.warn(`Unmatched entries: ${unmatched.length} (see ${reportPath})`);
}

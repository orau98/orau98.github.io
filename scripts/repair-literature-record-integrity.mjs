import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Papa from 'papaparse';

import { splitCsvRecordsWithDelimiters } from './lib/csvRecords.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

const resolvePath = (envName, fallback) => process.env[envName]
  ? path.resolve(process.env[envName])
  : path.join(ROOT, fallback);

const INSECTS_PATH = resolvePath('LITERATURE_RECORD_INSECTS_PATH', 'normalized_data/insects.csv');
const HOSTPLANTS_PATH = resolvePath('LITERATURE_RECORD_HOSTPLANTS_PATH', 'normalized_data/hostplants.csv');
const NOTES_PATH = resolvePath('LITERATURE_RECORD_NOTES_PATH', 'normalized_data/general_notes.csv');

const parseRowsFromText = (source, label) => {
  const parsed = Papa.parse(
    source.replace(/\r\n/g, '\n').replace(/\r/g, '\n'),
    { header: true, skipEmptyLines: true },
  );
  if (parsed.errors.length > 0) throw new Error(`${label}: ${parsed.errors[0].message}`);
  return parsed.data;
};

const parseRows = (filePath) => parseRowsFromText(
  fs.readFileSync(filePath, 'utf-8'),
  path.basename(filePath),
);

const transformRecords = (filePath, mutate) => {
  const source = fs.readFileSync(filePath, 'utf-8');
  const hasBom = source.charCodeAt(0) === 0xfeff;
  const body = hasBom ? source.slice(1) : source;
  const entries = splitCsvRecordsWithDelimiters(body);
  if (entries.length === 0) throw new Error(`${path.basename(filePath)} is empty`);
  const header = Papa.parse(entries[0].record).data[0];
  const indexes = Object.fromEntries(header.map((name, index) => [name, index]));
  const output = [entries[0]];
  let changed = 0;

  for (const entry of entries.slice(1)) {
    if (!entry.record) continue;
    const parsed = Papa.parse(entry.record);
    if (parsed.errors.length > 0) throw new Error(`${path.basename(filePath)}: ${parsed.errors[0].message}`);
    const row = parsed.data[0];
    if (mutate(row, indexes)) {
      output.push({ record: Papa.unparse([row], { newline: '' }), delimiter: entry.delimiter });
      changed += 1;
    } else {
      output.push(entry);
    }
  }

  const result = `${hasBom ? '\ufeff' : ''}${output.map(({ record, delimiter }) => `${record}${delimiter}`).join('')}`;
  return { source, text: result, changed };
};

const writeAtomically = (outputs) => {
  const temporary = [];
  try {
    for (const { filePath, text } of outputs) {
      const temporaryPath = `${filePath}.literature-integrity-${process.pid}.tmp`;
      fs.writeFileSync(temporaryPath, text, 'utf-8');
      temporary.push({ temporaryPath, filePath });
    }
    for (const { temporaryPath, filePath } of temporary) fs.renameSync(temporaryPath, filePath);
  } finally {
    for (const { temporaryPath } of temporary) fs.rmSync(temporaryPath, { force: true });
  }
};

const hostRows = parseRows(HOSTPLANTS_PATH);
const noteRows = parseRows(NOTES_PATH);
const linkedInsectIds = new Set([
  ...hostRows.map((row) => (row.insect_id || '').trim()),
  ...noteRows.map((row) => (row.insect_id || '').trim()),
].filter(Boolean));

const SOURCE_KEYS = new Map([
  ['日本産タマムシ大図鑑', 'tamamushi'],
  ['日本のハマキガ2', 'hamakiga2'],
]);
const TYPE_KEYS = new Map([
  ['出現時期', 'emergence'],
  ['生態情報', 'ecology'],
  ['生態', 'ecology'],
]);

const targetRows = noteRows.filter((row) => SOURCE_KEYS.has((row.reference || '').trim()));
const assignedIds = new Map();
const desiredIdBySignature = new Map();
for (const row of targetRows) {
  const sourceKey = SOURCE_KEYS.get(row.reference.trim());
  const insectKey = (row.insect_id || '').trim().replace(/^species-/, '');
  const typeKey = TYPE_KEYS.get((row.note_type || '').trim()) || 'note';
  const signature = [row.reference, row.insect_id, row.note_type, row.content, row.page, row.year].join('\u0000');
  const digest = crypto.createHash('sha1').update(signature).digest('hex').slice(0, 12);
  const baseId = `note-${sourceKey}-${insectKey}-${typeKey}-${digest}`;
  const count = (assignedIds.get(baseId) || 0) + 1;
  assignedIds.set(baseId, count);
  desiredIdBySignature.set(`${signature}\u0000${count}`, count === 1 ? baseId : `${baseId}-${String(count).padStart(2, '0')}`);
}

const signatureCounts = new Map();
const notesResult = transformRecords(NOTES_PATH, (row, indexes) => {
  const reference = (row[indexes.reference] || '').trim();
  if (!SOURCE_KEYS.has(reference)) return false;
  const signature = [
    row[indexes.reference], row[indexes.insect_id], row[indexes.note_type], row[indexes.content],
    row[indexes.page], row[indexes.year],
  ].join('\u0000');
  const count = (signatureCounts.get(signature) || 0) + 1;
  signatureCounts.set(signature, count);
  const desired = desiredIdBySignature.get(`${signature}\u0000${count}`);
  if (!desired) throw new Error(`Could not derive source-scoped note ID for ${row[indexes.record_id]}`);
  if (row[indexes.record_id] === desired) return false;
  row[indexes.record_id] = desired;
  return true;
});

// Validate the complete prospective notes file before writing either target. This
// catches collisions with non-target records without leaving a partially repaired file.
const repairedNotes = parseRowsFromText(notesResult.text, path.basename(NOTES_PATH));
const noteIdCounts = new Map();
for (const row of repairedNotes) {
  const id = (row.record_id || '').trim();
  noteIdCounts.set(id, (noteIdCounts.get(id) || 0) + 1);
}
const duplicateNoteIds = [...noteIdCounts].filter(([, count]) => count > 1);
if (duplicateNoteIds.length > 0) {
  throw new Error(`general_notes.csv still has duplicate record_id values: ${duplicateNoteIds.slice(0, 10).map(([id]) => id).join(', ')}`);
}

const PLACEHOLDER = '食草・生態情報は未入力。';
const insectsResult = transformRecords(INSECTS_PATH, (row, indexes) => {
  const insectId = (row[indexes.insect_id] || '').trim();
  const notes = row[indexes.notes] || '';
  if (!linkedInsectIds.has(insectId) || !notes.includes(PLACEHOLDER)) return false;
  row[indexes.notes] = notes
    .replaceAll(PLACEHOLDER, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/。\s*。/g, '。')
    .trim();
  return true;
});

// Stage both outputs only after every parse, mutation, and cross-record validation
// has succeeded. A late validation error therefore leaves both source files intact.
writeAtomically([
  { filePath: NOTES_PATH, source: notesResult.source, text: notesResult.text },
  { filePath: INSECTS_PATH, source: insectsResult.source, text: insectsResult.text },
].filter(({ source, text }) => text !== source));

console.log(`[literature-record-integrity] note_ids=${notesResult.changed} placeholders=${insectsResult.changed}`);

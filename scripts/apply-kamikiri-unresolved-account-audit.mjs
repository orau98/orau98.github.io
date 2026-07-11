#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Papa from 'papaparse';

import { splitCsvRecordsWithDelimiters } from './lib/csvRecords.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_ROOT = process.env.KAMIKIRI_UNRESOLVED_DATA_ROOT
  ? path.resolve(process.env.KAMIKIRI_UNRESOLVED_DATA_ROOT)
  : ROOT;
const AUDIT_PATH = process.env.KAMIKIRI_UNRESOLVED_AUDIT_PATH
  ? path.resolve(process.env.KAMIKIRI_UNRESOLVED_AUDIT_PATH)
  : path.join(
      ROOT,
      'data',
      'source_audits',
      'japanese-longhorn-beetles-2007-unresolved-account-actions-2026-07-11.csv',
    );
const SOURCE_PDF = process.env.KAMIKIRI_UNRESOLVED_SOURCE_PDF
  ? path.resolve(process.env.KAMIKIRI_UNRESOLVED_SOURCE_PDF)
  : '';
const CHECK_ONLY = process.argv.includes('--check');
const COLLECTIONS = ['normalized_data', 'public'];
const REFERENCE = '日本産カミキリムシ';
const PDF_FILE = '日本産カミキリムシ_compressed.pdf';
const PDF_SHA256 = '52299895c14c1fd1c74279dca00f6fd9ba64d36d69e3bf3dd9c3a29a92802e77';
const REVIEWED_ON = '2026-07-11';
const EXPECTED_ACTIONS = 79;
const EXPECTED_HOST_ACTIONS = 42;
const EXPECTED_NOTE_ACTIONS = 37;
const HOST_COLUMNS = [
  'record_id', 'insect_id', 'plant_name', 'plant_family', 'observation_type',
  'plant_part', 'life_stage', 'reference', 'notes',
];
const NOTE_COLUMNS = [
  'record_id', 'insect_id', 'note_type', 'content', 'reference', 'page', 'year',
];
const AUDIT_COLUMNS = [
  'action_id', 'action', 'insect_id', 'current_japanese_name', 'record_id',
  'plant_name', 'plant_family', 'observation_type', 'plant_part', 'life_stage',
  'note_type', 'content', 'canonical_reference', 'pdf_file', 'source_pdf_sha256',
  'pdf_page', 'printed_page', 'source_heading', 'source_taxon',
  'scope_classification', 'reviewed_on', 'evidence_note',
];
const clean = (value) => (value ?? '').toString().trim();

function parseCsv(filePath) {
  const parsed = Papa.parse(fs.readFileSync(filePath, 'utf8').replace(/^\ufeff/, ''), {
    header: true,
    skipEmptyLines: true,
  });
  if (parsed.errors.length > 0) throw new Error(`${filePath}: ${parsed.errors[0].message}`);
  if (parsed.data.some((row) => Object.hasOwn(row, '__parsed_extra'))) {
    throw new Error(`${filePath}: CSV contains an over-wide row`);
  }
  return parsed;
}

function readAudit() {
  const parsed = parseCsv(AUDIT_PATH);
  const fields = new Set(parsed.meta.fields || []);
  for (const column of AUDIT_COLUMNS) {
    if (!fields.has(column)) throw new Error(`Audit is missing ${column}`);
  }
  const actionIds = new Set();
  const recordIds = new Set();
  const hostPairs = new Set();
  const noteKeys = new Set();
  const actions = parsed.data.map((raw) => {
    const row = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, clean(value)]));
    if (actionIds.has(row.action_id)) throw new Error(`Duplicate action_id: ${row.action_id}`);
    if (recordIds.has(row.record_id)) throw new Error(`Duplicate action record_id: ${row.record_id}`);
    actionIds.add(row.action_id);
    recordIds.add(row.record_id);
    if (!/^KUA-\d{3}$/.test(row.action_id)) throw new Error(`${row.action_id}: invalid action_id`);
    if (!/^(?:host|note)-kamikiri-unresolved-\d{3}$/.test(row.record_id)) {
      throw new Error(`${row.action_id}: invalid record_id`);
    }
    if (!['add_host', 'add_note'].includes(row.action)) {
      throw new Error(`${row.action_id}: unsupported action ${row.action}`);
    }
    if (!row.insect_id || !row.current_japanese_name || !row.source_heading || !row.source_taxon) {
      throw new Error(`${row.action_id}: taxon evidence is incomplete`);
    }
    if (
      row.canonical_reference !== REFERENCE || row.pdf_file !== PDF_FILE ||
      row.source_pdf_sha256 !== PDF_SHA256 || row.reviewed_on !== REVIEWED_ON ||
      !row.pdf_page || !row.printed_page || !row.scope_classification || !row.evidence_note
    ) {
      throw new Error(`${row.action_id}: provenance guard failed`);
    }
    if (row.action === 'add_host') {
      if (!row.plant_name || !row.observation_type || !row.life_stage) {
        throw new Error(`${row.action_id}: host action is incomplete`);
      }
      if (row.note_type || row.content || !row.record_id.startsWith('host-')) {
        throw new Error(`${row.action_id}: host action contains note fields`);
      }
      const key = `${row.insect_id}\u0000${row.plant_name}`;
      if (hostPairs.has(key)) throw new Error(`${row.action_id}: duplicate approved host pair`);
      hostPairs.add(key);
    } else {
      if (!row.note_type || !row.content || !row.record_id.startsWith('note-')) {
        throw new Error(`${row.action_id}: note action is incomplete`);
      }
      if (row.plant_name || row.plant_family || row.observation_type || row.plant_part || row.life_stage) {
        throw new Error(`${row.action_id}: note action contains host fields`);
      }
      const key = `${row.insect_id}\u0000${row.note_type}\u0000${row.content}`;
      if (noteKeys.has(key)) throw new Error(`${row.action_id}: duplicate approved note`);
      noteKeys.add(key);
    }
    return row;
  });
  const hostCount = actions.filter((row) => row.action === 'add_host').length;
  const noteCount = actions.filter((row) => row.action === 'add_note').length;
  if (
    actions.length !== EXPECTED_ACTIONS || hostCount !== EXPECTED_HOST_ACTIONS ||
    noteCount !== EXPECTED_NOTE_ACTIONS
  ) {
    throw new Error(`Audit count guard failed: ${actions.length}/${hostCount}/${noteCount}`);
  }
  return actions;
}

function verifySourcePdf() {
  if (!SOURCE_PDF) return;
  if (!fs.existsSync(SOURCE_PDF)) throw new Error(`Source PDF is missing: ${SOURCE_PDF}`);
  const hash = crypto.createHash('sha256').update(fs.readFileSync(SOURCE_PDF)).digest('hex');
  if (hash !== PDF_SHA256) throw new Error(`Source PDF hash mismatch: ${hash}`);
}

function validateTaxa(collection, actions) {
  const insectsPath = path.join(DATA_ROOT, collection, 'insects.csv');
  const parsed = parseCsv(insectsPath);
  const byId = new Map(parsed.data.map((row) => [clean(row.insect_id), row]));
  for (const action of actions) {
    const insect = byId.get(action.insect_id);
    if (!insect) throw new Error(`${collection}: missing ${action.insect_id}`);
    if (clean(insect.japanese_name) !== action.current_japanese_name) {
      throw new Error(`${collection}: Japanese name drift for ${action.insect_id}`);
    }
  }
}

function parseRecord(record, filePath) {
  const parsed = Papa.parse(record);
  if (parsed.errors.length > 0) throw new Error(`${filePath}: ${parsed.errors[0].message}`);
  return parsed.data[0];
}

function expectedValues(action, kind) {
  if (kind === 'host') {
    return {
      record_id: action.record_id,
      insect_id: action.insect_id,
      plant_name: action.plant_name,
      plant_family: action.plant_family,
      observation_type: action.observation_type,
      plant_part: action.plant_part,
      life_stage: action.life_stage,
      reference: REFERENCE,
      notes: '',
    };
  }
  return {
    record_id: action.record_id,
    insect_id: action.insect_id,
    note_type: action.note_type,
    content: action.content,
    reference: REFERENCE,
    page: action.printed_page,
    year: '2007',
  };
}

function transform(collection, kind, actions) {
  const fileName = kind === 'host' ? 'hostplants.csv' : 'general_notes.csv';
  const columns = kind === 'host' ? HOST_COLUMNS : NOTE_COLUMNS;
  const filePath = path.join(DATA_ROOT, collection, fileName);
  const source = fs.readFileSync(filePath, 'utf8');
  const hasBom = source.charCodeAt(0) === 0xfeff;
  const body = hasBom ? source.slice(1) : source;
  const entries = splitCsvRecordsWithDelimiters(body);
  if (entries.length === 0) throw new Error(`${filePath}: empty CSV`);
  const header = parseRecord(entries[0].record, filePath);
  const indexes = Object.fromEntries(header.map((name, index) => [name, index]));
  for (const column of columns) {
    if (indexes[column] === undefined) throw new Error(`${filePath}: missing ${column}`);
  }
  const defaultDelimiter = entries.find((entry) => entry.delimiter)?.delimiter || '\r\n';
  const approved = actions.filter((row) => row.action === (kind === 'host' ? 'add_host' : 'add_note'));
  const byRecordId = new Map(approved.map((row) => [row.record_id, row]));
  const seenRecordIds = new Set();
  const semanticKeys = new Map();
  const output = [];
  for (const entry of entries) {
    if (!entry.record) continue;
    const values = parseRecord(entry.record, filePath);
    if (values.length < header.length) throw new Error(`${filePath}: row is narrower than the header`);
    const recordId = clean(values[indexes.record_id]);
    if (recordId && semanticKeys.has(`id\u0000${recordId}`)) {
      throw new Error(`${filePath}: duplicate record_id ${recordId}`);
    }
    if (recordId) semanticKeys.set(`id\u0000${recordId}`, recordId);
    if (kind === 'host') {
      const pair = `${clean(values[indexes.insect_id])}\u0000${clean(values[indexes.plant_name])}`;
      if (!semanticKeys.has(`host\u0000${pair}`)) semanticKeys.set(`host\u0000${pair}`, recordId);
    } else {
      const note = `${clean(values[indexes.insect_id])}\u0000${clean(values[indexes.note_type])}\u0000${clean(values[indexes.content])}`;
      if (!semanticKeys.has(`note\u0000${note}`)) semanticKeys.set(`note\u0000${note}`, recordId);
    }
    const action = byRecordId.get(recordId);
    if (action) {
      const expected = expectedValues(action, kind);
      for (const column of columns) {
        if (clean(values[indexes[column]]) !== clean(expected[column])) {
          throw new Error(`${action.action_id}: existing ${recordId} drifted at ${column}`);
        }
      }
      seenRecordIds.add(recordId);
    }
    output.push({ record: entry.record, delimiter: entry.delimiter });
  }
  const missing = approved.filter((row) => !seenRecordIds.has(row.record_id));
  if (missing.length > 0 && output.length > 1 && !output.at(-1).delimiter) {
    output.at(-1).delimiter = defaultDelimiter;
  }
  for (const action of missing) {
    const expected = expectedValues(action, kind);
    const semantic = kind === 'host'
      ? `host\u0000${action.insect_id}\u0000${action.plant_name}`
      : `note\u0000${action.insect_id}\u0000${action.note_type}\u0000${action.content}`;
    if (semanticKeys.has(semantic)) {
      throw new Error(`${action.action_id}: approved value exists under another record_id`);
    }
    const values = header.map((column) => expected[column] ?? '');
    output.push({ record: Papa.unparse([values], { newline: '' }), delimiter: defaultDelimiter });
    semanticKeys.set(semantic, action.record_id);
  }
  const result = `${hasBom ? '\ufeff' : ''}${output.map(({ record, delimiter }) => `${record}${delimiter}`).join('')}`;
  const verified = Papa.parse(result.replace(/^\ufeff/, ''), { header: true, skipEmptyLines: true });
  if (verified.errors.length > 0) throw new Error(`${filePath}: invalid output: ${verified.errors[0].message}`);
  for (const action of approved) {
    const matching = verified.data.filter((row) => clean(row.record_id) === action.record_id);
    const count = matching.length;
    if (count !== 1) throw new Error(`${filePath}: expected ${action.record_id} exactly once`);
    if (Object.hasOwn(matching[0], '__parsed_extra')) {
      throw new Error(`${filePath}: approved row ${action.record_id} is over-wide`);
    }
    const semanticMatches = kind === 'host'
      ? verified.data.filter(
          (row) => clean(row.insect_id) === action.insect_id && clean(row.plant_name) === action.plant_name,
        )
      : verified.data.filter(
          (row) =>
            clean(row.insect_id) === action.insect_id &&
            clean(row.note_type) === action.note_type &&
            clean(row.content) === action.content,
        );
    if (semanticMatches.length !== 1 || clean(semanticMatches[0].record_id) !== action.record_id) {
      throw new Error(`${filePath}: approved semantic value is not unique for ${action.action_id}`);
    }
  }
  return { filePath, source, result, changed: missing.length };
}

function writeAtomically(outputs) {
  const temporary = [];
  try {
    for (const output of outputs) {
      const temporaryPath = `${output.filePath}.tmp-kua-${process.pid}`;
      fs.writeFileSync(temporaryPath, output.result, 'utf8');
      temporary.push(temporaryPath);
    }
    outputs.forEach((output, index) => fs.renameSync(temporary[index], output.filePath));
    temporary.length = 0;
  } finally {
    for (const filePath of temporary) fs.rmSync(filePath, { force: true });
  }
}

const actions = readAudit();
verifySourcePdf();
for (const collection of COLLECTIONS) validateTaxa(collection, actions);
const outputs = COLLECTIONS.flatMap((collection) => [
  transform(collection, 'host', actions),
  transform(collection, 'note', actions),
]);
if (CHECK_ONLY) {
  const pending = outputs.filter((output) => output.source !== output.result).length;
  if (pending > 0) throw new Error(`Kamikiri unresolved audit has ${pending} pending files`);
} else {
  writeAtomically(outputs);
}
for (const output of outputs) {
  console.log(`[kamikiri-unresolved-audit] ${path.relative(ROOT, output.filePath)} changed=${output.changed}`);
}

#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Papa from 'papaparse';

import { splitCsvRecordsWithDelimiters } from './lib/csvRecords.mjs';
import { collectGeneralNoteIssues } from './lib/generalNoteQuality.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_ROOT = process.env.TAMAMUSHI_SHARING_DATA_ROOT
  ? path.resolve(process.env.TAMAMUSHI_SHARING_DATA_ROOT)
  : ROOT;
const AUDIT_PATH = process.env.TAMAMUSHI_SHARING_AUDIT_PATH
  ? path.resolve(process.env.TAMAMUSHI_SHARING_AUDIT_PATH)
  : path.join(
      ROOT,
      'data',
      'source_audits',
      'japanese-jewel-beetles-species-level-sharing-2026-07-12.csv',
    );
const PRODUCTION_AUDIT_PATH = path.join(
  ROOT,
  'data',
  'source_audits',
  'japanese-jewel-beetles-species-level-sharing-2026-07-12.csv',
);
const SOURCE_PDF = process.env.TAMAMUSHI_SHARING_SOURCE_PDF
  ? path.resolve(process.env.TAMAMUSHI_SHARING_SOURCE_PDF)
  : '';
const CHECK_ONLY = process.argv.includes('--check');
const unknownArguments = process.argv.slice(2).filter((argument) => argument !== '--check');
if (unknownArguments.length > 0) throw new Error(`Unknown arguments: ${unknownArguments.join(', ')}`);

const REFERENCE = '日本産タマムシ大図鑑';
const PDF_FILE = '日本産タマムシ大図鑑.pdf';
const PDF_SHA256 = 'ea5ecd8600fbe103e344097b19010d020c69dcedbf7d1328e4a0bb3c06cd9a45';
const LEDGER_SHA256 = '02ce11d386bffdbaf22702b8c3496256cdedb436639dd07b5e9715ee43a1d82f';
const REVIEWED_ON = '2026-07-12';
const EXPECTED_ACTIONS = 8;
const EXPECTED_HOST_ACTIONS = 4;
const EXPECTED_NOTE_ACTIONS = 4;

const HOST_COLUMNS = [
  'record_id', 'insect_id', 'plant_name', 'plant_family', 'observation_type',
  'plant_part', 'life_stage', 'reference', 'notes',
];
const NOTE_COLUMNS = [
  'record_id', 'insect_id', 'note_type', 'content', 'reference', 'page', 'year',
];
const AUDIT_COLUMNS = [
  'action_id', 'entity', 'action', 'target_insect_id', 'target_scientific_name',
  'source_insect_id', 'source_scope', 'record_id', 'plant_name', 'plant_family',
  'observation_type', 'plant_part', 'life_stage', 'note_type', 'content',
  'canonical_reference', 'pdf_file', 'source_pdf_sha256', 'pdf_page',
  'printed_page', 'reviewed_on', 'evidence_note',
];

const clean = (value) => (value ?? '').toString().trim();
const sha256 = (filePath) => crypto.createHash('sha256')
  .update(fs.readFileSync(filePath))
  .digest('hex');

function parseCsv(filePath) {
  const parsed = Papa.parse(fs.readFileSync(filePath, 'utf8').replace(/^\ufeff/, ''), {
    header: true,
    skipEmptyLines: true,
  });
  if (parsed.errors.length > 0) {
    throw new Error(`${path.relative(ROOT, filePath)}: ${parsed.errors[0].message}`);
  }
  if (parsed.data.some((row) => Object.hasOwn(row, '__parsed_extra'))) {
    throw new Error(`${path.relative(ROOT, filePath)}: over-wide CSV row`);
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
  const actions = parsed.data.map((raw) => {
    const row = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, clean(value)]));
    if (!/^BUP-SHARE-\d{3}$/.test(row.action_id) || actionIds.has(row.action_id)) {
      throw new Error(`Invalid or duplicate action_id: ${row.action_id}`);
    }
    if (!row.record_id || recordIds.has(row.record_id)) {
      throw new Error(`Invalid or duplicate record_id: ${row.record_id}`);
    }
    actionIds.add(row.action_id);
    recordIds.add(row.record_id);
    if (row.action !== (row.entity === 'hostplant' ? 'add_host' : 'add_note')) {
      throw new Error(`${row.action_id}: invalid entity/action combination`);
    }
    if (!['hostplant', 'general_note'].includes(row.entity)) {
      throw new Error(`${row.action_id}: unsupported entity ${row.entity}`);
    }
    if (
      !row.target_insect_id || !row.target_scientific_name || !row.source_insect_id
      || row.source_scope !== 'species-level shared'
      || row.canonical_reference !== REFERENCE || row.pdf_file !== PDF_FILE
      || row.source_pdf_sha256 !== PDF_SHA256 || row.reviewed_on !== REVIEWED_ON
      || !row.pdf_page || !row.printed_page || !row.evidence_note
    ) {
      throw new Error(`${row.action_id}: incomplete source-scope provenance`);
    }
    if (row.entity === 'hostplant') {
      if (!row.plant_name || row.note_type || row.content || !row.life_stage) {
        throw new Error(`${row.action_id}: invalid host action`);
      }
    } else if (!row.note_type || !row.content || row.plant_name || row.life_stage) {
      throw new Error(`${row.action_id}: invalid note action`);
    }
    return row;
  });
  const hostCount = actions.filter((row) => row.entity === 'hostplant').length;
  const noteCount = actions.filter((row) => row.entity === 'general_note').length;
  if (
    actions.length !== EXPECTED_ACTIONS
    || hostCount !== EXPECTED_HOST_ACTIONS
    || noteCount !== EXPECTED_NOTE_ACTIONS
  ) {
    throw new Error(`Audit count guard failed: ${actions.length}/${hostCount}/${noteCount}`);
  }
  const enforceProduction = path.resolve(AUDIT_PATH) === path.resolve(PRODUCTION_AUDIT_PATH)
    || process.env.TAMAMUSHI_SHARING_ENFORCE_PRODUCTION === '1';
  if (enforceProduction && sha256(AUDIT_PATH) !== LEDGER_SHA256) {
    throw new Error(`Production audit SHA-256 mismatch: ${sha256(AUDIT_PATH)}`);
  }
  return actions;
}

function verifySourcePdf() {
  if (!SOURCE_PDF) return;
  if (!fs.existsSync(SOURCE_PDF)) throw new Error(`Source PDF is missing: ${SOURCE_PDF}`);
  const actual = sha256(SOURCE_PDF);
  if (actual !== PDF_SHA256) throw new Error(`Source PDF SHA-256 mismatch: ${actual}`);
}

function validateTaxa(actions) {
  const insects = parseCsv(path.join(DATA_ROOT, 'normalized_data', 'insects.csv')).data;
  const byId = new Map(insects.map((row) => [clean(row.insect_id), row]));
  for (const action of actions) {
    const target = byId.get(action.target_insect_id);
    const source = byId.get(action.source_insect_id);
    if (!target || !source) throw new Error(`${action.action_id}: target or source taxon is missing`);
    if (clean(target.scientific_name) !== action.target_scientific_name) {
      throw new Error(`${action.action_id}: target scientific name drift`);
    }
    const sameSpecies = clean(target.genus) === clean(source.genus)
      && clean(target.species) === clean(source.species);
    if (!sameSpecies || !clean(target.subspecies)) {
      throw new Error(`${action.action_id}: target is not a subspecies of the source species`);
    }
  }
}

function desiredValues(action, kind) {
  if (kind === 'host') {
    return {
      record_id: action.record_id,
      insect_id: action.target_insect_id,
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
    insect_id: action.target_insect_id,
    note_type: action.note_type,
    content: action.content,
    reference: REFERENCE,
    page: action.printed_page,
    year: '',
  };
}

function parseRecord(record, filePath) {
  const parsed = Papa.parse(record);
  if (parsed.errors.length > 0 || parsed.data.length !== 1) {
    throw new Error(`${filePath}: malformed CSV record`);
  }
  return parsed.data[0];
}

function transform(kind, actions) {
  const fileName = kind === 'host' ? 'hostplants.csv' : 'general_notes.csv';
  const columns = kind === 'host' ? HOST_COLUMNS : NOTE_COLUMNS;
  const approved = actions.filter((row) => row.entity === (kind === 'host' ? 'hostplant' : 'general_note'));
  const filePath = path.join(DATA_ROOT, 'normalized_data', fileName);
  const source = fs.readFileSync(filePath, 'utf8');
  const hasBom = source.charCodeAt(0) === 0xfeff;
  const records = splitCsvRecordsWithDelimiters(hasBom ? source.slice(1) : source);
  if (records.length === 0) throw new Error(`${filePath}: empty CSV`);
  const header = parseRecord(records[0].record, filePath);
  const indexes = Object.fromEntries(header.map((name, index) => [name, index]));
  for (const column of columns) {
    if (indexes[column] === undefined) throw new Error(`${filePath}: missing ${column}`);
  }
  const defaultDelimiter = records.find((record) => record.delimiter)?.delimiter || '\r\n';
  const output = [...records];
  const byRecordId = new Map();
  const semanticKeys = new Map();
  const sourceRows = [];
  for (const record of records.slice(1)) {
    if (!record.record) continue;
    const values = parseRecord(record.record, filePath);
    const recordId = clean(values[indexes.record_id]);
    if (!recordId || byRecordId.has(recordId)) throw new Error(`${filePath}: duplicate record_id ${recordId}`);
    byRecordId.set(recordId, values);
    const semantic = kind === 'host'
      ? `${clean(values[indexes.insect_id])}\u0000${clean(values[indexes.plant_name])}`
      : `${clean(values[indexes.insect_id])}\u0000${clean(values[indexes.note_type])}\u0000${clean(values[indexes.content])}`;
    const semanticRecordIds = semanticKeys.get(semantic) || [];
    semanticRecordIds.push(recordId);
    semanticKeys.set(semantic, semanticRecordIds);
    sourceRows.push(values);
  }

  let changed = 0;
  for (const action of approved) {
    const desired = desiredValues(action, kind);
    const sourceMatches = sourceRows.filter((values) => (
      clean(values[indexes.insect_id]) === action.source_insect_id
      && clean(values[indexes.reference]) === REFERENCE
      && (kind === 'host'
        ? clean(values[indexes.plant_name]) === action.plant_name
        : clean(values[indexes.note_type]) === action.note_type
          && clean(values[indexes.content]) === action.content)
    ));
    if (sourceMatches.length !== 1) {
      throw new Error(`${action.action_id}: expected exactly one source-species row; found ${sourceMatches.length}`);
    }
    for (const column of columns.filter((column) => !['record_id', 'insect_id', 'page'].includes(column))) {
      if (clean(sourceMatches[0][indexes[column]]) !== clean(desired[column])) {
        throw new Error(`${action.action_id}: approved ${column} differs from source-species row`);
      }
    }
    if (kind === 'note') {
      const issues = collectGeneralNoteIssues({
        note_type: action.note_type,
        content: action.content,
        page: action.printed_page,
      });
      if (issues.length > 0) {
        throw new Error(`${action.action_id}: approved note fails quality rules: ${issues.join(',')}`);
      }
    }
    const existing = byRecordId.get(action.record_id);
    if (existing) {
      for (const column of columns) {
        if (clean(existing[indexes[column]]) !== clean(desired[column])) {
          throw new Error(`${action.action_id}: existing approved record drifted at ${column}`);
        }
      }
      continue;
    }
    const semantic = kind === 'host'
      ? `${action.target_insect_id}\u0000${action.plant_name}`
      : `${action.target_insect_id}\u0000${action.note_type}\u0000${action.content}`;
    if ((semanticKeys.get(semantic) || []).length > 0) {
      throw new Error(
        `${action.action_id}: approved value exists under ${(semanticKeys.get(semantic) || []).join(';')}`,
      );
    }
    if (output.length > 1 && !output.at(-1).delimiter) output.at(-1).delimiter = defaultDelimiter;
    const values = header.map((column) => desired[column] ?? '');
    output.push({ record: Papa.unparse([values], { newline: '' }), delimiter: defaultDelimiter });
    byRecordId.set(action.record_id, values);
    semanticKeys.set(semantic, [action.record_id]);
    changed += 1;
  }
  const result = `${hasBom ? '\ufeff' : ''}${output
    .map(({ record, delimiter }) => `${record}${delimiter}`)
    .join('')}`;
  const verified = Papa.parse(result.replace(/^\ufeff/, ''), { header: true, skipEmptyLines: true });
  if (verified.errors.length > 0 || verified.data.some((row) => Object.hasOwn(row, '__parsed_extra'))) {
    throw new Error(`${filePath}: generated CSV is invalid`);
  }
  return { filePath, source, result, changed };
}

function writeAtomically(outputs) {
  const temporary = [];
  try {
    for (const output of outputs) {
      const temporaryPath = `${output.filePath}.tmp-tamamushi-sharing-${process.pid}`;
      fs.writeFileSync(temporaryPath, output.result, 'utf8');
      temporary.push(temporaryPath);
    }
    outputs.forEach((output, index) => fs.renameSync(temporary[index], output.filePath));
    temporary.length = 0;
  } finally {
    for (const temporaryPath of temporary) fs.rmSync(temporaryPath, { force: true });
  }
}

const actions = readAudit();
verifySourcePdf();
validateTaxa(actions);
const outputs = [transform('host', actions), transform('note', actions)];
if (CHECK_ONLY) {
  const pending = outputs.reduce((sum, output) => sum + output.changed, 0);
  if (pending > 0) throw new Error(`Tamamushi species-level sharing has ${pending} pending rows`);
} else {
  writeAtomically(outputs);
}
for (const output of outputs) {
  console.log(`[tamamushi-sharing] ${path.relative(ROOT, output.filePath)} changed=${output.changed}`);
}

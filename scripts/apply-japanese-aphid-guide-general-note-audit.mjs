#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Papa from 'papaparse';

import { splitCsvRecordsWithDelimiters } from './lib/csvRecords.mjs';
import { collectGeneralNoteIssues } from './lib/generalNoteQuality.mjs';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.join(path.dirname(__filename), '..');
const SOURCE = '日本原色アブラムシ図鑑';
const VERSION = 'japanese-aphid-guide-all-accounts-v1-2026-07-12';
const PDF_SHA256 = 'd50ba1738d8088d464399da7ffc18b6d5f3418c7954fe58fc9e5b8c95691a61c';
const OCR_SHA256 = '17708b004357f0dd8ba722dfe14e976a895f24e36c176d7e7e25fb5144807da7';
const COVERAGE_SHA256 = '201bd3c808f7dfc41ab1af6dca5a8efbd9132dd259a5979510af80cfc5afb9d4';
const AUDIT_SHA256 = '5e53e9ea4bfac5bcc7353eef47b0526505fd508ef9c5775f45b0dd0bb1046b6d';
const PROFILE = Object.freeze({
  existing_source_note_count: 148,
  approved_source_note_count: 235,
  host_action_count: 48,
  insect_action_count: 1,
});
const NOTE_COLUMNS = ['record_id', 'insect_id', 'note_type', 'content', 'reference', 'page', 'year'];
const HOST_COLUMNS = [
  'record_id', 'insect_id', 'plant_name', 'plant_family', 'observation_type',
  'plant_part', 'life_stage', 'reference', 'notes',
];

const resolvePath = (envName, fallback) => process.env[envName]
  ? path.resolve(process.env[envName])
  : path.join(ROOT, fallback);
const NOTES_PATH = resolvePath('APHID_GUIDE_NOTES_PATH', 'normalized_data/general_notes.csv');
const HOSTS_PATH = resolvePath('APHID_GUIDE_HOSTS_PATH', 'normalized_data/hostplants.csv');
const INSECTS_PATH = resolvePath('APHID_GUIDE_INSECTS_PATH', 'normalized_data/insects.csv');
const COVERAGE_PATH = resolvePath(
  'APHID_GUIDE_COVERAGE_PATH',
  'data/source_audits/japanese-aphid-guide-all-accounts-2026-07-12.csv',
);
const AUDIT_PATH = resolvePath(
  'APHID_GUIDE_AUDIT_PATH',
  'data/source_audits/japanese-aphid-guide-general-note-integrity-2026-07-12.json',
);
const PRODUCTION_COVERAGE_PATH = path.join(
  ROOT,
  'data/source_audits/japanese-aphid-guide-all-accounts-2026-07-12.csv',
);
const PRODUCTION_AUDIT_PATH = path.join(
  ROOT,
  'data/source_audits/japanese-aphid-guide-general-note-integrity-2026-07-12.json',
);
const PDF_PATH = process.env.APHID_GUIDE_PDF_PATH
  ? path.resolve(process.env.APHID_GUIDE_PDF_PATH)
  : null;
const CHECK_ONLY = process.argv.includes('--check');
const unknownArguments = process.argv.slice(2).filter(argument => argument !== '--check');
if (unknownArguments.length > 0) throw new Error(`Unknown arguments: ${unknownArguments.join(', ')}`);

const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const sha256File = (filePath) => {
  const hash = crypto.createHash('sha256');
  const descriptor = fs.openSync(filePath, 'r');
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    let count;
    do {
      count = fs.readSync(descriptor, buffer, 0, buffer.length, null);
      if (count > 0) hash.update(buffer.subarray(0, count));
    } while (count > 0);
  } finally {
    fs.closeSync(descriptor);
  }
  return hash.digest('hex');
};
const normalizeIds = value => (value || '').split('|').map(item => item.trim()).filter(Boolean);
const canonicalRows = (rows, columns) => rows
  .map(row => Object.fromEntries(columns.map(column => [column, row[column] || ''])))
  .sort((left, right) => left.record_id.localeCompare(right.record_id));
const equal = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const fullRow = (row, columns) => Object.fromEntries(columns.map(column => [column, row[column] || '']));

const rawAudit = fs.readFileSync(AUDIT_PATH, 'utf8');
let audit;
try {
  audit = JSON.parse(rawAudit);
} catch (error) {
  throw new Error(`${path.basename(AUDIT_PATH)}: ${error.message}`);
}
if (audit.audit_version !== VERSION || audit.reviewed_on !== '2026-07-12' || audit.reference !== SOURCE) {
  throw new Error('Unexpected aphid-guide audit identity');
}
if (!audit.method || audit.source_pdf?.sha256 !== PDF_SHA256 || audit.source_pdf?.page_count !== 122) {
  throw new Error('Unexpected original source PDF identity');
}
if (audit.source_pdf?.role !== 'original_full_pdf_image_review') {
  throw new Error('Original source PDF is not the acceptance evidence');
}
if (
  audit.candidate_ocr?.sha256 !== OCR_SHA256
  || audit.candidate_ocr?.role !== 'candidate_location_only_not_acceptance_evidence'
) {
  throw new Error('Unexpected OCR candidate identity or role');
}
for (const [key, expected] of Object.entries(PROFILE)) {
  if (audit.expected_profile?.[key] !== expected) {
    throw new Error(`Unexpected audit profile ${key}: ${audit.expected_profile?.[key]}`);
  }
}
if (
  !Array.isArray(audit.existing_source_notes)
  || audit.existing_source_notes.length !== PROFILE.existing_source_note_count
  || !Array.isArray(audit.approved_source_notes)
  || audit.approved_source_notes.length !== PROFILE.approved_source_note_count
  || !Array.isArray(audit.host_actions)
  || audit.host_actions.length !== PROFILE.host_action_count
  || !Array.isArray(audit.insect_actions)
  || audit.insect_actions.length !== PROFILE.insect_action_count
) {
  throw new Error('Audit rows do not match the locked profile');
}
const expectedSourceNotes = canonicalRows(audit.existing_source_notes, NOTE_COLUMNS);
const approvedSourceNotes = canonicalRows(audit.approved_source_notes, NOTE_COLUMNS);
if (sha256(JSON.stringify(expectedSourceNotes)) !== audit.existing_source_note_profile_sha256) {
  throw new Error('Existing source-note profile hash mismatch');
}
const approvedNoteIds = new Set();
for (const row of approvedSourceNotes) {
  if (
    !row.record_id
    || approvedNoteIds.has(row.record_id)
    || !row.insect_id
    || row.note_type !== '生態情報'
    || row.reference !== SOURCE
    || !row.page
    || row.year !== ''
  ) {
    throw new Error(`Invalid approved source note: ${row.record_id}`);
  }
  approvedNoteIds.add(row.record_id);
  const issues = collectGeneralNoteIssues(row);
  if (issues.length > 0) {
    throw new Error(`Approved source note ${row.record_id} fails quality rules: ${issues.join(',')}`);
  }
}

const rawCoverage = fs.readFileSync(COVERAGE_PATH, 'utf8');
const coverageParsed = Papa.parse(rawCoverage.replace(/^\ufeff/, ''), {
  header: true,
  skipEmptyLines: true,
});
if (coverageParsed.errors.length > 0) {
  throw new Error(`${path.basename(COVERAGE_PATH)}: ${coverageParsed.errors[0].message}`);
}
const coverage = coverageParsed.data;
if (
  coverage.length !== 240
  || audit.coverage?.account_count !== 240
  || audit.coverage?.applied_account_count !== 232
  || audit.coverage?.held_account_count !== 8
  || audit.coverage?.approved_target_note_count !== PROFILE.approved_source_note_count
  || audit.coverage?.original_pdf_pages_reviewed !== 122
) {
  throw new Error('Unexpected all-account coverage profile');
}
if (sha256(rawCoverage) !== audit.coverage.sha256) throw new Error('Coverage hash does not match audit');
for (let index = 0; index < coverage.length; index += 1) {
  const row = coverage[index];
  const account = index + 1;
  if (Number(row.account_number) !== account || !row.evidence_note.includes('目視確認')) {
    throw new Error(`Invalid original-image coverage for source account ${account}`);
  }
  const targets = normalizeIds(row.application_targets);
  const expectedPrintedPage = 224 + account + (account >= 161 ? 1 : 0) + (account >= 170 ? 1 : 0);
  if (Number(row.printed_page) !== expectedPrintedPage) {
    throw new Error(`Unexpected printed page for source account ${account}`);
  }
  if ((targets.length === 0) !== row.decision.includes('hold')) {
    throw new Error(`Target/hold mismatch for source account ${account}`);
  }
  for (const target of targets) {
    const recordId = `note-aphid-guide-a${String(account).padStart(3, '0')}-${target}-ecology`;
    const note = approvedSourceNotes.find(candidate => candidate.record_id === recordId);
    if (!note || note.insect_id !== target || note.page !== row.printed_page) {
      throw new Error(`Missing approved note for source account ${account} target ${target}`);
    }
  }
}

const productionAudit = path.resolve(AUDIT_PATH) === path.resolve(PRODUCTION_AUDIT_PATH)
  || process.env.APHID_GUIDE_ENFORCE_PRODUCTION === '1';
const productionCoverage = path.resolve(COVERAGE_PATH) === path.resolve(PRODUCTION_COVERAGE_PATH)
  || process.env.APHID_GUIDE_ENFORCE_PRODUCTION === '1';
if (productionAudit && sha256(rawAudit) !== AUDIT_SHA256) {
  throw new Error(`Production audit SHA-256 mismatch: ${sha256(rawAudit)}`);
}
if (productionCoverage && sha256(rawCoverage) !== COVERAGE_SHA256) {
  throw new Error(`Production coverage SHA-256 mismatch: ${sha256(rawCoverage)}`);
}
if (PDF_PATH && sha256File(PDF_PATH) !== PDF_SHA256) throw new Error('Source PDF SHA-256 mismatch');

function readPreservingCsv(filePath, idColumn, requiredColumns) {
  const source = fs.readFileSync(filePath, 'utf8');
  const hasBom = source.charCodeAt(0) === 0xfeff;
  const body = hasBom ? source.slice(1) : source;
  const entries = splitCsvRecordsWithDelimiters(body);
  if (entries.length === 0) throw new Error(`${path.basename(filePath)} is empty`);
  const headerParsed = Papa.parse(entries[0].record);
  if (headerParsed.errors.length > 0) throw new Error(`${filePath}: ${headerParsed.errors[0].message}`);
  const header = headerParsed.data[0];
  const indexes = Object.fromEntries(header.map((column, index) => [column, index]));
  for (const column of requiredColumns) {
    if (indexes[column] === undefined) throw new Error(`${path.basename(filePath)} is missing ${column}`);
  }
  const rows = [];
  const byId = new Map();
  for (const entry of entries.slice(1)) {
    if (!entry.record) continue;
    const parsed = Papa.parse(entry.record);
    if (parsed.errors.length > 0 || parsed.data.length !== 1) {
      throw new Error(`${path.basename(filePath)} contains a malformed row`);
    }
    const values = parsed.data[0];
    const id = values[indexes[idColumn]] || '';
    if (!id || byId.has(id)) throw new Error(`${path.basename(filePath)} has invalid or duplicate ${idColumn}: ${id}`);
    const object = Object.fromEntries(header.map((column, index) => [column, values[index] || '']));
    const item = { id, entry, values, object, deleted: false, changed: false };
    rows.push(item);
    byId.set(id, item);
  }
  return { filePath, source, hasBom, entries, header, indexes, rows, byId };
}

const notesCsv = readPreservingCsv(NOTES_PATH, 'record_id', NOTE_COLUMNS);
const hostsCsv = readPreservingCsv(HOSTS_PATH, 'record_id', HOST_COLUMNS);
const insectsCsv = readPreservingCsv(INSECTS_PATH, 'insect_id', ['insect_id', 'family', 'japanese_name']);
const actualSourceNotes = canonicalRows(
  notesCsv.rows.filter(item => item.object.reference === SOURCE).map(item => item.object),
  NOTE_COLUMNS,
);
let noteState;
if (equal(actualSourceNotes, expectedSourceNotes)) noteState = 'pending';
else if (equal(actualSourceNotes, approvedSourceNotes)) noteState = 'applied';
else throw new Error('Unexpected or partial source-note profile');

const actionIds = new Set();
const componentStates = [{ id: 'source-note-profile', state: noteState }];
const validateAction = (action, csv, columns, allowedAction) => {
  if (!action.audit_id || actionIds.has(action.audit_id)) throw new Error(`Invalid or duplicate audit ID: ${action.audit_id}`);
  actionIds.add(action.audit_id);
  if (action.action !== allowedAction && !allowedAction.includes?.(action.action)) {
    throw new Error(`Unsupported action ${action.action}`);
  }
  if (!action.record_id || !Number.isInteger(action.source_account) || !action.decision) {
    throw new Error(`Incomplete action ${action.audit_id}`);
  }
  const item = csv.byId.get(action.record_id);
  if (action.action.startsWith('patch_')) {
    if (!action.expected || !action.approved || !item) throw new Error(`Incomplete patch ${action.audit_id}`);
    const actual = fullRow(item.object, columns);
    if (equal(actual, fullRow(action.expected, columns))) return { action, item, state: 'pending' };
    if (equal(actual, fullRow(action.approved, columns))) return { action, item, state: 'applied' };
    throw new Error(`Unexpected patch state for ${action.audit_id}`);
  }
  if (action.action.startsWith('delete_')) {
    if (!action.expected || action.approved !== null) throw new Error(`Incomplete delete ${action.audit_id}`);
    if (!item) return { action, item: null, state: 'applied' };
    if (equal(fullRow(item.object, columns), fullRow(action.expected, columns))) {
      return { action, item, state: 'pending' };
    }
    throw new Error(`Unexpected delete state for ${action.audit_id}`);
  }
  if (action.action.startsWith('add_')) {
    if (action.expected !== null || !action.approved) throw new Error(`Incomplete add ${action.audit_id}`);
    if (!item) return { action, item: null, state: 'pending' };
    if (equal(fullRow(item.object, columns), fullRow(action.approved, columns))) {
      return { action, item, state: 'applied' };
    }
    throw new Error(`Unexpected add state for ${action.audit_id}`);
  }
  throw new Error(`Unsupported action ${action.action}`);
};

const hostStates = audit.host_actions.map(action => validateAction(
  action,
  hostsCsv,
  HOST_COLUMNS,
  ['patch_host', 'delete_host', 'add_host'],
));
const insectColumns = insectsCsv.header;
const insectStates = audit.insect_actions.map(action => validateAction(
  action,
  insectsCsv,
  insectColumns,
  'patch_insect',
));
componentStates.push(...hostStates.map(item => ({ id: item.action.audit_id, state: item.state })));
componentStates.push(...insectStates.map(item => ({ id: item.action.audit_id, state: item.state })));
const pendingCount = componentStates.filter(item => item.state === 'pending').length;
const appliedCount = componentStates.filter(item => item.state === 'applied').length;
if (pendingCount > 0 && appliedCount > 0) {
  throw new Error(`Partial audit state rejected: pending=${pendingCount} applied=${appliedCount}`);
}

const renderRows = (csv, addedObjects = []) => {
  const output = [csv.entries[0]];
  for (const item of csv.rows) {
    if (item.deleted) continue;
    if (!item.changed) output.push(item.entry);
    else output.push({
      record: Papa.unparse([item.values], { newline: '' }),
      delimiter: item.entry.delimiter,
    });
  }
  const fallbackDelimiter = csv.rows.at(-1)?.entry.delimiter || '\n';
  for (const object of addedObjects) {
    const values = csv.header.map(column => object[column] || '');
    output.push({ record: Papa.unparse([values], { newline: '' }), delimiter: fallbackDelimiter });
  }
  return `${csv.hasBom ? '\ufeff' : ''}${output.map(entry => `${entry.record}${entry.delimiter}`).join('')}`;
};

let notesText = notesCsv.source;
let hostsText = hostsCsv.source;
let insectsText = insectsCsv.source;
if (pendingCount > 0) {
  for (const item of notesCsv.rows) {
    if (item.object.reference === SOURCE) item.deleted = true;
  }
  notesText = renderRows(notesCsv, approvedSourceNotes);

  const addedHosts = [];
  for (const state of hostStates) {
    const { action, item } = state;
    if (action.action === 'patch_host') {
      for (const [column, index] of Object.entries(hostsCsv.indexes)) {
        item.values[index] = action.approved[column] || '';
      }
      item.object = { ...action.approved };
      item.changed = true;
    } else if (action.action === 'delete_host') item.deleted = true;
    else addedHosts.push(action.approved);
  }
  hostsText = renderRows(hostsCsv, addedHosts);

  for (const state of insectStates) {
    for (const [column, index] of Object.entries(insectsCsv.indexes)) {
      state.item.values[index] = state.action.approved[column] || '';
    }
    state.item.object = { ...state.action.approved };
    state.item.changed = true;
  }
  insectsText = renderRows(insectsCsv);
}

const parseResult = (text, label) => {
  const parsed = Papa.parse(text.replace(/^\ufeff/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n'), {
    header: true,
    skipEmptyLines: true,
  });
  if (parsed.errors.length > 0) throw new Error(`${label}: ${parsed.errors[0].message}`);
  return parsed.data;
};
const finalNotes = parseResult(notesText, 'prospective general_notes.csv');
const finalHosts = parseResult(hostsText, 'prospective hostplants.csv');
const finalInsects = parseResult(insectsText, 'prospective insects.csv');
for (const [label, rows, idColumn] of [
  ['general_notes.csv', finalNotes, 'record_id'],
  ['hostplants.csv', finalHosts, 'record_id'],
  ['insects.csv', finalInsects, 'insect_id'],
]) {
  const ids = rows.map(row => row[idColumn]);
  if (ids.some(id => !id) || new Set(ids).size !== ids.length) {
    throw new Error(`Prospective ${label} has missing or duplicate ${idColumn}`);
  }
}
const finalSourceNotes = canonicalRows(finalNotes.filter(row => row.reference === SOURCE), NOTE_COLUMNS);
if (!equal(finalSourceNotes, approvedSourceNotes)) throw new Error('Prospective source-note profile is incomplete');
const finalInsectsById = new Map(finalInsects.map(row => [row.insect_id, row]));
for (const note of finalSourceNotes) {
  if (finalInsectsById.get(note.insect_id)?.family !== 'Aphididae') {
    throw new Error(`Prospective note target is not Aphididae: ${note.insect_id}`);
  }
  const issues = collectGeneralNoteIssues(note);
  if (issues.length > 0) throw new Error(`Prospective note quality failure: ${note.record_id}`);
}
const finalHostsById = new Map(finalHosts.map(row => [row.record_id, row]));
for (const action of audit.host_actions) {
  const actual = finalHostsById.get(action.record_id);
  if (action.action === 'delete_host') {
    if (actual) throw new Error(`Prospective host delete failed: ${action.audit_id}`);
  } else if (!actual || !equal(fullRow(actual, HOST_COLUMNS), fullRow(action.approved, HOST_COLUMNS))) {
    throw new Error(`Prospective host action failed: ${action.audit_id}`);
  }
}
const finalInsectsByRecordId = new Map(finalInsects.map(row => [row.insect_id, row]));
for (const action of audit.insect_actions) {
  if (!equal(fullRow(finalInsectsByRecordId.get(action.record_id), insectColumns), fullRow(action.approved, insectColumns))) {
    throw new Error(`Prospective insect action failed: ${action.audit_id}`);
  }
}

const changed = notesText !== notesCsv.source || hostsText !== hostsCsv.source || insectsText !== insectsCsv.source;
if (!CHECK_ONLY && changed) {
  const staged = [];
  try {
    for (const [filePath, text] of [
      [NOTES_PATH, notesText], [HOSTS_PATH, hostsText], [INSECTS_PATH, insectsText],
    ]) {
      const temporaryPath = `${filePath}.aphid-guide-${process.pid}.tmp`;
      fs.writeFileSync(temporaryPath, text, 'utf8');
      staged.push({ filePath, temporaryPath });
    }
    for (const item of staged) fs.renameSync(item.temporaryPath, item.filePath);
  } finally {
    for (const item of staged) fs.rmSync(item.temporaryPath, { force: true });
  }
}

console.log(JSON.stringify({
  check_only: CHECK_ONLY,
  state: pendingCount > 0 ? 'pending' : 'applied',
  changed: CHECK_ONLY ? false : changed,
  would_change: CHECK_ONLY && changed,
  source_notes_before: actualSourceNotes.length,
  source_notes_after: finalSourceNotes.length,
  host_actions: hostStates.length,
  insect_actions: insectStates.length,
  held_accounts: audit.coverage.held_account_count,
}, null, 2));

#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Papa from 'papaparse';

import { splitCsvRecordsWithDelimiters } from './lib/csvRecords.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_ROOT = process.env.KAMIKIRI_COMPREHENSIVE_DATA_ROOT
  ? path.resolve(process.env.KAMIKIRI_COMPREHENSIVE_DATA_ROOT)
  : ROOT;
const LEDGER_PATH = process.env.KAMIKIRI_COMPREHENSIVE_AUDIT_PATH
  ? path.resolve(process.env.KAMIKIRI_COMPREHENSIVE_AUDIT_PATH)
  : path.join(ROOT, 'data/source_audits/japanese-longhorn-beetles-2007-comprehensive-integrity-2026-07-12.json');
const SOURCE_PDF = process.env.KAMIKIRI_COMPREHENSIVE_SOURCE_PDF
  ? path.resolve(process.env.KAMIKIRI_COMPREHENSIVE_SOURCE_PDF)
  : '';
const CHECK_ONLY = process.argv.includes('--check');
const REFERENCE = '日本産カミキリムシ';
const PDF_SHA256 = '52299895c14c1fd1c74279dca00f6fd9ba64d36d69e3bf3dd9c3a29a92802e77';
const AUDIT_ID = 'japanese-longhorn-beetles-2007-comprehensive-integrity-2026-07-12';
const NOTE_COLUMNS = ['record_id', 'insect_id', 'note_type', 'content', 'reference', 'page', 'year'];
const HOST_COLUMNS = ['record_id', 'insect_id', 'plant_name', 'plant_family', 'observation_type', 'plant_part', 'life_stage', 'reference', 'notes'];
const INSECT_COLUMNS = [
  'insect_id', 'family', 'family_jp', 'subfamily', 'subfamily_jp', 'tribe', 'tribe_jp',
  'genus', 'subgenus', 'species', 'subspecies', 'author', 'year', 'japanese_name',
  'old_japanese_name', 'alternative_name', 'other_names', 'scientific_name', 'synonyms',
  'changes_since_standard', 'notes',
];
const ALLOWED_OPS = new Set([
  'add_note', 'update_note', 'delete_note', 'add_host', 'delete_host', 'update_insect',
]);
const clean = (value) => (value ?? '').toString().trim();

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function parseCsv(filePath) {
  const parsed = Papa.parse(fs.readFileSync(filePath, 'utf8').replace(/^\ufeff/, ''), {
    header: true,
    skipEmptyLines: true,
  });
  if (parsed.errors.length) throw new Error(`${filePath}: ${parsed.errors[0].message}`);
  if (parsed.data.some((row) => Object.hasOwn(row, '__parsed_extra'))) {
    throw new Error(`${filePath}: over-wide CSV row`);
  }
  return parsed.data.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, clean(value)])));
}

function exactEqual(actual, expected, columns) {
  return columns.every((column) => clean(actual?.[column]) === clean(expected?.[column]));
}

function semanticKey(row, kind) {
  if (kind === 'note') {
    return [row.insect_id, row.note_type, row.content, row.reference, row.page, row.year].map(clean).join('\u0000');
  }
  if (kind === 'host') return [
    row.insect_id, row.plant_name, row.plant_family, row.observation_type,
    row.plant_part, row.life_stage, row.reference, row.notes,
  ].map(clean).join('\u0000');
  return clean(row.insect_id);
}

const kindForOp = (op) => op.endsWith('_note') ? 'note' : op.endsWith('_host') ? 'host' : 'insect';
const columnsForKind = (kind) => kind === 'note' ? NOTE_COLUMNS : kind === 'host' ? HOST_COLUMNS : INSECT_COLUMNS;
const rowIdForKind = (row, kind) => kind === 'insect' ? row?.insect_id : row?.record_id;
const actionRecordId = (action, kind = kindForOp(action.op)) =>
  rowIdForKind(action.before, kind) || rowIdForKind(action.after, kind);

function validateLedger() {
  const audit = JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8'));
  if (audit.schema_version !== 1 || audit.audit_id !== AUDIT_ID || audit.reviewed_on !== '2026-07-12') {
    throw new Error('Audit identity/version guard failed');
  }
  if (
    audit.source?.canonical_reference !== REFERENCE ||
    audit.source?.source_pdf_sha256 !== PDF_SHA256 ||
    audit.population_definition?.baseline_note_count !== 958 ||
    audit.population_definition?.sibling_group_count !== 38 ||
    audit.note_coverage?.length !== 958 ||
    audit.sibling_group_scope_ledger?.length !== 38 ||
    audit.actions?.length !== audit.summary?.action_count ||
    audit.metadata_cleanup_actions?.length !== 36 ||
    audit.summary?.metadata_cleanup_action_count !== 36 ||
    audit.summary?.total_action_count !== audit.actions.length + audit.metadata_cleanup_actions.length ||
    audit.application_phases?.length !== 2
  ) {
    throw new Error('Audit denominator/provenance guard failed');
  }
  if (new Set(audit.note_coverage.map((row) => row.record_id)).size !== 958) {
    throw new Error('Audit note coverage contains duplicate record ids');
  }
  if (new Set(audit.sibling_group_scope_ledger.map((row) => row.group_key)).size !== 38) {
    throw new Error('Audit sibling group ledger contains duplicate keys');
  }
  const actionIds = new Set();
  const recordOps = new Set();
  for (const action of [...audit.actions, ...audit.metadata_cleanup_actions]) {
    if (!/^KCI-[0-9a-f]{14}$/.test(action.action_id) || actionIds.has(action.action_id)) {
      throw new Error(`Invalid or duplicate action id: ${action.action_id}`);
    }
    actionIds.add(action.action_id);
    if (!ALLOWED_OPS.has(action.op)) throw new Error(`${action.action_id}: unsupported operation`);
    const kind = kindForOp(action.op);
    const columns = columnsForKind(kind);
    const recordId = actionRecordId(action, kind);
    const recordOp = `${action.op}\u0000${recordId}`;
    if (!recordId || recordOps.has(recordOp)) throw new Error(`${action.action_id}: duplicate/missing record operation`);
    recordOps.add(recordOp);
    if (
      action.evidence?.source_pdf_sha256 !== PDF_SHA256 ||
      action.evidence?.pdf_file !== '日本産カミキリムシ_compressed.pdf' ||
      action.evidence?.basis !== 'original_pdf_visually_verified' ||
      !action.evidence?.pdf_page || !action.evidence?.printed_page ||
      !action.evidence?.source_scope || !action.evidence?.reason
    ) {
      throw new Error(`${action.action_id}: incomplete source evidence`);
    }
    if (action.op.startsWith('add_') && (action.before !== null || !action.after)) {
      throw new Error(`${action.action_id}: malformed add action`);
    }
    if (action.op.startsWith('update_') && (!action.before || !action.after)) {
      throw new Error(`${action.action_id}: malformed update action`);
    }
    if (action.op.startsWith('delete_') && (!action.before || action.after !== null)) {
      throw new Error(`${action.action_id}: malformed delete action`);
    }
    for (const snapshot of [action.before, action.after].filter(Boolean)) {
      for (const column of columns) {
        if (!Object.hasOwn(snapshot, column)) throw new Error(`${action.action_id}: snapshot missing ${column}`);
      }
      if (
        snapshot.insect_id !== action.insect_id ||
        (kind !== 'insect' && snapshot.reference !== REFERENCE)
      ) {
        throw new Error(`${action.action_id}: snapshot identity/reference mismatch`);
      }
    }
  }
  return audit;
}

function verifyPdf() {
  if (!SOURCE_PDF) return;
  if (!fs.existsSync(SOURCE_PDF)) throw new Error(`Source PDF missing: ${SOURCE_PDF}`);
  const actual = sha256(SOURCE_PDF);
  if (actual !== PDF_SHA256) throw new Error(`Source PDF hash mismatch: ${actual}`);
}

function validateTaxonIdentities(audit) {
  const insectsPath = path.join(DATA_ROOT, 'normalized_data', 'insects.csv');
  const byId = new Map(parseCsv(insectsPath).map((row) => [row.insect_id, row]));
  for (const action of [...audit.actions, ...audit.metadata_cleanup_actions]) {
    const insect = byId.get(action.insect_id);
    if (!insect) throw new Error(`${action.action_id}: current insect is missing`);
    if (
      insect.japanese_name !== action.current_japanese_name ||
      insect.scientific_name !== action.current_scientific_name
    ) {
      throw new Error(`${action.action_id}: current taxon identity drift`);
    }
  }
}

function classifyFile(filePath, kind, actions) {
  const columns = columnsForKind(kind);
  const rows = parseCsv(filePath);
  const byId = new Map();
  const bySemantic = new Map();
  for (const row of rows) {
    const rowId = rowIdForKind(row, kind);
    if (!rowId || byId.has(rowId)) throw new Error(`${filePath}: duplicate/missing row id ${rowId}`);
    byId.set(rowId, row);
    const key = semanticKey(row, kind);
    if (!bySemantic.has(key)) bySemantic.set(key, []);
    bySemantic.get(key).push(rowId);
  }
  const states = [];
  for (const action of actions) {
    const recordId = actionRecordId(action, kind);
    const current = byId.get(recordId);
    let state;
    if (action.op.startsWith('add_')) {
      const semanticIds = bySemantic.get(semanticKey(action.after, kind)) || [];
      if (!current && semanticIds.length === 0) state = 'pending';
      else if (current && exactEqual(current, action.after, columns) && semanticIds.length === 1) state = 'applied';
      else state = 'conflict';
    } else if (action.op.startsWith('update_')) {
      if (current && exactEqual(current, action.before, columns)) state = 'pending';
      else if (current && exactEqual(current, action.after, columns)) state = 'applied';
      else state = 'conflict';
    } else {
      if (current && exactEqual(current, action.before, columns)) state = 'pending';
      else if (!current) state = 'applied';
      else state = 'conflict';
    }
    states.push({ action, state });
  }
  return { rows, states };
}

function parseRecord(record, filePath) {
  const parsed = Papa.parse(record);
  if (parsed.errors.length) throw new Error(`${filePath}: ${parsed.errors[0].message}`);
  return parsed.data[0];
}

function transformFile(filePath, kind, actions) {
  const columns = columnsForKind(kind);
  const source = fs.readFileSync(filePath, 'utf8');
  const hasBom = source.charCodeAt(0) === 0xfeff;
  const entries = splitCsvRecordsWithDelimiters(hasBom ? source.slice(1) : source);
  if (!entries.length) throw new Error(`${filePath}: empty CSV`);
  const header = parseRecord(entries[0].record, filePath);
  const indexes = Object.fromEntries(header.map((column, index) => [column, index]));
  for (const column of columns) {
    if (indexes[column] === undefined) throw new Error(`${filePath}: missing ${column}`);
  }
  const defaultDelimiter = entries.find((entry) => entry.delimiter)?.delimiter || '\n';
  const actionById = new Map(actions.map((action) => [actionRecordId(action, kind), action]));
  const output = [];
  for (const [index, entry] of entries.entries()) {
    if (index === 0) {
      output.push(entry);
      continue;
    }
    if (!entry.record) continue;
    const values = parseRecord(entry.record, filePath);
    const recordId = clean(values[indexes[kind === 'insect' ? 'insect_id' : 'record_id']]);
    const action = actionById.get(recordId);
    if (!action || action.op.startsWith('add_')) {
      output.push(entry);
    } else if (action.op.startsWith('update_')) {
      const next = header.map((column) => action.after[column] ?? '');
      output.push({ record: Papa.unparse([next], { newline: '' }), delimiter: entry.delimiter });
    }
  }
  const additions = actions.filter((action) => action.op.startsWith('add_'));
  if (additions.length && output.length > 1 && !output.at(-1).delimiter) output.at(-1).delimiter = defaultDelimiter;
  for (const action of additions) {
    const values = header.map((column) => action.after[column] ?? '');
    output.push({ record: Papa.unparse([values], { newline: '' }), delimiter: defaultDelimiter });
  }
  const result = `${hasBom ? '\ufeff' : ''}${output.map((entry) => `${entry.record}${entry.delimiter}`).join('')}`;
  const parsed = Papa.parse(result.replace(/^\ufeff/, ''), { header: true, skipEmptyLines: true });
  if (parsed.errors.length || parsed.data.some((row) => Object.hasOwn(row, '__parsed_extra'))) {
    throw new Error(`${filePath}: transformed CSV is invalid`);
  }
  const normalized = parsed.data.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, clean(value)])));
  const byId = new Map(normalized.map((row) => [rowIdForKind(row, kind), row]));
  for (const action of actions) {
    const recordId = actionRecordId(action, kind);
    if (action.op.startsWith('delete_')) {
      if (byId.has(recordId)) throw new Error(`${action.action_id}: deletion did not apply`);
    } else if (!exactEqual(byId.get(recordId), action.after, columns)) {
      throw new Error(`${action.action_id}: expected after snapshot missing`);
    }
  }
  return result;
}

function atomicWriteAll(outputs) {
  const staged = [];
  try {
    for (const [filePath, content] of outputs) {
      const tempPath = `${filePath}.tmp-${process.pid}-${crypto.randomBytes(4).toString('hex')}`;
      fs.writeFileSync(tempPath, content);
      staged.push({ filePath, tempPath, original: fs.readFileSync(filePath) });
    }
    const replaced = [];
    try {
      for (const item of staged) {
        fs.renameSync(item.tempPath, item.filePath);
        replaced.push(item);
      }
    } catch (error) {
      for (const item of replaced) fs.writeFileSync(item.filePath, item.original);
      throw error;
    }
  } finally {
    for (const item of staged) {
      if (fs.existsSync(item.tempPath)) fs.rmSync(item.tempPath, { force: true });
    }
  }
}

function main() {
  const audit = validateLedger();
  verifyPdf();
  validateTaxonIdentities(audit);
  const notePath = path.join(DATA_ROOT, 'normalized_data', 'general_notes.csv');
  const hostPath = path.join(DATA_ROOT, 'normalized_data', 'hostplants.csv');
  const insectPath = path.join(DATA_ROOT, 'normalized_data', 'insects.csv');
  const noteActions = audit.actions.filter((action) => action.op.endsWith('_note'));
  const hostActions = audit.actions.filter((action) => action.op.endsWith('_host'));
  const insectActions = audit.metadata_cleanup_actions;
  const primaryStates = [
    ...classifyFile(notePath, 'note', noteActions).states,
    ...classifyFile(hostPath, 'host', hostActions).states,
  ];
  const metadataStates = classifyFile(insectPath, 'insect', insectActions).states;
  const classified = [...primaryStates, ...metadataStates];
  const conflicts = classified.filter((row) => row.state === 'conflict');
  if (conflicts.length) {
    throw new Error(`Conflicting state: ${conflicts.slice(0, 5).map((row) => row.action.action_id).join(', ')}`);
  }
  const phaseState = (states, label) => {
    const pending = states.filter((row) => row.state === 'pending');
    const applied = states.filter((row) => row.state === 'applied');
    if (pending.length && applied.length) {
      throw new Error(`Refusing partial state in ${label}: ${pending.length} pending, ${applied.length} applied`);
    }
    return pending.length ? 'pending' : 'applied';
  };
  const primaryPhase = phaseState(primaryStates, 'phase 1');
  const metadataPhase = phaseState(metadataStates, 'phase 2');
  if (primaryPhase === 'pending' && metadataPhase === 'applied') {
    throw new Error('Refusing out-of-order state: phase 2 is applied before phase 1');
  }
  const pending = classified.filter((row) => row.state === 'pending');
  const applied = classified.filter((row) => row.state === 'applied');
  if (!pending.length) {
    console.log(JSON.stringify({ audit_id: AUDIT_ID, state: 'already_applied', actions: applied.length, changed: false }));
    return;
  }
  if (CHECK_ONLY) {
    console.log(JSON.stringify({ audit_id: AUDIT_ID, state: 'ready', actions: pending.length, changed: false }));
    return;
  }
  const beforePublic = {};
  for (const fileName of ['general_notes.csv', 'hostplants.csv', 'insects.csv']) {
    const publicPath = path.join(DATA_ROOT, 'public', fileName);
    if (fs.existsSync(publicPath)) beforePublic[fileName] = sha256(publicPath);
  }
  const outputs = [];
  if (primaryPhase === 'pending') {
    outputs.push(
      [notePath, transformFile(notePath, 'note', noteActions)],
      [hostPath, transformFile(hostPath, 'host', hostActions)],
    );
  }
  if (metadataPhase === 'pending') {
    outputs.push([insectPath, transformFile(insectPath, 'insect', insectActions)]);
  }
  atomicWriteAll(outputs);
  for (const [fileName, beforeHash] of Object.entries(beforePublic)) {
    const afterHash = sha256(path.join(DATA_ROOT, 'public', fileName));
    if (afterHash !== beforeHash) throw new Error(`Public file changed unexpectedly: ${fileName}`);
  }
  const postStates = [
    ...classifyFile(notePath, 'note', noteActions).states,
    ...classifyFile(hostPath, 'host', hostActions).states,
    ...classifyFile(insectPath, 'insect', insectActions).states,
  ];
  if (postStates.some((row) => row.state !== 'applied')) throw new Error('Post-apply verification failed');
  console.log(JSON.stringify({
    audit_id: AUDIT_ID,
    state: 'applied',
    actions: pending.length,
    changed: true,
    normalized_only: true,
  }));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}

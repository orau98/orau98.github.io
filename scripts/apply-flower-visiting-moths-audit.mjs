#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  parseCsv,
  serializeField,
  toObjects,
} from './lib/csvQuality.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_ROOT = process.env.FLOWER_MOTHS_DATA_ROOT
  ? path.resolve(process.env.FLOWER_MOTHS_DATA_ROOT)
  : ROOT;
const AUDIT_PATH = process.env.FLOWER_MOTHS_AUDIT_PATH
  ? path.resolve(process.env.FLOWER_MOTHS_AUDIT_PATH)
  : path.join(
      ROOT,
      'data/source_audits/flower-visiting-moths-comprehensive-audit-2026-07-12.json',
    );
const CHECK_ONLY = process.argv.includes('--check');
const unknownArguments = process.argv.slice(2).filter((argument) => argument !== '--check');
if (unknownArguments.length) throw new Error(`Unknown arguments: ${unknownArguments.join(', ')}`);

const HOST_PATH = path.join(DATA_ROOT, 'normalized_data/hostplants.csv');
const INSECT_PATH = path.join(DATA_ROOT, 'normalized_data/insects.csv');
const SOURCE_REFERENCE = '花を訪れる蛾たち　知られざる姿を求めて';
const LEDGER_SHA256 = 'bad54f975389bef5db313beca0f1114156781c36faec99ebcd9e082ec90b9f87';
const EXPECTED_ACTIONS = 363;
const EXPECTED_ADDITIONS = 357;
const HOST_COLUMNS = [
  'record_id',
  'insect_id',
  'plant_name',
  'plant_family',
  'observation_type',
  'plant_part',
  'life_stage',
  'reference',
  'notes',
];

const sha256 = (filePath) => crypto.createHash('sha256')
  .update(fs.readFileSync(filePath))
  .digest('hex');
const clean = (value) => (value ?? '').toString().trim();
const equalFields = (row, expected) => Object.entries(expected || {})
  .every(([key, value]) => clean(row?.[key]) === clean(value));

function readLedger() {
  if (sha256(AUDIT_PATH) !== LEDGER_SHA256) {
    throw new Error(`Audit ledger SHA-256 mismatch: ${sha256(AUDIT_PATH)}`);
  }
  const ledger = JSON.parse(fs.readFileSync(AUDIT_PATH, 'utf8'));
  if (
    ledger?.source?.sha256 !== '59d32259aac9041d2d5497133dc33c7f1a220c148d2ce6a2ebe9e5c877540c6b'
    || ledger?.source?.source_taxon_accounts_audited !== 614
    || ledger?.coverage?.existing_source_rows_screened !== 2616
    || ledger?.coverage?.wholly_missing_source_taxa_found !== 70
    || ledger?.coverage?.unresolved_holds !== 0
  ) {
    throw new Error('Audit ledger coverage guard failed');
  }
  if (
    !Array.isArray(ledger.actions)
    || ledger.actions.length !== EXPECTED_ACTIONS
    || ledger.actions.filter((action) => action.action === 'add_relationship').length !== EXPECTED_ADDITIONS
  ) {
    throw new Error('Audit ledger action-count guard failed');
  }
  const actionIds = new Set();
  const recordIds = new Set();
  for (const action of ledger.actions) {
    if (!action.action_id || actionIds.has(action.action_id)) {
      throw new Error(`Invalid or duplicate action_id: ${action.action_id}`);
    }
    if (!action.record_id || recordIds.has(action.record_id)) {
      throw new Error(`Invalid or duplicate action record_id: ${action.record_id}`);
    }
    if (!['reassign_insect', 'delete_invalid_placeholder', 'replace_plant_name', 'set_plant_family', 'add_relationship'].includes(action.action)) {
      throw new Error(`${action.action_id}: unsupported action ${action.action}`);
    }
    if (!action.source_ordinal || !action.printed_page || !action.pdf_page || !action.evidence) {
      throw new Error(`${action.action_id}: incomplete original-PDF provenance`);
    }
    if (action.action === 'add_relationship') {
      const after = action.after || {};
      if (
        !after.insect_id
        || !after.plant_name
        || !after.plant_family
        || after.observation_type !== '野外（国内）'
        || after.plant_part !== '花'
        || after.life_stage !== '成虫'
        || after.reference !== SOURCE_REFERENCE
        || after.notes !== ''
      ) {
        throw new Error(`${action.action_id}: invalid added relationship fields`);
      }
    }
    actionIds.add(action.action_id);
    recordIds.add(action.record_id);
  }
  return ledger;
}

function parseRows(filePath) {
  return toObjects(parseCsv(fs.readFileSync(filePath, 'utf8')));
}

function desiredRow(action) {
  return Object.fromEntries(HOST_COLUMNS.map((column) => [
    column,
    column === 'record_id' ? action.record_id : action.after?.[column] ?? '',
  ]));
}

function relationshipKey(row) {
  return `${row.insect_id}\u0000${row.plant_name}`;
}

function relationshipCounts(rows) {
  const counts = new Map();
  for (const row of rows) {
    const key = relationshipKey(row);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

function recordEolProfile(source) {
  const parsed = parseCsv(source);
  const counts = new Map();
  for (const record of parsed.records) {
    if (!record.eol) continue;
    counts.set(record.eol, (counts.get(record.eol) || 0) + 1);
  }
  const entries = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return {
    dominant: entries[0]?.[0] || '\n',
    mixed: entries.length > 1,
  };
}

function normalizeRecordEols(source, eol) {
  const parsed = parseCsv(source);
  return parsed.records.map((record) => {
    const recordBody = source.slice(record.start, record.end - record.eol.length);
    return `${recordBody}${record.eol ? eol : ''}`;
  }).join('');
}

function validateTaxa(ledger) {
  const insects = parseRows(INSECT_PATH);
  const byId = new Map(insects.map((row) => [row.insect_id, row]));
  for (const action of ledger.actions) {
    const targetId = action.action === 'reassign_insect'
      ? action.after.insect_id
      : action.action === 'add_relationship'
        ? action.after.insect_id
        : action.expected_before?.insect_id;
    if (targetId && !byId.has(targetId)) throw new Error(`${action.action_id}: missing insect ${targetId}`);
  }
  for (const taxon of ledger.source_taxa_recovered) {
    const current = byId.get(taxon.insect_id);
    if (!current) throw new Error(`Recovered source taxon is missing: ${taxon.insect_id}`);
    if (
      clean(current.japanese_name) !== clean(taxon.current_japanese_name)
      || clean(current.scientific_name) !== clean(taxon.current_scientific_name)
    ) {
      throw new Error(`${taxon.insect_id}: current taxonomy drift`);
    }
  }
}

function classifyActions(ledger, rows) {
  const byRecordId = new Map(rows.map((row) => [row.record_id, row]));
  const semantic = new Map();
  for (const row of rows) {
    const key = relationshipKey(row);
    const matches = semantic.get(key) || [];
    matches.push(row.record_id);
    semantic.set(key, matches);
  }

  const states = [];
  for (const action of ledger.actions) {
    const current = byRecordId.get(action.record_id);
    if (action.action === 'add_relationship') {
      const after = desiredRow(action);
      const key = `${after.insect_id}\u0000${after.plant_name}`;
      if (!current && !semantic.has(key)) {
        states.push({ action, state: 'pending' });
      } else if (current && equalFields(current, after) && semantic.get(key)?.length === 1) {
        states.push({ action, state: 'applied' });
      } else {
        states.push({ action, state: 'conflict', reason: `record/semantic collision for ${key}` });
      }
      continue;
    }

    if (action.action === 'delete_invalid_placeholder') {
      if (current && equalFields(current, action.expected_before)) {
        states.push({ action, state: 'pending' });
      } else if (!current) {
        states.push({ action, state: 'applied' });
      } else {
        states.push({ action, state: 'conflict', reason: 'delete target drift' });
      }
      continue;
    }

    if (!current) {
      states.push({ action, state: 'conflict', reason: 'target record is missing' });
      continue;
    }
    const after = { ...action.expected_before, ...action.after };
    const beforeKey = relationshipKey(action.expected_before);
    const afterKey = relationshipKey(after);
    const changesRelationship = beforeKey !== afterKey;
    if (equalFields(current, action.expected_before)) {
      if (changesRelationship && semantic.has(afterKey)) {
        states.push({ action, state: 'conflict', reason: `semantic collision for ${afterKey}` });
      } else {
        states.push({ action, state: 'pending' });
      }
    } else if (equalFields(current, after)) {
      const targetRecords = semantic.get(afterKey) || [];
      if (changesRelationship && (targetRecords.length !== 1 || targetRecords[0] !== action.record_id)) {
        states.push({ action, state: 'conflict', reason: `applied semantic collision for ${afterKey}` });
      } else {
        states.push({ action, state: 'applied' });
      }
    } else {
      states.push({ action, state: 'conflict', reason: 'target record drift' });
    }
  }
  return states;
}

function transform(source, states) {
  const parsed = parseCsv(source);
  const recordEol = recordEolProfile(source).dominant;
  const header = parsed.header;
  const indexes = Object.fromEntries(header.map((column, index) => [column, index]));
  for (const column of HOST_COLUMNS) {
    if (indexes[column] === undefined) throw new Error(`hostplants.csv is missing ${column}`);
  }
  const recordById = new Map();
  parsed.records.slice(1).forEach((record) => {
    const recordId = record.fields[indexes.record_id] ?? '';
    if (recordId) recordById.set(recordId, record);
  });

  const replacements = [];
  const additions = [];
  for (const { action, state } of states) {
    if (state !== 'pending') continue;
    if (action.action === 'add_relationship') {
      const after = desiredRow(action);
      additions.push(HOST_COLUMNS.map((column) => serializeField(after[column])).join(','));
      continue;
    }
    const record = recordById.get(action.record_id);
    if (!record) throw new Error(`${action.action_id}: record disappeared during transform`);
    if (action.action === 'delete_invalid_placeholder') {
      replacements.push({ start: record.start, end: record.end, value: '' });
      continue;
    }
    for (const [column, value] of Object.entries(action.after || {})) {
      const fieldIndex = indexes[column];
      if (fieldIndex === undefined) throw new Error(`${action.action_id}: unknown field ${column}`);
      const [start, end] = record.ranges[fieldIndex];
      replacements.push({ start, end, value: serializeField(value) });
    }
  }

  replacements.sort((a, b) => b.start - a.start);
  let output = source;
  for (const replacement of replacements) {
    output = output.slice(0, replacement.start) + replacement.value + output.slice(replacement.end);
  }
  if (additions.length) {
    if (!output.endsWith('\n')) output += recordEol;
    output += `${additions.join(recordEol)}${recordEol}`;
  }
  return output;
}

function validateResult(source, ledger, baselineRelationshipCounts) {
  const parsed = parseCsv(source);
  const rows = toObjects(parsed);
  const ids = new Set();
  for (const row of rows) {
    if (!row.record_id || ids.has(row.record_id)) throw new Error(`duplicate/blank record_id: ${row.record_id}`);
    ids.add(row.record_id);
  }
  const resultRelationshipCounts = relationshipCounts(rows);
  for (const [key, count] of resultRelationshipCounts) {
    const allowed = Math.max(1, baselineRelationshipCounts.get(key) || 0);
    if (count > allowed) {
      throw new Error(`audit introduced an insect/plant duplicate: ${key} (${allowed} -> ${count})`);
    }
  }
  const states = classifyActions(ledger, rows);
  const failures = states.filter(({ state }) => state !== 'applied');
  if (failures.length) {
    throw new Error(`post-transform actions are not fully applied: ${failures[0].action.action_id}`);
  }
  const sourceRows = rows.filter((row) => row.reference === SOURCE_REFERENCE);
  if (sourceRows.length !== 2972) throw new Error(`unexpected source row count: ${sourceRows.length}`);
  if (sourceRows.some((row) => !row.plant_family || row.plant_name === '（リスト無し）')) {
    throw new Error('source rows still contain blank families or invalid placeholders');
  }
  if (sourceRows.some((row) => row.plant_name === 'ヤマタケタケアザミ')) {
    throw new Error('source rows still contain the OCR-corrupted plant name');
  }
}

const ledger = readLedger();
validateTaxa(ledger);
const original = fs.readFileSync(HOST_PATH, 'utf8');
const originalEolProfile = recordEolProfile(original);
const initialRows = toObjects(parseCsv(original));
const baselineRelationshipCounts = relationshipCounts(initialRows);
const states = classifyActions(ledger, initialRows);
const conflict = states.find(({ state }) => state === 'conflict');
if (conflict) throw new Error(`${conflict.action.action_id}: ${conflict.reason}`);

const pending = states.filter(({ state }) => state === 'pending');
const applied = states.filter(({ state }) => state === 'applied');
if (pending.length && applied.length) {
  throw new Error(`Partial audit state is not allowed: pending=${pending.length}, applied=${applied.length}`);
}
if (CHECK_ONLY) {
  if (originalEolProfile.mixed) throw new Error('hostplants.csv has mixed record separators');
  if (pending.length) throw new Error(`Audit has ${pending.length} pending actions`);
  validateResult(original, ledger, baselineRelationshipCounts);
  console.log(JSON.stringify({ mode: 'check', applied: applied.length, pending: 0 }, null, 2));
  process.exit(0);
}

if (!pending.length) {
  const output = originalEolProfile.mixed
    ? normalizeRecordEols(original, originalEolProfile.dominant)
    : original;
  validateResult(output, ledger, baselineRelationshipCounts);
  if (output !== original) {
    const temporary = `${HOST_PATH}.flower-moths-audit-${process.pid}.tmp`;
    fs.writeFileSync(temporary, output, 'utf8');
    fs.renameSync(temporary, HOST_PATH);
  }
  console.log(JSON.stringify({
    mode: 'apply',
    changed: 0,
    already_applied: applied.length,
    record_separators_normalized: output === original ? 0 : 1,
  }, null, 2));
  process.exit(0);
}

const output = transform(original, states);
validateResult(output, ledger, baselineRelationshipCounts);
const temporary = `${HOST_PATH}.flower-moths-audit-${process.pid}.tmp`;
fs.writeFileSync(temporary, output, 'utf8');
fs.renameSync(temporary, HOST_PATH);
console.log(JSON.stringify({
  mode: 'apply',
  changed: pending.length,
  additions: pending.filter(({ action }) => action.action === 'add_relationship').length,
  reassignments: pending.filter(({ action }) => action.action === 'reassign_insect').length,
  deletions: pending.filter(({ action }) => action.action === 'delete_invalid_placeholder').length,
  cell_repairs: pending.filter(({ action }) => ['replace_plant_name', 'set_plant_family'].includes(action.action)).length,
}, null, 2));

#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseCsv, serializeField, toObjects } from './lib/csvQuality.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_ROOT = process.env.HAMUSHI_HANDBOOK_DATA_ROOT
  ? path.resolve(process.env.HAMUSHI_HANDBOOK_DATA_ROOT)
  : ROOT;
const AUDIT_PATH = path.join(
  ROOT,
  'data/source_audits/hamushi-handbook-comprehensive-audit-2026-07-12.json',
);
const CANONICAL_MERGE_PATH = path.join(
  ROOT,
  'data/source_audits/leaf-beetle-canonical-taxonomy-merge-2026-07-12.json',
);
const PATHS = {
  hostplants: path.join(DATA_ROOT, 'normalized_data/hostplants.csv'),
  general_notes: path.join(DATA_ROOT, 'normalized_data/general_notes.csv'),
};
const CHECK_ONLY = process.argv.includes('--check');
const unknownArguments = process.argv.slice(2).filter((argument) => argument !== '--check');
if (unknownArguments.length) throw new Error(`Unknown arguments: ${unknownArguments.join(', ')}`);

const SOURCE = 'ハムシハンドブック';
const AUDIT_SHA256 = '54a9150178ce632cf8e3422ca6009c17f23168e0eb4eb82cc0d3c84a78e7d5e8';
const CANONICAL_MERGE_SHA256 = '54640b5efb70df438e1629871e36f5dfb8d57a4c2bea8536c149b3e1f25898a6';
const DOWNSTREAM_HOST_ACTION_IDS = Object.freeze([
  'LBCM-HOST-UPDATE-hostplant-hhb-audit-20260712-0100',
  'LBCM-HOST-UPDATE-hostplant-hhb-audit-20260712-0101',
  'LBCM-HOST-UPDATE-hostplant-hhb-audit-20260712-0102',
  'LBCM-HOST-UPDATE-hostplant-hhb-audit-20260712-0103',
]);
const EXPECTED = Object.freeze({
  sourceAccounts: 203,
  currentHostRows: 406,
  currentNoteRows: 270,
  hostActions: 156,
  noteActions: 280,
});
const ALLOWED_ACTIONS = Object.freeze({
  hostplants: new Set([
    'add_hostplant',
    'correct_host_spelling',
    'delete_source_spill',
    'move_hostplant',
    'update_geographic_scope',
  ]),
  general_notes: new Set([
    'add_general_note',
    'delete_synthetic_source_spill',
    'move_and_verify_general_note',
    'replace_general_note',
    'verify_general_note_provenance',
  ]),
});

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const plainRow = (row, columns) => Object.fromEntries(columns.map((column) => [column, row?.[column] ?? '']));
const equal = (left, right) => JSON.stringify(left) === JSON.stringify(right);

function readAudit() {
  const bytes = fs.readFileSync(AUDIT_PATH);
  const actualHash = sha256(bytes);
  if (actualHash !== AUDIT_SHA256) throw new Error(`Audit ledger SHA-256 mismatch: ${actualHash}`);
  const audit = JSON.parse(bytes);
  if (
    audit.source?.reference !== SOURCE
    || audit.source?.year !== 2014
    || audit.source?.original_files?.length !== 44
    || audit.counts?.source_accounts !== EXPECTED.sourceAccounts
    || audit.counts?.current_source_host_rows !== EXPECTED.currentHostRows
    || audit.counts?.current_source_note_rows !== EXPECTED.currentNoteRows
    || audit.host_actions?.length !== EXPECTED.hostActions
    || audit.note_actions?.length !== EXPECTED.noteActions
  ) throw new Error('Unexpected handbook audit identity or coverage profile');

  const actionGroups = {
    hostplants: audit.host_actions,
    general_notes: audit.note_actions,
  };
  const actionIds = new Set();
  for (const [tableName, actions] of Object.entries(actionGroups)) {
    const recordIds = new Set();
    for (const action of actions) {
      const recordId = action.before?.record_id ?? action.after?.record_id;
      if (!action.action_id || actionIds.has(action.action_id)) {
        throw new Error(`Invalid or duplicate action_id: ${action.action_id}`);
      }
      if (!recordId || recordIds.has(recordId)) {
        throw new Error(`Invalid or duplicate ${tableName} target: ${recordId}`);
      }
      if (!ALLOWED_ACTIONS[tableName].has(action.action)) {
        throw new Error(`${action.action_id}: unsupported action ${action.action}`);
      }
      if (
        action.table !== tableName
        || action.verification_status !== 'original_image_verified'
        || action.source?.reference !== SOURCE
        || !Number.isInteger(action.source?.printed_page)
        || action.source.printed_page < 12
        || action.source.printed_page > 99
        || !/^[a-f0-9]{64}$/u.test(action.source?.original_file_sha256 ?? '')
      ) throw new Error(`${action.action_id}: incomplete original-image evidence`);
      if (action.action.startsWith('add_') && (action.before !== null || !action.after)) {
        throw new Error(`${action.action_id}: invalid addition shape`);
      }
      if (action.action.startsWith('delete_') && (!action.before || action.after !== null)) {
        throw new Error(`${action.action_id}: invalid deletion shape`);
      }
      if (
        action.before
        && action.after
        && action.before.record_id !== action.after.record_id
      ) throw new Error(`${action.action_id}: stable record_id changed`);
      actionIds.add(action.action_id);
      recordIds.add(recordId);
    }
  }
  return { audit, actionGroups };
}

function readDownstreamCanonicalRows(actionGroups) {
  const bytes = fs.readFileSync(CANONICAL_MERGE_PATH);
  const actualHash = sha256(bytes);
  if (actualHash !== CANONICAL_MERGE_SHA256) {
    throw new Error(`Canonical-merge ledger SHA-256 mismatch: ${actualHash}`);
  }
  const audit = JSON.parse(bytes);
  if (
    audit.audit_name !== 'ハムシ科重複分類群の正準ID統合監査'
    || audit.counts?.mappings !== 13
    || audit.counts?.total_actions !== 48
  ) throw new Error('Unexpected downstream canonical-merge audit identity');

  const handbookAdditions = new Map(actionGroups.hostplants
    .filter(({ action }) => action === 'add_hostplant')
    .map((action) => [action.after.record_id, action.after]));
  const expectedActionIds = new Set(DOWNSTREAM_HOST_ACTION_IDS);
  const downstreamActions = audit.host_actions.filter(({ action_id: actionId }) => (
    expectedActionIds.has(actionId)
  ));
  if (
    downstreamActions.length !== expectedActionIds.size
    || downstreamActions.some(({ action_id: actionId }) => !expectedActionIds.has(actionId))
  ) throw new Error('Downstream handbook host merge coverage is incomplete');

  const downstreamAfterByRecord = new Map();
  for (const action of downstreamActions) {
    const recordId = action.before?.record_id;
    const handbookAfter = handbookAdditions.get(recordId);
    if (
      action.action !== 'merge_host_pair'
      || !handbookAfter
      || !equal(action.before, handbookAfter)
      || action.after?.record_id !== recordId
      || !String(action.after.reference || '').split(';').map((value) => value.trim()).includes(SOURCE)
    ) throw new Error(`${action.action_id}: invalid downstream handbook merge`);
    downstreamAfterByRecord.set(recordId, action.after);
  }
  return downstreamAfterByRecord;
}

function readTable(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const parsed = parseCsv(source);
  if (!parsed.header.includes('record_id')) throw new Error(`${path.basename(filePath)} is missing record_id`);
  const rows = toObjects(parsed);
  const byId = new Map();
  for (const row of rows) {
    if (!row.record_id || byId.has(row.record_id)) {
      throw new Error(`${path.basename(filePath)} has blank or duplicate record_id: ${row.record_id}`);
    }
    byId.set(row.record_id, row);
  }
  const separators = new Set(parsed.records.map((record) => record.eol).filter(Boolean));
  if (separators.size > 1) throw new Error(`${path.basename(filePath)} has mixed record separators`);
  return {
    filePath,
    source,
    parsed,
    rows,
    byId,
    eol: separators.values().next().value || '\n',
  };
}

function classifyAction(action, table, downstreamAfterByRecord) {
  const id = action.before?.record_id ?? action.after?.record_id;
  const current = table.byId.get(id);
  const before = action.before ? plainRow(action.before, table.parsed.header) : null;
  const after = action.after ? plainRow(action.after, table.parsed.header) : null;
  const actual = current ? plainRow(current, table.parsed.header) : null;
  if (!before) {
    if (!current) return { action, state: 'pending' };
    if (equal(actual, after)) return { action, state: 'applied' };
    const downstreamAfter = downstreamAfterByRecord.get(id);
    if (downstreamAfter && equal(actual, plainRow(downstreamAfter, table.parsed.header))) {
      return { action, state: 'applied_downstream' };
    }
    return { action, state: 'conflict', reason: `addition target ${id} collides` };
  }
  if (!after) {
    if (equal(actual, before)) return { action, state: 'pending' };
    if (!current) return { action, state: 'applied' };
    return { action, state: 'conflict', reason: `deletion target ${id} drifted` };
  }
  if (equal(actual, before)) return { action, state: 'pending' };
  if (equal(actual, after)) return { action, state: 'applied' };
  return { action, state: 'conflict', reason: `patch target ${id} drifted` };
}

function transformTable(table, pendingStates) {
  const indexes = Object.fromEntries(table.parsed.header.map((column, index) => [column, index]));
  const replacements = [];
  const additions = [];
  for (const { action } of pendingStates) {
    const id = action.before?.record_id ?? action.after?.record_id;
    const current = table.byId.get(id);
    if (!action.before) {
      additions.push(table.parsed.header.map((column) => serializeField(action.after[column] ?? '')).join(','));
      continue;
    }
    const record = current && table.parsed.records[current.__recordIndex];
    if (!record) throw new Error(`${action.action_id}: target disappeared during transform`);
    if (!action.after) {
      replacements.push({ start: record.start, end: record.end, value: '' });
      continue;
    }
    for (const column of table.parsed.header) {
      if ((action.before[column] ?? '') === (action.after[column] ?? '')) continue;
      const [start, end] = record.ranges[indexes[column]];
      replacements.push({ start, end, value: serializeField(action.after[column] ?? '') });
    }
  }
  replacements.sort((left, right) => right.start - left.start);
  let output = table.source;
  for (const replacement of replacements) {
    output = output.slice(0, replacement.start) + replacement.value + output.slice(replacement.end);
  }
  if (additions.length) {
    if (output && !output.endsWith('\n') && !output.endsWith('\r')) output += table.eol;
    output += `${additions.join(table.eol)}${table.eol}`;
  }
  return output;
}

function validateOutput(tableName, output, table, pendingStates) {
  const parsed = parseCsv(output);
  const rows = toObjects(parsed);
  const ids = new Set();
  for (const row of rows) {
    if (!row.record_id || ids.has(row.record_id)) {
      throw new Error(`${tableName} output has blank or duplicate record_id: ${row.record_id}`);
    }
    ids.add(row.record_id);
  }
  const sourceCount = rows.filter((row) => row.reference === SOURCE).length;
  const sourceCountBefore = table.rows.filter((row) => row.reference === SOURCE).length;
  const expected = sourceCountBefore + pendingStates.reduce((delta, { action }) => (
    delta
    + (action.after?.reference === SOURCE ? 1 : 0)
    - (action.before?.reference === SOURCE ? 1 : 0)
  ), 0);
  if (sourceCount !== expected) {
    throw new Error(`${tableName} source-row count mismatch: ${sourceCount} != ${expected}`);
  }
  return rows;
}

function atomicWrite(outputs) {
  const temporary = [];
  try {
    for (const [tableName, output] of Object.entries(outputs)) {
      const target = PATHS[tableName];
      const temp = `${target}.hamushi-handbook-${process.pid}.tmp`;
      fs.writeFileSync(temp, output, 'utf8');
      temporary.push([temp, target]);
    }
    for (const [temp, target] of temporary) fs.renameSync(temp, target);
  } finally {
    for (const [temp] of temporary) {
      if (fs.existsSync(temp)) fs.unlinkSync(temp);
    }
  }
}

const { actionGroups } = readAudit();
const downstreamAfterByRecord = readDownstreamCanonicalRows(actionGroups);
const tables = {
  hostplants: readTable(PATHS.hostplants),
  general_notes: readTable(PATHS.general_notes),
};
const states = [];
for (const [tableName, actions] of Object.entries(actionGroups)) {
  for (const action of actions) {
    states.push({
      tableName,
      ...classifyAction(action, tables[tableName], downstreamAfterByRecord),
    });
  }
}
const conflicts = states.filter((row) => row.state === 'conflict');
if (conflicts.length) {
  throw new Error(conflicts.map((row) => `${row.action.action_id}: ${row.reason}`).join('\n'));
}
const pending = states.filter((row) => row.state === 'pending');
const applied = states.filter((row) => ['applied', 'applied_downstream'].includes(row.state));
if (pending.length && applied.length) {
  throw new Error(`Partial audit state is not allowed: pending=${pending.length}, applied=${applied.length}`);
}

if (!pending.length) {
  const hasDownstreamRows = states.some(({ state }) => state === 'applied_downstream');
  console.log(JSON.stringify({
    state: hasDownstreamRows ? 'applied_downstream' : 'applied',
    changed: 0,
    ...(hasDownstreamRows ? {
      downstream_audit: path.relative(ROOT, CANONICAL_MERGE_PATH),
      downstream_rows: states.filter(({ state }) => state === 'applied_downstream').length,
    } : {}),
  }, null, 2));
  process.exit(0);
}

const outputs = {};
for (const tableName of Object.keys(tables)) {
  const pendingForTable = pending.filter((row) => row.tableName === tableName);
  outputs[tableName] = transformTable(
    tables[tableName],
    pendingForTable,
  );
  validateOutput(tableName, outputs[tableName], tables[tableName], pendingForTable);
}

if (CHECK_ONLY) {
  console.log(JSON.stringify({
    state: 'pending',
    would_change: true,
    changed: 0,
    action_counts: Object.fromEntries(Object.keys(tables).map((tableName) => [
      tableName,
      pending.filter((row) => row.tableName === tableName).length,
    ])),
  }, null, 2));
  process.exit(0);
}

atomicWrite(outputs);
console.log(JSON.stringify({
  state: 'applied',
  changed: pending.length,
  action_counts: Object.fromEntries(Object.keys(tables).map((tableName) => [
    tableName,
    pending.filter((row) => row.tableName === tableName).length,
  ])),
}, null, 2));

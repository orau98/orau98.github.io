#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseCsv, serializeField, toObjects } from './lib/csvQuality.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_ROOT = process.env.BUTTERFLY_GUIDE_DATA_ROOT
  ? path.resolve(process.env.BUTTERFLY_GUIDE_DATA_ROOT)
  : ROOT;
const AUDIT_PATH = path.join(
  ROOT,
  'data/source_audits/japanese-butterfly-guide-integrity-actions-2026-07-12.json',
);
const PATHS = {
  insects: path.join(DATA_ROOT, 'normalized_data/insects.csv'),
  hosts: path.join(DATA_ROOT, 'normalized_data/hostplants.csv'),
  notes: path.join(DATA_ROOT, 'normalized_data/general_notes.csv'),
};
const CHECK_ONLY = process.argv.includes('--check');
const unknownArguments = process.argv.slice(2).filter((argument) => argument !== '--check');
if (unknownArguments.length) throw new Error(`Unknown arguments: ${unknownArguments.join(', ')}`);

const SOURCE = '日本産蝶類標準図鑑';
const PDF_SHA256 = '910e84199b94a18ab81071d5c7019655b20c03589eb1e8fbd7d668414eba0c5c';
const AUDIT_SHA256 = '86f9795212cb5eee4c32cd6d9d7932691647158e47aaedf5cfbeec420def0bd9';
const EXPECTED_COUNTS = Object.freeze({
  sourceAccounts: 274,
  currentTaxa: 270,
  nameActions: 21,
  newTaxonActions: 4,
  hostActions: 49,
  noteActions: 38,
  hostRowsAfter: 1719,
  noteRowsAfter: 250,
});
const ALLOWED_ACTIONS = Object.freeze({
  insects: new Set(['update_insect_japanese_name', 'add_insect_taxon']),
  hosts: new Set(['add_hostplant', 'delete_unsupported_hold', 'merge_duplicate', 'move_hostplant']),
  notes: new Set([
    'add_general_note',
    'delete_duplicate_spill',
    'delete_non_biological_date_spill',
    'delete_unsupported_hold',
    'move_general_note',
    'replace_general_note',
    'update_general_note_page',
  ]),
});

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const plainRow = (row, columns) => Object.fromEntries(columns.map((column) => [column, row?.[column] ?? '']));
const equal = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const scientificKey = (row) => `${String(row.genus ?? '').trim().toLowerCase()}\u0000${String(row.species ?? '').trim().toLowerCase()}`;

function countByAction(actions) {
  const result = {};
  for (const action of actions) result[action.action] = (result[action.action] || 0) + 1;
  return result;
}

function readAudit() {
  const bytes = fs.readFileSync(AUDIT_PATH);
  const actualHash = sha256(bytes);
  if (actualHash !== AUDIT_SHA256) throw new Error(`Audit ledger SHA-256 mismatch: ${actualHash}`);
  const audit = JSON.parse(bytes);
  if (
    audit.schema_version !== 1
    || audit.generated_at !== '2026-07-12'
    || audit.source?.reference !== SOURCE
    || audit.source?.pdf_pages !== 170
    || audit.source?.audited_main_account_pdf_pages !== '11-164'
    || audit.source?.pdf_sha256 !== PDF_SHA256
    || !audit.source?.evidence_policy?.includes('original page image')
  ) {
    throw new Error('Unexpected butterfly-guide source identity or evidence policy');
  }
  const counts = audit.counts || {};
  if (
    counts.source_accounts !== EXPECTED_COUNTS.sourceAccounts
    || counts.current_taxa !== EXPECTED_COUNTS.currentTaxa
    || counts.name_actions !== EXPECTED_COUNTS.nameActions
    || counts.new_taxon_actions !== EXPECTED_COUNTS.newTaxonActions
    || counts.host_actions !== EXPECTED_COUNTS.hostActions
    || counts.note_actions !== EXPECTED_COUNTS.noteActions
  ) throw new Error('Unexpected butterfly-guide audit coverage profile');

  const actionGroups = {
    insects: [...audit.name_actions, ...audit.new_taxon_actions],
    hosts: audit.host_actions,
    notes: audit.note_actions,
  };
  const actionIds = new Set();
  for (const [tableName, actions] of Object.entries(actionGroups)) {
    if (!Array.isArray(actions)) throw new Error(`Missing ${tableName} actions`);
    const recordIds = new Set();
    for (const action of actions) {
      const recordId = action.before?.record_id
        ?? action.after?.record_id
        ?? action.before?.insect_id
        ?? action.after?.insect_id;
      if (!action.action_id || actionIds.has(action.action_id)) {
        throw new Error(`Invalid or duplicate action_id: ${action.action_id}`);
      }
      if (!recordId || recordIds.has(recordId)) throw new Error(`Duplicate ${tableName} target: ${recordId}`);
      if (!ALLOWED_ACTIONS[tableName].has(action.action)) {
        throw new Error(`${action.action_id}: unsupported action ${action.action}`);
      }
      if (
        action.verification_status !== 'original_image_verified'
        || action.source?.reference !== SOURCE
        || action.source?.pdf_sha256 !== PDF_SHA256
        || !Number.isInteger(action.source?.pdf_page)
      ) throw new Error(`${action.action_id}: incomplete original-image evidence`);
      if (action.action.startsWith('add_') && (action.before !== null || !action.after)) {
        throw new Error(`${action.action_id}: invalid addition shape`);
      }
      if ((action.action.startsWith('delete_') || action.action === 'merge_duplicate') && (!action.before || action.after !== null)) {
        throw new Error(`${action.action_id}: invalid deletion shape`);
      }
      if (action.before && action.after && (action.before.record_id ?? action.before.insect_id) !== (action.after.record_id ?? action.after.insect_id)) {
        throw new Error(`${action.action_id}: stable identifier changed`);
      }
      actionIds.add(action.action_id);
      recordIds.add(recordId);
    }
  }
  const hostCounts = countByAction(actionGroups.hosts);
  const noteCounts = countByAction(actionGroups.notes);
  if (
    hostCounts.add_hostplant !== 43
    || hostCounts.delete_unsupported_hold !== 3
    || hostCounts.merge_duplicate !== 1
    || hostCounts.move_hostplant !== 2
    || noteCounts.add_general_note !== 5
    || noteCounts.delete_unsupported_hold !== 6
    || Object.values(noteCounts).reduce((sum, count) => sum + count, 0) !== EXPECTED_COUNTS.noteActions
  ) throw new Error('Unexpected butterfly-guide action profile');
  for (const action of actionGroups.hosts.filter(({ action }) => action === 'add_hostplant')) {
    if (
      !action.after.plant_name
      || !action.after.plant_family
      || action.after.reference !== SOURCE
      || action.after.observation_type !== '文献'
      || action.after.life_stage !== '幼虫'
    ) throw new Error(`${action.action_id}: incomplete approved host relationship`);
  }
  return { audit, actionGroups };
}

function readTable(filePath, idColumn) {
  const source = fs.readFileSync(filePath, 'utf8');
  const parsed = parseCsv(source);
  if (!parsed.header.includes(idColumn)) throw new Error(`${path.basename(filePath)} is missing ${idColumn}`);
  const rows = toObjects(parsed);
  const byId = new Map();
  for (const row of rows) {
    const id = row[idColumn];
    if (!id || byId.has(id)) throw new Error(`${path.basename(filePath)} has blank or duplicate ${idColumn}: ${id}`);
    byId.set(id, row);
  }
  const separators = new Set(parsed.records.map((record) => record.eol).filter(Boolean));
  if (separators.size > 1) throw new Error(`${path.basename(filePath)} has mixed record separators`);
  return {
    filePath,
    idColumn,
    source,
    parsed,
    rows,
    byId,
    eol: separators.values().next().value || '\n',
  };
}

function classifyAction(action, table) {
  const id = action.before?.[table.idColumn] ?? action.after?.[table.idColumn];
  const current = table.byId.get(id);
  const before = action.before ? plainRow(action.before, table.parsed.header) : null;
  const after = action.after ? plainRow(action.after, table.parsed.header) : null;
  const actual = current ? plainRow(current, table.parsed.header) : null;
  if (!before) {
    if (!current) return { action, state: 'pending' };
    if (equal(actual, after)) return { action, state: 'applied' };
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

function classifyAll(actionGroups, tables) {
  const result = [];
  for (const tableName of Object.keys(actionGroups)) {
    for (const action of actionGroups[tableName]) {
      result.push({ tableName, ...classifyAction(action, tables[tableName]) });
    }
  }
  return result;
}

function transformTable(table, pendingStates) {
  const indexes = Object.fromEntries(table.parsed.header.map((column, index) => [column, index]));
  const replacements = [];
  const additions = [];
  for (const { action } of pendingStates) {
    const id = action.before?.[table.idColumn] ?? action.after?.[table.idColumn];
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
      const fieldIndex = indexes[column];
      const [start, end] = record.ranges[fieldIndex];
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

function tablesFromOutputs(outputs) {
  const tables = {};
  for (const [tableName, output] of Object.entries(outputs)) {
    const original = tableName === 'insects'
      ? { filePath: PATHS.insects, idColumn: 'insect_id' }
      : tableName === 'hosts'
        ? { filePath: PATHS.hosts, idColumn: 'record_id' }
        : { filePath: PATHS.notes, idColumn: 'record_id' };
    const parsed = parseCsv(output);
    const rows = toObjects(parsed);
    const byId = new Map();
    for (const row of rows) {
      const id = row[original.idColumn];
      if (!id || byId.has(id)) throw new Error(`${tableName} output has blank or duplicate ID: ${id}`);
      byId.set(id, row);
    }
    tables[tableName] = { ...original, source: output, parsed, rows, byId };
  }
  return tables;
}

function validateResult(outputs, actionGroups) {
  const tables = tablesFromOutputs(outputs);
  const remaining = classifyAll(actionGroups, tables).find(({ state }) => state !== 'applied');
  if (remaining) throw new Error(`${remaining.action.action_id}: prospective output is not fully applied`);

  for (const action of actionGroups.insects.filter(({ action }) => action === 'add_insect_taxon')) {
    const key = scientificKey(action.after);
    const matches = tables.insects.rows.filter((row) => scientificKey(row) === key);
    if (matches.length !== 1 || matches[0].insect_id !== action.after.insect_id) {
      throw new Error(`${action.action_id}: new scientific binomial collides`);
    }
  }
  for (const row of [...tables.hosts.rows, ...tables.notes.rows]) {
    if (!tables.insects.byId.has(row.insect_id)) throw new Error(`orphan relationship: ${row.record_id} -> ${row.insect_id}`);
  }
  const sourceHosts = tables.hosts.rows.filter((row) => row.reference === SOURCE);
  const sourceNotes = tables.notes.rows.filter((row) => row.reference === SOURCE);
  if (sourceHosts.length !== EXPECTED_COUNTS.hostRowsAfter) {
    throw new Error(`unexpected approved host count: ${sourceHosts.length}`);
  }
  if (sourceNotes.length !== EXPECTED_COUNTS.noteRowsAfter) {
    throw new Error(`unexpected approved note count: ${sourceNotes.length}`);
  }
  for (const action of actionGroups.hosts.filter(({ action }) => action === 'add_hostplant')) {
    const row = tables.hosts.byId.get(action.after.record_id);
    if (!row?.plant_name || !row?.plant_family) {
      throw new Error(`${action.action_id}: added host has a blank plant name or family`);
    }
  }
  for (const removedId of ['note-1005003', 'note-1005122', 'note-1005017', 'note-1005137', 'note-1005105', 'note-1005110']) {
    if (tables.notes.byId.has(removedId)) throw new Error(`unsafe held note remains public-ready: ${removedId}`);
  }
  return tables;
}

function writeAllAtomically(outputs) {
  const entries = Object.entries(outputs).filter(([tableName, output]) => {
    const target = PATHS[tableName];
    return fs.readFileSync(target, 'utf8') !== output;
  });
  if (!entries.length) return;
  const staged = [];
  const backups = [];
  try {
    for (const [tableName, output] of entries) {
      const target = PATHS[tableName];
      const temporary = `${target}.butterfly-audit-${process.pid}.tmp`;
      fs.writeFileSync(temporary, output, 'utf8');
      staged.push({ tableName, target, temporary });
    }
    for (const item of staged) {
      const backup = `${item.target}.butterfly-audit-${process.pid}.bak`;
      fs.renameSync(item.target, backup);
      backups.push({ target: item.target, backup });
      fs.renameSync(item.temporary, item.target);
    }
    for (const { backup } of backups) fs.unlinkSync(backup);
  } catch (error) {
    for (const { target, backup } of backups.reverse()) {
      if (fs.existsSync(target)) fs.unlinkSync(target);
      if (fs.existsSync(backup)) fs.renameSync(backup, target);
    }
    for (const { temporary } of staged) if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    throw error;
  }
}

const { actionGroups } = readAudit();
const tables = {
  insects: readTable(PATHS.insects, 'insect_id'),
  hosts: readTable(PATHS.hosts, 'record_id'),
  notes: readTable(PATHS.notes, 'record_id'),
};
const states = classifyAll(actionGroups, tables);
const conflict = states.find(({ state }) => state === 'conflict');
if (conflict) throw new Error(`${conflict.action.action_id}: ${conflict.reason}`);
const pending = states.filter(({ state }) => state === 'pending');
const applied = states.filter(({ state }) => state === 'applied');
if (pending.length && applied.length) {
  throw new Error(`Partial audit state is not allowed: pending=${pending.length}, applied=${applied.length}`);
}

const outputs = Object.fromEntries(Object.entries(tables).map(([tableName, table]) => [
  tableName,
  transformTable(table, pending.filter((state) => state.tableName === tableName)),
]));
validateResult(outputs, actionGroups);

if (!CHECK_ONLY) writeAllAtomically(outputs);
console.log(JSON.stringify({
  mode: CHECK_ONLY ? 'check' : 'apply',
  state: pending.length ? 'pending' : 'applied',
  changed: CHECK_ONLY ? 0 : pending.length,
  would_change: pending.length > 0,
  pending: pending.length,
  already_applied: applied.length,
  action_counts: {
    insects: actionGroups.insects.length,
    hosts: actionGroups.hosts.length,
    notes: actionGroups.notes.length,
  },
}, null, 2));

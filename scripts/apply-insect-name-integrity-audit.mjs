#!/usr/bin/env node
// 昆虫の重複ID統合と和名欄の修復（2026-10-02）を normalized_data の3つのCSVへ適用する。
//
// 台帳: data/source_audits/insect-name-integrity-2026-10-02.json
// - insect_actions: 重複IDの削除、和名欄の修復（before/after の全列）
// - host_actions / note_actions: 重複IDの食草・備考を正規IDへ移す（完全重複は削除）
//
// 各行は before と完全一致するときだけ書き換え、after と一致すれば適用済みとして扱う。
// どちらでもない行が1つでもあれば、何も書かずに止まる。再適用してもバイト列は変わらない。
//   node scripts/apply-insect-name-integrity-audit.mjs --check   # 書き込まずに検証
//   node scripts/apply-insect-name-integrity-audit.mjs           # 適用
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseCsv, serializeField, toObjects } from './lib/csvQuality.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_ROOT = process.env.INSECT_NAME_INTEGRITY_DATA_ROOT
  ? path.resolve(process.env.INSECT_NAME_INTEGRITY_DATA_ROOT)
  : ROOT;
const AUDIT_PATH = path.join(
  ROOT,
  'data/source_audits/insect-name-integrity-2026-10-02.json',
);
const PATHS = {
  insects: path.join(DATA_ROOT, 'normalized_data/insects.csv'),
  hosts: path.join(DATA_ROOT, 'normalized_data/hostplants.csv'),
  notes: path.join(DATA_ROOT, 'normalized_data/general_notes.csv'),
};
const ID_COLUMNS = { insects: 'insect_id', hosts: 'record_id', notes: 'record_id' };
const ALLOWED_ACTIONS = {
  insects: new Set(['delete_duplicate_taxon', 'update_japanese_name', 'update_old_japanese_name', 'update_other_names']),
  hosts: new Set(['move_host_relationship', 'delete_merged_host_duplicate']),
  notes: new Set(['move_general_note', 'delete_merged_note_duplicate']),
};
// 「(新称)」を残す行（外すと別属と同名になるため、原本で確かめるまで据え置き）
const NEW_NAME_ANNOTATION_KEPT = new Set(['species-21076']);

const CHECK_ONLY = process.argv.includes('--check');
const unknownArguments = process.argv.slice(2).filter((argument) => argument !== '--check');
if (unknownArguments.length) throw new Error(`Unknown arguments: ${unknownArguments.join(', ')}`);

const plainRow = (row, columns) => Object.fromEntries(columns.map((column) => [column, row?.[column] ?? '']));
const equalRows = (left, right) => JSON.stringify(left) === JSON.stringify(right);

function readAudit() {
  const audit = JSON.parse(fs.readFileSync(AUDIT_PATH, 'utf8'));
  const groups = { insects: audit.insect_actions, hosts: audit.host_actions, notes: audit.note_actions };
  if (
    audit.schema_version !== 1
    || audit.audit_name !== '昆虫の重複ID統合と和名欄の修復'
    || audit.reviewed_on !== '2026-10-02'
    || !Array.isArray(audit.merges)
    || !Array.isArray(audit.renames)
    || audit.counts?.merges !== audit.merges.length
    || audit.counts?.renames !== audit.renames.length
    || audit.counts?.insect_actions !== groups.insects?.length
    || audit.counts?.host_actions !== groups.hosts?.length
    || audit.counts?.note_actions !== groups.notes?.length
  ) throw new Error('Unexpected insect name-integrity audit identity or counts');

  const actionIds = new Set();
  for (const [tableName, actions] of Object.entries(groups)) {
    const idColumn = ID_COLUMNS[tableName];
    const targets = new Set();
    for (const action of actions) {
      const id = action.before?.[idColumn];
      if (!action.action_id || actionIds.has(action.action_id)) throw new Error(`Invalid action_id: ${action.action_id}`);
      if (!ALLOWED_ACTIONS[tableName].has(action.action)) throw new Error(`${action.action_id}: unsupported action ${action.action}`);
      if (!id || targets.has(id)) throw new Error(`${action.action_id}: missing or repeated target ${id}`);
      if (action.action.startsWith('delete_') !== (action.after === null)) {
        throw new Error(`${action.action_id}: deletion shape does not match the action`);
      }
      if (action.after && action.after[idColumn] !== id) throw new Error(`${action.action_id}: stable identifier changed`);
      actionIds.add(action.action_id);
      targets.add(id);
    }
  }

  const deletions = new Set(groups.insects
    .filter(({ action }) => action === 'delete_duplicate_taxon')
    .map(({ before }) => before.insect_id));
  const merged = new Set(audit.merges.map(({ duplicate_id: duplicateId }) => duplicateId));
  if (deletions.size !== merged.size || [...merged].some((id) => !deletions.has(id))) {
    throw new Error('Duplicate deletions do not match the merge list exactly');
  }
  for (const { duplicate_id: duplicateId, canonical_id: canonicalId } of audit.merges) {
    if (merged.has(canonicalId)) throw new Error(`Canonical ID is itself merged away: ${canonicalId}`);
    for (const action of [...groups.hosts, ...groups.notes]) {
      if (action.before.insect_id === duplicateId && action.after && action.after.insect_id !== canonicalId) {
        throw new Error(`${action.action_id}: relationship moves to an unexpected insect`);
      }
    }
  }
  return { audit, groups, deletions };
}

function readTable(filePath, idColumn) {
  const source = fs.readFileSync(filePath, 'utf8');
  return tableFromSource(source, idColumn, path.basename(filePath));
}

function tableFromSource(source, idColumn, label) {
  const parsed = parseCsv(source);
  if (!parsed.header.includes(idColumn)) throw new Error(`${label} lacks ${idColumn}`);
  const rows = toObjects(parsed);
  const byId = new Map();
  for (const row of rows) {
    const id = row[idColumn];
    if (!id || byId.has(id)) throw new Error(`${label} has a blank or duplicate ${idColumn}: ${id}`);
    byId.set(id, row);
  }
  return { source, parsed, rows, byId, idColumn };
}

function classify(action, table) {
  const id = action.before[table.idColumn];
  const current = table.byId.get(id);
  const actual = current ? plainRow(current, table.parsed.header) : null;
  const before = plainRow(action.before, table.parsed.header);
  if (actual && equalRows(actual, before)) return 'pending';
  if (action.after === null) return current ? 'conflict' : 'applied';
  if (actual && equalRows(actual, plainRow(action.after, table.parsed.header))) return 'applied';
  return 'conflict';
}

function transform(table, actions) {
  const indexes = Object.fromEntries(table.parsed.header.map((column, index) => [column, index]));
  const replacements = [];
  for (const action of actions) {
    const current = table.byId.get(action.before[table.idColumn]);
    const record = table.parsed.records[current.__recordIndex];
    if (action.after === null) {
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
  for (const { start, end, value } of replacements) {
    output = output.slice(0, start) + value + output.slice(end);
  }
  return output;
}

function validateResult(outputs, groups, deletions) {
  const tables = Object.fromEntries(Object.entries(outputs).map(([tableName, source]) => [
    tableName,
    tableFromSource(source, ID_COLUMNS[tableName], tableName),
  ]));
  for (const [tableName, actions] of Object.entries(groups)) {
    const unapplied = actions.find((action) => classify(action, tables[tableName]) !== 'applied');
    if (unapplied) throw new Error(`${unapplied.action_id}: prospective output is not fully applied`);
  }
  for (const id of deletions) {
    if (tables.insects.byId.has(id)) throw new Error(`Merged duplicate remains: ${id}`);
  }
  for (const row of [...tables.hosts.rows, ...tables.notes.rows]) {
    if (deletions.has(row.insect_id)) throw new Error(`Relationship still points to a merged ID: ${row.record_id}`);
  }
  for (const row of tables.insects.rows) {
    const isAphid = row.family === 'Aphididae' || row.family_jp.includes('アブラムシ');
    if (isAphid && /^\d{4}\)$/.test(row.japanese_name)) {
      throw new Error(`Author-year fragment remains in japanese_name: ${row.insect_id}`);
    }
    if (isAphid && row.japanese_name && !/[ぁ-んァ-ヶ一-龠]/.test(row.japanese_name)) {
      throw new Error(`Scientific name remains in japanese_name: ${row.insect_id}`);
    }
    if (row.japanese_name.includes('新称') && !NEW_NAME_ANNOTATION_KEPT.has(row.insect_id)) {
      throw new Error(`New-name annotation remains in japanese_name: ${row.insect_id}`);
    }
  }
}

function writeAllAtomically(outputs) {
  const entries = Object.entries(outputs).filter(([tableName, output]) => (
    fs.readFileSync(PATHS[tableName], 'utf8') !== output
  ));
  const staged = [];
  const backups = [];
  try {
    for (const [tableName, output] of entries) {
      const temporary = `${PATHS[tableName]}.name-integrity-${process.pid}.tmp`;
      fs.writeFileSync(temporary, output, 'utf8');
      staged.push({ target: PATHS[tableName], temporary });
    }
    for (const { target, temporary } of staged) {
      const backup = `${target}.name-integrity-${process.pid}.bak`;
      fs.renameSync(target, backup);
      backups.push({ target, backup });
      fs.renameSync(temporary, target);
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

const { groups, deletions } = readAudit();
const tables = Object.fromEntries(Object.entries(PATHS).map(([tableName, filePath]) => [
  tableName,
  readTable(filePath, ID_COLUMNS[tableName]),
]));
const states = Object.entries(groups).flatMap(([tableName, actions]) => actions.map((action) => ({
  tableName,
  action,
  state: classify(action, tables[tableName]),
})));
const conflict = states.find(({ state }) => state === 'conflict');
if (conflict) throw new Error(`${conflict.action.action_id}: precondition mismatch (row drifted from before/after)`);
const pending = states.filter(({ state }) => state === 'pending');
const applied = states.filter(({ state }) => state === 'applied');
if (pending.length && applied.length) {
  throw new Error(`Partial audit state is not allowed: pending=${pending.length}, applied=${applied.length}`);
}
const outputs = Object.fromEntries(Object.entries(tables).map(([tableName, table]) => [
  tableName,
  transform(table, pending.filter((state) => state.tableName === tableName).map(({ action }) => action)),
]));
validateResult(outputs, groups, deletions);
if (!CHECK_ONLY && pending.length) writeAllAtomically(outputs);
console.log(JSON.stringify({
  mode: CHECK_ONLY ? 'check' : 'apply',
  state: pending.length ? 'pending' : 'applied',
  would_change: pending.length > 0,
  changed: CHECK_ONLY ? 0 : pending.length,
  action_counts: Object.fromEntries(Object.entries(groups).map(([tableName, actions]) => [tableName, actions.length])),
}, null, 2));

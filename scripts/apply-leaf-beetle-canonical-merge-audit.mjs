#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseCsv, serializeField, toObjects } from './lib/csvQuality.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_ROOT = process.env.LEAF_BEETLE_CANONICAL_DATA_ROOT
  ? path.resolve(process.env.LEAF_BEETLE_CANONICAL_DATA_ROOT)
  : ROOT;
const AUDIT_PATH = path.join(
  ROOT,
  'data/source_audits/leaf-beetle-canonical-taxonomy-merge-2026-07-12.json',
);
const AUDIT_SHA256 = '54640b5efb70df438e1629871e36f5dfb8d57a4c2bea8536c149b3e1f25898a6';
const PATHS = {
  insects: path.join(DATA_ROOT, 'normalized_data/insects.csv'),
  hosts: path.join(DATA_ROOT, 'normalized_data/hostplants.csv'),
  notes: path.join(DATA_ROOT, 'normalized_data/general_notes.csv'),
};
const CHECK_ONLY = process.argv.includes('--check');
const unknownArguments = process.argv.slice(2).filter((argument) => argument !== '--check');
if (unknownArguments.length) throw new Error(`Unknown arguments: ${unknownArguments.join(', ')}`);

const EXPECTED_MAPPINGS = Object.freeze([
  ['species-H798', 'species-H001'],
  ['species-H801', 'species-H017'],
  ['species-H803', 'species-H019'],
  ['species-H808', 'species-H032'],
  ['species-H033', 'species-H032'],
  ['species-H810', 'species-H044'],
  ['species-H813', 'species-H048'],
  ['species-H818', 'species-H063'],
  ['species-H819', 'species-H064'],
  ['species-H830', 'species-H096'],
  ['species-H841', 'species-H132'],
  ['species-H842', 'species-H137'],
  ['species-H676', 'species-H089'],
]);
const EXPECTED_COUNTS = Object.freeze({ insects: 27, hosts: 20, notes: 1, total: 48 });
const ALLOWED_ACTIONS = Object.freeze({
  insects: new Set([
    'update_canonical_search_names',
    'update_verified_japanese_name',
    'delete_duplicate_taxon',
  ]),
  hosts: new Set(['merge_host_pair', 'move_host_relationship', 'delete_merged_host_duplicate']),
  notes: new Set(['move_general_note']),
});

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const plainRow = (row, columns) => Object.fromEntries(columns.map((column) => [column, row?.[column] ?? '']));
const equal = (left, right) => JSON.stringify(left) === JSON.stringify(right);

function readAudit() {
  const bytes = fs.readFileSync(AUDIT_PATH);
  const actualHash = sha256(bytes);
  if (actualHash !== AUDIT_SHA256) throw new Error(`Audit ledger SHA-256 mismatch: ${actualHash}`);
  const audit = JSON.parse(bytes);
  const mappings = audit.mappings.map(({ duplicate_id, canonical_id }) => [duplicate_id, canonical_id]);
  if (
    audit.schema_version !== 1
    || audit.generated_at !== '2026-07-12'
    || audit.audit_name !== 'ハムシ科重複分類群の正準ID統合監査'
    || audit.scope?.public_data_modified !== false
    || JSON.stringify(mappings) !== JSON.stringify(EXPECTED_MAPPINGS)
    || audit.counts?.mappings !== 13
    || audit.counts?.canonical_search_name_updates !== 12
    || audit.counts?.duplicate_taxon_deletions !== 13
    || audit.counts?.canonical_merge_insect_actions !== 25
    || audit.counts?.verified_name_actions !== 2
    || audit.counts?.insect_actions !== EXPECTED_COUNTS.insects
    || audit.counts?.host_actions !== EXPECTED_COUNTS.hosts
    || audit.counts?.note_actions !== EXPECTED_COUNTS.notes
    || audit.counts?.total_actions !== EXPECTED_COUNTS.total
    || audit.counts?.h808_hosts_verified !== 7
    || audit.counts?.h808_notes_verified !== 1
  ) throw new Error('Unexpected canonical-merge audit identity or coverage profile');
  if (!audit.protected_exclusions.some(({ value }) => value === 'Hemipyxis hegenagae')) {
    throw new Error('The fabricated Hemipyxis spelling is not explicitly excluded');
  }
  const actionGroups = {
    insects: audit.insect_actions,
    hosts: audit.host_actions,
    notes: audit.note_actions,
  };
  const actionIds = new Set();
  for (const [tableName, actions] of Object.entries(actionGroups)) {
    const recordIds = new Set();
    for (const action of actions) {
      const idColumn = tableName === 'insects' ? 'insect_id' : 'record_id';
      const recordId = action.before?.[idColumn] ?? action.after?.[idColumn];
      if (!action.action_id || actionIds.has(action.action_id)) throw new Error(`Invalid action_id: ${action.action_id}`);
      if (!recordId || recordIds.has(recordId)) throw new Error(`Duplicate ${tableName} target: ${recordId}`);
      if (!ALLOWED_ACTIONS[tableName].has(action.action)) throw new Error(`Unsupported action: ${action.action}`);
      const expectedVerification = action.action === 'update_verified_japanese_name'
        ? 'original_pdf_page_verified'
        : 'cross_source_taxonomy_verified';
      if (action.verification_status !== expectedVerification) {
        throw new Error(`${action.action_id}: missing verification status`);
      }
      if (action.action === 'update_verified_japanese_name') {
        const expectedNameEvidence = {
          'species-H806': {
            japaneseName: 'オキナワツブノミハムシ',
            reference: '日本産ハムシ科生態覚書 (6)',
            printedPage: 37,
            pdfPage: 39,
          },
          'species-H933': {
            japaneseName: 'セアカケブカハムシ',
            reference: 'ハムシハンドブック',
            printedPage: 38,
          },
        }[action.before?.insect_id];
        if (
          !expectedNameEvidence
          || action.before?.japanese_name !== ''
          || action.after?.japanese_name !== expectedNameEvidence.japaneseName
          || action.source?.reference !== expectedNameEvidence.reference
          || action.source?.printed_page !== expectedNameEvidence.printedPage
          || (expectedNameEvidence.pdfPage && action.source?.pdf_page !== expectedNameEvidence.pdfPage)
        ) throw new Error(`${action.action_id}: unexpected original-PDF name evidence`);
      }
      if (!action.before) throw new Error(`${action.action_id}: additions are not permitted`);
      if (action.action.startsWith('delete_') && action.after !== null) {
        throw new Error(`${action.action_id}: invalid deletion shape`);
      }
      if (!action.action.startsWith('delete_') && !action.after) {
        throw new Error(`${action.action_id}: missing after row`);
      }
      if (action.before && action.after && action.before[idColumn] !== action.after[idColumn]) {
        throw new Error(`${action.action_id}: stable record identifier changed`);
      }
      actionIds.add(action.action_id);
      recordIds.add(recordId);
    }
  }
  const fabricated = actionGroups.insects
    .filter(({ action }) => action === 'update_canonical_search_names')
    .some(({ after }) => /hegenagae/i.test(after.synonyms));
  if (fabricated) throw new Error('Fabricated Hemipyxis hegenagae leaked into synonyms');
  const expectedCanonicalIds = new Set(EXPECTED_MAPPINGS.map(([, canonicalId]) => canonicalId));
  const expectedDuplicateIds = new Set(EXPECTED_MAPPINGS.map(([duplicateId]) => duplicateId));
  const canonicalPatchIds = new Set(actionGroups.insects
    .filter(({ action }) => action === 'update_canonical_search_names')
    .map(({ after }) => after.insect_id));
  const deletedDuplicateIds = new Set(actionGroups.insects
    .filter(({ action }) => action === 'delete_duplicate_taxon')
    .map(({ before }) => before.insect_id));
  if (
    canonicalPatchIds.size !== expectedCanonicalIds.size
    || [...expectedCanonicalIds].some((id) => !canonicalPatchIds.has(id))
    || deletedDuplicateIds.size !== expectedDuplicateIds.size
    || [...expectedDuplicateIds].some((id) => !deletedDuplicateIds.has(id))
  ) throw new Error('Canonical search-name updates and duplicate deletions do not cover the mapping graph exactly');
  const h032Action = actionGroups.insects.find(({ action_id: actionId }) => (
    actionId === 'LBCM-INSECT-UPDATE-species-H032'
  ));
  const argopistesEvidenceActions = actionGroups.insects.filter(({ action_id: actionId }) => [
    'LBCM-INSECT-UPDATE-species-H032',
    'LBCM-INSECT-DELETE-species-H033',
    'LBCM-INSECT-DELETE-species-H808',
  ].includes(actionId));
  if (
    audit.scope?.primary_taxonomy_evidence?.[0]?.doi !== '10.3897/zookeys.1215.134871'
    || argopistesEvidenceActions.length !== 3
    || argopistesEvidenceActions.some(({ source }) => source?.doi !== '10.3897/zookeys.1215.134871')
    || h032Action?.after?.tribe_jp !== 'ノミハムシ族'
    || !h032Action?.after?.changes_since_standard?.includes('新参異名')
    || !h032Action?.after?.notes?.includes('10.3897/zookeys.1215.134871')
    || h032Action?.compatible_predecessor_before?.tribe_jp !== ''
  ) throw new Error('Argopistes primary-taxonomy evidence or retained metadata is incomplete');
  const predecessor = audit.scope?.compatible_applied_predecessor;
  if (
    predecessor?.audit_sha256 !== 'a210b266464e8eee6825a13e62e98b87526d8c470178dd946385ad6a9e6a6608'
    || predecessor?.unchanged_applied_action_count !== 46
    || JSON.stringify(predecessor?.transition_action_ids) !== JSON.stringify([
      'LBCM-INSECT-UPDATE-species-H032',
      'LBCM-INSECT-DELETE-species-H033',
    ])
  ) throw new Error('Unexpected compatible predecessor declaration');
  return { audit, actionGroups };
}

function readTable(filePath, idColumn) {
  const source = fs.readFileSync(filePath, 'utf8');
  const parsed = parseCsv(source);
  if (!parsed.header.includes(idColumn)) throw new Error(`${path.basename(filePath)} lacks ${idColumn}`);
  const rows = toObjects(parsed);
  const byId = new Map();
  for (const row of rows) {
    const id = row[idColumn];
    if (!id || byId.has(id)) throw new Error(`${path.basename(filePath)} has blank/duplicate ${idColumn}: ${id}`);
    byId.set(id, row);
  }
  const separators = new Set(parsed.records.map((record) => record.eol).filter(Boolean));
  if (separators.size > 1) throw new Error(`${path.basename(filePath)} has mixed record separators`);
  return { filePath, idColumn, source, parsed, rows, byId, eol: separators.values().next().value || '\n' };
}

function classifyAction(action, table) {
  const id = action.before?.[table.idColumn] ?? action.after?.[table.idColumn];
  const current = table.byId.get(id);
  const before = plainRow(action.before, table.parsed.header);
  const after = action.after ? plainRow(action.after, table.parsed.header) : null;
  const compatiblePredecessorBefore = action.compatible_predecessor_before
    ? plainRow(action.compatible_predecessor_before, table.parsed.header)
    : null;
  const actual = current ? plainRow(current, table.parsed.header) : null;
  if (!after) {
    if (equal(actual, before)) return { action, state: 'pending' };
    if (!current) return { action, state: 'applied' };
    return { action, state: 'conflict', reason: `deletion target ${id} drifted` };
  }
  if (equal(actual, before)) return { action, state: 'pending' };
  if (compatiblePredecessorBefore && equal(actual, compatiblePredecessorBefore)) {
    return { action, state: 'pending', compatiblePredecessor: true };
  }
  if (equal(actual, after)) return { action, state: 'applied' };
  return { action, state: 'conflict', reason: `patch target ${id} drifted` };
}

function classifyAll(actionGroups, tables) {
  return Object.entries(actionGroups).flatMap(([tableName, actions]) => (
    actions.map((action) => ({ tableName, ...classifyAction(action, tables[tableName]) }))
  ));
}

function transformTable(table, pendingStates) {
  const indexes = Object.fromEntries(table.parsed.header.map((column, index) => [column, index]));
  const replacements = [];
  for (const { action } of pendingStates) {
    const id = action.before[table.idColumn];
    const current = table.byId.get(id);
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
  return output;
}

function tablesFromOutputs(outputs) {
  const tables = {};
  for (const [tableName, source] of Object.entries(outputs)) {
    const idColumn = tableName === 'insects' ? 'insect_id' : 'record_id';
    const parsed = parseCsv(source);
    const rows = toObjects(parsed);
    const byId = new Map();
    for (const row of rows) {
      const id = row[idColumn];
      if (!id || byId.has(id)) throw new Error(`${tableName} output has blank/duplicate ID: ${id}`);
      byId.set(id, row);
    }
    tables[tableName] = { source, parsed, rows, byId, idColumn };
  }
  return tables;
}

function validateResult(outputs, actionGroups) {
  const tables = tablesFromOutputs(outputs);
  const remaining = classifyAll(actionGroups, tables).find(({ state }) => state !== 'applied');
  if (remaining) throw new Error(`${remaining.action.action_id}: prospective output is not fully applied`);
  const duplicateIds = new Set(EXPECTED_MAPPINGS.map(([duplicateId]) => duplicateId));
  const canonicalIds = new Set(EXPECTED_MAPPINGS.map(([, canonicalId]) => canonicalId));
  for (const duplicateId of duplicateIds) {
    if (tables.insects.byId.has(duplicateId)) throw new Error(`Duplicate insect remains: ${duplicateId}`);
  }
  for (const row of [...tables.hosts.rows, ...tables.notes.rows]) {
    if (!tables.insects.byId.has(row.insect_id)) throw new Error(`Orphan relationship: ${row.record_id} -> ${row.insect_id}`);
    if (duplicateIds.has(row.insect_id)) throw new Error(`Relationship still uses duplicate ID: ${row.record_id}`);
  }
  const pairKeys = new Set();
  for (const row of tables.hosts.rows.filter(({ insect_id }) => canonicalIds.has(insect_id))) {
    const key = `${row.insect_id}\u0000${row.plant_name}`;
    if (pairKeys.has(key)) throw new Error(`Affected canonical pair remains duplicated: ${key}`);
    pairKeys.add(key);
  }
  const h808Reference = 'さやばね ニューシリーズ (さやばね ニューシリーズ No.17)';
  const h032TransferredHosts = tables.hosts.rows.filter((row) => (
    row.insect_id === 'species-H032' && row.reference.split(';').map((value) => value.trim()).includes(h808Reference)
  ));
  if (h032TransferredHosts.length !== 7 || new Set(h032TransferredHosts.map(({ plant_name }) => plant_name)).size !== 7) {
    throw new Error(`H808 host payload was not preserved exactly: ${h032TransferredHosts.length}`);
  }
  const transferredNote = tables.notes.byId.get('note-1005195');
  if (transferredNote?.insect_id !== 'species-H032') throw new Error('H808 general note was not transferred');
  const h089 = tables.insects.byId.get('species-H089');
  if (!h089?.other_names.split(/[;；]/).includes('ヒゲナガマルノミハムシ')) {
    throw new Error('H676 Japanese alias was not retained');
  }
  if (/hegenagae/i.test(h089.synonyms)) throw new Error('Fabricated Hemipyxis spelling remains searchable');
  if (tables.insects.byId.get('species-H806')?.japanese_name !== 'オキナワツブノミハムシ') {
    throw new Error('Original-PDF Japanese name is missing from species-H806');
  }
  const h933 = tables.insects.byId.get('species-H933');
  if (
    h933?.japanese_name !== 'セアカケブカハムシ'
    || h933?.alternative_name !== 'セアカケブカサルハムシ'
  ) throw new Error('Original-PDF Japanese names are missing from species-H933');
  return tables;
}

function writeAllAtomically(outputs) {
  const entries = Object.entries(outputs).filter(([tableName, output]) => (
    fs.readFileSync(PATHS[tableName], 'utf8') !== output
  ));
  if (!entries.length) return;
  const staged = [];
  const backups = [];
  try {
    for (const [tableName, output] of entries) {
      const target = PATHS[tableName];
      const temporary = `${target}.leaf-beetle-canonical-${process.pid}.tmp`;
      fs.writeFileSync(temporary, output, 'utf8');
      staged.push({ target, temporary });
    }
    for (const item of staged) {
      const backup = `${item.target}.leaf-beetle-canonical-${process.pid}.bak`;
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

const { audit, actionGroups } = readAudit();
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
const predecessor = audit.scope.compatible_applied_predecessor;
const transitionActionIds = new Set(predecessor.transition_action_ids);
const unchangedStates = states.filter(({ action }) => !transitionActionIds.has(action.action_id));
const compatiblePredecessorState = (
  unchangedStates.length === predecessor.unchanged_applied_action_count
  && unchangedStates.every(({ state }) => state === 'applied')
  && pending.every(({ action }) => transitionActionIds.has(action.action_id))
);
if (pending.length && applied.length && !compatiblePredecessorState) {
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

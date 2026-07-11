#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { parseCsv, serializeField, toObjects } from './lib/csvQuality.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const DATA_ROOT = process.env.HAMUSHI6_DATA_ROOT ? path.resolve(process.env.HAMUSHI6_DATA_ROOT) : ROOT;
const AUDIT_PATH = path.join(
  ROOT,
  'data/source_audits/japanese-leaf-beetle-ecology-notes-6-integrity-actions-2026-07-12.json',
);
const CANONICAL_MERGE_PATH = path.join(
  ROOT,
  'data/source_audits/leaf-beetle-canonical-taxonomy-merge-2026-07-12.json',
);
const PATHS = {
  insects: path.join(DATA_ROOT, 'normalized_data/insects.csv'),
  hosts: path.join(DATA_ROOT, 'normalized_data/hostplants.csv'),
  notes: path.join(DATA_ROOT, 'normalized_data/general_notes.csv'),
};
const CHECK_ONLY = process.argv.includes('--check');
const unknownArguments = process.argv.slice(2).filter((argument) => argument !== '--check');
if (unknownArguments.length) throw new Error(`Unknown arguments: ${unknownArguments.join(', ')}`);

const SOURCE = '日本産ハムシ科生態覚書 (6)';
const PDF_SHA256 = 'b16c29ef9ad7f9e017a0d1349c7907c013b7a6e5f53d8beae2d175230262f544';
// Regenerated only after the handbook audit has settled, then sealed here and in the test.
const AUDIT_SHA256 = 'fd2175310233b1a37c560b282321a868c08ea976065a345fa2d139c17c2ce991';
const CANONICAL_MERGE_SHA256 = '54640b5efb70df438e1629871e36f5dfb8d57a4c2bea8536c149b3e1f25898a6';
const EXPECTED_COUNTS = Object.freeze({
  sourceAccounts: 112,
  heldAccounts: 0,
  hostMembershipsAfter: 206,
  emergenceMembershipsAfter: 103,
  ecologyMembershipsAfter: 95,
  noteMembershipsAfter: 198,
  hostActions: 123,
  noteActions: 202,
});
const ALLOWED_ACTIONS = Object.freeze({
  hosts: new Set([
    'add_hostplant',
    'append_source_reference',
    'delete_unsupported_or_misattributed',
    'move_hostplant',
    'remove_source_reference',
    'update_hostplant',
  ]),
  notes: new Set([
    'add_general_note',
    'delete_unsupported_or_duplicate',
    'move_general_note',
    'remove_source_reference',
    'replace_general_note',
  ]),
});

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const plainRow = (row, columns) => Object.fromEntries(columns.map((column) => [column, row?.[column] ?? '']));
const equal = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const referenceParts = (value) => String(value || '').split(/\s*;\s*/u).filter(Boolean);
const hasReference = (value, reference) => referenceParts(value).includes(reference);

function readAudit() {
  const bytes = fs.readFileSync(AUDIT_PATH);
  const actualHash = sha256(bytes);
  if (actualHash !== AUDIT_SHA256) throw new Error(`Audit ledger SHA-256 mismatch: ${actualHash}`);
  const audit = JSON.parse(bytes);
  if (
    audit.schema_version !== 1
    || audit.generated_at !== '2026-07-12'
    || audit.source?.reference !== SOURCE
    || audit.source?.pdf_sha256 !== PDF_SHA256
    || audit.source?.article_printed_pages !== '33-51'
    || audit.source?.article_pdf_pages !== '35-53'
    || !audit.source?.evidence_policy?.includes('original PDF page image')
    || !audit.source?.subspecies_policy?.includes('unqualified species-level')
  ) throw new Error('Unexpected source identity or evidence policy');
  const counts = audit.counts || {};
  if (
    counts.source_accounts !== EXPECTED_COUNTS.sourceAccounts
    || counts.held_source_accounts !== EXPECTED_COUNTS.heldAccounts
    || counts.approved_host_memberships_after !== EXPECTED_COUNTS.hostMembershipsAfter
    || counts.approved_emergence_note_memberships_after !== EXPECTED_COUNTS.emergenceMembershipsAfter
    || counts.approved_ecology_note_memberships_after !== EXPECTED_COUNTS.ecologyMembershipsAfter
    || counts.approved_note_memberships_after !== EXPECTED_COUNTS.noteMembershipsAfter
    || counts.insect_actions !== 0
    || counts.host_actions !== EXPECTED_COUNTS.hostActions
    || counts.note_actions !== EXPECTED_COUNTS.noteActions
  ) throw new Error('Unexpected source6 audit coverage profile');
  if (audit.insect_actions.length !== 0) throw new Error('Source6 must not rewrite current taxonomy rows');

  const actionGroups = { hosts: audit.host_actions, notes: audit.note_actions };
  const actionIds = new Set();
  for (const [tableName, actions] of Object.entries(actionGroups)) {
    const targetIds = new Set();
    for (const action of actions) {
      const recordId = action.before?.record_id ?? action.after?.record_id;
      if (!action.action_id || actionIds.has(action.action_id)) {
        throw new Error(`Invalid or duplicate action_id: ${action.action_id}`);
      }
      if (!recordId || targetIds.has(recordId)) throw new Error(`Duplicate ${tableName} target: ${recordId}`);
      if (!ALLOWED_ACTIONS[tableName].has(action.action)) {
        throw new Error(`${action.action_id}: unsupported action ${action.action}`);
      }
      if (
        action.verification_status !== 'original_pdf_page_verified'
        || action.source?.reference !== SOURCE
        || action.source?.pdf_sha256 !== PDF_SHA256
      ) throw new Error(`${action.action_id}: incomplete original-PDF evidence`);
      if (action.action.startsWith('add_') && (action.before !== null || !action.after)) {
        throw new Error(`${action.action_id}: invalid addition shape`);
      }
      if (action.before && action.after && action.before.record_id !== action.after.record_id) {
        throw new Error(`${action.action_id}: stable record_id changed`);
      }
      if (tableName === 'notes' && action.after) {
        if (!action.after.page || action.after.year !== '2012') {
          throw new Error(`${action.action_id}: note lacks printed page or year`);
        }
      }
      actionIds.add(action.action_id);
      targetIds.add(recordId);
    }
  }
  return actionGroups;
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
  return Object.entries(actionGroups).flatMap(([tableName, actions]) => (
    actions.map((action) => ({ tableName, ...classifyAction(action, tables[tableName]) }))
  ));
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

function parseOutput(output, idColumn) {
  const parsed = parseCsv(output);
  const rows = toObjects(parsed);
  const byId = new Map();
  for (const row of rows) {
    const id = row[idColumn];
    if (!id || byId.has(id)) throw new Error(`Prospective output has blank or duplicate ${idColumn}: ${id}`);
    byId.set(id, row);
  }
  return { parsed, rows, byId, idColumn, source: output };
}

function validateSourceData(tables, insectTable) {
  for (const row of [...tables.hosts.rows, ...tables.notes.rows]) {
    if (!insectTable.byId.has(row.insect_id)) throw new Error(`Orphan relationship: ${row.record_id} -> ${row.insect_id}`);
  }

  const sourceHosts = tables.hosts.rows.filter((row) => hasReference(row.reference, SOURCE));
  const sourceNotes = tables.notes.rows.filter((row) => hasReference(row.reference, SOURCE));
  if (sourceHosts.length !== EXPECTED_COUNTS.hostMembershipsAfter) {
    throw new Error(`Unexpected source6 host membership count: ${sourceHosts.length}`);
  }
  if (sourceNotes.length !== EXPECTED_COUNTS.noteMembershipsAfter) {
    throw new Error(`Unexpected source6 note membership count: ${sourceNotes.length}`);
  }
  if (sourceNotes.filter((row) => row.note_type === '出現時期').length !== EXPECTED_COUNTS.emergenceMembershipsAfter) {
    throw new Error('Unexpected source6 emergence membership count');
  }
  if (sourceNotes.filter((row) => row.note_type === '生態情報').length !== EXPECTED_COUNTS.ecologyMembershipsAfter) {
    throw new Error('Unexpected source6 ecology membership count');
  }
  const unsafe = sourceNotes.find((row) => /と思われ|可能性|情報はない|不明である|同定には|検討が必要/u.test(row.content));
  if (unsafe) throw new Error(`Unsafe speculative/editorial source6 note remains: ${unsafe.record_id}`);
  for (const row of sourceNotes) {
    if (!row.page || row.year !== '2012') throw new Error(`Source6 note lacks page/year: ${row.record_id}`);
  }
  for (const insectId of ['species-H676', 'species-H092', 'species-H646']) {
    if (sourceHosts.some((row) => row.insect_id === insectId)) {
      throw new Error(`Misattributed source6 host remains on ${insectId}`);
    }
  }
  for (const row of sourceHosts) {
    if (row.notes && row.reference === SOURCE) {
      throw new Error(`Source6-only host has public editorial residue: ${row.record_id}`);
    }
  }
}

function validateResult(outputs, actionGroups, insectTable) {
  const tables = {
    hosts: parseOutput(outputs.hosts, 'record_id'),
    notes: parseOutput(outputs.notes, 'record_id'),
  };
  const remaining = classifyAll(actionGroups, tables).find(({ state }) => state !== 'applied');
  if (remaining) throw new Error(`${remaining.action.action_id}: prospective output is not fully applied`);
  validateSourceData(tables, insectTable);
}

function canonicalMergeIsApplied(insectTable, tables) {
  if (!fs.existsSync(CANONICAL_MERGE_PATH)) return false;
  const bytes = fs.readFileSync(CANONICAL_MERGE_PATH);
  if (sha256(bytes) !== CANONICAL_MERGE_SHA256) return false;
  const audit = JSON.parse(bytes);
  if (audit.counts?.mappings !== 13 || audit.counts?.total_actions !== 48) return false;
  for (const { duplicate_id: duplicateId, canonical_id: canonicalId } of audit.mappings) {
    if (insectTable.byId.has(duplicateId) || !insectTable.byId.has(canonicalId)) return false;
    if (tables.hosts.rows.some((row) => row.insect_id === duplicateId)) return false;
    if (tables.notes.rows.some((row) => row.insect_id === duplicateId)) return false;
  }
  return insectTable.byId.get('species-H806')?.japanese_name === 'オキナワツブノミハムシ';
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
      const temporary = `${target}.hamushi6-audit-${process.pid}.tmp`;
      fs.writeFileSync(temporary, output, 'utf8');
      staged.push({ target, temporary });
    }
    for (const item of staged) {
      const backup = `${item.target}.hamushi6-audit-${process.pid}.bak`;
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

const actionGroups = readAudit();
const insectTable = readTable(PATHS.insects, 'insect_id');
const tables = {
  hosts: readTable(PATHS.hosts, 'record_id'),
  notes: readTable(PATHS.notes, 'record_id'),
};
const states = classifyAll(actionGroups, tables);
const conflict = states.find(({ state }) => state === 'conflict');
if (conflict) {
  if (canonicalMergeIsApplied(insectTable, tables)) {
    validateSourceData(tables, insectTable);
    console.log(JSON.stringify({
      mode: CHECK_ONLY ? 'check' : 'apply',
      state: 'applied_downstream',
      changed: 0,
      would_change: false,
      pending: 0,
      already_applied: states.filter(({ state }) => state === 'applied').length,
      downstream_audit: path.relative(ROOT, CANONICAL_MERGE_PATH),
      action_counts: {
        hosts: actionGroups.hosts.length,
        notes: actionGroups.notes.length,
      },
    }, null, 2));
    process.exit(0);
  }
  throw new Error(`${conflict.action.action_id}: ${conflict.reason}`);
}
const pending = states.filter(({ state }) => state === 'pending');
const applied = states.filter(({ state }) => state === 'applied');
if (pending.length && applied.length) {
  throw new Error(`Partial audit state is not allowed: pending=${pending.length}, applied=${applied.length}`);
}

const outputs = Object.fromEntries(Object.entries(tables).map(([tableName, table]) => [
  tableName,
  transformTable(table, pending.filter((state) => state.tableName === tableName)),
]));
validateResult(outputs, actionGroups, insectTable);
if (!CHECK_ONLY) writeAllAtomically(outputs);

console.log(JSON.stringify({
  mode: CHECK_ONLY ? 'check' : 'apply',
  state: pending.length ? 'pending' : 'applied',
  changed: CHECK_ONLY ? 0 : pending.length,
  would_change: pending.length > 0,
  pending: pending.length,
  already_applied: applied.length,
  action_counts: {
    hosts: actionGroups.hosts.length,
    notes: actionGroups.notes.length,
  },
}, null, 2));

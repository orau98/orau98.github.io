import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Papa from 'papaparse';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXPECTED_VERSION = 'japanese-standard-moth-guides-hostplant-integrity-v1-2026-07-12';
const EXPECTED_LEDGER_SHA256 = '627bc2a7d2c939fffc60fb442b6e0f8e4e8c0b63d09aa522f698fd082d2ab6f9';
const HOSTPLANT_COLUMNS = [
  'record_id', 'insect_id', 'plant_name', 'plant_family', 'observation_type',
  'plant_part', 'life_stage', 'reference', 'notes',
];
const INSECT_COLUMNS = [
  'insect_id', 'family', 'family_jp', 'subfamily', 'subfamily_jp', 'tribe',
  'tribe_jp', 'genus', 'subgenus', 'species', 'subspecies', 'author', 'year',
  'japanese_name', 'old_japanese_name', 'alternative_name', 'other_names',
  'scientific_name', 'synonyms', 'changes_since_standard', 'notes',
];
const NOTE_COLUMNS = ['record_id', 'insect_id', 'note_type', 'content', 'reference', 'page', 'year'];

const resolvePath = (envName, fallback) => process.env[envName]
  ? path.resolve(process.env[envName])
  : path.join(ROOT, fallback);
const HOSTPLANTS_PATH = resolvePath('SMG_HOST_AUDIT_HOSTPLANTS_PATH', 'normalized_data/hostplants.csv');
const INSECTS_PATH = resolvePath('SMG_HOST_AUDIT_INSECTS_PATH', 'normalized_data/insects.csv');
const NOTES_PATH = resolvePath('SMG_HOST_AUDIT_NOTES_PATH', 'normalized_data/general_notes.csv');
const AUDIT_PATH = resolvePath(
  'SMG_HOST_AUDIT_LEDGER_PATH',
  'data/source_audits/japanese-standard-moth-guides-hostplant-integrity-2026-07-12.json',
);
const CHECK_ONLY = process.argv.includes('--check');
const unknownArguments = process.argv.slice(2).filter(argument => argument !== '--check');
if (unknownArguments.length) throw new Error(`Unknown arguments: ${unknownArguments.join(', ')}`);

const readCsv = filePath => {
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = Papa.parse(raw.replace(/^\ufeff/, ''), { header: true, skipEmptyLines: true });
  if (parsed.errors.length) throw new Error(`${filePath}: ${parsed.errors[0].message}`);
  return { rows: parsed.data, bom: raw.startsWith('\ufeff') };
};
const writeCsv = (filePath, rows, columns, bom) => fs.writeFileSync(
  filePath,
  `${bom ? '\ufeff' : ''}${Papa.unparse(rows, { columns, newline: '\r\n' })}\r\n`,
);
const equalRow = (actual, expected) => (
  expected
  && Object.keys(expected).every(key => String(actual?.[key] ?? '') === String(expected[key] ?? ''))
);
const countExactReferences = rows => Object.fromEntries(
  ['日本産蛾類標準図鑑1', '日本産蛾類標準図鑑2', '日本産蛾類標準図鑑3', '日本産蛾類標準図鑑4']
    .map(reference => [reference, rows.filter(row => row.reference === reference).length]),
);

const rawAudit = fs.readFileSync(AUDIT_PATH, 'utf8');
const audit = JSON.parse(rawAudit);
if (audit.audit_version !== EXPECTED_VERSION || audit.reviewed_on !== '2026-07-12') {
  throw new Error('Unexpected audit identity');
}
if (
  !Array.isArray(audit.coverage_rows)
  || audit.coverage_rows.length !== audit.scan_scope?.exact_reference_rows_before
  || new Set(audit.coverage_rows.map(row => row.record_id)).size !== audit.coverage_rows.length
  || audit.scan_scope?.coverage_unique_record_ids !== audit.coverage_rows.length
) {
  throw new Error('Coverage ledger is incomplete or contains duplicate record IDs');
}
if (!Array.isArray(audit.actions) || !audit.actions.length || !Array.isArray(audit.identity_actions)) {
  throw new Error('Audit action ledger is incomplete');
}
const productionAuditPath = path.join(
  ROOT,
  'data/source_audits/japanese-standard-moth-guides-hostplant-integrity-2026-07-12.json',
);
if (path.resolve(AUDIT_PATH) === path.resolve(productionAuditPath)) {
  const digest = crypto.createHash('sha256').update(rawAudit).digest('hex');
  if (digest !== EXPECTED_LEDGER_SHA256) throw new Error(`Production audit SHA-256 mismatch: ${digest}`);
}
const expectedActionCounts = audit.scan_scope.action_counts;
const actualActionCounts = audit.actions.reduce((counts, action) => {
  counts[action.action] = (counts[action.action] || 0) + 1;
  return counts;
}, {});
if (
  Object.keys(expectedActionCounts).length !== Object.keys(actualActionCounts).length
  || Object.entries(expectedActionCounts).some(([action, count]) => actualActionCounts[action] !== count)
) {
  throw new Error('Audit action profile mismatch');
}
for (const action of audit.actions) {
  if (
    !action.audit_id || !action.record_id || !action.insect_id || !action.source_reference
    || !Number.isInteger(action.pdf_page) || action.pdf_page < 1
    || (!action.printed_page && !action.printed_page_range)
    || !action.issue_class || !action.decision || !action.evidence
  ) {
    throw new Error(`Incomplete provenance for ${action.audit_id || action.record_id}`);
  }
  if (!['delete_hostplant', 'update_hostplant', 'add_hostplant'].includes(action.action)) {
    throw new Error(`Unsupported host action: ${action.action}`);
  }
  if (action.action === 'delete_hostplant' && (!action.before || action.after)) {
    throw new Error(`Invalid delete action: ${action.audit_id}`);
  }
  if (action.action === 'update_hostplant' && (!action.before || !action.after)) {
    throw new Error(`Invalid update action: ${action.audit_id}`);
  }
  if (action.action === 'add_hostplant' && (action.before || !action.after)) {
    throw new Error(`Invalid add action: ${action.audit_id}`);
  }
}

const hostFile = readCsv(HOSTPLANTS_PATH);
const insectFile = readCsv(INSECTS_PATH);
const noteFile = readCsv(NOTES_PATH);
let hostplants = hostFile.rows;
let insects = insectFile.rows;
let notes = noteFile.rows;
let hostplantsChanged = 0;
let insectsChanged = 0;
let notesChanged = 0;

const hostById = () => new Map(hostplants.map(row => [row.record_id, row]));
for (const action of audit.actions) {
  const byId = hostById();
  const existing = byId.get(action.record_id);
  if (action.action === 'delete_hostplant') {
    if (!existing) continue;
    if (!equalRow(existing, action.before)) {
      throw new Error(`Delete precondition mismatch for ${action.record_id}`);
    }
    hostplants = hostplants.filter(row => row.record_id !== action.record_id);
    hostplantsChanged += 1;
    continue;
  }
  if (action.action === 'update_hostplant') {
    if (!existing) throw new Error(`Update target missing: ${action.record_id}`);
    if (equalRow(existing, action.after)) continue;
    if (!equalRow(existing, action.before)) {
      throw new Error(`Update precondition mismatch for ${action.record_id}`);
    }
    Object.assign(existing, action.after);
    hostplantsChanged += 1;
    continue;
  }
  if (existing) {
    if (equalRow(existing, action.after)) continue;
    throw new Error(`Add target conflicts with existing row: ${action.record_id}`);
  }
  hostplants.push({ ...action.after });
  hostplantsChanged += 1;
}

for (const identity of audit.identity_actions) {
  if (identity.action !== 'merge_duplicate_insect_identity') {
    throw new Error(`Unsupported identity action: ${identity.action}`);
  }
  const duplicateIndex = insects.findIndex(row => row.insect_id === identity.duplicate_insect_id);
  const canonical = insects.find(row => row.insect_id === identity.canonical_insect_id);
  if (!canonical) throw new Error(`Canonical insect missing: ${identity.canonical_insect_id}`);
  if (!equalRow(canonical, identity.canonical_after)) {
    if (!equalRow(canonical, identity.canonical_before)) {
      throw new Error(`Canonical insect precondition mismatch: ${identity.canonical_insect_id}`);
    }
    Object.assign(canonical, identity.canonical_after);
    insectsChanged += 1;
  }

  if (duplicateIndex >= 0) {
    if (!equalRow(insects[duplicateIndex], identity.duplicate_before)) {
      throw new Error(`Duplicate insect precondition mismatch: ${identity.duplicate_insect_id}`);
    }
    insects.splice(duplicateIndex, 1);
    insectsChanged += 1;
  }

  const expectedHostIds = new Set(identity.migrate_hostplant_record_ids);
  const expectedNoteIds = new Set(identity.migrate_general_note_record_ids);
  for (const row of hostplants) {
    if (!expectedHostIds.has(row.record_id)) continue;
    if (row.insect_id === identity.canonical_insect_id) continue;
    if (row.insect_id !== identity.duplicate_insect_id) {
      throw new Error(`Unexpected host relation identity for ${row.record_id}: ${row.insect_id}`);
    }
    row.insect_id = identity.canonical_insect_id;
    hostplantsChanged += 1;
  }
  for (const recordId of expectedHostIds) {
    const row = hostplants.find(candidate => candidate.record_id === recordId);
    if (!row || row.insect_id !== identity.canonical_insect_id) {
      throw new Error(`Host relation migration incomplete: ${recordId}`);
    }
  }
  for (const row of notes) {
    if (!expectedNoteIds.has(row.record_id)) continue;
    if (row.insect_id === identity.canonical_insect_id) continue;
    if (row.insect_id !== identity.duplicate_insect_id) {
      throw new Error(`Unexpected note relation identity for ${row.record_id}: ${row.insect_id}`);
    }
    row.insect_id = identity.canonical_insect_id;
    notesChanged += 1;
  }
  for (const recordId of expectedNoteIds) {
    const row = notes.find(candidate => candidate.record_id === recordId);
    if (!row || row.insect_id !== identity.canonical_insect_id) {
      throw new Error(`Note relation migration incomplete: ${recordId}`);
    }
  }
  if (
    hostplants.some(row => row.insect_id === identity.duplicate_insect_id)
    || notes.some(row => row.insect_id === identity.duplicate_insect_id)
    || insects.some(row => row.insect_id === identity.duplicate_insect_id)
  ) {
    throw new Error(`Duplicate insect still has normalized references: ${identity.duplicate_insect_id}`);
  }
}

const resultingCounts = countExactReferences(hostplants);
const expectedAfter = audit.scan_scope.exact_reference_rows_after_expected_by_reference;
for (const [reference, expectedCount] of Object.entries(expectedAfter)) {
  if (resultingCounts[reference] !== expectedCount) {
    throw new Error(`Unexpected resulting row count for ${reference}: ${resultingCounts[reference]} != ${expectedCount}`);
  }
}
if (new Set(hostplants.map(row => row.record_id)).size !== hostplants.length) {
  throw new Error('Duplicate hostplant record IDs after application');
}
if (new Set(insects.map(row => row.insect_id)).size !== insects.length) {
  throw new Error('Duplicate insect IDs after application');
}
if (new Set(notes.map(row => row.record_id)).size !== notes.length) {
  throw new Error('Duplicate general-note record IDs after application');
}

const changed = hostplantsChanged + insectsChanged + notesChanged > 0;
if (!CHECK_ONLY && changed) {
  writeCsv(HOSTPLANTS_PATH, hostplants, HOSTPLANT_COLUMNS, hostFile.bom);
  writeCsv(INSECTS_PATH, insects, INSECT_COLUMNS, insectFile.bom);
  writeCsv(NOTES_PATH, notes, NOTE_COLUMNS, noteFile.bom);
}

console.log(JSON.stringify({
  check_only: CHECK_ONLY,
  would_change: changed,
  hostplant_rows_changed: hostplantsChanged,
  insect_rows_changed: insectsChanged,
  general_note_rows_changed: notesChanged,
  exact_reference_rows_after: resultingCounts,
  audit_sha256: crypto.createHash('sha256').update(rawAudit).digest('hex'),
}, null, 2));

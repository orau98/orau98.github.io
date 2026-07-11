import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Papa from 'papaparse';

import { splitCsvRecordsWithDelimiters } from './lib/csvRecords.mjs';
import { collectGeneralNoteIssues } from './lib/generalNoteQuality.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = '日本産蛾類標準図鑑3';
const MISLABELED_SOURCE = '日本産蝶類標準図鑑';
const EXPECTED_VERSION = 'japanese-moths-standard-guide-3-general-note-integrity-v1-2026-07-12';
const EXPECTED_LEDGER_SHA256 = '1e4e66fa14c78d22d9a51c6ddd888ec1cb22ca9827cbb8941751e3e59c384a30';
const EXPECTED_PDF_SHA256 = '205b3090c799655004bae148d6931e90a2abb968c85c376b2680ce105ed37850';
const EXPECTED_ACTIONS = { action_rows: 263, update_note: 101, delete_note: 162 };
const BEFORE_PROFILE = { rows: 1303, emergence: 1047, ecology: 256 };
const AFTER_PROFILE = { rows: 1161, emergence: 1056, ecology: 105 };

const resolvePath = (envName, fallback) => process.env[envName]
  ? path.resolve(process.env[envName])
  : path.join(ROOT, fallback);
const NOTES_PATH = resolvePath('STANDARD_GUIDE3_AUDIT_NOTES_PATH', 'normalized_data/general_notes.csv');
const AUDIT_PATH = resolvePath(
  'STANDARD_GUIDE3_AUDIT_PATH',
  'data/source_audits/japanese-moths-standard-guide-3-general-note-integrity-2026-07-12.json',
);
const PRODUCTION_AUDIT_PATH = path.join(
  ROOT,
  'data/source_audits/japanese-moths-standard-guide-3-general-note-integrity-2026-07-12.json',
);
const PDF_PATH = process.env.STANDARD_GUIDE3_AUDIT_PDF_PATH
  ? path.resolve(process.env.STANDARD_GUIDE3_AUDIT_PDF_PATH)
  : null;
const CHECK_ONLY = process.argv.includes('--check');
const unknownArguments = process.argv.slice(2).filter(argument => argument !== '--check');
if (unknownArguments.length) throw new Error(`Unknown arguments: ${unknownArguments.join(', ')}`);

const sha256File = (filePath) => {
  const hash = crypto.createHash('sha256');
  const descriptor = fs.openSync(filePath, 'r');
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    let bytesRead;
    do {
      bytesRead = fs.readSync(descriptor, buffer, 0, buffer.length, null);
      if (bytesRead > 0) hash.update(buffer.subarray(0, bytesRead));
    } while (bytesRead > 0);
  } finally {
    fs.closeSync(descriptor);
  }
  return hash.digest('hex');
};

const rawAudit = fs.readFileSync(AUDIT_PATH, 'utf8');
let audit;
try {
  audit = JSON.parse(rawAudit);
} catch (error) {
  throw new Error(`${path.basename(AUDIT_PATH)}: ${error.message}`);
}
if (audit.audit_version !== EXPECTED_VERSION || audit.reviewed_on !== '2026-07-12') {
  throw new Error('Unexpected audit identity');
}
if (
  audit.reference !== SOURCE
  || audit.source_pdf?.sha256 !== EXPECTED_PDF_SHA256
  || audit.source_pdf?.page_count !== 138
  || audit.source_pdf?.role !== 'original_full_pdf_image_review'
) {
  throw new Error('Unexpected original source PDF identity');
}
if (
  audit.scan_scope?.source_rows_before !== BEFORE_PROFILE.rows
  || audit.scan_scope?.source_note_type_counts_before?.出現時期 !== BEFORE_PROFILE.emergence
  || audit.scan_scope?.source_note_type_counts_before?.生態情報 !== BEFORE_PROFILE.ecology
  || audit.scan_scope?.mislabeled_moth_rows !== 20
  || audit.scan_scope?.reviewed_rows !== 1323
  || audit.scan_scope?.hold_no_change !== 0
  || audit.scan_scope?.source_rows_after !== AFTER_PROFILE.rows
  || audit.scan_scope?.existing_guide2_3_ledger_overlap_excluded?.join(',') !== 'note-999784'
) {
  throw new Error('Unexpected scan scope');
}
if (!Array.isArray(audit.rows) || audit.rows.length !== EXPECTED_ACTIONS.action_rows) {
  throw new Error(`Expected ${EXPECTED_ACTIONS.action_rows} audit rows; found ${audit.rows?.length}`);
}

const auditIds = new Set();
const recordIds = new Set();
const actionCounts = new Map();
let mislabeledCount = 0;
for (const row of audit.rows) {
  if (!row.audit_id || auditIds.has(row.audit_id)) throw new Error(`Invalid audit_id: ${row.audit_id}`);
  if (!row.record_id || recordIds.has(row.record_id)) throw new Error(`Invalid record_id: ${row.record_id}`);
  auditIds.add(row.audit_id);
  recordIds.add(row.record_id);
  if (!['update_note', 'delete_note'].includes(row.action)) {
    throw new Error(`Unsupported action for ${row.audit_id}: ${row.action}`);
  }
  if (
    !row.insect_id || !row.japanese_name || !row.scientific_name
    || !['出現時期', '生態情報'].includes(row.note_type)
    || typeof row.old_content !== 'string' || ![SOURCE, MISLABELED_SOURCE].includes(row.old_reference)
    || !Number.isInteger(row.pdf_page) || row.pdf_page < 1 || row.pdf_page > 138
    || !Number.isInteger(row.printed_page) || row.printed_page < 1
    || !row.evidence || !row.decision
    || !['non_biological_field_spill_not_applicable', 'geographically_bounded_species_account', 'species_level_account_without_subspecies_designation'].includes(row.source_scope)
    || row.subspecies_name_explicit_in_source !== false
    || !Array.isArray(row.application_targets)
    || row.application_targets[0] !== row.insect_id
    || !Array.isArray(row.excluded_targets)
    || !row.scope_decision_reason
  ) {
    throw new Error(`Incomplete audit provenance for ${row.audit_id}`);
  }
  if (row.application_targets.length !== 1 || row.excluded_targets.length !== 0) {
    throw new Error(`Unexpected subspecies scope for ${row.audit_id}`);
  }
  if (row.old_reference === MISLABELED_SOURCE) mislabeledCount += 1;
  if (row.action === 'update_note') {
    if (!row.approved_content || row.approved_reference !== SOURCE || !row.approved_page) {
      throw new Error(`Invalid approved update for ${row.audit_id}`);
    }
    const issues = collectGeneralNoteIssues({
      note_type: row.note_type,
      content: row.approved_content,
      page: row.approved_page,
    });
    if (issues.length) {
      throw new Error(`Approved note fails quality rules for ${row.audit_id}: ${issues.join(',')}`);
    }
  } else if (row.approved_content || row.approved_reference || row.approved_page) {
    throw new Error(`Deleted note has approved data for ${row.audit_id}`);
  }
  actionCounts.set(row.action, (actionCounts.get(row.action) || 0) + 1);
}
if (
  (actionCounts.get('update_note') || 0) !== EXPECTED_ACTIONS.update_note
  || (actionCounts.get('delete_note') || 0) !== EXPECTED_ACTIONS.delete_note
  || mislabeledCount !== 20
  || audit.expected_profile?.action_rows !== EXPECTED_ACTIONS.action_rows
  || audit.expected_profile?.update_note !== EXPECTED_ACTIONS.update_note
  || audit.expected_profile?.delete_note !== EXPECTED_ACTIONS.delete_note
  || audit.expected_profile?.source_reference_mislabel_rows !== 20
  || audit.expected_profile?.reviewed_rows !== 1323
) {
  throw new Error('Action profile mismatch');
}

const enforceProductionAudit = path.resolve(AUDIT_PATH) === path.resolve(PRODUCTION_AUDIT_PATH)
  || process.env.STANDARD_GUIDE3_AUDIT_ENFORCE_PRODUCTION === '1';
if (enforceProductionAudit) {
  const actualSha256 = crypto.createHash('sha256').update(rawAudit).digest('hex');
  if (actualSha256 !== EXPECTED_LEDGER_SHA256) {
    throw new Error(`Production audit SHA-256 mismatch: ${actualSha256}`);
  }
}
if (PDF_PATH && sha256File(PDF_PATH) !== EXPECTED_PDF_SHA256) {
  throw new Error(`Source PDF SHA-256 mismatch: ${sha256File(PDF_PATH)}`);
}

const source = fs.readFileSync(NOTES_PATH, 'utf8');
const hasBom = source.charCodeAt(0) === 0xfeff;
const body = hasBom ? source.slice(1) : source;
const records = splitCsvRecordsWithDelimiters(body);
if (!records.length) throw new Error('general_notes.csv is empty');
const headerParsed = Papa.parse(records[0].record);
if (headerParsed.errors.length) throw new Error(`general_notes.csv: ${headerParsed.errors[0].message}`);
const header = headerParsed.data[0];
const indexes = Object.fromEntries(header.map((name, index) => [name, index]));
for (const column of ['record_id', 'insect_id', 'note_type', 'content', 'reference', 'page', 'year']) {
  if (indexes[column] === undefined) throw new Error(`general_notes.csv is missing ${column}`);
}
const csvRows = records.slice(1).filter(record => record.record).map((record) => {
  const parsed = Papa.parse(record.record);
  if (parsed.errors.length || parsed.data.length !== 1) {
    throw new Error(`Malformed general_notes.csv row: ${parsed.errors[0]?.message || 'row count'}`);
  }
  return { record, values: parsed.data[0], changed: false, deleted: false };
});
const byRecordId = new Map();
for (const row of csvRows) {
  const recordId = row.values[indexes.record_id] || '';
  if (!recordId || byRecordId.has(recordId)) throw new Error(`Invalid or duplicate record_id: ${recordId}`);
  byRecordId.set(recordId, row);
}

const exactLegacyMatches = auditRow => csvRows.filter(row => (
  row.values[indexes.insect_id] === auditRow.insect_id
  && row.values[indexes.note_type] === auditRow.note_type
  && row.values[indexes.content] === auditRow.old_content
  && row.values[indexes.reference] === auditRow.old_reference
  && (row.values[indexes.page] || '') === auditRow.old_page
));
const assertIdentity = (auditRow, csvRow) => {
  if (
    csvRow.values[indexes.record_id] !== auditRow.record_id
    || csvRow.values[indexes.insect_id] !== auditRow.insect_id
    || csvRow.values[indexes.note_type] !== auditRow.note_type
  ) {
    throw new Error(`Target identity mismatch for ${auditRow.audit_id}`);
  }
};

const states = [];
for (const auditRow of audit.rows) {
  const csvRow = byRecordId.get(auditRow.record_id);
  if (!csvRow) {
    const legacyMatches = exactLegacyMatches(auditRow);
    if (legacyMatches.length) {
      throw new Error(`Target record_id changed for ${auditRow.audit_id}`);
    }
    if (auditRow.action === 'delete_note') {
      states.push({ auditRow, csvRow: null, state: 'applied' });
      continue;
    }
    throw new Error(`Required note is missing for ${auditRow.audit_id}: ${auditRow.record_id}`);
  }
  assertIdentity(auditRow, csvRow);
  const content = csvRow.values[indexes.content] || '';
  const reference = csvRow.values[indexes.reference] || '';
  const page = csvRow.values[indexes.page] || '';
  if (auditRow.action === 'update_note') {
    if (content === auditRow.old_content && reference === auditRow.old_reference && page === auditRow.old_page) {
      states.push({ auditRow, csvRow, state: 'pending' });
    } else if (
      content === auditRow.approved_content
      && reference === auditRow.approved_reference
      && page === auditRow.approved_page
    ) {
      states.push({ auditRow, csvRow, state: 'applied' });
    } else {
      throw new Error(`Unexpected update state for ${auditRow.audit_id}`);
    }
  } else if (
    content === auditRow.old_content
    && reference === auditRow.old_reference
    && page === auditRow.old_page
  ) {
    states.push({ auditRow, csvRow, state: 'pending' });
  } else {
    throw new Error(`Unexpected delete state for ${auditRow.audit_id}`);
  }
}
const pendingCount = states.filter(item => item.state === 'pending').length;
const appliedCount = states.filter(item => item.state === 'applied').length;
if (pendingCount > 0 && appliedCount > 0) {
  throw new Error(`Partial audit state: pending=${pendingCount}, applied=${appliedCount}`);
}

if (pendingCount) {
  const reviewedPopulation = [
    ...csvRows.filter(row => row.values[indexes.reference] === SOURCE),
    ...audit.rows
      .filter(row => row.old_reference === MISLABELED_SOURCE)
      .map(row => byRecordId.get(row.record_id)),
  ];
  if (reviewedPopulation.some(row => !row)) {
    throw new Error('Reviewed population is missing a mislabeled moth row');
  }
  const reviewedPopulationSignature = reviewedPopulation
    .map(row => [
      row.values[indexes.record_id],
      row.values[indexes.insect_id],
      row.values[indexes.note_type],
      row.values[indexes.content],
      row.values[indexes.reference],
      row.values[indexes.page],
      row.values[indexes.year],
    ].join('\u0000'))
    .sort()
    .join('\n');
  const reviewedPopulationSha256 = crypto
    .createHash('sha256')
    .update(reviewedPopulationSignature)
    .digest('hex');
  if (reviewedPopulationSha256 !== audit.scan_scope.reviewed_population_sha256) {
    throw new Error(`Reviewed population SHA-256 mismatch: ${reviewedPopulationSha256}`);
  }
}

const countProfile = rows => ({
  rows: rows.length,
  emergence: rows.filter(row => row.values[indexes.note_type] === '出現時期').length,
  ecology: rows.filter(row => row.values[indexes.note_type] === '生態情報').length,
});
const currentProfile = countProfile(csvRows.filter(row => row.values[indexes.reference] === SOURCE));
const expectedCurrent = pendingCount ? BEFORE_PROFILE : AFTER_PROFILE;
if (JSON.stringify(currentProfile) !== JSON.stringify(expectedCurrent)) {
  throw new Error(`Unexpected source-row profile: ${JSON.stringify(currentProfile)}`);
}

let noteUpdated = 0;
let noteDeleted = 0;
if (pendingCount) {
  for (const { auditRow, csvRow } of states) {
    if (auditRow.action === 'update_note') {
      csvRow.values[indexes.content] = auditRow.approved_content;
      csvRow.values[indexes.reference] = auditRow.approved_reference;
      csvRow.values[indexes.page] = auditRow.approved_page;
      csvRow.changed = true;
      noteUpdated += 1;
    } else {
      csvRow.deleted = true;
      noteDeleted += 1;
    }
  }
}

const outputRecords = [records[0]];
for (const row of csvRows) {
  if (row.deleted) continue;
  outputRecords.push(row.changed
    ? { record: Papa.unparse([row.values], { newline: '' }), delimiter: row.record.delimiter }
    : row.record);
}
const result = (hasBom ? '\ufeff' : '') + outputRecords
  .map(({ record, delimiter }) => record + delimiter)
  .join('');

const outputParsed = Papa.parse(result.replace(/^\ufeff/, ''), { header: true, skipEmptyLines: true });
if (outputParsed.errors.length) throw new Error(`Transformed CSV: ${outputParsed.errors[0].message}`);
const outputById = new Map(outputParsed.data.map(row => [row.record_id, row]));
if (outputById.size !== outputParsed.data.length) throw new Error('Transformed output has duplicate record_id');
for (const auditRow of audit.rows) {
  const row = outputById.get(auditRow.record_id);
  if (auditRow.action === 'delete_note') {
    if (row) throw new Error(`Deleted note remains: ${auditRow.record_id}`);
    continue;
  }
  if (
    !row || row.insect_id !== auditRow.insect_id || row.note_type !== auditRow.note_type
    || row.content !== auditRow.approved_content || row.reference !== SOURCE
    || row.page !== auditRow.approved_page
  ) {
    throw new Error(`Approved note is not exact: ${auditRow.record_id}`);
  }
  const issues = collectGeneralNoteIssues(row);
  if (issues.length) throw new Error(`Transformed note fails quality rules: ${auditRow.record_id}`);
}
const outputSourceRows = outputParsed.data.filter(row => row.reference === SOURCE);
const outputProfile = {
  rows: outputSourceRows.length,
  emergence: outputSourceRows.filter(row => row.note_type === '出現時期').length,
  ecology: outputSourceRows.filter(row => row.note_type === '生態情報').length,
};
if (JSON.stringify(outputProfile) !== JSON.stringify(AFTER_PROFILE)) {
  throw new Error(`Transformed source profile is unsafe: ${JSON.stringify(outputProfile)}`);
}

if (!CHECK_ONLY && result !== source) {
  const temporaryPath = `${NOTES_PATH}.tmp-${process.pid}-${crypto.randomUUID()}`;
  try {
    fs.writeFileSync(temporaryPath, result, {
      encoding: 'utf8', mode: fs.statSync(NOTES_PATH).mode, flag: 'wx',
    });
    fs.renameSync(temporaryPath, NOTES_PATH);
  } catch (error) {
    try { if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath); } catch {}
    throw error;
  }
}

console.log(JSON.stringify({
  audit_version: audit.audit_version,
  reviewed_rows: audit.scan_scope.reviewed_rows,
  audit_rows: audit.rows.length,
  note_updated: noteUpdated,
  note_deleted: noteDeleted,
  check_only: CHECK_ONLY,
  changed: !CHECK_ONLY && result !== source,
  would_change: result !== source,
  source_pdf_verified: Boolean(PDF_PATH),
  source_rows_after: outputProfile.rows,
  source_note_type_counts_after: {
    出現時期: outputProfile.emergence,
    生態情報: outputProfile.ecology,
  },
}, null, 2));

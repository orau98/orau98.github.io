import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Papa from 'papaparse';

import { splitCsvRecordsWithDelimiters } from './lib/csvRecords.mjs';
import { collectGeneralNoteIssues } from './lib/generalNoteQuality.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

const EXPECTED_VERSION = 'standard-moth-guides-notes-v1-2026-07-12';
const EXPECTED_PRODUCTION_LEDGER_SHA256 = 'df4defc297b5ebbf3e4a25aaf657d5cc0efb8bdab4a9b67443d4f422cd367059';
const EXPECTED_DOCUMENTS = new Map([
  ['日本産蛾類標準図鑑2', {
    pdf_file: '日本産蛾類標準図鑑2.pdf',
    pdf_sha256: '2d24a2870a7f890cb4af8d79b55dfc7fe6215607f6d70bbdcd41ca02db8eb5f9',
    pdf_pages: 143,
    pdf_path_env: 'STANDARD_MOTH_NOTE_AUDIT_PDF2_PATH',
  }],
  ['日本産蛾類標準図鑑3', {
    pdf_file: '日本産蛾類標準図鑑Ⅲ_compressed.pdf',
    pdf_sha256: '205b3090c799655004bae148d6931e90a2abb968c85c376b2680ce105ed37850',
    pdf_pages: 138,
    pdf_path_env: 'STANDARD_MOTH_NOTE_AUDIT_PDF3_PATH',
  }],
]);
const EXPECTED_PRODUCTION_PROFILE = new Map([
  ['replace_note_content', 17],
  ['exclude_note', 0],
  ['hold_no_change', 0],
]);

const resolvePath = (envName, fallback) => process.env[envName]
  ? path.resolve(process.env[envName])
  : path.join(ROOT, fallback);

const NOTES_PATH = resolvePath(
  'STANDARD_MOTH_NOTE_AUDIT_NOTES_PATH',
  'normalized_data/general_notes.csv',
);
const AUDIT_PATH = resolvePath(
  'STANDARD_MOTH_NOTE_AUDIT_PATH',
  'data/source_audits/japanese-standard-moth-guides-general-note-audit-2026-07-12.json',
);
const PRODUCTION_AUDIT_PATH = path.join(
  ROOT,
  'data',
  'source_audits',
  'japanese-standard-moth-guides-general-note-audit-2026-07-12.json',
);
const CHECK_ONLY = process.argv.includes('--check');
const unknownArguments = process.argv.slice(2).filter(argument => argument !== '--check');
if (unknownArguments.length > 0) {
  throw new Error(`Unknown arguments: ${unknownArguments.join(', ')}`);
}

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

const parsePageRange = (value, maximum, label) => {
  const match = /^(\d+)(?:-(\d+))?$/.exec(value || '');
  if (!match) throw new Error(`Invalid ${label}: ${value}`);
  const first = Number(match[1]);
  const last = Number(match[2] || match[1]);
  if (first < 1 || last < first || (maximum && last > maximum)) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
  return { first, last };
};

const rawAudit = fs.readFileSync(AUDIT_PATH, 'utf8');
let audit;
try {
  audit = JSON.parse(rawAudit);
} catch (error) {
  throw new Error(`${path.basename(AUDIT_PATH)}: ${error.message}`);
}

if (audit.audit_version !== EXPECTED_VERSION) {
  throw new Error(`Unexpected audit_version: ${audit.audit_version}`);
}
if (audit.reviewed_on !== '2026-07-12') {
  throw new Error(`Unexpected reviewed_on: ${audit.reviewed_on}`);
}
if (!audit.method) throw new Error('Missing audit method');
const sourceDocumentKeys = Object.keys(audit.source_documents || {});
if (sourceDocumentKeys.length !== EXPECTED_DOCUMENTS.size) {
  throw new Error(`Unexpected source document count: ${sourceDocumentKeys.length}`);
}
for (const [reference, expected] of EXPECTED_DOCUMENTS) {
  const actual = audit.source_documents?.[reference];
  if (!actual) throw new Error(`Missing source document: ${reference}`);
  for (const field of ['pdf_file', 'pdf_sha256', 'pdf_pages']) {
    if (actual[field] !== expected[field]) {
      throw new Error(`Unexpected ${field} for ${reference}: ${actual[field]}`);
    }
  }
  if (actual.local_copy_role !== 'original_pdf_image_review') {
    throw new Error(`Unexpected local_copy_role for ${reference}`);
  }
}

const rows = audit.rows;
if (!Array.isArray(rows)) throw new Error('Audit rows must be an array');
const expectedTotal = [...EXPECTED_PRODUCTION_PROFILE.values()]
  .reduce((sum, count) => sum + count, 0);
if (rows.length !== expectedTotal) {
  throw new Error(`Expected ${expectedTotal} audit rows; found ${rows.length}`);
}
const allowedActions = new Set(EXPECTED_PRODUCTION_PROFILE.keys());
const auditIds = new Set();
const recordIds = new Set();
const actualProfile = new Map();
for (const row of rows) {
  if (!row.audit_id || auditIds.has(row.audit_id)) {
    throw new Error(`Invalid or duplicate audit_id: ${row.audit_id}`);
  }
  auditIds.add(row.audit_id);
  if (!row.record_id || recordIds.has(row.record_id)) {
    throw new Error(`Invalid or duplicate audited record_id: ${row.record_id}`);
  }
  recordIds.add(row.record_id);
  if (!allowedActions.has(row.action)) {
    throw new Error(`Unsupported action for ${row.audit_id}: ${row.action}`);
  }
  const sourceDocument = EXPECTED_DOCUMENTS.get(row.reference);
  if (!sourceDocument) {
    throw new Error(`Unexpected reference for ${row.audit_id}: ${row.reference}`);
  }
  if (!row.insect_id || !row.japanese_name || row.note_type !== '生態情報') {
    throw new Error(`Invalid target identity for ${row.audit_id}`);
  }
  parsePageRange(row.pdf_page, sourceDocument.pdf_pages, `${row.audit_id} pdf_page`);
  parsePageRange(row.printed_page, null, `${row.audit_id} printed_page`);
  if (!row.evidence || !row.decision) {
    throw new Error(`Incomplete provenance for ${row.audit_id}`);
  }
  if (typeof row.old_content !== 'string' || typeof row.approved_content !== 'string') {
    throw new Error(`Missing content transition for ${row.audit_id}`);
  }
  if (row.action === 'replace_note_content') {
    if (!row.old_content || !row.approved_content || row.old_content === row.approved_content) {
      throw new Error(`Invalid replacement transition for ${row.audit_id}`);
    }
    const issues = collectGeneralNoteIssues({
      note_type: row.note_type,
      content: row.approved_content,
      page: row.printed_page,
    });
    if (issues.length > 0) {
      throw new Error(`Approved content fails quality rules for ${row.audit_id}: ${issues.join(',')}`);
    }
  } else if (row.action === 'exclude_note') {
    if (!row.old_content || row.approved_content !== '') {
      throw new Error(`Invalid exclusion transition for ${row.audit_id}`);
    }
  } else if (row.old_content !== row.approved_content) {
    throw new Error(`Hold content must be unchanged for ${row.audit_id}`);
  }
  actualProfile.set(row.action, (actualProfile.get(row.action) || 0) + 1);
}
for (const [action, expected] of EXPECTED_PRODUCTION_PROFILE) {
  const actual = actualProfile.get(action) || 0;
  if (actual !== expected || audit.expected_profile?.[action] !== expected) {
    throw new Error(`Production profile mismatch for ${action}: ${actual} != ${expected}`);
  }
}

const enforceProductionAudit = path.resolve(AUDIT_PATH) === path.resolve(PRODUCTION_AUDIT_PATH)
  || process.env.STANDARD_MOTH_NOTE_AUDIT_ENFORCE_PRODUCTION === '1';
if (enforceProductionAudit) {
  const ledgerSha256 = crypto.createHash('sha256').update(rawAudit).digest('hex');
  if (ledgerSha256 !== EXPECTED_PRODUCTION_LEDGER_SHA256) {
    throw new Error(`Production audit SHA-256 mismatch: ${ledgerSha256}`);
  }
}

const verifiedPdfReferences = [];
for (const [reference, expected] of EXPECTED_DOCUMENTS) {
  const suppliedPath = process.env[expected.pdf_path_env];
  if (!suppliedPath) continue;
  const actualSha256 = sha256File(path.resolve(suppliedPath));
  if (actualSha256 !== expected.pdf_sha256) {
    throw new Error(`Source PDF SHA-256 mismatch for ${reference}: ${actualSha256}`);
  }
  verifiedPdfReferences.push(reference);
}

const source = fs.readFileSync(NOTES_PATH, 'utf8');
const hasBom = source.charCodeAt(0) === 0xfeff;
const body = hasBom ? source.slice(1) : source;
const records = splitCsvRecordsWithDelimiters(body);
if (records.length === 0) throw new Error('general_notes.csv is empty');

const headerParsed = Papa.parse(records[0].record);
if (headerParsed.errors.length > 0) {
  throw new Error(`general_notes.csv: ${headerParsed.errors[0].message}`);
}
const header = headerParsed.data[0];
const indexes = Object.fromEntries(header.map((name, index) => [name, index]));
for (const column of ['record_id', 'insect_id', 'note_type', 'content', 'reference', 'page']) {
  if (indexes[column] === undefined) throw new Error(`general_notes.csv is missing ${column}`);
}

const csvRows = records.slice(1).filter(record => record.record).map((record) => {
  const parsed = Papa.parse(record.record);
  if (parsed.errors.length > 0) {
    throw new Error(`general_notes.csv: ${parsed.errors[0].message}`);
  }
  if (parsed.data.length !== 1) throw new Error('general_notes.csv contains a malformed row');
  return { record, values: parsed.data[0], changed: false, deleted: false };
});
const byRecordId = new Map();
for (const row of csvRows) {
  const recordId = row.values[indexes.record_id] || '';
  if (!recordId || byRecordId.has(recordId)) {
    throw new Error(`Invalid or duplicate general-note record_id: ${recordId}`);
  }
  byRecordId.set(recordId, row);
}

const assertIdentity = (auditRow, csvRow) => {
  if (
    csvRow.values[indexes.insect_id] !== auditRow.insect_id
    || csvRow.values[indexes.note_type] !== auditRow.note_type
    || csvRow.values[indexes.reference] !== auditRow.reference
  ) {
    throw new Error(`Target identity mismatch for ${auditRow.audit_id}`);
  }
};

let pendingReplacements = 0;
let pendingDeletions = 0;
let verifiedHolds = 0;
for (const auditRow of rows) {
  const csvRow = byRecordId.get(auditRow.record_id);
  if (!csvRow) {
    if (auditRow.action === 'exclude_note') continue;
    throw new Error(`Required note is missing for ${auditRow.audit_id}: ${auditRow.record_id}`);
  }
  assertIdentity(auditRow, csvRow);

  const currentContent = csvRow.values[indexes.content] || '';
  const currentPage = csvRow.values[indexes.page] || '';
  const approvedPage = auditRow.printed_page;
  if (auditRow.action === 'replace_note_content') {
    if (currentContent === auditRow.approved_content && currentPage === approvedPage) continue;
    if (currentContent !== auditRow.old_content || currentPage !== '') {
      throw new Error(`Unexpected replacement state for ${auditRow.audit_id}`);
    }
    csvRow.values[indexes.content] = auditRow.approved_content;
    csvRow.values[indexes.page] = approvedPage;
    csvRow.changed = true;
    pendingReplacements += 1;
    continue;
  }

  if (auditRow.action === 'exclude_note') {
    if (currentContent !== auditRow.old_content || currentPage !== '') {
      throw new Error(`Unexpected exclusion state for ${auditRow.audit_id}`);
    }
    csvRow.deleted = true;
    pendingDeletions += 1;
    continue;
  }

  if (currentContent !== auditRow.approved_content || currentPage !== approvedPage) {
    throw new Error(`Unexpected hold state for ${auditRow.audit_id}`);
  }
  verifiedHolds += 1;
}

const outputRecords = [records[0]];
for (const row of csvRows) {
  if (row.deleted) continue;
  if (row.changed) {
    outputRecords.push({
      record: Papa.unparse([row.values], { newline: '' }),
      delimiter: row.record.delimiter,
    });
  } else {
    outputRecords.push(row.record);
  }
}
const result = `${hasBom ? '\ufeff' : ''}${outputRecords
  .map(({ record, delimiter }) => `${record}${delimiter}`)
  .join('')}`;

const outputBody = hasBom ? result.slice(1) : result;
const outputParsed = Papa.parse(outputBody, { header: true, skipEmptyLines: true });
if (outputParsed.errors.length > 0) {
  throw new Error(`Transformed general_notes.csv: ${outputParsed.errors[0].message}`);
}
const outputById = new Map();
for (const row of outputParsed.data) {
  if (!row.record_id || outputById.has(row.record_id)) {
    throw new Error(`Transformed output has an invalid or duplicate record_id: ${row.record_id}`);
  }
  outputById.set(row.record_id, row);
}
for (const auditRow of rows) {
  const row = outputById.get(auditRow.record_id);
  if (auditRow.action === 'exclude_note') {
    if (row) throw new Error(`Excluded note remains after transformation: ${auditRow.record_id}`);
    continue;
  }
  if (
    !row
    || row.insect_id !== auditRow.insect_id
    || row.note_type !== auditRow.note_type
    || row.reference !== auditRow.reference
    || row.content !== auditRow.approved_content
    || row.page !== auditRow.printed_page
  ) {
    throw new Error(`Approved note is not exact after transformation: ${auditRow.record_id}`);
  }
  const issues = collectGeneralNoteIssues(row);
  if (issues.length > 0) {
    throw new Error(`Transformed note fails quality rules for ${auditRow.record_id}: ${issues.join(',')}`);
  }
}

if (!CHECK_ONLY && result !== source) {
  const temporaryPath = `${NOTES_PATH}.tmp-${process.pid}-${crypto.randomUUID()}`;
  try {
    fs.writeFileSync(temporaryPath, result, {
      encoding: 'utf8',
      mode: fs.statSync(NOTES_PATH).mode,
      flag: 'wx',
    });
    fs.renameSync(temporaryPath, NOTES_PATH);
  } catch (error) {
    try {
      if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
    } catch {
      // Preserve the original write error.
    }
    throw error;
  }
}

console.log(JSON.stringify({
  audit_version: audit.audit_version,
  audit_rows: rows.length,
  pending_replacements: pendingReplacements,
  pending_deletions: pendingDeletions,
  verified_holds: verifiedHolds,
  check_only: CHECK_ONLY,
  changed: !CHECK_ONLY && result !== source,
  would_change: result !== source,
  source_pdfs_verified: verifiedPdfReferences,
}, null, 2));

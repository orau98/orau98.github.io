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

const resolvePath = (envName, fallback) => process.env[envName]
  ? path.resolve(process.env[envName])
  : path.join(ROOT, fallback);

const NOTES_PATH = resolvePath('JMSG1_NOTES_PATH', 'normalized_data/general_notes.csv');
const AUDIT_PATH = resolvePath(
  'JMSG1_AUDIT_PATH',
  'data/source_audits/japanese-moths-standard-guide-1-note-integrity-2026-07-12.json',
);
const PDF_PATH = process.env.JMSG1_PDF_PATH
  ? path.resolve(process.env.JMSG1_PDF_PATH)
  : null;
const PRODUCTION_AUDIT_PATH = path.join(
  ROOT,
  'data',
  'source_audits',
  'japanese-moths-standard-guide-1-note-integrity-2026-07-12.json',
);
const EXPECTED_PRODUCTION_LEDGER_SHA256 = '7923b6431c35e61d7a754c843c14557630022d166bde980cf80f2aa3b849720d';
const EXPECTED_SOURCE_PDF_SHA256 = '35e3a46b1c91a6f16a6aff7522be708ed8a94ccfc8dc39d23c3d3e9171cfd0d9';
const EXPECTED_COUNTS = new Map([
  ['replace', 29],
  ['delete', 2],
]);
const CHECK_ONLY = process.argv.includes('--check');
const unknownArguments = process.argv.slice(2).filter((argument) => argument !== '--check');
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

const rawAudit = fs.readFileSync(AUDIT_PATH, 'utf8');
let audit;
try {
  audit = JSON.parse(rawAudit);
} catch (error) {
  throw new Error(`${path.basename(AUDIT_PATH)}: ${error.message}`);
}

if (audit.audit_version !== '2026-07-12') throw new Error('Unexpected audit_version');
if (audit.reference !== '日本産蛾類標準図鑑1') throw new Error('Unexpected reference');
if (audit.note_type !== '生態情報') throw new Error('Unexpected note_type');
if (audit.reviewed_on !== '2026-07-12') throw new Error('Unexpected reviewed_on');
if (audit.source_pdf?.filename !== '日本産蛾類標準図鑑1 2.pdf') {
  throw new Error('Unexpected source PDF filename');
}
if (audit.source_pdf?.sha256 !== EXPECTED_SOURCE_PDF_SHA256) {
  throw new Error('Unexpected source PDF SHA-256 in audit');
}
if (audit.source_pdf?.page_count !== 115) throw new Error('Unexpected source PDF page count');
if (!Array.isArray(audit.entries)) throw new Error('Audit entries must be an array');

const expectedTotal = [...EXPECTED_COUNTS.values()].reduce((sum, count) => sum + count, 0);
if (audit.scope?.expected_entries !== expectedTotal || audit.entries.length !== expectedTotal) {
  throw new Error(`Expected ${expectedTotal} audit entries; found ${audit.entries.length}`);
}
for (const [action, expected] of EXPECTED_COUNTS) {
  if (audit.scope?.expected_actions?.[action] !== expected) {
    throw new Error(`Audit scope must declare ${expected} ${action} entries`);
  }
}
const excludedFalsePositives = audit.scope?.excluded_false_positives;
if (
  !Array.isArray(excludedFalsePositives)
  || excludedFalsePositives.length !== 1
  || !excludedFalsePositives.includes('note-900401')
) {
  throw new Error('Unexpected false-positive exclusion set');
}

const auditIds = new Set();
const auditRecordIds = new Set();
const actionCounts = new Map();
for (const entry of audit.entries) {
  if (!entry.audit_id || auditIds.has(entry.audit_id)) {
    throw new Error(`Invalid or duplicate audit_id: ${entry.audit_id}`);
  }
  auditIds.add(entry.audit_id);
  if (!entry.record_id || auditRecordIds.has(entry.record_id)) {
    throw new Error(`Invalid or duplicate record_id: ${entry.record_id}`);
  }
  auditRecordIds.add(entry.record_id);
  if (!entry.insect_id || !entry.japanese_name || !entry.decision) {
    throw new Error(`Incomplete audit identity or decision for ${entry.audit_id}`);
  }
  if (!EXPECTED_COUNTS.has(entry.action)) {
    throw new Error(`Unsupported action for ${entry.audit_id}: ${entry.action}`);
  }
  if (!entry.expected_content) throw new Error(`Missing expected_content for ${entry.audit_id}`);
  if (entry.expected_page !== '') throw new Error(`Expected legacy page must be blank for ${entry.audit_id}`);
  const location = entry.source_location;
  if (
    !location
    || !Array.isArray(location.pdf_pages)
    || location.pdf_pages.length === 0
    || !location.pdf_pages.every((page) => Number.isInteger(page) && page >= 1 && page <= 115)
    || !Array.isArray(location.printed_pages)
    || location.printed_pages.length === 0
    || !location.printed_pages.every((page) => Number.isInteger(page) && page > 0)
    || !Array.isArray(location.columns)
    || location.columns.length === 0
    || !location.columns.every((column) => Number.isInteger(column) && column >= 1 && column <= 4)
  ) {
    throw new Error(`Invalid source_location for ${entry.audit_id}`);
  }
  if (entry.action === 'replace') {
    if (!entry.approved_content || entry.approved_content === entry.expected_content) {
      throw new Error(`Invalid approved_content for ${entry.audit_id}`);
    }
    const firstPrinted = location.printed_pages[0];
    const lastPrinted = location.printed_pages.at(-1);
    const expectedApprovedPage = firstPrinted === lastPrinted
      ? `${firstPrinted}`
      : `${firstPrinted}-${lastPrinted}`;
    if (entry.approved_page !== expectedApprovedPage) {
      throw new Error(`Approved page does not match source pages for ${entry.audit_id}`);
    }
    const issues = collectGeneralNoteIssues({
      note_type: audit.note_type,
      content: entry.approved_content,
      page: entry.approved_page,
    });
    if (issues.length > 0) {
      throw new Error(`Approved content fails quality rules for ${entry.audit_id}: ${issues.join(',')}`);
    }
  } else if (entry.approved_content !== '' || entry.approved_page !== '') {
    throw new Error(`Delete entry must not contain approved data for ${entry.audit_id}`);
  }
  actionCounts.set(entry.action, (actionCounts.get(entry.action) || 0) + 1);
}
for (const excludedId of excludedFalsePositives) {
  if (auditRecordIds.has(excludedId)) throw new Error(`Excluded false positive is still targeted: ${excludedId}`);
}
for (const [action, expected] of EXPECTED_COUNTS) {
  const actual = actionCounts.get(action) || 0;
  if (actual !== expected) throw new Error(`Expected ${expected} ${action} entries; found ${actual}`);
}

const enforceProductionAudit = path.resolve(AUDIT_PATH) === path.resolve(PRODUCTION_AUDIT_PATH)
  || process.env.JMSG1_ENFORCE_PRODUCTION === '1';
if (enforceProductionAudit) {
  const ledgerSha256 = crypto.createHash('sha256').update(rawAudit).digest('hex');
  if (ledgerSha256 !== EXPECTED_PRODUCTION_LEDGER_SHA256) {
    throw new Error(`Production audit SHA-256 mismatch: ${ledgerSha256}`);
  }
}
if (PDF_PATH) {
  const pdfSha256 = sha256File(PDF_PATH);
  if (pdfSha256 !== audit.source_pdf.sha256) {
    throw new Error(`Source PDF SHA-256 mismatch: ${pdfSha256}`);
  }
}

const source = fs.readFileSync(NOTES_PATH, 'utf8');
const hasBom = source.charCodeAt(0) === 0xfeff;
const body = hasBom ? source.slice(1) : source;
const records = splitCsvRecordsWithDelimiters(body);
if (records.length === 0) throw new Error('general_notes.csv is empty');

const headerParsed = Papa.parse(records[0].record);
if (headerParsed.errors.length > 0) throw new Error(`general_notes.csv: ${headerParsed.errors[0].message}`);
const header = headerParsed.data[0];
const indexes = Object.fromEntries(header.map((name, index) => [name, index]));
for (const column of ['record_id', 'insect_id', 'note_type', 'content', 'reference', 'page']) {
  if (indexes[column] === undefined) throw new Error(`general_notes.csv is missing ${column}`);
}

const rows = records.slice(1).filter((record) => record.record).map((record) => {
  const parsed = Papa.parse(record.record);
  if (parsed.errors.length > 0) throw new Error(`general_notes.csv: ${parsed.errors[0].message}`);
  if (parsed.data.length !== 1) throw new Error('general_notes.csv contains a malformed row');
  return { record, values: parsed.data[0], changed: false, deleted: false };
});
const byRecordId = new Map();
for (const row of rows) {
  const recordId = row.values[indexes.record_id] || '';
  if (!recordId || byRecordId.has(recordId)) {
    throw new Error(`Invalid or duplicate general-note record_id: ${recordId}`);
  }
  byRecordId.set(recordId, row);
}

let pendingReplacements = 0;
let pendingDeletions = 0;
for (const entry of audit.entries) {
  const row = byRecordId.get(entry.record_id);
  if (!row) {
    if (entry.action === 'delete') continue;
    throw new Error(`Required note is missing for ${entry.audit_id}: ${entry.record_id}`);
  }
  if (
    row.values[indexes.insect_id] !== entry.insect_id
    || row.values[indexes.note_type] !== audit.note_type
    || row.values[indexes.reference] !== audit.reference
  ) {
    throw new Error(`Target identity mismatch for ${entry.audit_id}`);
  }
  const currentContent = row.values[indexes.content] || '';
  const currentPage = row.values[indexes.page] || '';
  if (entry.action === 'delete') {
    if (currentContent !== entry.expected_content || currentPage !== entry.expected_page) {
      throw new Error(`Unexpected delete state for ${entry.audit_id}`);
    }
    row.deleted = true;
    pendingDeletions += 1;
    continue;
  }
  if (currentContent === entry.approved_content && currentPage === entry.approved_page) continue;
  if (currentContent !== entry.expected_content || currentPage !== entry.expected_page) {
    throw new Error(`Unexpected replacement state for ${entry.audit_id}`);
  }
  row.values[indexes.content] = entry.approved_content;
  row.values[indexes.page] = entry.approved_page;
  row.changed = true;
  pendingReplacements += 1;
}

const outputRecords = [records[0]];
for (const row of rows) {
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
for (const entry of audit.entries) {
  const row = outputById.get(entry.record_id);
  if (entry.action === 'delete') {
    if (row) throw new Error(`Deleted note remains after transformation: ${entry.record_id}`);
    continue;
  }
  if (
    !row
    || row.insect_id !== entry.insect_id
    || row.note_type !== audit.note_type
    || row.reference !== audit.reference
    || row.content !== entry.approved_content
    || row.page !== entry.approved_page
  ) {
    throw new Error(`Approved note is not exact after transformation: ${entry.record_id}`);
  }
  const issues = collectGeneralNoteIssues(row);
  if (issues.length > 0) {
    throw new Error(`Transformed note fails quality rules for ${entry.record_id}: ${issues.join(',')}`);
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
  audit_entries: audit.entries.length,
  pending_replacements: pendingReplacements,
  pending_deletions: pendingDeletions,
  check_only: CHECK_ONLY,
  changed: !CHECK_ONLY && result !== source,
  source_pdf_verified: Boolean(PDF_PATH),
}, null, 2));

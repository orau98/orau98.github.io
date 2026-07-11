import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Papa from 'papaparse';

import { splitCsvRecordsWithDelimiters } from './lib/csvRecords.mjs';
import { collectGeneralNoteIssues } from './lib/generalNoteQuality.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const resolvePath = (environmentName, fallback) => process.env[environmentName]
  ? path.resolve(process.env[environmentName])
  : path.join(ROOT, fallback);

const NOTES_PATH = resolvePath('JMSG2_FULL_NOTES_PATH', 'normalized_data/general_notes.csv');
const AUDIT_PATH = resolvePath(
  'JMSG2_FULL_AUDIT_PATH',
  'data/source_audits/japanese-moths-standard-guide-2-full-note-integrity-2026-07-12.json',
);
const PDF_PATH = process.env.JMSG2_FULL_PDF_PATH
  ? path.resolve(process.env.JMSG2_FULL_PDF_PATH)
  : null;
const PRODUCTION_AUDIT_PATH = path.join(
  ROOT,
  'data/source_audits/japanese-moths-standard-guide-2-full-note-integrity-2026-07-12.json',
);
const EXPECTED_LEDGER_SHA256 = 'e0147388fe86539a4ee140671630a9fb595d69de136180ec079e8c0211abd930';
const EXPECTED_PDF_SHA256 = '2d24a2870a7f890cb4af8d79b55dfc7fe6215607f6d70bbdcd41ca02db8eb5f9';
const EXPECTED_ACTIONS = new Map([
  ['replace_note_content', 233],
  ['hold_no_change', 4],
]);
const CHECK_ONLY = process.argv.includes('--check');
const unknownArguments = process.argv.slice(2).filter((argument) => argument !== '--check');
if (unknownArguments.length > 0) throw new Error(`Unknown arguments: ${unknownArguments.join(', ')}`);

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

if (audit.audit_version !== '2026-07-12' || audit.reviewed_on !== '2026-07-12') {
  throw new Error('Unexpected audit identity');
}
if (audit.reference !== '日本産蛾類標準図鑑2') throw new Error('Unexpected reference');
if (audit.source_pdf?.filename !== '日本産蛾類標準図鑑2.pdf') throw new Error('Unexpected source PDF filename');
if (audit.source_pdf?.sha256 !== EXPECTED_PDF_SHA256 || audit.source_pdf?.page_count !== 143) {
  throw new Error('Unexpected source PDF profile');
}
if (
  audit.scope?.total_reference_rows !== 2055
  || audit.scope?.ecology_rows !== 1005
  || audit.scope?.emergence_rows !== 1050
  || audit.scope?.reviewed_candidates !== 237
  || audit.scope?.reviewed_ecology_candidates !== 184
  || audit.scope?.reviewed_emergence_candidates !== 53
) {
  throw new Error('Unexpected audit scan profile');
}
if (!Array.isArray(audit.entries) || audit.entries.length !== 237) {
  throw new Error(`Expected 237 entries; found ${audit.entries?.length}`);
}

const auditIds = new Set();
const recordIds = new Set();
const actionCounts = new Map();
for (const entry of audit.entries) {
  if (!entry.audit_id || auditIds.has(entry.audit_id)) throw new Error(`Invalid audit_id: ${entry.audit_id}`);
  auditIds.add(entry.audit_id);
  if (!entry.record_id || recordIds.has(entry.record_id)) throw new Error(`Invalid record_id: ${entry.record_id}`);
  recordIds.add(entry.record_id);
  if (!EXPECTED_ACTIONS.has(entry.action)) throw new Error(`Unsupported action for ${entry.audit_id}`);
  if (
    !entry.insect_id
    || !entry.japanese_name
    || !['生態情報', '出現時期'].includes(entry.note_type)
    || entry.reference !== audit.reference
    || typeof entry.expected_content !== 'string'
    || typeof entry.expected_page !== 'string'
    || typeof entry.approved_content !== 'string'
    || typeof entry.approved_page !== 'string'
    || !entry.decision
  ) {
    throw new Error(`Incomplete entry identity for ${entry.audit_id}`);
  }
  const location = entry.source_location;
  if (
    !location
    || !Array.isArray(location.pdf_pages)
    || location.pdf_pages.length === 0
    || !location.pdf_pages.every((page) => Number.isInteger(page) && page >= 1 && page <= 143)
    || !Array.isArray(location.printed_pages)
    || location.printed_pages.length === 0
    || !location.printed_pages.every((page) => Number.isInteger(page) && page > 0)
    || !Array.isArray(location.columns)
    || location.columns.length === 0
    || !location.columns.every((column) => Number.isInteger(column) && column >= 1 && column <= 4)
  ) {
    throw new Error(`Invalid source location for ${entry.audit_id}`);
  }
  const scope = entry.source_scope;
  if (
    scope?.source_level !== 'species_account'
    || scope?.subspecies_explicit_in_source !== false
    || !Array.isArray(scope.applied_targets)
    || scope.applied_targets.length !== 1
    || scope.applied_targets[0]?.insect_id !== entry.insect_id
    || !Array.isArray(scope.excluded_targets)
    || !scope.rationale
  ) {
    throw new Error(`Invalid source scope for ${entry.audit_id}`);
  }
  if (entry.action === 'replace_note_content') {
    if (!entry.approved_content || entry.approved_content === entry.expected_content || !entry.approved_page) {
      throw new Error(`Invalid replacement for ${entry.audit_id}`);
    }
    const issues = collectGeneralNoteIssues({
      note_type: entry.note_type,
      content: entry.approved_content,
      page: entry.approved_page,
    });
    if (issues.length > 0) {
      throw new Error(`Approved content fails quality rules for ${entry.audit_id}: ${issues.join(',')}`);
    }
  } else if (
    entry.approved_content !== entry.expected_content
    || entry.approved_page !== entry.expected_page
  ) {
    throw new Error(`Hold state differs for ${entry.audit_id}`);
  }
  actionCounts.set(entry.action, (actionCounts.get(entry.action) || 0) + 1);
}
for (const [action, expected] of EXPECTED_ACTIONS) {
  if ((actionCounts.get(action) || 0) !== expected || audit.scope.expected_actions?.[action] !== expected) {
    throw new Error(`Action profile mismatch for ${action}`);
  }
}

const enforceProduction = path.resolve(AUDIT_PATH) === path.resolve(PRODUCTION_AUDIT_PATH)
  || process.env.JMSG2_FULL_ENFORCE_PRODUCTION === '1';
if (enforceProduction) {
  const digest = crypto.createHash('sha256').update(rawAudit).digest('hex');
  if (digest !== EXPECTED_LEDGER_SHA256) throw new Error(`Production audit SHA-256 mismatch: ${digest}`);
}
if (PDF_PATH && sha256File(PDF_PATH) !== EXPECTED_PDF_SHA256) {
  throw new Error(`Source PDF SHA-256 mismatch: ${sha256File(PDF_PATH)}`);
}

const source = fs.readFileSync(NOTES_PATH, 'utf8');
const hasBom = source.charCodeAt(0) === 0xfeff;
const records = splitCsvRecordsWithDelimiters(hasBom ? source.slice(1) : source);
if (records.length === 0) throw new Error('general_notes.csv is empty');
const headerResult = Papa.parse(records[0].record);
if (headerResult.errors.length > 0) throw new Error(`general_notes.csv: ${headerResult.errors[0].message}`);
const indexes = Object.fromEntries(headerResult.data[0].map((name, index) => [name, index]));
for (const column of ['record_id', 'insect_id', 'note_type', 'content', 'reference', 'page']) {
  if (indexes[column] === undefined) throw new Error(`general_notes.csv is missing ${column}`);
}
const rows = records.slice(1).filter((record) => record.record).map((record) => {
  const parsed = Papa.parse(record.record);
  if (parsed.errors.length > 0 || parsed.data.length !== 1) throw new Error('general_notes.csv contains a malformed row');
  return { record, values: parsed.data[0], changed: false };
});
const byId = new Map();
for (const row of rows) {
  const recordId = row.values[indexes.record_id] || '';
  if (!recordId || byId.has(recordId)) throw new Error(`Invalid or duplicate record_id: ${recordId}`);
  byId.set(recordId, row);
}

let pendingReplacements = 0;
let verifiedHolds = 0;
for (const entry of audit.entries) {
  const row = byId.get(entry.record_id);
  if (!row) throw new Error(`Required note is missing for ${entry.audit_id}`);
  if (
    row.values[indexes.insect_id] !== entry.insect_id
    || row.values[indexes.note_type] !== entry.note_type
    || row.values[indexes.reference] !== entry.reference
  ) {
    throw new Error(`Target identity mismatch for ${entry.audit_id}`);
  }
  const currentContent = row.values[indexes.content] || '';
  const currentPage = row.values[indexes.page] || '';
  if (entry.action === 'hold_no_change') {
    if (currentContent !== entry.expected_content || currentPage !== entry.expected_page) {
      throw new Error(`Unexpected hold state for ${entry.audit_id}`);
    }
    verifiedHolds += 1;
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

const outputRecords = [records[0], ...rows.map((row) => row.changed ? {
  record: Papa.unparse([row.values], { newline: '' }), delimiter: row.record.delimiter,
} : row.record)];
const result = `${hasBom ? '\ufeff' : ''}${outputRecords.map(({ record, delimiter }) => `${record}${delimiter}`).join('')}`;
const parsedOutput = Papa.parse((hasBom ? result.slice(1) : result), { header: true, skipEmptyLines: true });
if (parsedOutput.errors.length > 0) throw new Error(`Transformed CSV: ${parsedOutput.errors[0].message}`);
const outputById = new Map(parsedOutput.data.map((row) => [row.record_id, row]));
for (const entry of audit.entries) {
  const row = outputById.get(entry.record_id);
  if (
    !row
    || row.insect_id !== entry.insect_id
    || row.note_type !== entry.note_type
    || row.reference !== entry.reference
    || row.content !== entry.approved_content
    || row.page !== entry.approved_page
  ) {
    throw new Error(`Approved note is not exact after transformation: ${entry.record_id}`);
  }
  if (entry.action === 'replace_note_content') {
    const issues = collectGeneralNoteIssues(row);
    if (issues.length > 0) throw new Error(`Transformed note fails quality rules for ${entry.record_id}: ${issues.join(',')}`);
  }
}

if (!CHECK_ONLY && result !== source) {
  const temporaryPath = `${NOTES_PATH}.tmp-${process.pid}-${crypto.randomUUID()}`;
  try {
    fs.writeFileSync(temporaryPath, result, { encoding: 'utf8', mode: fs.statSync(NOTES_PATH).mode, flag: 'wx' });
    fs.renameSync(temporaryPath, NOTES_PATH);
  } catch (error) {
    try { if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath); } catch { /* keep original error */ }
    throw error;
  }
}

console.log(JSON.stringify({
  audit_entries: audit.entries.length,
  pending_replacements: pendingReplacements,
  verified_holds: verifiedHolds,
  check_only: CHECK_ONLY,
  changed: !CHECK_ONLY && result !== source,
  would_change: result !== source,
  source_pdf_verified: Boolean(PDF_PATH),
}, null, 2));

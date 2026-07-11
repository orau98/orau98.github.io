import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Papa from 'papaparse';

import { splitCsvRecordsWithDelimiters } from './lib/csvRecords.mjs';
import { collectGeneralNoteIssues } from './lib/generalNoteQuality.mjs';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.join(path.dirname(__filename), '..');

const SOURCE = '日本のハマキガ1';
const EXPECTED_ROWS = 33;
const EXPECTED_PDF_SHA256 = '78f75fd532ace774cff181d573c96c04052e1c65dd77a352ec520d7cd33de646';
const EXPECTED_LEDGER_SHA256 = 'b85e026c96061e765c6bb5fcd16b4f861cc1985801d55b5a0f9fb8ca31187ffd';
const EDITORIAL_PATTERN = /幼生期(?:について)?(?:の形態)?は?，?駒井ら\(2011\)に詳しい/;

const resolvePath = (envName, fallback) => process.env[envName]
  ? path.resolve(process.env[envName])
  : path.join(ROOT, fallback);

const NOTES_PATH = resolvePath(
  'HAMAKIGA1_EDITORIAL_NOTES_PATH',
  'normalized_data/general_notes.csv',
);
const AUDIT_PATH = resolvePath(
  'HAMAKIGA1_EDITORIAL_AUDIT_PATH',
  'data/source_audits/japanese-tortricid-moths-1-editorial-cleanup-2026-07-12.csv',
);
const PRODUCTION_AUDIT_PATH = path.join(
  ROOT,
  'data',
  'source_audits',
  'japanese-tortricid-moths-1-editorial-cleanup-2026-07-12.csv',
);
const PDF_PATH = process.env.HAMAKIGA1_EDITORIAL_PDF_PATH
  ? path.resolve(process.env.HAMAKIGA1_EDITORIAL_PDF_PATH)
  : null;
const CHECK_ONLY = process.argv.includes('--check');
const unknownArguments = process.argv.slice(2).filter(argument => argument !== '--check');
if (unknownArguments.length > 0) {
  throw new Error(`Unknown arguments: ${unknownArguments.join(', ')}`);
}

const hashFile = (filePath) => crypto.createHash('sha256')
  .update(fs.readFileSync(filePath))
  .digest('hex');

const readCsv = (filePath) => {
  const parsed = Papa.parse(
    fs.readFileSync(filePath, 'utf8').replace(/^\ufeff/, ''),
    { header: true, skipEmptyLines: true },
  );
  if (parsed.errors.length > 0) {
    throw new Error(`${path.basename(filePath)}: ${parsed.errors[0].message}`);
  }
  return parsed.data;
};

const auditRows = readCsv(AUDIT_PATH);
const auditIds = new Set();
const targetKeys = new Set();
for (const row of auditRows) {
  if (!row.audit_id || auditIds.has(row.audit_id)) {
    throw new Error(`Invalid or duplicate audit_id: ${row.audit_id}`);
  }
  auditIds.add(row.audit_id);
  const targetKey = [row.insect_id, row.note_type, row.reference].join('\u0000');
  if (!row.record_id || !row.insect_id || targetKeys.has(targetKey)) {
    throw new Error(`Invalid or duplicate target: ${row.audit_id}`);
  }
  targetKeys.add(targetKey);
  if (
    row.reference !== SOURCE
    || row.note_type !== '生態情報'
    || !row.japanese_name
    || row.pdf_sha256 !== EXPECTED_PDF_SHA256
    || !row.pdf_file
    || !/^\d+$/.test(row.pdf_page)
    || !/^\d+$/.test(row.printed_page)
    || !row.evidence
    || row.decision !== 'remove_editorial_further_reading_retain_ecology'
    || row.reviewed_on !== '2026-07-12'
  ) {
    throw new Error(`Incomplete audit provenance: ${row.audit_id}`);
  }
  if (!EDITORIAL_PATTERN.test(row.old_content || '')) {
    throw new Error(`Old content lacks the targeted editorial sentence: ${row.audit_id}`);
  }
  if (!row.approved_content || EDITORIAL_PATTERN.test(row.approved_content)) {
    throw new Error(`Approved content retains editorial guidance: ${row.audit_id}`);
  }
  if (!row.old_content.startsWith(row.approved_content)) {
    throw new Error(`Cleanup changes biological content: ${row.audit_id}`);
  }
  const issues = collectGeneralNoteIssues({
    note_type: row.note_type,
    content: row.approved_content,
    page: row.printed_page,
  });
  if (issues.length > 0) {
    throw new Error(`Approved content fails quality rules for ${row.audit_id}: ${issues.join(',')}`);
  }
}

const enforceProductionAudit = path.resolve(AUDIT_PATH) === path.resolve(PRODUCTION_AUDIT_PATH)
  || process.env.HAMAKIGA1_EDITORIAL_ENFORCE_PRODUCTION === '1';
if (enforceProductionAudit) {
  if (auditRows.length !== EXPECTED_ROWS) {
    throw new Error(`Expected ${EXPECTED_ROWS} production audit rows; found ${auditRows.length}`);
  }
  const actualLedgerSha256 = hashFile(AUDIT_PATH);
  if (actualLedgerSha256 !== EXPECTED_LEDGER_SHA256) {
    throw new Error(`Production audit SHA-256 mismatch: ${actualLedgerSha256}`);
  }
}
if (PDF_PATH) {
  const actualPdfSha256 = hashFile(PDF_PATH);
  if (actualPdfSha256 !== EXPECTED_PDF_SHA256) {
    throw new Error(`Source PDF SHA-256 mismatch: ${actualPdfSha256}`);
  }
}

const source = fs.readFileSync(NOTES_PATH, 'utf8');
const hasBom = source.charCodeAt(0) === 0xfeff;
const body = hasBom ? source.slice(1) : source;
const records = splitCsvRecordsWithDelimiters(body);
if (records.length === 0) throw new Error('general_notes.csv is empty');
const parsedHeader = Papa.parse(records[0].record);
if (parsedHeader.errors.length > 0) throw new Error('Invalid general_notes.csv header');
const header = parsedHeader.data[0];
const indexes = Object.fromEntries(header.map((name, index) => [name, index]));
for (const column of ['record_id', 'insect_id', 'note_type', 'content', 'reference', 'page', 'year']) {
  if (indexes[column] === undefined) throw new Error(`general_notes.csv is missing ${column}`);
}

const csvRows = records.slice(1).filter(record => record.record).map((record) => {
  const parsed = Papa.parse(record.record);
  if (parsed.errors.length > 0 || parsed.data.length !== 1) {
    throw new Error(`Malformed general_notes.csv row: ${parsed.errors[0]?.message || 'row count'}`);
  }
  return { record, values: parsed.data[0], changed: false };
});
const byRecordId = new Map();
for (const row of csvRows) {
  const id = row.values[indexes.record_id] || '';
  if (!id || byRecordId.has(id)) throw new Error(`Invalid or duplicate record_id: ${id}`);
  byRecordId.set(id, row);
}

const semanticTarget = (audit, row) => (
  row.values[indexes.insect_id] === audit.insect_id
  && row.values[indexes.note_type] === audit.note_type
  && row.values[indexes.reference] === audit.reference
);
const states = [];
for (const audit of auditRows) {
  const candidates = csvRows.filter(row => semanticTarget(audit, row) && (
    (
      row.values[indexes.content] === audit.old_content
      && (row.values[indexes.page] || '') === ''
    )
    || (
      row.values[indexes.content] === audit.approved_content
      && row.values[indexes.page] === audit.printed_page
    )
  ));
  if (candidates.length !== 1) {
    const direct = byRecordId.get(audit.record_id);
    const detail = direct ? 'direct record has an unexpected state' : 'record is missing';
    throw new Error(`Expected one target for ${audit.audit_id}; found ${candidates.length} (${detail})`);
  }
  const row = candidates[0];
  const state = row.values[indexes.content] === audit.approved_content ? 'applied' : 'pending';
  states.push({ audit, row, state });
}

let replaced = 0;
for (const { audit, row, state } of states) {
  if (state === 'applied') continue;
  row.values[indexes.content] = audit.approved_content;
  row.values[indexes.page] = audit.printed_page;
  row.changed = true;
  replaced += 1;
}

const semanticKeys = new Set();
for (const row of csvRows) {
  const key = [
    row.values[indexes.insect_id],
    row.values[indexes.note_type],
    row.values[indexes.content],
    row.values[indexes.reference],
    row.values[indexes.page],
    row.values[indexes.year],
  ].join('\u0000');
  if (semanticKeys.has(key)) throw new Error('Cleanup would create a duplicate general note');
  semanticKeys.add(key);
}

const output = [records[0], ...csvRows.map(row => row.changed ? {
  record: Papa.unparse([row.values], { newline: '' }),
  delimiter: row.record.delimiter,
} : row.record)];
const result = `${hasBom ? '\ufeff' : ''}${output
  .map(({ record, delimiter }) => `${record}${delimiter}`)
  .join('')}`;
if (!CHECK_ONLY && result !== source) fs.writeFileSync(NOTES_PATH, result, 'utf8');

console.log(JSON.stringify({
  audit_rows: auditRows.length,
  pending: replaced,
  applied: auditRows.length - replaced,
  check_only: CHECK_ONLY,
}, null, 2));

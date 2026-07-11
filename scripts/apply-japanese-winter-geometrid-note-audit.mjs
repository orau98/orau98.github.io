import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Papa from 'papaparse';

import { splitCsvRecordsWithDelimiters } from './lib/csvRecords.mjs';
import { collectGeneralNoteIssues } from './lib/generalNoteQuality.mjs';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.join(path.dirname(__filename), '..');

const SOURCE = '日本の冬尺蛾';
const EXPECTED_VERSION = 'japanese-winter-geometrid-all-notes-v1-2026-07-12';
const EXPECTED_LEDGER_SHA256 = 'e55e637d36e29ac04ba4776196df951f7cf1ef42ed0197a23c24638a1912bb0b';
const EXPECTED_PDF_SHA256 = '7f11b77cd05835aa39d4e45dd5130ad58824e40ac0ba782a48d4ac920504d992';
const EXPECTED_PDF_PAGES = 9;
const EXPECTED_ACTIONS = new Map([
  ['replace_note', 9],
  ['verify_and_add_page', 61],
]);
const INFERENCE_PATTERN = /可能性|かもしれな|思われ|おそらく|恐らく|推測|らしい|と考えられ/;
const COLLECTOR_GUIDANCE_PATTERN = /採集難易度|採集は(?:非常に)?困難|採集が困難|ピークを掴めば/;

const resolvePath = (envName, fallback) => process.env[envName]
  ? path.resolve(process.env[envName])
  : path.join(ROOT, fallback);

const NOTES_PATH = resolvePath(
  'WINTER_GEOMETRID_NOTE_AUDIT_NOTES_PATH',
  'normalized_data/general_notes.csv',
);
const AUDIT_PATH = resolvePath(
  'WINTER_GEOMETRID_NOTE_AUDIT_PATH',
  'data/source_audits/japanese-winter-geometrid-all-notes-audit-2026-07-12.json',
);
const PRODUCTION_AUDIT_PATH = path.join(
  ROOT,
  'data',
  'source_audits',
  'japanese-winter-geometrid-all-notes-audit-2026-07-12.json',
);
const PDF_PATH = process.env.WINTER_GEOMETRID_NOTE_AUDIT_PDF_PATH
  ? path.resolve(process.env.WINTER_GEOMETRID_NOTE_AUDIT_PDF_PATH)
  : null;
const CHECK_ONLY = process.argv.includes('--check');
const unknownArguments = process.argv.slice(2).filter(argument => argument !== '--check');
if (unknownArguments.length > 0) {
  throw new Error(`Unknown arguments: ${unknownArguments.join(', ')}`);
}

const hashFile = (filePath) => crypto.createHash('sha256')
  .update(fs.readFileSync(filePath))
  .digest('hex');

const rawAudit = fs.readFileSync(AUDIT_PATH, 'utf8');
let audit;
try {
  audit = JSON.parse(rawAudit);
} catch (error) {
  throw new Error(`${path.basename(AUDIT_PATH)}: ${error.message}`);
}

if (audit.audit_version !== EXPECTED_VERSION) throw new Error('Unexpected audit_version');
if (audit.reviewed_on !== '2026-07-12') throw new Error('Unexpected reviewed_on');
if (audit.reference !== SOURCE) throw new Error('Unexpected reference');
if (!audit.method) throw new Error('Missing audit method');
if (
  audit.source_pdf?.file !== '日本のフユシャク.pdf'
  || audit.source_pdf?.sha256 !== EXPECTED_PDF_SHA256
  || audit.source_pdf?.page_count !== EXPECTED_PDF_PAGES
  || audit.source_pdf?.printed_pages !== '54-70'
  || audit.source_pdf?.role !== 'original_pdf_image_review'
) {
  throw new Error('Unexpected source PDF identity');
}
if (
  audit.scan_scope?.source_accounts !== 35
  || audit.scan_scope?.general_note_rows !== 70
  || audit.scan_scope?.note_type_counts?.出現時期 !== 35
  || audit.scan_scope?.note_type_counts?.生態情報 !== 35
  || audit.scan_scope?.unresolved_or_hold !== 0
) {
  throw new Error('Unexpected scan scope');
}
if (!Array.isArray(audit.rows) || audit.rows.length !== 70) {
  throw new Error(`Expected 70 audit rows; found ${audit.rows?.length}`);
}

const auditIds = new Set();
const recordIds = new Set();
const semanticTargets = new Set();
const actionCounts = new Map();
for (const row of audit.rows) {
  if (!row.audit_id || auditIds.has(row.audit_id)) {
    throw new Error(`Invalid or duplicate audit_id: ${row.audit_id}`);
  }
  auditIds.add(row.audit_id);
  if (!row.record_id || recordIds.has(row.record_id)) {
    throw new Error(`Invalid or duplicate legacy record_id: ${row.record_id}`);
  }
  recordIds.add(row.record_id);
  const semanticTarget = [row.insect_id, row.note_type].join('\u0000');
  if (semanticTargets.has(semanticTarget)) {
    throw new Error(`Duplicate semantic target: ${row.audit_id}`);
  }
  semanticTargets.add(semanticTarget);
  if (!EXPECTED_ACTIONS.has(row.action)) {
    throw new Error(`Unsupported action for ${row.audit_id}: ${row.action}`);
  }
  if (
    !row.insect_id
    || !row.japanese_name
    || !row.scientific_name
    || !['出現時期', '生態情報'].includes(row.note_type)
    || row.taxon_scope !== 'species'
    || !Number.isInteger(row.source_account)
    || row.source_account < 1
    || row.source_account > 35
    || !Array.isArray(row.pdf_pages)
    || row.pdf_pages.length === 0
    || !row.pdf_pages.every(page => Number.isInteger(page) && page >= 1 && page <= 9)
    || !Array.isArray(row.printed_pages)
    || row.printed_pages.length === 0
    || !row.printed_pages.every(page => Number.isInteger(page) && page >= 54 && page <= 70)
    || typeof row.old_content !== 'string'
    || !row.old_content
    || row.old_page !== ''
    || !row.approved_content
    || row.approved_page !== String(row.printed_pages.at(-1))
    || !row.evidence
    || !row.decision
  ) {
    throw new Error(`Incomplete row provenance: ${row.audit_id}`);
  }
  if (row.action === 'replace_note' && row.approved_content === row.old_content) {
    throw new Error(`Replacement does not change content: ${row.audit_id}`);
  }
  if (row.action === 'verify_and_add_page' && row.approved_content !== row.old_content) {
    throw new Error(`Verification row changes content: ${row.audit_id}`);
  }
  const issues = collectGeneralNoteIssues({
    note_type: row.note_type,
    content: row.approved_content,
    page: row.approved_page,
  });
  if (issues.length > 0) {
    throw new Error(`Approved note fails quality rules for ${row.audit_id}: ${issues.join(',')}`);
  }
  if (INFERENCE_PATTERN.test(row.approved_content)) {
    throw new Error(`Approved note retains source inference: ${row.audit_id}`);
  }
  if (COLLECTOR_GUIDANCE_PATTERN.test(row.approved_content)) {
    throw new Error(`Approved note retains collector guidance: ${row.audit_id}`);
  }
  actionCounts.set(row.action, (actionCounts.get(row.action) || 0) + 1);
}
for (const [action, expected] of EXPECTED_ACTIONS) {
  const actual = actionCounts.get(action) || 0;
  if (actual !== expected || audit.scan_scope?.[action] !== expected) {
    throw new Error(`Action profile mismatch for ${action}: ${actual} != ${expected}`);
  }
}

const enforceProductionAudit = path.resolve(AUDIT_PATH) === path.resolve(PRODUCTION_AUDIT_PATH)
  || process.env.WINTER_GEOMETRID_NOTE_AUDIT_ENFORCE_PRODUCTION === '1';
if (enforceProductionAudit) {
  const actualLedgerSha256 = crypto.createHash('sha256').update(rawAudit).digest('hex');
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
const ids = new Set();
for (const row of csvRows) {
  const id = row.values[indexes.record_id] || '';
  if (!id || ids.has(id)) throw new Error(`Invalid or duplicate record_id: ${id}`);
  ids.add(id);
}

const states = [];
for (const auditRow of audit.rows) {
  const targetRows = csvRows.filter(row => (
    row.values[indexes.insect_id] === auditRow.insect_id
    && row.values[indexes.note_type] === auditRow.note_type
    && row.values[indexes.reference] === SOURCE
    && (
      (
        row.values[indexes.content] === auditRow.old_content
        && (row.values[indexes.page] || '') === auditRow.old_page
      )
      || (
        row.values[indexes.content] === auditRow.approved_content
        && row.values[indexes.page] === auditRow.approved_page
      )
    )
  ));
  if (targetRows.length !== 1) {
    throw new Error(`Expected one target for ${auditRow.audit_id}; found ${targetRows.length}`);
  }
  const row = targetRows[0];
  const state = row.values[indexes.page] === auditRow.approved_page
    && row.values[indexes.content] === auditRow.approved_content
    ? 'applied'
    : 'pending';
  states.push({ auditRow, row, state });
}

let changed = 0;
let contentReplaced = 0;
let pageAdded = 0;
for (const { auditRow, row, state } of states) {
  if (state === 'applied') continue;
  if (row.values[indexes.content] !== auditRow.approved_content) contentReplaced += 1;
  if (row.values[indexes.page] !== auditRow.approved_page) pageAdded += 1;
  row.values[indexes.content] = auditRow.approved_content;
  row.values[indexes.page] = auditRow.approved_page;
  row.changed = true;
  changed += 1;
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
  if (semanticKeys.has(key)) throw new Error('Audit would create a duplicate general note');
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
  audit_rows: audit.rows.length,
  changed,
  content_replaced: contentReplaced,
  page_added: pageAdded,
  already_applied: audit.rows.length - changed,
  check_only: CHECK_ONLY,
}, null, 2));

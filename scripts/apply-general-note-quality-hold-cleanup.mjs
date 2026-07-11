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

const NOTES_PATH = resolvePath(
  'GENERAL_NOTE_QUALITY_NOTES_PATH',
  'normalized_data/general_notes.csv',
);
const AUDIT_PATH = resolvePath(
  'GENERAL_NOTE_QUALITY_AUDIT_PATH',
  'data/source_audits/general-note-quality-hold-cleanup-2026-07-12.csv',
);
const PRODUCTION_AUDIT_PATH = path.join(
  ROOT,
  'data',
  'source_audits',
  'general-note-quality-hold-cleanup-2026-07-12.csv',
);
const EXPECTED_PRODUCTION_COUNTS = new Map([
  ['delete', 2],
  ['replace', 3],
]);
const EXPECTED_PRODUCTION_AUDIT_SHA256 = '1e82f7b70e3bd0451466bc42f92355de4bdacd8b0a1613154ac94adb47513e91';
const SUPERSEDING_HAMAKIGA3_AUDIT_PATH = path.join(
  ROOT,
  'data',
  'source_audits',
  'japanese-tortricid-moths-3-general-note-all-rows-2026-07-12.json',
);
const EXPECTED_SUPERSEDING_HAMAKIGA3_SHA256 = '207331e9d65e218f345fb3e2e08f9520d1e0f09f3e22fe52266b7b1af8f17c43';

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
const actionCounts = new Map();
for (const audit of auditRows) {
  if (!audit.audit_id || auditIds.has(audit.audit_id)) {
    throw new Error(`Invalid or duplicate audit_id: ${audit.audit_id}`);
  }
  auditIds.add(audit.audit_id);
  if (!audit.record_id || !audit.insect_id || !audit.reference || !audit.note_type) {
    throw new Error(`Incomplete target identity for ${audit.audit_id}`);
  }
  if (!['delete', 'replace'].includes(audit.action)) {
    throw new Error(`Unsupported action for ${audit.audit_id}: ${audit.action}`);
  }
  if (!audit.expected_content) throw new Error(`Missing expected_content for ${audit.audit_id}`);
  if (audit.action === 'replace') {
    if (!audit.approved_content || audit.approved_content === audit.expected_content) {
      throw new Error(`Invalid approved_content for ${audit.audit_id}`);
    }
    const issues = collectGeneralNoteIssues({
      note_type: '生態情報',
      content: audit.approved_content,
      page: 'ledger-verified',
    });
    if (issues.length > 0) {
      throw new Error(`Approved content fails quality rules for ${audit.audit_id}: ${issues.join(',')}`);
    }
  }
  if (!/^2026-07-12$/.test(audit.reviewed_on || '')) {
    throw new Error(`Invalid reviewed_on for ${audit.audit_id}`);
  }
  actionCounts.set(audit.action, (actionCounts.get(audit.action) || 0) + 1);
}

const enforceProductionAudit = path.resolve(AUDIT_PATH) === path.resolve(PRODUCTION_AUDIT_PATH)
  || process.env.GENERAL_NOTE_QUALITY_ENFORCE_PRODUCTION === '1';
if (enforceProductionAudit) {
  const auditSha256 = crypto.createHash('sha256')
    .update(fs.readFileSync(AUDIT_PATH))
    .digest('hex');
  if (auditSha256 !== EXPECTED_PRODUCTION_AUDIT_SHA256) {
    throw new Error(`Production audit SHA-256 mismatch: ${auditSha256}`);
  }
  const expectedTotal = [...EXPECTED_PRODUCTION_COUNTS.values()]
    .reduce((sum, count) => sum + count, 0);
  if (auditRows.length !== expectedTotal) {
    throw new Error(`Expected ${expectedTotal} production audit rows; found ${auditRows.length}`);
  }
  for (const [action, expected] of EXPECTED_PRODUCTION_COUNTS) {
    const actual = actionCounts.get(action) || 0;
    if (actual !== expected) {
      throw new Error(`Expected ${expected} ${action} rows; found ${actual}`);
    }
  }
  if (auditRows.some((audit) => audit.source_status !== 'source_pdf_not_locally_available')) {
    throw new Error('Production hold-cleanup rows must not imply an unperformed PDF verification');
  }
}

const supersedingApprovedById = new Map();
if (enforceProductionAudit) {
  const supersedingBytes = fs.readFileSync(SUPERSEDING_HAMAKIGA3_AUDIT_PATH);
  const supersedingSha256 = crypto.createHash('sha256').update(supersedingBytes).digest('hex');
  if (supersedingSha256 !== EXPECTED_SUPERSEDING_HAMAKIGA3_SHA256) {
    throw new Error(`Superseding Hamakiga3 audit SHA-256 mismatch: ${supersedingSha256}`);
  }
  const supersedingAudit = JSON.parse(supersedingBytes.toString('utf8'));
  for (const row of supersedingAudit.rows || []) {
    if (row.approved_content) supersedingApprovedById.set(row.record_id, row.approved_content);
  }
}

const source = fs.readFileSync(NOTES_PATH, 'utf8');
const hasBom = source.charCodeAt(0) === 0xfeff;
const body = hasBom ? source.slice(1) : source;
const entries = splitCsvRecordsWithDelimiters(body);
if (entries.length === 0) throw new Error('general_notes.csv is empty');

const header = Papa.parse(entries[0].record).data[0];
const indexes = Object.fromEntries(header.map((name, index) => [name, index]));
for (const column of ['record_id', 'insect_id', 'note_type', 'content', 'reference']) {
  if (indexes[column] === undefined) throw new Error(`general_notes.csv is missing ${column}`);
}

const rows = entries.slice(1).filter((entry) => entry.record).map((entry) => {
  const parsed = Papa.parse(entry.record);
  if (parsed.errors.length > 0) throw new Error(`general_notes.csv: ${parsed.errors[0].message}`);
  return { entry, row: parsed.data[0], changed: false, deleted: false };
});
const byId = new Map();
for (const item of rows) {
  const id = item.row[indexes.record_id] || '';
  if (!id || byId.has(id)) throw new Error(`Invalid or duplicate general-note record_id: ${id}`);
  byId.set(id, item);
}

let deleted = 0;
let replaced = 0;
let superseded = 0;
for (const audit of auditRows) {
  const item = byId.get(audit.record_id);
  if (!item || item.deleted) {
    if (audit.action === 'delete') continue;
    throw new Error(`Required note is missing for ${audit.audit_id}: ${audit.record_id}`);
  }
  if (
    item.row[indexes.insect_id] !== audit.insect_id
    || item.row[indexes.note_type] !== audit.note_type
    || item.row[indexes.reference] !== audit.reference
  ) {
    throw new Error(`Target identity mismatch for ${audit.audit_id}`);
  }
  const current = item.row[indexes.content] || '';
  if (audit.action === 'delete') {
    if (current !== audit.expected_content) {
      throw new Error(`Unexpected delete content for ${audit.audit_id}`);
    }
    item.deleted = true;
    deleted += 1;
    continue;
  }
  if (current === audit.approved_content) continue;
  if (current === supersedingApprovedById.get(audit.record_id)) {
    superseded += 1;
    continue;
  }
  const acceptedBeforeContents = [audit.expected_content, audit.transitional_content]
    .filter(Boolean);
  if (!acceptedBeforeContents.includes(current)) {
    throw new Error(`Unexpected replacement content for ${audit.audit_id}`);
  }
  item.row[indexes.content] = audit.approved_content;
  item.changed = true;
  replaced += 1;
}

const output = [entries[0]];
for (const item of rows) {
  if (item.deleted) continue;
  if (item.changed) {
    output.push({
      record: Papa.unparse([item.row], { newline: '' }),
      delimiter: item.entry.delimiter,
    });
  } else {
    output.push(item.entry);
  }
}
const result = `${hasBom ? '\ufeff' : ''}${output
  .map(({ record, delimiter }) => `${record}${delimiter}`)
  .join('')}`;
if (result !== source) fs.writeFileSync(NOTES_PATH, result, 'utf8');

console.log(JSON.stringify({ audit_rows: auditRows.length, deleted, replaced, superseded }, null, 2));

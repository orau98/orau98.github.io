import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Papa from 'papaparse';

import { splitCsvRecordsWithDelimiters } from './lib/csvRecords.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

const NOTES_PATH = process.env.KIRIGA_EMERGENCE_NOTES_PATH
  ? path.resolve(process.env.KIRIGA_EMERGENCE_NOTES_PATH)
  : path.join(ROOT, 'normalized_data', 'general_notes.csv');
const AUDIT_PATH = process.env.KIRIGA_EMERGENCE_AUDIT_PATH
  ? path.resolve(process.env.KIRIGA_EMERGENCE_AUDIT_PATH)
  : path.join(ROOT, 'data', 'source_audits', 'japan-winter-noctuid-emergence.csv');
const PRODUCTION_AUDIT_PATH = path.join(
  ROOT,
  'data',
  'source_audits',
  'japan-winter-noctuid-emergence.csv',
);
const PDF_PATH = process.env.KIRIGA_EMERGENCE_PDF_PATH
  ? path.resolve(process.env.KIRIGA_EMERGENCE_PDF_PATH)
  : '';
const CHECK_ONLY = process.argv.includes('--check');
const unknownArguments = process.argv.slice(2).filter((argument) => argument !== '--check');
if (unknownArguments.length > 0) throw new Error(`Unknown arguments: ${unknownArguments.join(', ')}`);

const LEGACY_REFERENCE = '日本のキリガ';
const CANONICAL_REFERENCE = '日本の冬夜蛾';
const NOTE_TYPE = '出現時期';
const PDF_FILE = '日本のキリガ.pdf';
const PDF_SHA256 = '8d6fdad849c967ec2ea5659fd1b455ea088e13d7bde74d936bbbea97586d703d';
const PRODUCTION_AUDIT_SHA256 = '43e5a343257ebcff2ca526bf14af06a50fe7d101a9c2cc70474b5ceda856e9b3';
const PRODUCTION_PROFILE = Object.freeze({
  include_canonical: 16,
  include_missing: 3,
  merge_duplicates: 65,
  replace_incorrect: 19,
});

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

const parseCsv = (filePath) => {
  const parsed = Papa.parse(
    fs.readFileSync(filePath, 'utf-8').replace(/\r\n/g, '\n').replace(/\r/g, '\n'),
    { header: true, skipEmptyLines: true },
  );
  if (parsed.errors.length > 0) throw new Error(`${path.basename(filePath)}: ${parsed.errors[0].message}`);
  return parsed.data;
};

const auditRows = parseCsv(AUDIT_PATH);
const auditIds = new Set();
const insectIds = new Set();
const auditByInsectId = new Map();
const replacementIds = new Map();

for (const audit of auditRows) {
  const auditId = (audit.audit_id || '').trim();
  const insectId = (audit.insect_id || '').trim();
  if (!auditId || auditIds.has(auditId)) throw new Error(`Invalid or duplicate audit_id: ${auditId}`);
  if (!insectId || insectIds.has(insectId)) throw new Error(`Invalid or duplicate insect_id: ${insectId}`);
  auditIds.add(auditId);
  insectIds.add(insectId);
  if (audit.canonical_reference !== CANONICAL_REFERENCE) throw new Error(`Reference mismatch for ${auditId}`);
  if (audit.pdf_file !== PDF_FILE || audit.source_pdf_sha256 !== PDF_SHA256) {
    throw new Error(`PDF evidence mismatch for ${auditId}`);
  }
  if (!audit.pdf_page || !audit.printed_page || audit.note_type !== NOTE_TYPE || !audit.approved_content) {
    throw new Error(`Incomplete approved emergence row: ${auditId}`);
  }
  if (!['include_canonical', 'include_missing', 'replace_incorrect', 'merge_duplicates'].includes(audit.decision)) {
    throw new Error(`Unsupported decision for ${auditId}: ${audit.decision}`);
  }
  if (audit.taxon_scope !== 'species_account') throw new Error(`Unexpected taxon scope for ${auditId}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(audit.reviewed_on || '')) throw new Error(`Invalid review date for ${auditId}`);
  auditByInsectId.set(insectId, audit);
  for (const recordId of (audit.replaced_record_ids || '').split(';').map((value) => value.trim()).filter(Boolean)) {
    if (replacementIds.has(recordId)) throw new Error(`Replacement record_id appears twice: ${recordId}`);
    replacementIds.set(recordId, insectId);
  }
}

if (auditRows.length !== 103) throw new Error(`Expected 103 audited species accounts, got ${auditRows.length}`);
for (const [decision, expected] of Object.entries(PRODUCTION_PROFILE)) {
  const actual = auditRows.filter((row) => row.decision === decision).length;
  if (actual !== expected) throw new Error(`Emergence audit ${decision} mismatch: ${actual} != ${expected}`);
}
const enforceProductionAudit = path.resolve(AUDIT_PATH) === path.resolve(PRODUCTION_AUDIT_PATH)
  || process.env.KIRIGA_EMERGENCE_ENFORCE_PRODUCTION === '1';
if (enforceProductionAudit) {
  const actualAuditSha256 = sha256File(AUDIT_PATH);
  if (actualAuditSha256 !== PRODUCTION_AUDIT_SHA256) {
    throw new Error(`Production emergence audit SHA-256 mismatch: ${actualAuditSha256}`);
  }
}
if (PDF_PATH && sha256File(PDF_PATH) !== PDF_SHA256) {
  throw new Error(`Source PDF SHA-256 mismatch: ${PDF_PATH}`);
}

const source = fs.readFileSync(NOTES_PATH, 'utf-8');
const hasBom = source.charCodeAt(0) === 0xfeff;
const body = hasBom ? source.slice(1) : source;
const entries = splitCsvRecordsWithDelimiters(body);
if (entries.length === 0) throw new Error('general_notes.csv is empty');
const header = Papa.parse(entries[0].record).data[0];
const indexes = Object.fromEntries(header.map((name, index) => [name, index]));
for (const column of ['record_id', 'insect_id', 'note_type', 'content', 'reference', 'page', 'year']) {
  if (indexes[column] === undefined) throw new Error(`general_notes.csv is missing ${column}`);
}

const output = [entries[0]];
const seenReplacementIds = new Set();
const seenAppliedIds = new Set();
const allRecordIds = new Set();
let removed = 0;

for (const entry of entries.slice(1)) {
  if (!entry.record) continue;
  const parsed = Papa.parse(entry.record);
  if (parsed.errors.length > 0) throw new Error(`general_notes.csv: ${parsed.errors[0].message}`);
  const row = parsed.data[0];
  const recordId = (row[indexes.record_id] || '').trim();
  if (allRecordIds.has(recordId)) throw new Error(`Duplicate general note record_id before apply: ${recordId}`);
  allRecordIds.add(recordId);

  const insectId = (row[indexes.insect_id] || '').trim();
  const reference = (row[indexes.reference] || '').trim();
  const noteType = (row[indexes.note_type] || '').trim();
  const audit = auditByInsectId.get(insectId);
  const appliedRecordId = audit ? `note-${audit.audit_id}` : '';

  if (audit && recordId === appliedRecordId) {
    if (
      noteType !== NOTE_TYPE || reference !== CANONICAL_REFERENCE ||
      row[indexes.content] !== audit.approved_content || row[indexes.page] !== audit.printed_page ||
      (row[indexes.year] || '') !== ''
    ) {
      throw new Error(`Applied emergence row drifted from audit: ${recordId}`);
    }
    seenAppliedIds.add(insectId);
    output.push(entry);
    continue;
  }

  if (audit && noteType === NOTE_TYPE && [LEGACY_REFERENCE, CANONICAL_REFERENCE].includes(reference)) {
    if (!replacementIds.has(recordId)) {
      throw new Error(`Unaudited winter-noctuid emergence row: ${recordId}`);
    }
    seenReplacementIds.add(recordId);
    removed += 1;
    continue;
  }
  output.push(entry);
}

for (const [recordId, insectId] of replacementIds) {
  if (!seenReplacementIds.has(recordId) && !seenAppliedIds.has(insectId)) {
    throw new Error(`Expected replacement row is missing: ${recordId}`);
  }
}

const delimiter = entries.findLast((entry) => entry.delimiter)?.delimiter || '\r\n';
let added = 0;
for (const audit of auditRows) {
  if (seenAppliedIds.has(audit.insect_id)) continue;
  const appliedRecordId = `note-${audit.audit_id}`;
  if (allRecordIds.has(appliedRecordId)) {
    throw new Error(`Approved record_id is occupied by another row: ${appliedRecordId}`);
  }
  const row = header.map(() => '');
  row[indexes.record_id] = appliedRecordId;
  row[indexes.insect_id] = audit.insect_id;
  row[indexes.note_type] = NOTE_TYPE;
  row[indexes.content] = audit.approved_content;
  row[indexes.reference] = CANONICAL_REFERENCE;
  row[indexes.page] = audit.printed_page;
  row[indexes.year] = '';
  output.push({ record: Papa.unparse([row], { newline: '' }), delimiter });
  added += 1;
}

const result = `${hasBom ? '\ufeff' : ''}${output.map(({ record, delimiter: rowDelimiter }) => `${record}${rowDelimiter}`).join('')}`;
const finalParsed = Papa.parse(result.replace(/^\ufeff/, ''), { header: true, skipEmptyLines: true });
if (finalParsed.errors.length > 0) {
  throw new Error(`Transformed general_notes.csv: ${finalParsed.errors[0].message}`);
}
const finalIds = new Set();
for (const row of finalParsed.data) {
  if (!row.record_id || finalIds.has(row.record_id)) {
    throw new Error(`Invalid or duplicate transformed record_id: ${row.record_id}`);
  }
  finalIds.add(row.record_id);
}
for (const audit of auditRows) {
  const finalRow = finalParsed.data.find((row) => row.record_id === `note-${audit.audit_id}`);
  if (
    !finalRow
    || finalRow.insect_id !== audit.insect_id
    || finalRow.note_type !== NOTE_TYPE
    || finalRow.content !== audit.approved_content
    || finalRow.reference !== CANONICAL_REFERENCE
    || finalRow.page !== audit.printed_page
    || finalRow.year !== ''
  ) {
    throw new Error(`Approved emergence row is not exact after transformation: ${audit.audit_id}`);
  }
}

if (!CHECK_ONLY && result !== source) {
  const temporaryPath = `${NOTES_PATH}.kiriga-emergence-${process.pid}-${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporaryPath, result, {
      encoding: 'utf-8',
      mode: fs.statSync(NOTES_PATH).mode,
      flag: 'wx',
    });
    fs.renameSync(temporaryPath, NOTES_PATH);
  } finally {
    fs.rmSync(temporaryPath, { force: true });
  }
}
console.log(
  `[kiriga-emergence-audit] removed=${removed} added=${added} audited=${auditRows.length}`
  + ` changed=${!CHECK_ONLY && result !== source} check_only=${CHECK_ONLY}`
  + ` source_pdf_verified=${Boolean(PDF_PATH)}`,
);

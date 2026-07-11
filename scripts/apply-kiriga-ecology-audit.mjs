import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Papa from 'papaparse';

import { splitCsvRecordsWithDelimiters } from './lib/csvRecords.mjs';
import {
  collectGeneralNoteIssues,
  normalizeOcrLayoutWhitespace,
} from './lib/generalNoteQuality.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');
const NOTES_PATH = process.env.KIRIGA_ECOLOGY_NOTES_PATH
  ? path.resolve(process.env.KIRIGA_ECOLOGY_NOTES_PATH)
  : path.join(ROOT, 'normalized_data', 'general_notes.csv');
const AUDIT_PATH = process.env.KIRIGA_ECOLOGY_AUDIT_PATH
  ? path.resolve(process.env.KIRIGA_ECOLOGY_AUDIT_PATH)
  : path.join(ROOT, 'data', 'source_audits', 'japan-winter-noctuid-ecology.csv');
const LEGACY_REFERENCE = '日本のキリガ';
const CANONICAL_REFERENCE = '日本の冬夜蛾';
const CANONICAL_NOTE_TYPE = '生態情報';
const SOURCE_PDF_FILE = '日本のキリガ.pdf';
const SOURCE_PDF_SHA256 = '8d6fdad849c967ec2ea5659fd1b455ea088e13d7bde74d936bbbea97586d703d';

const readCsv = (filePath) => {
  const text = fs.readFileSync(filePath, 'utf-8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
  if (parsed.errors.length > 0) {
    throw new Error(`${path.relative(ROOT, filePath)}: ${parsed.errors[0].message}`);
  }
  return parsed.data;
};

const auditRows = readCsv(AUDIT_PATH);
const auditById = new Map();

auditRows.forEach((row) => {
  const recordId = (row.record_id || '').trim();
  if (!recordId) throw new Error('Audit row is missing record_id');
  if (auditById.has(recordId)) throw new Error(`Duplicate audit record_id: ${recordId}`);
  if (row.canonical_reference !== CANONICAL_REFERENCE) throw new Error(`Audit reference mismatch: ${recordId}`);
  if (row.pdf_file !== SOURCE_PDF_FILE) throw new Error(`Audit PDF filename mismatch: ${recordId}`);
  if (row.source_pdf_sha256 !== SOURCE_PDF_SHA256) throw new Error(`Audit PDF hash mismatch: ${recordId}`);
  if (!row.pdf_page?.trim()) throw new Error(`Audit row is missing pdf_page: ${recordId}`);
  if (!row.printed_page?.trim()) throw new Error(`Audit row is missing printed_page: ${recordId}`);
  if (row.note_type !== CANONICAL_NOTE_TYPE) throw new Error(`Audit note type mismatch: ${recordId}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(row.reviewed_on || '')) throw new Error(`Audit review date is invalid: ${recordId}`);
  if (row.decision === 'needs_review') {
    throw new Error(`Audit is not complete: ${recordId} is still needs_review`);
  }
  if (!['include', 'exclude_subjective', 'exclude_source_bleed', 'exclude_unresolved_ocr'].includes(row.decision)) {
    throw new Error(`Unsupported audit decision for ${recordId}: ${row.decision}`);
  }
  if (row.decision === 'include') {
    const approved = normalizeOcrLayoutWhitespace(row.approved_content);
    if (!approved) throw new Error(`Included audit row has no approved_content: ${recordId}`);
    if (approved !== row.approved_content) {
      throw new Error(`Audit content still contains OCR layout whitespace: ${recordId}`);
    }
    const issues = collectGeneralNoteIssues({
      content: approved,
      note_type: CANONICAL_NOTE_TYPE,
      page: row.printed_page,
    });
    if (issues.length > 0) {
      throw new Error(`Audit content is not publishable for ${recordId}: ${issues.join(', ')}`);
    }
  }
  auditById.set(recordId, row);
});

const source = fs.readFileSync(NOTES_PATH, 'utf-8');
const hasBom = source.charCodeAt(0) === 0xfeff;
const body = hasBom ? source.slice(1) : source;
const recordEntries = splitCsvRecordsWithDelimiters(body);
const header = Papa.parse(recordEntries[0].record).data[0];
const indexes = Object.fromEntries(header.map((name, index) => [name, index]));
const requiredColumns = ['record_id', 'insect_id', 'note_type', 'content', 'reference', 'page', 'year'];
requiredColumns.forEach((column) => {
  if (indexes[column] === undefined) throw new Error(`general_notes.csv is missing ${column}`);
});

const seen = new Map();
const output = [recordEntries[0]];

for (const entry of recordEntries.slice(1)) {
  const { record } = entry;
  if (!record) continue;
  const parsedRecord = Papa.parse(record);
  if (parsedRecord.errors.length > 0) {
    throw new Error(`general_notes.csv: ${parsedRecord.errors[0].message}`);
  }
  const parsed = parsedRecord.data[0];
  const recordId = (parsed[indexes.record_id] || '').trim();
  const audit = auditById.get(recordId);

  if (!audit) {
    output.push(entry);
    continue;
  }

  seen.set(recordId, (seen.get(recordId) || 0) + 1);
  if (parsed[indexes.insect_id] !== audit.insect_id) {
    throw new Error(`insect_id mismatch for ${recordId}`);
  }
  const isLegacy = parsed[indexes.reference] === LEGACY_REFERENCE && parsed[indexes.note_type] === '生態';
  const isApplied =
    parsed[indexes.reference] === CANONICAL_REFERENCE &&
    parsed[indexes.note_type] === CANONICAL_NOTE_TYPE;
  if (!isLegacy && !isApplied) throw new Error(`Unexpected source or note type for ${recordId}`);

  if (audit.decision !== 'include') {
    continue;
  }

  if (isApplied) {
    if (
      parsed[indexes.content] !== audit.approved_content ||
      parsed[indexes.page] !== audit.printed_page
    ) {
      throw new Error(`Applied row no longer matches the PDF audit: ${recordId}`);
    }
    output.push(entry);
    continue;
  }

  parsed[indexes.note_type] = CANONICAL_NOTE_TYPE;
  parsed[indexes.content] = audit.approved_content;
  parsed[indexes.reference] = CANONICAL_REFERENCE;
  parsed[indexes.page] = audit.printed_page;
  parsed[indexes.year] = '';
  output.push({
    record: Papa.unparse([parsed], { newline: '' }),
    delimiter: entry.delimiter,
  });
}

auditById.forEach((audit, recordId) => {
  const count = seen.get(recordId) || 0;
  if (count > 1 || (audit.decision === 'include' && count !== 1)) {
    throw new Error(`Unexpected source row count for ${recordId}: ${count}`);
  }
});

const updated = `${hasBom ? '\ufeff' : ''}${output
  .map(({ record, delimiter }) => `${record}${delimiter}`)
  .join('')}`;
fs.writeFileSync(NOTES_PATH, updated, 'utf-8');
console.log(`[kiriga-ecology-audit] applied ${auditRows.length} PDF-audited decisions to normalized_data/general_notes.csv`);

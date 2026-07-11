import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Papa from 'papaparse';

import { splitCsvRecordsWithDelimiters } from './lib/csvRecords.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

const HOSTPLANTS_PATH = process.env.LITERATURE_INTEGRITY_HOSTPLANTS_PATH
  ? path.resolve(process.env.LITERATURE_INTEGRITY_HOSTPLANTS_PATH)
  : path.join(ROOT, 'normalized_data', 'hostplants.csv');
const AUDIT_PATH = process.env.LITERATURE_INTEGRITY_AUDIT_PATH
  ? path.resolve(process.env.LITERATURE_INTEGRITY_AUDIT_PATH)
  : path.join(ROOT, 'data', 'source_audits', 'cross-literature-data-integrity-2026-07-11.csv');
const PRODUCTION_AUDIT_PATH = path.join(
  ROOT,
  'data',
  'source_audits',
  'cross-literature-data-integrity-2026-07-11.csv',
);
const STANDARD_MOTHS_3_PDF_SHA256 = '205b3090c799655004bae148d6931e90a2abb968c85c376b2680ce105ed37850';
const EXPECTED_PRODUCTION_COUNTS = new Map([
  ['update_field', 94],
  ['retire', 2],
  ['delete', 5],
  ['add', 2],
]);

const readCsv = (filePath) => {
  const parsed = Papa.parse(
    fs.readFileSync(filePath, 'utf-8').replace(/\r\n/g, '\n').replace(/\r/g, '\n'),
    { header: true, skipEmptyLines: true },
  );
  if (parsed.errors.length > 0) {
    throw new Error(`${path.relative(ROOT, filePath)}: ${parsed.errors[0].message}`);
  }
  return parsed.data;
};

const auditRows = readCsv(AUDIT_PATH);
const auditIds = new Set();
const actionsByRecordId = new Map();
const addRows = [];
const actionCounts = new Map();

for (const audit of auditRows) {
  const auditId = (audit.audit_id || '').trim();
  const recordId = (audit.record_id || '').trim();
  const insectId = (audit.insect_id || '').trim();
  const action = (audit.action || '').trim();
  const decision = (audit.decision || '').trim();

  if (!auditId || auditIds.has(auditId)) throw new Error(`Invalid or duplicate audit_id: ${auditId}`);
  auditIds.add(auditId);
  if (audit.entity !== 'hostplant') throw new Error(`Unsupported entity for ${auditId}: ${audit.entity}`);
  if (!recordId || !insectId) throw new Error(`Missing record_id/insect_id for ${auditId}`);
  if (![
    'include',
    'exclude_ocr_fragment',
    'exclude_duplicate',
    'replace_ocr_fragment',
    'retired_by_later_full_source_audit',
  ].includes(decision)) {
    throw new Error(`Unsupported decision for ${auditId}: ${decision}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(audit.reviewed_on || '')) {
    throw new Error(`Invalid reviewed_on for ${auditId}`);
  }
  if (audit.source_pdf_file && !audit.source_pdf_sha256) {
    throw new Error(`PDF evidence is missing sha256 for ${auditId}`);
  }
  if (audit.source_pdf_file && (!audit.pdf_page || !audit.printed_page)) {
    throw new Error(`PDF evidence is missing page numbers for ${auditId}`);
  }
  actionCounts.set(action, (actionCounts.get(action) || 0) + 1);

  if (action === 'retire') {
    if (decision !== 'retired_by_later_full_source_audit') {
      throw new Error(`Retired row has an unexpected decision for ${auditId}`);
    }
    continue;
  }

  if (action === 'add') {
    addRows.push(audit);
    continue;
  }
  if (!['update_field', 'delete'].includes(action)) {
    throw new Error(`Unsupported action for ${auditId}: ${action}`);
  }
  if (action === 'update_field' && (!(audit.field || '').trim() || audit.approved_value === undefined)) {
    throw new Error(`Incomplete field update for ${auditId}`);
  }
  const entries = actionsByRecordId.get(recordId) || [];
  entries.push(audit);
  actionsByRecordId.set(recordId, entries);
}

if (path.resolve(AUDIT_PATH) === path.resolve(PRODUCTION_AUDIT_PATH)) {
  const expectedTotal = [...EXPECTED_PRODUCTION_COUNTS.values()]
    .reduce((sum, count) => sum + count, 0);
  if (auditRows.length !== expectedTotal) {
    throw new Error(`Expected ${expectedTotal} production audit rows; found ${auditRows.length}`);
  }
  for (const [action, expected] of EXPECTED_PRODUCTION_COUNTS) {
    const actual = actionCounts.get(action) || 0;
    if (actual !== expected) {
      throw new Error(`Expected ${expected} production ${action} rows; found ${actual}`);
    }
  }
  const pdfBackedRows = auditRows.filter((audit) => audit.source_pdf_file);
  if (pdfBackedRows.length !== 9) {
    throw new Error(`Expected 9 PDF-backed production rows; found ${pdfBackedRows.length}`);
  }
  for (const audit of pdfBackedRows) {
    if (audit.source_pdf_file !== '日本産蛾類標準図鑑Ⅲ_compressed.pdf') {
      throw new Error(`Unexpected production PDF for ${audit.audit_id}`);
    }
    if (audit.source_pdf_sha256 !== STANDARD_MOTHS_3_PDF_SHA256) {
      throw new Error(`Production PDF hash mismatch for ${audit.audit_id}`);
    }
  }
  const inferredReferenceRows = auditRows.filter(
    (audit) => audit.action === 'update_field' && audit.field === 'reference',
  );
  if (inferredReferenceRows.length !== 92 || inferredReferenceRows.some((audit) => audit.source_pdf_file)) {
    throw new Error('Expected exactly 92 provenance-only reference fills without PDF claims');
  }
  const retiredRows = auditRows.filter((audit) => audit.action === 'retire');
  if (
    retiredRows.length !== 2
    || retiredRows.map((audit) => audit.record_id).sort().join(',')
      !== 'hostplant-000530,hostplant-000531'
  ) {
    throw new Error('Expected the two Hamakiga1 semantic duplicates to be retired');
  }
}

const source = fs.readFileSync(HOSTPLANTS_PATH, 'utf-8');
const hasBom = source.charCodeAt(0) === 0xfeff;
const body = hasBom ? source.slice(1) : source;
const entries = splitCsvRecordsWithDelimiters(body);
if (entries.length === 0) throw new Error('hostplants.csv is empty');

const header = Papa.parse(entries[0].record).data[0];
const indexes = Object.fromEntries(header.map((name, index) => [name, index]));
for (const column of ['record_id', 'insect_id', 'plant_name', 'plant_family', 'observation_type', 'plant_part', 'life_stage', 'reference', 'notes']) {
  if (indexes[column] === undefined) throw new Error(`hostplants.csv is missing ${column}`);
}

const output = [entries[0]];
const seen = new Set();
const existingByRecordId = new Map();
let updated = 0;
let deleted = 0;

for (const entry of entries.slice(1)) {
  if (!entry.record) continue;
  const parsed = Papa.parse(entry.record);
  if (parsed.errors.length > 0) throw new Error(`hostplants.csv: ${parsed.errors[0].message}`);
  const row = parsed.data[0];
  const recordId = (row[indexes.record_id] || '').trim();
  if (existingByRecordId.has(recordId)) throw new Error(`Duplicate hostplant record_id: ${recordId}`);
  existingByRecordId.set(recordId, row);

  const actions = actionsByRecordId.get(recordId);
  if (!actions) {
    output.push(entry);
    continue;
  }

  seen.add(recordId);
  const expectedInsectIds = new Set(actions.map((audit) => audit.insect_id));
  if (expectedInsectIds.size !== 1 || !expectedInsectIds.has(row[indexes.insect_id])) {
    throw new Error(`insect_id mismatch for ${recordId}`);
  }
  if (actions.some((audit) => audit.action === 'delete')) {
    if (actions.length !== 1) throw new Error(`Delete cannot be combined with updates for ${recordId}`);
    const [audit] = actions;
    if (audit.reference && row[indexes.reference] !== audit.reference) {
      throw new Error(`Unexpected reference for audited delete ${recordId}`);
    }
    deleted += 1;
    continue;
  }

  for (const audit of actions) {
    const field = audit.field.trim();
    if (indexes[field] === undefined) throw new Error(`Unknown hostplant field ${field} for ${audit.audit_id}`);
    const current = row[indexes[field]] || '';
    const approved = audit.approved_value || '';
    if (current === approved) continue;
    // All production field repairs fill a previously blank value. Refuse to
    // overwrite later/manual corrections that are not represented by this ledger.
    if (current !== '') {
      throw new Error(`Unexpected existing value for ${audit.audit_id}: ${field}=${current}`);
    }
    row[indexes[field]] = approved;
    updated += 1;
  }
  output.push({ record: Papa.unparse([row], { newline: '' }), delimiter: entry.delimiter });
}

for (const [recordId, actions] of actionsByRecordId) {
  if (seen.has(recordId)) continue;
  if (actions.length === 1 && actions[0].action === 'delete') continue;
  throw new Error(`Required source row is missing: ${recordId}`);
}

let added = 0;
const defaultDelimiter = entries.findLast((entry) => entry.delimiter)?.delimiter || '\r\n';
for (const audit of addRows) {
  const existing = existingByRecordId.get(audit.record_id);
  const expected = {
    record_id: audit.record_id,
    insect_id: audit.insect_id,
    plant_name: audit.plant_name || '',
    plant_family: audit.plant_family || '',
    observation_type: audit.observation_type || '',
    plant_part: audit.plant_part || '',
    life_stage: audit.life_stage || '',
    reference: audit.reference || '',
    notes: audit.notes || '',
  };
  if (existing) {
    for (const [field, value] of Object.entries(expected)) {
      if ((existing[indexes[field]] || '') !== value) {
        throw new Error(`Existing added row does not match audit: ${audit.record_id}.${field}`);
      }
    }
    continue;
  }
  const row = header.map(() => '');
  for (const [field, value] of Object.entries(expected)) row[indexes[field]] = value;
  output.push({ record: Papa.unparse([row], { newline: '' }), delimiter: defaultDelimiter });
  added += 1;
}

const result = `${hasBom ? '\ufeff' : ''}${output.map(({ record, delimiter }) => `${record}${delimiter}`).join('')}`;
fs.writeFileSync(HOSTPLANTS_PATH, result, 'utf-8');
console.log(`[cross-literature-integrity] updated=${updated} deleted=${deleted} added=${added}`);

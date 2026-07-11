#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Papa from 'papaparse';

import { splitCsvRecordsWithDelimiters } from './lib/csvRecords.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

const DATA_ROOT = process.env.APHID_P0_DATA_ROOT
  ? path.resolve(process.env.APHID_P0_DATA_ROOT)
  : ROOT;
const DEFAULT_AUDIT_PATH = path.join(
  ROOT,
  'data',
  'source_audits',
  'japanese-aphid-p0-integrity-2026-07-12.csv',
);
const AUDIT_PATH = process.env.APHID_P0_AUDIT_PATH
  ? path.resolve(process.env.APHID_P0_AUDIT_PATH)
  : DEFAULT_AUDIT_PATH;
const CHECK_ONLY = process.argv.includes('--check');
const COLLECTIONS = ['normalized_data', 'public'];
const TARGETS = COLLECTIONS.flatMap((collection) => [
  { collection, entity: 'insect', path: path.join(DATA_ROOT, collection, 'insects.csv') },
  { collection, entity: 'hostplant', path: path.join(DATA_ROOT, collection, 'hostplants.csv') },
]);

const SOURCE_REFERENCE = '日本原色アブラムシ図鑑';
const SOURCE_PDF_STATUS = 'not_available_ocr_candidate_only_no_new_fact';
const OCR_SHA256 = '0302ac1f9ad483a9240b0e25e8a97d0cfc6313b0dc4a25ca726109769acc2482';
const FALSE_MERGE_COMMIT = '1456d7e1676f345d83d0b4b72b2511b8a7039292';
const APPROVED_PARENT_COMMIT = '3dad4169f38ae55e3490aa8db8e8ea295d709ae5';
const PRODUCTION_AUDIT_SHA256 = '594aaed3c3f39edeb00f57799cc5f60458140d7a9ae79a4a40d1871033adb1ca';
const PRODUCTION_PROFILE = Object.freeze({ rows: 20, patch: 14, delete: 6 });
const REVIEWED_ON_RE = /^\d{4}-\d{2}-\d{2}$/;
const REQUIRED_AUDIT_COLUMNS = [
  'audit_id',
  'entity',
  'record_id',
  'insect_id',
  'source_account',
  'source_taxon',
  'source_taxon_rank',
  'subspecies_scope',
  'action',
  'expected_json',
  'approved_json',
  'source_reference',
  'source_pdf_status',
  'ocr_sha256',
  'ocr_page',
  'printed_page',
  'taxonomy_source',
  'taxonomy_otu_id',
  'false_merge_commit',
  'approved_parent_commit',
  'decision',
  'reviewed_on',
  'review_note',
];
const ALLOWED_DECISIONS = new Set([
  'restore_false_merge_identity',
  'retain_reinterpreted_account_update_metadata',
  'remove_duplicate_account_mapping',
  'remove_wrong_account_mapping',
]);

const clean = (value) => (value ?? '').toString().trim();
const isPlainObject = (value) => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
);

function parseJsonObject(value, auditId, column) {
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch (error) {
    throw new Error(`${auditId}: invalid ${column}: ${error.message}`);
  }
  if (!isPlainObject(parsed)) throw new Error(`${auditId}: ${column} must be a JSON object`);
  for (const [field, fieldValue] of Object.entries(parsed)) {
    if (!field || typeof fieldValue !== 'string') {
      throw new Error(`${auditId}: ${column} must contain string field values`);
    }
  }
  return parsed;
}

function readAudit() {
  const text = fs.readFileSync(AUDIT_PATH, 'utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const isProductionAudit = path.resolve(AUDIT_PATH) === path.resolve(DEFAULT_AUDIT_PATH);
  if (isProductionAudit) {
    const digest = crypto.createHash('sha256').update(fs.readFileSync(AUDIT_PATH)).digest('hex');
    if (digest !== PRODUCTION_AUDIT_SHA256) {
      throw new Error(`Production aphid audit SHA-256 mismatch: ${digest}`);
    }
  }
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
  if (parsed.errors.length > 0) {
    throw new Error(`${path.relative(ROOT, AUDIT_PATH)}: ${parsed.errors[0].message}`);
  }
  const fields = new Set(parsed.meta.fields || []);
  for (const column of REQUIRED_AUDIT_COLUMNS) {
    if (!fields.has(column)) throw new Error(`${path.relative(ROOT, AUDIT_PATH)} is missing ${column}`);
  }

  const auditIds = new Set();
  const recordKeys = new Set();
  const audits = parsed.data.map((raw) => {
    const auditId = clean(raw.audit_id);
    const entity = clean(raw.entity);
    const recordId = clean(raw.record_id);
    const insectId = clean(raw.insect_id);
    const action = clean(raw.action);
    const decision = clean(raw.decision);
    if (!auditId || auditIds.has(auditId)) throw new Error(`Invalid or duplicate audit_id: ${auditId}`);
    auditIds.add(auditId);
    if (!['insect', 'hostplant'].includes(entity)) throw new Error(`${auditId}: unsupported entity ${entity}`);
    if (!recordId || !insectId) throw new Error(`${auditId}: missing record_id or insect_id`);
    if (entity === 'insect' && recordId !== insectId) {
      throw new Error(`${auditId}: insect record_id must equal insect_id`);
    }
    const recordKey = `${entity}\u0000${recordId}`;
    if (recordKeys.has(recordKey)) throw new Error(`${auditId}: duplicate audited record ${recordId}`);
    recordKeys.add(recordKey);
    if (!['patch', 'delete'].includes(action)) throw new Error(`${auditId}: unsupported action ${action}`);
    if (!ALLOWED_DECISIONS.has(decision)) throw new Error(`${auditId}: unsupported decision ${decision}`);
    if (clean(raw.source_taxon_rank) !== 'species') {
      throw new Error(`${auditId}: source_taxon_rank must remain species`);
    }
    if (clean(raw.subspecies_scope) !== 'species_level_unqualified') {
      throw new Error(`${auditId}: unqualified source accounts must not be assigned to a nominate subspecies`);
    }
    if (clean(raw.source_reference) !== SOURCE_REFERENCE) throw new Error(`${auditId}: source reference mismatch`);
    if (clean(raw.source_pdf_status) !== SOURCE_PDF_STATUS) throw new Error(`${auditId}: source PDF status mismatch`);
    if (clean(raw.ocr_sha256) !== OCR_SHA256) throw new Error(`${auditId}: OCR hash mismatch`);
    if (!/^\d+$/.test(clean(raw.ocr_page)) || !/^\d+$/.test(clean(raw.printed_page))) {
      throw new Error(`${auditId}: OCR and printed pages are required`);
    }
    if (!clean(raw.taxonomy_source).startsWith('https://') || !/^\d+$/.test(clean(raw.taxonomy_otu_id))) {
      throw new Error(`${auditId}: taxonomy evidence is incomplete`);
    }
    if (!REVIEWED_ON_RE.test(clean(raw.reviewed_on))) throw new Error(`${auditId}: invalid review date`);
    if (!clean(raw.review_note)) throw new Error(`${auditId}: review note is required`);

    if (decision === 'restore_false_merge_identity') {
      if (entity !== 'insect' || action !== 'patch') {
        throw new Error(`${auditId}: false-merge recovery must patch an insect row`);
      }
      if (clean(raw.false_merge_commit) !== FALSE_MERGE_COMMIT) {
        throw new Error(`${auditId}: false-merge commit mismatch`);
      }
      if (clean(raw.approved_parent_commit) !== APPROVED_PARENT_COMMIT) {
        throw new Error(`${auditId}: approved parent commit mismatch`);
      }
    } else if (clean(raw.false_merge_commit) || clean(raw.approved_parent_commit)) {
      throw new Error(`${auditId}: host actions must not claim false-merge commit provenance`);
    }

    const expected = parseJsonObject(raw.expected_json, auditId, 'expected_json');
    const approved = parseJsonObject(raw.approved_json, auditId, 'approved_json');
    if (action === 'patch') {
      const expectedKeys = Object.keys(expected).sort();
      const approvedKeys = Object.keys(approved).sort();
      if (expectedKeys.length === 0 || JSON.stringify(expectedKeys) !== JSON.stringify(approvedKeys)) {
        throw new Error(`${auditId}: patch objects must have the same non-empty field set`);
      }
      if (entity === 'hostplant' && (expected.record_id !== recordId || expected.insect_id !== insectId)) {
        throw new Error(`${auditId}: host patch identity mismatch`);
      }
    } else {
      if (entity !== 'hostplant') throw new Error(`${auditId}: only hostplant rows may be deleted`);
      if (Object.keys(expected).length === 0 || Object.keys(approved).length !== 0) {
        throw new Error(`${auditId}: delete requires a complete expected object and empty approved object`);
      }
      if (expected.record_id !== recordId || expected.insect_id !== insectId) {
        throw new Error(`${auditId}: host delete identity mismatch`);
      }
    }

    return { auditId, entity, recordId, insectId, action, decision, expected, approved };
  });

  if (isProductionAudit) {
    const profile = {
      rows: audits.length,
      patch: audits.filter((audit) => audit.action === 'patch').length,
      delete: audits.filter((audit) => audit.action === 'delete').length,
    };
    for (const [key, expected] of Object.entries(PRODUCTION_PROFILE)) {
      if (profile[key] !== expected) {
        throw new Error(`Production aphid audit ${key} mismatch: ${profile[key]} != ${expected}`);
      }
    }
  }
  return audits;
}

function transformCsv(target, audits) {
  if (!fs.existsSync(target.path)) throw new Error(`Missing target: ${target.path}`);
  const source = fs.readFileSync(target.path, 'utf8');
  const hasBom = source.charCodeAt(0) === 0xfeff;
  const body = hasBom ? source.slice(1) : source;
  const entries = splitCsvRecordsWithDelimiters(body);
  if (entries.length === 0) throw new Error(`${target.path} is empty`);

  const headerParse = Papa.parse(entries[0].record);
  if (headerParse.errors.length > 0) throw new Error(`${target.path}: ${headerParse.errors[0].message}`);
  const header = headerParse.data[0];
  const indexes = Object.fromEntries(header.map((name, index) => [name, index]));
  const idColumn = target.entity === 'insect' ? 'insect_id' : 'record_id';
  if (indexes[idColumn] === undefined) throw new Error(`${target.path} is missing ${idColumn}`);

  const actions = new Map(audits.filter((audit) => audit.entity === target.entity).map((audit) => [audit.recordId, audit]));
  const output = [entries[0]];
  const seenIds = new Set();
  const finalRows = new Map();
  let beforeCount = 0;
  let afterCount = 0;
  let patchedFields = 0;
  let deletedRows = 0;

  for (const entry of entries.slice(1)) {
    if (!entry.record) continue;
    const parsed = Papa.parse(entry.record);
    if (parsed.errors.length > 0) throw new Error(`${target.path}: ${parsed.errors[0].message}`);
    const row = parsed.data[0];
    const recordId = row[indexes[idColumn]];
    if (!recordId || seenIds.has(recordId)) throw new Error(`${target.path}: invalid or duplicate ${idColumn}: ${recordId}`);
    seenIds.add(recordId);
    beforeCount += 1;
    const audit = actions.get(recordId);
    if (!audit) {
      output.push(entry);
      finalRows.set(recordId, row);
      afterCount += 1;
      continue;
    }

    for (const field of Object.keys(audit.expected)) {
      if (indexes[field] === undefined) throw new Error(`${audit.auditId}: ${target.path} is missing ${field}`);
    }
    if (target.entity === 'hostplant' && row[indexes.insect_id] !== audit.insectId) {
      throw new Error(`${audit.auditId}: ${target.path} insect_id mismatch`);
    }

    if (audit.action === 'delete') {
      for (const [field, expectedValue] of Object.entries(audit.expected)) {
        const currentValue = row[indexes[field]] ?? '';
        if (currentValue !== expectedValue) {
          throw new Error(`${audit.auditId}: unexpected ${target.collection}.${field}=${JSON.stringify(currentValue)}`);
        }
      }
      deletedRows += 1;
      continue;
    }

    let changed = false;
    for (const [field, expectedValue] of Object.entries(audit.expected)) {
      const approvedValue = audit.approved[field];
      const currentValue = row[indexes[field]] ?? '';
      if (currentValue === approvedValue) continue;
      if (currentValue !== expectedValue) {
        throw new Error(`${audit.auditId}: unexpected ${target.collection}.${field}=${JSON.stringify(currentValue)}`);
      }
      row[indexes[field]] = approvedValue;
      patchedFields += 1;
      changed = true;
    }
    const resultEntry = changed
      ? { record: Papa.unparse([row], { newline: '' }), delimiter: entry.delimiter }
      : entry;
    output.push(resultEntry);
    finalRows.set(recordId, row);
    afterCount += 1;
  }

  for (const audit of actions.values()) {
    if (seenIds.has(audit.recordId) || audit.action === 'delete') continue;
    throw new Error(`${audit.auditId}: required ${target.collection} row is missing`);
  }

  const text = `${hasBom ? '\ufeff' : ''}${output.map(({ record, delimiter }) => `${record}${delimiter}`).join('')}`;
  return { target, text, finalRows, beforeCount, afterCount, patchedFields, deletedRows };
}

function validateFinalState(results, audits) {
  for (const collection of COLLECTIONS) {
    const insectResult = results.find((result) => result.target.collection === collection && result.target.entity === 'insect');
    const hostResult = results.find((result) => result.target.collection === collection && result.target.entity === 'hostplant');
    for (const audit of audits) {
      const result = audit.entity === 'insect' ? insectResult : hostResult;
      const row = result.finalRows.get(audit.recordId);
      if (audit.action === 'delete') {
        if (row) throw new Error(`${audit.auditId}: ${collection} deletion did not apply`);
        continue;
      }
      if (!row) throw new Error(`${audit.auditId}: ${collection} patched row is missing`);
      const indexes = audit.entity === 'insect'
        ? Object.fromEntries(Papa.parse(results.find((item) => item.target.collection === collection && item.target.entity === 'insect').text.replace(/^\ufeff/, '').split(/\r?\n/, 1)[0]).data[0].map((name, index) => [name, index]))
        : Object.fromEntries(Papa.parse(results.find((item) => item.target.collection === collection && item.target.entity === 'hostplant').text.replace(/^\ufeff/, '').split(/\r?\n/, 1)[0]).data[0].map((name, index) => [name, index]));
      for (const [field, approvedValue] of Object.entries(audit.approved)) {
        if ((row[indexes[field]] ?? '') !== approvedValue) {
          throw new Error(`${audit.auditId}: ${collection}.${field} did not reach approved value`);
        }
      }
    }
  }
}

function writeAtomically(results) {
  const temporary = [];
  try {
    for (const result of results) {
      const temporaryPath = `${result.target.path}.aphid-p0-${process.pid}.tmp`;
      fs.writeFileSync(temporaryPath, result.text, 'utf8');
      temporary.push({ temporaryPath, destination: result.target.path });
    }
    for (const item of temporary) fs.renameSync(item.temporaryPath, item.destination);
  } finally {
    for (const item of temporary) fs.rmSync(item.temporaryPath, { force: true });
  }
}

const audits = readAudit();
const results = TARGETS.map((target) => transformCsv(target, audits));
validateFinalState(results, audits);
if (!CHECK_ONLY) writeAtomically(results);

for (const collection of COLLECTIONS) {
  const insect = results.find((result) => result.target.collection === collection && result.target.entity === 'insect');
  const hostplant = results.find((result) => result.target.collection === collection && result.target.entity === 'hostplant');
  console.log(
    `[aphid-p0] ${collection}: insects=${insect.beforeCount}->${insect.afterCount} `
    + `insect_fields=${insect.patchedFields}; hostplants=${hostplant.beforeCount}->${hostplant.afterCount} `
    + `host_fields=${hostplant.patchedFields} deleted=${hostplant.deletedRows}${CHECK_ONLY ? ' check-only' : ''}`,
  );
}

#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Papa from 'papaparse';

import { splitCsvRecordsWithDelimiters } from './lib/csvRecords.mjs';
import { collectGeneralNoteIssues } from './lib/generalNoteQuality.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NOTES_PATH = process.env.HAMAKIGA3_NOTES_PATH
  ? path.resolve(process.env.HAMAKIGA3_NOTES_PATH)
  : path.join(ROOT, 'normalized_data', 'general_notes.csv');
const INSECTS_PATH = process.env.HAMAKIGA3_INSECTS_PATH
  ? path.resolve(process.env.HAMAKIGA3_INSECTS_PATH)
  : path.join(ROOT, 'normalized_data', 'insects.csv');
const AUDIT_PATH = process.env.HAMAKIGA3_AUDIT_PATH
  ? path.resolve(process.env.HAMAKIGA3_AUDIT_PATH)
  : path.join(
      ROOT,
      'data',
      'source_audits',
      'japanese-tortricid-moths-3-general-note-all-rows-2026-07-12.json',
    );
const PRODUCTION_AUDIT_PATH = path.join(
  ROOT,
  'data',
  'source_audits',
  'japanese-tortricid-moths-3-general-note-all-rows-2026-07-12.json',
);
const SOURCE_PDF = process.env.HAMAKIGA3_SOURCE_PDF
  ? path.resolve(process.env.HAMAKIGA3_SOURCE_PDF)
  : '';
const CHECK_ONLY = process.argv.includes('--check');
const unknownArguments = process.argv.slice(2).filter((argument) => argument !== '--check');
if (unknownArguments.length > 0) throw new Error(`Unknown arguments: ${unknownArguments.join(', ')}`);

const SOURCE = '日本のハマキガ3';
const PDF_SHA256 = 'c10c4be6f8b7d4988a83361eafb3216131752bfd50d10ab32d4f6deca5cc240f';
const LEDGER_SHA256 = '207331e9d65e218f345fb3e2e08f9520d1e0f09f3e22fe52266b7b1af8f17c43';
const REVIEWED_ON = '2026-07-12';
const EXPECTED_ROWS = 289;
const EXPECTED_VERIFY = 273;
const EXPECTED_REPLACE = 14;
const EXPECTED_DELETE = 2;
const EXPECTED_ACCOUNTS = 180;
const GENERIC_STAGE_APPROVED_ID = 'note-H3-0115';
const GENERIC_STAGE_TRANSITIONAL_ID = 'note-H3-0267';

const sha256 = (filePath) => crypto.createHash('sha256')
  .update(fs.readFileSync(filePath))
  .digest('hex');

function readCsv(filePath) {
  const parsed = Papa.parse(fs.readFileSync(filePath, 'utf8').replace(/^\ufeff/, ''), {
    header: true,
    skipEmptyLines: true,
  });
  if (parsed.errors.length > 0) throw new Error(`${filePath}: ${parsed.errors[0].message}`);
  if (parsed.data.some((row) => Object.hasOwn(row, '__parsed_extra'))) {
    throw new Error(`${filePath}: over-wide CSV row`);
  }
  return parsed.data;
}

function loadLedger() {
  const ledger = JSON.parse(fs.readFileSync(AUDIT_PATH, 'utf8'));
  const metadata = ledger.audit_metadata || {};
  if (
    metadata.source !== SOURCE
    || metadata.source_pdf_sha256 !== PDF_SHA256
    || metadata.reviewed_on !== REVIEWED_ON
    || metadata.source_accounts_reviewed !== EXPECTED_ACCOUNTS
    || metadata.current_rows_reviewed !== EXPECTED_ROWS
    || metadata.holds !== 0
    || !Array.isArray(ledger.rows)
    || ledger.rows.length !== EXPECTED_ROWS
  ) {
    throw new Error('Hamakiga3 audit metadata guard failed');
  }
  const counts = ledger.rows.reduce((result, row) => {
    result[row.action] = (result[row.action] || 0) + 1;
    return result;
  }, {});
  if (
    counts.verify_and_set_page !== EXPECTED_VERIFY
    || counts.replace_content !== EXPECTED_REPLACE
    || counts.delete_note !== EXPECTED_DELETE
  ) {
    throw new Error(`Unexpected ledger action counts: ${JSON.stringify(counts)}`);
  }
  const recordIds = new Set();
  const accounts = new Set();
  for (const row of ledger.rows) {
    if (!row.record_id || recordIds.has(row.record_id)) {
      throw new Error(`Invalid or duplicate ledger record_id: ${row.record_id}`);
    }
    recordIds.add(row.record_id);
    accounts.add(row.source_account);
    if (
      !row.insect_id || !row.note_type || row.reference !== SOURCE
      || row.source_scope !== 'taxon_exact_no_current_subspecies_sibling'
      || !['exact_in_account', 'ordered_source_fragments_in_account'].includes(row.source_match)
      || !row.source_content || !row.source_heading || !row.pdf_page || !row.printed_page
      || row.pdf_file !== '日本のハマキガ3.pdf'
      || row.source_pdf_sha256 !== PDF_SHA256 || row.reviewed_on !== REVIEWED_ON
      || !row.decision || !row.evidence_note
    ) {
      throw new Error(`${row.record_id}: incomplete audit provenance`);
    }
    if (row.action === 'delete_note' && row.approved_content !== '') {
      throw new Error(`${row.record_id}: delete action has approved content`);
    }
    if (row.action !== 'delete_note' && !row.approved_content) {
      throw new Error(`${row.record_id}: retained action lacks approved content`);
    }
    if (row.action === 'replace_content' && row.approved_content === row.source_content) {
      throw new Error(`${row.record_id}: replacement does not change source content`);
    }
  }
  if (accounts.size !== EXPECTED_ACCOUNTS) {
    throw new Error(`Expected ${EXPECTED_ACCOUNTS} source accounts; found ${accounts.size}`);
  }
  const enforceProduction = path.resolve(AUDIT_PATH) === path.resolve(PRODUCTION_AUDIT_PATH)
    || process.env.HAMAKIGA3_ENFORCE_PRODUCTION === '1';
  if (enforceProduction && sha256(AUDIT_PATH) !== LEDGER_SHA256) {
    throw new Error(`Production audit SHA-256 mismatch: ${sha256(AUDIT_PATH)}`);
  }
  return ledger.rows;
}

function verifySourcePdf() {
  if (!SOURCE_PDF) return;
  if (!fs.existsSync(SOURCE_PDF)) throw new Error(`Source PDF is missing: ${SOURCE_PDF}`);
  const actual = sha256(SOURCE_PDF);
  if (actual !== PDF_SHA256) throw new Error(`Source PDF SHA-256 mismatch: ${actual}`);
}

function validateNoSubspeciesSiblings(rows) {
  const insects = readCsv(INSECTS_PATH);
  const byId = new Map(insects.map((row) => [row.insect_id, row]));
  const bySpecies = new Map();
  for (const insect of insects) {
    if (!insect.genus || !insect.species) continue;
    const key = `${insect.genus}\u0000${insect.species}`;
    const siblings = bySpecies.get(key) || [];
    siblings.push(insect);
    bySpecies.set(key, siblings);
  }
  for (const row of rows) {
    const insect = byId.get(row.insect_id);
    if (!insect) throw new Error(`${row.record_id}: missing current insect ${row.insect_id}`);
    const siblings = bySpecies.get(`${insect.genus}\u0000${insect.species}`) || [];
    if (siblings.length !== 1) {
      throw new Error(`${row.record_id}: current subspecies sibling set changed`);
    }
  }
}

function parseRecord(record, filePath) {
  const parsed = Papa.parse(record);
  if (parsed.errors.length > 0 || parsed.data.length !== 1) {
    throw new Error(`${filePath}: malformed CSV record`);
  }
  return parsed.data[0];
}

function classifyContentState(auditRows, byRecordId, indexes) {
  const states = new Map();
  for (const audit of auditRows) {
    const item = byRecordId.get(audit.record_id);
    if (!item) {
      if (audit.action === 'delete_note') {
        states.set(audit.record_id, 'applied');
        continue;
      }
      throw new Error(`${audit.record_id}: required retained note is missing`);
    }
    const content = item.values[indexes.content];
    if (content === audit.approved_content) states.set(audit.record_id, 'applied');
    else if (content === audit.source_content) states.set(audit.record_id, 'source');
    else if (audit.transitional_content && content === audit.transitional_content) {
      states.set(audit.record_id, 'transitional');
    } else {
      throw new Error(`${audit.record_id}: note content drifted`);
    }
  }
  const actionRows = auditRows.filter((row) => row.action !== 'verify_and_set_page');
  const signature = Object.fromEntries(actionRows.map((row) => [row.record_id, states.get(row.record_id)]));
  const allSource = actionRows.every((row) => states.get(row.record_id) === 'source');
  const allApplied = actionRows.every((row) => states.get(row.record_id) === 'applied');
  const genericStage = actionRows.every((row) => {
    const state = states.get(row.record_id);
    if (row.record_id === GENERIC_STAGE_APPROVED_ID) return state === 'applied';
    if (row.record_id === GENERIC_STAGE_TRANSITIONAL_ID) return state === 'transitional';
    return state === 'source';
  });
  if (allSource) return { state: 'source', states };
  if (genericStage) return { state: 'generic_cleanup_stage', states };
  if (allApplied) return { state: 'applied', states };
  throw new Error(`Hamakiga3 content is in an unsupported partial state: ${JSON.stringify(signature)}`);
}

function classifyPageState(auditRows, byRecordId, indexes) {
  const retained = auditRows.filter((row) => row.action !== 'delete_note');
  const values = retained.map((row) => {
    const item = byRecordId.get(row.record_id);
    if (!item) throw new Error(`${row.record_id}: retained note is missing`);
    const page = item.values[indexes.page] || '';
    if (page === '') return 'blank';
    if (page === row.printed_page) return 'applied';
    throw new Error(`${row.record_id}: unexpected page value ${page}`);
  });
  if (values.every((value) => value === 'blank')) return 'blank';
  if (values.every((value) => value === 'applied')) return 'applied';
  throw new Error('Hamakiga3 page provenance is partially applied');
}

function transform(auditRows) {
  const source = fs.readFileSync(NOTES_PATH, 'utf8');
  const hasBom = source.charCodeAt(0) === 0xfeff;
  const records = splitCsvRecordsWithDelimiters(hasBom ? source.slice(1) : source);
  if (records.length === 0) throw new Error('general_notes.csv is empty');
  const header = parseRecord(records[0].record, NOTES_PATH);
  const indexes = Object.fromEntries(header.map((name, index) => [name, index]));
  for (const column of ['record_id', 'insect_id', 'note_type', 'content', 'reference', 'page', 'year']) {
    if (indexes[column] === undefined) throw new Error(`general_notes.csv is missing ${column}`);
  }
  const items = records.slice(1).filter((record) => record.record).map((record) => ({
    record,
    values: parseRecord(record.record, NOTES_PATH),
    changed: false,
    deleted: false,
  }));
  const byRecordId = new Map();
  for (const item of items) {
    const id = item.values[indexes.record_id] || '';
    if (!id || byRecordId.has(id)) throw new Error(`Invalid or duplicate record_id: ${id}`);
    byRecordId.set(id, item);
  }
  const ledgerIds = new Set(auditRows.map((row) => row.record_id));
  const currentSourceRows = items.filter((item) => item.values[indexes.reference] === SOURCE);
  for (const item of currentSourceRows) {
    if (!ledgerIds.has(item.values[indexes.record_id])) {
      throw new Error(`Unledgered Hamakiga3 note: ${item.values[indexes.record_id]}`);
    }
  }
  for (const audit of auditRows) {
    const item = byRecordId.get(audit.record_id);
    if (!item) continue;
    if (
      item.values[indexes.insect_id] !== audit.insect_id
      || item.values[indexes.note_type] !== audit.note_type
      || item.values[indexes.reference] !== SOURCE
    ) {
      throw new Error(`${audit.record_id}: note identity drifted`);
    }
  }
  const contentState = classifyContentState(auditRows, byRecordId, indexes);
  const pageState = classifyPageState(auditRows, byRecordId, indexes);
  if (contentState.state === 'applied' && pageState !== 'applied') {
    throw new Error('Applied content has missing page provenance');
  }
  if (contentState.state !== 'applied' && pageState !== 'blank') {
    throw new Error('Pending content has partially applied page provenance');
  }

  let replaced = 0;
  let deleted = 0;
  let pagesSet = 0;
  for (const audit of auditRows) {
    const item = byRecordId.get(audit.record_id);
    if (audit.action === 'delete_note') {
      if (item && contentState.states.get(audit.record_id) !== 'applied') {
        item.deleted = true;
        deleted += 1;
      }
      continue;
    }
    if (item.values[indexes.content] !== audit.approved_content) {
      item.values[indexes.content] = audit.approved_content;
      item.changed = true;
      replaced += 1;
    }
    if ((item.values[indexes.page] || '') !== audit.printed_page) {
      item.values[indexes.page] = audit.printed_page;
      item.changed = true;
      pagesSet += 1;
    }
  }

  const remaining = items.filter((item) => !item.deleted);
  const ids = new Set();
  const semanticKeys = new Set();
  for (const item of remaining) {
    const id = item.values[indexes.record_id];
    if (ids.has(id)) throw new Error(`Output duplicate record_id: ${id}`);
    ids.add(id);
    const key = [
      item.values[indexes.insect_id],
      item.values[indexes.note_type],
      item.values[indexes.content],
      item.values[indexes.reference],
      item.values[indexes.page],
      item.values[indexes.year],
    ].join('\u0000');
    if (semanticKeys.has(key)) throw new Error(`Output duplicate semantic note: ${id}`);
    semanticKeys.add(key);
    if (item.values[indexes.reference] === SOURCE) {
      const issues = collectGeneralNoteIssues({
        note_type: item.values[indexes.note_type],
        content: item.values[indexes.content],
        page: item.values[indexes.page],
      });
      if (issues.length > 0) {
        throw new Error(`${id}: approved Hamakiga3 note has quality issues: ${issues.join(',')}`);
      }
    }
  }
  const remainingSourceCount = remaining.filter(
    (item) => item.values[indexes.reference] === SOURCE,
  ).length;
  if (remainingSourceCount !== EXPECTED_ROWS - EXPECTED_DELETE) {
    throw new Error(`Expected 287 retained Hamakiga3 notes; found ${remainingSourceCount}`);
  }

  const outputRecords = [records[0], ...items.filter((item) => !item.deleted).map((item) => (
    item.changed
      ? { record: Papa.unparse([item.values], { newline: '' }), delimiter: item.record.delimiter }
      : item.record
  ))];
  const result = `${hasBom ? '\ufeff' : ''}${outputRecords
    .map(({ record, delimiter }) => `${record}${delimiter}`)
    .join('')}`;
  const verified = Papa.parse(result.replace(/^\ufeff/, ''), { header: true, skipEmptyLines: true });
  if (verified.errors.length > 0 || verified.data.some((row) => Object.hasOwn(row, '__parsed_extra'))) {
    throw new Error('Generated general_notes.csv is invalid');
  }
  return {
    source,
    result,
    state: contentState.state,
    pageState,
    replaced,
    deleted,
    pagesSet,
  };
}

function writeAtomically(result) {
  if (result === fs.readFileSync(NOTES_PATH, 'utf8')) return;
  const temporaryPath = `${NOTES_PATH}.tmp-hamakiga3-${process.pid}`;
  try {
    fs.writeFileSync(temporaryPath, result, 'utf8');
    fs.renameSync(temporaryPath, NOTES_PATH);
  } finally {
    fs.rmSync(temporaryPath, { force: true });
  }
}

const auditRows = loadLedger();
verifySourcePdf();
validateNoSubspeciesSiblings(auditRows);
const output = transform(auditRows);
if (CHECK_ONLY) {
  if (output.source !== output.result) throw new Error('Hamakiga3 audit has pending changes');
} else {
  writeAtomically(output.result);
}
console.log(JSON.stringify({
  audit_rows: auditRows.length,
  initial_content_state: output.state,
  initial_page_state: output.pageState,
  replaced: output.replaced,
  deleted: output.deleted,
  pages_set: output.pagesSet,
  check_only: CHECK_ONLY,
}, null, 2));

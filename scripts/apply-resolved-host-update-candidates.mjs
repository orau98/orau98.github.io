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
const DATA_ROOT = process.env.OK23_DATA_ROOT ? path.resolve(process.env.OK23_DATA_ROOT) : ROOT;
const AUDIT_PATH = process.env.OK23_AUDIT_PATH
  ? path.resolve(process.env.OK23_AUDIT_PATH)
  : path.join(ROOT, 'data', 'source_audits', 'resolved-host-update-candidates-pdf-2026-07-11.csv');
const PDF_ROOT = process.env.OK23_PDF_ROOT ? path.resolve(process.env.OK23_PDF_ROOT) : '';
const CHECK_ONLY = process.argv.includes('--check');
const COLLECTIONS = ['normalized_data', 'public'];
const REVIEWED_ON = '2026-07-11';

const EXPECTED_PDF_HASHES = new Map(Object.entries({
  'ga-tsushin/jhj106.pdf': '2af63f3ba94bba9c588ea29f40cae2e6026148cc4a516767ec168439048670ad',
  'ga-tsushin/jhj109.pdf': '124e955d81baf7c4ade1df2d2791684843ec32f9988842f3f6ce045016674ce8',
  'ga-tsushin/jhj115.pdf': 'edef6b0f7e6b419fbb1923194bce279ed59321527b48fa0355dd1f19c5b33d45',
  'ga-tsushin/jhj120.pdf': 'a5bb9471e06bc3a073e404659f51be6474d7047c337b7de94086781ebba74da8',
  'ga-tsushin/jhj125.pdf': 'b29e1c63c46d0950bde81e02cfc5bd8f142cc6172f58ae1d4a7b5978582a2d6f',
  'ga-tsushin/jhj131.pdf': '5c67209a57db060f121f107c4e37a7588c5711839735e52e24d882655e56c3ed',
  'ga-tsushin/jhj133.pdf': 'a713ce3d8641e68602c24fe6d30ef17fa5826ed520e4b71f0a4368cd175e4395',
  'ga-tsushin/jhj137.pdf': 'a4e505bd9574b423acd914e65148ed0ed636816c4293a0173a9e07f568e00ca6',
  'ga-tsushin/jhj143.pdf': 'a9f6edd40e8869773b74ffadb89ceed8621ab897b495fbc97a03034d68eba1ea',
  'ga-tsushin/jhj151.pdf': 'e5f0a426f2c108882213d69d715812f1ef75786cc8ee5b8762d98f07ecfc515a',
  'ga-tsushin/jhj153.pdf': 'c79c7ad2d58fdc45f05fafbe7c67c118d726405c0015b9fe30742bf8ee9f53a5',
  'ga-tsushin/jhj183.pdf': '5c5dde58c7c00677cfdb1e9e3b07101bc992f167044ad7e2cae810b5211b0b2e',
  'ga-tsushin/jhj203.pdf': '5e8e5b801d621693cf0ad61f1c44ccfc9dcd4c2e37c7f772da997d3337d5fbdc',
  'tinea/tinea22-3.pdf': 'b0c5173ba5265acd867418af03cfec6bd6cf32fbb343d2752b67f4d015f467df',
  'tinea/tinea23-4.pdf': '8c0b515969aa9c7452105edf81073037466ea16f970ef5b2d50fb52ebef2251b',
  'tinea/tinea26-1.pdf': '83f49e95e53ce5720083a2bc8e67fd1061b05343a6a64bdc1f98afbfa3ba8881',
}));

const REQUIRED_COLUMNS = [
  'audit_id', 'candidate_id', 'action', 'record_id', 'insect_id',
  'source_japanese_name', 'source_scientific_name', 'current_japanese_name',
  'current_scientific_name', 'taxon_scope', 'candidate_plant_name', 'source_plant_taxon',
  'approved_plant_name', 'approved_plant_family', 'approved_observation_type',
  'approved_plant_part', 'approved_life_stage', 'approved_reference', 'approved_notes',
  'expected_plant_name', 'expected_plant_family', 'expected_observation_type',
  'expected_plant_part', 'expected_life_stage', 'expected_reference', 'expected_notes',
  'source_pdf_file', 'source_pdf_sha256', 'pdf_page', 'printed_page', 'evidence',
  'decision', 'reviewed_on', 'review_note',
];
const HOST_FIELDS = [
  'plant_name', 'plant_family', 'observation_type', 'plant_part',
  'life_stage', 'reference', 'notes',
];
const APPROVED_COLUMNS = Object.fromEntries(HOST_FIELDS.map((field) => [field, `approved_${field}`]));
const EXPECTED_COLUMNS = Object.fromEntries(HOST_FIELDS.map((field) => [field, `expected_${field}`]));
const clean = (value) => (value ?? '').toString().trim();

function parseCsv(filePath) {
  const parsed = Papa.parse(fs.readFileSync(filePath, 'utf8').replace(/^\ufeff/, ''), {
    header: true,
    skipEmptyLines: true,
  });
  if (parsed.errors.length > 0) throw new Error(`${filePath}: ${parsed.errors[0].message}`);
  return parsed;
}

function readAudit() {
  const parsed = parseCsv(AUDIT_PATH);
  const fields = new Set(parsed.meta.fields || []);
  for (const column of REQUIRED_COLUMNS) {
    if (!fields.has(column)) throw new Error(`Audit is missing ${column}`);
  }

  const auditIds = new Set();
  const actionRecordIds = new Set();
  const candidateIds = new Set();
  const actions = { add_host_relation: 0, enrich_existing_relation: 0, exclude_relation: 0 };
  const rows = parsed.data.map((raw) => {
    const auditId = clean(raw.audit_id);
    const candidateId = clean(raw.candidate_id);
    const action = clean(raw.action);
    const recordId = clean(raw.record_id);
    const insectId = clean(raw.insect_id);
    const pdfFile = clean(raw.source_pdf_file);
    if (!auditId || auditIds.has(auditId)) throw new Error(`Invalid or duplicate audit_id: ${auditId}`);
    auditIds.add(auditId);
    if (!/^ok23-(0[1-9]|1[0-9]|2[0-3])$/.test(candidateId)) {
      throw new Error(`${auditId}: invalid candidate_id ${candidateId}`);
    }
    candidateIds.add(candidateId);
    if (!(action in actions)) throw new Error(`${auditId}: unsupported action ${action}`);
    actions[action] += 1;
    if (!insectId || !clean(raw.current_japanese_name) || !clean(raw.current_scientific_name)) {
      throw new Error(`${auditId}: incomplete current taxon identity`);
    }
    if (!clean(raw.source_japanese_name) || !clean(raw.source_scientific_name) || !clean(raw.taxon_scope)) {
      throw new Error(`${auditId}: incomplete source taxon scope`);
    }
    if (!clean(raw.candidate_plant_name) || !clean(raw.source_plant_taxon)) {
      throw new Error(`${auditId}: incomplete source plant evidence`);
    }
    if (!EXPECTED_PDF_HASHES.has(pdfFile)) throw new Error(`${auditId}: unapproved source PDF ${pdfFile}`);
    if (clean(raw.source_pdf_sha256) !== EXPECTED_PDF_HASHES.get(pdfFile)) {
      throw new Error(`${auditId}: source PDF hash mismatch`);
    }
    if (!/^\d+(;\d+)*$/.test(clean(raw.pdf_page)) || !/^\d+(;\d+)*$/.test(clean(raw.printed_page))) {
      throw new Error(`${auditId}: invalid PDF or printed page`);
    }
    if (!clean(raw.evidence) || !clean(raw.decision) || clean(raw.reviewed_on) !== REVIEWED_ON || !clean(raw.review_note)) {
      throw new Error(`${auditId}: incomplete review decision`);
    }

    if (action === 'exclude_relation') {
      if (recordId) throw new Error(`${auditId}: excluded relation must not have record_id`);
      for (const column of Object.values(APPROVED_COLUMNS)) {
        if (clean(raw[column])) throw new Error(`${auditId}: excluded relation must not have approved fields`);
      }
    } else {
      if (!recordId || actionRecordIds.has(recordId)) throw new Error(`${auditId}: invalid or duplicate record_id ${recordId}`);
      actionRecordIds.add(recordId);
      if (!clean(raw.approved_plant_name) || !clean(raw.approved_plant_family) || !clean(raw.approved_life_stage) || !clean(raw.approved_reference)) {
        throw new Error(`${auditId}: incomplete approved host relation`);
      }
      if (action === 'add_host_relation') {
        for (const column of Object.values(EXPECTED_COLUMNS)) {
          if (clean(raw[column])) throw new Error(`${auditId}: add action must not have expected fields`);
        }
      } else if (!clean(raw.expected_plant_name) || !clean(raw.expected_reference)) {
        throw new Error(`${auditId}: enrichment is missing expected fields`);
      }
    }
    return { ...raw, auditId, candidateId, action, recordId, insectId };
  });

  if (rows.length !== 37 || candidateIds.size !== 23) throw new Error('Audit must cover 37 decisions across all 23 candidates');
  if (actions.add_host_relation !== 21 || actions.enrich_existing_relation !== 14 || actions.exclude_relation !== 2) {
    throw new Error(`Unexpected action counts: ${JSON.stringify(actions)}`);
  }
  return rows;
}

function verifyOriginalPdfs(audits) {
  if (!PDF_ROOT) return;
  for (const pdfFile of new Set(audits.map((audit) => clean(audit.source_pdf_file)))) {
    const filePath = path.join(PDF_ROOT, pdfFile);
    if (!fs.existsSync(filePath)) throw new Error(`Missing source PDF: ${filePath}`);
    const digest = crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
    if (digest !== EXPECTED_PDF_HASHES.get(pdfFile)) throw new Error(`Original PDF hash mismatch: ${pdfFile}`);
  }
}

function validateInsects(collection, audits) {
  const filePath = path.join(DATA_ROOT, collection, 'insects.csv');
  const rows = parseCsv(filePath).data;
  const byId = new Map(rows.map((row) => [clean(row.insect_id), row]));
  const checked = new Set();
  for (const audit of audits) {
    if (checked.has(audit.insectId)) continue;
    checked.add(audit.insectId);
    const insect = byId.get(audit.insectId);
    if (!insect) throw new Error(`${collection}: missing insect ${audit.insectId}`);
    if (clean(insect.japanese_name) !== clean(audit.current_japanese_name)
      || clean(insect.scientific_name) !== clean(audit.current_scientific_name)) {
      throw new Error(`${collection}: current taxon drift for ${audit.insectId}`);
    }
  }
}

function rowMatchesAudit(values, indexes, audit, columns) {
  return HOST_FIELDS.every((field) => clean(values[indexes[field]]) === clean(audit[columns[field]]));
}

function rowMatchesApprovedWithLegacyTerminalStop(values, indexes, audit) {
  return HOST_FIELDS.every((field) => {
    const current = clean(values[indexes[field]]);
    const approved = clean(audit[APPROVED_COLUMNS[field]]);
    if (field !== 'notes') return current === approved;
    return current !== approved && current.replace(/。+$/u, '') === approved;
  });
}

function transformHostplants(collection, audits) {
  const filePath = path.join(DATA_ROOT, collection, 'hostplants.csv');
  const source = fs.readFileSync(filePath, 'utf8');
  const hasBom = source.charCodeAt(0) === 0xfeff;
  const entries = splitCsvRecordsWithDelimiters(hasBom ? source.slice(1) : source);
  if (entries.length === 0) throw new Error(`${filePath} is empty`);
  const headerParsed = Papa.parse(entries[0].record);
  if (headerParsed.errors.length > 0) throw new Error(`${filePath}: ${headerParsed.errors[0].message}`);
  const header = headerParsed.data[0];
  const indexes = Object.fromEntries(header.map((name, index) => [name, index]));
  for (const field of ['record_id', 'insect_id', ...HOST_FIELDS]) {
    if (indexes[field] === undefined) throw new Error(`${filePath} is missing ${field}`);
  }

  const enrichById = new Map(audits.filter((audit) => audit.action === 'enrich_existing_relation').map((audit) => [audit.recordId, audit]));
  const addById = new Map(audits.filter((audit) => audit.action === 'add_host_relation').map((audit) => [audit.recordId, audit]));
  const exclusions = audits.filter((audit) => audit.action === 'exclude_relation');
  const seenIds = new Set();
  const seenEnrich = new Set();
  const seenAdds = new Set();
  const pairKeys = new Set();
  const output = [entries[0]];
  let changed = 0;
  let formatFixed = 0;

  const delimiterCounts = new Map();
  for (const entry of entries.slice(1)) {
    if (entry.delimiter) delimiterCounts.set(entry.delimiter, (delimiterCounts.get(entry.delimiter) || 0) + 1);
  }
  const defaultDelimiter = entries[0].delimiter || [...delimiterCounts.entries()]
    .sort((left, right) => right[1] - left[1])[0]?.[0] || '\r\n';

  const entryRecordId = (entry) => {
    if (!entry?.record) return '';
    const parsed = Papa.parse(entry.record);
    if (parsed.errors.length > 0 || parsed.data[0].length !== header.length) return '';
    return clean(parsed.data[0][indexes.record_id]);
  };

  for (let entryIndex = 1; entryIndex < entries.length; entryIndex += 1) {
    const entry = entries[entryIndex];
    if (!entry.record) continue;
    const parsed = Papa.parse(entry.record);
    if (parsed.errors.length > 0) throw new Error(`${filePath}: ${parsed.errors[0].message}`);
    const values = parsed.data[0];
    if (values.length !== header.length) {
      throw new Error(`${filePath}: record ${entryIndex + 1} has ${values.length} columns; expected ${header.length}`);
    }
    const recordId = clean(values[indexes.record_id]);
    const insectId = clean(values[indexes.insect_id]);
    if (!recordId || seenIds.has(recordId)) throw new Error(`${filePath}: invalid or duplicate record_id ${recordId}`);
    seenIds.add(recordId);
    pairKeys.add(`${insectId}\u0000${clean(values[indexes.plant_name])}`);

    const enrichAudit = enrichById.get(recordId);
    let outputRecord = entry.record;
    if (enrichAudit) {
      if (insectId !== enrichAudit.insectId) throw new Error(`${enrichAudit.auditId}: insect_id mismatch`);
      const expected = rowMatchesAudit(values, indexes, enrichAudit, EXPECTED_COLUMNS);
      const approved = rowMatchesAudit(values, indexes, enrichAudit, APPROVED_COLUMNS);
      const legacyApproved = rowMatchesApprovedWithLegacyTerminalStop(values, indexes, enrichAudit);
      if (!expected && !approved && !legacyApproved) {
        throw new Error(`${enrichAudit.auditId}: source row no longer matches expected or approved state`);
      }
      if (expected || legacyApproved) {
        for (const field of HOST_FIELDS) values[indexes[field]] = enrichAudit[APPROVED_COLUMNS[field]] || '';
        changed += 1;
        outputRecord = Papa.unparse([values], { newline: '' });
      }
      seenEnrich.add(recordId);
    }

    const addAudit = addById.get(recordId);
    if (addAudit) {
      const approved = rowMatchesAudit(values, indexes, addAudit, APPROVED_COLUMNS);
      const legacyApproved = rowMatchesApprovedWithLegacyTerminalStop(values, indexes, addAudit);
      if (insectId !== addAudit.insectId || (!approved && !legacyApproved)) {
        throw new Error(`${addAudit.auditId}: existing added row does not match approved state`);
      }
      if (legacyApproved) {
        values[indexes.notes] = addAudit.approved_notes || '';
        outputRecord = Papa.unparse([values], { newline: '' });
        changed += 1;
      }
      seenAdds.add(recordId);
    }
    const nextRecordId = entryRecordId(entries[entryIndex + 1]);
    const mustUseCanonicalDelimiter = Boolean(addAudit || addById.has(nextRecordId));
    const outputDelimiter = mustUseCanonicalDelimiter ? defaultDelimiter : entry.delimiter;
    if (mustUseCanonicalDelimiter && entry.delimiter !== defaultDelimiter) formatFixed += 1;
    output.push({ record: outputRecord, delimiter: outputDelimiter });
  }

  for (const [recordId, audit] of enrichById) {
    if (!seenEnrich.has(recordId)) throw new Error(`${audit.auditId}: required source record is missing`);
  }
  for (const exclusion of exclusions) {
    const forbidden = `${exclusion.insectId}\u0000${clean(exclusion.candidate_plant_name)}`;
    if (pairKeys.has(forbidden)) throw new Error(`${exclusion.auditId}: excluded host relation is present`);
  }

  const missingAdds = [...addById].filter(([recordId]) => !seenAdds.has(recordId));
  if (missingAdds.length > 0 && output.length > 1 && !output.at(-1).delimiter) {
    output.at(-1).delimiter = defaultDelimiter;
    formatFixed += 1;
  }
  for (const [recordId, audit] of addById) {
    if (seenAdds.has(recordId)) continue;
    const pairKey = `${audit.insectId}\u0000${clean(audit.approved_plant_name)}`;
    if (pairKeys.has(pairKey)) throw new Error(`${audit.auditId}: approved relation already exists under another record_id`);
    const values = header.map(() => '');
    values[indexes.record_id] = recordId;
    values[indexes.insect_id] = audit.insectId;
    for (const field of HOST_FIELDS) values[indexes[field]] = audit[APPROVED_COLUMNS[field]] || '';
    output.push({ record: Papa.unparse([values], { newline: '' }), delimiter: defaultDelimiter });
    pairKeys.add(pairKey);
    changed += 1;
  }

  const result = `${hasBom ? '\ufeff' : ''}${output.map(({ record, delimiter }) => `${record}${delimiter}`).join('')}`;
  const verified = Papa.parse(result.replace(/^\ufeff/, ''), { header: true, skipEmptyLines: true });
  if (verified.errors.length > 0) throw new Error(`${filePath}: output CSV is invalid: ${verified.errors[0].message}`);
  const extraRow = verified.data.find((row) => Object.hasOwn(row, '__parsed_extra'));
  if (extraRow) throw new Error(`${filePath}: output CSV contains extra columns near ${extraRow.record_id || '(unknown)'}`);
  return { filePath, source, result, changed, formatFixed };
}

function writeAtomically(outputs) {
  const temporaryPaths = [];
  try {
    for (const output of outputs) {
      const temporaryPath = `${output.filePath}.tmp-ok23-${process.pid}`;
      fs.writeFileSync(temporaryPath, output.result, 'utf8');
      temporaryPaths.push(temporaryPath);
    }
    outputs.forEach((output, index) => fs.renameSync(temporaryPaths[index], output.filePath));
    temporaryPaths.length = 0;
  } finally {
    for (const temporaryPath of temporaryPaths) fs.rmSync(temporaryPath, { force: true });
  }
}

const audits = readAudit();
verifyOriginalPdfs(audits);
for (const collection of COLLECTIONS) validateInsects(collection, audits);
const outputs = COLLECTIONS.map((collection) => transformHostplants(collection, audits));
if (CHECK_ONLY) {
  const pending = outputs.filter((output) => output.result !== output.source).length;
  if (pending > 0) throw new Error(`Resolved-host audit has ${pending} pending changes`);
} else {
  writeAtomically(outputs);
}
for (const output of outputs) {
  console.log(`[resolved-host-candidates] ${path.relative(ROOT, output.filePath)} changed=${output.changed} format_fixed=${output.formatFixed}`);
}

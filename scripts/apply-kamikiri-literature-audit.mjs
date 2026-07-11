#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Papa from 'papaparse';

import { splitCsvRecordsWithDelimiters } from './lib/csvRecords.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');
const DATA_ROOT = process.env.KAMIKIRI_LITERATURE_DATA_ROOT
  ? path.resolve(process.env.KAMIKIRI_LITERATURE_DATA_ROOT)
  : ROOT;

const AUDIT_PATH = process.env.KAMIKIRI_LITERATURE_AUDIT_PATH
  ? path.resolve(process.env.KAMIKIRI_LITERATURE_AUDIT_PATH)
  : path.join(ROOT, 'data', 'source_audits', 'japanese-longhorn-beetles-2007.csv');
const HOST_INDEX_AUDIT_PATH = process.env.KAMIKIRI_HOST_INDEX_AUDIT_PATH
  ? path.resolve(process.env.KAMIKIRI_HOST_INDEX_AUDIT_PATH)
  : path.join(ROOT, 'data', 'source_audits', 'japanese-longhorn-beetles-2007-host-index.csv');
const INSECTS_PATH = path.join(DATA_ROOT, 'normalized_data', 'insects.csv');
const HOSTPLANTS_PATH = path.join(DATA_ROOT, 'normalized_data', 'hostplants.csv');
const NOTES_PATH = path.join(DATA_ROOT, 'normalized_data', 'general_notes.csv');

const REFERENCE = '日本産カミキリムシ';
const PDF_FILE = '日本産カミキリムシ_compressed.pdf';
const PDF_SHA256 = '52299895c14c1fd1c74279dca00f6fd9ba64d36d69e3bf3dd9c3a29a92802e77';
const OCR_SHA256 = 'efb17b5912fbb2c144dab4d99924dbc341e8f64054be7909dd7818cad155bef2';
const REVIEWED_ON_RE = /^\d{4}-\d{2}-\d{2}$/;
const INCLUDED_DECISION = 'include';
const SHARED_GROUP_DECISION = 'include_shared_group';
const EXCLUDED_DECISION = 'exclude_not_in_source';
const MERGED_DUPLICATE_DECISION = 'merge_duplicate_taxon';
const PENDING_DECISION = 'needs_review';
const HOST_INDEX_INCLUDED_DECISION = 'include';
const HOST_INDEX_EXCLUDED_DECISION = 'exclude_ocr_or_boundary';

const taxonomyCorrections = new Map([
  ['species-22458', {
    year: '1879',
    scientific_name: 'Toxotinus reinii (Heyden, 1879)',
  }],
  ['species-22422', {
    synonymsToAdd: [
      'Pidonia (Pidonia) shikokensis shikokensis Chûjô & Hayashi, 1951',
      'Pidonia (Pseudopidonia) shikokensis shikokensis Chûjô & Hayashi, 1951',
    ],
  }],
  ['species-22499', {
    oldJapaneseNamesToAdd: ['イオウジマケシカミキリ'],
    synonymsToAdd: [
      'Phloeopsis bioculata (Matsumura & Matsushita, 1933)',
      'Phloeopsis iwojimana (Gressitt, 1956)',
    ],
  }],
  ['species-22327', {
    japanese_name: 'カラフトホリコバネカミキリ',
  }],
  ['species-22720', {
    synonymsToAdd: [
      'Bumetopia okinawana Hayashi, 1963',
      'Bumetopia japonica okinawana Hayashi, 1963',
    ],
  }],
]);

const hostplantCorrectionsByRecordId = new Map([
  ['hostplant-kamikiri-audit-20260625-0499', { plant_family: 'ムクロジ科' }],
]);

const clean = (value) => (value ?? '').toString().trim();

function readCsv(filePath, requiredColumns = []) {
  const text = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
  if (parsed.errors.length > 0) {
    throw new Error(`${path.relative(ROOT, filePath)}: ${parsed.errors[0].message}`);
  }
  const fields = new Set(parsed.meta.fields || []);
  for (const column of requiredColumns) {
    if (!fields.has(column)) {
      throw new Error(`${path.relative(ROOT, filePath)} is missing ${column}`);
    }
  }
  return parsed.data;
}

function parseHostPlants(value, auditId) {
  const seen = new Set();
  return clean(value)
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [plantName, plantFamily, ...extra] = entry.split('|').map((part) => part.trim());
      if (!plantName || extra.length > 0) {
        throw new Error(`${auditId}: malformed host plant entry: ${entry}`);
      }
      const key = `${plantName}\u0000${plantFamily}`;
      if (seen.has(key)) throw new Error(`${auditId}: duplicate host plant entry: ${entry}`);
      seen.add(key);
      return { plantName, plantFamily };
    });
}

const auditRows = readCsv(AUDIT_PATH, [
  'audit_id',
  'insect_id',
  'current_japanese_name',
  'source_japanese_name',
  'canonical_reference',
  'pdf_file',
  'source_pdf_sha256',
  'ocr_sha256',
  'pdf_page',
  'printed_page',
  'emergence',
  'host_plants',
  'ecology',
  'source_taxon',
  'legacy_japanese_name',
  'legacy_scientific_name',
  'legacy_route_name',
  'decision',
  'reviewed_on',
  'review_note',
  'merge_into_insect_id',
]);
const auditsByInsectId = new Map();
const auditIds = new Set();

for (const row of auditRows) {
  const auditId = clean(row.audit_id);
  const insectId = clean(row.insect_id);
  const decision = clean(row.decision);
  if (!auditId || !insectId) throw new Error('Kamikiri audit row is missing audit_id or insect_id');
  if (auditIds.has(auditId)) throw new Error(`Duplicate kamikiri audit_id: ${auditId}`);
  if (auditsByInsectId.has(insectId)) throw new Error(`Duplicate kamikiri insect_id: ${insectId}`);
  if (clean(row.canonical_reference) !== REFERENCE) throw new Error(`${auditId}: reference mismatch`);
  if (clean(row.pdf_file) !== PDF_FILE) throw new Error(`${auditId}: PDF filename mismatch`);
  if (clean(row.source_pdf_sha256) !== PDF_SHA256) throw new Error(`${auditId}: PDF hash mismatch`);
  if (clean(row.ocr_sha256) !== OCR_SHA256) throw new Error(`${auditId}: OCR hash mismatch`);
  if (!REVIEWED_ON_RE.test(clean(row.reviewed_on))) throw new Error(`${auditId}: invalid review date`);
  if (![
    INCLUDED_DECISION,
    SHARED_GROUP_DECISION,
    EXCLUDED_DECISION,
    MERGED_DUPLICATE_DECISION,
    PENDING_DECISION,
  ].includes(decision)) {
    throw new Error(`${auditId}: unsupported decision ${decision}`);
  }

  const audit = {
    ...row,
    audit_id: auditId,
    insect_id: insectId,
    decision,
    current_japanese_name: clean(row.current_japanese_name),
    source_japanese_name: clean(row.source_japanese_name),
    emergence: clean(row.emergence),
    ecology: clean(row.ecology),
    source_taxon: clean(row.source_taxon),
    legacy_japanese_name: clean(row.legacy_japanese_name),
    legacy_scientific_name: clean(row.legacy_scientific_name),
    legacy_route_name: clean(row.legacy_route_name),
    pdf_page: clean(row.pdf_page),
    printed_page: clean(row.printed_page),
    merge_into_insect_id: clean(row.merge_into_insect_id),
    hosts: parseHostPlants(row.host_plants, auditId),
  };

  if ([INCLUDED_DECISION, SHARED_GROUP_DECISION].includes(decision)) {
    if (
      (!audit.current_japanese_name && !taxonomyCorrections.get(insectId)?.japanese_name) ||
      !audit.source_japanese_name
    ) {
      throw new Error(`${auditId}: included row is missing current/source Japanese name`);
    }
    if (!audit.pdf_page || !audit.printed_page) throw new Error(`${auditId}: page evidence is missing`);
    if (!audit.emergence && !audit.ecology && audit.hosts.length === 0) {
      throw new Error(`${auditId}: included row has no publishable field`);
    }
  } else if (
    [EXCLUDED_DECISION, MERGED_DUPLICATE_DECISION].includes(decision) &&
    (audit.emergence || audit.ecology || audit.hosts.length > 0)
  ) {
    throw new Error(`${auditId}: excluded/merged row must not contain publishable data`);
  } else if (decision === PENDING_DECISION && (!audit.pdf_page || !audit.printed_page)) {
    throw new Error(`${auditId}: pending row is missing page evidence`);
  }
  if (decision === MERGED_DUPLICATE_DECISION && !audit.merge_into_insect_id) {
    throw new Error(`${auditId}: merged row is missing merge_into_insect_id`);
  }
  if (
    decision === MERGED_DUPLICATE_DECISION &&
    (!audit.legacy_scientific_name || !audit.legacy_route_name)
  ) {
    throw new Error(`${auditId}: merged row is missing a legacy scientific or route name`);
  }
  if (
    decision === MERGED_DUPLICATE_DECISION &&
    audit.current_japanese_name !== audit.legacy_japanese_name
  ) {
    throw new Error(`${auditId}: merged row Japanese name does not match legacy_japanese_name`);
  }
  if (
    decision !== MERGED_DUPLICATE_DECISION &&
    (audit.legacy_japanese_name || audit.legacy_scientific_name || audit.legacy_route_name)
  ) {
    throw new Error(`${auditId}: only merged rows may set legacy names`);
  }
  if (decision !== MERGED_DUPLICATE_DECISION && audit.merge_into_insect_id) {
    throw new Error(`${auditId}: only merged rows may set merge_into_insect_id`);
  }
  if (audit.merge_into_insect_id === insectId) {
    throw new Error(`${auditId}: duplicate and canonical insect_id must differ`);
  }

  auditIds.add(auditId);
  auditsByInsectId.set(insectId, audit);
}

const hostIndexAuditRows = readCsv(HOST_INDEX_AUDIT_PATH, [
  'audit_id',
  'insect_id',
  'current_japanese_name',
  'source_japanese_name',
  'canonical_reference',
  'pdf_file',
  'source_pdf_sha256',
  'ocr_sha256',
  'source_pdf_page',
  'source_printed_page',
  'source_ocr_line',
  'plant_name',
  'plant_family',
  'match_method',
  'decision',
  'reviewed_on',
  'review_note',
]);
const hostIndexAuditIds = new Set();
const hostIndexAudits = [];
const allowedHostIndexMatchMethods = new Set([
  'exact_japanese_name',
  'exact_old_japanese_name',
  'exact_alternative_name',
  'exact_other_names',
  'exact_derived_base_name',
  'reviewed_source_crosswalk',
]);

for (const row of hostIndexAuditRows) {
  const audit = Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, clean(value)]),
  );
  if (!audit.audit_id || !audit.insect_id) {
    throw new Error('Kamikiri host-index audit row is missing audit_id or insect_id');
  }
  if (auditIds.has(audit.audit_id) || hostIndexAuditIds.has(audit.audit_id)) {
    throw new Error(`Duplicate kamikiri host-index audit_id: ${audit.audit_id}`);
  }
  if (audit.canonical_reference !== REFERENCE) throw new Error(`${audit.audit_id}: reference mismatch`);
  if (audit.pdf_file !== PDF_FILE) throw new Error(`${audit.audit_id}: PDF filename mismatch`);
  if (audit.source_pdf_sha256 !== PDF_SHA256) throw new Error(`${audit.audit_id}: PDF hash mismatch`);
  if (audit.ocr_sha256 !== OCR_SHA256) throw new Error(`${audit.audit_id}: OCR hash mismatch`);
  if (!REVIEWED_ON_RE.test(audit.reviewed_on)) throw new Error(`${audit.audit_id}: invalid review date`);
  if (![HOST_INDEX_INCLUDED_DECISION, HOST_INDEX_EXCLUDED_DECISION, PENDING_DECISION].includes(audit.decision)) {
    throw new Error(`${audit.audit_id}: unsupported host-index decision ${audit.decision}`);
  }
  if (!audit.source_pdf_page || !audit.source_printed_page || !audit.source_ocr_line) {
    throw new Error(`${audit.audit_id}: host-index page or OCR-line evidence is missing`);
  }
  if (!audit.current_japanese_name || !audit.source_japanese_name) {
    throw new Error(`${audit.audit_id}: host-index Japanese name is missing`);
  }
  if (!audit.plant_name || !audit.plant_family) {
    throw new Error(`${audit.audit_id}: host-index plant name or family is missing`);
  }
  if (!allowedHostIndexMatchMethods.has(audit.match_method)) {
    throw new Error(`${audit.audit_id}: unsafe host-index match method ${audit.match_method}`);
  }
  if (
    audit.match_method === 'exact_derived_base_name' &&
    audit.decision !== HOST_INDEX_EXCLUDED_DECISION
  ) {
    const derivedBaseName = audit.current_japanese_name
      .replace(/\s+(?:基亜種|亜種\d*|[A-Z].+亜種).*$/u, '')
      .trim();
    if (derivedBaseName !== audit.source_japanese_name) {
      throw new Error(
        `${audit.audit_id}: derived-base source name does not match the registered taxon`,
      );
    }
  }
  if (!audit.review_note) throw new Error(`${audit.audit_id}: host-index review note is missing`);
  hostIndexAuditIds.add(audit.audit_id);
  hostIndexAudits.push(audit);
}

function parseRecord(record, fileLabel) {
  const parsed = Papa.parse(record);
  if (parsed.errors.length > 0) throw new Error(`${fileLabel}: ${parsed.errors[0].message}`);
  return parsed.data[0];
}

function unparseRecord(values) {
  return Papa.unparse([values], { newline: '' });
}

function buildRewrittenCsv(filePath, requiredColumns, transform, appendRows = []) {
  const source = fs.readFileSync(filePath, 'utf8');
  const hasBom = source.charCodeAt(0) === 0xfeff;
  const body = hasBom ? source.slice(1) : source;
  const entries = splitCsvRecordsWithDelimiters(body);
  if (entries.length === 0) throw new Error(`${path.relative(ROOT, filePath)} is empty`);

  const header = parseRecord(entries[0].record, path.relative(ROOT, filePath));
  const indexes = Object.fromEntries(header.map((name, index) => [name, index]));
  for (const column of requiredColumns) {
    if (indexes[column] === undefined) {
      throw new Error(`${path.relative(ROOT, filePath)} is missing ${column}`);
    }
  }

  const output = [entries[0]];
  for (const entry of entries.slice(1)) {
    if (!entry.record) continue;
    const values = parseRecord(entry.record, path.relative(ROOT, filePath));
    const replacement = transform(values, indexes);
    if (replacement === null) continue;
    output.push({
      record: replacement === values ? entry.record : unparseRecord(replacement),
      delimiter: entry.delimiter,
    });
  }

  const fallbackDelimiter = output.find(({ delimiter }) => delimiter)?.delimiter || '\n';
  if (appendRows.length > 0 && output.at(-1).delimiter === '') {
    output[output.length - 1] = { ...output.at(-1), delimiter: fallbackDelimiter };
  }
  appendRows.forEach((row, index) => {
    output.push({
      record: unparseRecord(header.map((column) => row[column] ?? '')),
      delimiter: index === appendRows.length - 1 ? fallbackDelimiter : fallbackDelimiter,
    });
  });

  return `${hasBom ? '\ufeff' : ''}${output.map(({ record, delimiter }) => `${record}${delimiter}`).join('')}`;
}

function assertUniqueColumn(csvText, filePath, column) {
  const parsed = Papa.parse(csvText.replace(/^\ufeff/, ''), { header: true, skipEmptyLines: true });
  if (parsed.errors.length > 0) {
    throw new Error(`${path.relative(ROOT, filePath)}: ${parsed.errors[0].message}`);
  }
  const seen = new Set();
  for (const row of parsed.data) {
    const value = clean(row[column]);
    if (!value) throw new Error(`${path.relative(ROOT, filePath)} has an empty ${column}`);
    if (seen.has(value)) throw new Error(`${path.relative(ROOT, filePath)} has duplicate ${column}: ${value}`);
    seen.add(value);
  }
}

function assertExpectedRecordIds(csvText, filePath, expectedIds) {
  const parsed = Papa.parse(csvText.replace(/^\ufeff/, ''), { header: true, skipEmptyLines: true });
  if (parsed.errors.length > 0) {
    throw new Error(`${path.relative(ROOT, filePath)}: ${parsed.errors[0].message}`);
  }
  const counts = new Map();
  for (const row of parsed.data) {
    const recordId = clean(row.record_id);
    counts.set(recordId, (counts.get(recordId) || 0) + 1);
  }
  for (const expectedId of expectedIds) {
    if (counts.get(expectedId) !== 1) {
      throw new Error(
        `${path.relative(ROOT, filePath)} must contain ${expectedId} exactly once; ` +
        `found ${counts.get(expectedId) || 0}`,
      );
    }
  }
}

function assertUniqueKamikiriHostPairs(csvText, filePath) {
  const parsed = Papa.parse(csvText.replace(/^\ufeff/, ''), { header: true, skipEmptyLines: true });
  if (parsed.errors.length > 0) {
    throw new Error(`${path.relative(ROOT, filePath)}: ${parsed.errors[0].message}`);
  }
  const seen = new Set();
  for (const row of parsed.data) {
    if (clean(row.reference) !== REFERENCE) continue;
    const key = `${clean(row.insect_id)}\u0000${clean(row.plant_name)}`;
    if (seen.has(key)) {
      throw new Error(
        `${path.relative(ROOT, filePath)} has duplicate ${REFERENCE} host pair: ` +
        `${clean(row.insect_id)} / ${clean(row.plant_name)}`,
      );
    }
    seen.add(key);
  }
}

function writeOutputsAtomically(outputs) {
  const temporaryFiles = [];
  try {
    for (const [filePath, contents] of outputs) {
      const temporaryPath = `${filePath}.tmp-${process.pid}`;
      fs.writeFileSync(temporaryPath, contents, 'utf8');
      temporaryFiles.push(temporaryPath);
    }
    outputs.forEach(([filePath], index) => fs.renameSync(temporaryFiles[index], filePath));
    temporaryFiles.length = 0;
  } finally {
    for (const temporaryPath of temporaryFiles) fs.rmSync(temporaryPath, { force: true });
  }
}

const insects = readCsv(INSECTS_PATH, ['insect_id', 'japanese_name']);
const insectsById = new Map(insects.map((row) => [clean(row.insect_id), row]));
for (const audit of auditsByInsectId.values()) {
  const insect = insectsById.get(audit.insect_id);
  if (!insect && audit.decision === MERGED_DUPLICATE_DECISION) continue;
  if (!insect) throw new Error(`${audit.audit_id}: insect_id is absent from insects.csv`);
  const allowedCurrentNames = new Set([
    audit.current_japanese_name,
    clean(taxonomyCorrections.get(audit.insect_id)?.japanese_name),
  ].filter(Boolean));
  if (allowedCurrentNames.size > 0 && !allowedCurrentNames.has(clean(insect.japanese_name))) {
    throw new Error(`${audit.audit_id}: current Japanese name no longer matches insects.csv`);
  }
}
for (const audit of hostIndexAudits) {
  const insect = insectsById.get(audit.insect_id);
  if (!insect) throw new Error(`${audit.audit_id}: host-index insect_id is absent from insects.csv`);
  if (clean(insect.japanese_name) !== audit.current_japanese_name) {
    throw new Error(`${audit.audit_id}: host-index current Japanese name no longer matches insects.csv`);
  }
}

const mergedAudits = [...auditsByInsectId.values()].filter(
  (audit) => audit.decision === MERGED_DUPLICATE_DECISION,
);
const mergedDuplicateIds = new Set(mergedAudits.map((audit) => audit.insect_id));
const mergedDuplicateEvidenceRows = [
  ...readCsv(HOSTPLANTS_PATH, ['record_id', 'insect_id']).map((row) => ({
    file: path.relative(ROOT, HOSTPLANTS_PATH),
    recordId: clean(row.record_id),
    insectId: clean(row.insect_id),
  })),
  ...readCsv(NOTES_PATH, ['record_id', 'insect_id']).map((row) => ({
    file: path.relative(ROOT, NOTES_PATH),
    recordId: clean(row.record_id),
    insectId: clean(row.insect_id),
  })),
].filter((row) => mergedDuplicateIds.has(row.insectId));
if (mergedDuplicateEvidenceRows.length > 0) {
  const sample = mergedDuplicateEvidenceRows
    .slice(0, 5)
    .map((row) => `${row.file}:${row.recordId} (${row.insectId})`)
    .join(', ');
  throw new Error(
    `Merged duplicate IDs gained linked evidence; migrate it to the canonical ID before applying: ${sample}`,
  );
}
for (const audit of mergedAudits) {
  const canonical = insectsById.get(audit.merge_into_insect_id);
  if (!canonical) {
    throw new Error(`${audit.audit_id}: merge target is absent from insects.csv`);
  }
  if (auditsByInsectId.get(audit.merge_into_insect_id)?.decision === MERGED_DUPLICATE_DECISION) {
    throw new Error(`${audit.audit_id}: merge target is itself marked as a duplicate`);
  }
}

const splitList = (value) => clean(value)
  .split(/[;；]/)
  .map((item) => item.trim())
  .filter(Boolean);

const mergeAdditionsByCanonicalId = new Map();
for (const audit of mergedAudits) {
  const duplicate = insectsById.get(audit.insect_id);
  const additions = mergeAdditionsByCanonicalId.get(audit.merge_into_insect_id) || {
    scientificNames: new Set(),
    JapaneseNames: new Set(),
  };
  for (const scientificName of [
    audit.source_taxon,
    audit.legacy_scientific_name,
    clean(duplicate?.scientific_name),
    ...splitList(duplicate?.synonyms),
  ]) {
    if (scientificName) additions.scientificNames.add(scientificName);
  }
  for (const JapaneseName of [
    clean(audit.current_japanese_name),
    audit.legacy_japanese_name,
    audit.legacy_route_name !== audit.legacy_scientific_name ? audit.legacy_route_name : '',
    clean(duplicate?.japanese_name),
    ...splitList(duplicate?.old_japanese_name),
    ...splitList(duplicate?.alternative_name),
    ...splitList(duplicate?.other_names),
  ]) {
    if (JapaneseName) additions.JapaneseNames.add(JapaneseName);
  }
  mergeAdditionsByCanonicalId.set(audit.merge_into_insect_id, additions);
}

const includedAudits = [...auditsByInsectId.values()].filter(
  (audit) => [INCLUDED_DECISION, SHARED_GROUP_DECISION].includes(audit.decision),
);
const appliedAuditsByInsectId = new Map(
  [...auditsByInsectId].filter(([, audit]) => audit.decision !== PENDING_DECISION),
);

const hostRows = [];
for (const audit of includedAudits) {
  audit.hosts.forEach(({ plantName, plantFamily }, index) => {
    hostRows.push({
      record_id: `host-${audit.audit_id}-${String(index + 1).padStart(2, '0')}`,
      insect_id: audit.insect_id,
      plant_name: plantName,
      plant_family: plantFamily,
      observation_type: '文献',
      plant_part: '',
      life_stage: '幼虫',
      reference: REFERENCE,
      notes: '',
    });
  });
}
const includedHostIndexAudits = hostIndexAudits.filter(
  (audit) => audit.decision === HOST_INDEX_INCLUDED_DECISION,
);
for (const audit of includedHostIndexAudits) {
  hostRows.push({
    record_id: `host-${audit.audit_id}`,
    insect_id: audit.insect_id,
    plant_name: audit.plant_name,
    plant_family: audit.plant_family,
    observation_type: '文献',
    plant_part: '',
    life_stage: '幼虫',
    reference: REFERENCE,
    notes: '',
  });
}
const hostIndexRecordIds = new Set(
  hostIndexAudits.map((audit) => `host-${audit.audit_id}`),
);

const rewrittenHostplants = buildRewrittenCsv(
  HOSTPLANTS_PATH,
  ['record_id', 'insect_id', 'plant_name', 'plant_family', 'reference'],
  (values, indexes) => {
    const recordId = clean(values[indexes.record_id]);
    const insectId = clean(values[indexes.insect_id]);
    const reference = clean(values[indexes.reference]);
    const audit = appliedAuditsByInsectId.get(insectId);
    if (hostIndexRecordIds.has(recordId)) return null;
    if (audit?.decision === MERGED_DUPLICATE_DECISION) return null;
    if (audit && reference === REFERENCE) return null;
    const correction = hostplantCorrectionsByRecordId.get(recordId);
    if (!correction) return values;
    const updated = [...values];
    for (const [column, value] of Object.entries(correction)) {
      if (indexes[column] === undefined) {
        throw new Error(`${path.relative(ROOT, HOSTPLANTS_PATH)} is missing ${column}`);
      }
      updated[indexes[column]] = value;
    }
    return updated;
  },
  hostRows,
);

const noteRows = [];
for (const audit of includedAudits) {
  const notePage = audit.printed_page;
  if (audit.emergence) {
    noteRows.push({
      record_id: `note-${audit.audit_id}-emergence`,
      insect_id: audit.insect_id,
      note_type: '出現時期',
      content: audit.emergence,
      reference: REFERENCE,
      page: notePage,
      year: '2007',
    });
  }
  if (audit.ecology) {
    noteRows.push({
      record_id: `note-${audit.audit_id}-ecology`,
      insect_id: audit.insect_id,
      note_type: '生態情報',
      content: audit.ecology,
      reference: REFERENCE,
      page: notePage,
      year: '2007',
    });
  }
}

const rewrittenNotes = buildRewrittenCsv(
  NOTES_PATH,
  ['record_id', 'insect_id', 'note_type', 'content', 'reference', 'page', 'year'],
  (values, indexes) => {
    const insectId = clean(values[indexes.insect_id]);
    const reference = clean(values[indexes.reference]);
    const audit = appliedAuditsByInsectId.get(insectId);
    if (audit?.decision === MERGED_DUPLICATE_DECISION) return null;
    if (audit && reference === REFERENCE) return null;
    return values;
  },
  noteRows,
);

const reviewedNote = '『日本産カミキリムシ』(2007)の原典ページを再監査済み。';
const notInSourceNote = '2023年記載のため、2007年刊『日本産カミキリムシ』には未収録。';
const linkedEvidenceInsectIds = new Set([
  ...readCsv(HOSTPLANTS_PATH, ['insect_id']).map((row) => clean(row.insect_id)),
  ...readCsv(NOTES_PATH, ['insect_id']).map((row) => clean(row.insect_id)),
  ...hostRows.map((row) => row.insect_id),
  ...noteRows.map((row) => row.insect_id),
].filter(Boolean));
const rewrittenInsects = buildRewrittenCsv(
  INSECTS_PATH,
  [
    'insect_id',
    'japanese_name',
    'old_japanese_name',
    'year',
    'scientific_name',
    'synonyms',
    'notes',
    'family',
  ],
  (values, indexes) => {
    const insectId = clean(values[indexes.insect_id]);
    const audit = appliedAuditsByInsectId.get(insectId);
    const mergeAdditions = mergeAdditionsByCanonicalId.get(insectId);
    const hasLinkedKamikiriEvidence =
      clean(values[indexes.family]) === 'Cerambycidae' &&
      linkedEvidenceInsectIds.has(insectId);
    if (audit?.decision === MERGED_DUPLICATE_DECISION) return null;
    if (!audit && !mergeAdditions && !hasLinkedKamikiriEvidence) return values;

    const updated = [...values];

    if (hasLinkedKamikiriEvidence) {
      updated[indexes.notes] = clean(updated[indexes.notes])
        .replace(/食草・生態情報は未入力。?/g, '')
        .trim();
    }

    if (mergeAdditions) {
      const synonyms = splitList(updated[indexes.synonyms]);
      const canonicalScientificName = clean(updated[indexes.scientific_name]);
      for (const scientificName of mergeAdditions.scientificNames) {
        if (scientificName !== canonicalScientificName && !synonyms.includes(scientificName)) {
          synonyms.push(scientificName);
        }
      }
      updated[indexes.synonyms] = synonyms.join('; ');

      const oldJapaneseNames = splitList(updated[indexes.old_japanese_name]);
      const canonicalJapaneseName = clean(updated[indexes.japanese_name]);
      for (const JapaneseName of mergeAdditions.JapaneseNames) {
        if (JapaneseName !== canonicalJapaneseName && !oldJapaneseNames.includes(JapaneseName)) {
          oldJapaneseNames.push(JapaneseName);
        }
      }
      updated[indexes.old_japanese_name] = oldJapaneseNames.join('; ');
    }

    if (!audit) return updated;

    const taxonomyCorrection = taxonomyCorrections.get(insectId);
    if ([INCLUDED_DECISION, SHARED_GROUP_DECISION].includes(audit.decision) && taxonomyCorrection) {
      if (taxonomyCorrection.japanese_name) {
        updated[indexes.japanese_name] = taxonomyCorrection.japanese_name;
      }
      if (taxonomyCorrection.year) updated[indexes.year] = taxonomyCorrection.year;
      if (taxonomyCorrection.scientific_name) {
        updated[indexes.scientific_name] = taxonomyCorrection.scientific_name;
      }
      if (taxonomyCorrection.synonymsToAdd) {
        const synonyms = clean(updated[indexes.synonyms])
          .split(/[;；]/)
          .map((value) => value.trim())
          .filter(Boolean);
        for (const synonym of taxonomyCorrection.synonymsToAdd) {
          if (!synonyms.includes(synonym)) synonyms.push(synonym);
        }
        updated[indexes.synonyms] = synonyms.join('; ');
      }
      if (taxonomyCorrection.oldJapaneseNamesToAdd) {
        const oldJapaneseNames = clean(updated[indexes.old_japanese_name])
          .split(/[;；]/)
          .map((value) => value.trim())
          .filter(Boolean);
        for (const oldJapaneseName of taxonomyCorrection.oldJapaneseNamesToAdd) {
          if (!oldJapaneseNames.includes(oldJapaneseName)) oldJapaneseNames.push(oldJapaneseName);
        }
        updated[indexes.old_japanese_name] = oldJapaneseNames.join('; ');
      }
    }

    if (
      audit.decision === INCLUDED_DECISION &&
      audit.source_japanese_name &&
      audit.source_japanese_name !== clean(updated[indexes.japanese_name])
    ) {
      const aliases = clean(updated[indexes.old_japanese_name])
        .split(/[;；]/)
        .map((value) => value.trim())
        .filter(Boolean);
      if (!aliases.includes(audit.source_japanese_name)) aliases.push(audit.source_japanese_name);
      updated[indexes.old_japanese_name] = aliases.join('; ');
    }

    let notes = clean(updated[indexes.notes]);
    notes = notes
      .replace(/食草・生態情報は未入力。?/g, '')
      .replace(/寄主植物情報は日本産カミキリムシにもとづく。?/g, '')
      .replace(/(?:寄主植物・出現時期・生態情報は)?『日本産カミキリムシ』\(2007\)の原典ページを再監査済み。?/g, '')
      .replace(/2023年記載のため、2007年刊『日本産カミキリムシ』には未収録。?/g, '')
      .trim();
    if (notes && !/[。.]$/.test(notes)) notes += '。';
    const auditNote = [INCLUDED_DECISION, SHARED_GROUP_DECISION].includes(audit.decision)
      ? reviewedNote
      : notInSourceNote;
    updated[indexes.notes] = `${notes}${auditNote}`;
    return updated;
  },
);

assertExpectedRecordIds(
  rewrittenHostplants,
  HOSTPLANTS_PATH,
  hostRows.map((row) => row.record_id),
);
assertExpectedRecordIds(
  rewrittenNotes,
  NOTES_PATH,
  noteRows.map((row) => row.record_id),
);
assertUniqueKamikiriHostPairs(rewrittenHostplants, HOSTPLANTS_PATH);
assertUniqueColumn(rewrittenInsects, INSECTS_PATH, 'insect_id');
writeOutputsAtomically([
  [HOSTPLANTS_PATH, rewrittenHostplants],
  [NOTES_PATH, rewrittenNotes],
  [INSECTS_PATH, rewrittenInsects],
]);

const excludedCount = auditRows.filter((row) => clean(row.decision) === EXCLUDED_DECISION).length;
const mergedCount = auditRows.filter((row) => clean(row.decision) === MERGED_DUPLICATE_DECISION).length;
const pendingCount = auditRows.filter((row) => clean(row.decision) === PENDING_DECISION).length;
const excludedHostIndexCount = hostIndexAudits.filter(
  (row) => row.decision === HOST_INDEX_EXCLUDED_DECISION,
).length;
const pendingHostIndexCount = hostIndexAudits.filter(
  (row) => row.decision === PENDING_DECISION,
).length;
console.log(
  `[kamikiri-literature-audit] applied ${includedAudits.length} included and ` +
  `${excludedCount} excluded source decisions; merged ${mergedCount} duplicate taxa; ` +
  `kept ${pendingCount} pending for review ` +
  `(${hostRows.length} host rows, ${noteRows.length} note rows); ` +
  `host-index ${includedHostIndexAudits.length} included, ${excludedHostIndexCount} excluded, ` +
  `${pendingHostIndexCount} pending`,
);

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

const DATA_ROOT = process.env.SCOLYT_KABE_DATA_ROOT
  ? path.resolve(process.env.SCOLYT_KABE_DATA_ROOT)
  : ROOT;
const AUDIT_PATH = process.env.SCOLYT_KABE_AUDIT_PATH
  ? path.resolve(process.env.SCOLYT_KABE_AUDIT_PATH)
  : path.join(ROOT, 'data', 'source_audits', 'scolytinae-kabe-1959-host-zero-audit-2026-07-12.json');
const INSECTS_PATH = process.env.SCOLYT_KABE_INSECTS_PATH
  ? path.resolve(process.env.SCOLYT_KABE_INSECTS_PATH)
  : path.join(DATA_ROOT, 'normalized_data', 'insects.csv');
const PDF_PATH = process.env.SCOLYT_KABE_PDF_PATH
  ? path.resolve(process.env.SCOLYT_KABE_PDF_PATH)
  : '';
const CHECK_ONLY = process.argv.includes('--check');

const SOURCE_HASH = '1964fac26604728349a195d5b6f02e329499eec6da1d8b8484442c864a332c22';
const SOURCE_REFERENCE = '加辺正明 (1959) 日本産キクイムシ類食痕図説';
const ACCOUNT_MAP = new Map([
  [2, [42, 'species-SC210']], [6, [45, 'species-SC214']], [11, [48, 'species-SC120']],
  [12, [48, 'species-SC121']], [13, [49, 'species-SC123']], [14, [49, 'species-SC124']],
  [15, [49, 'species-SC125']], [16, [49, 'species-SC127']], [20, [50, 'species-SC143']],
  [21, [50, 'species-SC134']], [24, [52, 'species-SC136']], [25, [52, 'species-SC137']],
  [27, [52, 'species-SC139']], [28, [52, 'species-SC152']], [29, [53, 'species-SC154']],
  [34, [55, 'species-SC180']], [37, [58, 'species-SC185']], [39, [60, 'species-SC187']],
  [40, [61, 'species-SC189']], [41, [61, 'species-SC188']], [44, [62, 'species-SC079']],
  [50, [63, 'species-SC013']], [52, [64, 'species-SC015']], [54, [65, 'species-SC017']],
  [55, [65, 'species-SC018']], [58, [65, 'species-SC022']], [61, [66, 'species-SC026']],
  [62, [66, 'species-SC029']], [64, [67, 'species-SC032']], [67, [68, 'species-SC035']],
  [69, [69, 'species-SC036']], [71, [69, 'species-SC043']], [73, [70, 'species-SC077']],
  [74, [70, 'species-SC078']], [75, [70, 'species-SC053']], [121, [89, 'species-SC098']],
  [123, [90, 'species-SC100']], [124, [90, 'species-SC103']], [130, [92, 'species-SC109']],
  [132, [93, 'species-SC110']], [133, [93, 'species-SC112']], [143, [98, 'species-SC289']],
  [157, [103, 'species-SC293']], [161, [105, 'species-SC294']], [172, [109, 'species-SC295']],
  [174, [110, 'species-SC296']], [195, [116, 'species-SC220']], [196, [117, 'species-SC221']],
  [197, [117, 'species-SC222']], [199, [118, 'species-SC223']],
]);
const HOST_COLUMNS = [
  'record_id', 'insect_id', 'plant_name', 'plant_family', 'observation_type',
  'plant_part', 'life_stage', 'reference', 'notes',
];
const NOTE_COLUMNS = ['record_id', 'insect_id', 'note_type', 'content', 'reference', 'page', 'year'];
const TARGETS = [
  ...['normalized_data', 'public'].map((collection) => ({
    collection,
    kind: 'hosts',
    path: path.join(DATA_ROOT, collection, 'hostplants.csv'),
    columns: HOST_COLUMNS,
  })),
  ...['normalized_data', 'public'].map((collection) => ({
    collection,
    kind: 'notes',
    path: path.join(DATA_ROOT, collection, 'general_notes.csv'),
    columns: NOTE_COLUMNS,
  })),
];

const clean = (value) => (value ?? '').toString().trim();
const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function readCsv(filePath) {
  const parsed = Papa.parse(fs.readFileSync(filePath, 'utf8'), { header: true, skipEmptyLines: true });
  if (parsed.errors.length > 0) throw new Error(`${filePath}: ${parsed.errors[0].message}`);
  return parsed.data;
}

function readAndValidateAudit() {
  const audit = JSON.parse(fs.readFileSync(AUDIT_PATH, 'utf8'));
  if (!isPlainObject(audit) || audit.schema_version !== 1 || audit.audit_id !== 'scolytinae-kabe-1959-host-zero-2026-07-12') {
    throw new Error('Unexpected Scolytinae audit schema or audit_id');
  }
  if (
    audit.source?.sha256 !== SOURCE_HASH
    || audit.source?.page_count !== 160
    || audit.source?.method_page !== 12
    || !clean(audit.source?.method_evidence).includes('括弧')
  ) {
    throw new Error('Source provenance or direct-observation rule is incomplete');
  }
  if (!Array.isArray(audit.accounts) || audit.accounts.length !== ACCOUNT_MAP.size) {
    throw new Error(`Expected ${ACCOUNT_MAP.size} audited accounts`);
  }

  const insects = readCsv(INSECTS_PATH);
  const scolytinae = insects.filter((row) => row.subfamily === 'Scolytinae');
  const insectsById = new Map(scolytinae.map((row) => [row.insect_id, row]));
  const binomialCounts = new Map();
  for (const row of scolytinae) {
    const binomial = `${clean(row.genus)} ${clean(row.species)}`;
    binomialCounts.set(binomial, (binomialCounts.get(binomial) || 0) + 1);
  }

  const seenAccounts = new Set();
  const seenInsects = new Set();
  let directAccounts = 0;
  let parentheticalOnlyAccounts = 0;
  let hostCount = 0;
  let ecologyCount = 0;
  for (const account of audit.accounts) {
    const expected = ACCOUNT_MAP.get(account.account_no);
    if (!expected || seenAccounts.has(account.account_no)) {
      throw new Error(`Unexpected or duplicate source account ${account.account_no}`);
    }
    seenAccounts.add(account.account_no);
    if (account.pdf_page !== expected[0] || account.insect_id !== expected[1]) {
      throw new Error(`Account ${account.account_no}: page or current insect mapping changed`);
    }
    if (seenInsects.has(account.insect_id)) throw new Error(`Duplicate insect_id ${account.insect_id}`);
    seenInsects.add(account.insect_id);
    const insect = insectsById.get(account.insect_id);
    if (!insect) throw new Error(`Account ${account.account_no}: current Scolytinae row is missing`);
    const currentBinomial = `${clean(insect.genus)} ${clean(insect.species)}`;
    if (
      currentBinomial !== account.current_binomial
      || account.source_binomial !== account.current_binomial
      || binomialCounts.get(currentBinomial) !== 1
    ) {
      throw new Error(`Account ${account.account_no}: binomial mapping is no longer exact and unique`);
    }
    if (!Number.isInteger(account.printed_page) || account.printed_page <= 0 || !clean(account.raw_host_line)) {
      throw new Error(`Account ${account.account_no}: page or raw host evidence is incomplete`);
    }
    if (account.evidence_status !== 'original_pdf_visual_confirmed') {
      throw new Error(`Account ${account.account_no}: original image confirmation is required`);
    }
    if (!Array.isArray(account.accepted_hosts) || !Array.isArray(account.excluded_parenthetical_hosts)) {
      throw new Error(`Account ${account.account_no}: host decisions must be arrays`);
    }
    if (account.accepted_hosts.length > 0) {
      directAccounts += 1;
      if (account.decision !== 'include_direct_observation') {
        throw new Error(`Account ${account.account_no}: direct hosts require include decision`);
      }
    } else {
      parentheticalOnlyAccounts += 1;
      if (account.decision !== 'needs_review_parenthetical_only' || account.ecology_note !== null) {
        throw new Error(`Account ${account.account_no}: parenthetical-only hosts must remain unpublished`);
      }
    }
    const plantNames = new Set();
    for (const host of account.accepted_hosts) {
      if (
        !isPlainObject(host)
        || !clean(host.source_name)
        || !clean(host.plant_name)
        || !clean(host.plant_family)
        || !clean(host.locations)
      ) {
        throw new Error(`Account ${account.account_no}: accepted host evidence is incomplete`);
      }
      if (plantNames.has(host.plant_name)) throw new Error(`Account ${account.account_no}: duplicate accepted plant`);
      plantNames.add(host.plant_name);
      if (account.excluded_parenthetical_hosts.includes(host.source_name)) {
        throw new Error(`Account ${account.account_no}: parenthetical host was accepted`);
      }
      hostCount += 1;
    }
    if (account.ecology_note !== null) {
      if (!clean(account.ecology_note) || /PDF|監査|ページ|頁/.test(account.ecology_note)) {
        throw new Error(`Account ${account.account_no}: public ecology note contains audit metadata`);
      }
      ecologyCount += 1;
    }
  }
  if (
    seenAccounts.size !== ACCOUNT_MAP.size
    || directAccounts !== 28
    || parentheticalOnlyAccounts !== 22
    || hostCount !== 52
    || ecologyCount !== 25
  ) {
    throw new Error(
      `Unexpected audit totals: accounts=${seenAccounts.size} direct=${directAccounts} `
      + `parenthetical_only=${parentheticalOnlyAccounts} hosts=${hostCount} ecology=${ecologyCount}`,
    );
  }
  return audit;
}

function verifyPdf() {
  if (!PDF_PATH) return;
  if (!fs.existsSync(PDF_PATH)) throw new Error(`Missing source PDF: ${PDF_PATH}`);
  const actualHash = crypto.createHash('sha256').update(fs.readFileSync(PDF_PATH)).digest('hex');
  if (actualHash !== SOURCE_HASH) throw new Error(`Source PDF SHA-256 mismatch: ${actualHash}`);
}

function buildAdditions(audit) {
  const hosts = [];
  const notes = [];
  for (const account of audit.accounts) {
    account.accepted_hosts.forEach((host, index) => {
      hosts.push({
        record_id: `hostplant-SCOLYT-KABE-1959-${String(account.account_no).padStart(3, '0')}-${String(index + 1).padStart(2, '0')}`,
        insect_id: account.insect_id,
        plant_name: host.plant_name,
        plant_family: host.plant_family,
        observation_type: audit.scope.observation_type,
        plant_part: '',
        life_stage: audit.scope.life_stage,
        reference: SOURCE_REFERENCE,
        notes: '',
      });
    });
    if (account.ecology_note) {
      notes.push({
        record_id: `note-SCOLYT-KABE-1959-${String(account.account_no).padStart(3, '0')}`,
        insect_id: account.insect_id,
        note_type: '生態情報',
        content: account.ecology_note,
        reference: SOURCE_REFERENCE,
        page: '',
        year: '1959',
      });
    }
  }
  return { hosts, notes };
}

function parseRecord(record, filePath) {
  const parsed = Papa.parse(record);
  if (parsed.errors.length > 0) throw new Error(`${filePath}: ${parsed.errors[0].message}`);
  return parsed.data[0];
}

function matchesObject(row, indexes, object) {
  return Object.entries(object).every(([field, value]) => (row[indexes[field]] ?? '') === value);
}

function transformCsv(target, additions, targetInsectIds) {
  if (!fs.existsSync(target.path)) throw new Error(`Missing target: ${target.path}`);
  const source = fs.readFileSync(target.path, 'utf8');
  const hasBom = source.charCodeAt(0) === 0xfeff;
  const body = hasBom ? source.slice(1) : source;
  const entries = splitCsvRecordsWithDelimiters(body);
  if (entries.length === 0) throw new Error(`${target.path} is empty`);
  const header = parseRecord(entries[0].record, target.path);
  const indexes = Object.fromEntries(header.map((name, index) => [name, index]));
  for (const column of target.columns) {
    if (indexes[column] === undefined) throw new Error(`${target.path} is missing ${column}`);
  }

  const expectedById = new Map(additions.map((row) => [row.record_id, row]));
  if (expectedById.size !== additions.length) throw new Error(`${target.kind}: duplicate generated record_id`);
  const rowsById = new Map();
  const pairOwners = new Map();
  const output = [entries[0]];
  let beforeCount = 0;
  for (const entry of entries.slice(1)) {
    if (!entry.record) continue;
    const row = parseRecord(entry.record, target.path);
    const recordId = row[indexes.record_id];
    if (!recordId || rowsById.has(recordId)) throw new Error(`${target.path}: invalid or duplicate record_id ${recordId}`);
    rowsById.set(recordId, row);
    output.push(entry);
    beforeCount += 1;
    if (target.kind === 'hosts' && targetInsectIds.has(row[indexes.insect_id])) {
      if (!expectedById.has(recordId)) {
        throw new Error(`${target.collection}: target insect no longer has the required host=0 baseline`);
      }
      const pairKey = `${row[indexes.insect_id]}\u0000${row[indexes.plant_name]}`;
      if (pairOwners.has(pairKey)) throw new Error(`${target.collection}: duplicate target insect-plant pair`);
      pairOwners.set(pairKey, recordId);
    }
  }

  const defaultDelimiter = entries.find((entry) => entry.delimiter)?.delimiter || '\n';
  let addedRows = 0;
  for (const addition of additions) {
    const existing = rowsById.get(addition.record_id);
    if (existing) {
      if (!matchesObject(existing, indexes, addition)) {
        throw new Error(`${target.collection}/${target.kind}: conflicting ${addition.record_id}`);
      }
      continue;
    }
    if (target.kind === 'hosts') {
      const pairKey = `${addition.insect_id}\u0000${addition.plant_name}`;
      if (pairOwners.has(pairKey)) {
        throw new Error(`${target.collection}: target insect-plant pair already belongs to another record`);
      }
      pairOwners.set(pairKey, addition.record_id);
    }
    const row = header.map((column) => addition[column] ?? '');
    const previous = output.at(-1);
    if (previous && !previous.delimiter) previous.delimiter = defaultDelimiter;
    output.push({ record: Papa.unparse([row], { newline: '' }), delimiter: defaultDelimiter });
    rowsById.set(addition.record_id, row);
    addedRows += 1;
  }

  for (const addition of additions) {
    const row = rowsById.get(addition.record_id);
    if (!row || !matchesObject(row, indexes, addition)) {
      throw new Error(`${target.collection}/${target.kind}: approved state not reached for ${addition.record_id}`);
    }
  }
  if (target.kind === 'hosts') {
    const expectedIds = new Set(additions.map((row) => row.record_id));
    const actualIds = new Set([...rowsById].filter(([, row]) => targetInsectIds.has(row[indexes.insect_id])).map(([id]) => id));
    if (actualIds.size !== expectedIds.size || [...actualIds].some((id) => !expectedIds.has(id))) {
      throw new Error(`${target.collection}: target host scope contains unapproved rows`);
    }
  }

  return {
    target,
    text: `${hasBom ? '\ufeff' : ''}${output.map(({ record, delimiter }) => `${record}${delimiter}`).join('')}`,
    beforeCount,
    afterCount: rowsById.size,
    addedRows,
  };
}

function writeAtomically(results) {
  const temporary = [];
  try {
    for (const result of results) {
      const temporaryPath = `${result.target.path}.scolyt-kabe-${process.pid}.tmp`;
      fs.writeFileSync(temporaryPath, result.text, 'utf8');
      temporary.push({ temporaryPath, destination: result.target.path });
    }
    for (const item of temporary) fs.renameSync(item.temporaryPath, item.destination);
  } finally {
    for (const item of temporary) fs.rmSync(item.temporaryPath, { force: true });
  }
}

const audit = readAndValidateAudit();
verifyPdf();
const additions = buildAdditions(audit);
const targetInsectIds = new Set(audit.accounts.map((account) => account.insect_id));
const results = TARGETS.map((target) => transformCsv(target, additions[target.kind], targetInsectIds));
if (!CHECK_ONLY) writeAtomically(results);

for (const result of results) {
  console.log(
    `[scolyt-kabe-1959] ${result.target.collection}/${result.target.kind}: `
    + `${result.beforeCount}->${result.afterCount} added=${result.addedRows}`
    + `${CHECK_ONLY ? ' check-only' : ''}`,
  );
}

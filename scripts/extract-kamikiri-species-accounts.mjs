#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Papa from 'papaparse';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_OCR_FILE = path.join(ROOT, 'pdfs', 'kamikiri-ocr', '日本産カミキリムシ_compressed.txt');
const OCR_FILE = process.env.KAMIKIRI_OCR_FILE
  ? path.resolve(process.env.KAMIKIRI_OCR_FILE)
  : DEFAULT_OCR_FILE;
const OUTPUT = process.env.KAMIKIRI_ACCOUNT_OUT_JSON
  ? path.resolve(process.env.KAMIKIRI_ACCOUNT_OUT_JSON)
  : path.join(ROOT, 'reports', 'kamikiri_species_account_candidates.json');
const CROSSWALK_RELATIVE_PATH = 'data/source_audits/japanese-longhorn-beetles-2007.csv';
const CROSSWALK_FILE = path.join(ROOT, CROSSWALK_RELATIVE_PATH);
const MAX_PDF_PAGE = Number.parseInt(process.env.KAMIKIRI_MAX_PDF_PAGE || '176', 10);

if (!fs.existsSync(OCR_FILE)) {
  throw new Error(
    `日本産カミキリムシ OCRが見つかりません: ${OCR_FILE}\n` +
    '実行時に KAMIKIRI_OCR_FILE=/absolute/path/to/日本産カミキリムシ_compressed.txt を指定してください。',
  );
}
if (!fs.existsSync(CROSSWALK_FILE)) {
  throw new Error(`監査crosswalkが見つかりません: ${CROSSWALK_FILE}`);
}

const readCsv = (relativePath) => {
  const text = fs.readFileSync(path.join(ROOT, relativePath), 'utf8').replace(/^\uFEFF/, '');
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
  if (parsed.errors.length) {
    throw new Error(`${relativePath}: ${parsed.errors[0].message}`);
  }
  return parsed.data;
};

const normalizeJapanese = (value) => String(value || '')
  .normalize('NFKC')
  .replace(/[\s\u3000]+/g, '')
  .replace(/[・･]/g, '・')
  .trim();

const normalizeLatin = (value) => String(value || '')
  .normalize('NFKC')
  .replace(/[()]/g, ' ')
  .replace(/[^A-Za-z\s-]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

const splitAliases = (value) => String(value || '')
  .split(/[;；、,，]/)
  .map((part) => part.trim())
  .filter(Boolean);

const insects = readCsv('normalized_data/insects.csv')
  .filter((row) => row.family === 'Cerambycidae');
const hostplants = readCsv('normalized_data/hostplants.csv');
const generalNotes = readCsv('normalized_data/general_notes.csv');
const insectById = new Map(insects.map((row) => [row.insect_id, row]));

const existingHostCount = new Map();
const existingNoteCount = new Map();
for (const row of hostplants) {
  if (!insectById.has(row.insect_id)) continue;
  existingHostCount.set(row.insect_id, (existingHostCount.get(row.insect_id) || 0) + 1);
}
for (const row of generalNotes) {
  if (!insectById.has(row.insect_id)) continue;
  existingNoteCount.set(row.insect_id, (existingNoteCount.get(row.insect_id) || 0) + 1);
}

const aliasEntries = new Map();
const addAlias = (alias, insectId, origin) => {
  const key = normalizeJapanese(alias);
  if (!key || key.length < 3) return;
  if (!aliasEntries.has(key)) aliasEntries.set(key, []);
  aliasEntries.get(key).push({ insectId, alias, origin });
};

for (const row of insects) {
  addAlias(row.japanese_name, row.insect_id, 'japanese_name');
  for (const field of ['old_japanese_name', 'alternative_name', 'other_names']) {
    for (const alias of splitAliases(row[field])) addAlias(alias, row.insect_id, field);
  }
  const baseAlias = String(row.japanese_name || '').replace(/\s+(?:基亜種|本土亜種)\s*$/u, '').trim();
  if (baseAlias && baseAlias !== row.japanese_name) {
    addAlias(baseAlias, row.insect_id, 'derived_base_alias');
  }
}

const uniqueAliasMap = new Map();
const ambiguousAliases = new Map();
for (const [key, entries] of aliasEntries) {
  const ids = [...new Set(entries.map((entry) => entry.insectId))];
  if (ids.length === 1) uniqueAliasMap.set(key, entries[0]);
  else ambiguousAliases.set(key, entries);
}

// Only audit rows explicitly marked include may extend the exact-name crosswalk.
// Excluded/unreviewed rows never participate in matching.
const crosswalkRows = readCsv(CROSSWALK_RELATIVE_PATH);
const includedCrosswalkRows = crosswalkRows.filter((row) =>
  String(row.decision || '').trim().toLowerCase() === 'include'
);
if (includedCrosswalkRows.length === 0) {
  throw new Error(`${CROSSWALK_RELATIVE_PATH} に decision=include の行がありません。`);
}

const manualCrosswalk = new Map();
let manualDerivedAliasOverrideCount = 0;
for (const row of includedCrosswalkRows) {
  const sourceName = String(row.source_japanese_name || '').trim();
  const insectId = String(row.insect_id || '').trim();
  if (!sourceName || !insectId) {
    throw new Error(`include行に source_japanese_name または insect_id がありません: ${row.audit_id || '(audit_idなし)'}`);
  }
  if (!insectById.has(insectId)) {
    throw new Error(`crosswalkの insect_id がカミキリムシ登録に存在しません: ${insectId}`);
  }
  const key = normalizeJapanese(sourceName);
  const registeredEntries = aliasEntries.get(key) || [];
  const registeredOwners = [...new Set(registeredEntries.map((entry) => entry.insectId))];
  const conflictingEntries = registeredEntries.filter((entry) => entry.insectId !== insectId);
  const reviewedDerivedAliasOverride =
    registeredOwners.includes(insectId) &&
    conflictingEntries.length > 0 &&
    conflictingEntries.every((entry) => entry.origin === 'derived_base_alias') &&
    Boolean(String(row.source_taxon || '').trim()) &&
    Boolean(String(row.pdf_page || '').trim()) &&
    Boolean(String(row.printed_page || '').trim());
  if (conflictingEntries.length > 0 && !reviewedDerivedAliasOverride) {
    throw new Error(
      `crosswalkの原典和名が別の登録IDと衝突しています: ` +
      `${sourceName} -> ${insectId}, ` +
      `${[...new Set(conflictingEntries.map((entry) => entry.insectId))].join(',')}`,
    );
  }
  if (reviewedDerivedAliasOverride) manualDerivedAliasOverrideCount += 1;
  const previous = manualCrosswalk.get(key);
  if (previous && previous !== insectId) {
    throw new Error(`crosswalkが衝突しています: ${sourceName} -> ${previous}, ${insectId}`);
  }
  manualCrosswalk.set(key, insectId);
}

const scientificEntries = new Map();
const addScientific = (triplet, insectId) => {
  const key = normalizeLatin(triplet);
  if (!key) return;
  if (!scientificEntries.has(key)) scientificEntries.set(key, []);
  scientificEntries.get(key).push(insectId);
};
for (const row of insects) {
  const triplet = [row.genus, row.species, row.subspecies].filter(Boolean).join(' ');
  addScientific(triplet, row.insect_id);
}
const uniqueScientificMap = new Map(
  [...scientificEntries.entries()]
    .filter(([, ids]) => new Set(ids).size === 1)
    .map(([key, ids]) => [key, ids[0]]),
);

const rawLines = fs.readFileSync(OCR_FILE, 'utf8').split(/\r?\n/);
const descriptionEndIndexRaw = rawLines.findIndex((line) => /^寄.植物一覧\s+683\s*$/u.test(line.trim()));
const descriptionEndIndex = descriptionEndIndexRaw >= 0 ? descriptionEndIndexRaw : rawLines.length;
const lineMeta = [];
let pdfPage = null;
for (let index = 0; index < rawLines.length; index += 1) {
  const raw = rawLines[index];
  const pageMatch = raw.match(/^---\s*ページ\s+(\d+)\s*---$/);
  if (pageMatch) pdfPage = Number.parseInt(pageMatch[1], 10);
  lineMeta.push({ index, lineNumber: index + 1, raw, text: raw.trim(), pdfPage });
}

const parseGenericHeading = (text) => {
  if (!text || /\b(?:Genus|Subgenus|Tribe|Family)\b/i.test(text)) return null;
  const match = text.match(/^([\u3041-\u3096\u30A1-\u30FAー一-鿿々・]+(?:\s+[\u3041-\u3096\u30A1-\u30FAー一-鿿々・]+){0,4})\s+([A-Z][A-Za-z]{2,}(?:\s+[（({｛][A-Z][A-Za-z]{2,}[）)}｝]?)?\s+[a-z][A-Za-z-]{2,}(?:\s+[a-z][A-Za-z-]{2,})?)/u);
  if (!match) return null;
  const japanese = match[1].trim();
  if (/(?:亜?科|亜?族|亜?属)$/.test(japanese)) return null;
  const latinRaw = match[2].trim();
  const latinParts = latinRaw.replace(/[（({｛][A-Za-z]+[）)}｝]?/g, ' ').replace(/\s+/g, ' ').trim().split(' ');
  const scientificTriplet = latinParts.slice(0, 3).join(' ');
  return { japanese, latinRaw, scientificTriplet };
};

const resolveHeading = (heading) => {
  const jpKey = normalizeJapanese(heading.japanese);
  const manualId = manualCrosswalk.get(jpKey);
  if (manualId) return { insectId: manualId, method: 'manual_crosswalk', matchedKey: heading.japanese };

  const alias = uniqueAliasMap.get(jpKey);
  if (alias) return { insectId: alias.insectId, method: `exact_${alias.origin}`, matchedKey: alias.alias };
  if (ambiguousAliases.has(jpKey)) {
    return {
      insectId: null,
      method: 'ambiguous_registered_alias',
      matchedKey: heading.japanese,
      possibleIds: [...new Set(ambiguousAliases.get(jpKey).map((entry) => entry.insectId))],
    };
  }

  const scientificKey = normalizeLatin(heading.scientificTriplet);
  const scientificId = uniqueScientificMap.get(scientificKey);
  if (scientificId) return { insectId: scientificId, method: 'exact_scientific_triplet', matchedKey: scientificKey };
  return { insectId: null, method: 'unresolved_exact_only', matchedKey: null };
};

const headingRows = [];
for (const meta of lineMeta) {
  if (meta.index >= descriptionEndIndex) continue;
  if (!meta.pdfPage || meta.pdfPage > MAX_PDF_PAGE) continue;
  const heading = parseGenericHeading(meta.text);
  if (!heading) continue;
  headingRows.push({ ...meta, ...heading, resolution: resolveHeading(heading) });
}

const normalizeFieldText = (value) => String(value || '')
  .replace(/[\s\u3000]+/g, '')
  .replace(/[~～]/g, '〜')
  .replace(/[、，,。．.]+$/g, '')
  .trim();

const collectFields = (text, kind) => {
  const results = [];
  const pattern = kind === 'emergence'
    ? /【成[^】]{0,7}現\s*期】\s*([^【]{1,240})/gu
    : /【[^】]{0,8}植\s*物】\s*([^【]{1,600})/gu;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    let raw = match[1].trim();
    raw = raw.split(/【分[^】]*】/u)[0].trim();
    if (kind === 'emergence') raw = raw.split(/[。．.]/u)[0].trim();
    results.push({ raw, normalized: normalizeFieldText(raw) });
  }
  return results;
};

const parsePlantCandidates = (raw) => {
  if (!raw) return [];
  return [...new Set(raw
    .replace(/【分[^】]*】.*$/u, '')
    .split(/[、，,;；。]|および|または/u)
    .map((part) => part
      .replace(/[（(][^）)]*[）)]/gu, '')
      .replace(/^(?:寄主は|幼虫は)/u, '')
      .replace(/[。．.]$/u, '')
      .replace(/など$/u, '')
      .replace(/(?<=[\u3041-\u3096\u30A1-\u30FAー一-鿿])\s+(?=[\u3041-\u3096\u30A1-\u30FAー一-鿿])/gu, '')
      .trim())
    .filter((part) => part.length >= 2 && part.length <= 40)
    .filter((part) => !/^[A-Za-z\d\s-]+$/.test(part))
  )];
};

const ECOLOGY_KEYWORDS = /(?:成虫|幼虫|枯[枝校]|伐採|樹幹|材木|灯火|燈火|飛来|越冬|花に|花上|採集|飼育|食害|害虫|徘徊|活動|発生|叩き網|ビーティング|栖息|生活空間)/u;
const extractEcologyCandidates = (text) => {
  const narrative = text.split(/【成[^】]{0,7}現\s*期】|【[^】]{0,8}植\s*物】|【分[^】]*】/u)[0];
  return [...new Set(narrative
    .split(/[。．]\s*/u)
    .map((sentence) => sentence.replace(/\s+/g, ' ').trim())
    .filter((sentence) => sentence.length >= 8 && sentence.length <= 500)
    .filter((sentence) => ECOLOGY_KEYWORDS.test(sentence))
  )].slice(0, 12);
};

const candidates = [];
const unresolvedHeadings = [];
const looseHeadingPattern = /^[\u3041-\u3096\u30A1-\u30FAー一-鿿々・]{3,}カミキリ(?:\s+[\u3041-\u3096\u30A1-\u30FAー一-鿿々・]+){0,2}\s+[A-Z][A-Za-z]{2,}/u;
for (let headingIndex = 0; headingIndex < headingRows.length; headingIndex += 1) {
  const heading = headingRows[headingIndex];
  const nextHeading = headingRows[headingIndex + 1];
  const endIndex = nextHeading ? nextHeading.index - 1 : Math.min(rawLines.length - 1, heading.index + 120);
  const blockMetas = lineMeta.slice(heading.index, endIndex + 1);
  const blockText = blockMetas.map((meta) => meta.text).filter(Boolean).join(' ');
  const emergence = collectFields(blockText, 'emergence');
  const host = collectFields(blockText, 'host');
  const hostFieldCandidates = host.map((field) => ({
    ...field,
    status: /(?:未知|不明|未詳|未処)/u.test(field.raw) ? 'source_states_unknown' : 'candidate_present',
    plantCandidates: parsePlantCandidates(field.raw),
  }));
  const ecology = extractEcologyCandidates(blockText);
  const pageEnd = blockMetas.at(-1)?.pdfPage || heading.pdfPage;
  const printedLeft = heading.pdfPage * 2 + 332;
  const boundaryFlags = [];
  const nestedLooseHeadings = blockMetas
    .slice(1)
    .filter((meta) => looseHeadingPattern.test(meta.text))
    .map((meta) => ({ ocrLine: meta.lineNumber, raw: meta.text }));
  if (blockMetas.length > 100) boundaryFlags.push('long_block_over_100_lines');
  if (blockText.length > 9000) boundaryFlags.push('long_block_over_9000_chars');
  if (pageEnd - heading.pdfPage > 1) boundaryFlags.push('crosses_more_than_two_pdf_spreads');
  if (emergence.length > 1) boundaryFlags.push('multiple_emergence_fields');
  if (host.length > 1) boundaryFlags.push('multiple_host_fields');
  if (blockMetas.length < 2) boundaryFlags.push('single_line_block');
  if (nestedLooseHeadings.length > 0) boundaryFlags.push('unparsed_species_like_heading_inside_block');
  if (hostFieldCandidates.some((field) => /第3章|種の解説/u.test(field.raw))) {
    boundaryFlags.push('page_header_inside_host_field');
  }
  if (hostFieldCandidates.some((field) => field.plantCandidates.some((plant) =>
    /カミキリ|第3章|種の解説|分布|体長/u.test(plant)
  ))) {
    boundaryFlags.push('suspicious_plant_candidate');
  }

  const common = {
    source: '日本産カミキリムシ',
    pdfPage: heading.pdfPage,
    printedPageRange: [printedLeft, printedLeft + 1],
    ocrLineStart: heading.lineNumber,
    ocrLineEnd: endIndex + 1,
    headingRaw: heading.text,
    headingJapanese: heading.japanese,
    headingScientificRaw: heading.latinRaw,
    scientificTripletCandidate: heading.scientificTriplet,
    matchMethod: heading.resolution.method,
    matchedKey: heading.resolution.matchedKey,
    blockLineCount: blockMetas.length,
    blockCharacterCount: blockText.length,
    emergenceCandidates: emergence,
    hostFieldCandidates,
    ecologyCandidates: ecology,
    nestedLooseHeadings,
    boundaryFlags,
    blockPreview: blockText.slice(0, 1200),
  };

  if (!heading.resolution.insectId) {
    unresolvedHeadings.push({
      ...common,
      possibleIds: heading.resolution.possibleIds || [],
    });
    continue;
  }

  const row = insectById.get(heading.resolution.insectId);
  const sourceScientificTokenCount = heading.scientificTriplet.split(/\s+/).filter(Boolean).length;
  const relatedRegisteredIds = row
    ? insects
      .filter((other) => other.genus === row.genus && other.species === row.species)
      .map((other) => other.insect_id)
    : [];
  candidates.push({
    ...common,
    insectId: heading.resolution.insectId,
    registeredJapaneseName: row?.japanese_name || '',
    registeredScientificName: row?.scientific_name || '',
    sourceTaxonScope: sourceScientificTokenCount >= 3 ? 'subspecies_or_infraspecific' : 'species_or_species_group',
    relatedRegisteredIds,
    currentHostplantCount: existingHostCount.get(heading.resolution.insectId) || 0,
    currentGeneralNoteCount: existingNoteCount.get(heading.resolution.insectId) || 0,
  });
}

const duplicateIdGroups = [...Map.groupBy(candidates, (candidate) => candidate.insectId).entries()]
  .filter(([, rows]) => rows.length > 1)
  .map(([insectId, rows]) => ({
    insectId,
    registeredJapaneseName: insectById.get(insectId)?.japanese_name || '',
    count: rows.length,
    headings: rows.map((row) => ({ pdfPage: row.pdfPage, headingRaw: row.headingRaw })),
  }));

const evidenceBearing = (candidate) =>
  candidate.emergenceCandidates.length > 0 ||
  candidate.ecologyCandidates.length > 0 ||
  candidate.hostFieldCandidates.some((field) => field.status === 'candidate_present');

const currentBothEmpty = candidates.filter((candidate) =>
  candidate.currentHostplantCount === 0 && candidate.currentGeneralNoteCount === 0
);

const summary = {
  generatedAt: new Date().toISOString(),
  registeredCerambycidaeRows: insects.length,
  genericSpeciesHeadingCount: headingRows.length,
  matchedBlockCount: candidates.length,
  matchedUniqueInsectCount: new Set(candidates.map((candidate) => candidate.insectId)).size,
  unresolvedHeadingCount: unresolvedHeadings.length,
  matchMethods: Object.fromEntries(
    [...Map.groupBy(candidates, (candidate) => candidate.matchMethod).entries()]
      .map(([method, rows]) => [method, rows.length])
      .sort((a, b) => b[1] - a[1]),
  ),
  blocksWithEmergence: candidates.filter((candidate) => candidate.emergenceCandidates.length > 0).length,
  blocksWithHostField: candidates.filter((candidate) => candidate.hostFieldCandidates.length > 0).length,
  blocksWithSourceStatedUnknownHost: candidates.filter((candidate) =>
    candidate.hostFieldCandidates.some((field) => field.status === 'source_states_unknown')
  ).length,
  blocksWithEcologyCandidate: candidates.filter((candidate) => candidate.ecologyCandidates.length > 0).length,
  matchedCurrentBothEmptyCount: currentBothEmpty.length,
  evidenceBearingCurrentBothEmptyCount: currentBothEmpty.filter(evidenceBearing).length,
  boundaryFlaggedBlockCount: candidates.filter((candidate) => candidate.boundaryFlags.length > 0).length,
  duplicateMatchedInsectIdCount: duplicateIdGroups.length,
  ambiguousRegisteredAliasCount: ambiguousAliases.size,
  includedManualCrosswalkRowCount: includedCrosswalkRows.length,
  reviewedDerivedAliasOverrideCount: manualDerivedAliasOverrideCount,
  fuzzyAutoMatchCount: 0,
};

const payload = {
  schemaVersion: 1,
  mode: 'candidate_ledger_only_no_repo_writes',
  inputs: {
    repo: ROOT,
    ocrFile: OCR_FILE,
    insectsCsv: path.join(ROOT, 'normalized_data/insects.csv'),
    hostplantsCsv: path.join(ROOT, 'normalized_data/hostplants.csv'),
    generalNotesCsv: path.join(ROOT, 'normalized_data/general_notes.csv'),
    manualCrosswalkCsv: CROSSWALK_FILE,
    maxPdfPage: MAX_PDF_PAGE,
    descriptionEndOcrLine: descriptionEndIndex + 1,
    printedPageFormula: '[pdfPage * 2 + 332, pdfPage * 2 + 333]',
  },
  safety: {
    writesOnlyTo: OUTPUT,
    matchingAllowed: [
      'exact registered Japanese name',
      'exact registered old/alternative/other Japanese alias',
      'exact derived base alias',
      'exact scientific genus-species-subspecies triplet',
      'explicit manual crosswalk',
    ],
    fuzzyAutomaticMatching: false,
    reviewedCrosswalkMayOverrideDerivedBaseAliasOnly: true,
    candidatesRequireHumanReviewBeforeCsvApplication: true,
  },
  manualCrosswalk: Object.fromEntries(manualCrosswalk),
  summary,
  boundaryAudit: {
    duplicateIdGroups,
    flaggedBlocks: candidates
      .filter((candidate) => candidate.boundaryFlags.length > 0)
      .map((candidate) => ({
        insectId: candidate.insectId,
        registeredJapaneseName: candidate.registeredJapaneseName,
        pdfPage: candidate.pdfPage,
        headingRaw: candidate.headingRaw,
        boundaryFlags: candidate.boundaryFlags,
      })),
  },
  candidates,
  unresolvedHeadings,
};

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(summary, null, 2));
console.log(`wrote ${OUTPUT}`);

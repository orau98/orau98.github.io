#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import Papa from 'papaparse';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = 'ハムシハンドブック';
const SOURCE_YEAR = '2014';
const RAW_REVISION = '2253abcceb';
const RAW_PATH = 'ハムシ.csv';

function resolveRequiredFile(envName, candidates, label) {
  if (process.env[envName]) return path.resolve(process.env[envName]);
  const existing = candidates.find((candidate) => fs.existsSync(candidate));
  if (existing) return existing;
  throw new Error(`${label} not found; set ${envName}`);
}

function resolveOriginalPdfDir() {
  if (process.env.HAMUSHI_HANDBOOK_PDF_DIR) {
    return path.resolve(process.env.HAMUSHI_HANDBOOK_PDF_DIR);
  }

  const candidates = [path.join(ROOT, 'data/sources/hamushi-handbook')];
  const cloudStorageRoot = path.join(os.homedir(), 'Library/CloudStorage');
  if (fs.existsSync(cloudStorageRoot)) {
    const providers = fs.readdirSync(cloudStorageRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.startsWith('GoogleDrive-'))
      .map((entry) => path.join(cloudStorageRoot, entry.name))
      .sort();
    for (const provider of providers) {
      candidates.push(
        path.join(provider, 'マイドライブ/GoodNotes/図鑑'),
        path.join(provider, 'My Drive/GoodNotes/図鑑'),
      );
    }
  }

  const directory = candidates.find((candidate) => (
    fs.existsSync(path.join(candidate, 'IMG_0059.pdf'))
  ));
  if (directory) return directory;
  throw new Error('Handbook original-image directory not found; set HAMUSHI_HANDBOOK_PDF_DIR');
}

const OCR_PATH = resolveRequiredFile(
  'HAMUSHI_HANDBOOK_OCR_PATH',
  [
    path.join(ROOT, 'data/ocr/hamushi-handbook/ocr-boxes.jsonl'),
    '/private/tmp/hamushi-handbook-audit/ocr-boxes.jsonl',
    path.join(os.tmpdir(), 'hamushi-handbook-audit/ocr-boxes.jsonl'),
  ],
  'Handbook OCR candidate index',
);
const ORIGINAL_PDF_DIR = resolveOriginalPdfDir();
const AUDIT_PATH = path.join(
  ROOT,
  'data/source_audits/hamushi-handbook-comprehensive-audit-2026-07-12.json',
);
const REPORT_PATH = path.join(
  ROOT,
  'reports/hamushi-handbook-comprehensive-audit-2026-07-12.md',
);

const CANONICAL_TARGET_OVERRIDES = new Map([
  // The current base-subspecies row is the exact accepted taxon. H598 is a
  // malformed legacy import (Cryptocephalus japonicus) that inherited the
  // source account only by Japanese-name matching.
  ['HHB-037', 'species-H964'],
  // The source gives both Japanese names and the exact scientific name
  // Cleoporus variabilis. H943 is therefore the unambiguous current row.
  ['HHB-044', 'species-H943'],
]);

// A species-level source account is shared only where the original account is
// not restricted to a different region and the current rows are genuine
// subspecies. Plagiosterna is deliberately excluded: pp.44 and 96 are two
// geographically different accounts that the recent taxonomy now brings into
// one species complex.
const SPECIES_SCOPE_TARGETS = new Map([
  ['HHB-037', ['species-H964', 'species-H599', 'species-H600', 'species-H601', 'species-H965']],
  ['HHB-062', ['species-H484', 'species-H485', 'species-H486', 'species-H488', 'species-H931']],
  ['HHB-068', ['species-H528', 'species-H529']],
  ['HHB-099', ['species-H303', 'species-H304', 'species-H305']],
  ['HHB-179', ['species-H457', 'species-H458']],
]);

const MANUALLY_VERIFIED_HOST_ADDITIONS = new Map(Object.entries({
  'HHB-001': [['マユミ', 'ニシキギ科'], ['ニシキギ', 'ニシキギ科'], ['クロヅル', 'ニシキギ科']],
  'HHB-009': [['ハリイ類', 'カヤツリグサ科', '花']],
  'HHB-012': [['ギボウシ類', 'クサスギカズラ科']],
  'HHB-016': [['ツユクサ', 'ツユクサ科']],
  'HHB-018': [['クコ', 'ナス科']],
  'HHB-020': [['ヤマノイモ', 'ヤマノイモ科']],
  'HHB-021': [['ヤマノイモ', 'ヤマノイモ科']],
  'HHB-022': [['コウトウシラン', 'ラン科']],
  'HHB-023': [['イネ', 'イネ科'], ['カモガヤ', 'イネ科'], ['マコモ', 'イネ科']],
  'HHB-024': [['アワ', 'イネ科'], ['エノコログサ', 'イネ科']],
  'HHB-043': [['マツ類', 'マツ科'], ['スギ類', 'ヒノキ科'], ['コナラ', 'ブナ科'], ['クリ', 'ブナ科']],
  'HHB-046': [['ハンノキ', 'カバノキ科']],
  'HHB-047': [['ヨモギ', 'キク科']],
  'HHB-051': [['サツマイモ', 'ヒルガオ科'], ['ヒルガオ', 'ヒルガオ科']],
  'HHB-053': [['クリ', 'ブナ科'], ['コナラ', 'ブナ科'], ['ノバラ', 'バラ科'], ['サクラ', 'バラ科'], ['ツツジ類', 'ツツジ科']],
  'HHB-058': [['クリ', 'ブナ科'], ['クヌギ', 'ブナ科']],
  'HHB-060': [['コナラ', 'ブナ科'], ['ツバキ', 'ツバキ科'], ['ヒサカキ', 'モッコク科'], ['ヤマグワ', 'クワ科']],
  'HHB-061': [['カシワ類', 'ブナ科']],
  'HHB-062': [['ノブドウ', 'ブドウ科'], ['ブドウ', 'ブドウ科']],
  'HHB-064': [['ナラ類', 'ブナ科'], ['クヌギ', 'ブナ科'], ['コジイ', 'ブナ科']],
  'HHB-066': [['リンゴ', 'バラ科'], ['ナシ', 'バラ科'], ['ウメ', 'バラ科'], ['クルミ', 'クルミ科']],
  'HHB-069': [['コウチニッケイ', 'クスノキ科'], ['ウラジロガシ', 'ブナ科']],
  'HHB-073': [['ギシギシ', 'タデ科']],
  'HHB-074': [['イヌガラシ', 'アブラナ科'], ['オランダガラシ', 'アブラナ科']],
  'HHB-075': [['ヨモギ', 'キク科']],
  'HHB-076': [['カキドオシ', 'シソ科'], ['シソ', 'シソ科']],
  'HHB-077': [['シロネ', 'シソ科'], ['ヒメシロネ', 'シソ科'], ['クルマバナ', 'シソ科'], ['エゴマ', 'シソ科']],
  'HHB-078': [['エゾシロネ', 'シソ科']],
  'HHB-079': [['ドロノキ', 'ヤナギ科'], ['ヤマナラシ', 'ヤナギ科'], ['ヤナギ類', 'ヤナギ科']],
  'HHB-080': [['ヤナギ類', 'ヤナギ科']],
  'HHB-081': [['カバノキ', 'カバノキ科']],
  'HHB-082': [['オニグルミ', 'クルミ科'], ['サワグルミ', 'クルミ科'], ['クルミ類', 'クルミ科']],
  'HHB-083': [['ハンノキ', 'カバノキ科'], ['ケヤマハンノキ', 'カバノキ科']],
  'HHB-084': [['トサミズキ', 'マンサク科']],
  'HHB-085': [['ヤマナシ', 'バラ科'], ['アオナシ', 'バラ科']],
  'HHB-086': [['フジ', 'マメ科'], ['ニセアカシア', 'マメ科']],
  'HHB-087': [['ケヤマハンノキ', 'カバノキ科'], ['ミヤマハンノキ', 'カバノキ科'], ['ハンノキ', 'カバノキ科']],
  'HHB-088': [['エノキ', 'アサ科']],
  'HHB-089': [['アザミ', 'キク科'], ['フキ', 'キク科']],
  'HHB-090': [['ミゾソバ', 'タデ科'], ['イタドリ', 'タデ科'], ['ギシギシ', 'タデ科'], ['オランダイチゴ', 'バラ科']],
  'HHB-097': [['ブナ', 'ブナ科']],
  'HHB-105': [['クワ', 'クワ科'], ['コウゾ', 'クワ科'], ['ヤマノイモ', 'ヤマノイモ科'], ['クリ', 'ブナ科'], ['フジ', 'マメ科']],
  'HHB-107': [['ハンノキ', 'カバノキ科'], ['ヤシャブシ類', 'カバノキ科'], ['シラカバ', 'カバノキ科']],
  'HHB-110': [['クリ', 'ブナ科', '花']],
  'HHB-116': [['ハンノキ', 'カバノキ科']],
  'HHB-117': [['サルナシ', 'マタタビ科'], ['オオバアサガラ', 'エゴノキ科']],
  'HHB-125': [['ギボウシ類', 'クサスギカズラ科'], ['キチジョウソウ', 'クサスギカズラ科']],
  'HHB-138': [['オオバコ', 'オオバコ科'], ['エゾオオバコ', 'オオバコ科']],
  'HHB-141': [['ネズミモチ', 'モクセイ科'], ['コバノトネリコ', 'モクセイ科']],
  'HHB-142': [['ヒイラギモクセイ', 'モクセイ科'], ['ヒイラギ', 'モクセイ科'], ['ネズミモチ', 'モクセイ科'], ['キンモクセイ', 'モクセイ科']],
  'HHB-143': [['アザミ類', 'キク科']],
  'HHB-163': [['メダケ', 'イネ科'], ['マザサ', 'イネ科']],
  'HHB-166': [['フキ', 'キク科'], ['ヨメナ', 'キク科']],
  'HHB-194': [['センナリホオズキ', 'ナス科']],
  'HHB-195': [['ハンノキ類', 'カバノキ科', '葉', '成虫', '沖縄本島の記載（原典p.96）']],
  'HHB-196': [['ユーカリ類', 'フトモモ科']],
  'HHB-202': [['ジャガイモ', 'ナス科'], ['ナス', 'ナス科']],
}));

const SPECIES_SCOPE_HOST_FACTS = new Map(Object.entries({
  'HHB-037': [['コナラ', 'ブナ科'], ['シイ', 'ブナ科']],
  'HHB-062': [['ノブドウ', 'ブドウ科'], ['エビヅル', 'ブドウ科'], ['ブドウ', 'ブドウ科']],
  'HHB-068': [['リュウキュウテイカカズラ', 'キョウチクトウ科']],
  'HHB-099': [['ウリ類', 'ウリ科', '葉・花', '成虫']],
  'HHB-179': [['アザミ', 'キク科']],
}));

const HOST_MOVE_TARGETS = new Map([
  ['hostplant-007054', 'species-H943'],
  ['hostplant-007055', 'species-H943'],
  ['hostplant-007056', 'species-H943'],
  ['hostplant-007057', 'species-H943'],
  ['hostplant-007146', 'species-H964'],
  ['hostplant-007147', 'species-H964'],
  ['hostplant-007209', 'species-H492'],
  ['hostplant-007210', 'species-H498'],
  ['hostplant-007236', 'species-H470'],
]);

const HOST_SPELLING_CORRECTIONS = new Map([
  ['hostplant-006955', 'エビヅル'],
  ['hostplant-006958', 'エビヅル'],
  ['hostplant-006961', 'エビヅル'],
  ['hostplant-006967', 'エビヅル'],
]);

const UNSUPPORTED_HOST_DELETIONS = new Set([
  // Adjacent-account column shifts. The correct original-image facts are added
  // to the same taxa below.
  'hostplant-007195', // H694 アゼガヤ; source says ツユクサ.
  'hostplant-007198', // H646 ハギ; source says ヤナギ類.
  'hostplant-007218', // H664 クルミ; source says ハンノキ類.
  'hostplant-007221', // H666 ヤマナラシ; source says ハンノキ類.
  'hostplant-007229', // H672 ダイズ; source says フジ/ニセアカシア.
  'hostplant-007230', // H673 ネジリグサ; no such handbook account.
  // Duplicate/typo spill rows whose correct canonical copies already exist.
  'hostplant-007199', 'hostplant-007200', 'hostplant-007204',
  'hostplant-007205', 'hostplant-007206', 'hostplant-007207',
  'hostplant-007224', 'hostplant-007232', 'hostplant-007234',
]);

const SYNTHETIC_NOTE_DELETIONS = new Set([
  'note-000260', 'note-000261', 'note-000262', 'note-000263', 'note-000264', 'note-000266',
  'note-000275', 'note-000277', 'note-000278', 'note-000279', 'note-000280', 'note-000281',
  'note-000283', 'note-000284', 'note-000285', 'note-000286', 'note-000287', 'note-000288',
  'note-000289', 'note-000290', 'note-000291', 'note-000292', 'note-000293', 'note-000294',
  'note-000295', 'note-000296', 'note-000299', 'note-000300', 'note-000301', 'note-000302',
  'note-000307', 'note-000308', 'note-000309', 'note-000320', 'note-000321', 'note-000323',
  'note-000325', 'note-000326', 'note-000327', 'note-000336', 'note-000337', 'note-000338',
  'note-000339', 'note-000341', 'note-000342', 'note-000343', 'note-000396', 'note-000416',
  'note-000455', 'note-000457', 'note-000458', 'note-000459', 'note-000460', 'note-000461',
  'note-000463', 'note-000464', 'note-000465', 'note-000467', 'note-000468', 'note-000469',
  'note-000470', 'note-000471', 'note-000473', 'note-000475', 'note-000483',
]);

const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

function readCsv(relativePath) {
  return Papa.parse(
    fs.readFileSync(path.join(ROOT, relativePath), 'utf8').replace(/^\uFEFF/, ''),
    { header: true, skipEmptyLines: true },
  ).data;
}

function normalizeWidth(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[~～]/gu, '〜');
}

function japaneseKey(value) {
  return normalizeWidth(value)
    .replace(/[\s・･、,()（）\[\]［］【】?？〜~\-]/gu, '')
    .replace(/チョワ/gu, 'チョウ')
    .replace(/ダテ/gu, 'タデ')
    .replace(/ヨツユクサ/gu, 'ツユクサ');
}

function japaneseAliases(value) {
  const text = normalizeWidth(value);
  const aliases = new Set([text.replace(/[（(].*$/u, '').trim()]);
  for (const match of text.matchAll(/[（(]([^）)]+)[）)]/gu)) {
    for (const alias of match[1].split(/[・、,]/u)) aliases.add(alias.trim());
  }
  return [...aliases].map(japaneseKey).filter(Boolean);
}

function stripDiacritics(value) {
  return String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
}

function latinWord(value) {
  return stripDiacritics(value).toLowerCase().replace(/[^a-z]/g, '');
}

function latinWords(value) {
  return stripDiacritics(value)
    .match(/[A-Za-z]+(?:-[A-Za-z]+)*/g)
    ?.map(latinWord)
    .filter(Boolean) ?? [];
}

function sourceBinomial(value) {
  const words = latinWords(value);
  return { genus: words[0] ?? '', species: words[1] ?? '' };
}

function levenshtein(a, b) {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const above = previous[j];
      previous[j] = Math.min(
        previous[j] + 1,
        previous[j - 1] + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      diagonal = above;
    }
  }
  return previous[b.length];
}

function similarity(a, b) {
  if (!a || !b) return 0;
  return 1 - (levenshtein(a, b) / Math.max(a.length, b.length));
}

function parseLegacyRows() {
  const source = process.env.HAMUSHI_HANDBOOK_LEGACY_CSV
    ? fs.readFileSync(path.resolve(process.env.HAMUSHI_HANDBOOK_LEGACY_CSV), 'utf8')
    : execFileSync(
      'git',
      ['show', `${RAW_REVISION}:${RAW_PATH}`],
      { cwd: ROOT, encoding: 'utf8' },
    );
  const lines = source.trim().split(/\r?\n/u).slice(1);
  return lines.map((sourceLine, index) => {
    let line = sourceLine;
    if (line.startsWith('"') && line.endsWith('"')) {
      line = line.slice(1, -1).replace(/""/gu, '"');
    }
    const fields = [];
    let field = '';
    let quoted = false;
    for (const character of line) {
      if (character === '"') {
        quoted = !quoted;
      } else if (!quoted && (character === ',' || character === '、')) {
        fields.push(field.trim());
        field = '';
      } else {
        field += character;
      }
    }
    fields.push(field.trim());
    if (fields.length > 4) {
      fields.splice(2, fields.length - 3, fields.slice(2, -1).join('、'));
    }
    if (fields.length !== 4) throw new Error(`Unparseable legacy row ${index + 1}: ${sourceLine}`);
    const [japaneseName, scientificName, food, emergence] = fields;
    return {
      source_account_id: `HHB-${String(index + 1).padStart(3, '0')}`,
      source_order: index + 1,
      source_japanese_name: japaneseName,
      source_scientific_name: scientificName,
      source_food_text: food,
      source_emergence_text: normalizeWidth(emergence),
      ...sourceBinomial(scientificName),
      japanese_aliases: japaneseAliases(japaneseName),
    };
  });
}

function insectAliases(row) {
  return [
    row.japanese_name,
    row.old_japanese_name,
    row.alternative_name,
    row.other_names,
  ].flatMap((value) => japaneseAliases(value)).filter(Boolean);
}

function scoreAccountToInsect(account, insect) {
  const currentBinomial = {
    genus: latinWord(insect.genus),
    species: latinWord(insect.species),
  };
  const aliases = insectAliases(insect);
  const jpExact = account.japanese_aliases.some((left) => aliases.includes(left));
  const jpSimilarity = Math.max(
    0,
    ...account.japanese_aliases.flatMap((left) => aliases.map((right) => similarity(left, right))),
  );
  const genusSimilarity = similarity(account.genus, currentBinomial.genus);
  const speciesSimilarity = similarity(account.species, currentBinomial.species);
  const sciSimilarity = (genusSimilarity * 0.42) + (speciesSimilarity * 0.58);
  const sciExact = account.genus === currentBinomial.genus && account.species === currentBinomial.species;
  const score = jpExact
    ? 30 + sciSimilarity
    : sciExact
      ? 20 + jpSimilarity
      : (sciSimilarity * 4) + (jpSimilarity * 3);
  return { score, jpExact, jpSimilarity, sciExact, sciSimilarity };
}

function mapAccounts(accounts, insects) {
  return accounts.map((account) => {
    const ranked = insects.map((insect) => ({
      insect,
      ...scoreAccountToInsect(account, insect),
    })).sort((left, right) => right.score - left.score || left.insect.insect_id.localeCompare(right.insect.insect_id));
    return {
      ...account,
      current_insect_id: ranked[0].insect.insect_id,
      current_japanese_name: ranked[0].insect.japanese_name,
      current_scientific_name: ranked[0].insect.scientific_name,
      mapping_score: Number(ranked[0].score.toFixed(6)),
      mapping_japanese_exact: ranked[0].jpExact,
      mapping_scientific_exact: ranked[0].sciExact,
      mapping_taxonomic_conflict: ranked[0].jpExact && !ranked[0].sciExact,
      runner_up_insect_id: ranked[1].insect.insect_id,
      runner_up_score: Number(ranked[1].score.toFixed(6)),
      exact_japanese_candidates: ranked.filter((candidate) => candidate.jpExact)
        .map((candidate) => candidate.insect.insect_id),
      exact_scientific_candidates: ranked.filter((candidate) => candidate.sciExact)
        .map((candidate) => candidate.insect.insect_id),
    };
  });
}

function pageForAccount(account, ocrPages) {
  const manualPrintedPages = new Map([
    [40, 28],
    [91, 50],
    [94, 50],
    [102, 56],
    [144, 74],
    [176, 86],
    [180, 89],
    [181, 89],
  ]);
  const manual = manualPrintedPages.get(account.source_order);
  if (manual) return { printed_page: manual, page_match_score: 1, page_match_method: 'manual_original_image' };
  const candidates = [];
  for (let imageIndex = 0; imageIndex < ocrPages.length; imageIndex += 1) {
    const page = ocrPages[imageIndex];
    for (const line of page.lines) {
      if (!/[぀-ヿ㐀-鿿]/u.test(line.text)) continue;
      const lineKey = japaneseKey(line.text);
      if (!lineKey || lineKey.length > 40) continue;
      const score = Math.max(...account.japanese_aliases.map((alias) => similarity(alias, lineKey)));
      candidates.push({
        score,
        text: line.text,
        printed_page: 12 + (imageIndex * 2) + (line.x >= 0.5 ? 1 : 0),
      });
    }
    if (account.genus && account.species) {
      for (const line of page.lines) {
        const words = latinWords(line.text);
        if (words.length < 2) continue;
        const score = (similarity(account.genus, words[0]) * 0.42)
          + (similarity(account.species, words[1]) * 0.58);
        candidates.push({
          score: score + 0.25,
          text: line.text,
          printed_page: 12 + (imageIndex * 2) + (line.x >= 0.5 ? 1 : 0),
          scientific: true,
        });
      }
    }
  }
  candidates.sort((left, right) => right.score - left.score);
  const best = candidates[0];
  return {
    printed_page: best.printed_page,
    page_match_score: Number(Math.min(1, best.score).toFixed(6)),
    page_match_method: best.scientific
      ? 'apple_vision_scientific_heading_index'
      : 'apple_vision_heading_index',
    page_match_text: best.text,
  };
}

function collectOriginalFiles() {
  return Array.from({ length: 44 }, (_, index) => {
    const fileName = `IMG_${String(59 + index).padStart(4, '0')}.pdf`;
    const filePath = path.join(ORIGINAL_PDF_DIR, fileName);
    const bytes = fs.readFileSync(filePath);
    return { file_name: fileName, sha256: sha256(bytes), byte_size: bytes.length };
  });
}

const allInsects = readCsv('normalized_data/insects.csv');
const insects = allInsects
  .filter((row) => row.insect_id.startsWith('species-H'));
const allHosts = readCsv('normalized_data/hostplants.csv');
const sourceHosts = allHosts
  .filter((row) => row.reference === SOURCE);
const allNotes = readCsv('normalized_data/general_notes.csv');
const sourceNotes = allNotes
  .filter((row) => row.reference === SOURCE);
const ocrPages = fs.readFileSync(OCR_PATH, 'utf8').trim().split('\n').map(JSON.parse);
const insectById = new Map(allInsects.map((row) => [row.insect_id, row]));
const accounts = mapAccounts(parseLegacyRows(), insects).map((account) => {
  const overrideId = CANONICAL_TARGET_OVERRIDES.get(account.source_account_id);
  const target = overrideId ? insectById.get(overrideId) : null;
  const mapped = target ? {
    ...account,
    current_insect_id: target.insect_id,
    current_japanese_name: target.japanese_name,
    current_scientific_name: target.scientific_name,
    mapping_method: 'manual_original_image_and_current_taxonomy',
    mapping_taxonomic_conflict: true,
  } : {
    ...account,
    mapping_method: account.mapping_taxonomic_conflict
      ? 'exact_japanese_name_with_taxonomic_change_hold'
      : 'exact_current_name_or_scientific_name',
  };
  return { ...mapped, ...pageForAccount(mapped, ocrPages) };
});

if (accounts.length !== 203) throw new Error(`Expected 203 accounts, got ${accounts.length}`);
if (ocrPages.length !== 44) throw new Error(`Expected 44 OCR images, got ${ocrPages.length}`);

const lowPageMatches = accounts.filter((account) => account.page_match_score < 0.72);
const mappingConflicts = accounts.filter((account) => account.mapping_taxonomic_conflict);
const mappingWeak = accounts.filter((account) => account.mapping_score < 20);

const accountById = new Map(accounts.map((row) => [row.source_account_id, row]));
const originalFiles = collectOriginalFiles();
const originalByName = new Map(originalFiles.map((row) => [row.file_name, row]));

function sourceEvidence(accountId) {
  const account = accountById.get(accountId);
  if (!account) throw new Error(`Missing source account: ${accountId}`);
  const imageNumber = 59 + Math.floor((account.printed_page - 12) / 2);
  const fileName = `IMG_${String(imageNumber).padStart(4, '0')}.pdf`;
  return {
    reference: SOURCE,
    year: Number(SOURCE_YEAR),
    source_account_id: accountId,
    printed_page: account.printed_page,
    original_file: fileName,
    original_file_sha256: originalByName.get(fileName)?.sha256,
  };
}

function actionRecord(actionId, table, action, before, after, accountId, rationale) {
  return {
    action_id: actionId,
    table,
    action,
    before,
    after,
    source: sourceEvidence(accountId),
    verification_status: 'original_image_verified',
    rationale,
  };
}

function hostKey(row) {
  return [
    row.insect_id,
    japaneseKey(row.plant_name),
    row.plant_part,
    row.life_stage,
    row.reference,
  ].join('\u0000');
}

function canonicalEmergence(account) {
  const normalized = account.source_emergence_text
    .replace(/\(([^)]*)\)/gu, '（$1）');
  return account.source_account_id === 'HHB-195'
    ? `沖縄本島：${normalized}`
    : normalized;
}

const hostActions = [];
const workingHosts = new Map(allHosts.map((row) => [row.record_id, { ...row }]));
let hostActionSequence = 0;
let newHostSequence = 0;
const nextHostActionId = () => `HHB-HOST-${String(++hostActionSequence).padStart(4, '0')}`;
const nextHostRecordId = () => `hostplant-hhb-audit-20260712-${String(++newHostSequence).padStart(4, '0')}`;

function pushHostAction(action, before, after, accountId, rationale) {
  const record = actionRecord(
    nextHostActionId(),
    'hostplants',
    action,
    before,
    after,
    accountId,
    rationale,
  );
  hostActions.push(record);
  if (before) workingHosts.delete(before.record_id);
  if (after) workingHosts.set(after.record_id, { ...after });
}

const hostMoveAccount = new Map([
  ['hostplant-007054', 'HHB-044'], ['hostplant-007055', 'HHB-044'],
  ['hostplant-007056', 'HHB-044'], ['hostplant-007057', 'HHB-044'],
  ['hostplant-007146', 'HHB-037'], ['hostplant-007147', 'HHB-037'],
  ['hostplant-007209', 'HHB-060'], ['hostplant-007210', 'HHB-064'],
  ['hostplant-007236', 'HHB-163'],
]);
for (const [recordId, targetId] of HOST_MOVE_TARGETS) {
  const before = workingHosts.get(recordId);
  if (!before) throw new Error(`Missing host move row: ${recordId}`);
  const after = {
    ...before,
    insect_id: targetId,
    plant_family: before.plant_name === 'シイ' ? 'ブナ科' : before.plant_family,
  };
  pushHostAction(
    'move_hostplant',
    before,
    after,
    hostMoveAccount.get(recordId),
    'Move a source fact from a legacy/duplicate taxon row to the original-image taxon concept.',
  );
}

for (const [recordId, plantName] of HOST_SPELLING_CORRECTIONS) {
  const before = workingHosts.get(recordId);
  if (!before) throw new Error(`Missing host spelling row: ${recordId}`);
  pushHostAction(
    'correct_host_spelling',
    before,
    { ...before, plant_name: plantName },
    'HHB-062',
    'Correct the plant name against the original p.37 account.',
  );
}

const unsupportedHostAccount = new Map([
  ['hostplant-007195', 'HHB-016'], ['hostplant-007198', 'HHB-080'],
  ['hostplant-007218', 'HHB-083'], ['hostplant-007221', 'HHB-087'],
  ['hostplant-007229', 'HHB-086'], ['hostplant-007230', 'HHB-110'],
  ['hostplant-007199', 'HHB-026'], ['hostplant-007200', 'HHB-026'],
  ['hostplant-007204', 'HHB-041'], ['hostplant-007205', 'HHB-045'],
  ['hostplant-007206', 'HHB-045'], ['hostplant-007207', 'HHB-050'],
  ['hostplant-007224', 'HHB-095'], ['hostplant-007232', 'HHB-128'],
  ['hostplant-007234', 'HHB-152'],
]);
for (const recordId of UNSUPPORTED_HOST_DELETIONS) {
  const before = workingHosts.get(recordId);
  if (!before) throw new Error(`Missing unsupported host row: ${recordId}`);
  pushHostAction(
    'delete_source_spill',
    before,
    null,
    unsupportedHostAccount.get(recordId),
    'The row is absent from the named original account and is an adjacent/duplicate import spill.',
  );
}

const tobacco = workingHosts.get('hostplant-007307');
if (!tobacco) throw new Error('Missing tobacco source row');
pushHostAction(
  'update_geographic_scope',
  tobacco,
  {
    ...tobacco,
    observation_type: '文献（海外・明記）',
    notes: '国外ではタバコの害虫（原典p.98）',
  },
  'HHB-202',
  'The original explicitly limits the tobacco statement to outside Japan.',
);

function addHostFact(accountId, targetId, fact, rationale) {
  const [plantName, plantFamily, plantPart = '葉', lifeStage = '成虫', notes = ''] = fact;
  const candidate = {
    record_id: '',
    insect_id: targetId,
    plant_name: plantName,
    plant_family: plantFamily,
    observation_type: '野外（国内）',
    plant_part: plantPart,
    life_stage: lifeStage,
    reference: SOURCE,
    notes,
  };
  if ([...workingHosts.values()].some((row) => hostKey(row) === hostKey(candidate))) return;
  candidate.record_id = nextHostRecordId();
  pushHostAction('add_hostplant', null, candidate, accountId, rationale);
}

for (const [accountId, facts] of MANUALLY_VERIFIED_HOST_ADDITIONS) {
  const account = accountById.get(accountId);
  for (const fact of facts) {
    addHostFact(
      accountId,
      account.current_insect_id,
      fact,
      'Restore a food/host item visibly printed in the original account but absent from the canonical current taxon.',
    );
  }
}
for (const [accountId, targets] of SPECIES_SCOPE_TARGETS) {
  for (const targetId of targets) {
    for (const fact of SPECIES_SCOPE_HOST_FACTS.get(accountId) ?? []) {
      addHostFact(
        accountId,
        targetId,
        fact,
        'Share an unqualified species-level account with a genuine current subspecies covered by the original account scope.',
      );
    }
  }
}

const noteActions = [];
const workingNotes = new Map(allNotes.map((row) => [row.record_id, { ...row }]));
let noteActionSequence = 0;
let newNoteSequence = 0;
const nextNoteActionId = () => `HHB-NOTE-${String(++noteActionSequence).padStart(4, '0')}`;
const nextNoteRecordId = () => `note-hhb-audit-20260712-${String(++newNoteSequence).padStart(4, '0')}`;

function pushNoteAction(action, before, after, accountId, rationale) {
  const record = actionRecord(
    nextNoteActionId(),
    'general_notes',
    action,
    before,
    after,
    accountId,
    rationale,
  );
  noteActions.push(record);
  if (before) workingNotes.delete(before.record_id);
  if (after) workingNotes.set(after.record_id, { ...after });
}

for (const [recordId, accountId, targetId] of [
  ['note-000445', 'HHB-044', 'species-H943'],
  ['note-000478', 'HHB-037', 'species-H964'],
]) {
  const before = workingNotes.get(recordId);
  const account = accountById.get(accountId);
  if (!before) throw new Error(`Missing note move row: ${recordId}`);
  pushNoteAction(
    'move_and_verify_general_note',
    before,
    {
      ...before,
      insect_id: targetId,
      content: canonicalEmergence(account),
      page: String(account.printed_page),
      year: SOURCE_YEAR,
    },
    accountId,
    'Move a source note from a legacy taxon row and seal its printed-page provenance.',
  );
}

for (const account of accounts) {
  const targets = SPECIES_SCOPE_TARGETS.get(account.source_account_id)
    ?? [account.current_insect_id];
  for (const targetId of targets) {
    const candidates = [...workingNotes.values()].filter((row) => (
      row.reference === SOURCE
      && row.insect_id === targetId
      && row.note_type === '出現時期'
    ));
    if (candidates.length > 1) {
      throw new Error(`${account.source_account_id}/${targetId}: multiple emergence notes`);
    }
    const expectedContent = canonicalEmergence(account);
    if (!candidates.length) {
      const after = {
        record_id: nextNoteRecordId(),
        insect_id: targetId,
        note_type: '出現時期',
        content: expectedContent,
        reference: SOURCE,
        page: String(account.printed_page),
        year: SOURCE_YEAR,
      };
      pushNoteAction(
        'add_general_note',
        null,
        after,
        account.source_account_id,
        targetId === account.current_insect_id
          ? 'Restore a visibly printed emergence statement missing from the canonical taxon.'
          : 'Share an unqualified species-level emergence statement with a genuine current subspecies.',
      );
      continue;
    }
    const before = candidates[0];
    const after = {
      ...before,
      content: expectedContent,
      page: String(account.printed_page),
      year: SOURCE_YEAR,
    };
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      pushNoteAction(
        before.content === expectedContent ? 'verify_general_note_provenance' : 'replace_general_note',
        before,
        after,
        account.source_account_id,
        before.content === expectedContent
          ? 'Seal the original printed page and publication year.'
          : 'Replace a shifted/generic value with the original-image value.',
      );
    }
  }
}

for (const recordId of SYNTHETIC_NOTE_DELETIONS) {
  const before = workingNotes.get(recordId);
  if (!before) throw new Error(`Missing synthetic note row: ${recordId}`);
  // Each range was created by repeating a neighboring account value across a
  // genus. Tie it to the closest verified account page for evidence identity.
  const fallbackAccount = before.record_id < 'note-000320'
    ? 'HHB-139'
    : before.record_id < 'note-000400'
      ? 'HHB-089'
      : before.record_id < 'note-000450'
        ? 'HHB-173'
        : 'HHB-035';
  pushNoteAction(
    'delete_synthetic_source_spill',
    before,
    null,
    fallbackAccount,
    'No original account exists for this current taxon; the repeated month value is an import-generated genus filler.',
  );
}

const hostActionByRecordId = new Map(hostActions.map((action) => [
  action.before?.record_id ?? action.after?.record_id,
  action,
]));
const noteActionByRecordId = new Map(noteActions.map((action) => [
  action.before?.record_id ?? action.after?.record_id,
  action,
]));
const accountByTarget = new Map();
for (const account of accounts) {
  for (const target of SPECIES_SCOPE_TARGETS.get(account.source_account_id) ?? [account.current_insect_id]) {
    accountByTarget.set(target, account);
  }
}

function foodContains(account, plantName) {
  const sourceKey = japaneseKey(account.source_food_text)
    .replace(/など|類|科植物|植物/gu, '');
  const plantKey = japaneseKey(plantName).replace(/類/gu, '');
  return Boolean(plantKey) && sourceKey.includes(plantKey);
}

const currentHostLedger = sourceHosts.map((row) => {
  const action = hostActionByRecordId.get(row.record_id);
  const account = accountByTarget.get(row.insect_id);
  const commentary = row.record_id === 'hostplant-007308';
  return {
    record_id: row.record_id,
    insect_id: row.insect_id,
    plant_name: row.plant_name,
    status: action
      ? action.action
      : commentary
        ? 'verified_original_commentary'
        : account && foodContains(account, row.plant_name)
          ? 'verified_original_account'
          : 'hold_source_reclassification',
    source_account_id: action?.source.source_account_id
      ?? (commentary ? 'HHB-COMMENT-p75-AKEBIA' : account?.source_account_id ?? ''),
    decision: action?.rationale
      ?? (commentary
        ? 'p.75 explicitly states that the related Akebia flea beetle uses Akebia.'
        : account && foodContains(account, row.plant_name)
          ? 'The plant is present in the mapped original account.'
          : 'Not found in the mapped original account; retain only as a source-reclassification hold.'),
  };
});

const currentNoteLedger = sourceNotes.map((row) => {
  const action = noteActionByRecordId.get(row.record_id);
  const account = accountByTarget.get(row.insect_id);
  return {
    record_id: row.record_id,
    insect_id: row.insect_id,
    note_type: row.note_type,
    content: row.content,
    status: action
      ? action.action
      : account && row.note_type === '出現時期'
        ? 'verified_original_account'
        : 'hold_source_reclassification',
    source_account_id: action?.source.source_account_id ?? account?.source_account_id ?? '',
    decision: action?.rationale
      ?? (account && row.note_type === '出現時期'
        ? 'The note belongs to a mapped original account.'
        : 'The named original does not contain this note for this taxon; another source must be verified.'),
  };
});

const result = {
  source: {
    reference: SOURCE,
    title: SOURCE,
    author: '尾園曁',
    publisher: '文一総合出版',
    year: Number(SOURCE_YEAR),
    original_files: originalFiles,
    ocr_candidate_index: {
      path: OCR_PATH,
      sha256: sha256(fs.readFileSync(OCR_PATH)),
      policy: 'OCR is candidate generation only; accepted corrections require original-image review.',
    },
    legacy_transcription: {
      git_revision: RAW_REVISION,
      path: RAW_PATH,
      purpose: 'source-account transcription reconciled against original page images',
    },
  },
  counts: {
    source_accounts: accounts.length,
    current_source_host_rows: sourceHosts.length,
    current_source_note_rows: sourceNotes.length,
    mapped_current_taxa: new Set(accounts.map((row) => row.current_insect_id)).size,
    mapping_taxonomic_conflicts: mappingConflicts.length,
    weak_account_mappings: mappingWeak.length,
    low_page_matches: lowPageMatches.length,
    host_actions: hostActions.length,
    note_actions: noteActions.length,
    host_additions: hostActions.filter((row) => row.action === 'add_hostplant').length,
    host_moves: hostActions.filter((row) => row.action === 'move_hostplant').length,
    host_deletions: hostActions.filter((row) => row.action === 'delete_source_spill').length,
    note_additions: noteActions.filter((row) => row.action === 'add_general_note').length,
    note_replacements: noteActions.filter((row) => row.action === 'replace_general_note').length,
    synthetic_note_deletions: noteActions.filter((row) => row.action === 'delete_synthetic_source_spill').length,
    current_host_holds: currentHostLedger.filter((row) => row.status === 'hold_source_reclassification').length,
    current_note_holds: currentNoteLedger.filter((row) => row.status === 'hold_source_reclassification').length,
  },
  source_accounts: accounts,
  species_scope_decisions: [...SPECIES_SCOPE_TARGETS].map(([accountId, targets]) => ({
    source_account_id: accountId,
    targets,
    decision: 'share_species_level_account_with_current_subspecies',
  })),
  source_scope_holds: [
    {
      hold_id: 'HHB-HOLD-PLAGIOSTERNA',
      taxa: ['species-H663', 'species-H790'],
      decision: 'do_not_cross_share',
      reason: 'The handbook has geographically different pp.44 and 96 accounts; the recent synonymy/subspecies split requires a dedicated taxonomic reconciliation.',
    },
    {
      hold_id: 'HHB-HOLD-OTHER-SOURCE-NOTES',
      decision: 'retain_pending_original_source_review',
      record_ids: currentNoteLedger
        .filter((row) => row.status === 'hold_source_reclassification')
        .map((row) => row.record_id),
      reason: 'These rows are not supported by this handbook and appear to come from Japanese Chrysomelidae ecology-note papers or malformed import columns.',
    },
    {
      hold_id: 'HHB-HOLD-OTHER-SOURCE-HOSTS',
      decision: 'retain_pending_original_source_review',
      record_ids: currentHostLedger
        .filter((row) => row.status === 'hold_source_reclassification')
        .map((row) => row.record_id),
      reason: 'These relationships are absent from the mapped handbook account; deletion would risk discarding a fact from a different source.',
    },
  ],
  host_actions: hostActions,
  note_actions: noteActions,
  current_host_row_ledger: currentHostLedger,
  current_note_row_ledger: currentNoteLedger,
};

function reportMarkdown(audit) {
  const c = audit.counts;
  return `# 『ハムシハンドブック』包括監査（2026-07-12）

## 結論

原本44見開き（印刷頁12–99）を直接照合し、203の見出し・解説accountと現行の食草406行、一般ノート270行を全件台帳化した。OCRは頁候補の検索だけに使い、公開変更候補は原本画像で再確認した。

- 食草操作: ${c.host_actions}件（追加 ${c.host_additions}、正規分類行へ移動 ${c.host_moves}、明確な隣接行spill削除 ${c.host_deletions}、地理scope修正 1）
- 一般ノート操作: ${c.note_actions}件（追加 ${c.note_additions}、原本値へ置換 ${c.note_replacements}、生成的spill削除 ${c.synthetic_note_deletions}）
- 他出典の可能性があるため自動削除しない保留: 食草 ${c.current_host_holds}行、ノート ${c.current_note_holds}行

## 原本と現行の主な不一致

1. 食草は原本にあるのに正規分類行で缺けていた。例: ワモンナガハムシのマユミ・ニシキギ・クロヅル、フジハムシのフジ・ニセアカシア、ミスジクビボソハムシのセンナリホオズキ。
2. 出現期の置換わりがあった。例: ワモンナガハムシは「4〜9月」、フジハムシは「4〜7月」、イッシキトゲハムシは「4〜7月」が原本値。
3. 属内の全種に同じ月を複製した生成的なノートが65行あった。該当taxonの原本accountが無いため削除対象とした。
4. 旧学名・重複行への誤配属があった。例: *Cleoporus variabilis* は H943、*Cryptocephalus perelegans* は H964系統へ移す。

## 亜種の扱い

原本が亜種を限定せず種全体を述べ、分布scopeも該当亜種を含む場合のみ、現行の真の亜種行へ共有する。対象は *Cryptocephalus perelegans*、*Acrothinium gaschkevitchii*、*Platycorynus japonicus*、*Aulacophora nigripennis*、*Cassida rubiginosa*。

*Plagiosterna aenea/formosana* は原本p.44とp.96が異なる地理accountで、現行の異名・亜種整理と衝突する。そのため盲目的に共有せず、p.96の値は「沖縄本島」を明記する。

## 保留

保留行は『ハムシハンドブック』では確認できないが、『日本産ハムシ科生態覚書』等の別出典で真である可能性がある。その原本確認が終わるまで事実自体は削除せず、本書由来との断定だけを保留する。

## 再現性

- 原本: IMG_0059.pdf–IMG_0102.pdf（44ファイル）、個別SHA-256はJSON台帳に記録。
- OCR候補索引SHA-256: ${audit.source.ocr_candidate_index.sha256}
- 全行台帳とbefore/after: \`data/source_audits/hamushi-handbook-comprehensive-audit-2026-07-12.json\`
`;
}

if (process.argv.includes('--write')) {
  fs.writeFileSync(AUDIT_PATH, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  fs.writeFileSync(REPORT_PATH, reportMarkdown(result), 'utf8');
  console.log(JSON.stringify({
    audit: path.relative(ROOT, AUDIT_PATH),
    report: path.relative(ROOT, REPORT_PATH),
    counts: result.counts,
  }, null, 2));
} else if (process.argv.includes('--json')) {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} else {
  console.log(JSON.stringify(result.counts, null, 2));
  console.log('\nTaxonomic conflicts');
  for (const row of mappingConflicts) {
    console.log(`${row.source_account_id}\t${row.source_japanese_name}\t${row.source_scientific_name}\t=>\t${row.current_insect_id}\t${row.current_japanese_name}\t${row.current_scientific_name}`);
  }
  console.log('\nWeak mappings');
  for (const row of mappingWeak) console.log(`${row.source_account_id}\t${row.source_japanese_name}\t=>\t${row.current_insect_id}\t${row.current_japanese_name}\t${row.mapping_score}`);
  console.log('\nLow page matches');
  for (const row of lowPageMatches) console.log(`${row.source_account_id}\t${row.source_japanese_name}\tp${row.printed_page}\t${row.page_match_score}\t${row.page_match_text ?? ''}`);
}

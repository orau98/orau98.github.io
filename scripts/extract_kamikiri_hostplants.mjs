#!/usr/bin/env node
/**
 * 日本産カミキリムシの寄主植物一覧テキストから食草データを抽出するスクリプト。
 *
 * OCRテキストの寄主植物一覧セクションを解析し、
 * - normalized_data/insects.csv とPDF監査台帳で和名→insect_id を厳密解決
 * - 類似度・部分一致は候補にも自動採用せず、未照合として隔離
 * - hostplants.csv の既存「日本産カミキリムシ」データとの重複を除外
 * - 結果を reports/kamikiri_hostplant_list.json に出力
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'node:crypto';
import Papa from 'papaparse';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = path.resolve(__dirname, '..');

const DEFAULT_OCR_FILE = path.join(BASE, 'pdfs/kamikiri-ocr/日本産カミキリムシ_compressed.txt');
const OCR_FILE = process.env.KAMIKIRI_OCR_FILE
  ? path.resolve(process.env.KAMIKIRI_OCR_FILE)
  : DEFAULT_OCR_FILE;
const INSECTS_CSV = path.join(BASE, 'normalized_data/insects.csv');
const HOSTS_CSV   = path.join(BASE, 'normalized_data/hostplants.csv');
const AUDIT_CSV = path.join(BASE, 'data/source_audits/japanese-longhorn-beetles-2007.csv');
const HOST_INDEX_AUDIT_CSV = path.join(
  BASE,
  'data/source_audits/japanese-longhorn-beetles-2007-host-index.csv',
);
const OUT_JSON = process.env.KAMIKIRI_OUT_JSON
  ? path.resolve(process.env.KAMIKIRI_OUT_JSON)
  : path.join(BASE, 'reports/kamikiri_hostplant_list.json');
const HOSTPLANT_LIST_HEADING_RE = /^(寄主植物一覧|寄上植物一覧|寄王植物一覧|寺主植物一覧)\s+\d+/;
const HOSTPLANT_SECTION_START_RE = /^寄.{0,4}植.{0,4}[物牧].{0,3}[一－-]?覧\s+683\s*$/u;
const FAMILY_HEADING_RE = /^([ぁ-ん\u30A0-\u30FFー一-龠a-zA-Z]{2,20}?[科料])\s+[A-Z][A-Za-z]/u;

// ===================================================================
// ユーティリティ
// ===================================================================

function normalize(s) {
  if (!s) return '';
  return s.normalize('NFKC').replace(/[\s\u3000]/g, '').trim();
}

const PLANT_NAME_CORRECTIONS = new Map([
  ['ホソバムクイスビワ', 'ホソバムクイヌビワ'],
  ['ハチジョウグウ', 'ハチジョウグワ'],
  ['モクシン', 'モクレン'],
]);

function normalizeExtractedPlantName(name) {
  return PLANT_NAME_CORRECTIONS.get(name) || name;
}

function normalizeExtractedPlantFamily(family, plantName) {
  if (plantName === 'アサ') return 'アサ科';
  return family;
}

// ===================================================================
// 1. insects.csv からカミキリムシ辞書を構築
// ===================================================================
const INSECTS_TEXT = fs.readFileSync(INSECTS_CSV, 'utf8');
const insectsParsed = Papa.parse(INSECTS_TEXT, { header: true, skipEmptyLines: true });

const candidatesByNorm = new Map();
const addCandidate = (name, candidate) => {
  const key = normalize(name);
  if (!key) return;
  if (!candidatesByNorm.has(key)) candidatesByNorm.set(key, new Map());
  candidatesByNorm.get(key).set(candidate.iid, candidate);
};

for (const row of insectsParsed.data) {
  if (!row || row.family !== 'Cerambycidae') continue;
  const iid   = (row.insect_id   || '').trim();
  const jname = (row.japanese_name || '').trim();
  if (!iid || !jname) continue;

  addCandidate(jname, { iid, jname, method: 'exact_japanese_name' });

  // 亜種行: "ルリボシカミキリ 基亜種" → "ルリボシカミキリ"
  const base = jname.replace(/\s+(基亜種|亜種\d*|[A-Z].+亜種).*/u, '').trim();
  if (base !== jname) addCandidate(base, { iid, jname, method: 'exact_derived_base_name' });

  for (const col of ['old_japanese_name', 'alternative_name', 'other_names']) {
    for (const alt of (row[col] || '').split(/[;；、,，]/)) {
      if (alt.trim()) addCandidate(alt.trim(), { iid, jname, method: `exact_${col}` });
    }
  }
}

const reviewedCrosswalk = new Map();
let reviewedDerivedAliasOverrideCount = 0;
if (fs.existsSync(AUDIT_CSV)) {
  const auditParsed = Papa.parse(fs.readFileSync(AUDIT_CSV, 'utf8'), {
    header: true,
    skipEmptyLines: true,
  });
  if (auditParsed.errors.length > 0) {
    throw new Error(`PDF監査台帳を解析できません: ${auditParsed.errors[0].message}`);
  }
  for (const row of auditParsed.data) {
    if ((row.decision || '').trim() !== 'include') continue;
    const sourceName = normalize(row.source_japanese_name);
    const iid = (row.insect_id || '').trim();
    if (!sourceName || !iid) continue;
    if (reviewedCrosswalk.has(sourceName) && reviewedCrosswalk.get(sourceName).iid !== iid) {
      throw new Error(`PDF監査台帳の原典和名が複数IDへ衝突しています: ${row.source_japanese_name}`);
    }
    const registeredCandidates = [...(candidatesByNorm.get(sourceName)?.values() || [])];
    const conflictingCandidates = registeredCandidates.filter((candidate) => candidate.iid !== iid);
    const reviewedDerivedAliasOverride =
      registeredCandidates.some((candidate) => candidate.iid === iid) &&
      conflictingCandidates.length > 0 &&
      conflictingCandidates.every((candidate) => candidate.method === 'exact_derived_base_name') &&
      Boolean((row.source_taxon || '').trim()) &&
      Boolean((row.pdf_page || '').trim()) &&
      Boolean((row.printed_page || '').trim());
    if (conflictingCandidates.length > 0 && !reviewedDerivedAliasOverride) {
      throw new Error(
        `PDF監査台帳の原典和名が別の登録IDと衝突しています: ` +
        `${row.source_japanese_name} -> ${iid}, ` +
        `${conflictingCandidates.map((candidate) => candidate.iid).join(',')}`,
      );
    }
    if (reviewedDerivedAliasOverride) reviewedDerivedAliasOverrideCount += 1;
    const insect = insectsParsed.data.find((candidate) => candidate?.insect_id === iid);
    if (!insect) throw new Error(`PDF監査台帳のinsect_idが存在しません: ${iid}`);
    reviewedCrosswalk.set(sourceName, { iid, jname: insect.japanese_name, method: 'reviewed_source_crosswalk' });
  }
}

const kamikiriByNorm = new Map();
const ambiguousByNorm = new Map();
for (const [key, candidates] of candidatesByNorm) {
  const values = [...candidates.values()];
  if (values.length === 1) kamikiriByNorm.set(key, values[0]);
  else ambiguousByNorm.set(key, values);
}

console.log(
  `カミキリムシ厳密照合辞書: 一意=${kamikiriByNorm.size}, ` +
  `曖昧=${ambiguousByNorm.size}, 原典監査済み対応=${reviewedCrosswalk.size}`,
);

const hostIndexAuditsByEvidence = new Map();
if (fs.existsSync(HOST_INDEX_AUDIT_CSV)) {
  const hostIndexAuditParsed = Papa.parse(fs.readFileSync(HOST_INDEX_AUDIT_CSV, 'utf8'), {
    header: true,
    skipEmptyLines: true,
  });
  if (hostIndexAuditParsed.errors.length > 0) {
    throw new Error(`寄主索引監査台帳を解析できません: ${hostIndexAuditParsed.errors[0].message}`);
  }
  for (const row of hostIndexAuditParsed.data) {
    const insectId = (row.insect_id || '').trim();
    const sourceOcrLine = Number(row.source_ocr_line);
    const matchMethod = (row.match_method || '').trim();
    if (!insectId || !Number.isInteger(sourceOcrLine) || !matchMethod) continue;
    const key = `${insectId}\u0000${sourceOcrLine}\u0000${matchMethod}`;
    if (hostIndexAuditsByEvidence.has(key)) {
      throw new Error(`寄主索引監査台帳の証拠が重複しています: ${key}`);
    }
    hostIndexAuditsByEvidence.set(key, {
      audit_id: (row.audit_id || '').trim(),
      decision: (row.decision || '').trim(),
    });
  }
}

// ===================================================================
// 2. OCRテキスト読み込み
// ===================================================================
const ocrText  = fs.readFileSync(OCR_FILE, 'utf8');
const allLines = ocrText.split('\n');
let headingIndex = allLines.findIndex((line) => HOSTPLANT_SECTION_START_RE.test(line.trim()));
if (headingIndex === -1) {
  headingIndex = allLines.findIndex((line) => HOSTPLANT_LIST_HEADING_RE.test(line.trim()));
}
if (headingIndex === -1) {
  throw new Error('OCRテキスト内に寄主植物一覧の開始行が見つかりません。');
}
const startIndex = allLines.findIndex((line, index) =>
  index > headingIndex && FAMILY_HEADING_RE.test(line.trim())
);
if (startIndex === -1) {
  throw new Error('OCRテキスト内に寄主植物一覧の最初の科名行が見つかりません。');
}
const configuredEndLine = process.env.KAMIKIRI_HOSTPLANT_END_LINE
  ? Number.parseInt(process.env.KAMIKIRI_HOSTPLANT_END_LINE, 10)
  : null;
const nextIndexHeading = allLines.findIndex((line, index) =>
  index > startIndex && /^(学名索引|和名索引)\s*$/u.test(line.trim())
);
const endIndex = Number.isFinite(configuredEndLine)
  ? Math.min(configuredEndLine, allLines.length)
  : (nextIndexHeading >= 0 ? nextIndexHeading : allLines.length);
const rawLines = allLines.slice(startIndex, endIndex).map((line, offset) => ({
  text: line.replace(/\r$/, ''),
  lineNumber: startIndex + offset + 1,
}));
console.log(`OCR対象行数: ${rawLines.length} (${startIndex + 1}〜${endIndex}行、見出し=${headingIndex + 1}行)`);

// ===================================================================
// 3. 前処理
//    - ページヘッダ・ページ番号・区切り行を除去
//    - 科名・植物名の見出し行でセグメント化
//    - 「カ ミキリ」など途中に空白が混入したカミキリ名を修正
// ===================================================================
const SKIP_RE = /^(---|寄主植物一覧|寄上植物一覧|寄王植物一覧|寺主植物一覧|\d{3,4})(\s|$)/;

function isPlantHeadingLine(line) {
  const s = line.trim();
  if (!s) return false;
  if (FAMILY_HEADING_RE.test(s)) return false;
  if (/カミキリ/.test(s)) return false;
  if (/^(キリ|ミキリ|カミキリ)\s+(?!Paulownia\b)/.test(s)) return false;
  if (/^植栽/.test(s)) return false;
  if (/^植根/.test(s)) return false;

  return /^[ぁ-ん\u30A0-\u30FFー一-龠\uff10-\uff19][^A-Z]{1,80}\s+[A-Z][A-Za-z.]+(?:\s+[a-z×][A-Za-z.]+|\s+spp\.|\s+var\.|\s+ssp\.|\s|$)/u.test(s);
}

// OCRにはページ単位の空白しかないため、科名行・植物名行を境界にする。
const segments = [];
let block = [];
let currentPdfPage = null;
for (let index = 0; index < startIndex; index += 1) {
  const pageMatch = allLines[index].match(/^---\s*ページ\s+(\d+)\s*---$/);
  if (pageMatch) currentPdfPage = Number.parseInt(pageMatch[1], 10);
}
const pushBlock = () => {
  if (block.length > 0) {
    segments.push({
      text: block.map((entry) => entry.text).join(' '),
      ocrLineStart: block[0].lineNumber,
      pdfPage: block[0].pdfPage,
    });
    block = [];
  }
};

for (const { text: rawLine, lineNumber } of rawLines) {
  const line = rawLine.trim();
  const pageMatch = line.match(/^---\s*ページ\s+(\d+)\s*---$/);
  if (pageMatch) {
    pushBlock();
    currentPdfPage = Number.parseInt(pageMatch[1], 10);
    continue;
  }
  if (SKIP_RE.test(line) || line.startsWith('--- ページ')) continue;

  if (FAMILY_HEADING_RE.test(line)) {
    pushBlock();
    segments.push({ text: line, ocrLineStart: lineNumber, pdfPage: currentPdfPage });
    continue;
  }

  if (isPlantHeadingLine(line)) {
    pushBlock();
    block = [{ text: line, lineNumber, pdfPage: currentPdfPage }];
    continue;
  }

  if (block.length > 0) block.push({ text: line, lineNumber, pdfPage: currentPdfPage });
}
pushBlock();

// セグメント内の「カ ミキリ」「カミキ リ」などの空白混入を修正
function fixKamikiri(s) {
  // 「〇〇カ ミキリ」「〇〇カミキ リ」「〇〇カミキリ リ」等を結合
  s = s.replace(/カ\s+ミキリ/g, 'カミキリ');
  s = s.replace(/カミキ\s+リ/g, 'カミキリ');
  s = s.replace(/カミキリ\s+リ/g, 'カミキリリ');  // 誤字
  // 「ハナカミキ\nリ」→「ハナカミキリ」
  s = s.replace(/([ァ-ヶー一-龠]+カミキ)\s+([リ])/g, '$1$2');
  return s;
}

const fixedSegments = segments.map((segment) => ({
  ...segment,
  text: fixKamikiri(segment.text),
}));
console.log(`セグメント数: ${fixedSegments.length}`);
console.log('先頭セグメントサンプル:');
fixedSegments.slice(0, 3).forEach(({ text }) => console.log(`  ${text.slice(0, 100)}`));

// ===================================================================
// 4. セグメントを解析して (科名, 植物名, カミキリ名リスト) を構築
// ===================================================================

// カミキリムシ和名: 5文字以上のカタカナ・漢字で「カミキリ」で終わるトークン
// Unicode ranges: ぁ-ん (3041-3096), ァ-ヶ (30A1-30F6), ー (30FC), 一-龠 (4E00-9FA0)
const RE_KAMIKIRI = /([ぁ-ん\u30A0-\u30FFー一-龠\uFF10-\uFF19\uFF21-\uFF5a]{2,60}?カミキリ(?:類似|類|型|様)?)(?![ぁ-ん\u30A0-\u30FFー一-龠])/gu;

function extractKamikiriNames(text) {
  const results = [];
  let m;
  RE_KAMIKIRI.lastIndex = 0;
  while ((m = RE_KAMIKIRI.exec(text)) !== null) {
    let c = m[1].trim();
    if (c.length < 5) continue;
    if (/植物|一覧|植栽/.test(c)) continue;
    // OCRゴミ除去: 先頭の数字や記号
    c = c.replace(/^[\d\uff10-\uff19\s]+/, '').trim();
    if (c.length >= 5) results.push(c);
  }
  return results;
}

function extractPlantName(seg) {
  if (/カミキリ/.test(seg)) return null;
  if (/^植栽/.test(seg)) return null;
  if (/^植根/.test(seg)) return null;   // OCR誤字「植根」

  // 先頭が日本語で始まる
  if (/^[ぁ-ん\u30A0-\u30FFー一-龠]/u.test(seg)) {
    // 「植物名 (別名) ラテン名 植栽...」パターン
    // 先頭の日本語・括弧・スペース部分を抽出（ラテン大文字の前まで）
    const m = seg.match(
      /^((?:[ぁ-ん\u30A0-\u30FFー一-龠\uff10-\uff19a-z]+)(?:[（(（][^）)）]*[）)）])?(?:\s*[ぁ-ん\u30A0-\u30FFー一-龠]+(?:[（(（][^）)）]*[）)）])?)*)/u
    );
    if (m && m[1].length >= 2) {
      const plant = m[1].trim();
      // 括弧内別名を除去して主名のみ
      const main = plant.replace(/[（(][^）)]*[）)]/gu, '').trim();
      return normalizeExtractedPlantName(main.length >= 2 ? main : plant);
    }
    const plant = seg.split(/[\s（(A-Z]/)[0].trim();
    return plant ? normalizeExtractedPlantName(plant) : null;
  }

  // ラテン語のみの行（Cotoneaster bullata など）
  if (/^[A-Z][a-z]+\s+[a-z×]/.test(seg)) {
    const m = seg.match(/^([A-Z][a-z]+(?:\s+[a-z×][a-z.]+)*)/);
    return m ? m[1].trim() : null;
  }

  return null;
}

function isFamily(seg) {
  // 科名行: 日本語科名(末尾「科」か「料」) + 半角空白 + ラテン科名(大文字始まり)
  const m = seg.match(FAMILY_HEADING_RE);
  if (m) return m[1].replace('料', '科').trim();
  return null;
}

// ===================================================================
// 4b. 同一セグメント内に「植物名 学名 カミキリ名1 学名1，...」が
//     混在する場合の植物名を先頭から取り出す
// ===================================================================
function extractPlantFromMixed(seg) {
  // 「日本語（別名）ラテン名 カミキリ名...」のパターン
  // 先頭の日本語部分を取り出す
  const m = seg.match(
    /^([ぁ-ん\u30A0-\u30FFー一-龠\uff10-\uff19a-z][ぁ-ん\u30A0-\u30FFー一-龠\uff10-\uff19（()）]*?)\s+[A-Z×]/u
  );
  if (m && m[1].length >= 2) {
    const plant = m[1].trim();
    const main = plant.replace(/[（(][^）)]*[）)]/gu, '').trim();
    return normalizeExtractedPlantName(main.length >= 2 ? main : plant);
  }
  return null;
}

// 状態機械でセグメントを走査
let currentFamily = '';
let currentPlant  = '';
let currentPlantSource = { pdfPage: null, ocrLineStart: null };
const records = [];  // { plant, family, kamikiriNames, sourcePdfPage, sourceOcrLine }

// OCRの植物索引だけでは近縁名・OCR崩れで誤照合しやすい箇所。
// 本文の寄主植物欄と植物索引を照合して確認した補正を明示する。
const MANUAL_RECORDS = [
  { plant: 'リュウキュウアカメガシワ', family: 'トウダイグサ科', kamikiriNames: ['リュウキュウヒメアメイロカミキリ'] },
  { plant: 'フカノキ', family: 'ウコギ科', kamikiriNames: ['リュウキュウヒメアメイロカミキリ'] },
  { plant: 'アコウ', family: 'クワ科', kamikiriNames: ['リュウキュウヒメアメイロカミキリ'] },
  { plant: 'タブノキ', family: 'クスノキ科', kamikiriNames: ['リュウキュウヒメアメイロカミキリ'] },
  { plant: 'ヤブニッケイ', family: 'クスノキ科', kamikiriNames: ['リュウキュウヒメアメイロカミキリ'] },
  { plant: 'タラノキ', family: 'ウコギ科', kamikiriNames: ['オキナワセンノカミキリ'] },
  { plant: 'リュウキュウハリギリ', family: 'ウコギ科', kamikiriNames: ['オキナワセンノカミキリ'] },
  { plant: 'フカノキ', family: 'ウコギ科', kamikiriNames: ['オキナワセンノカミキリ'] },
  { plant: 'フカノキ', family: 'ウコギ科', kamikiriNames: ['キンケビロウドカミキリ 八重山諸島亜種'] },
  { plant: 'オキナワトベラ', family: 'トベラ科', kamikiriNames: ['キンケビロウドカミキリ 八重山諸島亜種'] },
  { plant: 'フカノキ', family: 'ウコギ科', kamikiriNames: ['キンケビロウドカミキリ 沖縄亜種'] },
  { plant: 'リュウキュウハリギリ', family: 'ウコギ科', kamikiriNames: ['キンケビロウドカミキリ 沖縄亜種'] },
  { plant: 'タラノキ', family: 'ウコギ科', kamikiriNames: ['キンケビロウドカミキリ 沖縄亜種'] },
  { plant: 'オキナワトベラ', family: 'トベラ科', kamikiriNames: ['キンケビロウドカミキリ 沖縄亜種'] },
  { plant: 'トベラ', family: 'トベラ科', kamikiriNames: ['キンケビロウドカミキリ 沖縄亜種'] },
  { plant: 'フカノキ', family: 'ウコギ科', kamikiriNames: ['アマミコブヒゲカミキリ'] },
  { plant: 'バリバリノキ', family: 'クスノキ科', kamikiriNames: ['ホシベニカミキリ'] },
  { plant: 'クスノキ', family: 'クスノキ科', kamikiriNames: ['ホシベニカミキリ'] },
  { plant: 'ヤブニッケイ', family: 'クスノキ科', kamikiriNames: ['ホシベニカミキリ'] },
  { plant: 'コヤブニッケイ', family: 'クスノキ科', kamikiriNames: ['ホシベニカミキリ'] },
  { plant: 'ホソバタブ', family: 'クスノキ科', kamikiriNames: ['ホシベニカミキリ'] },
  { plant: 'タブノキ', family: 'クスノキ科', kamikiriNames: ['ホシベニカミキリ'] },
  { plant: 'シロダモ', family: 'クスノキ科', kamikiriNames: ['ホシベニカミキリ'] },
  { plant: 'クスノキ類', family: 'クスノキ科', kamikiriNames: ['ホシベニカミキリ'] },
  { plant: 'マテバシイ', family: 'ブナ科', kamikiriNames: ['オオスミヒゲナガカミキリ'] },
  { plant: 'ブナ', family: 'ブナ科', kamikiriNames: ['ヨコヤマヒゲナガカミキリ'] },
  { plant: 'イヌブナ', family: 'ブナ科', kamikiriNames: ['ヨコヤマヒゲナガカミキリ'] },
  { plant: 'ヤナギ類', family: 'ヤナギ科', kamikiriNames: ['エゾカミキリ'] },
  { plant: 'アカマツ', family: 'マツ科', kamikiriNames: ['マツノマダラカミキリ'] },
  { plant: 'クロマツ', family: 'マツ科', kamikiriNames: ['マツノマダラカミキリ'] },
  { plant: 'リュウキュウマツ', family: 'マツ科', kamikiriNames: ['マツノマダラカミキリ'] },
  { plant: 'マツ属', family: 'マツ科', kamikiriNames: ['マツノマダラカミキリ', 'ヒゲナガカミキリ', 'シラフヨツボシヒゲナガカミキリ', 'ヒメシラフヒゲナガカミキリ'] },
  { plant: 'モミ属', family: 'マツ科', kamikiriNames: ['マツノマダラカミキリ', 'ヒゲナガカミキリ', 'シラフヒゲナガカミキリ', 'シラフヨツボシヒゲナガカミキリ', 'ヒメシラフヒゲナガカミキリ'] },
  { plant: 'トウヒ属', family: 'マツ科', kamikiriNames: ['マツノマダラカミキリ', 'ヒゲナガカミキリ', 'シラフヒゲナガカミキリ', 'シラフヨツボシヒゲナガカミキリ', 'ヒメシラフヒゲナガカミキリ'] },
  { plant: 'ツガ属', family: 'マツ科', kamikiriNames: ['ヒゲナガカミキリ'] },
  { plant: 'カラマツ', family: 'マツ科', kamikiriNames: ['マツノマダラカミキリ', 'ヒゲナガカミキリ', 'シラフヒゲナガカミキリ', 'シラフヨツボシヒゲナガカミキリ', 'カラフトヒゲナガカミキリ', 'ヒメシラフヒゲナガカミキリ'] },
  { plant: 'アカマツ', family: 'マツ科', kamikiriNames: ['カラフトヒゲナガカミキリ'] },
  { plant: 'クロマツ', family: 'マツ科', kamikiriNames: ['カラフトヒゲナガカミキリ'] },
  { plant: 'トウヒ', family: 'マツ科', kamikiriNames: ['カラフトヒゲナガカミキリ'] },
  { plant: 'ツガ', family: 'マツ科', kamikiriNames: ['カラフトヒゲナガカミキリ'] },
  { plant: 'ヤブニッケイ', family: 'クスノキ科', kamikiriNames: ['キマダラヒメヒゲナガカミキリ'] },
  { plant: 'オキナワジイ', family: 'ブナ科', kamikiriNames: ['アマミヒメヒゲナガカミキリ'] },
  { plant: 'ホルトノキ', family: 'ホルトノキ科', kamikiriNames: ['アマミヒメヒゲナガカミキリ'] },
  { plant: 'ナギ', family: 'マキ科', kamikiriNames: ['アマミヒメヒゲナガカミキリ'] },
  { plant: 'ヤンバルアワブキ', family: 'アワブキ科', kamikiriNames: ['コゲチャフタモンヒゲナガカミキリ'] },
];

const DENIED_PAIRS = new Set([
  'species-22110||ハスノハギリ',
  'species-22777||カエデ類',
  'species-22777||ヤマモミジ',
  'species-22753||イスノキ',
  'species-22743||カラスザンショウ',
  'species-22743||マメガキ',
  'species-22743||シロバイ',
  'species-22847||ショウベンノキ',
  'species-22847||シロバイ',
].map((pair) => {
  const [iid, plant] = pair.split('||');
  return `${iid}||${normalize(plant)}`;
}));

for (const segment of fixedSegments) {
  const s = segment.text.trim();
  if (!s) continue;

  // --- 科名チェック ---
  const fam = isFamily(s);
  if (fam) {
    currentFamily = fam;
    // 科名行に続くカミキリ名があれば取得
    const names = extractKamikiriNames(s);
    if (names.length > 0 && currentPlant) {
      records.push({
        plant: currentPlant,
        family: normalizeExtractedPlantFamily(currentFamily, currentPlant),
        kamikiriNames: names,
        sourcePdfPage: segment.pdfPage ?? currentPlantSource.pdfPage,
        sourceOcrLine: segment.ocrLineStart ?? currentPlantSource.ocrLineStart,
      });
    }
    continue;
  }

  // --- カミキリ名を含む行 ---
  const names = extractKamikiriNames(s);
  if (names.length > 0) {
    // 同一セグメント内に植物名も混在しているか確認
    // 例: 「アオキ Awcuba japonica コゲチャサビカミキリ Mimectatina...」
    const mixedPlant = extractPlantFromMixed(s);
    if (mixedPlant && mixedPlant !== currentPlant) {
      // 先に前の植物との紐付けを保存（もしあれば）
      // そして新しい植物として更新
      currentPlant = mixedPlant;
      currentPlantSource = { pdfPage: segment.pdfPage, ocrLineStart: segment.ocrLineStart };
    }
    if (currentPlant) {
      records.push({
        plant: currentPlant,
        family: normalizeExtractedPlantFamily(currentFamily, currentPlant),
        kamikiriNames: names,
        sourcePdfPage: segment.pdfPage ?? currentPlantSource.pdfPage,
        sourceOcrLine: segment.ocrLineStart ?? currentPlantSource.ocrLineStart,
      });
    }
    // else: 植物名を見逃した（OCR破損等）→ スキップ
    continue;
  }

  // --- 植物名行チェック ---
  const plant = extractPlantName(s);
  if (plant) {
    currentPlant = plant;
    currentPlantSource = { pdfPage: segment.pdfPage, ocrLineStart: segment.ocrLineStart };
    continue;
  }
  // それ以外（OCR誤字・不明行）はスキップ
}

const recordKeys = new Set(records.flatMap(({ plant, family, kamikiriNames }) =>
  kamikiriNames.map((name) => `${normalize(plant)}||${normalize(family)}||${normalize(name)}`),
));
for (const record of MANUAL_RECORDS) {
  for (const name of record.kamikiriNames) {
    const key = `${normalize(record.plant)}||${normalize(record.family)}||${normalize(name)}`;
    if (recordKeys.has(key)) continue;
    records.push({
      ...record,
      kamikiriNames: [name],
      manual: true,
      sourcePdfPage: null,
      sourceOcrLine: null,
    });
    recordKeys.add(key);
  }
}
records.sort((a, b) => Number(Boolean(b.manual)) - Number(Boolean(a.manual)));

console.log(`\n抽出レコード数: ${records.length}`);
console.log('レコードサンプル (先頭10件):');
records.slice(0, 10).forEach(({ plant, family, kamikiriNames }) => {
  console.log(`  [${family}] ${plant}: ${kamikiriNames.join(' / ')}`);
});

// ===================================================================
// 5. カミキリムシ和名 → insect_id の厳密マッチング
// ===================================================================
function findInsectId(rawName) {
  const n = normalize(rawName);
  if (!n) return { iid: null, jname: null, score: 0, method: 'no_match' };

  if (reviewedCrosswalk.has(n)) {
    const { iid, jname, method } = reviewedCrosswalk.get(n);
    return { iid, jname, score: 1, method };
  }

  // 登録和名・登録済み別名の一意な完全一致だけを採用する。
  if (kamikiriByNorm.has(n)) {
    const { iid, jname, method } = kamikiriByNorm.get(n);
    return { iid, jname, score: 1, method };
  }
  if (ambiguousByNorm.has(n)) {
    return {
      iid: null,
      jname: null,
      score: 0,
      method: 'ambiguous_exact_name',
      possibleIds: ambiguousByNorm.get(n).map((candidate) => candidate.iid),
    };
  }

  return { iid: null, jname: null, score: 0, method: 'no_match' };
}

// ===================================================================
// 6. 既存 hostplants.csv の (insect_id, 正規化植物名) セットを構築
// ===================================================================
const hostsText   = fs.readFileSync(HOSTS_CSV, 'utf8');
const hostsParsed = Papa.parse(hostsText, { header: true, skipEmptyLines: true });
const existing    = new Set();
for (const row of hostsParsed.data) {
  if (!row) continue;
  const ref = row.reference || '';
  if (ref.includes('カミキリムシ')) {
    existing.add(`${row.insect_id}||${normalize(row.plant_name)}`);
  }
}
console.log(`\n既存カミキリムシ食草ペア数: ${existing.size}`);

// ===================================================================
// 7. 結果を組み立て
// ===================================================================
const results = [];
const stats   = { exact: 0, reviewed_crosswalk: 0, ambiguous: 0, no_match: 0 };
let deniedCount = 0;
const seenResultPairs = new Set();

for (const {
  plant,
  family,
  kamikiriNames,
  sourcePdfPage = null,
  sourceOcrLine = null,
  manual = false,
} of records) {
  const plantNorm = normalize(plant);
  for (const rawName of kamikiriNames) {
    const { iid, jname, score, method, possibleIds = [] } = findInsectId(rawName);

    if (!iid) {
      if (method === 'ambiguous_exact_name') stats.ambiguous++;
      else stats.no_match++;
      results.push({
        insect_id:    null,
        insect_name:  rawName,
        matched_name: null,
        match_score:  0,
        plant_name:   plant,
        plant_family: family,
        is_new:       false,
        match_method: method,
        possible_ids: possibleIds,
        source_pdf_page: sourcePdfPage,
        source_printed_page_range: Number.isInteger(sourcePdfPage)
          ? [sourcePdfPage * 2 + 332, sourcePdfPage * 2 + 333]
          : [],
        source_ocr_line: sourceOcrLine,
        manual_correction: manual,
        audit_id: null,
        audit_decision: null,
        note:         method
      });
      continue;
    }

    if (DENIED_PAIRS.has(`${iid}||${plantNorm}`)) {
      deniedCount++;
      continue;
    }

    const resultPairKey = `${iid}||${plantNorm}`;
    if (seenResultPairs.has(resultPairKey)) continue;
    seenResultPairs.add(resultPairKey);

    if (method.startsWith('reviewed_source_crosswalk')) stats.reviewed_crosswalk++;
    else stats.exact++;

    const isNew = !existing.has(`${iid}||${plantNorm}`);
    const hostIndexAudit = Number.isInteger(sourceOcrLine)
      ? hostIndexAuditsByEvidence.get(`${iid}\u0000${sourceOcrLine}\u0000${method}`)
      : null;

    results.push({
      insect_id:    iid,
      insect_name:  jname,
      matched_name: normalize(rawName) !== normalize(jname) ? rawName : null,
      match_score:  score,
      match_method: method,
      plant_name:   plant,
      plant_family: family,
      is_new:       isNew,
      source_pdf_page: sourcePdfPage,
      source_printed_page_range: Number.isInteger(sourcePdfPage)
        ? [sourcePdfPage * 2 + 332, sourcePdfPage * 2 + 333]
        : [],
      source_ocr_line: sourceOcrLine,
      manual_correction: manual,
      audit_id: hostIndexAudit?.audit_id || null,
      audit_decision: hostIndexAudit?.decision || null,
      note:         ''
    });
  }
}

const newCount  = results.filter(r => r.is_new).length;
const auditedNewCount = results.filter(r => r.is_new && r.audit_decision).length;
const unreviewedNewCount = results.filter(r => r.is_new && r.insect_id && !r.audit_decision).length;
const matchedCount = results.filter(r => r.insect_id).length;
console.log(
  `\nマッチ統計: 完全=${stats.exact}, 原典監査済み対応=${stats.reviewed_crosswalk}, ` +
  `曖昧名隔離=${stats.ambiguous}, 未マッチ=${stats.no_match}, 類似度自動採用=0`,
);
console.log(`総レコード数: ${results.length}`);
console.log(`新規 (is_new=true): ${newCount}`);
console.log(`  うち目視監査済み: ${auditedNewCount}`);
console.log(`  うち未監査: ${unreviewedNewCount}`);
console.log(`既存 (is_new=false): ${matchedCount - newCount}`);
console.log(`除外 (manual denylist): ${deniedCount}`);

// ===================================================================
// 8. JSON 出力
// ===================================================================
fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
const report = {
  schema_version: 3,
  mode: 'candidate_ledger_only_no_csv_writes',
  source: {
    reference: '日本産カミキリムシ',
    ocr_sha256: createHash('sha256').update(ocrText).digest('hex'),
    hostplant_section: {
      heading_line: headingIndex + 1,
      first_family_line: startIndex + 1,
      end_line_exclusive: endIndex + 1,
    },
  },
  safety: {
    fuzzy_automatic_matching: false,
    ambiguous_exact_names_automatically_applied: false,
    reviewed_crosswalk_may_override_derived_base_alias_only: true,
    derived_base_candidates_require_index_and_taxon_account_review: true,
    new_candidates_require_source_review_before_csv_application: true,
  },
  summary: {
    exact_matches: stats.exact,
    reviewed_source_crosswalk_matches: stats.reviewed_crosswalk,
    reviewed_derived_alias_overrides: reviewedDerivedAliasOverrideCount,
    ambiguous_exact_names: stats.ambiguous,
    unresolved_names: stats.no_match,
    denied_pairs: deniedCount,
    total_results: results.length,
    matched_results: matchedCount,
    new_candidates: newCount,
    audited_new_candidates: auditedNewCount,
    unreviewed_new_candidates: unreviewedNewCount,
  },
  results,
};
fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2), 'utf8');
console.log(`\n出力完了: ${OUT_JSON}`);
console.log(`  総エントリ数: ${results.length}`);
console.log(`  新規 (is_new=true): ${newCount}`);

// --- サンプル表示 ---
console.log('\n--- 新規エントリ (is_new=true) サンプル ---');
results.filter(r => r.is_new && r.insect_id).slice(0, 15).forEach(r => {
  const fuzzy = r.matched_name ? ` (OCR:"${r.matched_name}")` : '';
  console.log(`  ${r.insect_id} ${r.insect_name}${fuzzy} / ${r.plant_name} (${r.plant_family}) sc=${r.match_score}`);
});

console.log('\n--- 未マッチ サンプル ---');
results.filter(r => r.note === 'no_match').slice(0, 15).forEach(r => {
  console.log(`  "${r.insect_name}" / ${r.plant_name}`);
});

console.log('\n--- 曖昧な完全一致（自動採用せず隔離）サンプル ---');
results.filter(r => r.note === 'ambiguous_exact_name').slice(0, 15).forEach(r => {
  console.log(`  OCR:"${r.insect_name}" candidates=${r.possible_ids.join(',')} / ${r.plant_name}`);
});

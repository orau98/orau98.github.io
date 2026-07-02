import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { isValidPlantName, normalizePlantNameLite, cleanString } from '../scripts/lib/dataLiteBuilders.mjs';
import { parseCsv, toObjects } from '../scripts/lib/csvQuality.mjs';

// ---------------------------------------------------------------------------
// 1. isValidPlantName の回帰
//    過去に「広告プレビューでページが見つかりません」障害を起こした不正な植物名
//    （CLAUDE.md記載）を確実に弾き続けること、正当な植物名は通し続けることを固定する。
// ---------------------------------------------------------------------------
test('isValidPlantName は既知の不正な植物名（広告プレビュー障害の原因）を弾く', () => {
  const invalid = [
    '',
    '不明',
    'キョウチクトウ科が', // 「科が」で終わる（障害の代表例）
    'アブラナ科(オオアラセイトウ', // 閉じ括弧のない括弧（障害の代表例）
    '記録',
    '記録）',
    'が記録',
    'が記録）',
    '）オオアラセイトウ', // 閉じ括弧で始まる（括弧の後半のみ）
    '（オオアラセイトウ', // 開き括弧で始まり閉じない
    'Spiraea nipponica(本州', // 学名＋未閉じ括弧
    '葉', // 部位名（植物名ではない）
    '茎と葉裏',
    'アブラナ科その他の草本など多種の植物', // 説明文
    'から記録された',
    '飼育下で得られる',
    'Molinia japonica', // 純ラテン学名（日本語なし）
    'Carex sp', // 分類補助トークン
    '123',
    '1953',
  ];
  for (const name of invalid) {
    assert.equal(isValidPlantName(name), false, `「${name}」は無効判定されるべき`);
  }
});

test('isValidPlantName は正当な植物名を通す', () => {
  const valid = ['ソメイヨシノ', 'カマツカ', 'ブナ', 'イロハモミジ', 'コナラ', 'ミズキ', 'キャベツ', 'ヨモギ'];
  for (const name of valid) {
    assert.equal(isValidPlantName(name), true, `「${name}」は有効判定されるべき`);
  }
});

// ---------------------------------------------------------------------------
// 2. hostplants.csv の構造・参照整合性（audit-csv-quality.mjs の不変条件）
// ---------------------------------------------------------------------------
const ROOT = path.join(import.meta.dirname, '..');
const readText = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const hostParsed = parseCsv(readText('normalized_data/hostplants.csv'));
const hostRows = toObjects(hostParsed);
const insectRows = toObjects(parseCsv(readText('normalized_data/insects.csv')));
const noteRows = toObjects(parseCsv(readText('normalized_data/general_notes.csv')));
const insectIds = new Set(insectRows.map((r) => cleanString(r.insect_id)).filter(Boolean));

const ylist = JSON.parse(readText('normalized_data/ylist-lite.json'));
const YL_PLANTS = ylist.plants || {};
const YL_FAMILIES = new Set(Object.keys(ylist.familiesMap || {}));

// YListが権威的に科名を裁定できず統一を保留した同名異物（homonym）等。
// これらは family 整合チェックから除外する（レポートで別途追跡）。
const FAMILY_CHECK_EXCEPTIONS = new Set([]);

test('hostplants.csv の record_id は一意', () => {
  const seen = new Map();
  for (const r of hostRows) {
    const id = cleanString(r.record_id);
    if (!id) continue;
    seen.set(id, (seen.get(id) || 0) + 1);
  }
  const dups = [...seen.entries()].filter(([, c]) => c > 1).map(([id]) => id);
  assert.deepEqual(dups, [], `重複 record_id: ${dups.slice(0, 10).join(', ')}`);
});

test('hostplants.csv の全行が想定列数', () => {
  const expected = hostParsed.header.length;
  const bad = hostParsed.records
    .slice(1)
    .map((rec, i) => ({ i: i + 1, cols: rec.fields.length }))
    .filter((x) => x.cols !== expected);
  assert.deepEqual(bad, [], `列数不整合の行: ${JSON.stringify(bad.slice(0, 5))}`);
});

test('hostplants / general_notes の insect_id は insects.csv に存在する', () => {
  const orphanHost = [...new Set(hostRows.map((r) => cleanString(r.insect_id)))].filter((id) => id && !insectIds.has(id));
  const orphanNotes = [...new Set(noteRows.map((r) => cleanString(r.insect_id)))].filter((id) => id && !insectIds.has(id));
  assert.deepEqual(orphanHost, [], `孤立 hostplants insect_id: ${orphanHost.slice(0, 10).join(', ')}`);
  assert.deepEqual(orphanNotes, [], `孤立 general_notes insect_id: ${orphanNotes.slice(0, 10).join(', ')}`);
});

// ---------------------------------------------------------------------------
// 3. 科名整合: YListの直接正準（別名でない）植物の plant_family は YList権威値に一致
//    （audit-csv-quality.mjs --fix が保証する不変条件。科名衝突の再発を防ぐ）
// ---------------------------------------------------------------------------
test('YList正準植物の plant_family は YList権威の科名に一致する', () => {
  const directFamily = (name) => {
    for (const c of [cleanString(name), normalizePlantNameLite(name)].filter(Boolean)) {
      if (YL_PLANTS[c]) return YL_PLANTS[c].familyJp || '';
    }
    return '';
  };
  const isGenusToken = (v) => /属$/.test(cleanString(v));
  const violations = [];
  for (const r of hostRows) {
    const name = cleanString(r.plant_name);
    const fam = cleanString(r.plant_family);
    if (!name || !fam || isGenusToken(fam)) continue;
    if (FAMILY_CHECK_EXCEPTIONS.has(name)) continue;
    const authoritative = directFamily(name);
    if (authoritative && authoritative !== fam) {
      violations.push(`${cleanString(r.record_id)}: ${name} = ${fam} (YList: ${authoritative})`);
    }
  }
  assert.deepEqual(violations, [], `科名不整合 ${violations.length}件:\n${violations.slice(0, 20).join('\n')}`);
});

// ---------------------------------------------------------------------------
// 4. public/ と normalized_data/ の hostplants.csv は同期している
// ---------------------------------------------------------------------------
test('public/hostplants.csv と normalized_data/hostplants.csv は一致する', () => {
  const pub = readText('public/hostplants.csv');
  const norm = readText('normalized_data/hostplants.csv');
  assert.equal(pub, norm, 'public と normalized_data の hostplants.csv が不一致（同期が必要）');
});

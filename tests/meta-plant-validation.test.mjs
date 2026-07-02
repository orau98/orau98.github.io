import test from 'node:test';
import assert from 'node:assert/strict';

import { isValidPlantName } from '../scripts/lib/dataLiteBuilders.mjs';

// isValidPlantName は「植物として表示・ページ化する価値のある名前か」を判定する。
// メタページ生成（scripts/generate-meta-pages.js）と data-lite 生成が共有し、
// 「SPA一覧には出るがメタページが無く外部からは404」という不整合を防ぐ中核ロジック。
// CLAUDE.md に記録された「広告プレビューでページが見つかりません」障害の再発防止のため、
// 実際に404を生んだ不正名パターンをここで固定する。

test('正当な和名の植物名は有効と判定される', () => {
  const valid = [
    'オニグルミ',
    'オニグルミ(クルミ科)',
    'ソメイヨシノ',
    'コナラ(ブナ科)',
    'ヤマザクラ',
    'イロハモミジ',
    'ススキ',
    'クヌギ(ブナ科)',
    'ハシバミ属', // 属レベルの和名は許容
  ];
  for (const name of valid) {
    assert.equal(isValidPlantName(name), true, `有効であるべき: ${name}`);
  }
});

test('CLAUDE.md記載の障害原因（不正な植物名）を無効と判定する', () => {
  // 実際に無効HTMLファイルを生成し「ページが見つかりません」を招いた名前
  const invalid = [
    'キョウチクトウ科が',        // 「科が」で終わる
    'アブラナ科(オオアラセイトウ', // 閉じ括弧が無い
    '記録',
    '記録）',
    'が記録',
    'が記録）',
  ];
  for (const name of invalid) {
    assert.equal(isValidPlantName(name), false, `無効であるべき: ${name}`);
  }
});

test('括弧の断片・記号始まりを無効と判定する', () => {
  const invalid = [
    '）本州',            // 閉じ括弧で始まる（括弧の後半のみ）
    '（オオアラセイトウ', // 開き括弧のみ・閉じない
    ',コウマゴヤシ',      // カンマ始まり
    '、ススキ',           // 読点始まり
    '-ドクダミ',          // ハイフン始まり
    'ーススキ',           // 長音始まり
    '(本州のみ)',         // 括弧内の説明だけ
  ];
  for (const name of invalid) {
    assert.equal(isValidPlantName(name), false, `無効であるべき: ${name}`);
  }
});

test('説明文・生態記述を植物名として無効と判定する', () => {
  const invalid = [
    'ススキを好む',
    'コナラの幼虫が食べる',
    '野外でクヌギに産卵',
    '日本では珍しい',
    'ヨーロッパでは害虫',
    'クワ科植物で。',        // 句点を含む
    'ヤナギで飼育した個体',
    'アブラムシによる被害',
    '5月上旬に発生',
    '6月頃に羽化',
  ];
  for (const name of invalid) {
    assert.equal(isValidPlantName(name), false, `無効であるべき: ${name}`);
  }
});

test('学名記号・分類トークン単体を無効と判定する', () => {
  // 旧 generate-meta-pages.js のローカルコピーは正規表現内の二重エスケープ（\\s）で
  // これらを取りこぼしていた。共有ライブラリ版で確実に弾けることを固定する。
  const invalid = [
    'sp.',
    'spp.',
    'var.',
    'subsp.',
    'comb. nov.',   // 二重エスケープバグでは弾けなかったケース
    'nom. nud.',    // 同上
    'cf.',
    'aff.',
  ];
  for (const name of invalid) {
    assert.equal(isValidPlantName(name), false, `無効であるべき: ${name}`);
  }
});

test('著者名・純ラテン断片を無効と判定する', () => {
  // 旧ローカルコピーは著者名パターンを \\s / \\d と二重エスケープしており機能していなかった。
  const invalid = [
    'Butler, 1878',
    'Motschulsky, 1866',
    'Carex sp',       // 純ラテンの属名断片（和名文字を含まない）
    'Corylus',        // 属名のみ・ラテン
    'Salix',
    '2020',           // 数字のみ
    '1878',
  ];
  for (const name of invalid) {
    assert.equal(isValidPlantName(name), false, `無効であるべき: ${name}`);
  }
});

test('空・不明・長さ外・非文字列を無効と判定する', () => {
  assert.equal(isValidPlantName(''), false);
  assert.equal(isValidPlantName('   '), false);
  assert.equal(isValidPlantName('不明'), false);
  assert.equal(isValidPlantName('ア'), false); // 1文字は短すぎる
  assert.equal(isValidPlantName('あ'.repeat(51)), false); // 50文字超
  assert.equal(isValidPlantName(null), false);
  assert.equal(isValidPlantName(undefined), false);
  assert.equal(isValidPlantName(12345), false);
});

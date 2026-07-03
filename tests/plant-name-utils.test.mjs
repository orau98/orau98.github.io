import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizePlantKey, extractPlantFamily } from '../src/utils/plantNameUtils.js';

test('normalizePlantKey strips trailing question marks used as notes', () => {
  assert.equal(normalizePlantKey('ヤブニッケイ？'), 'ヤブニッケイ');
  assert.equal(normalizePlantKey('ヤブニッケイ?'), 'ヤブニッケイ');
});

// extractPlantFamily は EnhancedHostPlantDisplay / integratedDataParser に
// 重複していたローカル実装を統合したもの。従来挙動（全角括弧のみ・非該当は空文字）
// を固定し、共通化によるリグレッションを防ぐ。
test('extractPlantFamily extracts the family from a full-width parenthetical note', () => {
  assert.equal(extractPlantFamily('モモ（バラ科）'), 'バラ科');
  assert.equal(extractPlantFamily('クサギ（シソ科）'), 'シソ科');
});

test('extractPlantFamily returns empty string when there is no family note', () => {
  assert.equal(extractPlantFamily('モモ'), '');
  assert.equal(extractPlantFamily(''), '');
});

test('extractPlantFamily preserves legacy behavior: half-width parens are not matched', () => {
  // 従来のローカル実装は全角括弧のみを対象としていた。挙動を変えないことを固定する。
  assert.equal(extractPlantFamily('モモ(バラ科)'), '');
});

test('extractPlantFamily is robust to non-string input', () => {
  assert.equal(extractPlantFamily(null), '');
  assert.equal(extractPlantFamily(undefined), '');
});

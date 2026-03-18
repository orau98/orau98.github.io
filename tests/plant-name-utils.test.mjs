import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizePlantKey, normalizePlantName } from '../src/utils/plantNameUtils.js';

test('normalizePlantKey strips trailing question marks used as notes', () => {
  assert.equal(normalizePlantKey('ヤブニッケイ？'), 'ヤブニッケイ');
  assert.equal(normalizePlantKey('ヤブニッケイ?'), 'ヤブニッケイ');
});

test('normalizePlantName strips trailing question marks used as notes', () => {
  assert.equal(normalizePlantName('ヤブニッケイ？'), 'ヤブニッケイ');
  assert.equal(normalizePlantName('ヤブニッケイ?'), 'ヤブニッケイ');
});

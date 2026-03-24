import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getReferenceMeta,
  getReferenceMetaList,
  getSourceLink,
  normalizeReference,
} from '../src/utils/sourceLinks.js';

test('normalizeReference canonicalizes 日本のキリガ to 日本の冬夜蛾', () => {
  assert.equal(normalizeReference('日本のキリガ'), '日本の冬夜蛾');
  assert.equal(normalizeReference('日本のキリガ p.12'), '日本の冬夜蛾');
});

test('getSourceLink resolves aliases to the canonical bibliography URL', () => {
  const canonicalUrl = 'https://www.mushi-sha.co.jp/shopdetail/000000000506/ct6/page1/recommend/';
  assert.equal(getSourceLink('日本のキリガ'), canonicalUrl);
  assert.equal(getSourceLink('日本の冬夜蛾'), canonicalUrl);
});

test('getReferenceMeta returns the canonical display label for aliases', () => {
  const meta = getReferenceMeta('日本のキリガ');
  assert.equal(meta.displayLabel, '日本の冬夜蛾');
  assert.match(meta.link || '', /000000000506/);
});

test('getReferenceMetaList merges 日本のキリガ into a single 日本の冬夜蛾 entry', () => {
  const metas = getReferenceMetaList(['日本の冬夜蛾', '日本のキリガ']);
  assert.equal(metas.length, 1);
  assert.equal(metas[0].displayLabel, '日本の冬夜蛾');
  assert.match(metas[0].link || '', /000000000506/);
});

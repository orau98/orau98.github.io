import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPageItems } from '../src/utils/pagination.js';

test('最初と最後のページは常に出し、離れた所だけ「…」にする', () => {
  assert.deepEqual(buildPageItems(1, 415, 3), [1, 2, 3, 'gap-end', 415]);
  assert.deepEqual(buildPageItems(200, 415, 3), [1, 'gap-start', 199, 200, 201, 'gap-end', 415]);
  assert.deepEqual(buildPageItems(415, 415, 3), [1, 'gap-start', 413, 414, 415]);
  assert.deepEqual(buildPageItems(1, 415, 5), [1, 2, 3, 4, 5, 'gap-end', 415]);
});

test('間が1ページだけなら「…」ではなく番号を出す', () => {
  assert.deepEqual(buildPageItems(3, 12, 3), [1, 2, 3, 4, 'gap-end', 12]);
  assert.deepEqual(buildPageItems(10, 12, 3), [1, 'gap-start', 9, 10, 11, 12]);
});

test('ページが少ないときは全部出す', () => {
  assert.deepEqual(buildPageItems(1, 1, 3), [1]);
  assert.deepEqual(buildPageItems(2, 4, 5), [1, 2, 3, 4]);
});

import assert from 'node:assert/strict';
import test from 'node:test';

import { resolvePlaceholderSubject } from '../src/utils/placeholderSubject.js';

test('写真なし表示は分類群に合うシルエットへ一意に対応する', () => {
  for (const type of [
    'beetle',
    'longhornbeetle',
    'barkbeetle',
    'leafbeetle',
    'aphid',
  ]) {
    assert.equal(resolvePlaceholderSubject(type), 'bug');
  }
  assert.equal(resolvePlaceholderSubject('plant'), 'sprout');
  assert.equal(resolvePlaceholderSubject('moth'), 'butterfly');
  assert.equal(resolvePlaceholderSubject('butterfly'), 'butterfly');
  assert.equal(resolvePlaceholderSubject('unknown'), 'butterfly');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { parseEmergenceTime, hasEmergencePeriods, shouldAnalyzeEmergenceHint } from '../src/utils/emergenceTime.js';

test('extracted emergence parser preserves empty, full-year and year-spanning periods', () => {
  assert.equal(hasEmergencePeriods('不明'), false);
  assert.deepEqual(parseEmergenceTime('周年').months, [1,2,3,4,5,6,7,8,9,10,11,12]);
  assert.deepEqual(parseEmergenceTime('10-12、1-5月').months, [1,2,3,4,5,10,11,12]);
  assert.equal(hasEmergencePeriods('5月上旬'), true);
  assert.equal(shouldAnalyzeEmergenceHint('成虫は春に出現'), true);
  assert.equal(shouldAnalyzeEmergenceHint('食草はアデク'), false);
});

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getObservationTypeCategory,
  getObservationTypePresentation,
  getObservationTypePriority,
  isDomesticObservationType,
} from '../src/utils/observationType.js';

test('literature geography types have specific visitor-facing labels', () => {
  assert.equal(getObservationTypePresentation('野外（国内）').label, '野外');
  assert.equal(getObservationTypePresentation('文献（国内・明記）').label, '国内');
  assert.equal(getObservationTypePresentation('文献（国内・論文範囲）').label, '国内推定');
  assert.equal(getObservationTypePresentation('文献（海外・明記）').label, '海外');
  assert.equal(getObservationTypePresentation('文献（地域不明）').label, '地域不明');
});

test('observation geography classification preserves certainty and sorting', () => {
  assert.equal(getObservationTypeCategory('野外（国内）'), 'domestic');
  assert.equal(getObservationTypeCategory('文献（国内・論文範囲）'), 'domesticInferred');
  assert.equal(isDomesticObservationType('文献（国内・明記）'), true);
  assert.equal(isDomesticObservationType('文献（地域不明）'), false);
  assert.ok(
    getObservationTypePriority('文献（国内・明記）') <
      getObservationTypePriority('文献（地域不明）'),
  );
});

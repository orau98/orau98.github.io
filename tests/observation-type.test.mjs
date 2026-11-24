import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getObservationTypeCategory,
  getObservationTypePresentation,
  getObservationTypePriority,
  getObservationRegion,
  groupObservationEvidence,
} from '../src/utils/observationType.js';

test('observation setting is independent of publication, geography and plant use', () => {
  const cases = [
    ['野外（国内）', 'field', '野外', '国内'],
    ['野外（海外）', 'field', '野外', '国外'],
    ['飼育', 'reared', '飼育', ''],
    ['文献（国内・明記）', 'unknown', '不明', '国内'],
    ['文献（国内・論文範囲）', 'unknown', '不明', '国内推定'],
    ['文献（海外・明記）', 'unknown', '不明', '国外'],
    ['文献（地域不明）', 'unknown', '不明', '地域不明'],
    ['文献', 'unknown', '不明', ''],
    ['後食', 'unknown', '不明', ''],
    ['採集植物', 'unknown', '不明', ''],
    ['国外', 'unknown', '不明', '国外'],
    ['', 'unknown', '不明', ''],
  ];
  for (const [value, category, label, regionLabel] of cases) {
    assert.equal(getObservationTypeCategory(value), category, value);
    const presentation = getObservationTypePresentation(value);
    assert.equal(presentation.label, label, value);
    assert.equal(presentation.regionLabel, regionLabel, value);
  }
});

test('each setting retains its own evidence and field records sort first', () => {
  const records = [
    { observationType: '文献（国内・明記）', reference: 'A' },
    { observationType: '飼育', reference: 'B' },
    { observationType: '野外（国内）', reference: 'C' },
    { observationType: '野外（国外）', reference: 'D' },
    { observationType: '野外（国内）', reference: 'E' },
  ];
  const groups = groupObservationEvidence(records);
  assert.deepEqual(groups.map((group) => group.key), ['field:domestic', 'field:overseas', 'reared:', 'unknown:domestic']);
  assert.deepEqual(groups.map((group) => group.records.map((record) => record.reference)), [['C', 'E'], ['D'], ['B'], ['A']]);
  assert.equal(getObservationRegion('文献（国内・論文範囲）'), 'domesticInferred');
  assert.ok(getObservationTypePriority('飼育') < getObservationTypePriority('文献（国内・明記）'));
});

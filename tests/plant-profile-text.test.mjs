import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizePlantProfileText,
} from '../src/utils/plantProfileText.js';

test('normalizePlantProfileText removes OCR spaces inside Japanese words', () => {
  assert.equal(
    normalizePlantProfileText('本州（宮 城県・新潟県以南）・四 国・九州'),
    '本州（宮城県・新潟県以南）・四国・九州',
  );
});



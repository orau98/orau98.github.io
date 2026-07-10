import assert from 'node:assert/strict';
import test from 'node:test';

import { buildPlantPath } from '../src/utils/siteTaxonomy.js';

test('plant detail links include the final slash required by GitHub Pages', () => {
  assert.equal(
    buildPlantPath('ブナ', 'ja'),
    '/plant/%E3%83%96%E3%83%8A/',
  );
  assert.equal(
    buildPlantPath('Fagus crenata', 'en'),
    '/en/plant/Fagus%20crenata/',
  );
});

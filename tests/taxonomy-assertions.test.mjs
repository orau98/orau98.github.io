import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

import Papa from 'papaparse';
import {
  TAXONOMY_ASSERTIONS,
  collectTaxonomyAssertionFailures,
} from '../scripts/lib/taxonomyAssertions.mjs';

const parseCsv = (filePath) => {
  const text = fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '');
  return Papa.parse(text, { header: true, skipEmptyLines: 'greedy' }).data || [];
};

test('source-backed taxonomy assertions match normalized insect data', () => {
  const rows = parseCsv('normalized_data/insects.csv');
  assert.deepEqual(collectTaxonomyAssertionFailures(rows), []);
});

test('taxonomy assertions reject old synonym as canonical name', () => {
  const assertion = TAXONOMY_ASSERTIONS.find((item) => item.insectId === '2');
  assert.ok(assertion);
  const failures = collectTaxonomyAssertionFailures([
    {
      insect_id: assertion.insectId,
      japanese_name: assertion.japaneseName,
      genus: 'Megopis',
      subgenus: '',
      species: 'formosana',
      subspecies: 'ishigakiana',
      author: 'Yoshinaga & Nakayama',
      year: '1972',
      scientific_name: 'Megopis formosana ishigakiana Yoshinaga & Nakayama, 1972',
      synonyms: assertion.expectedFields.scientific_name,
    },
  ]);
  assert.ok(failures.some((failure) => failure.field === 'scientific_name'));
  assert.ok(failures.some((failure) => failure.field === 'synonyms'));
});

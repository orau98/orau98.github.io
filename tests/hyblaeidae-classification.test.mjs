import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { parseCsv, toObjects } from '../scripts/lib/csvQuality.mjs';
import { convertNormalizedDataToStandardFormat } from '../src/utils/normalizedDataParser.js';
import { classifyInsectType, getPreviousInsectSection } from '../src/utils/siteTaxonomy.js';

test('Hyblaeidae are catalogued as moths while their former butterfly routes stay mapped', () => {
  const source = fs.readFileSync(new URL('../normalized_data/insects.csv', import.meta.url), 'utf8');
  const hyblaeidae = toObjects(parseCsv(source)).filter(({ family }) => family === 'Hyblaeidae');
  assert.equal(hyblaeidae.length, 3);
  const catalog = convertNormalizedDataToStandardFormat(hyblaeidae, [], []);
  assert.equal(catalog.butterflies.length, 0);
  assert.deepEqual(catalog.moths.map(({ id }) => id), hyblaeidae.map(({ insect_id }) => insect_id));
  for (const moth of catalog.moths) {
    assert.equal(moth.type, 'moth');
    assert.equal(getPreviousInsectSection(moth.id), 'butterfly');
  }
  assert.equal(classifyInsectType({ family: 'Hesperiidae', family_jp: 'セセリチョウ科' }), 'butterfly');
});

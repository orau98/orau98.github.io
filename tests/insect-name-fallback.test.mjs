import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeJapaneseInsectName,
  splitJapaneseNameAliases,
} from '../src/utils/insectNameAliases.js';
import { convertNormalizedDataToStandardFormat } from '../src/utils/normalizedDataParser.js';

test('missing Japanese names fall back to scientific names without a status label', () => {
  const converted = convertNormalizedDataToStandardFormat(
    [
      {
        insect_id: 'species-scientific-only',
        japanese_name: '（和名なし）',
        scientific_name: 'Testus scientificus Author, 2026',
        family: 'Cerambycidae',
        family_jp: 'カミキリムシ科',
      },
    ],
    [],
    [],
  );

  const target = converted.longhornbeetles.find(
    (insect) => insect.id === 'species-scientific-only',
  );
  assert.ok(target);
  assert.equal(target.name, 'Testus scientificus Author, 2026');
  assert.equal(target.name.includes('和名未記載'), false);
});

test('Japanese-name status placeholders are removed at the source boundary', () => {
  assert.equal(normalizeJapaneseInsectName('和名未記載'), '');
  assert.equal(normalizeJapaneseInsectName('（和名なし）'), '');
  assert.equal(
    normalizeJapaneseInsectName('Testus scientificus（和名未記載）'),
    'Testus scientificus',
  );
  assert.deepEqual(splitJapaneseNameAliases('（和名未記載）'), {
    name: '',
    aliases: [],
  });
});

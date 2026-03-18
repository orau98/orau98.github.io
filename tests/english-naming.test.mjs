import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildJapaneseReferenceLabel,
  ENGLISH_NAMING_NOTICE,
  getPrimaryEnglishName,
  slugifyScientificLabel,
  stripScientificAuthor,
} from '../scripts/lib/englishNaming.mjs';

test('stripScientificAuthor removes authorship suffix', () => {
  assert.equal(
    stripScientificAuthor('Micropterix aureatella (Scopoli, 1763)'),
    'Micropterix aureatella',
  );
});

test('slugifyScientificLabel produces SEO-friendly slugs', () => {
  assert.equal(
    slugifyScientificLabel('Micropterix aureatella (Scopoli, 1763)'),
    'micropterix-aureatella',
  );
});

test('getPrimaryEnglishName prefers scientific names', () => {
  assert.equal(
    getPrimaryEnglishName({
      scientificName: 'Micropterix aureatella',
      japaneseName: 'モンフタオビコバネ',
    }),
    'Micropterix aureatella',
  );
  assert.equal(
    getPrimaryEnglishName({
      scientificName: '',
      japaneseName: 'モンフタオビコバネ',
    }),
    'モンフタオビコバネ',
  );
});

test('buildJapaneseReferenceLabel and naming notice stay explicit', () => {
  assert.equal(
    buildJapaneseReferenceLabel('モンフタオビコバネ'),
    'Japanese name: モンフタオビコバネ',
  );
  assert.match(ENGLISH_NAMING_NOTICE, /Scientific names are used/);
});

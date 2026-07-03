import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildNormalizedEntries,
  resolveImageBaseCandidates,
} from '../src/utils/insectImageResolver.js';

test('resolveImageBaseCandidates keeps unresolved names by default for legacy callers', () => {
  assert.deepEqual(
    resolveImageBaseCandidates(['Missing_species'], {
      imageNames: new Set(),
      imageExtensions: {},
      normalizedEntries: [],
    }),
    ['Missing_species'],
  );
});

test('resolveImageBaseCandidates can omit unresolved names for no-image card fallbacks', () => {
  const imageNames = new Set(['Existing_species']);
  const imageExtensions = { Existing_species: '.jpg' };
  const normalizedEntries = buildNormalizedEntries(imageNames, imageExtensions);

  assert.deepEqual(
    resolveImageBaseCandidates(['Missing_species'], {
      imageNames,
      imageExtensions,
      normalizedEntries,
      includeUnresolved: false,
    }),
    [],
  );
});

test('resolveImageBaseCandidates still returns matching indexed image names when unresolved names are omitted', () => {
  const imageNames = new Set(['Existing_species_2']);
  const imageExtensions = { Existing_species_2: '.jpg' };
  const normalizedEntries = buildNormalizedEntries(imageNames, imageExtensions);

  assert.deepEqual(
    resolveImageBaseCandidates(['Existing species'], {
      imageNames,
      imageExtensions,
      normalizedEntries,
      includeUnresolved: false,
    }),
    ['Existing_species_2'],
  );
});

test('resolveImageBaseCandidates does not resolve symbol-only candidates to an unrelated first image', () => {
  // 記号のみの候補（正規化するとcompactが空になる）が、無関係な先頭画像へ
  // 誤解決しないことを固定する（compact空ガードの回帰防止）
  const imageNames = new Set(['Aaa_bbb', 'Ccc_ddd']);
  const imageExtensions = { Aaa_bbb: '.jpg', Ccc_ddd: '.jpg' };
  const normalizedEntries = buildNormalizedEntries(imageNames, imageExtensions);

  assert.deepEqual(
    resolveImageBaseCandidates(['（）'], {
      imageNames,
      imageExtensions,
      normalizedEntries,
      includeUnresolved: false,
    }),
    [],
  );
});

test('resolveImageBaseCandidates resolves Japanese image names with subspecies suffixes', () => {
  const imageNames = new Set([
    'オオミドリサルハムシ基亜種',
    'オナガミズアオ本州・九州亜種',
  ]);
  const imageExtensions = {
    オオミドリサルハムシ基亜種: '.jpg',
    オナガミズアオ本州・九州亜種: '.jpg',
  };
  const normalizedEntries = buildNormalizedEntries(imageNames, imageExtensions);

  assert.deepEqual(
    resolveImageBaseCandidates(['オオミドリサルハムシ'], {
      imageNames,
      imageExtensions,
      normalizedEntries,
      includeUnresolved: false,
    }),
    ['オオミドリサルハムシ基亜種'],
  );
  assert.deepEqual(
    resolveImageBaseCandidates(['オナガミズアオ'], {
      imageNames,
      imageExtensions,
      normalizedEntries,
      includeUnresolved: false,
    }),
    ['オナガミズアオ本州・九州亜種'],
  );
});

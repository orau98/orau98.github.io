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

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildInsectImageBaseCandidates,
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

test('buildInsectImageBaseCandidates includes old Japanese names for butterfly image lookup', () => {
  const imageNames = new Set(['ウスバシロチョウ']);
  const imageExtensions = { ウスバシロチョウ: '.jpg' };
  const normalizedEntries = buildNormalizedEntries(imageNames, imageExtensions);
  const candidates = buildInsectImageBaseCandidates({
    name: 'ウスバアゲハ',
    scientificName: 'Parnassius citrinarius Motschulsky, 1866',
    scientificFilename: 'Parnassius_citrinarius',
    alternativeNames: 'ウスバシロチョウ',
  });

  assert.deepEqual(
    resolveImageBaseCandidates(candidates, {
      imageNames,
      imageExtensions,
      normalizedEntries,
      includeUnresolved: false,
    }),
    ['ウスバシロチョウ'],
  );
});

test('buildInsectImageBaseCandidates includes scientific synonym filename aliases', () => {
  const imageNames = new Set(['Parnassius_glacialis']);
  const imageExtensions = { Parnassius_glacialis: '.jpg' };
  const normalizedEntries = buildNormalizedEntries(imageNames, imageExtensions);
  const candidates = buildInsectImageBaseCandidates({
    name: 'ウスバアゲハ',
    scientificName: 'Parnassius citrinarius Motschulsky, 1866',
    scientificFilename: 'Parnassius_citrinarius',
    synonyms: 'Parnassius glacialis Butler, 1866',
  });

  assert.deepEqual(
    resolveImageBaseCandidates(candidates, {
      imageNames,
      imageExtensions,
      normalizedEntries,
      includeUnresolved: false,
    }),
    ['Parnassius_glacialis'],
  );
});

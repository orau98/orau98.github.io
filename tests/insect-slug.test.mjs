import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildInsectPath,
  isLikelyInsectId,
  slugifyInsectName,
} from '../src/utils/insectSlug.js';

test('insect names use readable encoded routes when the name is path-safe', () => {
  const name = 'オオミズアオ';
  assert.equal(slugifyInsectName(name), encodeURIComponent(name));
  assert.equal(
    buildInsectPath({ id: 'species-0001', name, type: 'moth' }, 'ja'),
    `/moth/${encodeURIComponent(name)}`,
  );
});

test('insect names containing path delimiters fall back to the stable id', () => {
  const insect = {
    id: 'species-21296',
    name: 'オヒシバクロアブラムシ (ホ/モ/クロアブラムシ',
    type: 'aphid',
  };
  assert.equal(slugifyInsectName(insect.name), '');
  assert.equal(buildInsectPath(insect, 'ja'), '/aphid/species-21296');
  assert.equal(buildInsectPath(insect, 'en'), '/en/aphid/species-21296');
});

test('duplicate insect names use a generated unique route name', () => {
  const insect = {
    id: 'species-H027',
    name: 'キアシツブノミハムシ',
    routeName: 'species-H027',
    type: 'leafbeetle',
  };
  assert.equal(
    buildInsectPath(insect, 'ja'),
    '/leafbeetle/species-H027',
  );
  assert.equal(isLikelyInsectId('species-H027'), true);
  assert.equal(isLikelyInsectId('species-6131m'), true);
});

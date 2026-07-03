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

test('resolveImageBaseCandidates prefers exact matches over prefix-extended entries', () => {
  // 索引順に依存せず、完全一致（アゲハ）が接頭辞一致（アゲハ_2）より優先されること
  const imageNames = new Set(['アゲハ_2', 'アゲハ']);
  const imageExtensions = { アゲハ_2: '.jpg', アゲハ: '.jpg' };
  const normalizedEntries = buildNormalizedEntries(imageNames, imageExtensions);

  assert.deepEqual(
    resolveImageBaseCandidates(['アゲハ'], {
      imageNames,
      imageExtensions,
      normalizedEntries,
      includeUnresolved: false,
    }),
    ['アゲハ'],
  );
});

test('resolveImageBaseCandidates ignores punctuation-only candidates instead of matching everything', () => {
  // compact正規化で空文字になる候補が全エントリに前方一致してしまわないこと
  const imageNames = new Set(['Existing_species']);
  const imageExtensions = { Existing_species: '.jpg' };
  const normalizedEntries = buildNormalizedEntries(imageNames, imageExtensions);

  assert.deepEqual(
    resolveImageBaseCandidates(['・・・'], {
      imageNames,
      imageExtensions,
      normalizedEntries,
      includeUnresolved: false,
    }),
    [],
  );
});

test('resolveImageBaseCandidates reuses lookup structures across large candidate batches', () => {
  // 3000件規模の索引に対して多数の候補を解決しても実用時間で完了すること
  // （線形走査へ退行した場合はこのテストが大幅に遅くなる）
  const imageNames = new Set();
  const imageExtensions = {};
  for (let i = 0; i < 3000; i += 1) {
    const name = `Species_${String(i).padStart(4, '0')}`;
    imageNames.add(name);
    imageExtensions[name] = '.jpg';
  }
  const normalizedEntries = buildNormalizedEntries(imageNames, imageExtensions);

  const start = performance.now();
  for (let i = 0; i < 3000; i += 1) {
    resolveImageBaseCandidates([`missing candidate ${i}`, 'Species 0042'], {
      imageNames,
      imageExtensions,
      normalizedEntries,
      includeUnresolved: false,
    });
  }
  const elapsed = performance.now() - start;

  assert.deepEqual(
    resolveImageBaseCandidates(['Species 0042'], {
      imageNames,
      imageExtensions,
      normalizedEntries,
      includeUnresolved: false,
    }),
    ['Species_0042'],
  );
  // 旧実装（全件線形走査）ではこの規模で数秒かかる。十分に余裕を持った上限で退行を検知する
  assert.ok(elapsed < 1500, `resolution took too long: ${elapsed}ms`);
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

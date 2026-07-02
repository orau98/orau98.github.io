import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseGenusSpecies,
  sortInsectsTaxonomically,
  sortPlantNamesTaxonomically,
} from '../src/utils/taxonomicOrder.js';

test('parseGenusSpecies extracts genus and species, skipping subgenus and author', () => {
  assert.deepEqual(parseGenusSpecies('Micropterix aureatella (Scopoli, 1763)'), {
    genus: 'Micropterix',
    species: 'aureatella',
  });
  assert.deepEqual(
    parseGenusSpecies('Acmaeodera (Cobosiella) luzonica Nonfried, 1895'),
    { genus: 'Acmaeodera', species: 'luzonica' },
  );
  assert.deepEqual(parseGenusSpecies('Fomoria sp. of Oku, 2003'), {
    genus: 'Fomoria',
    species: '',
  });
  assert.deepEqual(parseGenusSpecies(''), { genus: '', species: '' });
});

test('sortInsectsTaxonomically groups congeners and keeps insect groups blocked', () => {
  const insects = [
    { id: '3', name: 'ベータ', type: 'moth', scientificName: 'Aaa zeta', classification: { family: 'Zetidae' } },
    { id: '1', name: 'アルファ', type: 'moth', scientificName: 'Aaa alpha', classification: { family: 'Aidae' } },
    { id: '2', name: 'ガンマ', type: 'moth', scientificName: 'Aaa beta', classification: { family: 'Aidae' } },
    { id: '9', name: 'カブト', type: 'beetle', scientificName: 'Aaa alpha', classification: { family: 'Aidae' } },
  ];
  const sorted = sortInsectsTaxonomically(insects).map((i) => i.id);
  // moth ブロックが先、その中は科(Aidae→Zetidae)→種小名(alpha→beta)、beetle は最後
  assert.deepEqual(sorted, ['1', '2', '3', '9']);
});

test('sortInsectsTaxonomically orders congeners by species within same genus', () => {
  const insects = [
    { id: 'b', name: 'B', type: 'moth', scientificName: 'Papilio machaon', classification: { family: 'Papilionidae', subfamily: 'Papilioninae' } },
    { id: 'a', name: 'A', type: 'moth', scientificName: 'Papilio bianor', classification: { family: 'Papilionidae', subfamily: 'Papilioninae' } },
    { id: 'c', name: 'C', type: 'moth', scientificName: 'Papilio xuthus', classification: { family: 'Papilionidae', subfamily: 'Papilioninae' } },
  ];
  const sorted = sortInsectsTaxonomically(insects).map((i) => i.id);
  assert.deepEqual(sorted, ['a', 'b', 'c']); // bianor < machaon < xuthus
});

test('sortPlantNamesTaxonomically groups by family then genus, unknowns last', () => {
  const plantDetails = {
    スギ: { familyLatin: 'Cupressaceae', genus: 'Cryptomeria', scientificName: 'Cryptomeria japonica' },
    ヒノキ: { familyLatin: 'Cupressaceae', genus: 'Chamaecyparis', scientificName: 'Chamaecyparis obtusa' },
    ブナ: { familyLatin: 'Fagaceae', genus: 'Fagus', scientificName: 'Fagus crenata' },
    ナゾクサ: {}, // 分類情報なし
  };
  const sorted = sortPlantNamesTaxonomically(
    ['ブナ', 'スギ', 'ナゾクサ', 'ヒノキ'],
    plantDetails,
  );
  // Cupressaceae(Chamaecyparis→Cryptomeria) → Fagaceae → 分類なし
  assert.deepEqual(sorted, ['ヒノキ', 'スギ', 'ブナ', 'ナゾクサ']);
});

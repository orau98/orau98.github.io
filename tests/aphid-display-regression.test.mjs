import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildInsectPath } from '../src/utils/insectSlug.js';
import { formatInsectScientificNameHTML, insectHeadingName, splitInsectScientificName } from '../src/utils/insectScientificName.js';

import { convertNormalizedDataToStandardFormat } from '../src/utils/normalizedDataParser.js';

test('blank aphid stages stay unspecified and are not misclassified as adult flower visits', () => {
  const converted = convertNormalizedDataToStandardFormat(
    [{
      insect_id: 'species-aphid-test',
      japanese_name: 'テストアブラムシ',
      scientific_name: 'Aphis testus',
      family: 'Aphididae',
      family_jp: 'アブラムシ科',
      genus: 'Aphis',
      species: 'testus',
    }],
    [{
      record_id: 'hostplant-aphid-test',
      insect_id: 'species-aphid-test',
      plant_name: 'テスト植物',
      plant_family: 'キク科',
      observation_type: '文献',
      plant_part: '茎、花梗',
      life_stage: '',
      reference: '日本原色アブラムシ図鑑',
      notes: 'コロニーは大きい',
    }],
    [],
  );

  const aphid = converted.aphids.find(item => item.id === 'species-aphid-test');
  assert.ok(aphid);
  assert.equal(aphid.type, 'aphid');
  assert.equal(aphid.hostPlantsDetailed.length, 1);
  assert.equal(aphid.hostPlantsDetailed[0].lifeStage, '');
  assert.equal(aphid.hostPlantsDetailed[0].isFlowerVisit, false);
});

test('repaired aphid authorship stays outside the name, without breaking its published address', () => {
  const csv = fs.readFileSync(new URL('../normalized_data/insects.csv', import.meta.url), 'utf8');
  assert.match(csv, /^species-21188,.*?,quercus,,Takahashi,1918,クヌギトゲアブラムシ,,,,"Cervaphis quercus Takahashi, 1918",/m);
  const { aphids } = convertNormalizedDataToStandardFormat([{
    insect_id: 'species-21188',
    family: 'Aphididae',
    japanese_name: 'クヌギトゲアブラムシ',
    scientific_name: 'Cervaphis quercus Takahashi, 1918',
    genus: 'Cervaphis',
    species: 'quercus',
    author: 'Takahashi',
    year: '1918',
  }], [], []);
  assert.equal(aphids[0].name, 'クヌギトゲアブラムシ');
  assert.equal(buildInsectPath(aphids[0], 'ja'), '/aphid/Cervaphis%20quercus%20Takahashi/');
  assert.equal(insectHeadingName('Cervaphis quercus Takahashi', aphids[0].scientificName), 'Cervaphis quercus');
  assert.equal(formatInsectScientificNameHTML(aphids[0].scientificName), '<em>Cervaphis</em> <em>quercus</em> <span class="sci-author">Takahashi, 1918</span>');
});

test('subgenera and subspecies stay italicised while author particles stay with authorship', () => {
  assert.equal(splitInsectScientificName('Cerataphis freycinetiae van der Goot, 1917').authority, 'van der Goot, 1917');
  const input = 'Acmaeodera (Cobosiella) luzonica insularis (F. Author, [1895])';
  assert.equal(splitInsectScientificName(input).name, 'Acmaeodera (Cobosiella) luzonica insularis');
  assert.equal(splitInsectScientificName(input).authority, '(F. Author, [1895])');
  assert.match(formatInsectScientificNameHTML(input), /<em>insularis<\/em> <span class="sci-author">/);
  assert.equal(formatInsectScientificNameHTML('Aphis sp. 1'), 'Aphis sp. 1');
});

test('an unplaced subgenus marker stays upright and does not absorb the author', () => {
  const name = 'Chrysolina (?) seriepunctata (Weise, 1887)';
  assert.equal(splitInsectScientificName(name).authority, '(Weise, 1887)');
  assert.equal(
    formatInsectScientificNameHTML(name),
    '<em>Chrysolina</em> (?) <em>seriepunctata</em> <span class="sci-author">(Weise, 1887)</span>',
  );
});

test('a year fragment in a Japanese name is repaired without changing the published address', () => {
  const csv = fs.readFileSync(new URL('../normalized_data/insects.csv', import.meta.url), 'utf8');
  assert.doesNotMatch(csv, /^species-[^,]+,(?:[^,]*,){12}\d{4}\),/m);
  assert.match(csv, /^species-21325,.*?,kerriae,,\(Shinji\),1930,ヤマブキヒゲナガアブラムシ,,,,"Aulacorthum kerriae \(Shinji, 1930\)",/m);
  assert.match(csv, /^species-5600,.*?,cheiranthi,abrostoloides,Butler,1879,ムラサキウワバ,,,,"Plusidia cheiranthi abrostoloides Butler, 1879",/m);
  const { aphids } = convertNormalizedDataToStandardFormat([{
    insect_id: 'species-21325',
    family: 'Aphididae',
    japanese_name: 'ヤマブキヒゲナガアブラムシ',
    scientific_name: 'Aulacorthum kerriae (Shinji, 1930)',
    genus: 'Aulacorthum',
    species: 'kerriae',
    author: '(Shinji)',
    year: '1930',
  }], [], []);
  assert.equal(aphids[0].name, 'ヤマブキヒゲナガアブラムシ');
  assert.equal(buildInsectPath(aphids[0], 'ja'), '/aphid/Aulacorthum%20kerriae/');
});

test('provisional identification citations never become publication years', () => {
  const csv = fs.readFileSync(new URL('../normalized_data/insects.csv', import.meta.url), 'utf8');
  const en = csv.split(/\r?\n/).find(line => line.startsWith('species-0042,'));
  assert.match(en, /,Enteucha,,sp\.,,,,ミズヒキモグリチビガ,/);
  assert.match(en, /,Enteucha sp\.,/);
  assert.match(en, /Owada et al\. 2006/);
  const { moths } = convertNormalizedDataToStandardFormat([{
    insect_id: 'species-20467',
    family: 'Nepticulidae',
    scientific_name: 'Stigmella sp. 1',
    old_japanese_name: 'ソトグロヒメハマキ',
  }], [], []);
  assert.equal(decodeURIComponent(buildInsectPath(moths[0], 'ja')), '/moth/ソトグロヒメハマキ/');
});

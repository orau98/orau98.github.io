import test from 'node:test';
import assert from 'node:assert/strict';

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

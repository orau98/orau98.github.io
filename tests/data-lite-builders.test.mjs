import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildFlowerVisitPlantDataset,
  buildHostPlantDataset,
} from '../scripts/lib/dataLiteBuilders.mjs';

test('buildHostPlantDataset canonicalizes aliases and excludes flower visits from host plants', () => {
  const ylistLite = {
    aliasToCanonical: {
      ヤナギ類: 'ヤナギ',
    },
    plants: {
      ヤナギ: {
        familyJp: 'ヤナギ科',
        familyEn: 'Salicaceae',
        orderJp: 'キントラノオ目',
        orderEn: 'Malpighiales',
        scientificName: 'Salix',
        aliases: ['ヤナギ類'],
      },
    },
  };

  const insects = [
    {
      name: 'ガA',
      hostPlantsDetailed: [
        { name: 'ヤナギ類', family: 'ヤナギ科', lifeStage: '幼虫', plantPart: '葉' },
      ],
    },
    {
      name: 'チョウB',
      hostPlantsDetailed: [
        { name: 'ヤナギ類', family: 'ヤナギ科', lifeStage: '成虫', plantPart: '花' },
      ],
    },
  ];

  const { hostPlantsMap, plantDetails } = buildHostPlantDataset(insects, ylistLite);

  assert.deepEqual(hostPlantsMap, {
    ヤナギ: ['ガA'],
  });
  assert.equal(plantDetails.ヤナギ.family, 'ヤナギ科');
  assert.equal(plantDetails.ヤナギ.scientificName, 'Salix');
  assert.ok(plantDetails.ヤナギ.aliases.includes('ヤナギ類'));
});

test('buildFlowerVisitPlantDataset canonicalizes aliases and sorts insect names', () => {
  const insects = [
    {
      name: 'チョウB',
      hostPlantsDetailed: [
        { name: 'ヤナギ類', lifeStage: '成虫', plantPart: '花' },
      ],
    },
    {
      name: 'ガA',
      hostPlantsDetailed: [
        { name: 'ヤナギ', lifeStage: '成虫', plantPart: '花' },
      ],
    },
  ];

  const flowerVisitPlants = buildFlowerVisitPlantDataset(insects, {
    aliasToCanonical: { ヤナギ類: 'ヤナギ' },
  });

  assert.deepEqual(flowerVisitPlants, {
    ヤナギ: ['ガA', 'チョウB'],
  });
});

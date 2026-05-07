import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildFlowerVisitPlantDataset,
  buildHostPlantDataset,
  isSuspiciousPlantName,
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

test('buildHostPlantDataset adds plant profiles even without linked insects', () => {
  const { hostPlantsMap, plantDetails } = buildHostPlantDataset([], {}, [
    {
      plant_name: 'クスノキ',
      scientific_name: 'Cinnamomum camphora',
      family: 'クスノキ科',
      family_latin: 'LAURACEAE',
      genus_scientific: 'Cinnamomum',
      habit: '常緑高木',
      flower_period: '5-6月',
      distribution: '本州・四国・九州・琉球に見られる',
      source: '日本の野生植物 第1巻',
      page: '70',
    },
  ]);

  assert.deepEqual(hostPlantsMap, {});
  assert.equal(plantDetails.クスノキ.family, 'クスノキ科');
  assert.equal(plantDetails.クスノキ.scientificName, 'Cinnamomum camphora');
  assert.equal(plantDetails.クスノキ.profile.habit, '常緑高木');
  assert.equal(plantDetails.クスノキ.profile.page, '70');
});

test('buildHostPlantDataset keeps the richest profile for duplicate plant names', () => {
  const { plantDetails } = buildHostPlantDataset([], {}, [
    {
      plant_name: 'クスノキ',
      scientific_name: 'Cinnamomum camphora',
      family: 'クスノキ科',
      family_latin: 'LAURACEAE',
      genus_scientific: 'Cinnamomum',
      habit: '常緑高木',
      source: '日本の野生植物 第1巻',
      page: '36',
    },
    {
      plant_name: 'クスノキ',
      scientific_name: 'Cinnamomum campbora',
      family: 'ハスノハギリ科',
      family_latin: 'HERNANDIACEAE',
      genus_scientific: 'Cinnamomum',
      source: '日本の野生植物 第1巻',
      page: '335',
    },
  ]);

  assert.equal(plantDetails.クスノキ.family, 'クスノキ科');
  assert.equal(plantDetails.クスノキ.scientificName, 'Cinnamomum camphora');
  assert.equal(plantDetails.クスノキ.profile.habit, '常緑高木');
  assert.equal(plantDetails.クスノキ.profile.page, '36');
});

test('buildHostPlantDataset ignores taxonomy-only plant profile fragments', () => {
  const { plantDetails } = buildHostPlantDataset([], {}, [
    {
      plant_name: 'クスノキ',
      scientific_name: 'Cinnamomum campbora',
      family: 'ハスノハギリ科',
      family_latin: 'HERNANDIACEAE',
      genus_scientific: 'Cinnamomum',
      source: '日本の野生植物 第1巻',
      page: '335',
    },
  ]);

  assert.equal(plantDetails.クスノキ, undefined);
});

test('buildHostPlantDataset prefers YList taxonomy over OCR profile taxonomy', () => {
  const { plantDetails } = buildHostPlantDataset([], {
    plants: {
      クスノキ: {
        familyJp: 'クスノキ科',
        familyEn: 'Lauraceae',
        orderJp: 'クスノキ目',
        orderEn: 'LAURALES',
        scientificName: 'Cinnamomum camphora',
        aliases: [],
      },
    },
  }, [
    {
      plant_name: 'クスノキ',
      scientific_name: 'Cinnamomum campbora',
      family: 'ハスノハギリ科',
      family_latin: 'HERNANDIACEAE',
      genus_scientific: 'Cinnamomum',
      habit: '常緑高木',
      source: '日本の野生植物 第1巻',
      page: '335',
    },
  ]);

  assert.equal(plantDetails.クスノキ.family, 'クスノキ科');
  assert.equal(plantDetails.クスノキ.familyLatin, 'Lauraceae');
  assert.equal(plantDetails.クスノキ.scientificName, 'Cinnamomum camphora');
  assert.equal(plantDetails.クスノキ.profile.habit, '常緑高木');
});

test('isSuspiciousPlantName filters fragmentary substrate notes but keeps coarse host groups', () => {
  assert.equal(isSuspiciousPlantName('の樹皮下'), true);
  assert.equal(isSuspiciousPlantName('ヤマザクラなどの枯れ木'), true);
  assert.equal(isSuspiciousPlantName('これらの植物と混生していれば'), true);
  assert.equal(isSuspiciousPlantName(',コウマゴヤシ'), true);
  assert.equal(isSuspiciousPlantName('アザミの一種'), false);
  assert.equal(isSuspiciousPlantName('コナラ属の一種'), false);
});

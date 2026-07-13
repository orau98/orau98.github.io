import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildFlowerVisitPlantDataset,
  buildHostPlantDataset,
  collectPlantPageNames,
  isNonPlantResourceName,
  isSuspiciousPlantName,
} from '../scripts/lib/dataLiteBuilders.mjs';

test('collectPlantPageNames includes audited profile-only plants for static pages', () => {
  assert.deepEqual(
    collectPlantPageNames(
      { クスノキ: ['アオスジアゲハ'] },
      {
        クスノキ: { profile: { distribution: '本州・四国・九州' } },
        グスクカンアオイ: { profile: { distinguishingFeatures: '花柱と雄蕊の数で区別する。' } },
        基本情報のみ: { profile: { distribution: '本州に分布する' } },
        空プロフィール: { profile: { distribution: '' } },
      },
    ),
    ['グスクカンアオイ', 'クスノキ'],
  );
});

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

test('buildHostPlantDataset keeps host records separate from YList aliases when families conflict', () => {
  const ylistLite = {
    aliasToCanonical: {
      タカノツメ: 'オノマンネングサ',
    },
    plants: {
      オノマンネングサ: {
        familyJp: 'ベンケイソウ科',
        familyEn: 'Crassulaceae',
        orderJp: 'ユキノシタ目',
        orderEn: 'Saxifragales',
        scientificName: 'Sedum lineare',
        aliases: ['タカノツメ'],
      },
    },
  };

  const insects = [
    {
      name: 'ホソトラカミキリ',
      hostPlantsDetailed: [
        { name: 'タカノツメ', family: 'ウコギ科', lifeStage: '幼虫', plantPart: '葉' },
      ],
    },
  ];

  const { hostPlantsMap, plantDetails } = buildHostPlantDataset(insects, ylistLite);

  assert.deepEqual(hostPlantsMap, {
    タカノツメ: ['ホソトラカミキリ'],
  });
  assert.equal(hostPlantsMap.オノマンネングサ, undefined);
  assert.equal(plantDetails.タカノツメ.family, 'ウコギ科');
  assert.equal(plantDetails.タカノツメ.scientificName, '');
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

test('plant indexes exclude non-plant larval resources', () => {
  const insects = [
    {
      name: 'ガA',
      hostPlantsDetailed: [
        { name: 'コナラ', family: 'ブナ科', lifeStage: '幼虫', plantPart: '葉', resourceType: 'plant' },
        { name: '枯れ葉', lifeStage: '幼虫', plantPart: '葉', resourceType: 'substrate' },
        { name: 'カワラタケ', family: 'サルノコシカケ科', lifeStage: '幼虫', plantPart: '葉' },
      ],
    },
    {
      name: 'ガB',
      hostPlantsDetailed: [
        { name: '枯れ葉', lifeStage: '成虫', plantPart: '花', resourceType: 'substrate' },
      ],
    },
  ];

  const { hostPlantsMap, plantDetails } = buildHostPlantDataset(insects);
  const flowerVisitPlants = buildFlowerVisitPlantDataset(insects);

  assert.deepEqual(hostPlantsMap, { コナラ: ['ガA'] });
  assert.equal(plantDetails.枯れ葉, undefined);
  assert.equal(plantDetails.カワラタケ, undefined);
  assert.deepEqual(flowerVisitPlants, {});
  assert.equal(isNonPlantResourceName('枯葉'), true);
  assert.equal(isNonPlantResourceName('カワラタケ'), true);
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
      similar_taxa: 'ヤブニッケイ',
      distinguishing_features: 'ヤブニッケイと比べ、葉裏は灰白色である。',
      printed_page: '138',
      source: '日本の野生植物 第1巻',
      page: '70',
    },
  ]);

  assert.deepEqual(hostPlantsMap, {});
  assert.equal(plantDetails.クスノキ.family, 'クスノキ科');
  assert.equal(plantDetails.クスノキ.scientificName, 'Cinnamomum camphora');
  assert.equal(plantDetails.クスノキ.profile.habit, '常緑高木');
  assert.equal(plantDetails.クスノキ.profile.page, '70');
  assert.equal(plantDetails.クスノキ.profile.printedPage, '138');
  assert.equal(plantDetails.クスノキ.profile.similarTaxa, 'ヤブニッケイ');
  assert.equal(
    plantDetails.クスノキ.profile.distinguishingFeatures,
    'ヤブニッケイと比べ、葉裏は灰白色である。',
  );
});

test('buildHostPlantDataset keeps an identification-only audited profile', () => {
  const { plantDetails } = buildHostPlantDataset([], {}, [
    {
      plant_name: 'シラネニンジン',
      distinguishing_features: 'ミヤマウイキョウと比べ、葉は3出せず2-3回羽状複葉になる。',
      similar_taxa: 'ミヤマウイキョウ',
      source: '日本の野生植物 第2巻',
      page: '307',
      printed_page: '612',
    },
  ]);

  assert.equal(
    plantDetails.シラネニンジン.profile.distinguishingFeatures,
    'ミヤマウイキョウと比べ、葉は3出せず2-3回羽状複葉になる。',
  );
  assert.equal(plantDetails.シラネニンジン.profile.printedPage, '612');
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

test('buildHostPlantDataset keeps homonymous plant profiles separate from YList aliases', () => {
  const { plantDetails } = buildHostPlantDataset([], {
    aliasToCanonical: {
      タチガシワ: 'カシワ',
    },
    plants: {
      カシワ: {
        familyJp: 'ブナ科',
        familyEn: 'Fagaceae',
        orderJp: 'ブナ目',
        orderEn: 'FAGALES',
        scientificName: 'Quercus dentata',
        aliases: ['タチガシワ'],
      },
    },
  }, [
    {
      plant_name: 'タチガシワ',
      scientific_name: 'Vincetoxicum magnificum',
      family: 'キョウチクトウ科',
      family_latin: 'APOCYNACEAE',
      genus_jp: 'カモメヅル属',
      genus_scientific: 'Vincetoxicum',
      habit: '多年草',
      source: '日本の野生植物 第2巻',
      page: '162',
    },
  ]);

  assert.equal(plantDetails.タチガシワ.family, 'キョウチクトウ科');
  assert.equal(plantDetails.タチガシワ.scientificName, 'Vincetoxicum magnificum');
  assert.equal(plantDetails.タチガシワ.profile.genusJp, 'カモメヅル属');
  assert.equal(plantDetails.カシワ, undefined);
});

test('buildHostPlantDataset keeps a profile on its exact YList heading instead of an alias target', () => {
  const { plantDetails } = buildHostPlantDataset([], {
    aliasToCanonical: {
      ゴヨウマツ: 'ヒメコマツ',
    },
    plants: {
      ゴヨウマツ: {
        familyJp: 'マツ科',
        familyEn: 'Pinaceae',
        scientificName: 'Pinus parviflora',
        aliases: ['ヒメコマツ'],
      },
      ヒメコマツ: {
        familyJp: 'マツ科',
        familyEn: 'Pinaceae',
        scientificName: 'Pinus parviflora var. parviflora',
        aliases: ['ゴヨウマツ'],
      },
    },
  }, [
    {
      plant_name: 'ゴヨウマツ',
      scientific_name: 'Pinus parviflora var. parviflora',
      family: 'マツ科',
      family_latin: 'PINACEAE',
      habit: '常緑高木',
      similar_taxa: 'キタゴヨウ',
      distinguishing_features: '冬芽の先がとがる。',
      source: '日本の野生植物 第1巻',
      page: '20',
    },
  ]);

  assert.equal(plantDetails.ゴヨウマツ.profile.similarTaxa, 'キタゴヨウ');
  assert.equal(plantDetails.ゴヨウマツ.profile.distinguishingFeatures, '冬芽の先がとがる。');
  assert.equal(plantDetails.ヒメコマツ, undefined);
});

test('buildHostPlantDataset drops leaked Japanese genus names when Latin genus conflicts', () => {
  const { plantDetails } = buildHostPlantDataset([], {
    plants: {
      リンドウ: {
        familyJp: 'リンドウ科',
        familyEn: 'Gentianaceae',
        orderJp: 'リンドウ目',
        orderEn: 'GENTIANALES',
        scientificName: 'Gentiana scabra var. buergeri',
        aliases: [],
      },
    },
  }, [
    {
      plant_name: 'リンドウ',
      scientific_name: 'Gentiana scabra',
      family: 'アカネ科',
      family_latin: 'RUBIACEAE',
      genus_jp: 'センプリ属',
      genus_scientific: 'Swertia',
      habit: '多年草',
      source: '日本の野生植物 第2巻',
      page: '155',
    },
  ]);

  assert.equal(plantDetails.リンドウ.family, 'リンドウ科');
  assert.equal(plantDetails.リンドウ.genus, 'Gentiana');
  assert.equal(plantDetails.リンドウ.profile.genusJp, '');
});

test('buildHostPlantDataset corrects known OCR slips in Japanese genus names', () => {
  const { plantDetails } = buildHostPlantDataset([], {}, [
    {
      plant_name: 'ハコネウツギ',
      scientific_name: 'Weigela coraeensis',
      family: 'スイカズラ科',
      family_latin: 'CAPRIFOLIACEAE',
      genus_jp: 'タニウッギ属',
      genus_scientific: 'Weigela',
      habit: '落葉小高木',
      source: '日本の野生植物 第2巻',
      page: '316',
    },
  ]);

  assert.equal(plantDetails.ハコネウツギ.profile.genusJp, 'タニウツギ属');
});

test('isSuspiciousPlantName filters fragmentary substrate notes but keeps coarse host groups', () => {
  assert.equal(isSuspiciousPlantName('の樹皮下'), true);
  assert.equal(isSuspiciousPlantName('ヤマザクラなどの枯れ木'), true);
  assert.equal(isSuspiciousPlantName('これらの植物と混生していれば'), true);
  assert.equal(isSuspiciousPlantName(',コウマゴヤシ'), true);
  assert.equal(isSuspiciousPlantName('アザミの一種'), false);
  assert.equal(isSuspiciousPlantName('コナラ属の一種'), false);
});

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PLANT_TAXON_RANKS,
  QUIZ_MODES,
  buildQuizQuestions,
  getQuizHostPlantRecords,
  normalizeQuizMode,
} from '../src/utils/quiz.js';

const hostRecord = (name, family = 'ブナ科', extra = {}) => ({
  name,
  family,
  displayName: family ? `${name}（${family}）` : name,
  lifeStage: '幼虫',
  plantPart: '葉',
  reference: 'テスト図鑑',
  isFlowerVisit: false,
  ...extra,
});

const insect = ({
  id,
  name,
  type = 'moth',
  family = 'ヤガ科',
  subfamily = 'ヨトウガ亜科',
  plants = [],
  scientificFilename = '',
}) => ({
  id,
  name,
  type,
  scientificName: `Testus ${id}`,
  scientificFilename,
  classification: {
    familyJapanese: family,
    subfamilyJapanese: subfamily,
  },
  hostPlantsDetailed: plants,
});

const baseInsects = () => [
  insect({
    id: 'a',
    name: 'テストガA',
    plants: [
      hostRecord('コナラ', 'ブナ科'),
      hostRecord('花だけ', 'バラ科', {
        lifeStage: '成虫',
        plantPart: '花',
        isFlowerVisit: true,
      }),
      hostRecord('不明', '', { displayName: '不明' }),
    ],
  }),
  insect({ id: 'b', name: 'テストガB', plants: [hostRecord('クヌギ', 'ブナ科')] }),
  insect({ id: 'c', name: 'テストガC', plants: [hostRecord('サクラ', 'バラ科')] }),
  insect({ id: 'd', name: 'テストガD', plants: [hostRecord('ヤナギ', 'ヤナギ科')] }),
  insect({ id: 'e', name: 'テストチョウE', type: 'butterfly', plants: [hostRecord('スミレ', 'スミレ科')] }),
  insect({ id: 'x', name: '対象外甲虫', type: 'beetle', plants: [hostRecord('コナラ', 'ブナ科')] }),
];

test('normalizeQuizMode falls back to insect-to-plant', () => {
  assert.equal(normalizeQuizMode('plant-to-insect'), QUIZ_MODES.PLANT_TO_INSECT);
  assert.equal(normalizeQuizMode('bad-mode'), QUIZ_MODES.INSECT_TO_PLANT);
});

test('getQuizHostPlantRecords excludes flower visits and unknown placeholders', () => {
  const [sample] = baseInsects();
  assert.deepEqual(
    getQuizHostPlantRecords(sample).map((record) => record.name),
    ['コナラ'],
  );
});

test('insect-to-plant questions have four unique options and one true answer', () => {
  const questions = buildQuizQuestions({
    moths: baseInsects(),
    butterflies: [],
    mode: QUIZ_MODES.INSECT_TO_PLANT,
    questionCount: 1,
    seed: 'insect-to-plant-test',
    reviewKeys: [`${QUIZ_MODES.INSECT_TO_PLANT}:a:コナラ`],
  });

  assert.equal(questions.length, 1);
  const [question] = questions;
  assert.equal(question.prompt.insectId, 'a');
  assert.equal(question.options.length, 4);
  assert.equal(new Set(question.options.map((option) => option.id)).size, 4);
  assert.equal(question.options.filter((option) => option.id === question.correctOptionId).length, 1);
  assert.equal(question.options.find((option) => option.id === question.correctOptionId).label, 'コナラ');
  assert.ok(!question.options.some((option) => option.label === '花だけ' || option.label === '不明'));
});

test('plant family is filled from plantDetails when source record family is blank', () => {
  const questions = buildQuizQuestions({
    moths: [
      insect({
        id: 'blank-family',
        name: '科なし食草ガ',
        plants: [hostRecord('キンギンボク', '', { displayName: 'キンギンボク' })],
      }),
      ...baseInsects().slice(1, 5),
    ],
    plantDetails: {
      キンギンボク: {
        name: 'キンギンボク',
        family: 'スイカズラ科',
        familyName: 'スイカズラ科',
        aliases: ['ヒョウタンボク'],
      },
    },
    mode: QUIZ_MODES.INSECT_TO_PLANT,
    questionCount: 1,
    seed: 'plant-family-fill-test',
    reviewKeys: [`${QUIZ_MODES.INSECT_TO_PLANT}:blank-family:キンギンボク`],
  });

  const [question] = questions;
  const correct = question.options.find((option) => option.id === question.correctOptionId);
  assert.equal(correct.label, 'キンギンボク');
  assert.equal(correct.subtitle, 'スイカズラ科');
  assert.equal(question.explanation.sourceRecords[0].family, 'スイカズラ科');
});

test('insect-to-plant choices keep plant taxon rank consistent for species questions', () => {
  const questions = buildQuizQuestions({
    moths: [
      insect({ id: 'species-target', name: '種階層テストガ', plants: [hostRecord('コナラ', 'ブナ科')] }),
      insect({ id: 'species-b', name: '種階層テストガB', plants: [hostRecord('クヌギ', 'ブナ科')] }),
      insect({ id: 'species-c', name: '種階層テストガC', plants: [hostRecord('サクラ', 'バラ科')] }),
      insect({ id: 'species-d', name: '種階層テストガD', plants: [hostRecord('ヤナギ', 'ヤナギ科')] }),
      insect({ id: 'family-noise', name: '科階層ノイズガ', plants: [hostRecord('マチン科', '')] }),
      insect({ id: 'genus-noise', name: '属階層ノイズガ', plants: [hostRecord('コナラ属', 'ブナ科')] }),
    ],
    mode: QUIZ_MODES.INSECT_TO_PLANT,
    questionCount: 1,
    seed: 'species-rank-consistency',
    reviewKeys: [`${QUIZ_MODES.INSECT_TO_PLANT}:species-target:コナラ`],
  });

  const [question] = questions;
  assert.equal(question.options.length, 4);
  assert.deepEqual(
    [...new Set(question.options.map((option) => option.taxonRank))],
    [PLANT_TAXON_RANKS.SPECIES],
  );
  assert.ok(!question.options.some((option) => option.label.endsWith('科') || option.label.endsWith('属')));
});

test('insect-to-plant choices keep plant taxon rank consistent for family questions', () => {
  const questions = buildQuizQuestions({
    moths: [
      insect({ id: 'family-target', name: '科階層テストガ', plants: [hostRecord('マチン科', '')] }),
      insect({ id: 'family-b', name: '科階層テストガB', plants: [hostRecord('ブナ科', '')] }),
      insect({ id: 'family-c', name: '科階層テストガC', plants: [hostRecord('バラ科', '')] }),
      insect({ id: 'family-d', name: '科階層テストガD', plants: [hostRecord('スミレ科', '')] }),
      insect({ id: 'species-noise', name: '種階層ノイズガ', plants: [hostRecord('コナラ', 'ブナ科')] }),
      insect({ id: 'genus-noise', name: '属階層ノイズガ', plants: [hostRecord('コナラ属', 'ブナ科')] }),
    ],
    mode: QUIZ_MODES.INSECT_TO_PLANT,
    questionCount: 1,
    seed: 'family-rank-consistency',
    reviewKeys: [`${QUIZ_MODES.INSECT_TO_PLANT}:family-target:マチン科`],
  });

  const [question] = questions;
  assert.equal(question.options.length, 4);
  assert.deepEqual(
    [...new Set(question.options.map((option) => option.taxonRank))],
    [PLANT_TAXON_RANKS.FAMILY],
  );
  assert.ok(question.options.every((option) => option.label.endsWith('科')));
  assert.ok(question.options.every((option) => option.subtitle === ''));
});

test('insect-to-plant choices keep plant taxon rank consistent for genus questions', () => {
  const questions = buildQuizQuestions({
    moths: [
      insect({ id: 'genus-target', name: '属階層テストガ', plants: [hostRecord('コナラ属', 'ブナ科')] }),
      insect({ id: 'genus-b', name: '属階層テストガB', plants: [hostRecord('サクラ属', 'バラ科')] }),
      insect({ id: 'genus-c', name: '属階層テストガC', plants: [hostRecord('スミレ属', 'スミレ科')] }),
      insect({ id: 'genus-d', name: '属階層テストガD', plants: [hostRecord('ヤナギ属', 'ヤナギ科')] }),
      insect({ id: 'species-noise', name: '種階層ノイズガ', plants: [hostRecord('コナラ', 'ブナ科')] }),
      insect({ id: 'family-noise', name: '科階層ノイズガ', plants: [hostRecord('ブナ科', '')] }),
    ],
    mode: QUIZ_MODES.INSECT_TO_PLANT,
    questionCount: 1,
    seed: 'genus-rank-consistency',
    reviewKeys: [`${QUIZ_MODES.INSECT_TO_PLANT}:genus-target:コナラ属`],
  });

  const [question] = questions;
  assert.equal(question.options.length, 4);
  assert.deepEqual(
    [...new Set(question.options.map((option) => option.taxonRank))],
    [PLANT_TAXON_RANKS.GENUS],
  );
  assert.ok(question.options.every((option) => option.label.endsWith('属')));
});

test('plant-to-insect questions exclude insects already linked to the prompt plant as distractors', () => {
  const questions = buildQuizQuestions({
    moths: baseInsects(),
    butterflies: [],
    mode: QUIZ_MODES.PLANT_TO_INSECT,
    questionCount: 1,
    seed: 'plant-to-insect-test',
    reviewKeys: [`${QUIZ_MODES.PLANT_TO_INSECT}:コナラ:a`],
  });

  assert.equal(questions.length, 1);
  const [question] = questions;
  assert.equal(question.prompt.plantName, 'コナラ');
  assert.equal(question.options.length, 4);
  assert.equal(new Set(question.options.map((option) => option.id)).size, 4);
  assert.equal(question.options.find((option) => option.id === question.correctOptionId).label, 'テストガA');
  assert.ok(!question.options.some((option) => option.label === '対象外甲虫'));
});

test('review candidates are prioritized without dominating a ten-question session', () => {
  const many = Array.from({ length: 14 }, (_, index) =>
    insect({
      id: `m${index}`,
      name: `復習テストガ${index}`,
      family: index < 7 ? 'ヤガ科' : 'シャクガ科',
      subfamily: index < 7 ? 'ヨトウガ亜科' : 'エダシャク亜科',
      plants: [hostRecord(`植物${index}`, index % 2 === 0 ? 'ブナ科' : 'バラ科')],
    }),
  );
  const reviewKeys = many.slice(0, 6).map(
    (item, index) => `${QUIZ_MODES.INSECT_TO_PLANT}:${item.id}:植物${index}`,
  );
  const questions = buildQuizQuestions({
    moths: many,
    mode: QUIZ_MODES.INSECT_TO_PLANT,
    questionCount: 10,
    seed: 'review-priority-test',
    reviewKeys,
  });

  const reviewQuestionCount = questions.filter((question) => reviewKeys.includes(question.reviewKey)).length;
  assert.equal(questions.length, 10);
  assert.ok(reviewQuestionCount >= 1);
  assert.ok(reviewQuestionCount <= 2);
});

test('quiz question selection prioritizes insects with registered photos', () => {
  const photoInsects = Array.from({ length: 6 }, (_, index) =>
    insect({
      id: `photo-${index}`,
      name: `写真ありテストガ${index}`,
      scientificFilename: `Photo_priority_${index}`,
      plants: [hostRecord(`写真植物${index}`, index % 2 === 0 ? 'ブナ科' : 'バラ科')],
    }),
  );
  const noPhotoInsects = Array.from({ length: 8 }, (_, index) =>
    insect({
      id: `plain-${index}`,
      name: `写真なしテストガ${index}`,
      plants: [hostRecord(`通常植物${index}`, index % 2 === 0 ? 'ヤナギ科' : 'スミレ科')],
    }),
  );
  const insectImageNames = new Set(photoInsects.map((item) => item.scientificFilename));

  const insectToPlant = buildQuizQuestions({
    moths: [...photoInsects, ...noPhotoInsects],
    mode: QUIZ_MODES.INSECT_TO_PLANT,
    questionCount: 6,
    seed: 'photo-priority-insect-to-plant',
    insectImageNames,
  });
  assert.equal(insectToPlant.length, 6);
  assert.ok(insectToPlant.every((question) => question.prompt.insectId.startsWith('photo-')));

  const plantToInsect = buildQuizQuestions({
    moths: [...photoInsects, ...noPhotoInsects],
    mode: QUIZ_MODES.PLANT_TO_INSECT,
    questionCount: 6,
    seed: 'photo-priority-plant-to-insect',
    insectImageNames,
  });
  assert.equal(plantToInsect.length, 6);
  assert.ok(plantToInsect.every((question) => question.explanation.insect.id.startsWith('photo-')));
});

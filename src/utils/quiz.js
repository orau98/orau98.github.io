import { globalJapaneseToScientificMapping } from './insectImageMappings.js';
import {
  buildInsectImageBaseCandidates,
  buildNormalizedEntries,
  resolveImageBaseCandidates,
} from './insectImageResolver.js';

export const QUIZ_MODES = Object.freeze({
  INSECT_TO_PLANT: 'insect-to-plant',
  PLANT_TO_INSECT: 'plant-to-insect',
});

export const DEFAULT_QUIZ_MODE = QUIZ_MODES.INSECT_TO_PLANT;
export const DEFAULT_QUIZ_LENGTH = 10;

const UNKNOWN_PLANT_RE =
  /^(不明|未知|不詳|未確認|未記載|なし|未登録|不詳種|不明種|（リスト無し）|\(リスト無し\)|リスト無し)$/;

const normalizeString = (value = '') => String(value || '').normalize('NFC').trim();

export const normalizeQuizMode = (mode) =>
  mode === QUIZ_MODES.PLANT_TO_INSECT || mode === QUIZ_MODES.INSECT_TO_PLANT
    ? mode
    : DEFAULT_QUIZ_MODE;

export const normalizePlantNameForQuiz = (plant = '') =>
  normalizeString(plant)
    .replace(/[（(][^）)]*科[^）)]*[）)]/g, '')
    .replace(/[（(]\s*[）)]/g, '')
    .trim();

const isUnknownPlantName = (plant) => {
  const normalized = normalizePlantNameForQuiz(plant);
  return !normalized || UNKNOWN_PLANT_RE.test(normalized);
};

const isTruthyFlag = (value) => value === true || String(value).toLowerCase() === 'true';

const isFlowerVisitLikeRecord = (record = {}) => {
  if (isTruthyFlag(record.isFlowerVisit)) return true;
  const lifeStage = normalizeString(record.lifeStage);
  const plantPart = normalizeString(record.plantPart).replace(/\s+/g, '');
  const observationType = normalizeString(record.observationType);
  if (observationType.includes('訪花')) return true;
  return lifeStage.includes('成虫') && plantPart.includes('花');
};

const isLarvalHostLikeRecord = (record = {}) => {
  if (isFlowerVisitLikeRecord(record)) return false;
  const lifeStage = normalizeString(record.lifeStage);
  if (!lifeStage) return true;
  if (lifeStage.includes('幼虫')) return true;
  return !lifeStage.includes('成虫');
};

export const getQuizHostPlantRecords = (insect = {}) => {
  const seen = new Set();
  const records = [];
  const detailedRecords = Array.isArray(insect.hostPlantsDetailed)
    ? insect.hostPlantsDetailed
    : [];

  detailedRecords.forEach((record) => {
    if (!record || !isLarvalHostLikeRecord(record)) return;
    const name = normalizePlantNameForQuiz(record.name || record.displayName);
    if (isUnknownPlantName(name)) return;
    const key = name;
    if (seen.has(key)) return;
    seen.add(key);
    records.push({
      name,
      family: normalizeString(record.family),
      displayName: normalizeString(record.displayName) || name,
      reference: normalizeString(record.reference),
      plantPart: normalizeString(record.plantPart),
      lifeStage: normalizeString(record.lifeStage),
      observationType: normalizeString(record.observationType),
      notes: normalizeString(record.notes),
    });
  });

  return records;
};

const hashSeed = (seed) => {
  let h = 2166136261;
  const input = String(seed || 'quiz-seed');
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const createRandom = (seed) => {
  let state = hashSeed(seed);
  return () => {
    state += 0x6D2B79F5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const shuffleWithRandom = (items, random) => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

const getFamily = (insect = {}) =>
  normalizeString(insect.classification?.familyJapanese || insect.classification?.family);

const getSubfamily = (insect = {}) =>
  normalizeString(insect.classification?.subfamilyJapanese || insect.classification?.subfamily);

const countPlantUse = (plantToInsects) => {
  const counts = new Map();
  plantToInsects.forEach((ids, plantName) => counts.set(plantName, ids.size));
  return counts;
};

const buildPlantDetailLookup = (plantDetails = {}) => {
  const lookup = new Map();
  Object.entries(plantDetails || {}).forEach(([key, detail]) => {
    if (!detail || typeof detail !== 'object') return;
    const names = [
      key,
      detail.name,
      ...(Array.isArray(detail.aliases) ? detail.aliases : []),
    ].map(normalizePlantNameForQuiz).filter(Boolean);
    names.forEach((name) => {
      if (!lookup.has(name)) lookup.set(name, detail);
    });
  });
  return lookup;
};

const enrichPlantRecord = (record, plantDetailLookup) => {
  const detail = plantDetailLookup.get(record.name) || {};
  const family = record.family || detail.familyName || detail.family || '';
  const displayName =
    record.displayName && (record.displayName.includes('科') || !family)
      ? record.displayName
      : family
        ? `${record.name}（${family}）`
        : record.displayName || record.name;
  return {
    ...record,
    family,
    displayName,
    scientificName: record.scientificName || detail.scientificName || '',
    order: record.order || detail.order || '',
  };
};

const toImageNameSet = (imageNames) => {
  if (imageNames instanceof Set) return imageNames;
  if (Array.isArray(imageNames)) return new Set(imageNames.map((name) => normalizeString(name)).filter(Boolean));
  return new Set();
};

const buildInsectImageLookup = ({ insectImageNames, insectImageExtensions } = {}) => {
  const imageNames = toImageNameSet(insectImageNames);
  const imageExtensions =
    insectImageExtensions && typeof insectImageExtensions === 'object'
      ? insectImageExtensions
      : {};
  const hasIndex = imageNames.size > 0 || Object.keys(imageExtensions).length > 0;
  return {
    hasIndex,
    imageNames,
    imageExtensions,
    normalizedEntries: hasIndex ? buildNormalizedEntries(imageNames, imageExtensions) : [],
  };
};

const hasRegisteredInsectImage = (insect, imageLookup) => {
  if (!imageLookup?.hasIndex || !insect) return false;
  const mappedFilename = globalJapaneseToScientificMapping.get(insect.name);
  const candidateBases = buildInsectImageBaseCandidates(insect, mappedFilename);
  const resolvedBases = resolveImageBaseCandidates(candidateBases, {
    imageExtensions: imageLookup.imageExtensions,
    imageNames: imageLookup.imageNames,
    normalizedEntries: imageLookup.normalizedEntries,
  });
  return resolvedBases.some((base) =>
    Boolean(imageLookup.imageExtensions?.[base]) ||
    Boolean(imageLookup.imageNames?.has?.(base)),
  );
};

const buildRelationships = ({
  moths = [],
  butterflies = [],
  plantDetails = {},
  insectImageNames,
  insectImageExtensions,
} = {}) => {
  const plantDetailLookup = buildPlantDetailLookup(plantDetails);
  const imageLookup = buildInsectImageLookup({ insectImageNames, insectImageExtensions });
  const insects = [...(moths || []), ...(butterflies || [])]
    .filter((insect) => insect && (insect.type === 'moth' || insect.type === 'butterfly'))
    .map((insect) => ({
      ...insect,
      quizHasImage: hasRegisteredInsectImage(insect, imageLookup),
      quizHostPlantRecords: getQuizHostPlantRecords(insect).map((record) =>
        enrichPlantRecord(record, plantDetailLookup),
      ),
    }))
    .filter((insect) => insect.quizHostPlantRecords.length > 0);

  const insectById = new Map();
  const plantToInsects = new Map();
  const plantRecordDetails = new Map();
  const insectToPlants = new Map();
  const familyToPlants = new Map();
  const subfamilyToPlants = new Map();
  const familyToInsects = new Map();
  const subfamilyToInsects = new Map();

  insects.forEach((insect) => {
    const insectId = normalizeString(insect.id || insect.name);
    if (!insectId) return;
    insectById.set(insectId, insect);
    const insectPlantSet = new Set();
    const family = getFamily(insect);
    const subfamily = getSubfamily(insect);
    if (family) {
      if (!familyToInsects.has(family)) familyToInsects.set(family, new Set());
      familyToInsects.get(family).add(insectId);
    }
    if (subfamily) {
      if (!subfamilyToInsects.has(subfamily)) subfamilyToInsects.set(subfamily, new Set());
      subfamilyToInsects.get(subfamily).add(insectId);
    }

    insect.quizHostPlantRecords.forEach((record) => {
      insectPlantSet.add(record.name);
      if (!plantToInsects.has(record.name)) plantToInsects.set(record.name, new Set());
      plantToInsects.get(record.name).add(insectId);
      if (!plantRecordDetails.has(record.name)) plantRecordDetails.set(record.name, record);
      if (family) {
        if (!familyToPlants.has(family)) familyToPlants.set(family, new Set());
        familyToPlants.get(family).add(record.name);
      }
      if (subfamily) {
        if (!subfamilyToPlants.has(subfamily)) subfamilyToPlants.set(subfamily, new Set());
        subfamilyToPlants.get(subfamily).add(record.name);
      }
    });
    insectToPlants.set(insectId, insectPlantSet);
  });

  return {
    insects,
    insectById,
    insectToPlants,
    plantToInsects,
    plantDetails: plantRecordDetails,
    familyToPlants,
    subfamilyToPlants,
    familyToInsects,
    subfamilyToInsects,
    plantUseCounts: countPlantUse(plantToInsects),
  };
};

const sortByScore = (items, scoreFn, random) =>
  [...items]
    .map((item) => ({ item, score: scoreFn(item), tie: random() }))
    .sort((a, b) => b.score - a.score || a.tie - b.tie)
    .map(({ item }) => item);

const buildSourceLabel = (record) =>
  [record.reference, record.lifeStage, record.plantPart].filter(Boolean).join(' / ');

const createOptionId = (prefix, value) =>
  `${prefix}:${normalizeString(value).replace(/\s+/g, '_')}`;

const buildInsectOption = (insect) => ({
  id: createOptionId('insect', insect.id || insect.name),
  type: 'insect',
  value: insect.id || insect.name,
  label: insect.name || insect.id,
  subtitle: insect.scientificName || '',
  family: getFamily(insect),
  insectId: insect.id,
  hasImage: Boolean(insect.quizHasImage),
});

const buildPlantOption = (record) => ({
  id: createOptionId('plant', record.name),
  type: 'plant',
  value: record.name,
  label: record.name,
  subtitle: record.family || '',
  family: record.family || '',
  plantName: record.name,
});

const buildInsectToPlantQuestionBases = (relationships) => {
  const {
    insects,
  } = relationships;

  return insects.flatMap((insect) => {
    const insectId = insect.id || insect.name;
    const family = getFamily(insect);
    const subfamily = getSubfamily(insect);

    return insect.quizHostPlantRecords.map((correctRecord) => ({
      id: `${QUIZ_MODES.INSECT_TO_PLANT}:${insectId}:${correctRecord.name}`,
      reviewKey: `${QUIZ_MODES.INSECT_TO_PLANT}:${insectId}:${correctRecord.name}`,
      mode: QUIZ_MODES.INSECT_TO_PLANT,
      subjectKey: insectId,
      hasImage: Boolean(insect.quizHasImage),
      insectId,
      insect,
      family,
      subfamily,
      correctRecord,
    }));
  });
};

const buildInsectToPlantQuestion = (base, relationships, random) => {
  const {
    plantDetails,
    insectToPlants,
    familyToPlants,
    subfamilyToPlants,
    plantUseCounts,
  } = relationships;
  const allPlantRecords = Array.from(plantDetails.values());
  const ownedPlants = insectToPlants.get(base.insectId) || new Set();
  const correctUsage = plantUseCounts.get(base.correctRecord.name) || 0;
  const distractors = sortByScore(
    allPlantRecords.filter((record) => !ownedPlants.has(record.name)),
    (record) => {
      let score = 0;
      if (base.subfamily && subfamilyToPlants.get(base.subfamily)?.has(record.name)) score += 45;
      if (base.family && familyToPlants.get(base.family)?.has(record.name)) score += 35;
      if (record.family && record.family === base.correctRecord.family) score += 20;
      const usage = plantUseCounts.get(record.name) || 0;
      score += Math.max(0, 16 - Math.abs(usage - correctUsage));
      return score;
    },
    random,
  ).slice(0, 3);

  if (distractors.length < 3) return null;
  const correctOption = buildPlantOption(base.correctRecord);
  return {
    id: base.id,
    reviewKey: base.reviewKey,
    mode: base.mode,
    subjectKey: base.subjectKey,
    prompt: {
      type: 'insect',
      title: base.insect.name,
      subtitle: base.insect.scientificName || '',
      family: base.family,
      insectId: base.insectId,
      insect: base.insect,
    },
    options: shuffleWithRandom([correctOption, ...distractors.map(buildPlantOption)], random),
    correctOptionId: correctOption.id,
    explanation: {
      correctLabel: base.correctRecord.name,
      sourceLabel: buildSourceLabel(base.correctRecord),
      sourceRecords: [base.correctRecord],
      insect: base.insect,
      plant: base.correctRecord,
    },
    detailLinks: {
      insect: base.insect,
      plantName: base.correctRecord.name,
    },
  };
};

const buildPlantToInsectQuestionBases = (relationships) => {
  const {
    insectById,
    plantToInsects,
    plantDetails,
  } = relationships;

  return Array.from(plantToInsects.entries()).flatMap(([plantName, relatedIds]) => {
    const plantRecord = plantDetails.get(plantName) || { name: plantName };
    return Array.from(relatedIds).map((correctInsectId) => {
      const correctInsect = insectById.get(correctInsectId);
      if (!correctInsect) return null;
      const family = getFamily(correctInsect);
      const subfamily = getSubfamily(correctInsect);
      return ({
        id: `${QUIZ_MODES.PLANT_TO_INSECT}:${plantName}:${correctInsectId}`,
        reviewKey: `${QUIZ_MODES.PLANT_TO_INSECT}:${plantName}:${correctInsectId}`,
        mode: QUIZ_MODES.PLANT_TO_INSECT,
        subjectKey: plantName,
        hasImage: Boolean(correctInsect.quizHasImage),
        plantName,
        plantRecord,
        correctInsectId,
        correctInsect,
        family,
        subfamily,
      });
    }).filter(Boolean);
  });
};

const buildPlantToInsectQuestion = (base, relationships, random) => {
  const {
    insects,
    insectToPlants,
    plantToInsects,
    familyToInsects,
    subfamilyToInsects,
  } = relationships;
  const correctHostCount = insectToPlants.get(base.correctInsectId)?.size || 0;
  const relatedToPromptPlant = plantToInsects.get(base.plantName) || new Set();
  const distractors = sortByScore(
    insects.filter((insect) => {
      const id = insect.id || insect.name;
      return id !== base.correctInsectId && !relatedToPromptPlant.has(id);
    }),
    (insect) => {
      const id = insect.id || insect.name;
      let score = 0;
      if (base.subfamily && subfamilyToInsects.get(base.subfamily)?.has(id)) score += 45;
      if (base.family && familyToInsects.get(base.family)?.has(id)) score += 35;
      if (insect.quizHasImage) score += 8;
      const hostCount = insectToPlants.get(id)?.size || 0;
      score += Math.max(0, 16 - Math.abs(hostCount - correctHostCount));
      return score;
    },
    random,
  ).slice(0, 3);
  if (distractors.length < 3) return null;
  const correctOption = buildInsectOption(base.correctInsect);
  return {
    id: base.id,
    reviewKey: base.reviewKey,
    mode: base.mode,
    subjectKey: base.subjectKey,
    prompt: {
      type: 'plant',
      title: base.plantName,
      subtitle: base.plantRecord.family || '',
      plantName: base.plantName,
      plant: base.plantRecord,
    },
    options: shuffleWithRandom([correctOption, ...distractors.map(buildInsectOption)], random),
    correctOptionId: correctOption.id,
    explanation: {
      correctLabel: base.correctInsect.name,
      sourceLabel: buildSourceLabel(
        base.correctInsect.quizHostPlantRecords.find((record) => record.name === base.plantName) || base.plantRecord,
      ),
      sourceRecords: base.correctInsect.quizHostPlantRecords.filter((record) => record.name === base.plantName),
      insect: base.correctInsect,
      plant: base.plantRecord,
    },
    detailLinks: {
      insect: base.correctInsect,
      plantName: base.plantName,
    },
  };
};

const selectSessionQuestions = ({
  questionBases,
  questionCount,
  reviewKeys,
  random,
  buildQuestion,
}) => {
  const selected = [];
  const usedSubjects = new Set();
  const usedQuestionIds = new Set();
  const reviewSet = new Set(reviewKeys || []);
  const reviewLimit = Math.min(2, Math.max(1, Math.floor(questionCount * 0.25)));
  const shuffled = shuffleWithRandom(questionBases, random);
  const prioritizeImages = (pool) =>
    pool.some((question) => question.hasImage)
      ? [
          ...pool.filter((question) => question.hasImage),
          ...pool.filter((question) => !question.hasImage),
        ]
      : pool;
  const reviewCandidates = prioritizeImages(shuffled.filter((question) => reviewSet.has(question.reviewKey)));
  const regularCandidates = prioritizeImages(shuffled.filter((question) => !reviewSet.has(question.reviewKey)));

  const takeFrom = (pool, limit = Infinity, { relaxSubjects = false } = {}) => {
    let added = 0;
    for (const questionBase of pool) {
      if (selected.length >= questionCount || added >= limit) break;
      if (usedQuestionIds.has(questionBase.id)) continue;
      if (!relaxSubjects && usedSubjects.has(questionBase.subjectKey) && selected.length < Math.floor(questionCount * 0.8)) {
        continue;
      }
      const question = buildQuestion(questionBase);
      if (!question) continue;
      selected.push(question);
      usedQuestionIds.add(questionBase.id);
      usedSubjects.add(questionBase.subjectKey);
      added += 1;
    }
  };

  takeFrom(reviewCandidates, reviewLimit);
  takeFrom(regularCandidates);
  if (selected.length < questionCount) {
    takeFrom(shuffled, Infinity, { relaxSubjects: true });
  }

  return shuffleWithRandom(selected.slice(0, questionCount), random).map((question, index) => ({
    ...question,
    id: `${question.id}:${index + 1}`,
    questionNumber: index + 1,
  }));
};

export const buildQuizQuestions = ({
  moths = [],
  butterflies = [],
  plantDetails = {},
  insectImageNames,
  insectImageExtensions,
  mode = DEFAULT_QUIZ_MODE,
  questionCount = DEFAULT_QUIZ_LENGTH,
  seed = Date.now(),
  reviewKeys = [],
} = {}) => {
  const normalizedMode = normalizeQuizMode(mode);
  const random = createRandom(seed);
  const relationships = buildRelationships({
    moths,
    butterflies,
    plantDetails,
    insectImageNames,
    insectImageExtensions,
  });
  const questionBases =
    normalizedMode === QUIZ_MODES.PLANT_TO_INSECT
      ? buildPlantToInsectQuestionBases(relationships)
      : buildInsectToPlantQuestionBases(relationships);
  const buildQuestion =
    normalizedMode === QUIZ_MODES.PLANT_TO_INSECT
      ? (questionBase) => buildPlantToInsectQuestion(questionBase, relationships, random)
      : (questionBase) => buildInsectToPlantQuestion(questionBase, relationships, random);

  return selectSessionQuestions({
    questionBases,
    questionCount,
    reviewKeys,
    random,
    buildQuestion,
  });
};

export const isCorrectAnswer = (question, optionId) =>
  Boolean(question && optionId && question.correctOptionId === optionId);

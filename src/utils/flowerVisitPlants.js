import { isPlantHostRecord } from './hostResource.js';

export const isFlowerVisitRecord = (record) => {
  if (!record) return false;
  if (typeof record.isFlowerVisit === 'boolean') return record.isFlowerVisit;
  const lifeStage = (record?.lifeStage || '').trim();
  const plantPart = (record?.plantPart || '').trim();
  const partCompact = plantPart.replace(/\s+/g, '');
  // An unspecified stage (or flower-stalk feeding) does not establish an adult visit.
  return lifeStage === '成虫' && partCompact.replace(/花[梗茎]/g, '').includes('花');
};

const normalizeFlowerVisitPlant = (value) => {
  if (!value || typeof value !== 'string') return '';
  return value
    .replace(/[（(][^）)]*科[^）)]*[）)]/g, '')
    .replace(/[（(][^）)]*[）)]/g, '')
    .trim();
};

export const buildFlowerVisitMap = (insects = []) => {
  const map = {};
  (insects || []).forEach((insect) => {
    if (!insect) return;
    const insectName = (insect.name || insect.japaneseName || '').trim();
    if (!insectName) return;
    if (Array.isArray(insect.flowerVisitPlants)) {
      insect.flowerVisitPlants.forEach((rawPlant) => {
        const plantName = normalizeFlowerVisitPlant(String(rawPlant || '').trim());
        if (!plantName || plantName === '不明') return;
        if (!map[plantName]) map[plantName] = [];
        if (!map[plantName].includes(insectName)) map[plantName].push(insectName);
      });
    }
    const records = insect.hostPlantsDetailed;
    if (!Array.isArray(records) || records.length === 0) return;
    records.forEach((record) => {
      if (!isPlantHostRecord(record)) return;
      if (!isFlowerVisitRecord(record)) return;
      const rawPlant = record?.name || record?.displayName || record?.plant || '';
      const plantName = normalizeFlowerVisitPlant(String(rawPlant || '').trim());
      if (!plantName || plantName === '不明') return;
      if (!map[plantName]) map[plantName] = [];
      if (!map[plantName].includes(insectName)) map[plantName].push(insectName);
    });
  });
  return map;
};

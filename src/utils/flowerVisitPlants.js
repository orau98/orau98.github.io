export const isFlowerVisitRecord = (record) => {
  if (!record) return false;
  if (record.isFlowerVisit === true) return true;
  const lifeStage = (record?.lifeStage || '').trim();
  const plantPart = (record?.plantPart || '').trim();
  const partCompact = plantPart.replace(/\s+/g, '');
  const isAdultOrUnknown = lifeStage === '成虫' || lifeStage === '';
  return isAdultOrUnknown && partCompact && partCompact.includes('花');
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
    const records = insect.hostPlantsDetailed;
    if (!Array.isArray(records) || records.length === 0) return;
    records.forEach((record) => {
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

const NON_PLANT_RESOURCE_PATTERNS = [
  /枯(?:れ)?(?:葉|木|枝|草|ススキ|果)/,
  /朽ち(?:木|葉|た)/,
  /落ち葉/,
  /樹皮(?:下)?/,
  /材部/,
  /菌類/,
  /キノコ/,
  /カワラタケ/,
];

export const isNonPlantResourceName = (value = '') => {
  const name = String(value || '').trim();
  if (!name) return false;
  return NON_PLANT_RESOURCE_PATTERNS.some((pattern) => pattern.test(name));
};

export const getHostResourceType = (value = '') =>
  isNonPlantResourceName(value) ? 'substrate' : 'plant';

export const isPlantHostRecord = (record) =>
  !record || record.resourceType !== 'substrate';

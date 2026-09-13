import { isFlowerVisitRecord } from '../../src/utils/flowerVisitPlants.js';

const unique = (values) => [...new Set(values.filter((value) => value && value !== '不明'))];

// Detailed records are authoritative even when every record is an adult flower visit.
// "Host" follows the source dataset; it does not imply a recorded larval stage.
export function getPlantUsage(insect = {}, normalize = (value) => String(value || '').trim()) {
  const detailed = insect.hostPlantsDetailed;
  if (Array.isArray(detailed) && detailed.length > 0) {
    const records = detailed;
    const names = (flower) => unique(records
      .filter((record) => isFlowerVisitRecord(record) === flower)
      .map((record) => normalize(record.displayName || record.name || record.plant)));
    return { hostPlants: names(false), flowerPlants: names(true) };
  }
  const legacy = Array.isArray(insect.hostPlants) ? insect.hostPlants
    : String(insect.hostPlants || '').split(/[;；、,，]/);
  return { hostPlants: unique(legacy.map(normalize)), flowerPlants: [] };
}

export function getPlantInsectUsage(insect, plantName, normalize) {
  const usage = getPlantUsage(insect, normalize);
  const key = normalize(plantName);
  // A generated page key may already be normalized; some legacy family labels
  // are not idempotent under a second normalization pass. Preserve the exact key.
  const matches = (names) => names.includes(plantName) || names.includes(key);
  return { host: matches(usage.hostPlants), flower: matches(usage.flowerPlants) };
}

export function uniqueInsects(insects = []) {
  return [...new Map(insects.map((insect) => [insect.id || insect.japaneseName || insect.name, insect])).values()];
}

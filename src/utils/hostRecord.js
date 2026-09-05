import { getHostResourceType } from './hostResource.js';
import { getPublicHostPlantNote } from './publicHostPlantNotes.js';
import { isFlowerVisitRecord } from './flowerVisitPlants.js';

// Missing source values are evidence gaps, not defaults to be filled by the UI.
// Both the runtime dataset and static pages use this conversion.
export const normalizeHostRecord = (row = {}) => {
  const name = (row.plant_name || '').trim();
  const record = {
    recordId: (row.record_id || '').trim(),
    name,
    family: (row.plant_family || '').trim(),
    observationType: (row.observation_type || '').trim(),
    plantPart: (row.plant_part || '').trim(),
    lifeStage: (row.life_stage || '').trim(),
    reference: (row.reference || '').trim(),
    notes: getPublicHostPlantNote(row.notes || ''),
    resourceType: getHostResourceType(name),
    isDetailed: true,
  };
  return { ...record, isFlowerVisit: isFlowerVisitRecord(record) };
};

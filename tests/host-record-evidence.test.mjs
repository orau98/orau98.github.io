import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Papa from 'papaparse';
import { normalizeHostRecord } from '../src/utils/hostRecord.js';
import { convertNormalizedDataToStandardFormat } from '../src/utils/normalizedDataParser.js';
import { isFlowerVisitRecord } from '../src/utils/flowerVisitPlants.js';
import { buildPlantDisplayData } from '../src/utils/insectCardData.js';
import { getObservationTypePresentation } from '../src/utils/observationType.js';
import { parseIntegratedHostPlants, convertLegacyToIntegratedFormat } from '../src/utils/integratedDataParser.js';

test('unspecified stage, plant part and observation remain empty for every source and resource', () => {
  for (const reference of ['日本産タマムシ大図鑑', '日本原色アブラムシ図鑑', '日本のハマキガ1', '日本産カミキリムシ', '']) {
    for (const plant_name of ['アデク', '枯死木']) {
      const record = normalizeHostRecord({ record_id: 'source-1', plant_name, reference });
      assert.equal(record.recordId, 'source-1');
      assert.equal(record.observationType, '');
      assert.equal(record.plantPart, '');
      assert.equal(record.lifeStage, '');
      assert.equal(record.isFlowerVisit, false);
    }
  }
});

test('explicit evidence remains intact and an unknown stage is not inferred to be an adult visit', () => {
  assert.equal(isFlowerVisitRecord({ lifeStage: '', plantPart: '花' }), false);
  assert.equal(isFlowerVisitRecord({ lifeStage: '幼虫', plantPart: '花' }), false);
  assert.equal(isFlowerVisitRecord({ lifeStage: '成虫', plantPart: '花' }), true);
  assert.equal(isFlowerVisitRecord({ lifeStage: '成虫', plantPart: '花梗' }), false);
  assert.equal(isFlowerVisitRecord({ lifeStage: '成虫', plantPart: '花', isFlowerVisit: false }), false);
  const row = normalizeHostRecord({ observation_type: '野外（海外）', plant_part: '葉', life_stage: '幼虫' });
  assert.equal(row.observationType, '野外（海外）');
  assert.equal(row.plantPart, '葉');
  assert.equal(row.lifeStage, '幼虫');
});

test('all retained normalized host records preserve source metadata instead of fabricating defaults', () => {
  const read = (name) => Papa.parse(fs.readFileSync(new URL(`../normalized_data/${name}.csv`, import.meta.url), 'utf8'), { header: true, skipEmptyLines: true }).data;
  const hosts = read('hostplants');
  const converted = convertNormalizedDataToStandardFormat(read('insects'), hosts, []);
  const records = new Map(Object.values(converted).flat().flatMap((insect) => insect.hostPlantsDetailed || []).map((row) => [row.recordId, row]));
  let blanks = 0;
  for (const source of hosts) {
    const output = records.get(source.record_id);
    if (!output) continue; // invalid names and separately audited taxon merges are not display records
    for (const [raw, field] of [['observation_type', 'observationType'], ['life_stage', 'lifeStage'], ['plant_part', 'plantPart']]) {
      assert.equal(output[field], (source[raw] || '').trim(), `${source.record_id}: ${raw}`);
    }
    if (!source.observation_type) blanks += 1;
  }
  assert.ok(blanks > 3000, `expected full source coverage, got ${blanks}`);
  for (const id of ['hostplant-004439', 'hostplant-004440']) {
    assert.equal(records.get(id)?.observationType, '');
    assert.equal(records.get(id)?.plantPart, '');
    assert.equal(records.get(id)?.lifeStage, '');
  }
});

test('legacy format fallbacks preserve uncertainty too', () => {
  const records = [parseIntegratedHostPlants({ 主要食草1: 'アデク' })[0],
    convertLegacyToIntegratedFormat([{ hostPlants: ['アデク'] }])[0].hostPlantsDetailed[0]];
  records.forEach((row) => {
    assert.equal(row.observationType, '');
    assert.equal(row.lifeStage, '');
    assert.equal(row.plantPart, '');
  });
});

test('an absent observation category is labeled not stated, not other or domestic', () => {
  assert.equal(getObservationTypePresentation('').label, '未記載');
  assert.equal(getObservationTypePresentation('', true).label, 'Not stated');
});

test('unknown flower use stays in host relationships instead of disappearing from list cards', () => {
  const insect = { hostPlantsDetailed: [normalizeHostRecord({ plant_name: 'ガマズミ', plant_part: '花' })] };
  const display = buildPlantDisplayData(insect);
  assert.ok(JSON.stringify(display).includes('ガマズミ'));
});

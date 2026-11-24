import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Papa from 'papaparse';
import { normalizeHostRecord } from '../src/utils/hostRecord.js';
import { convertNormalizedDataToStandardFormat } from '../src/utils/normalizedDataParser.js';
import { isFlowerVisitRecord } from '../src/utils/flowerVisitPlants.js';
import { buildPlantDisplayData } from '../src/utils/insectCardData.js';
import { getObservationTypePresentation, groupObservationEvidence } from '../src/utils/observationType.js';
import { getSourceLink } from '../src/utils/sourceLinks.js';
import { bibliography } from '../src/utils/bibliography.js';
import { parseIntegratedHostPlants, convertLegacyToIntegratedFormat } from '../src/utils/integratedDataParser.js';

const readCsv = (path) => Papa.parse(fs.readFileSync(new URL(path, import.meta.url), 'utf8'), {
  header: true,
  skipEmptyLines: true,
}).data;

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
  const hosts = readCsv('../normalized_data/hostplants.csv');
  const converted = convertNormalizedDataToStandardFormat(readCsv('../normalized_data/insects.csv'), hosts, []);
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

test('an absent observation category is displayed as unknown', () => {
  assert.equal(getObservationTypePresentation('').label, '不明');
  assert.equal(getObservationTypePresentation('', true).label, 'Unknown');
});

test('unknown flower use stays in host relationships instead of disappearing from list cards', () => {
  const insect = { hostPlantsDetailed: [normalizeHostRecord({ plant_name: 'ガマズミ', plant_part: '花' })] };
  const display = buildPlantDisplayData(insect);
  assert.ok(JSON.stringify(display).includes('ガマズミ'));
});

test('November literature records match the approved page evidence and stay distinct on display', () => {
  const audit = readCsv('../data/source_audits/japanese-moth-host-literature-2026-11-24.csv');
  const insects = readCsv('../normalized_data/insects.csv');
  const hosts = readCsv('../normalized_data/hostplants.csv');
  const hostsById = new Map(hosts.map((row) => [row.record_id, row]));
  const insectsById = new Map(insects.map((row) => [row.insect_id, row]));
  const approvedHosts = audit.filter((row) => row.decision === 'include' && row.entity.startsWith('host_'));
  const bibliographyKeys = new Set(bibliography.map((entry) => entry.key));
  assert.ok(approvedHosts.length > 0);
  for (const entry of audit.filter((row) => row.decision === 'include')) {
    assert.ok(entry.pdf_page && entry.printed_page, entry.record_id);
    assert.match(entry.source_pdf_sha256 || entry.source_page_sha256, /^[a-f0-9]{64}$/);
    assert.ok(getSourceLink(entry.reference), entry.reference);
    assert.ok(bibliographyKeys.has(entry.bibliography_key), entry.bibliography_key);
    const insect = insectsById.get(entry.insect_id);
    assert.equal(insect.japanese_name, entry.insect_name, entry.record_id);
    assert.equal(insect.scientific_name, entry.scientific_name, entry.record_id);
  }
  for (const entry of approvedHosts) {
    const row = hostsById.get(entry.record_id);
    for (const field of ['insect_id', 'plant_name', 'plant_family', 'observation_type', 'plant_part', 'life_stage', 'reference']) {
      assert.equal(row[field], entry[field], `${entry.record_id}: ${field}`);
    }
    assert.equal(row.notes, entry.approved_note, entry.record_id);
  }
  assert.equal(hosts.filter((row) => row.record_id.startsWith('host-literature-20261124-')).length,
    approvedHosts.filter((row) => row.entity === 'host_add').length);

  const { moths } = convertNormalizedDataToStandardFormat(insects, hosts, []);
  const moth = moths.find((item) => item.name === 'サザナミノメイガ');
  const sasa = moth.hostPlantsDetailed.filter((row) => row.name === 'ネザサ類');
  const evidence = groupObservationEvidence(sasa);
  assert.deepEqual(evidence.map((group) => group.presentation.category), ['field', 'reared']);
  assert.ok(evidence.every((group) => group.records.length === 1 && group.records[0].reference === '松井ら (2023)'));
});

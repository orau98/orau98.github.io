import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

import Papa from 'papaparse';

const REFERENCE = '日本産カミキリムシ';
const SHARED_LEDGER =
  'data/source_audits/japanese-longhorn-beetles-2007-shared-host-index.csv';
const SOURCE_LEDGER =
  'data/source_audits/japanese-longhorn-beetles-2007-host-index.csv';

const readCsv = (filePath) => {
  const parsed = Papa.parse(
    fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n'),
    { header: true, skipEmptyLines: true },
  );
  assert.deepEqual(parsed.errors, [], `${filePath} should parse without errors`);
  return parsed.data;
};

const splitList = (value) => String(value || '')
  .split(/[;；]/)
  .map((item) => item.trim())
  .filter(Boolean);

const sameSet = (left, right) =>
  left.size === right.size && [...left].every((value) => right.has(value));

const expectedRecordId = (sourceAuditId, targetInsectId) =>
  `host-kamikiri-shared-${crypto
    .createHash('sha1')
    .update(`${sourceAuditId}|${targetInsectId}`)
    .digest('hex')
    .slice(0, 12)}`;

const source = readCsv(SOURCE_LEDGER);
const shared = readCsv(SHARED_LEDGER);
const insects = readCsv('normalized_data/insects.csv');
const hostplants = readCsv('normalized_data/hostplants.csv');
const sourceById = new Map(source.map((row) => [row.audit_id, row]));
const insectsById = new Map(insects.map((row) => [row.insect_id, row]));

const expanded = shared.flatMap((row) => {
  const targetIds = splitList(row.target_insect_ids);
  const targetNames = splitList(row.target_japanese_names);
  const recordIds = splitList(row.proposed_record_ids);
  assert.equal(targetIds.length, targetNames.length, `${row.share_audit_id}: target names`);
  assert.equal(targetIds.length, recordIds.length, `${row.share_audit_id}: record IDs`);
  return targetIds.map((targetInsectId, index) => ({
    ...row,
    targetInsectId,
    targetJapaneseName: targetNames[index],
    recordId: recordIds[index],
  }));
});

const historicalTargets = new Map([
  ['Aegosoma sinicum', new Set(['1-1', '1-2'])],
  ['Leptura ochraceofasciata', new Set(['species-22251', 'species-22253'])],
  ['Thranius variegatus', new Set(['species-22169', 'species-22171'])],
]);

test('共有台帳は138原行から安全な454寄主行だけを定義する', () => {
  assert.equal(shared.length, 138);
  assert.equal(expanded.length, 454);
  assert.equal(new Set(shared.map((row) => row.share_audit_id)).size, 138);
  assert.equal(new Set(shared.map((row) => row.source_audit_id)).size, 138);
  assert.equal(new Set(expanded.map((row) => row.recordId)).size, 454);

  const speciesLevel = shared.filter((row) => row.classification === 'species_level_shared');
  const historical = shared.filter(
    (row) => row.classification === 'historical_subspecies_concept_shared',
  );
  assert.equal(speciesLevel.length, 108);
  assert.equal(historical.length, 30);
  assert.equal(
    speciesLevel.reduce((count, row) => count + splitList(row.target_insect_ids).length, 0),
    394,
  );
  assert.equal(
    historical.reduce((count, row) => count + splitList(row.target_insect_ids).length, 0),
    60,
  );
  assert.equal(
    shared.reduce(
      (count, row) => count + splitList(row.excluded_target_insect_ids).length,
      0,
    ),
    59,
  );
});

test('元のneeds_reviewを変更せず原典ハッシュ・ページ・植物を一対一で継承する', () => {
  const sourceFields = new Map([
    ['source_mapped_insect_id', 'insect_id'],
    ['source_japanese_name', 'source_japanese_name'],
    ['plant_name', 'plant_name'],
    ['plant_family', 'plant_family'],
    ['canonical_reference', 'canonical_reference'],
    ['pdf_file', 'pdf_file'],
    ['source_pdf_sha256', 'source_pdf_sha256'],
    ['ocr_sha256', 'ocr_sha256'],
    ['source_pdf_page', 'source_pdf_page'],
    ['source_printed_page', 'source_printed_page'],
    ['source_ocr_line', 'source_ocr_line'],
    ['source_review_note', 'review_note'],
  ]);

  for (const row of shared) {
    const sourceRow = sourceById.get(row.source_audit_id);
    assert.ok(sourceRow, row.source_audit_id);
    assert.equal(sourceRow.decision, 'needs_review');
    assert.doesNotMatch(sourceRow.review_note, /[?？]/);
    assert.equal(row.decision, 'include_shared');
    for (const [sharedField, sourceField] of sourceFields) {
      assert.equal(row[sharedField], sourceRow[sourceField], `${row.share_audit_id}:${sharedField}`);
    }
  }

  const questionMarkRows = source.filter(
    (row) => row.decision === 'needs_review' && /[?？]|疑問符/.test(row.review_note),
  );
  assert.equal(questionMarkRows.length, 6);
  const sharedSourceIds = new Set(shared.map((row) => row.source_audit_id));
  assert.equal(questionMarkRows.some((row) => sharedSourceIds.has(row.audit_id)), false);
});

test('種レベル記述は全亜種へ、旧名義亜種概念は確認済み範囲だけへ共有する', () => {
  for (const row of shared) {
    const sourceInsect = insectsById.get(row.source_mapped_insect_id);
    assert.ok(sourceInsect, row.source_mapped_insect_id);
    const speciesGroup = `${sourceInsect.genus} ${sourceInsect.species}`;
    assert.equal(row.source_species_group, speciesGroup);
    const siblings = new Set(
      insects
        .filter(
          (insect) =>
            insect.genus === sourceInsect.genus && insect.species === sourceInsect.species,
        )
        .map((insect) => insect.insect_id),
    );
    const targets = new Set(splitList(row.target_insect_ids));
    const excluded = new Set(splitList(row.excluded_target_insect_ids));
    assert.equal(sameSet(siblings, new Set([...targets, ...excluded])), true);

    if (row.classification === 'species_level_shared') {
      assert.equal(excluded.size, 0);
      assert.equal(sameSet(siblings, targets), true);
      assert.equal(historicalTargets.has(speciesGroup), false);
    } else {
      assert.equal(
        sameSet(targets, historicalTargets.get(speciesGroup) || new Set()),
        true,
      );
      assert.ok(excluded.size > 0);
    }
  }
});

test('提案record_idをそのまま用い454行を一度だけ反映し59過大候補を出力しない', () => {
  const actualShared = hostplants.filter((row) =>
    row.record_id.startsWith('host-kamikiri-shared-')
  );
  assert.equal(actualShared.length, 454);
  const actualById = new Map(actualShared.map((row) => [row.record_id, row]));
  assert.equal(actualById.size, 454);

  for (const row of expanded) {
    assert.equal(row.recordId, expectedRecordId(row.source_audit_id, row.targetInsectId));
    const actual = actualById.get(row.recordId);
    assert.ok(actual, row.recordId);
    assert.equal(actual.insect_id, row.targetInsectId);
    assert.equal(actual.plant_name, row.plant_name);
    assert.equal(actual.plant_family, row.plant_family);
    assert.equal(actual.reference, REFERENCE);
    assert.equal(actual.observation_type, '文献');
    assert.equal(actual.life_stage, '幼虫');
    assert.equal(insectsById.get(row.targetInsectId)?.japanese_name, row.targetJapaneseName);
  }

  for (const row of shared) {
    for (const excludedId of splitList(row.excluded_target_insect_ids)) {
      assert.equal(
        actualById.has(expectedRecordId(row.source_audit_id, excludedId)),
        false,
        `${row.source_audit_id}:${excludedId} must stay excluded`,
      );
    }
  }
});

test('名義亜種を明記した3群を全兄弟亜種へ過大共有しない', () => {
  const aegosoma = expanded.filter((row) => row.source_species_group === 'Aegosoma sinicum');
  assert.equal(aegosoma.length, 34);
  assert.deepEqual(new Set(aegosoma.map((row) => row.targetInsectId)), new Set(['1-1', '1-2']));

  const leptura = expanded.filter(
    (row) => row.source_species_group === 'Leptura ochraceofasciata',
  );
  assert.equal(leptura.length, 24);
  assert.deepEqual(
    new Set(leptura.map((row) => row.targetInsectId)),
    new Set(['species-22251', 'species-22253']),
  );

  const thranius = expanded.filter((row) => row.source_species_group === 'Thranius variegatus');
  assert.equal(thranius.length, 2);
  assert.deepEqual(
    new Set(thranius.map((row) => row.targetInsectId)),
    new Set(['species-22169', 'species-22171']),
  );
});

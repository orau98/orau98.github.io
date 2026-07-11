#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseCsv, toObjects } from './lib/csvQuality.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_ROOT = process.env.LEAF_BEETLE_CANONICAL_DATA_ROOT
  ? path.resolve(process.env.LEAF_BEETLE_CANONICAL_DATA_ROOT)
  : ROOT;
const OUTPUT = path.join(
  ROOT,
  'data/source_audits/leaf-beetle-canonical-taxonomy-merge-2026-07-12.json',
);
const PATHS = {
  insects: path.join(DATA_ROOT, 'normalized_data/insects.csv'),
  hosts: path.join(DATA_ROOT, 'normalized_data/hostplants.csv'),
  notes: path.join(DATA_ROOT, 'normalized_data/general_notes.csv'),
};

const MAPPINGS = Object.freeze([
  ['species-H798', 'species-H001'],
  ['species-H801', 'species-H017'],
  ['species-H803', 'species-H019'],
  ['species-H808', 'species-H032'],
  ['species-H033', 'species-H032'],
  ['species-H810', 'species-H044'],
  ['species-H813', 'species-H048'],
  ['species-H818', 'species-H063'],
  ['species-H819', 'species-H064'],
  ['species-H830', 'species-H096'],
  ['species-H841', 'species-H132'],
  ['species-H842', 'species-H137'],
  ['species-H676', 'species-H089'],
]);

// These are real historical combinations or names recorded in the current
// catalogue import.  The fabricated spelling Hemipyxis hegenagae is
// deliberately absent and must never become a synonym.
const EXTRA_REAL_SYNONYMS = Object.freeze({
  'species-H801': ['Clitea citri Chûjô, 1958'],
  'species-H803': ['Aphthona opaca Allard, 1889'],
  'species-H808': ['Argopistes ryukyuensis Shigetoh & Suenaga, 2022'],
});
const ARGOPISTES_RUFUS_EVIDENCE = Object.freeze({
  reference: 'Lee, Chiang & Suenaga (2024), ZooKeys 1215: 151–183',
  title: 'The genus Argopistes Motschulsky from Japan and Taiwan, with descriptions of three new species from Taiwan (Coleoptera, Chrysomelidae, Galerucinae, Alticini)',
  doi: '10.3897/zookeys.1215.134871',
  url: 'https://zookeys.pensoft.net/article/134871/',
  verified_claim: 'Argopistes coccinelliformis Csiki, 1940 and A. ryukyuensis Shigetoh & Suenaga, 2022 are junior synonyms of A. rufus Chen, 1934.',
});

const readRows = (filePath) => toObjects(parseCsv(fs.readFileSync(filePath, 'utf8')));
const splitSemicolon = (value) => String(value ?? '')
  .split(/[;；]/)
  .map((item) => item.trim())
  .filter(Boolean);
const joinUnique = (values) => [...new Set(values.flatMap(splitSemicolon))].join('; ');
const clone = (row) => Object.fromEntries(
  Object.entries(row).filter(([key]) => key !== '__recordIndex'),
);
const action = (actionId, type, before, after, reason) => ({
  action_id: actionId,
  action: type,
  before: before ? clone(before) : null,
  after: after ? clone(after) : null,
  reason,
  verification_status: 'cross_source_taxonomy_verified',
});

const insects = readRows(PATHS.insects);
const hosts = readRows(PATHS.hosts);
const notes = readRows(PATHS.notes);
const insectsById = new Map(insects.map((row) => [row.insect_id, row]));
const mappingByDuplicate = new Map(MAPPINGS);
const canonicalIds = new Set(MAPPINGS.map(([, canonicalId]) => canonicalId));

const mappingsByCanonical = new Map();
for (const [duplicateId, canonicalId] of MAPPINGS) {
  if (!mappingsByCanonical.has(canonicalId)) mappingsByCanonical.set(canonicalId, []);
  mappingsByCanonical.get(canonicalId).push(duplicateId);
}

const insectActions = [];
for (const [canonicalId, duplicateIds] of mappingsByCanonical) {
  const canonical = insectsById.get(canonicalId);
  const duplicates = duplicateIds.map((duplicateId) => {
    const duplicate = insectsById.get(duplicateId);
    if (!duplicate) throw new Error(`Missing mapping endpoint: ${duplicateId} -> ${canonicalId}`);
    return duplicate;
  });
  if (!canonical) throw new Error(`Missing canonical mapping endpoint: ${canonicalId}`);

  const realSynonyms = duplicates.flatMap((duplicate) => (
    duplicate.insect_id === 'species-H676'
      ? []
      : [
        duplicate.scientific_name,
        ...splitSemicolon(duplicate.synonyms),
        ...(EXTRA_REAL_SYNONYMS[duplicate.insect_id] || []),
      ]
  ));
  const differentJapaneseNames = duplicates
    .map((duplicate) => duplicate.japanese_name)
    .filter((name) => name && name !== canonical.japanese_name);
  let patchedCanonical = {
    ...canonical,
    synonyms: joinUnique([canonical.synonyms, ...realSynonyms]),
    other_names: joinUnique([canonical.other_names, ...differentJapaneseNames]),
  };
  const compatiblePredecessorBefore = { ...patchedCanonical };
  if (canonicalId === 'species-H032') {
    const duplicateTribeNames = [...new Set(duplicates.map(({ tribe_jp }) => tribe_jp).filter(Boolean))];
    if (duplicateTribeNames.length !== 1 || duplicateTribeNames[0] !== 'ノミハムシ族') {
      throw new Error(`Unexpected Argopistes tribe-name provenance: ${duplicateTribeNames.join(', ')}`);
    }
    patchedCanonical = {
      ...patchedCanonical,
      tribe_jp: canonical.tribe_jp || duplicateTribeNames[0],
      changes_since_standard: 'Lee et al. (2024) により Argopistes coccinelliformis と A. ryukyuensis は A. rufus の新参異名とされた。',
      notes: '分類根拠: Lee, Chiang & Suenaga (2024), ZooKeys 1215:151–183. DOI: 10.3897/zookeys.1215.134871',
    };
  }
  if (
    patchedCanonical.synonyms === canonical.synonyms
    && patchedCanonical.other_names === canonical.other_names
  ) throw new Error(`Canonical row receives no searchable provenance: ${canonicalId}`);
  if (/hegenagae/i.test(patchedCanonical.synonyms)) {
    throw new Error('Fabricated spelling Hemipyxis hegenagae must not enter synonyms');
  }
  const canonicalAction = action(
    `LBCM-INSECT-UPDATE-${canonicalId}`,
    'update_canonical_search_names',
    canonical,
    patchedCanonical,
    `Preserve verified former scientific/Japanese names from ${duplicateIds.join(', ')} on ${canonicalId}.`,
  );
  if (canonicalId === 'species-H032') {
    canonicalAction.source = { ...ARGOPISTES_RUFUS_EVIDENCE };
    canonicalAction.compatible_predecessor_before = clone(compatiblePredecessorBefore);
  }
  insectActions.push(canonicalAction);
  for (const duplicate of duplicates) {
    const deletionAction = action(
      `LBCM-INSECT-DELETE-${duplicate.insect_id}`,
      'delete_duplicate_taxon',
      duplicate,
      null,
      `Remove duplicate taxonomy row after all relationships and searchable names move to ${canonicalId}.`,
    );
    if (['species-H033', 'species-H808'].includes(duplicate.insect_id)) {
      deletionAction.source = { ...ARGOPISTES_RUFUS_EVIDENCE };
    }
    insectActions.push(deletionAction);
  }
}

const h806 = insectsById.get('species-H806');
if (!h806 || h806.japanese_name) throw new Error('Unexpected species-H806 before state');
const h806NameAction = action(
  'LBCM-INSECT-NAME-species-H806',
  'update_verified_japanese_name',
  h806,
  {
    ...h806,
    japanese_name: 'オキナワツブノミハムシ',
    notes: h806.notes.replace('食草・生態情報は未入力。', '').trim(),
  },
  '日本産ハムシ科生態覚書 (6) p.37 の種見出しに明記された和名を補う。',
);
h806NameAction.verification_status = 'original_pdf_page_verified';
h806NameAction.source = {
  reference: '日本産ハムシ科生態覚書 (6)',
  printed_page: 37,
  pdf_page: 39,
  source_taxon: 'Aphthona okinawaensis Konstantinov et Lingafelter',
};
insectActions.push(h806NameAction);

const h933 = insectsById.get('species-H933');
if (!h933 || h933.japanese_name) throw new Error('Unexpected species-H933 before state');
const h933NameAction = action(
  'LBCM-INSECT-NAME-species-H933',
  'update_verified_japanese_name',
  h933,
  {
    ...h933,
    japanese_name: 'セアカケブカハムシ',
    alternative_name: 'セアカケブカサルハムシ',
  },
  'ハムシハンドブック p.38 の種見出しに明記された和名と括弧内別名を補う。',
);
h933NameAction.verification_status = 'original_pdf_page_verified';
h933NameAction.source = {
  reference: 'ハムシハンドブック',
  printed_page: 38,
  source_taxon: 'Lypesthes fulvus (Baly)',
};
insectActions.push(h933NameAction);

const affectedHosts = hosts.filter((row) => (
  canonicalIds.has(row.insect_id) || mappingByDuplicate.has(row.insect_id)
));
const hostGroups = new Map();
for (const row of affectedHosts) {
  const canonicalId = mappingByDuplicate.get(row.insect_id) || row.insect_id;
  const key = `${canonicalId}\u0000${row.plant_name}`;
  if (!hostGroups.has(key)) hostGroups.set(key, []);
  hostGroups.get(key).push(row);
}

const mergeWholeValues = (rows, column) => joinUnique(rows.map((row) => row[column]));
const mergeEvidencePriority = (row) => {
  const references = splitSemicolon(row.reference);
  if (references.includes('日本産ハムシ科生態覚書 (6)')) return 0;
  if (mappingByDuplicate.has(row.insect_id)) return 1;
  if (references.includes('ハムシハンドブック')) return 2;
  return 3;
};
const hostActions = [];
for (const [key, rows] of [...hostGroups.entries()].sort(([left], [right]) => left.localeCompare(right))) {
  const [canonicalId] = key.split('\u0000');
  const containsDuplicateId = rows.some((row) => mappingByDuplicate.has(row.insect_id));
  if (!containsDuplicateId && rows.length === 1) continue;

  const canonicalRows = rows.filter((row) => row.insect_id === canonicalId);
  const survivor = [...(canonicalRows.length ? canonicalRows : rows)].sort((left, right) => {
    const score = (row) => ['plant_family', 'observation_type', 'plant_part', 'life_stage', 'reference', 'notes']
      .filter((column) => row[column]).length;
    return score(right) - score(left) || left.record_id.localeCompare(right.record_id);
  })[0];
  const orderedRows = containsDuplicateId
    ? [...rows].sort((left, right) => (
      mergeEvidencePriority(left) - mergeEvidencePriority(right)
      || left.record_id.localeCompare(right.record_id)
    ))
    : [survivor, ...rows.filter((row) => row.record_id !== survivor.record_id)
      .sort((left, right) => left.record_id.localeCompare(right.record_id))];
  const familyValues = [...new Set(orderedRows.map((row) => row.plant_family).filter(Boolean))];
  if (familyValues.length > 1) throw new Error(`Conflicting plant families for ${key}: ${familyValues.join(', ')}`);
  const after = {
    ...survivor,
    insect_id: canonicalId,
    plant_family: familyValues[0] || '',
    observation_type: mergeWholeValues(orderedRows, 'observation_type'),
    plant_part: mergeWholeValues(orderedRows, 'plant_part'),
    life_stage: mergeWholeValues(orderedRows, 'life_stage'),
    reference: mergeWholeValues(orderedRows, 'reference'),
    notes: mergeWholeValues(orderedRows, 'notes'),
  };
  hostActions.push(action(
    `LBCM-HOST-UPDATE-${survivor.record_id}`,
    rows.length > 1 ? 'merge_host_pair' : 'move_host_relationship',
    survivor,
    after,
    rows.length > 1
      ? `Consolidate ${rows.length} rows for ${canonicalId} / ${survivor.plant_name}, preserving every non-empty field and reference.`
      : `Move host relationship from duplicate ID to ${canonicalId}.`,
  ));
  for (const row of rows.filter((candidate) => candidate.record_id !== survivor.record_id)) {
    hostActions.push(action(
      `LBCM-HOST-DELETE-${row.record_id}`,
      'delete_merged_host_duplicate',
      row,
      null,
      `Relationship content is preserved in ${survivor.record_id}.`,
    ));
  }
}

const noteActions = notes
  .filter((row) => mappingByDuplicate.has(row.insect_id))
  .sort((left, right) => left.record_id.localeCompare(right.record_id))
  .map((row) => action(
    `LBCM-NOTE-MOVE-${row.record_id}`,
    'move_general_note',
    row,
    { ...row, insect_id: mappingByDuplicate.get(row.insect_id) },
    `Move general note from duplicate ID to ${mappingByDuplicate.get(row.insect_id)}.`,
  ));

const h808Hosts = hosts.filter((row) => row.insect_id === 'species-H808');
const h808Notes = notes.filter((row) => row.insect_id === 'species-H808');
if (h808Hosts.length !== 7 || h808Notes.length !== 1) {
  throw new Error(`Unexpected H808 payload: hosts=${h808Hosts.length}, notes=${h808Notes.length}`);
}

const ledger = {
  schema_version: 1,
  generated_at: '2026-07-12',
  audit_name: 'ハムシ科重複分類群の正準ID統合監査',
  scope: {
    tables: ['normalized_data/insects.csv', 'normalized_data/hostplants.csv', 'normalized_data/general_notes.csv'],
    public_data_modified: false,
    mapping_basis: [
      '日本列島の甲虫全種目録(2026)と現行分類行の照合',
      'ハムシハンドブック全種監査',
      '日本産ハムシ科生態覚書 (6) 原本全種監査',
      'Lee, Chiang & Suenaga (2024) ZooKeys 1215:151–183 の Argopistes rufus 再検討',
    ],
    primary_taxonomy_evidence: [{ ...ARGOPISTES_RUFUS_EVIDENCE }],
    policy: '旧IDの全関係を正準IDへ移し、同一昆虫-植物pairは全フィールドとreferenceを欠落なく統合する。旧学名・異名は検索用synonyms、異なる和名はother_namesへ残す。',
    compatible_applied_predecessor: {
      audit_sha256: 'a210b266464e8eee6825a13e62e98b87526d8c470178dd946385ad6a9e6a6608',
      unchanged_applied_action_count: 46,
      transition_action_ids: [
        'LBCM-INSECT-UPDATE-species-H032',
        'LBCM-INSECT-DELETE-species-H033',
      ],
      reason: '前版47 actions適用済み環境では、H032へtribe和名と一次論文に基づく分類史を追補し、残存H033を削除する2 actionsだけを安全に追加適用する。',
    },
  },
  mappings: MAPPINGS.map(([duplicate_id, canonical_id]) => ({ duplicate_id, canonical_id })),
  protected_exclusions: [{
    value: 'Hemipyxis hegenagae',
    reason: '実在を確認できない偽綴りのためsynonymsへ継承しない',
  }],
  counts: {
    mappings: MAPPINGS.length,
    canonical_search_name_updates: mappingsByCanonical.size,
    duplicate_taxon_deletions: MAPPINGS.length,
    canonical_merge_insect_actions: mappingsByCanonical.size + MAPPINGS.length,
    verified_name_actions: 2,
    insect_actions: insectActions.length,
    host_actions: hostActions.length,
    note_actions: noteActions.length,
    total_actions: insectActions.length + hostActions.length + noteActions.length,
    h808_hosts_verified: h808Hosts.length,
    h808_notes_verified: h808Notes.length,
  },
  insect_actions: insectActions,
  host_actions: hostActions,
  note_actions: noteActions,
};

fs.writeFileSync(OUTPUT, `${JSON.stringify(ledger, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ output: path.relative(ROOT, OUTPUT), counts: ledger.counts }, null, 2));

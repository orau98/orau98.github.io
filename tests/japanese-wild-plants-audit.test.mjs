import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import Papa from 'papaparse';

const ROOT = path.resolve(import.meta.dirname, '..');
const SCOPE_PATH = path.join(
  ROOT,
  'data/source_audits/japanese-wild-plants-source-scope-2026-07-12.json',
);
const PROFILE_AUDIT_PATH = path.join(
  ROOT,
  'data/source_audits/japanese-wild-plants-profile-completeness-2026-07-12.csv',
);
const IDENTIFICATION_AUDIT_PATH = path.join(
  ROOT,
  'data/source_audits/japanese-wild-plants-identification-2026-07-12.csv',
);
const INTEGRITY_AUDIT_PATH = path.join(
  ROOT,
  'data/source_audits/japanese-wild-plants-profile-integrity-2026-07-12.csv',
);
const OCR_TOKEN_AUDIT_PATH = path.join(
  ROOT,
  'data/source_audits/japanese-wild-plants-ocr-token-verification-2026-07-12.csv',
);
const NAME_AUDIT_PATH = path.join(
  ROOT,
  'data/source_audits/japanese-wild-plants-name-integrity-2026-07-12.csv',
);
const TAXONOMY_REVIEW_PATH = path.join(
  ROOT,
  'data/source_audits/japanese-wild-plants-taxonomy-followup-2026-07-12.csv',
);
const PROFILE_PATH = path.join(ROOT, 'normalized_data/plant_profiles.csv');
const APPLY_PATH = path.join(ROOT, 'scripts/apply-japanese-wild-plants-audit.mjs');
const PACKAGE_PATH = path.join(ROOT, 'package.json');
const DEPLOY_PATH = path.join(ROOT, '.github/workflows/deploy.yml');

const PROFILE_HEADERS = [
  'profile_id',
  'plant_name',
  'scientific_name',
  'family',
  'family_latin',
  'genus_jp',
  'genus_scientific',
  'habit',
  'height',
  'flower_period',
  'distribution',
  'habitat',
  'similar_taxa',
  'distinguishing_features',
  'printed_page',
  'source',
  'page',
  'extraction_method',
];
const FACT_FIELDS = [
  'habit',
  'height',
  'flower_period',
  'distribution',
  'habitat',
  'distinguishing_features',
];
const PROFILE_AUDIT_VALUE_FIELDS = [
  'scientific_name',
  'family',
  'family_latin',
  'genus_jp',
  'genus_scientific',
  ...FACT_FIELDS,
  'similar_taxa',
  'printed_page',
];
const SUBJECTIVE_PATTERN = /条件に恵まれ|美し|優美|上品|豪壮|幸福|至福|魅力|珍品|観賞価値|採集者/u;
const CJK_SPACE_PATTERN = /[一-龯々〆ヵヶぁ-んァ-ヶー] [一-龯々〆ヵヶぁ-んァ-ヶー]/u;
const PUNCTUATION_SPACE_PATTERN = /[、。，．；：・] [一-龯々〆ヵヶぁ-んァ-ヶー]/u;
const OCR_PUNCTUATION_PATTERN = /，|\d\s*ー\s*\d/u;
const UNUSABLE_IDENTIFICATION_PATTERN = /区別できない|判別できない|同定できない|中間型があり|雑種と推定|推定される/u;
const MISPLACED_COMPARISON_PATTERN = /似る|近縁|区別|に比べ|と異な|よりやや(?:大型|小型|長|短|広|狭|厚|薄|多|少)/u;
const UNVERIFIED_ASSERTION_PATTERN = /[?？]|推定|と思|とされ|と考え|可能性|疑問符|見解がある|おそらく|疑わし|不明|らしい|といわれ|であろう|わからない|説もある/u;
const HEADING_OR_PLATE_PATTERN = /\b[A-Z][a-z]+(?:\s+(?:×\s*)?[a-z][A-Za-z.-]*)+\b|[（(]?[PＰ][LＬ.]?\s*\d+/u;
const KNOWN_OCR_CORRUPTION_PATTERN = /林緑|治海地|広薬|掃化|針薬|落薬|掛林|温原|材林|熟帯|荷林|プナ帯|楽林|業林|洗水|相林|道ぼた|横林|吐感喇|波蝕能上の街中|吐略射列島|満に|東開アジア|飯島|薬は|際半島|照楽勘林|酉太平洋|洸水|千潟|寒器|地瑚礁|酸陵品|棋林|広城|フィリビン|阪島|桝林|針業荷林|広楽林|広業林|琉琉球|探集|昼久島|植裁|吐感射列島|以商|開麟|薬が|專の形質|化序|吐畷射列島|に[避違]する|吐鴨喇|海美半島|薬裏|，、|山離|広楽|林線|常線|浴葉|開喫|吐鳴喇|南部島膜|開側|機験島|プナ帝|多営地|針楽街休|要南省|以率|橋林|常緑酵林|以酒|落棄樹林|楜林|常緑広棄林|朝鮮半品|亜寒番|亜寒待|多年章|観質|霧ヶ絲|陳林|伯者大山|丘険地|白馬店|夕張缶|毎枝|制技|海水地|全殿|品後|科面基部|開願|提防|出憩|伯者|浦限|全士|四因|朝鮮半鳥|街路間|睡道|治岸|菌アジア|痛る|山糸|夏緑橋林|製素|厳阜|蘭焼|常緑勘林|租子島|鹿島槍ヶ缶|禁島|吐蠣開列島|吐職刺列島|常緑萄林|吐蠣喇列島|九レ州|吐略刺列島|常緑材|常麻|専筒|照薬萄林|照棄街林|隠枝|千薬県|九州産部|八ヶ醤|無帯/u;

const clean = (value) => String(value ?? '').trim();
const pageReferences = (value) => clean(value).split(';').map((part) => part.trim()).filter(Boolean);
const numericPageReferences = (value) => pageReferences(value).map(Number);
const similarTaxaParts = (value) => clean(value).split(/[、／/;]+/u).map((part) => part.trim()).filter(Boolean);
const identificationSentences = (value) => clean(value).split(/[。．]+/u).map((part) => part.trim()).filter(Boolean);
const sha256 = (filePath) => crypto
  .createHash('sha256')
  .update(fs.readFileSync(filePath))
  .digest('hex');
const parseCsv = (filePath) => {
  const parsed = Papa.parse(
    fs.readFileSync(filePath, 'utf8').replace(/\r\n?/gu, '\n'),
    { header: true, skipEmptyLines: 'greedy' },
  );
  assert.deepEqual(parsed.errors, [], `${path.relative(ROOT, filePath)} should parse without errors`);
  return { fields: parsed.meta.fields, rows: parsed.data };
};
const rowKey = (row) => `${clean(row.source)}\u0000${clean(row.plant_name)}`;
const integrityPublishedRowKey = (row) => (
  `${clean(row.source)}\u0000${clean(row.corrected_plant_name) || clean(row.plant_name)}`
);
const editDistance = (left, right) => {
  const matrix = Array.from({ length: left.length + 1 }, () => Array(right.length + 1).fill(0));
  for (let index = 0; index <= left.length; index += 1) matrix[index][0] = index;
  for (let index = 0; index <= right.length; index += 1) matrix[0][index] = index;
  for (let row = 1; row <= left.length; row += 1) {
    for (let column = 1; column <= right.length; column += 1) {
      matrix[row][column] = Math.min(
        matrix[row - 1][column] + 1,
        matrix[row][column - 1] + 1,
        matrix[row - 1][column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1),
      );
    }
  }
  return matrix[left.length][right.length];
};
const scientificBinomial = (value) => clean(value)
  .replace(/[()×.,]/gu, ' ')
  .split(/\s+/u)
  .filter(Boolean)
  .slice(0, 2);
const countBy = (rows, field) => rows.reduce((counts, row) => ({
  ...counts,
  [row[field]]: (counts[row[field]] || 0) + 1,
}), {});
const scope = JSON.parse(fs.readFileSync(SCOPE_PATH, 'utf8'));

test('the original-PDF ledgers seal the omission, identification, and integrity review scope', () => {
  const { rows: profileAudits } = parseCsv(PROFILE_AUDIT_PATH);
  const { rows: identificationAudits } = parseCsv(IDENTIFICATION_AUDIT_PATH);
  const { rows: integrityAudits } = parseCsv(INTEGRITY_AUDIT_PATH);
  const { rows: tokenAudits } = parseCsv(OCR_TOKEN_AUDIT_PATH);
  const { rows: nameAudits } = parseCsv(NAME_AUDIT_PATH);
  const { rows: taxonomyReviews } = parseCsv(TAXONOMY_REVIEW_PATH);

  assert.equal(
    sha256(PROFILE_AUDIT_PATH),
    scope.publication_rules.profile_ledger_sha256,
    'the profile decision ledger must match the sealed SHA-256',
  );
  assert.equal(
    sha256(NAME_AUDIT_PATH),
    scope.publication_rules.name_ledger_sha256,
    'the plant-name integrity ledger must match the sealed SHA-256',
  );
  assert.equal(
    sha256(TAXONOMY_REVIEW_PATH),
    scope.publication_rules.taxonomy_review_ledger_sha256,
    'the taxonomy follow-up review ledger must match the sealed SHA-256',
  );
  assert.equal(
    sha256(IDENTIFICATION_AUDIT_PATH),
    scope.publication_rules.identification_ledger_sha256,
    'the identification decision ledger must match the sealed SHA-256',
  );
  assert.equal(
    sha256(INTEGRITY_AUDIT_PATH),
    scope.publication_rules.integrity_ledger_sha256,
    'the profile integrity ledger must match the sealed SHA-256',
  );
  assert.equal(
    sha256(OCR_TOKEN_AUDIT_PATH),
    scope.publication_rules.ocr_token_ledger_sha256,
    'the representative OCR token verification ledger must match the sealed SHA-256',
  );
  assert.equal(scope.publication_rules.single_identification_owner_per_profile, true);
  assert.deepEqual(countBy(profileAudits, 'audit_batch'), scope.profile_audit_batches);
  assert.deepEqual(countBy(identificationAudits, 'audit_batch'), scope.identification_audit_batches);
  assert.equal(profileAudits.length, scope.coverage_reconciliation.total_profile_candidate_decisions);
  assert.equal(
    profileAudits.filter((row) => row.decision === 'include').length,
    scope.coverage_reconciliation.profile_candidates_included,
  );
  assert.equal(
    profileAudits.filter((row) => row.decision !== 'include').length,
    scope.coverage_reconciliation.profile_candidates_excluded,
  );
  assert.equal(
    profileAudits.filter((row) => row.decision === 'include' && clean(row.distinguishing_features)).length,
    scope.coverage_reconciliation.included_profile_rows_with_identification_content,
  );
  assert.equal(
    profileAudits.flatMap((row) => clean(row.remove_source_plant_name).split(';').filter(Boolean)).length,
    scope.coverage_reconciliation.obsolete_ocr_name_removal_targets,
  );
  assert.equal(identificationAudits.length, scope.identification_candidate_inventory.total_identification_decisions);
  const includedIdentification = identificationAudits.filter((row) => row.decision === 'include');
  assert.equal(includedIdentification.length, scope.identification_candidate_inventory.identification_rows_included);
  assert.equal(
    new Set(includedIdentification.map(rowKey)).size,
    scope.identification_candidate_inventory.published_identification_profiles,
  );
  const identificationOwners = new Map();
  const registerIdentificationOwner = (row, owner) => {
    const key = rowKey(row);
    if (!identificationOwners.has(key)) identificationOwners.set(key, new Set());
    identificationOwners.get(key).add(owner);
  };
  for (const row of profileAudits) {
    if (row.decision === 'include' && clean(row.distinguishing_features)) {
      registerIdentificationOwner(row, 'profile');
    }
  }
  for (const row of includedIdentification) registerIdentificationOwner(row, 'identification');
  for (const row of integrityAudits) {
    if (clean(row.distinguishing_features)) registerIdentificationOwner(row, 'integrity');
  }
  assert.deepEqual(
    [...identificationOwners.entries()].filter(([, owners]) => owners.size > 1),
    [],
    'each profile must get identification content from exactly one canonical audit ledger',
  );
  assert.equal(new Set(profileAudits.map((row) => row.audit_id)).size, profileAudits.length);
  assert.equal(new Set(identificationAudits.map((row) => row.audit_id)).size, identificationAudits.length);
  assert.equal(integrityAudits.length, scope.profile_integrity_review.corrections);
  assert.equal(new Set(integrityAudits.map((row) => row.audit_id)).size, integrityAudits.length);
  assert.equal(
    new Set(integrityAudits.map((row) => `${rowKey(row)}\u0000${row.field}`)).size,
    integrityAudits.length,
  );
  assert.equal(tokenAudits.length, scope.profile_integrity_review.verified_ocr_token_mappings);
  assert.equal(new Set(tokenAudits.map((row) => row.token)).size, tokenAudits.length);
  assert.equal(nameAudits.length, scope.name_integrity_review.corrections);
  assert.equal(new Set(nameAudits.map((row) => row.audit_id)).size, nameAudits.length);
  assert.equal(
    nameAudits.filter((row) => clean(row.corrected_plant_name)).length,
    scope.name_integrity_review.plant_name_corrections,
  );
  assert.equal(
    nameAudits.filter((row) => clean(row.corrected_scientific_name)).length,
    scope.name_integrity_review.scientific_name_corrections,
  );
  assert.equal(
    nameAudits.filter((row) => clean(row.corrected_genus_jp)).length,
    scope.name_integrity_review.genus_jp_corrections,
  );
  assert.equal(
    nameAudits.filter((row) => clean(row.corrected_genus_scientific)).length,
    scope.name_integrity_review.genus_scientific_corrections,
  );
  assert.equal(
    nameAudits.filter((row) => clean(row.corrected_family)).length,
    scope.name_integrity_review.family_corrections || 0,
  );
  assert.equal(
    nameAudits.filter((row) => clean(row.corrected_family_latin)).length,
    scope.name_integrity_review.family_latin_corrections || 0,
  );
  assert.equal(taxonomyReviews.length, scope.taxonomy_followup_review.candidates_reviewed);
  assert.equal(new Set(taxonomyReviews.map((row) => row.audit_id)).size, taxonomyReviews.length);
  assert.deepEqual(countBy(taxonomyReviews, 'decision'), scope.taxonomy_followup_review.decisions);
  assert.deepEqual(countBy(taxonomyReviews, 'audit_category'), scope.taxonomy_followup_review.categories);
  assert.deepEqual(countBy(taxonomyReviews, 'source'), scope.taxonomy_followup_review.source_rows);
  assert.ok(taxonomyReviews.every((row) => row.verification_method === 'original_pdf_visual_review'));
  const nameActionByKey = new Map(nameAudits.map((row) => [rowKey(row), row]));
  const correctionFieldByCategory = new Map([
    ['possible_ocr_latin_typo_against_ylist', 'corrected_scientific_name'],
    ['scientific_name_not_supported_by_ocr_page', 'corrected_scientific_name'],
    ['plant_name_not_supported_by_ocr_page', 'corrected_plant_name'],
    ['ylist_family_conflict', 'corrected_family'],
    ['ylist_family_latin_conflict', 'corrected_family_latin'],
  ]);
  for (const review of taxonomyReviews) {
    assert.ok(correctionFieldByCategory.has(review.audit_category), review.audit_id);
    assert.ok(clean(review.current_value), review.audit_id);
    assert.ok(clean(review.reference_value), review.audit_id);
    assert.ok(clean(review.verified_value), review.audit_id);
    assert.equal(review.reviewed_on, scope.reviewed_on, review.audit_id);
    assert.ok(clean(review.review_note), review.audit_id);
    const source = scope.sources[review.source];
    assert.ok(source, review.audit_id);
    assert.equal(review.source_pdf_file, source.pdf_file, review.audit_id);
    assert.equal(review.source_pdf_sha256, source.source_pdf_sha256, review.audit_id);
    const pdfPages = numericPageReferences(review.pdf_page);
    const printedPages = numericPageReferences(review.printed_page);
    assert.equal(pdfPages.length, printedPages.length, review.audit_id);
    assert.ok(pdfPages.every((page, index) => (
      Number.isInteger(page) && [2 * page - 2, 2 * page - 1].includes(printedPages[index])
    )), review.audit_id);
    if (review.decision === 'keep_source') {
      assert.equal(review.verified_value, review.current_value, review.audit_id);
      continue;
    }
    assert.equal(review.decision, 'correct_ocr', review.audit_id);
    assert.notEqual(review.verified_value, review.current_value, review.audit_id);
    const action = nameActionByKey.get(rowKey(review));
    assert.ok(action, `${review.audit_id} must have a name-integrity action`);
    assert.equal(
      clean(action[correctionFieldByCategory.get(review.audit_category)]),
      review.verified_value,
      review.audit_id,
    );
  }
  assert.equal(
    integrityAudits.filter((row) => row.verification_method === 'original_pdf_visual_review').length,
    scope.profile_integrity_review.individual_original_pdf_visual_corrections,
  );
  assert.equal(
    integrityAudits.filter((row) => (
      row.verification_method === 'original_pdf_full_field_visual_review'
    )).length,
    scope.profile_integrity_review.full_field_original_pdf_visual_corrections,
  );
  assert.equal(scope.profile_integrity_review.page_relocated_representative_mapping_corrections, 0);
  assert.equal(
    integrityAudits.filter((row) => row.decision === 'replace').length,
    scope.profile_integrity_review.field_replacements,
  );
  assert.equal(
    integrityAudits.filter((row) => row.decision === 'delete').length,
    scope.profile_integrity_review.field_deletions,
  );
  assert.equal(
    integrityAudits.filter((row) => row.decision === 'add').length,
    scope.profile_integrity_review.field_additions,
  );

  for (const [label, rows] of [
    ['profile', profileAudits],
    ['identification', identificationAudits],
  ]) {
    for (const row of rows) {
      assert.notEqual(row.decision, 'needs_review', `${label}: ${row.audit_id}`);
      assert.ok(row.decision === 'include' || row.decision.startsWith('exclude'), `${label}: ${row.audit_id}`);
      const source = scope.sources[row.source];
      assert.ok(source, `${label}: unknown source in ${row.audit_id}`);
      assert.equal(row.source_pdf_file, source.pdf_file, `${label}: ${row.audit_id}`);
      assert.equal(row.source_pdf_sha256, source.source_pdf_sha256, `${label}: ${row.audit_id}`);
      assert.equal(row.reviewed_on, scope.reviewed_on, `${label}: ${row.audit_id}`);
      assert.ok(clean(row.review_note), `${label}: ${row.audit_id} should explain the decision`);
      const pdfPages = numericPageReferences(row.pdf_page);
      const printedPages = numericPageReferences(row.printed_page);
      assert.ok(pdfPages.length > 0 && pdfPages.every((page) => (
        Number.isInteger(page) && page >= source.pdf_page_start && page <= source.pdf_page_end
      )), `${label}: ${row.audit_id}`);
      assert.ok(printedPages.length > 0 && printedPages.every((page) => (
        Number.isInteger(page) && page >= source.printed_page_start && page <= source.printed_page_end
      )), `${label}: ${row.audit_id}`);
      assert.equal(pdfPages.length, printedPages.length, `${label}: ${row.audit_id}`);
      assert.ok(pdfPages.every((page, index) => (
        [2 * page - 2, 2 * page - 1].includes(printedPages[index])
      )), `${label}: ${row.audit_id}`);
    }
  }

  for (const row of integrityAudits) {
    assert.ok(['add', 'replace', 'delete'].includes(row.decision), row.audit_id);
    assert.equal(Boolean(clean(row.after)), row.decision !== 'delete', row.audit_id);
    assert.equal(Boolean(clean(row.before)), row.decision !== 'add', row.audit_id);
    assert.ok([
      'original_pdf_visual_review',
      'original_pdf_full_field_visual_review',
    ].includes(row.verification_method), row.audit_id);
    if (row.verification_method === 'original_pdf_full_field_visual_review') {
      assert.match(row.review_note, /対象種欄全体を原PDF画像で目視確認/u, row.audit_id);
    }
    const source = scope.sources[row.source];
    assert.ok(source, row.audit_id);
    assert.equal(row.source_pdf_file, source.pdf_file, row.audit_id);
    assert.equal(row.source_pdf_sha256, source.source_pdf_sha256, row.audit_id);
    assert.equal(row.reviewed_on, scope.reviewed_on, row.audit_id);
    assert.ok(clean(row.review_note), row.audit_id);
    assert.ok(['merge', 'replace'].includes(clean(row.page_reference_action) || 'merge'), row.audit_id);
    if (clean(row.corrected_plant_name)) {
      assert.notEqual(row.corrected_plant_name, row.plant_name, row.audit_id);
      assert.match(row.corrected_plant_name, /^[一-龯々〆ヵヶぁ-んァ-ヶー]+$/u, row.audit_id);
    }
    if (clean(row.corrected_scientific_name)) {
      assert.match(row.corrected_scientific_name, /^(?:×\s*)?[A-Z][A-Za-z.-]+\s+/u, row.audit_id);
    }
    const pdfPages = numericPageReferences(row.pdf_page);
    const printedPages = numericPageReferences(row.printed_page);
    assert.equal(pdfPages.length, printedPages.length, row.audit_id);
    assert.ok(pdfPages.every((page, index) => (
      Number.isInteger(page) && [2 * page - 2, 2 * page - 1].includes(printedPages[index])
    )), row.audit_id);
    assert.equal(Boolean(clean(row.similar_taxa)), Boolean(clean(row.distinguishing_features)), row.audit_id);
    const approved = [row.after, row.distinguishing_features].join('\n');
    assert.doesNotMatch(approved, SUBJECTIVE_PATTERN, row.audit_id);
    assert.doesNotMatch(approved, CJK_SPACE_PATTERN, row.audit_id);
    assert.doesNotMatch(approved, PUNCTUATION_SPACE_PATTERN, row.audit_id);
    assert.doesNotMatch(approved, OCR_PUNCTUATION_PATTERN, row.audit_id);
    assert.doesNotMatch(approved, UNVERIFIED_ASSERTION_PATTERN, row.audit_id);
    assert.doesNotMatch(approved, KNOWN_OCR_CORRUPTION_PATTERN, row.audit_id);
    if (row.field !== 'distinguishing_features') {
      assert.doesNotMatch(row.after, HEADING_OR_PLATE_PATTERN, row.audit_id);
    }
  }

  for (const row of tokenAudits) {
    assert.equal(row.decision, 'confirmed', row.audit_id);
    assert.ok(clean(row.token) && clean(row.replacement) && row.token !== row.replacement, row.audit_id);
    assert.match(row.review_note, /置換対応を代表原画像/u, row.audit_id);
    assert.match(row.review_note, /全出現を目視監査したものではない/u, row.audit_id);
    const source = scope.sources[row.source];
    assert.ok(source, row.audit_id);
    assert.equal(row.source_pdf_file, source.pdf_file, row.audit_id);
    assert.equal(row.source_pdf_sha256, source.source_pdf_sha256, row.audit_id);
    assert.ok(
      [2 * Number(row.pdf_page) - 2, 2 * Number(row.pdf_page) - 1]
        .includes(Number(row.printed_page)),
      row.audit_id,
    );
  }
  for (const row of nameAudits) {
    const source = scope.sources[row.source];
    assert.ok(source, row.audit_id);
    assert.equal(row.source_pdf_file, source.pdf_file, row.audit_id);
    assert.equal(row.source_pdf_sha256, source.source_pdf_sha256, row.audit_id);
    assert.equal(row.reviewed_on, scope.reviewed_on, row.audit_id);
    assert.ok(
      clean(row.corrected_plant_name) ||
      clean(row.corrected_scientific_name) ||
      clean(row.corrected_genus_jp) ||
      clean(row.corrected_genus_scientific) ||
      clean(row.corrected_family) ||
      clean(row.corrected_family_latin),
      row.audit_id,
    );
    if (clean(row.scientific_name)) {
      assert.match(row.scientific_name, /^[A-Z][A-Za-z.-]+\s+/u, row.audit_id);
    }
    if (clean(row.corrected_scientific_name)) {
      assert.match(row.corrected_scientific_name, /^[A-Z][A-Za-z.-]+\s+/u, row.audit_id);
    }
    if (clean(row.corrected_genus_jp)) assert.match(row.corrected_genus_jp, /属$/u, row.audit_id);
    if (clean(row.corrected_genus_scientific)) {
      assert.match(row.corrected_genus_scientific, /^[A-Z][A-Za-z.-]+$/u, row.audit_id);
    }
    if (clean(row.corrected_family)) assert.match(row.corrected_family, /科$/u, row.audit_id);
    if (clean(row.corrected_family_latin)) {
      assert.match(row.corrected_family_latin, /^[A-Z][A-Z.-]+$/u, row.audit_id);
    }
  }

  for (const row of profileAudits.filter((candidate) => candidate.decision === 'include')) {
    assert.ok(FACT_FIELDS.some((field) => clean(row[field])), row.audit_id);
    assert.equal(Boolean(clean(row.similar_taxa)), Boolean(clean(row.distinguishing_features)), row.audit_id);
    const text = FACT_FIELDS.map((field) => row[field]).join('\n');
    assert.doesNotMatch(text, SUBJECTIVE_PATTERN, row.audit_id);
    assert.doesNotMatch(text, CJK_SPACE_PATTERN, row.audit_id);
    assert.doesNotMatch(text, PUNCTUATION_SPACE_PATTERN, row.audit_id);
    assert.doesNotMatch(text, OCR_PUNCTUATION_PATTERN, row.audit_id);
    assert.doesNotMatch(row.distinguishing_features, UNUSABLE_IDENTIFICATION_PATTERN, row.audit_id);
    assert.doesNotMatch(text, UNVERIFIED_ASSERTION_PATTERN, row.audit_id);
    assert.doesNotMatch(
      ['habit', 'height', 'flower_period', 'distribution', 'habitat']
        .map((field) => row[field])
        .join('\n'),
      MISPLACED_COMPARISON_PATTERN,
      row.audit_id,
    );
  }
  for (const row of identificationAudits.filter((candidate) => candidate.decision === 'include')) {
    assert.ok(clean(row.similar_taxa), row.audit_id);
    assert.ok(clean(row.approved_content), row.audit_id);
    assert.doesNotMatch(row.approved_content, SUBJECTIVE_PATTERN, row.audit_id);
    assert.doesNotMatch(row.approved_content, CJK_SPACE_PATTERN, row.audit_id);
    assert.doesNotMatch(row.approved_content, PUNCTUATION_SPACE_PATTERN, row.audit_id);
    assert.doesNotMatch(row.approved_content, OCR_PUNCTUATION_PATTERN, row.audit_id);
    assert.doesNotMatch(row.approved_content, UNUSABLE_IDENTIFICATION_PATTERN, row.audit_id);
    assert.doesNotMatch(row.approved_content, UNVERIFIED_ASSERTION_PATTERN, row.audit_id);
  }
});

test('the normalized plant profiles exactly reflect approved facts and contain no plate/index-only rows', () => {
  const { fields, rows } = parseCsv(PROFILE_PATH);
  const { rows: profileAudits } = parseCsv(PROFILE_AUDIT_PATH);
  const { rows: identificationAudits } = parseCsv(IDENTIFICATION_AUDIT_PATH);
  const { rows: integrityAudits } = parseCsv(INTEGRITY_AUDIT_PATH);
  const { rows: nameAudits } = parseCsv(NAME_AUDIT_PATH);
  assert.deepEqual(fields, PROFILE_HEADERS);
  assert.equal(rows.length, scope.published_result.profiles);
  assert.equal(
    rows.filter((row) => clean(row.distinguishing_features)).length,
    scope.published_result.profiles_with_distinguishing_features,
  );
  assert.equal(
    rows.filter((row) => /識別欄は原PDF画像目視確認/u.test(row.extraction_method)).length,
    scope.published_result.profiles_with_original_pdf_identification_review,
  );
  assert.equal(
    rows.filter((row) => clean(row.printed_page)).length,
    scope.published_result.profiles_with_printed_page_provenance,
  );
  assert.equal(new Set(rows.map(rowKey)).size, rows.length, 'each source/plant pair should be unique');
  const byKey = new Map(rows.map((row) => [rowKey(row), row]));
  const correctedNameByKey = new Map(nameAudits.map((row) => [
    rowKey(row),
    clean(row.corrected_plant_name) || clean(row.plant_name),
  ]));
  const nameAuditPublishedKey = (row) => (
    `${clean(row.source)}\u0000${clean(row.corrected_plant_name) || clean(row.plant_name)}`
  );
  const nameAuditBySourceName = new Map(nameAudits.map((row) => [rowKey(row), row]));
  const nameCorrectionField = new Map([
    ['scientific_name', 'corrected_scientific_name'],
    ['family', 'corrected_family'],
    ['family_latin', 'corrected_family_latin'],
    ['genus_jp', 'corrected_genus_jp'],
    ['genus_scientific', 'corrected_genus_scientific'],
  ]);
  const includedProfileAuditsByKey = new Map(
    profileAudits.filter((row) => row.decision === 'include').map((row) => [rowKey(row), row]),
  );
  const cleanups = new Map(
    identificationAudits
      .filter((row) => clean(row.cleanup_field))
      .map((row) => [`${rowKey(row)}\u0000${row.cleanup_field}`, row.cleanup_replacement]),
  );
  const integrityByTarget = new Map(
    integrityAudits.map((row) => [`${integrityPublishedRowKey(row)}\u0000${row.field}`, row.after]),
  );
  const integrityByProfile = new Map();
  for (const audit of integrityAudits) {
    if (!integrityByProfile.has(integrityPublishedRowKey(audit))) {
      integrityByProfile.set(integrityPublishedRowKey(audit), []);
    }
    integrityByProfile.get(integrityPublishedRowKey(audit)).push(audit);
  }

  for (const row of rows) {
    assert.ok(FACT_FIELDS.some((field) => clean(row[field])), rowKey(row));
    const source = scope.sources[row.source];
    assert.ok(source, `unknown source: ${rowKey(row)}`);
    const pdfPages = numericPageReferences(row.page);
    assert.ok(pdfPages.length > 0 && pdfPages.every((page) => (
      Number.isInteger(page) && page >= source.pdf_page_start && page <= source.pdf_page_end
    )), rowKey(row));
    if (row.printed_page) {
      const printedPages = numericPageReferences(row.printed_page);
      assert.ok(printedPages.length > 0 && printedPages.every((printedPage) => (
        pdfPages.some((pdfPage) => [2 * pdfPage - 2, 2 * pdfPage - 1].includes(printedPage))
      )), rowKey(row));
    }
    const text = FACT_FIELDS.map((field) => row[field]).join('\n');
    assert.doesNotMatch(text, SUBJECTIVE_PATTERN, rowKey(row));
    assert.doesNotMatch(text, CJK_SPACE_PATTERN, rowKey(row));
    assert.doesNotMatch(text, PUNCTUATION_SPACE_PATTERN, rowKey(row));
    assert.doesNotMatch(text, OCR_PUNCTUATION_PATTERN, rowKey(row));
    assert.doesNotMatch(text, UNVERIFIED_ASSERTION_PATTERN, rowKey(row));
    assert.doesNotMatch(text, KNOWN_OCR_CORRUPTION_PATTERN, rowKey(row));
    assert.doesNotMatch(
      ['habit', 'height', 'flower_period', 'distribution', 'habitat']
        .map((field) => row[field])
        .join('\n'),
      HEADING_OR_PLATE_PATTERN,
      rowKey(row),
    );
    assert.doesNotMatch(
      ['habit', 'height', 'flower_period', 'distribution', 'habitat']
        .map((field) => row[field])
        .join('\n'),
      MISPLACED_COMPARISON_PATTERN,
      rowKey(row),
    );
  }

  const profile = (source, plantName) => byKey.get(`${source}\u0000${plantName}`);
  assert.equal(
    profile('日本の野生植物 第1巻', 'ゴヨウマツ')?.distinguishing_features,
    'ゴヨウマツは冬芽の先がとがり、球果は長さ5～8 cm、径約3.5 cm、種子の翼は本体より短く折れやすい。キタゴヨウは冬芽の先が丸く、球果がやや大きく、種子の翼は本体と同長かそれより長い。',
  );
  assert.doesNotMatch(
    profile('日本の野生植物 第1巻', 'ミネハリイ')?.distinguishing_features || '',
    /翼/u,
  );
  assert.equal(
    profile('日本の野生植物 第1巻', 'ハツシマカンアオイ')?.similar_taxa,
    'タニムラカンアオイ',
  );
  assert.equal(
    profile('日本の野生植物 第2巻', 'ノダアカバナ')?.distinguishing_features,
    'ノダアカバナはカラフトアカバナやイワアカバナに似るが、花数が多い。',
  );
  assert.equal(
    profile('日本の野生植物 第2巻', 'オキナワハグマ')?.habitat,
    '照葉樹林の登山道沿いなどのやや明るい林床に生育する',
  );

  const rowsBySourcePage = new Map();
  for (const row of rows) {
    const pageKey = `${row.source}\u0000${row.page}`;
    if (!rowsBySourcePage.has(pageKey)) rowsBySourcePage.set(pageKey, []);
    rowsBySourcePage.get(pageKey).push(row);
  }
  for (const pageRows of rowsBySourcePage.values()) {
    for (let left = 0; left < pageRows.length; left += 1) {
      for (let right = left + 1; right < pageRows.length; right += 1) {
        const first = pageRows[left];
        const second = pageRows[right];
        if (editDistance(first.plant_name, second.plant_name) > 1) continue;
        const firstBinomial = scientificBinomial(first.scientific_name);
        const secondBinomial = scientificBinomial(second.scientific_name);
        if (firstBinomial.length < 2 || secondBinomial.length < 2) continue;
        const sameTaxonAfterOcr = editDistance(firstBinomial[0], secondBinomial[0]) <= 1 &&
          editDistance(firstBinomial[1], secondBinomial[1]) <= 1;
        assert.equal(
          sameTaxonAfterOcr,
          false,
          `probable retained OCR-name duplicate: ${rowKey(first)} / ${second.plant_name}`,
        );
      }
    }
  }

  for (const audit of profileAudits.filter((row) => row.decision === 'include')) {
    const publishedName = correctedNameByKey.get(rowKey(audit));
    const actual = byKey.get(publishedName ? `${audit.source}\u0000${publishedName}` : rowKey(audit));
    assert.ok(actual, audit.audit_id);
    for (const field of PROFILE_AUDIT_VALUE_FIELDS) {
      if (field === 'similar_taxa') {
        const actualTaxa = new Set(similarTaxaParts(actual.similar_taxa));
        for (const taxon of similarTaxaParts(audit.similar_taxa)) assert.ok(actualTaxa.has(taxon), audit.audit_id);
        continue;
      }
      if (field === 'distinguishing_features') {
        const actualSentences = new Set(identificationSentences(actual.distinguishing_features));
        for (const sentence of identificationSentences(audit.distinguishing_features)) {
          assert.ok(actualSentences.has(sentence), `${audit.audit_id}: ${sentence}`);
        }
        continue;
      }
      if (field === 'printed_page') {
        const actualPages = new Set(pageReferences(actual.printed_page));
        for (const page of pageReferences(audit.printed_page)) assert.ok(actualPages.has(page), audit.audit_id);
        continue;
      }
      const target = `${rowKey(audit)}\u0000${field}`;
      const cleanup = cleanups.get(target);
      const integrity = integrityByTarget.get(target);
      const beforeNameAudit = integrity === undefined
        ? (cleanup === undefined ? audit[field] : cleanup)
        : integrity;
      const correctionField = nameCorrectionField.get(field);
      const nameCorrection = correctionField
        ? clean(nameAuditBySourceName.get(rowKey(audit))?.[correctionField])
        : '';
      const expected = nameCorrection || beforeNameAudit;
      assert.equal(actual[field], expected, `${audit.audit_id}: ${field}`);
    }
    const actualPdfPages = new Set(pageReferences(actual.page));
    for (const page of pageReferences(audit.pdf_page)) assert.ok(actualPdfPages.has(page), audit.audit_id);
  }

  for (const audit of profileAudits.filter((row) => (
    row.decision.includes('already_covered') || /収録済み|被覆済み/u.test(row.review_note)
  ))) {
    assert.ok(
      byKey.has(rowKey(audit)),
      `${audit.audit_id} cannot claim prior coverage without a published source/name match`,
    );
  }

  for (const audit of profileAudits.filter((row) => row.decision === 'include')) {
    for (const obsoleteName of clean(audit.remove_source_plant_name).split(';').filter(Boolean)) {
      assert.equal(byKey.has(`${audit.source}\u0000${obsoleteName}`), false, audit.audit_id);
    }
  }

  const identificationGroups = new Map();
  for (const audit of identificationAudits.filter((row) => row.decision === 'include')) {
    const publishedName = correctedNameByKey.get(rowKey(audit));
    const publishedKey = publishedName ? `${audit.source}\u0000${publishedName}` : rowKey(audit);
    if (!identificationGroups.has(publishedKey)) identificationGroups.set(publishedKey, []);
    identificationGroups.get(publishedKey).push(audit);
  }
  for (const [key, audits] of identificationGroups) {
    const actual = byKey.get(key);
    assert.ok(actual, key);
    const profileAudit = includedProfileAuditsByKey.get(key);
    assert.equal(
      actual.similar_taxa,
      [...new Set([
        ...similarTaxaParts(profileAudit?.similar_taxa),
        ...audits.flatMap((row) => similarTaxaParts(row.similar_taxa)),
        ...(integrityByProfile.get(key) || []).flatMap((row) => similarTaxaParts(row.similar_taxa)),
      ])].join('、'),
      key,
    );
    assert.equal(
      actual.distinguishing_features,
      `${[...new Set([
        ...identificationSentences(profileAudit?.distinguishing_features),
        ...audits.flatMap((row) => identificationSentences(row.approved_content)),
        ...(integrityByProfile.get(key) || [])
          .flatMap((row) => identificationSentences(row.distinguishing_features)),
      ])].join('。')}。`,
      key,
    );
    assert.match(actual.extraction_method, /識別欄は原PDF画像目視確認/u, key);
    const actualPdfPages = new Set(pageReferences(actual.page));
    const actualPrintedPages = new Set(pageReferences(actual.printed_page));
    for (const audit of audits) {
      for (const page of pageReferences(audit.pdf_page)) assert.ok(actualPdfPages.has(page), audit.audit_id);
      for (const page of pageReferences(audit.printed_page)) assert.ok(actualPrintedPages.has(page), audit.audit_id);
    }
  }

  for (const audit of identificationAudits.filter((row) => clean(row.cleanup_field))) {
    const integrity = integrityByTarget.get(`${rowKey(audit)}\u0000${audit.cleanup_field}`);
    assert.equal(
      byKey.get(rowKey(audit))?.[audit.cleanup_field],
      integrity === undefined ? audit.cleanup_replacement : integrity,
      audit.audit_id,
    );
  }

  for (const audit of integrityAudits) {
    const actualKey = integrityPublishedRowKey(audit);
    const actual = byKey.get(actualKey);
    assert.ok(actual, audit.audit_id);
    assert.equal(actual[audit.field], audit.after, audit.audit_id);
    assert.match(
      actual.extraction_method,
      /本文欄は原PDF画像目視確認＋手動修正/u,
      audit.audit_id,
    );
    assert.doesNotMatch(
      actual.extraction_method,
      /本文欄は原PDF左右頁再定位＋代表字形確認済みOCR修正/u,
      audit.audit_id,
    );
    for (const page of pageReferences(audit.pdf_page)) {
      assert.ok(new Set(pageReferences(actual.page)).has(page), audit.audit_id);
    }
    for (const page of pageReferences(audit.printed_page)) {
      assert.ok(new Set(pageReferences(actual.printed_page)).has(page), audit.audit_id);
    }
  }

  for (const audit of nameAudits) {
    const actual = byKey.get(nameAuditPublishedKey(audit));
    assert.ok(actual, audit.audit_id);
    if (clean(audit.corrected_scientific_name)) {
      assert.equal(actual.scientific_name, audit.corrected_scientific_name, audit.audit_id);
    }
    assert.ok(new Set(pageReferences(actual.page)).has(audit.pdf_page), audit.audit_id);
    assert.ok(new Set(pageReferences(actual.printed_page)).has(audit.printed_page), audit.audit_id);
  }

  assert.ok(byKey.has('日本の野生植物 第2巻\u0000ブゾロイバナ'));
  assert.ok(!byKey.has('日本の野生植物 第2巻\u0000プゾロイバナ'));
  assert.ok(byKey.has('日本の野生植物 第2巻\u0000アブクマトラノオ'));
  assert.ok(!byKey.has('日本の野生植物 第2巻\u0000アプクマトラノオ'));
  assert.ok(byKey.has('日本の野生植物 第1巻\u0000ミヤマハハソ'));
  assert.ok(!byKey.has('日本の野生植物 第1巻\u0000ミヤマハハン'));
  assert.ok(byKey.has('日本の野生植物 第1巻\u0000ナンブソウ'));
  assert.ok(!byKey.has('日本の野生植物 第1巻\u0000ナンプソウ'));
  assert.equal(
    byKey.get('日本の野生植物 第1巻\u0000ナンブソウ')?.scientific_name,
    'Achlys japonica',
  );

  assert.equal(
    byKey.get('日本の野生植物 第1巻\u0000ナガバマムシグサ')?.habitat,
    '山地の林下に生える',
  );
  for (const plantName of ['エヒメテンナンショウ', 'コウライテンナンショウ', 'ウメガシマテンナンショウ']) {
    assert.doesNotMatch(
      byKey.get(`日本の野生植物 第1巻\u0000${plantName}`)?.habitat || '',
      /に[避違]する/u,
      plantName,
    );
  }
  const himeZazen = byKey.get('日本の野生植物 第1巻\u0000ヒメザゼンソウ');
  assert.equal(himeZazen?.habitat, '林縁や湿地などに生える');
  assert.match(himeZazen?.similar_taxa || '', /ザゼンソウ/u);
  assert.match(himeZazen?.distinguishing_features || '', /より小型/u);

  const awagoke = byKey.get('日本の野生植物 第2巻\u0000アワゴケ');
  assert.equal(
    awagoke?.distribution,
    '本州（宮城県以西）～琉球、台湾・中国・タイ（北部）に分布する',
  );
  assert.equal(awagoke?.similar_taxa, '');
  assert.equal(awagoke?.distinguishing_features, '');

  assert.equal(
    byKey.get('日本の野生植物 第2巻\u0000ニシキウツギ')?.distribution,
    '本州中部の太平洋型気候の山地にふつうに産する',
  );

  for (const [plantName, expectedPdfPages, expectedPrintedPages] of [
    ['カンアオイ', '32', '62;63'],
    ['イヌムギ', '150;151', '300'],
    ['ジュズダマ', '165;166', '330'],
    ['メノマンネングサ', '214;215', '428'],
    ['ダケカンバ', '286', '570;571'],
  ]) {
    const profile = byKey.get(`日本の野生植物 第1巻\u0000${plantName}`);
    assert.equal(profile?.page, expectedPdfPages, `${plantName}: preserve all PDF evidence pages`);
    assert.equal(profile?.printed_page, expectedPrintedPages, `${plantName}: preserve all printed evidence pages`);
  }
});

test('the production profile is byte-idempotent and a same-count substituted ledger is rejected', () => {
  const check = spawnSync(process.execPath, [APPLY_PATH, '--check'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.equal(check.status, 0, check.stderr || check.stdout);
  assert.match(check.stdout, /check passed/u);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wildplants-ledger-'));
  try {
    const alteredPath = path.join(dir, 'profile-audit.csv');
    const original = fs.readFileSync(PROFILE_AUDIT_PATH, 'utf8');
    fs.writeFileSync(alteredPath, original.replace('原PDF', '原本PDF'));
    assert.notEqual(fs.readFileSync(alteredPath, 'utf8'), original);
    const altered = spawnSync(process.execPath, [APPLY_PATH, '--check'], {
      cwd: ROOT,
      encoding: 'utf8',
      env: { ...process.env, WILDPLANTS_PROFILE_AUDIT_PATH: alteredPath },
    });
    assert.notEqual(altered.status, 0);
    assert.match(altered.stderr, /profile audit ledger SHA-256 mismatch/u);

    const alteredIntegrityPath = path.join(dir, 'integrity-audit.csv');
    const originalIntegrity = fs.readFileSync(INTEGRITY_AUDIT_PATH, 'utf8');
    fs.writeFileSync(
      alteredIntegrityPath,
      originalIntegrity.replace('original_pdf_visual_review', 'original_pdf_visual_check'),
    );
    assert.notEqual(fs.readFileSync(alteredIntegrityPath, 'utf8'), originalIntegrity);
    const alteredIntegrity = spawnSync(process.execPath, [APPLY_PATH, '--check'], {
      cwd: ROOT,
      encoding: 'utf8',
      env: { ...process.env, WILDPLANTS_INTEGRITY_AUDIT_PATH: alteredIntegrityPath },
    });
    assert.notEqual(alteredIntegrity.status, 0);
    assert.match(alteredIntegrity.stderr, /profile integrity audit ledger SHA-256 mismatch/u);

    const wrongPdfPath = path.join(dir, 'wrong-volume1.pdf');
    fs.writeFileSync(wrongPdfPath, 'not the audited source PDF');
    const wrongPdf = spawnSync(process.execPath, [APPLY_PATH, '--check'], {
      cwd: ROOT,
      encoding: 'utf8',
      env: { ...process.env, WILDPLANTS_VOLUME1_PDF_PATH: wrongPdfPath },
    });
    assert.notEqual(wrongPdf.status, 0);
    assert.match(wrongPdf.stderr, /WILDPLANTS_VOLUME1_PDF_PATH SHA-256 mismatch/u);

    const unknownColumnPath = path.join(dir, 'unknown-column.csv');
    const profileLines = fs.readFileSync(PROFILE_PATH, 'utf8').trimEnd().split('\n');
    fs.writeFileSync(
      unknownColumnPath,
      `${profileLines.map((line, index) => `${line},${index === 0 ? 'unexpected_column' : ''}`).join('\n')}\n`,
    );
    const unknownColumn = spawnSync(process.execPath, [APPLY_PATH, '--check'], {
      cwd: ROOT,
      encoding: 'utf8',
      env: { ...process.env, WILDPLANTS_PROFILE_PATH: unknownColumnPath },
    });
    assert.notEqual(unknownColumn.status, 0);
    assert.match(unknownColumn.stderr, /unexpected header/u);

    const duplicatePath = path.join(dir, 'duplicate-profile.csv');
    fs.writeFileSync(duplicatePath, `${profileLines.join('\n')}\n${profileLines.at(-1)}\n`);
    const duplicate = spawnSync(process.execPath, [APPLY_PATH, '--check'], {
      cwd: ROOT,
      encoding: 'utf8',
      env: { ...process.env, WILDPLANTS_PROFILE_PATH: duplicatePath },
    });
    assert.notEqual(duplicate.status, 0);
    assert.match(duplicate.stderr, /source\/name is duplicated/u);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('local builds and GitHub Pages fail closed when the wild-plant audit drifts', () => {
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_PATH, 'utf8'));
  const deployWorkflow = fs.readFileSync(DEPLOY_PATH, 'utf8');
  assert.match(pkg.scripts.prebuild, /npm run check:wildplants-audit/u);
  assert.match(pkg.scripts['build:data-lite'], /npm run check:wildplants-audit/u);
  assert.match(deployWorkflow, /run: npm run build:data-lite/u);
});

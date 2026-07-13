import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import Papa from 'papaparse';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

const PROFILE_PATH = process.env.WILDPLANTS_PROFILE_PATH
  ? path.resolve(process.env.WILDPLANTS_PROFILE_PATH)
  : path.join(ROOT, 'normalized_data', 'plant_profiles.csv');
const PROFILE_AUDIT_PATH = process.env.WILDPLANTS_PROFILE_AUDIT_PATH
  ? path.resolve(process.env.WILDPLANTS_PROFILE_AUDIT_PATH)
  : path.join(ROOT, 'data', 'source_audits', 'japanese-wild-plants-profile-completeness-2026-07-12.csv');
const IDENTIFICATION_AUDIT_PATH = process.env.WILDPLANTS_IDENTIFICATION_AUDIT_PATH
  ? path.resolve(process.env.WILDPLANTS_IDENTIFICATION_AUDIT_PATH)
  : path.join(ROOT, 'data', 'source_audits', 'japanese-wild-plants-identification-2026-07-12.csv');
const INTEGRITY_AUDIT_PATH = process.env.WILDPLANTS_INTEGRITY_AUDIT_PATH
  ? path.resolve(process.env.WILDPLANTS_INTEGRITY_AUDIT_PATH)
  : path.join(ROOT, 'data', 'source_audits', 'japanese-wild-plants-profile-integrity-2026-07-12.csv');
const OCR_TOKEN_AUDIT_PATH = process.env.WILDPLANTS_OCR_TOKEN_AUDIT_PATH
  ? path.resolve(process.env.WILDPLANTS_OCR_TOKEN_AUDIT_PATH)
  : path.join(ROOT, 'data', 'source_audits', 'japanese-wild-plants-ocr-token-verification-2026-07-12.csv');
const NAME_AUDIT_PATH = process.env.WILDPLANTS_NAME_AUDIT_PATH
  ? path.resolve(process.env.WILDPLANTS_NAME_AUDIT_PATH)
  : path.join(ROOT, 'data', 'source_audits', 'japanese-wild-plants-name-integrity-2026-07-12.csv');
const TAXONOMY_REVIEW_PATH = process.env.WILDPLANTS_TAXONOMY_REVIEW_PATH
  ? path.resolve(process.env.WILDPLANTS_TAXONOMY_REVIEW_PATH)
  : path.join(ROOT, 'data', 'source_audits', 'japanese-wild-plants-taxonomy-followup-2026-07-12.csv');
const SCOPE_PATH = process.env.WILDPLANTS_SCOPE_PATH
  ? path.resolve(process.env.WILDPLANTS_SCOPE_PATH)
  : path.join(ROOT, 'data', 'source_audits', 'japanese-wild-plants-source-scope-2026-07-12.json');

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
const LEGACY_PROFILE_HEADERS = PROFILE_HEADERS.filter((field) => ![
  'similar_taxa',
  'distinguishing_features',
  'printed_page',
].includes(field));

const PROFILE_FACT_FIELDS = [
  'habit',
  'height',
  'flower_period',
  'distribution',
  'habitat',
  'distinguishing_features',
];
const PROFILE_VALUE_FIELDS = [
  'scientific_name',
  'family',
  'family_latin',
  'genus_jp',
  'genus_scientific',
  ...PROFILE_FACT_FIELDS,
  'similar_taxa',
  'printed_page',
];
const CLEANUP_FIELDS = new Set(['habit', 'height', 'flower_period', 'distribution', 'habitat']);
const INTEGRITY_FIELDS = new Set([...PROFILE_FACT_FIELDS, 'page']);
const INTEGRITY_VERIFICATION_METHODS = new Set([
  'original_pdf_visual_review',
  'original_pdf_full_field_visual_review',
]);
const TAXONOMY_REVIEW_ACTION_FIELD = new Map([
  ['possible_ocr_latin_typo_against_ylist', 'corrected_scientific_name'],
  ['scientific_name_not_supported_by_ocr_page', 'corrected_scientific_name'],
  ['plant_name_not_supported_by_ocr_page', 'corrected_plant_name'],
  ['ylist_family_conflict', 'corrected_family'],
  ['ylist_family_latin_conflict', 'corrected_family_latin'],
]);
const NAME_AUDIT_CORRECTED_FIELD = new Map([
  ['scientific_name', 'corrected_scientific_name'],
  ['family', 'corrected_family'],
  ['family_latin', 'corrected_family_latin'],
  ['genus_jp', 'corrected_genus_jp'],
  ['genus_scientific', 'corrected_genus_scientific'],
]);
const SUBJECTIVE_PATTERN = /美し|優美|上品|豪壮|幸福|至福|うれし|嬉し|楽しい|かっこ|格好|魅力|観賞価値|条件に恵まれ|採集者|コレクション|珍品/;
const CONCRETE_IDENTIFICATION_PATTERN = /葉|花|果|毛|茎|枝|芽|葯|雄しべ|雌しべ|雄蕊|雌蕊|萼|苞|種子|球果|鱗片|花序|葉柄|葉鞘|花柱|柱頭|心皮|縫合|蒴果|痩果|小穂|果胞|総苞|舌状花|冠毛|腺|刺|棘|匍匐|直立|根茎|地下茎|稈|節|翼|髄|株|芒|包穎|護穎|ロゼット|倍体|染色体|花粉粒|距|唇弁|蕊柱|胚珠|花床|花被片|つる|蔓|巻き|一年草|多年草|草本|半低木|低木|高木|常緑|落葉|大型|小型|大きい|小さい|細い|太い|短い|長い|広い|狭い|厚い|薄い|多い|少ない|生え|生育|開花|花期|長さ|草丈|幅|高さ|径|色|形|裂|脈|個|mm|cm| m(?:$|[^a-z])/i;
const UNUSABLE_IDENTIFICATION_PATTERN = /区別できない|判別できない|同定できない|中間型があり|雑種と推定|推定される/;
const MISPLACED_COMPARISON_PATTERN = /似る|近縁|区別|に比べ|と異な|よりやや(?:大型|小型|長|短|広|狭|厚|薄|多|少)/;
const UNVERIFIED_ASSERTION_PATTERN = /[?？]|推定|と思|とされ|と考え|可能性|疑問符|見解がある|おそらく|疑わし|不明|らしい|といわれ|であろう|わからない|説もある/;
const HEADING_OR_PLATE_PATTERN = /\b[A-Z][a-z]+(?:\s+(?:×\s*)?[a-z][A-Za-z.-]*)+\b|[（(]?[PＰ][LＬ.]?\s*\d+/u;
const KNOWN_OCR_CORRUPTION_PATTERN = /林緑|治海地|広薬|掃化|針薬|落薬|掛林|温原|材林|熟帯|荷林|プナ帯|楽林|業林|洗水|相林|道ぼた|横林|吐感喇|波蝕能上の街中|吐略射列島|満に|東開アジア|飯島|薬は|際半島|照楽勘林|酉太平洋|洸水|千潟|寒器|地瑚礁|酸陵品|棋林|広城|フィリビン|阪島|桝林|針業荷林|広楽林|広業林|琉琉球|探集|昼久島|植裁|吐感射列島|以商|開麟|薬が|專の形質|化序|吐畷射列島|に[避違]する|吐鴨喇|海美半島|薬裏|，、|山離|広楽|林線|常線|浴葉|開喫|吐鳴喇|南部島膜|開側|機験島|プナ帝|多営地|針楽街休|要南省|以率|橋林|常緑酵林|以酒|落棄樹林|楜林|常緑広棄林|朝鮮半品|亜寒番|亜寒待|多年章|観質|霧ヶ絲|陳林|伯者大山|丘険地|白馬店|夕張缶|毎枝|制技|海水地|全殿|品後|科面基部|開願|提防|出憩|伯者|浦限|全士|四因|朝鮮半鳥|街路間|睡道|治岸|菌アジア|痛る|山糸|夏緑橋林|製素|厳阜|蘭焼|常緑勘林|租子島|鹿島槍ヶ缶|禁島|吐蠣開列島|吐職刺列島|常緑萄林|吐蠣喇列島|九レ州|吐略刺列島|常緑材|常麻|専筒|照薬萄林|照棄街林|隠枝|千薬県|九州産部|八ヶ醤|無帯/u;

const clean = (value) => String(value ?? '')
  .replace(/\u3000/g, ' ')
  .replace(/\r\n?/g, '\n')
  .replace(/[ \t\n]+/g, ' ')
  .trim();

const parsePageReferences = (value) => {
  const references = clean(value).split(';').map((part) => part.trim()).filter(Boolean);
  if (references.length === 0 || references.some((part) => !/^\d+$/.test(part))) return null;
  return references.map(Number);
};

const mergePageReferences = (current, additions) => [...new Set([
  ...clean(current).split(';').map((part) => part.trim()).filter(Boolean),
  ...additions.flatMap((value) => clean(value).split(';').map((part) => part.trim()).filter(Boolean)),
])].join(';');

const splitSimilarTaxa = (value) => clean(value)
  .split(/[、／/;]+/u)
  .map((part) => part.trim())
  .filter(Boolean);

const splitIdentificationSentences = (value) => clean(value)
  .split(/[。．]+/u)
  .map((part) => part.trim())
  .filter(Boolean);

const normalizeLayoutWhitespace = (value) => {
  let text = clean(value);
  text = text
    .replace(/，/gu, '、')
    .replace(/(?<=\d)\s*ー\s*(?=\d)/gu, '～');
  const cjk = '[一-龯々〆ヵヶぁ-んァ-ヶー]';
  let previous = '';
  while (text !== previous) {
    previous = text;
    text = text.replace(new RegExp(`(${cjk}) +(${cjk})`, 'g'), '$1$2');
  }
  text = text
    .replace(new RegExp(`([、。，．；：・]) +(?=${cjk})`, 'g'), '$1')
    .replace(new RegExp(`(${cjk}) +(?=[、。，．；：・）])`, 'g'), '$1')
    .replace(/（ +/g, '（')
    .replace(/ +）/g, '）');
  return text;
};

const PROFILE_LAYOUT_FIELDS = new Set([
  'plant_name',
  'family',
  'genus_jp',
  ...PROFILE_FACT_FIELDS,
  'similar_taxa',
]);

const readCsv = (filePath, acceptedHeaderSets = null) => {
  const source = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const parsed = Papa.parse(source, { header: true, skipEmptyLines: 'greedy' });
  if (parsed.errors.length > 0) {
    throw new Error(`${path.relative(ROOT, filePath)}: ${parsed.errors[0].message}`);
  }
  if (acceptedHeaderSets && !acceptedHeaderSets.some((expected) => (
    expected.length === parsed.meta.fields?.length &&
    expected.every((field, index) => field === parsed.meta.fields[index])
  ))) {
    throw new Error(`${path.relative(ROOT, filePath)} has an unexpected header; refusing to drop or invent columns`);
  }
  return parsed.data.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, clean(value)])));
};

const sha256File = (filePath) => crypto
  .createHash('sha256')
  .update(fs.readFileSync(filePath))
  .digest('hex');

const validateLedgerHash = (scope, field, filePath, label) => {
  const expected = clean(scope.publication_rules?.[field]);
  if (!/^[a-f0-9]{64}$/.test(expected)) {
    throw new Error(`source scope is missing a valid ${field}`);
  }
  const actual = sha256File(filePath);
  if (actual !== expected) {
    throw new Error(`${label} SHA-256 mismatch: ${actual} != ${expected}`);
  }
};

const validateOptionalSourcePdfs = (scope) => {
  for (const source of Object.values(scope.sources || {})) {
    const envName = `WILDPLANTS_VOLUME${clean(source.volume)}_PDF_PATH`;
    const configuredPath = clean(process.env[envName]);
    if (!configuredPath) continue;
    const pdfPath = path.resolve(configuredPath);
    if (!fs.existsSync(pdfPath)) throw new Error(`${envName} does not exist: ${pdfPath}`);
    const actual = sha256File(pdfPath);
    if (actual !== clean(source.source_pdf_sha256)) {
      throw new Error(`${envName} SHA-256 mismatch: ${actual} != ${source.source_pdf_sha256}`);
    }
  }
};

const hasFacts = (row) => PROFILE_FACT_FIELDS.some((field) => clean(row[field]));
const factScore = (row) => PROFILE_FACT_FIELDS.reduce((score, field) => score + (clean(row[field]) ? 1 : 0), 0);
const rowKey = (row) => `${clean(row.source)}\u0000${clean(row.plant_name)}`;
const isSingleJapanesePlantName = (value) => /^[一-龯々〆ヵヶぁ-んァ-ヶー]+$/.test(clean(value));

const assertReviewedDecision = (row, label) => {
  const decision = clean(row.decision);
  if (decision === 'needs_review' || !decision) {
    throw new Error(`${label} is not completely reviewed: ${row.audit_id || row.candidate_id || row.plant_name}`);
  }
  if (decision !== 'include' && decision !== 'exclude' && !decision.startsWith('exclude_')) {
    throw new Error(`${label} has unsupported decision ${decision}: ${row.audit_id || row.candidate_id || row.plant_name}`);
  }
};

const sourceMetadata = (scope, row, label) => {
  const source = clean(row.source);
  const meta = scope.sources?.[source];
  if (!meta) throw new Error(`${label} has unknown source: ${source}`);
  if (clean(row.volume) && clean(row.volume) !== clean(meta.volume)) {
    throw new Error(`${label} volume mismatch: ${row.audit_id}`);
  }
  if (clean(row.source_pdf_file) !== clean(meta.pdf_file)) {
    throw new Error(`${label} PDF filename mismatch: ${row.audit_id}`);
  }
  if (clean(row.source_pdf_sha256) !== clean(meta.source_pdf_sha256)) {
    throw new Error(`${label} PDF hash mismatch: ${row.audit_id}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean(row.reviewed_on))) {
    throw new Error(`${label} has invalid review date: ${row.audit_id}`);
  }
  if (!clean(row.review_note)) throw new Error(`${label} is missing review_note: ${row.audit_id}`);
  const pdfPages = parsePageReferences(row.pdf_page);
  const printedPages = parsePageReferences(row.printed_page);
  if (!pdfPages || pdfPages.some((page) => page < meta.pdf_page_start || page > meta.pdf_page_end)) {
    throw new Error(`${label} PDF page is outside the audited text: ${row.audit_id}`);
  }
  if (!printedPages || printedPages.some((page) => page < meta.printed_page_start || page > meta.printed_page_end)) {
    throw new Error(`${label} printed page is outside the audited text: ${row.audit_id}`);
  }
  if (pdfPages.length !== printedPages.length || pdfPages.some((page, index) => (
    ![2 * page - 2, 2 * page - 1].includes(printedPages[index])
  ))) {
    throw new Error(`${label} PDF/printed page mapping mismatch: ${row.audit_id}`);
  }
  return meta;
};

const validateUniqueIds = (rows, label) => {
  const seen = new Set();
  for (const row of rows) {
    const auditId = clean(row.audit_id);
    if (!auditId) throw new Error(`${label} row is missing audit_id`);
    if (seen.has(auditId)) throw new Error(`${label} has duplicate audit_id: ${auditId}`);
    seen.add(auditId);
  }
};

const validateBatchCounts = (rows, expected, label) => {
  const counts = new Map();
  for (const row of rows) {
    const batch = clean(row.audit_batch);
    if (!batch) throw new Error(`${label} row is missing audit_batch: ${row.audit_id}`);
    counts.set(batch, (counts.get(batch) || 0) + 1);
  }
  for (const [batch, expectedCount] of Object.entries(expected || {})) {
    if (counts.get(batch) !== expectedCount) {
      throw new Error(`${label} batch count mismatch for ${batch}: ${counts.get(batch) || 0} != ${expectedCount}`);
    }
    counts.delete(batch);
  }
  if (counts.size > 0) throw new Error(`${label} has unexpected audit_batch: ${[...counts.keys()].join(', ')}`);
};

const validateProfileAudits = (scope, rows) => {
  validateUniqueIds(rows, 'profile audit');
  validateBatchCounts(rows, scope.profile_audit_batches, 'profile audit');
  const includedKeys = new Set();
  for (const row of rows) {
    assertReviewedDecision(row, 'profile audit');
    sourceMetadata(scope, row, 'profile audit');
    const obsoleteNames = clean(row.remove_source_plant_name).split(';').filter(Boolean);
    if (row.decision !== 'include' && obsoleteNames.length > 0) {
      throw new Error(`Excluded profile must not remove an OCR name: ${row.audit_id}`);
    }
    for (const obsoleteName of obsoleteNames) {
      if (!isSingleJapanesePlantName(obsoleteName) || obsoleteName === clean(row.plant_name)) {
        throw new Error(`Invalid remove_source_plant_name: ${row.audit_id}`);
      }
    }
    if (row.decision !== 'include') continue;
    if (!isSingleJapanesePlantName(row.plant_name)) {
      throw new Error(`Included profile must target one Japanese plant name: ${row.audit_id}`);
    }
    if (!hasFacts(row)) throw new Error(`Included profile has no objective facts: ${row.audit_id}`);
    if (includedKeys.has(rowKey(row))) throw new Error(`Duplicate included profile: ${rowKey(row)}`);
    includedKeys.add(rowKey(row));
    for (const field of PROFILE_FACT_FIELDS) {
      const value = clean(row[field]);
      if (!value) continue;
      if (value !== normalizeLayoutWhitespace(value)) {
        throw new Error(`Profile still contains OCR layout whitespace (${field}): ${row.audit_id}`);
      }
      if (SUBJECTIVE_PATTERN.test(value)) {
        throw new Error(`Profile contains subjective/editorial prose (${field}): ${row.audit_id}`);
      }
      if (UNVERIFIED_ASSERTION_PATTERN.test(value)) {
        throw new Error(`Profile contains an unverified or speculative assertion (${field}): ${row.audit_id}`);
      }
      const limit = field === 'distinguishing_features' ? 320 : 240;
      if (value.length > limit) throw new Error(`Profile summary is too long (${field}): ${row.audit_id}`);
    }
    for (const field of ['habit', 'height', 'flower_period', 'distribution', 'habitat']) {
      if (MISPLACED_COMPARISON_PATTERN.test(clean(row[field]))) {
        throw new Error(`Profile comparison leaked into ${field}: ${row.audit_id}`);
      }
    }
    if (Boolean(clean(row.similar_taxa)) !== Boolean(clean(row.distinguishing_features))) {
      throw new Error(`Profile comparison fields must be paired: ${row.audit_id}`);
    }
    const distinguishingFeatures = clean(row.distinguishing_features);
    if (distinguishingFeatures && !CONCRETE_IDENTIFICATION_PATTERN.test(distinguishingFeatures)) {
      throw new Error(`Profile comparison has no concrete differentiating trait: ${row.audit_id}`);
    }
    if (UNUSABLE_IDENTIFICATION_PATTERN.test(distinguishingFeatures)) {
      throw new Error(`Profile comparison is vague, speculative, or unusable: ${row.audit_id}`);
    }
  }
};

const validateIdentificationAudits = (scope, rows) => {
  validateUniqueIds(rows, 'identification audit');
  validateBatchCounts(rows, scope.identification_audit_batches, 'identification audit');
  for (const row of rows) {
    assertReviewedDecision(row, 'identification audit');
    sourceMetadata(scope, row, 'identification audit');
    if (clean(row.cleanup_field) && !CLEANUP_FIELDS.has(clean(row.cleanup_field))) {
      throw new Error(`Unsupported cleanup_field: ${row.audit_id}`);
    }
    if (clean(row.cleanup_field) && !clean(row.cleanup_current_value)) {
      throw new Error(`Cleanup row is missing cleanup_current_value: ${row.audit_id}`);
    }
    const cleanupIntermediateValue = normalizeLayoutWhitespace(row.cleanup_intermediate_value);
    if (
      cleanupIntermediateValue &&
      cleanupIntermediateValue === normalizeLayoutWhitespace(row.cleanup_current_value)
    ) {
      throw new Error(`Cleanup intermediate value duplicates its source value: ${row.audit_id}`);
    }
    const cleanupReplacement = clean(row.cleanup_replacement);
    if (cleanupReplacement !== normalizeLayoutWhitespace(cleanupReplacement)) {
      throw new Error(`Cleanup replacement still contains OCR layout whitespace: ${row.audit_id}`);
    }
    if (SUBJECTIVE_PATTERN.test(cleanupReplacement) || UNVERIFIED_ASSERTION_PATTERN.test(cleanupReplacement)) {
      throw new Error(`Cleanup replacement contains subjective/editorial or unverified prose: ${row.audit_id}`);
    }
    if (row.decision !== 'include') continue;
    const plantName = clean(row.plant_name);
    const similarTaxa = clean(row.similar_taxa);
    const approved = clean(row.approved_content);
    if (!isSingleJapanesePlantName(plantName) || !similarTaxa || !approved) {
      throw new Error(`Included identification row is incomplete: ${row.audit_id}`);
    }
    if (approved !== normalizeLayoutWhitespace(approved)) {
      throw new Error(`Identification text still contains OCR layout whitespace: ${row.audit_id}`);
    }
    if (SUBJECTIVE_PATTERN.test(approved)) {
      throw new Error(`Identification text contains subjective/editorial prose: ${row.audit_id}`);
    }
    if (UNVERIFIED_ASSERTION_PATTERN.test(approved)) {
      throw new Error(`Identification text contains an unverified or speculative assertion: ${row.audit_id}`);
    }
    if (!CONCRETE_IDENTIFICATION_PATTERN.test(approved)) {
      throw new Error(`Identification text has no concrete differentiating trait: ${row.audit_id}`);
    }
    if (UNUSABLE_IDENTIFICATION_PATTERN.test(approved)) {
      throw new Error(`Identification text is vague, speculative, or unusable: ${row.audit_id}`);
    }
    if (approved.length > 320 || similarTaxa.length > 120) {
      throw new Error(`Identification summary is too long: ${row.audit_id}`);
    }
  }
};

const validateIntegrityAudits = (scope, rows, tokenMappings) => {
  validateUniqueIds(rows, 'profile integrity audit');
  const targets = new Set();
  for (const row of rows) {
    sourceMetadata(scope, row, 'profile integrity audit');
    const field = clean(row.field);
    const decision = clean(row.decision);
    const correctedPlantName = clean(row.corrected_plant_name);
    const correctedScientificName = clean(row.corrected_scientific_name);
    const pageReferenceAction = clean(row.page_reference_action) || 'merge';
    const before = normalizeLayoutWhitespace(row.before);
    const intermediateAfter = normalizeLayoutWhitespace(row.intermediate_after);
    const after = normalizeLayoutWhitespace(row.after);
    const target = `${rowKey(row)}\u0000${field}`;
    if (!INTEGRITY_FIELDS.has(field)) {
      throw new Error(`Unsupported profile integrity field: ${row.audit_id}`);
    }
    if (
      correctedPlantName &&
      (!isSingleJapanesePlantName(correctedPlantName) || correctedPlantName === clean(row.plant_name))
    ) {
      throw new Error(`Invalid corrected_plant_name: ${row.audit_id}`);
    }
    if (
      correctedScientificName &&
      !/^(?:×\s*)?[A-Z][A-Za-z.-]+(?:\s+(?:×\s*)?[a-z][A-Za-z.-]+)+(?:\s+.+)?$/u.test(
        correctedScientificName,
      )
    ) {
      throw new Error(`Invalid corrected_scientific_name: ${row.audit_id}`);
    }
    if (!['merge', 'replace'].includes(pageReferenceAction)) {
      throw new Error(`Invalid page_reference_action: ${row.audit_id}`);
    }
    if (decision === 'add' ? Boolean(before) : !before) {
      throw new Error(`Profile integrity before text does not match its decision: ${row.audit_id}`);
    }
    if (intermediateAfter && intermediateAfter === before) {
      throw new Error(`Profile integrity intermediate_after duplicates before: ${row.audit_id}`);
    }
    if (!['add', 'replace', 'delete'].includes(decision)) {
      throw new Error(`Profile integrity row has unsupported decision: ${row.audit_id}`);
    }
    if ((decision !== 'delete') !== Boolean(after)) {
      throw new Error(`Profile integrity decision/after mismatch: ${row.audit_id}`);
    }
    if (!INTEGRITY_VERIFICATION_METHODS.has(clean(row.verification_method))) {
      throw new Error(`Profile integrity row has unsupported verification_method: ${row.audit_id}`);
    }
    const claimedTokenMappings = [...clean(row.review_note).matchAll(/OCR誤読「([^」]+)」を「([^」]+)」/gu)];
    if (
      clean(row.verification_method) === 'original_pdf_full_field_visual_review' &&
      !/対象種欄全体を原PDF画像で目視確認/u.test(clean(row.review_note))
    ) {
      throw new Error(`Full-field correction lacks an explicit original-PDF review note: ${row.audit_id}`);
    }
    for (const match of claimedTokenMappings) {
      if (tokenMappings.get(match[1]) !== match[2]) {
        throw new Error(`Profile integrity row cites an unverified OCR token mapping: ${row.audit_id}`);
      }
    }
    if (targets.has(target)) throw new Error(`Profile integrity target is duplicated: ${target}`);
    targets.add(target);
    if (after !== clean(row.after)) {
      throw new Error(`Profile integrity replacement still contains OCR layout whitespace: ${row.audit_id}`);
    }
    if (SUBJECTIVE_PATTERN.test(after) || UNVERIFIED_ASSERTION_PATTERN.test(after)) {
      throw new Error(`Profile integrity replacement retains editorial or unverified prose: ${row.audit_id}`);
    }
    if (KNOWN_OCR_CORRUPTION_PATTERN.test(after)) {
      throw new Error(`Profile integrity replacement retains a known OCR error: ${row.audit_id}`);
    }
    if (field !== 'distinguishing_features' && HEADING_OR_PLATE_PATTERN.test(after)) {
      throw new Error(`Profile integrity replacement retains a heading or plate label: ${row.audit_id}`);
    }
    const similarTaxa = clean(row.similar_taxa);
    const distinguishingFeatures = normalizeLayoutWhitespace(row.distinguishing_features);
    if (Boolean(similarTaxa) !== Boolean(distinguishingFeatures)) {
      throw new Error(`Profile integrity comparison fields must be paired: ${row.audit_id}`);
    }
    if (distinguishingFeatures) {
      if (!CONCRETE_IDENTIFICATION_PATTERN.test(distinguishingFeatures)) {
        throw new Error(`Profile integrity comparison has no concrete trait: ${row.audit_id}`);
      }
      if (
        SUBJECTIVE_PATTERN.test(distinguishingFeatures) ||
        UNVERIFIED_ASSERTION_PATTERN.test(distinguishingFeatures) ||
        UNUSABLE_IDENTIFICATION_PATTERN.test(distinguishingFeatures) ||
        KNOWN_OCR_CORRUPTION_PATTERN.test(distinguishingFeatures)
      ) {
        throw new Error(`Profile integrity comparison is not publishable: ${row.audit_id}`);
      }
    }
  }
};

const validateIdentificationOwnership = (profileAudits, identificationAudits, integrityAudits) => {
  const ownersByProfile = new Map();
  const register = (row, owner) => {
    const target = rowKey(row);
    if (!ownersByProfile.has(target)) ownersByProfile.set(target, new Set());
    ownersByProfile.get(target).add(owner);
  };

  for (const row of profileAudits) {
    if (row.decision === 'include' && clean(row.distinguishing_features)) register(row, 'profile');
  }
  for (const row of identificationAudits) {
    if (row.decision === 'include') register(row, 'identification');
  }
  for (const row of integrityAudits) {
    if (clean(row.distinguishing_features)) register(row, 'integrity');
  }

  const overlaps = [...ownersByProfile.entries()]
    .filter(([, owners]) => owners.size > 1)
    .map(([target, owners]) => `${target.replace('\u0000', ' / ')} (${[...owners].join(', ')})`);
  if (overlaps.length > 0) {
    throw new Error(
      `Identification content must have one canonical audit owner per profile: ${overlaps.join('; ')}`,
    );
  }
};

const validateOcrTokenAudits = (scope, rows) => {
  validateUniqueIds(rows, 'OCR token verification audit');
  const mappings = new Map();
  for (const row of rows) {
    sourceMetadata(scope, row, 'OCR token verification audit');
    const token = clean(row.token);
    const replacement = clean(row.replacement);
    if (clean(row.decision) !== 'confirmed' || !token || !replacement || token === replacement) {
      throw new Error(`Invalid OCR token verification row: ${row.audit_id}`);
    }
    if (mappings.has(token)) throw new Error(`Duplicate OCR token verification: ${token}`);
    mappings.set(token, replacement);
    if (!/全出現を目視監査したものではない/u.test(clean(row.review_note))) {
      throw new Error(`OCR token verification must state its representative scope: ${row.audit_id}`);
    }
  }
  if (rows.length !== scope.profile_integrity_review?.verified_ocr_token_mappings) {
    throw new Error(
      `OCR token verification count mismatch: ${rows.length} != ` +
      `${scope.profile_integrity_review?.verified_ocr_token_mappings}`,
    );
  }
  return mappings;
};

const validateNameAudits = (scope, rows) => {
  validateUniqueIds(rows, 'plant-name integrity audit');
  const targets = new Set();
  for (const row of rows) {
    sourceMetadata(scope, row, 'plant-name integrity audit');
    const plantName = clean(row.plant_name);
    const correctedPlantName = clean(row.corrected_plant_name);
    const scientificName = clean(row.scientific_name);
    const correctedScientificName = clean(row.corrected_scientific_name);
    const genusJp = clean(row.genus_jp);
    const correctedGenusJp = clean(row.corrected_genus_jp);
    const genusScientific = clean(row.genus_scientific);
    const correctedGenusScientific = clean(row.corrected_genus_scientific);
    const family = clean(row.family);
    const correctedFamily = clean(row.corrected_family);
    const familyLatin = clean(row.family_latin);
    const correctedFamilyLatin = clean(row.corrected_family_latin);
    if (!isSingleJapanesePlantName(plantName)) {
      throw new Error(`Plant-name integrity row has an invalid source name: ${row.audit_id}`);
    }
    if (
      correctedPlantName &&
      (!isSingleJapanesePlantName(correctedPlantName) || correctedPlantName === plantName)
    ) {
      throw new Error(`Plant-name integrity row has an invalid corrected name: ${row.audit_id}`);
    }
    if (scientificName && !/^[A-Z][A-Za-z.-]+\s+/u.test(scientificName)) {
      throw new Error(`Plant-name integrity row has an invalid source scientific name: ${row.audit_id}`);
    }
    if (
      correctedScientificName &&
      (correctedScientificName === scientificName || !/^[A-Z][A-Za-z.-]+\s+/u.test(correctedScientificName))
    ) {
      throw new Error(`Plant-name integrity row has an invalid corrected scientific name: ${row.audit_id}`);
    }
    if (correctedGenusJp && ((genusJp && correctedGenusJp === genusJp) || !correctedGenusJp.endsWith('属'))) {
      throw new Error(`Plant-name integrity row has an invalid corrected Japanese genus: ${row.audit_id}`);
    }
    if (
      correctedGenusScientific &&
      ((genusScientific && correctedGenusScientific === genusScientific) || !/^[A-Z][A-Za-z.-]+$/u.test(correctedGenusScientific))
    ) {
      throw new Error(`Plant-name integrity row has an invalid corrected scientific genus: ${row.audit_id}`);
    }
    if (correctedFamily && ((family && correctedFamily === family) || !correctedFamily.endsWith('科'))) {
      throw new Error(`Plant-name integrity row has an invalid corrected family: ${row.audit_id}`);
    }
    if (
      correctedFamilyLatin &&
      ((familyLatin && correctedFamilyLatin === familyLatin) || !/^[A-Z][A-Z.-]+$/u.test(correctedFamilyLatin))
    ) {
      throw new Error(`Plant-name integrity row has an invalid corrected Latin family: ${row.audit_id}`);
    }
    if (
      !correctedPlantName && !correctedScientificName && !correctedGenusJp &&
      !correctedGenusScientific && !correctedFamily && !correctedFamilyLatin
    ) {
      throw new Error(`Plant-name integrity row has no correction: ${row.audit_id}`);
    }
    const target = `${row.source}\u0000${plantName}`;
    if (targets.has(target)) throw new Error(`Plant-name integrity target is duplicated: ${target}`);
    targets.add(target);
  }
};

const validateTaxonomyReviews = (scope, rows, nameAudits) => {
  validateUniqueIds(rows, 'wild-plant taxonomy follow-up review');
  const expected = scope.taxonomy_followup_review || {};
  const decisions = new Map();
  const categories = new Map();
  const sources = new Map();
  const targets = new Set();
  const nameActions = new Map(nameAudits.map((row) => [rowKey(row), row]));

  for (const row of rows) {
    sourceMetadata(scope, row, 'wild-plant taxonomy follow-up review');
    const plantName = clean(row.plant_name);
    const category = clean(row.audit_category);
    const currentValue = clean(row.current_value);
    const referenceValue = clean(row.reference_value);
    const decision = clean(row.decision);
    const verifiedValue = clean(row.verified_value);
    const verificationMethod = clean(row.verification_method);
    if (!isSingleJapanesePlantName(plantName)) {
      throw new Error(`Taxonomy follow-up row has an invalid plant name: ${row.audit_id}`);
    }
    if (!TAXONOMY_REVIEW_ACTION_FIELD.has(category)) {
      throw new Error(`Taxonomy follow-up row has an unsupported category: ${row.audit_id}`);
    }
    if (!currentValue || !referenceValue || !verifiedValue) {
      throw new Error(`Taxonomy follow-up row is missing its compared values: ${row.audit_id}`);
    }
    if (!['correct_ocr', 'keep_source'].includes(decision)) {
      throw new Error(`Taxonomy follow-up row has an unsupported decision: ${row.audit_id}`);
    }
    if (verificationMethod !== 'original_pdf_visual_review') {
      throw new Error(`Taxonomy follow-up row was not checked on the original PDF: ${row.audit_id}`);
    }
    if (decision === 'keep_source' && verifiedValue !== currentValue) {
      throw new Error(`Taxonomy follow-up keep decision changes the value: ${row.audit_id}`);
    }
    if (decision === 'correct_ocr' && verifiedValue === currentValue) {
      throw new Error(`Taxonomy follow-up correction does not change the value: ${row.audit_id}`);
    }
    const target = `${rowKey(row)}\u0000${category}\u0000${currentValue}`;
    if (targets.has(target)) {
      throw new Error(`Taxonomy follow-up candidate is duplicated: ${row.audit_id}`);
    }
    targets.add(target);

    if (decision === 'correct_ocr') {
      const action = nameActions.get(rowKey(row));
      const actionField = TAXONOMY_REVIEW_ACTION_FIELD.get(category);
      if (!action || clean(action[actionField]) !== verifiedValue) {
        throw new Error(`Taxonomy follow-up correction is missing from the name ledger: ${row.audit_id}`);
      }
    }

    decisions.set(decision, (decisions.get(decision) || 0) + 1);
    categories.set(category, (categories.get(category) || 0) + 1);
    sources.set(row.source, (sources.get(row.source) || 0) + 1);
  }

  if (rows.length !== expected.candidates_reviewed) {
    throw new Error(`Taxonomy follow-up count mismatch: ${rows.length} != ${expected.candidates_reviewed}`);
  }
  for (const [key, count] of Object.entries(expected.decisions || {})) {
    if ((decisions.get(key) || 0) !== count) {
      throw new Error(`Taxonomy follow-up decision count mismatch for ${key}`);
    }
  }
  for (const [key, count] of Object.entries(expected.categories || {})) {
    if ((categories.get(key) || 0) !== count) {
      throw new Error(`Taxonomy follow-up category count mismatch for ${key}`);
    }
  }
  for (const [key, count] of Object.entries(expected.source_rows || {})) {
    if ((sources.get(key) || 0) !== count) {
      throw new Error(`Taxonomy follow-up source count mismatch for ${key}`);
    }
  }
};

const profileRowFromAudit = (audit) => {
  const row = Object.fromEntries(PROFILE_HEADERS.map((field) => [field, '']));
  row.plant_name = clean(audit.plant_name);
  for (const field of PROFILE_VALUE_FIELDS) row[field] = clean(audit[field]);
  row.source = clean(audit.source);
  row.page = clean(audit.pdf_page);
  row.extraction_method = clean(audit.extraction_method) || '原PDF画像目視確認＋手動要約';
  return row;
};

const chooseBestIndex = (rows, source, plantName) => {
  const matches = [];
  rows.forEach((row, index) => {
    if (clean(row.source) === source && clean(row.plant_name) === plantName) matches.push(index);
  });
  matches.sort((a, b) => {
    const scoreDifference = factScore(rows[b]) - factScore(rows[a]);
    if (scoreDifference) return scoreDifference;
    return (Number.parseInt(rows[a].page, 10) || 9999) - (Number.parseInt(rows[b].page, 10) || 9999);
  });
  return matches[0] ?? -1;
};

const appendAuditMethod = (value) => {
  const current = clean(value);
  const marker = '識別欄は原PDF画像目視確認＋手動要約';
  if (!current) return marker;
  return current.includes(marker) ? current : `${current}；${marker}`;
};

const removeIdentificationAuditMethod = (value) => clean(value)
  .split('；')
  .map((part) => part.trim())
  .filter(Boolean)
  .filter((part) => part !== '識別欄は原PDF画像目視確認＋手動要約')
  .join('；');

const appendIntegrityAuditMethod = (value) => {
  const current = clean(value)
    .split('；')
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => ![
      '本文欄は原PDF画像目視確認＋手動修正',
      '本文欄は原PDF左右頁再定位＋代表字形確認済みOCR修正',
    ].includes(part));
  return [...current, '本文欄は原PDF画像目視確認＋手動修正'].join('；');
};

const mergeAuditMethods = (...values) => [...new Set(values
  .flatMap((value) => clean(value).split('；'))
  .map((part) => part.trim())
  .filter(Boolean))].join('；');

const applyNameAudits = (rows, nameAudits) => {
  let mergedProfiles = 0;
  for (const audit of nameAudits) {
    const source = clean(audit.source);
    const plantName = clean(audit.plant_name);
    const correctedPlantName = clean(audit.corrected_plant_name);
    let oldIndex = chooseBestIndex(rows, source, plantName);
    let correctedIndex = correctedPlantName ? chooseBestIndex(rows, source, correctedPlantName) : -1;
    if (oldIndex < 0 && correctedIndex < 0) {
      throw new Error(`Plant-name integrity target not found: ${audit.audit_id}`);
    }
    if (oldIndex >= 0 && correctedIndex >= 0 && oldIndex !== correctedIndex) {
      const oldRow = rows[oldIndex];
      const correctedRow = rows[correctedIndex];
      for (const field of PROFILE_HEADERS) {
        if (['profile_id', 'plant_name'].includes(field)) continue;
        if (field === 'similar_taxa') {
          correctedRow[field] = [...new Set([
            ...splitSimilarTaxa(correctedRow[field]),
            ...splitSimilarTaxa(oldRow[field]),
          ])].join('、');
          continue;
        }
        if (field === 'distinguishing_features') {
          const contents = [...new Set([
            ...splitIdentificationSentences(correctedRow[field]),
            ...splitIdentificationSentences(oldRow[field]),
          ])];
          correctedRow[field] = contents.length ? `${contents.join('。')}。` : '';
          continue;
        }
        if (field === 'page' || field === 'printed_page') {
          correctedRow[field] = mergePageReferences(correctedRow[field], [oldRow[field]]);
          continue;
        }
        if (field === 'extraction_method') {
          correctedRow[field] = mergeAuditMethods(oldRow[field], correctedRow[field]);
          continue;
        }
        const oldValue = clean(oldRow[field]);
        const correctedValue = clean(correctedRow[field]);
        if (oldValue && correctedValue && oldValue !== correctedValue) {
          const auditedReplacement = clean(audit[NAME_AUDIT_CORRECTED_FIELD.get(field)]);
          if (auditedReplacement && correctedValue === auditedReplacement) continue;
          throw new Error(`Plant-name merge has conflicting ${field}: ${audit.audit_id}`);
        }
        if (!correctedValue) correctedRow[field] = oldValue;
      }
      rows.splice(oldIndex, 1);
      mergedProfiles += 1;
      correctedIndex = chooseBestIndex(rows, source, correctedPlantName);
      oldIndex = -1;
    }
    const index = correctedIndex >= 0 ? correctedIndex : oldIndex;
    const row = rows[index];
    if (correctedPlantName) row.plant_name = correctedPlantName;
    const currentScientificName = clean(row.scientific_name);
    const sourceScientificName = clean(audit.scientific_name);
    const correctedScientificName = clean(audit.corrected_scientific_name);
    if (
      correctedScientificName &&
      currentScientificName &&
      currentScientificName !== sourceScientificName &&
      currentScientificName !== correctedScientificName
    ) {
      throw new Error(`Plant scientific name changed unexpectedly: ${audit.audit_id}`);
    }
    if (correctedScientificName) row.scientific_name = correctedScientificName;
    const currentGenusJp = clean(row.genus_jp);
    const sourceGenusJp = clean(audit.genus_jp);
    const correctedGenusJp = clean(audit.corrected_genus_jp);
    if (
      correctedGenusJp &&
      currentGenusJp &&
      currentGenusJp !== sourceGenusJp &&
      currentGenusJp !== correctedGenusJp
    ) {
      throw new Error(`Plant Japanese genus changed unexpectedly: ${audit.audit_id}`);
    }
    if (correctedGenusJp) row.genus_jp = correctedGenusJp;
    const currentGenusScientific = clean(row.genus_scientific);
    const sourceGenusScientific = clean(audit.genus_scientific);
    const correctedGenusScientific = clean(audit.corrected_genus_scientific);
    if (
      correctedGenusScientific &&
      currentGenusScientific &&
      currentGenusScientific !== sourceGenusScientific &&
      currentGenusScientific !== correctedGenusScientific
    ) {
      throw new Error(`Plant scientific genus changed unexpectedly: ${audit.audit_id}`);
    }
    if (correctedGenusScientific) row.genus_scientific = correctedGenusScientific;
    const currentFamily = clean(row.family);
    const sourceFamily = clean(audit.family);
    const correctedFamily = clean(audit.corrected_family);
    if (
      correctedFamily &&
      currentFamily &&
      currentFamily !== sourceFamily &&
      currentFamily !== correctedFamily
    ) {
      throw new Error(`Plant family changed unexpectedly: ${audit.audit_id}`);
    }
    if (correctedFamily) row.family = correctedFamily;
    const currentFamilyLatin = clean(row.family_latin);
    const sourceFamilyLatin = clean(audit.family_latin);
    const correctedFamilyLatin = clean(audit.corrected_family_latin);
    if (
      correctedFamilyLatin &&
      currentFamilyLatin &&
      currentFamilyLatin !== sourceFamilyLatin &&
      currentFamilyLatin !== correctedFamilyLatin
    ) {
      throw new Error(`Plant Latin family changed unexpectedly: ${audit.audit_id}`);
    }
    if (correctedFamilyLatin) row.family_latin = correctedFamilyLatin;
    row.page = mergePageReferences(row.page, [audit.pdf_page]);
    row.printed_page = mergePageReferences(row.printed_page, [audit.printed_page]);
  }
  return mergedProfiles;
};

const applyAudits = (sourceRows, profileAudits, identificationAudits, integrityAudits, nameAudits) => {
  const initialFactless = sourceRows.filter((row) => !hasFacts(row)).length;
  let rows = sourceRows
    .filter(hasFacts)
    .map((row) => Object.fromEntries(PROFILE_HEADERS.map((field) => [
      field,
      ['similar_taxa', 'distinguishing_features'].includes(field)
        ? ''
        : field === 'extraction_method'
          ? removeIdentificationAuditMethod(row[field])
          : PROFILE_LAYOUT_FIELDS.has(field)
            ? normalizeLayoutWhitespace(row[field])
            : clean(row[field]),
    ])));

  let obsoleteProfilesRemoved = 0;
  for (const audit of profileAudits) {
    if (audit.decision !== 'include') continue;
    const obsoleteNames = clean(audit.remove_source_plant_name).split(';').filter(Boolean);
    if (obsoleteNames.length === 0) continue;
    const obsoleteSet = new Set(obsoleteNames);
    const before = rows.length;
    rows = rows.filter((row) => !(clean(row.source) === clean(audit.source) && obsoleteSet.has(clean(row.plant_name))));
    obsoleteProfilesRemoved += before - rows.length;
  }

  let profileIncludes = 0;
  for (const audit of profileAudits) {
    if (audit.decision !== 'include') continue;
    profileIncludes += 1;
    const replacement = profileRowFromAudit(audit);
    const index = chooseBestIndex(rows, replacement.source, replacement.plant_name);
    if (index >= 0) rows[index] = replacement;
    else rows.push(replacement);
  }

  let cleanups = 0;
  for (const audit of identificationAudits) {
    const cleanupField = clean(audit.cleanup_field);
    if (!cleanupField) continue;
    const index = chooseBestIndex(rows, clean(audit.source), clean(audit.plant_name));
    if (index < 0) throw new Error(`Cleanup target profile not found: ${audit.audit_id}`);
    const currentValue = clean(rows[index][cleanupField]);
    const expectedValue = normalizeLayoutWhitespace(audit.cleanup_current_value);
    const intermediateValue = normalizeLayoutWhitespace(audit.cleanup_intermediate_value);
    const replacement = normalizeLayoutWhitespace(audit.cleanup_replacement);
    const acceptedCleanupValues = [expectedValue, replacement];
    if (intermediateValue) acceptedCleanupValues.push(intermediateValue);
    if (!acceptedCleanupValues.includes(currentValue)) {
      throw new Error(`Cleanup source value changed for ${audit.audit_id}`);
    }
    rows[index][cleanupField] = replacement;
    rows[index].printed_page = mergePageReferences(rows[index].printed_page, [audit.printed_page]);
    rows[index].page = mergePageReferences(rows[index].page, [audit.pdf_page]);
    cleanups += 1;
  }

  const includedByProfile = new Map();
  for (const audit of identificationAudits) {
    if (audit.decision !== 'include') continue;
    const key = rowKey(audit);
    if (!includedByProfile.has(key)) includedByProfile.set(key, []);
    includedByProfile.get(key).push(audit);
  }

  let identificationProfiles = 0;
  for (const audits of includedByProfile.values()) {
    identificationProfiles += 1;
    const first = audits[0];
    const source = clean(first.source);
    const plantName = clean(first.plant_name);
    let index = chooseBestIndex(rows, source, plantName);
    if (index < 0) {
      rows.push({
        ...Object.fromEntries(PROFILE_HEADERS.map((field) => [field, ''])),
        plant_name: plantName,
        source,
        page: clean(first.pdf_page),
        printed_page: clean(first.printed_page),
        extraction_method: '識別欄は原PDF画像目視確認＋手動要約',
      });
      index = rows.length - 1;
    }
    const similarTaxa = [...new Set([
      ...splitSimilarTaxa(rows[index].similar_taxa),
      ...audits.flatMap((row) => splitSimilarTaxa(row.similar_taxa)),
    ])];
    const contents = [...new Set([
      ...splitIdentificationSentences(rows[index].distinguishing_features),
      ...audits.flatMap((row) => splitIdentificationSentences(row.approved_content)),
    ])];
    rows[index].similar_taxa = similarTaxa.join('、');
    rows[index].distinguishing_features = contents.length ? `${contents.join('。')}。` : '';
    rows[index].printed_page = mergePageReferences(
      rows[index].printed_page,
      audits.map((audit) => audit.printed_page),
    );
    rows[index].page = mergePageReferences(
      rows[index].page,
      audits.map((audit) => audit.pdf_page),
    );
    rows[index].extraction_method = appendAuditMethod(rows[index].extraction_method);
  }

  let integrityCorrections = 0;
  for (const audit of integrityAudits) {
    const source = clean(audit.source);
    const plantName = clean(audit.plant_name);
    const correctedPlantName = clean(audit.corrected_plant_name);
    const correctedScientificName = clean(audit.corrected_scientific_name);
    const field = clean(audit.field);
    let index = chooseBestIndex(rows, source, plantName);
    if (index < 0 && correctedPlantName) {
      index = chooseBestIndex(rows, source, correctedPlantName);
    }
    if (index < 0) throw new Error(`Profile integrity target not found: ${audit.audit_id}`);
    const current = normalizeLayoutWhitespace(rows[index][field]);
    const before = normalizeLayoutWhitespace(audit.before);
    const intermediateAfter = normalizeLayoutWhitespace(audit.intermediate_after);
    const after = normalizeLayoutWhitespace(audit.after);
    const acceptedIntegrityValues = new Set([before, after]);
    if (intermediateAfter) acceptedIntegrityValues.add(intermediateAfter);
    if (!acceptedIntegrityValues.has(current)) {
      throw new Error(`Profile integrity source value changed for ${audit.audit_id}`);
    }
    if (correctedPlantName) rows[index].plant_name = correctedPlantName;
    if (correctedScientificName) rows[index].scientific_name = correctedScientificName;
    rows[index][field] = after;
    if ((clean(audit.page_reference_action) || 'merge') === 'replace') {
      rows[index].printed_page = mergePageReferences('', [audit.printed_page]);
      rows[index].page = mergePageReferences('', [audit.pdf_page]);
    } else {
      rows[index].printed_page = mergePageReferences(rows[index].printed_page, [audit.printed_page]);
      rows[index].page = mergePageReferences(rows[index].page, [audit.pdf_page]);
    }
    if (clean(audit.distinguishing_features)) {
      rows[index].similar_taxa = [...new Set([
        ...splitSimilarTaxa(rows[index].similar_taxa),
        ...splitSimilarTaxa(audit.similar_taxa),
      ])].join('、');
      const contents = [...new Set([
        ...splitIdentificationSentences(rows[index].distinguishing_features),
        ...splitIdentificationSentences(audit.distinguishing_features),
      ])];
      rows[index].distinguishing_features = contents.length ? `${contents.join('。')}。` : '';
      rows[index].extraction_method = appendAuditMethod(rows[index].extraction_method);
    }
    rows[index].extraction_method = appendIntegrityAuditMethod(rows[index].extraction_method);
    integrityCorrections += 1;
  }

  for (const audit of profileAudits) {
    const claimsPriorCoverage = clean(audit.decision).includes('already_covered') ||
      /収録済み|被覆済み/.test(clean(audit.review_note));
    if (!claimsPriorCoverage) continue;
    if (chooseBestIndex(rows, clean(audit.source), clean(audit.plant_name)) < 0) {
      throw new Error(`Excluded profile claims prior coverage but no published source/name match exists: ${audit.audit_id}`);
    }
  }

  for (const row of rows) {
    for (const field of ['habit', 'height', 'flower_period', 'distribution', 'habitat']) {
      if (MISPLACED_COMPARISON_PATTERN.test(clean(row[field]))) {
        throw new Error(`Published profile comparison leaked into ${field}: ${rowKey(row)}`);
      }
    }
  }

  const nameProfilesMerged = applyNameAudits(rows, nameAudits);

  const sorted = rows
    .filter(hasFacts)
    .sort((a, b) =>
      clean(a.source).localeCompare(clean(b.source), 'ja') ||
      (Number.parseInt(a.page, 10) || 9999) - (Number.parseInt(b.page, 10) || 9999) ||
      (Number.parseInt(a.printed_page, 10) || 9999) - (Number.parseInt(b.printed_page, 10) || 9999) ||
      clean(a.plant_name).localeCompare(clean(b.plant_name), 'ja') ||
      clean(a.scientific_name).localeCompare(clean(b.scientific_name), 'en'));
  sorted.forEach((row, index) => {
    row.profile_id = `plant-profile-${String(index + 1).padStart(6, '0')}`;
  });
  return {
    rows: sorted,
    stats: {
      initialFactless,
      obsoleteProfilesRemoved,
      profileIncludes,
      identificationProfiles,
      cleanups,
      integrityCorrections,
      nameProfilesMerged,
    },
  };
};

const serializeProfiles = (rows) => `${Papa.unparse({
  fields: PROFILE_HEADERS,
  data: rows.map((row) => PROFILE_HEADERS.map((field) => clean(row[field]))),
}, { newline: '\n' })}\n`;

const validatePublishedResult = (scope, rows) => {
  const expected = scope.published_result || {};
  const uniqueKeys = new Set();
  const sourceCounts = new Map();
  let profilesWithDistinguishingFeatures = 0;
  let profilesWithIdentificationReview = 0;
  let profilesWithPrintedPages = 0;
  for (const row of rows) {
    const key = rowKey(row);
    if (uniqueKeys.has(key)) throw new Error(`Published profile source/name is duplicated: ${key}`);
    uniqueKeys.add(key);
    if (!hasFacts(row)) throw new Error(`Published profile has no objective facts: ${key}`);
    if (!isSingleJapanesePlantName(row.plant_name)) {
      throw new Error(`Published profile has an invalid plant name: ${key}`);
    }
    for (const field of PROFILE_FACT_FIELDS) {
      const value = clean(row[field]);
      if (!value) continue;
      if (value !== normalizeLayoutWhitespace(value)) {
        throw new Error(`Published profile contains OCR layout whitespace (${field}): ${key}`);
      }
      if (SUBJECTIVE_PATTERN.test(value)) {
        throw new Error(`Published profile contains subjective/editorial prose (${field}): ${key}`);
      }
      if (UNVERIFIED_ASSERTION_PATTERN.test(value)) {
        throw new Error(`Published profile contains unverified/speculative prose (${field}): ${key}`);
      }
      if (KNOWN_OCR_CORRUPTION_PATTERN.test(value)) {
        throw new Error(`Published profile contains a known OCR error (${field}): ${key}`);
      }
      if (field !== 'distinguishing_features' && HEADING_OR_PLATE_PATTERN.test(value)) {
        throw new Error(`Published profile contains a heading or plate label (${field}): ${key}`);
      }
    }
    const meta = scope.sources?.[clean(row.source)];
    if (!meta) throw new Error(`Published profile has unknown source: ${key}`);
    const pdfPages = parsePageReferences(row.page);
    if (!pdfPages || pdfPages.some((page) => page < meta.pdf_page_start || page > meta.pdf_page_end)) {
      throw new Error(`Published profile PDF page is outside the audited text: ${key}`);
    }
    const printedPages = clean(row.printed_page) ? parsePageReferences(row.printed_page) : [];
    if (printedPages === null || printedPages.some((page) => (
      page < meta.printed_page_start || page > meta.printed_page_end ||
      !pdfPages.some((pdfPage) => [2 * pdfPage - 2, 2 * pdfPage - 1].includes(page))
    ))) {
      throw new Error(`Published profile has an orphan printed-page reference: ${key}`);
    }
    if (Boolean(clean(row.similar_taxa)) !== Boolean(clean(row.distinguishing_features))) {
      throw new Error(`Published profile comparison fields must be paired: ${key}`);
    }
    if (clean(row.distinguishing_features)) {
      if (!CONCRETE_IDENTIFICATION_PATTERN.test(clean(row.distinguishing_features))) {
        throw new Error(`Published profile comparison has no concrete trait: ${key}`);
      }
      if (UNUSABLE_IDENTIFICATION_PATTERN.test(clean(row.distinguishing_features))) {
        throw new Error(`Published profile comparison is vague or unusable: ${key}`);
      }
    }
    sourceCounts.set(clean(row.source), (sourceCounts.get(clean(row.source)) || 0) + 1);
    if (clean(row.distinguishing_features)) profilesWithDistinguishingFeatures += 1;
    if (/識別欄は原PDF画像目視確認/u.test(clean(row.extraction_method))) {
      profilesWithIdentificationReview += 1;
    }
    if (printedPages.length > 0) profilesWithPrintedPages += 1;
  }
  const checks = [
    ['profiles', rows.length],
    ['volume1_profiles', sourceCounts.get('日本の野生植物 第1巻') || 0],
    ['volume2_profiles', sourceCounts.get('日本の野生植物 第2巻') || 0],
    ['profiles_with_distinguishing_features', profilesWithDistinguishingFeatures],
    ['profiles_with_original_pdf_identification_review', profilesWithIdentificationReview],
    ['profiles_with_printed_page_provenance', profilesWithPrintedPages],
  ];
  for (const [field, actual] of checks) {
    if (!Number.isInteger(expected[field]) || expected[field] !== actual) {
      throw new Error(`Published result mismatch for ${field}: ${actual} != ${expected[field]}`);
    }
  }
};

const writeFileAtomic = (filePath, content) => {
  const tempPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.tmp-${process.pid}-${Date.now()}`,
  );
  try {
    fs.writeFileSync(tempPath, content, 'utf8');
    fs.renameSync(tempPath, filePath);
  } finally {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
  }
};

const main = () => {
  const scope = JSON.parse(fs.readFileSync(SCOPE_PATH, 'utf8'));
  validateLedgerHash(scope, 'profile_ledger_sha256', PROFILE_AUDIT_PATH, 'profile audit ledger');
  validateLedgerHash(
    scope,
    'identification_ledger_sha256',
    IDENTIFICATION_AUDIT_PATH,
    'identification audit ledger',
  );
  validateLedgerHash(scope, 'name_ledger_sha256', NAME_AUDIT_PATH, 'plant-name integrity audit ledger');
  validateLedgerHash(
    scope,
    'taxonomy_review_ledger_sha256',
    TAXONOMY_REVIEW_PATH,
    'wild-plant taxonomy follow-up review ledger',
  );
  validateLedgerHash(scope, 'integrity_ledger_sha256', INTEGRITY_AUDIT_PATH, 'profile integrity audit ledger');
  validateLedgerHash(
    scope,
    'ocr_token_ledger_sha256',
    OCR_TOKEN_AUDIT_PATH,
    'OCR token verification ledger',
  );
  validateOptionalSourcePdfs(scope);
  const sourceText = fs.readFileSync(PROFILE_PATH, 'utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const sourceRows = readCsv(PROFILE_PATH, [PROFILE_HEADERS, LEGACY_PROFILE_HEADERS]);
  const profileAudits = readCsv(PROFILE_AUDIT_PATH);
  const identificationAudits = readCsv(IDENTIFICATION_AUDIT_PATH);
  const integrityAudits = readCsv(INTEGRITY_AUDIT_PATH);
  const ocrTokenAudits = readCsv(OCR_TOKEN_AUDIT_PATH);
  const nameAudits = readCsv(NAME_AUDIT_PATH);
  const taxonomyReviews = readCsv(TAXONOMY_REVIEW_PATH);
  validateProfileAudits(scope, profileAudits);
  validateIdentificationAudits(scope, identificationAudits);
  const tokenMappings = validateOcrTokenAudits(scope, ocrTokenAudits);
  validateIntegrityAudits(scope, integrityAudits, tokenMappings);
  validateIdentificationOwnership(profileAudits, identificationAudits, integrityAudits);
  validateNameAudits(scope, nameAudits);
  validateTaxonomyReviews(scope, taxonomyReviews, nameAudits);
  const { rows, stats } = applyAudits(
    sourceRows,
    profileAudits,
    identificationAudits,
    integrityAudits,
    nameAudits,
  );
  validatePublishedResult(scope, rows);
  const output = serializeProfiles(rows);

  if (process.argv.includes('--check')) {
    if (sourceText !== output) throw new Error('normalized_data/plant_profiles.csv is not synchronized with the PDF audit ledgers');
    console.log(`[wildplants-audit] check passed (${rows.length} published profiles)`);
    return;
  }
  if (!process.argv.includes('--dry-run')) writeFileAtomic(PROFILE_PATH, output);
  console.log(
    `[wildplants-audit] ${process.argv.includes('--dry-run') ? 'would apply' : 'applied'} ` +
    `${profileAudits.length} profile decisions, ${identificationAudits.length} identification decisions, and ` +
    `${integrityAudits.length} integrity corrections; taxonomy_reviews=${taxonomyReviews.length}, ` +
    `published=${rows.length}, removed_factless=${stats.initialFactless}, ` +
    `removed_obsolete=${stats.obsoleteProfilesRemoved}, profile_includes=${stats.profileIncludes}, ` +
    `identification_profiles=${stats.identificationProfiles}, cleanups=${stats.cleanups}, ` +
    `integrity_corrections=${stats.integrityCorrections}, name_profiles_merged=${stats.nameProfilesMerged}`,
  );
};

main();

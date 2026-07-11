import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Papa from 'papaparse';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOSTPLANTS_PATH = path.join(ROOT, 'normalized_data', 'hostplants.csv');
const INSECTS_PATH = path.join(ROOT, 'normalized_data', 'insects.csv');
const NOTES_PATH = path.join(ROOT, 'normalized_data', 'general_notes.csv');
const GUIDE3_NOTE_LEDGER_PATH = path.join(
  ROOT,
  'data',
  'source_audits',
  'japanese-moths-standard-guide-3-general-note-all-rows-2026-07-12.csv',
);
const OUTPUT_PATH = path.join(
  ROOT,
  'data',
  'source_audits',
  'japanese-standard-moth-guides-hostplant-integrity-2026-07-12.json',
);

const SOURCES = [
  '日本産蛾類標準図鑑1',
  '日本産蛾類標準図鑑2',
  '日本産蛾類標準図鑑3',
  '日本産蛾類標準図鑑4',
];

const PDF_SOURCES = {
  日本産蛾類標準図鑑1: [
    {
      part: 'first_volume_file',
      page_count: 178,
      sha256: '8eace428cf7dad37d58f7cb330b733278a313400c6158e822b0f4f9d1d80fa2c',
      role: 'original_pdf_image_authority',
    },
    {
      part: 'second_volume_file',
      page_count: 115,
      sha256: '35e3a46b1c91a6f16a6aff7522be708ed8a94ccfc8dc39d23c3d3e9171cfd0d9',
      role: 'original_pdf_image_authority',
    },
  ],
  日本産蛾類標準図鑑2: [{
    page_count: 143,
    sha256: '2d24a2870a7f890cb4af8d79b55dfc7fe6215607f6d70bbdcd41ca02db8eb5f9',
    role: 'original_pdf_image_authority',
  }],
  日本産蛾類標準図鑑3: [{
    page_count: 138,
    sha256: '205b3090c799655004bae148d6931e90a2abb968c85c376b2680ce105ed37850',
    role: 'original_pdf_image_authority',
  }],
  日本産蛾類標準図鑑4: [{
    covered_printed_pages: '86-155',
    pdf_page_count: 35,
    sha256: '6591236aeb6dfad5a5f9d1998d9a234ede9cb59dbe54f6f79a65fd18665b408e',
    role: 'original_partial_pdf_image_authority',
    outside_covered_pages: 'source_not_recovered_hold_no_claim',
  }],
};

const parseCsv = filePath => Papa.parse(
  fs.readFileSync(filePath, 'utf8').replace(/^\ufeff/, ''),
  { header: true, skipEmptyLines: true },
).data;

const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');

const hostplants = parseCsv(HOSTPLANTS_PATH);
const insects = parseCsv(INSECTS_PATH);
const notes = parseCsv(NOTES_PATH);
const guide3NoteLedger = parseCsv(GUIDE3_NOTE_LEDGER_PATH);
const sourceRows = hostplants.filter(row => SOURCES.includes(row.reference));
const byRecordId = new Map(hostplants.map(row => [row.record_id, row]));
const insectsById = new Map(insects.map(row => [row.insect_id, row]));

const noteEvidenceByInsect = new Map();
for (const row of guide3NoteLedger) {
  if (!row.pdf_page || noteEvidenceByInsect.has(row.insect_id)) continue;
  noteEvidenceByInsect.set(row.insect_id, {
    pdf_page: Number(row.pdf_page),
    printed_page: row.printed_page ? Number(row.printed_page) : null,
  });
}

// Accounts without a general-note row are pinned to the original spread that was
// inspected visually. A two-page printed range is used when the account crosses a
// column/spread boundary and the exact printed side is not material to the decision.
const GUIDE3_MANUAL_EVIDENCE = {
  'species-0048': { pdf_page: 7, printed_page_range: '80-81' },
  'species-0050': { pdf_page: 7, printed_page_range: '80-81' },
  'species-0054': { pdf_page: 8, printed_page_range: '82-83' },
  'species-0059': { pdf_page: 9, printed_page_range: '84-85' },
  'species-0073': { pdf_page: 10, printed_page_range: '86-87' },
  'species-0084': { pdf_page: 11, printed_page_range: '88-89' },
  'species-0148': { pdf_page: 17, printed_page_range: '100-101' },
  'species-0173': { pdf_page: 19, printed_page_range: '104-105' },
  'species-0212': { pdf_page: 24, printed_page_range: '114-115' },
  'species-0218': { pdf_page: 25, printed_page_range: '116-117' },
  'species-0265': { pdf_page: 29, printed_page_range: '124-125' },
  'species-0301': { pdf_page: 33, printed_page_range: '132-133' },
  'species-0338': { pdf_page: 43, printed_page_range: '152-153' },
  'species-0340': { pdf_page: 43, printed_page_range: '152-153' },
  'species-0796': { pdf_page: 60, printed_page_range: '186-187' },
  'species-0841': { pdf_page: 65, printed_page_range: '196-197' },
  'species-0845': { pdf_page: 65, printed_page_range: '196-197' },
  'species-0848': { pdf_page: 66, printed_page_range: '198-199' },
  'species-0868': { pdf_page: 68, printed_page_range: '202-203' },
  'species-0872': { pdf_page: 68, printed_page_range: '202-203' },
  'species-0873': { pdf_page: 69, printed_page_range: '204-205' },
  'species-0878': { pdf_page: 69, printed_page_range: '204-205' },
  'species-0966': { pdf_page: 77, printed_page_range: '220-221' },
  'species-1046': { pdf_page: 86, printed_page_range: '238-239' },
  'species-1155': { pdf_page: 93, printed_page_range: '252-253' },
  'species-1313': { pdf_page: 107, printed_page_range: '280-281' },
  'species-1387': { pdf_page: 115, printed_page_range: '296-297' },
  'species-1479': { pdf_page: 123, printed_page_range: '312-313' },
  'species-1491': { pdf_page: 124, printed_page_range: '314-315' },
  'species-1546': { pdf_page: 130, printed_page_range: '326-327' },
  'species-1596': { pdf_page: 135, printed_page_range: '336-337' },
  'species-1606': { pdf_page: 136, printed_page_range: '338-339' },
  'species-1610': { pdf_page: 136, printed_page_range: '338-339' },
};

const evidenceFor = insectId => {
  const automatic = noteEvidenceByInsect.get(insectId);
  if (automatic) return automatic;
  const manual = GUIDE3_MANUAL_EVIDENCE[insectId];
  if (!manual) throw new Error(`Missing original-PDF page evidence for ${insectId}`);
  return manual;
};

const deleteIds = [
  // Original PDF pp. 1-43: account-to-account spill and unsupported host rows.
  'hostplant-908270', 'hostplant-908271', 'hostplant-908277', 'hostplant-908272',
  'hostplant-908273', 'hostplant-908276', 'hostplant-908279', 'hostplant-908278',
  'hostplant-908281', 'hostplant-908280', 'hostplant-908283', 'hostplant-908284',
  'hostplant-908286', 'hostplant-908287', 'hostplant-908288', 'hostplant-908253',
  'hostplant-908254', 'hostplant-908255', 'hostplant-908256', 'hostplant-908257',
  'hostplant-908258', 'hostplant-908259', 'hostplant-908260', 'hostplant-908262',
  'hostplant-908263', 'hostplant-908264', 'hostplant-908268',

  // Original PDF pp. 60-69: shifted columns, OCR fragments and unsupported hosts.
  'hostplant-908000', 'hostplant-908001', 'hostplant-908014', 'hostplant-908015',
  'hostplant-908018', 'hostplant-908019', 'hostplant-908023', 'hostplant-908024',
  'hostplant-908025', 'hostplant-908026', 'hostplant-908030', 'hostplant-908032',
  'hostplant-908034', 'hostplant-908035', 'hostplant-908036', 'hostplant-908037',
  'hostplant-908038', 'hostplant-908041', 'hostplant-908043', 'hostplant-908044',
  'hostplant-908047', 'hostplant-908048', 'hostplant-908049', 'hostplant-908050',
  'hostplant-908051', 'hostplant-908054', 'hostplant-908055', 'hostplant-908056',
  'hostplant-908057', 'hostplant-908059', 'hostplant-908060', 'hostplant-912729',

  // Original PDF pp. 116-125: adjacent account spill and OCR substitutions.
  'hostplant-908087', 'hostplant-908088', 'hostplant-908089', 'hostplant-908090',
  'hostplant-908091', 'hostplant-908092', 'hostplant-908097', 'hostplant-908099',
  'hostplant-908100', 'hostplant-908101', 'hostplant-908102', 'hostplant-908111',
  'hostplant-908103', 'hostplant-908108', 'hostplant-908109', 'hostplant-908110',
  'hostplant-908115', 'hostplant-908119', 'hostplant-908121',
  'hostplant-908122', 'hostplant-908123', 'hostplant-908127', 'hostplant-908128',
  'hostplant-908135', 'hostplant-908138', 'hostplant-908142', 'hostplant-908143',
  'hostplant-908148', 'hostplant-908151', 'hostplant-908152', 'hostplant-908153',
  'hostplant-908155', 'hostplant-908156', 'hostplant-908157',

  // Original PDF pp. 126-138: the largest shifted-account import block.
  'hostplant-908067', 'hostplant-908068', 'hostplant-908069', 'hostplant-908071',
  'hostplant-908072', 'hostplant-908073', 'hostplant-908074', 'hostplant-908079',
  'hostplant-908080', 'hostplant-908082', 'hostplant-908083', 'hostplant-908084',
  'hostplant-908085', 'hostplant-908168', 'hostplant-908169', 'hostplant-908170',
  'hostplant-908171', 'hostplant-908172', 'hostplant-908173', 'hostplant-908174',
  'hostplant-908175', 'hostplant-908176', 'hostplant-908177',
  'hostplant-908183', 'hostplant-908184', 'hostplant-908185',
  'hostplant-908186', 'hostplant-908187', 'hostplant-908188', 'hostplant-908189',
  'hostplant-908190', 'hostplant-908191', 'hostplant-908192', 'hostplant-908193',
  'hostplant-908194', 'hostplant-908195', 'hostplant-908196', 'hostplant-908197',
  'hostplant-908198', 'hostplant-908199', 'hostplant-908200', 'hostplant-908201',
  'hostplant-908202', 'hostplant-908203', 'hostplant-908204', 'hostplant-908205',
  'hostplant-908206', 'hostplant-908209', 'hostplant-908210', 'hostplant-908211',
  'hostplant-908212', 'hostplant-908225', 'hostplant-908228', 'hostplant-908229',
  'hostplant-908235', 'hostplant-908236', 'hostplant-908237', 'hostplant-908238',
  'hostplant-908246', 'hostplant-908248', 'hostplant-908251', 'hostplant-908252',

  // Non-host field spill and OCR substitutions elsewhere in volume 3.
  'hostplant-912796', 'hostplant-912816', 'hostplant-912857', 'hostplant-912951',
];

const updateSpecs = [
  ['hostplant-912797', { plant_family: 'ヤシ科' }, 'restore_ocr_corrupted_plant_family'],
  ['hostplant-908017', { plant_name: 'オヤマボクチ' }, 'restore_exact_host_name'],
  ['hostplant-912681', { plant_name: 'ナンブトウヒレン' }, 'restore_ocr_misread_host_name'],
  ['hostplant-908033', {
    plant_name: 'チャボアザミ属',
    plant_family: 'キク科',
    observation_type: '国外',
    notes: 'ヨーロッパにおける記録',
  }, 'replace_neighbor_account_spill_with_original_foreign_host'],
  ['hostplant-908098', { plant_name: 'マルバハギ' }, 'restore_ocr_omission'],
  ['hostplant-913051', { plant_name: 'ハシバミ' }, 'restore_ocr_misread_host_name'],
  ['hostplant-913111', { plant_name: 'セイヨウハシバミ' }, 'restore_ocr_misread_host_name'],
  ['hostplant-912670', { plant_family: 'ヤナギ科' }, 'restore_explicit_plant_family'],
  ['hostplant-908052', { plant_family: 'イグサ科' }, 'restore_explicit_plant_family'],
  ['hostplant-908086', { plant_family: 'シクンシ科' }, 'restore_ocr_corrupted_plant_family'],
  ['hostplant-902101', { plant_family: 'バラ科' }, 'restore_explicit_plant_family'],
  ['hostplant-902150', { plant_family: 'バラ科' }, 'restore_explicit_plant_family'],
  ['hostplant-902153', { plant_family: 'バラ科' }, 'restore_explicit_plant_family'],
  ['hostplant-902154', { plant_family: 'ムクロジ科' }, 'restore_explicit_plant_family'],
  ['hostplant-902158', { plant_family: 'ヤナギ科' }, 'restore_explicit_plant_family'],
  ['hostplant-902136', { plant_family: 'フウ科' }, 'restore_ylist_canonical_plant_family'],
  ['hostplant-902005', { plant_family: 'ブナ科' }, 'restore_explicit_plant_family'],
  ['hostplant-902019', { plant_family: 'ブドウ科' }, 'restore_explicit_plant_family'],
  ['hostplant-902032', { plant_family: 'ヤナギ科' }, 'restore_explicit_plant_family'],
  ['hostplant-902048', { plant_family: 'ヤナギ科' }, 'restore_explicit_plant_family'],
  ['hostplant-902054', { plant_family: 'ヤナギ科' }, 'restore_explicit_plant_family'],
  ['hostplant-902059', { plant_family: 'バラ科' }, 'restore_explicit_plant_family'],
  ['hostplant-902089', { plant_family: 'ブナ科' }, 'restore_family_level_resource_family'],
  ['hostplant-902090', { plant_family: 'バラ科' }, 'restore_family_level_resource_family'],
  ['hostplant-902091', { plant_family: 'ヤナギ科' }, 'restore_family_level_resource_family'],
  ['hostplant-902092', { plant_family: 'ツバキ科' }, 'restore_family_level_resource_family'],
];

const addSpecs = [
  ['species-0338', 'ザクロ', 'ミソハギ科', '文献', '', '幼虫', '', 'original_account_host_omitted'],
  ['species-0340', 'カヤツリグサ科', 'カヤツリグサ科', '文献', '', '幼虫', '', 'original_account_host_family_omitted'],
  ['species-0796', 'ヤナギ属', 'ヤナギ科', '文献', '', '幼虫', '', 'original_account_host_genus_omitted'],
  ['species-0802', 'Cordia属', 'ムラサキ科', '文献', '', '幼虫', '', 'original_account_host_genus_omitted'],
  ['species-0811', 'ヤグルマギク属', 'キク科', '国外', '', '幼虫', 'ヨーロッパにおける記録', 'replace_deleted_shifted_rows_with_original_foreign_host'],
  ['species-1447', 'Nephelium属', 'ムクロジ科', '国外', '', '幼虫', '国外における記録', 'original_account_foreign_host_genus_omitted'],
  ['species-1467', 'ニシキギ属', 'ニシキギ科', '文献', '', '幼虫', '', 'original_account_host_genus_omitted'],
];

const GUIDE12_DELETE_SPECS = [
  // Guide 1, first PDF file.
  ['hostplant-B1B6-0423', '日本産蛾類標準図鑑1', 84, 165, 'first_volume_file'],
  ['hostplant-B1B6-0688', '日本産蛾類標準図鑑1', 95, 186, 'first_volume_file'],
  ['hostplant-B1B6-0689', '日本産蛾類標準図鑑1', 95, 186, 'first_volume_file'],
  ['hostplant-B1B6-0766', '日本産蛾類標準図鑑1', 100, 196, 'first_volume_file'],
  ['hostplant-B1B6-0767', '日本産蛾類標準図鑑1', 100, 196, 'first_volume_file'],
  ['hostplant-B1B6-0768', '日本産蛾類標準図鑑1', 100, 196, 'first_volume_file'],
  ['hostplant-B1B6-0769', '日本産蛾類標準図鑑1', 100, 196, 'first_volume_file'],
  ['hostplant-B1B6-0855', '日本産蛾類標準図鑑1', 104, 205, 'first_volume_file'],
  ['hostplant-001334', '日本産蛾類標準図鑑1', 111, 218, 'first_volume_file'],
  ['hostplant-001335', '日本産蛾類標準図鑑1', 111, 218, 'first_volume_file'],
  ['hostplant-B1B6-0966', '日本産蛾類標準図鑑1', 111, 218, 'first_volume_file'],
  ['hostplant-B1B6-1000', '日本産蛾類標準図鑑1', 114, 224, 'first_volume_file'],
  ['hostplant-B1B6-1003', '日本産蛾類標準図鑑1', 114, 224, 'first_volume_file'],
  ['hostplant-B1B6-1004', '日本産蛾類標準図鑑1', 114, 224, 'first_volume_file'],
  ['hostplant-B1B6-1005', '日本産蛾類標準図鑑1', 114, 224, 'first_volume_file'],
  ['hostplant-B1B6-1011', '日本産蛾類標準図鑑1', 114, 225, 'first_volume_file'],
  ['hostplant-B1B6-1012', '日本産蛾類標準図鑑1', 114, 225, 'first_volume_file'],
  ['hostplant-B1B6-1013', '日本産蛾類標準図鑑1', 114, 225, 'first_volume_file'],
  ['hostplant-B1B6-1018', '日本産蛾類標準図鑑1', 114, 225, 'first_volume_file'],
  ['hostplant-B1B6-1021', '日本産蛾類標準図鑑1', 114, 225, 'first_volume_file'],
  ['hostplant-B1B6-1022', '日本産蛾類標準図鑑1', 114, 225, 'first_volume_file'],
  // Guide 1, second PDF file.
  ['host-B1B7-20251121002628-0006', '日本産蛾類標準図鑑1', 60, 228, 'second_volume_file'],
  ['host-B1B7-20251121002628-0011', '日本産蛾類標準図鑑1', 61, 230, 'second_volume_file'],
  ['host-B1B7-20251121002628-0159', '日本産蛾類標準図鑑1', 90, 289, 'second_volume_file'],
  ['host-B1B7-20251121002628-0160', '日本産蛾類標準図鑑1', 90, 289, 'second_volume_file'],
  ['host-B1B7-20251121002628-0286', '日本産蛾類標準図鑑1', 105, 319, 'second_volume_file'],
  ['host-B1B7-20251121002628-0313', '日本産蛾類標準図鑑1', 106, 320, 'second_volume_file'],
  ['hostplant-001859', '日本産蛾類標準図鑑1', 106, 320, 'second_volume_file'],
  ['hostplant-001863', '日本産蛾類標準図鑑1', 106, 321, 'second_volume_file'],
  ['host-B1B7-20251121002628-0377', '日本産蛾類標準図鑑1', 109, 326, 'second_volume_file'],
  ['host-B1B7-20251121002628-0378', '日本産蛾類標準図鑑1', 109, 326, 'second_volume_file'],
  ['host-B1B7-20251121002628-0380', '日本産蛾類標準図鑑1', 109, 326, 'second_volume_file'],
  ['host-B1B7-20251121002628-0450', '日本産蛾類標準図鑑1', 111, 331, 'second_volume_file'],
  ['host-B1B7-20251121002628-0480', '日本産蛾類標準図鑑1', 113, 335, 'second_volume_file'],
  ['host-B1B7-20251121002628-0481', '日本産蛾類標準図鑑1', 113, 335, 'second_volume_file'],
  ['host-B1B7-20251121002628-0482', '日本産蛾類標準図鑑1', 113, 335, 'second_volume_file'],
  ['host-B1B7-20251121002628-0493', '日本産蛾類標準図鑑1', 115, 338, 'second_volume_file'],
  ['host-B1B7-20251121002628-0496', '日本産蛾類標準図鑑1', 115, 338, 'second_volume_file'],
];

const GUIDE12_UPDATE_SPECS = [
  ['hostplant-B1B6-0421', { plant_name: 'ナナカマド', plant_family: 'バラ科' }, '日本産蛾類標準図鑑1', 84, 165, 'first_volume_file', 'restore_ocr_shifted_host_name'],
  ['hostplant-B1B6-0422', { plant_name: 'ハナヒリノキ', plant_family: 'ツツジ科' }, '日本産蛾類標準図鑑1', 84, 165, 'first_volume_file', 'restore_ocr_misread_host_name'],
  ['hostplant-B1B6-0964', { plant_name: 'シデコブシ', plant_family: 'モクレン科' }, '日本産蛾類標準図鑑1', 111, 218, 'first_volume_file', 'restore_ocr_misread_host_name'],
  ['hostplant-B1B6-0965', { plant_part: '枯れ葉' }, '日本産蛾類標準図鑑1', 111, 218, 'first_volume_file', 'restore_explicit_resource_part'],
  ['hostplant-B1B6-0967', { plant_name: 'ハカマカズラ', plant_family: 'マメ科' }, '日本産蛾類標準図鑑1', 111, 218, 'first_volume_file', 'restore_ocr_misread_host_name'],
  ['hostplant-B1B6-0968', { plant_name: 'アラカシ', plant_family: 'ブナ科' }, '日本産蛾類標準図鑑1', 111, 218, 'first_volume_file', 'restore_ocr_misread_host_name'],
  ['hostplant-B1B6-0969', { plant_name: 'ナワシログミ', plant_family: 'グミ科' }, '日本産蛾類標準図鑑1', 111, 218, 'first_volume_file', 'restore_ocr_misread_host_name'],
  ['hostplant-B1B6-0971', { plant_name: 'カンヒザクラ' }, '日本産蛾類標準図鑑1', 111, 218, 'first_volume_file', 'restore_ocr_misread_host_name'],
  ['hostplant-B1B6-0972', { plant_name: 'ウスギモクセイ', plant_family: 'モクセイ科', plant_part: '果実' }, '日本産蛾類標準図鑑1', 111, 218, 'first_volume_file', 'restore_ocr_misread_host_and_resource_part'],
  ['hostplant-001375', { plant_part: '花盤' }, '日本産蛾類標準図鑑1', 114, 224, 'first_volume_file', 'restore_exact_resource_part'],
  ['hostplant-001376', { plant_part: '花盤' }, '日本産蛾類標準図鑑1', 114, 224, 'first_volume_file', 'restore_exact_resource_part'],
  ['hostplant-001378', { plant_part: '花盤' }, '日本産蛾類標準図鑑1', 114, 224, 'first_volume_file', 'restore_exact_resource_part'],
  ['hostplant-B1B6-1019', { plant_name: 'バラ', plant_family: 'バラ科' }, '日本産蛾類標準図鑑1', 114, 225, 'first_volume_file', 'restore_original_generic_host_name'],
  ['hostplant-B1B6-1020', { plant_name: 'カタバミ', plant_family: 'カタバミ科' }, '日本産蛾類標準図鑑1', 114, 225, 'first_volume_file', 'restore_ocr_misread_host_name'],
  ['host-B1B7-20251121002628-0037', { plant_name: 'トウモロコシ属', plant_family: 'イネ科', observation_type: '国外' }, '日本産蛾類標準図鑑1', 63, 234, 'second_volume_file', 'split_fused_foreign_host_list'],
  ['host-B1B7-20251121002628-0038', { plant_name: 'ハギ属', plant_family: 'マメ科', observation_type: '国外' }, '日本産蛾類標準図鑑1', 63, 234, 'second_volume_file', 'restore_ocr_misread_foreign_host_name'],
  ['host-B1B7-20251121002628-0039', { plant_name: 'クサネム属', plant_family: 'マメ科', observation_type: '国外' }, '日本産蛾類標準図鑑1', 63, 234, 'second_volume_file', 'split_fused_foreign_host_list'],
  ['host-B1B7-20251121002628-0309', { plant_family: 'バラ科' }, '日本産蛾類標準図鑑1', 106, 320, 'second_volume_file', 'restore_omitted_plant_family'],
  ['hostplant-002162', { plant_name: 'ボチョウジ', plant_family: 'アカネ科' }, '日本産蛾類標準図鑑1', 113, 335, 'second_volume_file', 'restore_ocr_misread_host_name'],
  ['host-B1B7-20251121002628-0497', { observation_type: '国外' }, '日本産蛾類標準図鑑1', 115, 338, 'second_volume_file', 'restore_explicit_foreign_scope'],
  ['host-B1B7-20251121002628-0498', { observation_type: '国外' }, '日本産蛾類標準図鑑1', 115, 338, 'second_volume_file', 'restore_explicit_foreign_scope'],
  ['host-B1B7-20251121002628-0499', { observation_type: '国外' }, '日本産蛾類標準図鑑1', 115, 338, 'second_volume_file', 'restore_explicit_foreign_scope'],
  ['host-B1B7-20251121002628-0500', { observation_type: '国外' }, '日本産蛾類標準図鑑1', 115, 338, 'second_volume_file', 'restore_explicit_foreign_scope'],
  ['host-B1B7-20251121002628-0510', { plant_name: 'タイモ', plant_family: 'サトイモ科', notes: 'ミズイモ / 沖縄島ではハスモンヨトウとともに害虫' }, '日本産蛾類標準図鑑1', 115, 339, 'second_volume_file', 'remove_ecology_prose_from_host_name'],
  ['hostplant-002226', { observation_type: '国外', notes: '' }, '日本産蛾類標準図鑑1', 115, 339, 'second_volume_file', 'move_spilled_ecology_note_to_correct_host_row'],
  // Guide 2.
  ['hostplant-003438', { plant_name: 'トウフジウツギ' }, '日本産蛾類標準図鑑2', 80, 274, 'full_volume_file', 'restore_ocr_misread_host_name'],
  ['hostplant-003686', { plant_name: 'ササ類', plant_family: 'イネ科' }, '日本産蛾類標準図鑑2', 93, 301, 'full_volume_file', 'restore_ocr_misread_host_name'],
  ['hostplant-003712', { plant_name: 'ノブドウ' }, '日本産蛾類標準図鑑2', 95, 304, 'full_volume_file', 'restore_ocr_misread_host_name'],
  ['hostplant-003738', { plant_name: 'ユウガギク', plant_family: 'キク科' }, '日本産蛾類標準図鑑2', 96, 306, 'full_volume_file', 'restore_ocr_misread_host_name'],
  ['hostplant-003769', { plant_name: 'ブドウ' }, '日本産蛾類標準図鑑2', 97, 309, 'full_volume_file', 'restore_ocr_misread_host_name'],
  ['hostplant-003906', { plant_name: 'コウライシバ', plant_family: 'イネ科' }, '日本産蛾類標準図鑑2', 105, 324, 'full_volume_file', 'restore_ocr_misread_host_name'],
  ['hostplant-003919', { plant_name: 'タンポポ類', plant_family: 'キク科' }, '日本産蛾類標準図鑑2', 106, 327, 'full_volume_file', 'restore_ocr_misread_host_name'],
  ['hostplant-003937', { plant_name: 'モウソウチク', plant_family: 'イネ科' }, '日本産蛾類標準図鑑2', 107, 329, 'full_volume_file', 'restore_ocr_misread_host_name'],
  ['hostplant-003996', { plant_name: 'テンキグサ', plant_family: 'イネ科' }, '日本産蛾類標準図鑑2', 113, 340, 'full_volume_file', 'restore_ocr_misread_host_name'],
];

const GUIDE1_ADD_SPECS = [
  ['species-3853', 'アクシバ', 'ツツジ科', 100, 196],
  ['species-3853', 'オオバスノキ', 'ツツジ科', 100, 196],
  ['species-3853', 'ハナヒリノキ', 'ツツジ科', 100, 196],
  ['species-3979', 'ヤマボウシ', 'ミズキ科', 114, 225],
  ['species-3979', 'シュウカイドウ', 'シュウカイドウ科', 114, 225],
  ['species-3979', 'イノコズチ', 'ヒユ科', 114, 225],
  ['species-3979', 'オニドコロ', 'ヤマノイモ科', 114, 225],
  ['species-3979', 'カエデドコロ', 'ヤマノイモ科', 114, 225],
  ['species-3979', 'ニガキ', 'ニガキ科', 114, 225],
  ['species-3979', 'フジ', 'マメ科', 114, 225],
  ['species-3979', 'ホトトギス', 'ユリ科', 114, 225],
];

const GUIDE1_SECOND_ADD_SPECS = [
  ['species-4026', 'イネ属', 'イネ科', 63, 234, '国外', '', 'split_fused_foreign_host_list'],
  ['species-4026', 'ササゲ属', 'マメ科', 63, 234, '国外', '', 'split_fused_foreign_host_list'],
  ['species-4546', 'ヒユ科', 'ヒユ科', 115, 338, '国外', '', 'restore_original_foreign_host_family'],
];

const actions = [];
const actionRecordIds = new Set();

const addAction = action => {
  if (action.record_id && actionRecordIds.has(action.record_id)) {
    throw new Error(`Duplicate action for ${action.record_id}`);
  }
  if (action.record_id) actionRecordIds.add(action.record_id);
  actions.push({
    audit_id: `SMG-HOST-${String(actions.length + 1).padStart(4, '0')}`,
    ...action,
  });
};

for (const recordId of deleteIds) {
  const before = byRecordId.get(recordId);
  if (!before) throw new Error(`Delete target missing: ${recordId}`);
  if (before.reference !== '日本産蛾類標準図鑑3') {
    throw new Error(`Unexpected delete source for ${recordId}: ${before.reference}`);
  }
  const evidence = evidenceFor(before.insect_id);
  const issueClass = ['へ移る', '不叫'].includes(before.plant_name)
    ? 'non_host_field_spill'
    : before.plant_name === '落ち菓'
      ? 'ocr_corruption_duplicate_of_verified_resource'
      : 'adjacent_account_or_column_spill';
  addAction({
    action: 'delete_hostplant',
    record_id: recordId,
    insect_id: before.insect_id,
    japanese_name: insectsById.get(before.insect_id)?.japanese_name || '',
    before,
    after: null,
    source_reference: before.reference,
    ...evidence,
    issue_class: issueClass,
    decision: issueClass === 'ocr_corruption_duplicate_of_verified_resource'
      ? 'delete_corrupt_duplicate_preserve_existing_original_pdf_supported_row'
      : 'delete_row_not_supported_by_original_species_account',
    evidence: '原PDF画像の種見出し、寄主植物欄、段・欄境界を目視確認。OCRはページ候補の特定にのみ使用した。',
  });
}

for (const [recordId, patch, decision] of updateSpecs) {
  const before = byRecordId.get(recordId);
  if (!before) throw new Error(`Update target missing: ${recordId}`);
  const evidence = evidenceFor(before.insect_id);
  addAction({
    action: 'update_hostplant',
    record_id: recordId,
    insect_id: before.insect_id,
    japanese_name: insectsById.get(before.insect_id)?.japanese_name || '',
    before,
    after: { ...before, ...patch },
    source_reference: before.reference,
    ...evidence,
    issue_class: 'ocr_name_or_account_reconstruction_error',
    decision,
    evidence: '原PDF画像の種見出しと寄主植物欄を目視確認し、原文の植物名・地理的範囲へ復元した。',
  });
}

for (const [index, spec] of addSpecs.entries()) {
  const [insectId, plantName, plantFamily, observationType, plantPart, lifeStage, notesText, decision] = spec;
  const recordId = `hostplant-SMGHOSTAUDIT-20260712-${String(index + 1).padStart(4, '0')}`;
  if (byRecordId.has(recordId)) throw new Error(`Add target already exists: ${recordId}`);
  const duplicate = hostplants.find(row => (
    row.insect_id === insectId
    && row.plant_name === plantName
    && row.reference === '日本産蛾類標準図鑑3'
  ));
  if (duplicate) throw new Error(`Proposed addition duplicates ${duplicate.record_id}: ${insectId}/${plantName}`);
  const evidence = evidenceFor(insectId);
  addAction({
    action: 'add_hostplant',
    record_id: recordId,
    insect_id: insectId,
    japanese_name: insectsById.get(insectId)?.japanese_name || '',
    before: null,
    after: {
      record_id: recordId,
      insect_id: insectId,
      plant_name: plantName,
      plant_family: plantFamily,
      observation_type: observationType,
      plant_part: plantPart,
      life_stage: lifeStage,
      reference: '日本産蛾類標準図鑑3',
      notes: notesText,
    },
    source_reference: '日本産蛾類標準図鑑3',
    ...evidence,
    issue_class: 'original_pdf_supported_host_omission',
    decision,
    evidence: '原PDF画像の種見出しと寄主植物欄を目視確認し、現行CSVに存在しない寄主だけを追加した。',
  });
}

for (const [recordId, reference, pdfPage, printedPage, pdfPart] of GUIDE12_DELETE_SPECS) {
  const before = byRecordId.get(recordId);
  if (!before) throw new Error(`Guide 1/2 delete target missing: ${recordId}`);
  if (before.reference !== reference) {
    throw new Error(`Unexpected Guide 1/2 delete source for ${recordId}: ${before.reference}`);
  }
  addAction({
    action: 'delete_hostplant',
    record_id: recordId,
    insect_id: before.insect_id,
    japanese_name: insectsById.get(before.insect_id)?.japanese_name || '',
    before,
    after: null,
    source_reference: reference,
    pdf_part: pdfPart,
    pdf_page: pdfPage,
    printed_page: printedPage,
    issue_class: 'ocr_name_or_adjacent_account_spill',
    decision: 'delete_row_not_supported_by_original_species_account',
    evidence: '原PDF画像の種見出し、寄主植物欄、段・欄境界を目視確認。OCRはページ候補の特定にのみ使用した。',
  });
}

for (const [recordId, patch, reference, pdfPage, printedPage, pdfPart, decision] of GUIDE12_UPDATE_SPECS) {
  const before = byRecordId.get(recordId);
  if (!before) throw new Error(`Guide 1/2 update target missing: ${recordId}`);
  if (before.reference !== reference) {
    throw new Error(`Unexpected Guide 1/2 update source for ${recordId}: ${before.reference}`);
  }
  addAction({
    action: 'update_hostplant',
    record_id: recordId,
    insect_id: before.insect_id,
    japanese_name: insectsById.get(before.insect_id)?.japanese_name || '',
    before,
    after: { ...before, ...patch },
    source_reference: reference,
    pdf_part: pdfPart,
    pdf_page: pdfPage,
    printed_page: printedPage,
    issue_class: 'ocr_name_or_resource_part_reconstruction_error',
    decision,
    evidence: '原PDF画像の種見出しと寄主植物欄を目視確認し、原文の植物名・科・利用部位へ復元した。',
  });
}

for (const [index, [insectId, plantName, plantFamily, pdfPage, printedPage]] of GUIDE1_ADD_SPECS.entries()) {
  const recordId = `hostplant-SMGHOSTAUDIT-20260712-Z1-${String(index + 1).padStart(4, '0')}`;
  if (byRecordId.has(recordId)) throw new Error(`Guide 1 add target already exists: ${recordId}`);
  const duplicate = hostplants.find(row => (
    row.insect_id === insectId
    && row.plant_name === plantName
    && row.reference === '日本産蛾類標準図鑑1'
  ));
  if (duplicate) throw new Error(`Guide 1 addition duplicates ${duplicate.record_id}: ${insectId}/${plantName}`);
  addAction({
    action: 'add_hostplant',
    record_id: recordId,
    insect_id: insectId,
    japanese_name: insectsById.get(insectId)?.japanese_name || '',
    before: null,
    after: {
      record_id: recordId,
      insect_id: insectId,
      plant_name: plantName,
      plant_family: plantFamily,
      observation_type: '文献',
      plant_part: '',
      life_stage: '幼虫',
      reference: '日本産蛾類標準図鑑1',
      notes: '',
    },
    source_reference: '日本産蛾類標準図鑑1',
    pdf_part: 'first_volume_file',
    pdf_page: pdfPage,
    printed_page: printedPage,
    issue_class: 'original_pdf_supported_host_omission',
    decision: 'add_original_account_host_missing_from_current_csv',
    evidence: '原PDF画像の種見出しと寄主植物欄を目視確認し、現行CSVに存在しない寄主だけを追加した。',
  });
}

for (const [index, spec] of GUIDE1_SECOND_ADD_SPECS.entries()) {
  const [insectId, plantName, plantFamily, pdfPage, printedPage, observationType, notesText, decision] = spec;
  const recordId = `hostplant-SMGHOSTAUDIT-20260712-Z1B-${String(index + 1).padStart(4, '0')}`;
  if (byRecordId.has(recordId)) throw new Error(`Guide 1 second-file add target already exists: ${recordId}`);
  const duplicate = hostplants.find(row => (
    row.insect_id === insectId
    && row.plant_name === plantName
    && row.reference === '日本産蛾類標準図鑑1'
  ));
  if (duplicate) throw new Error(`Guide 1 second-file addition duplicates ${duplicate.record_id}: ${insectId}/${plantName}`);
  addAction({
    action: 'add_hostplant',
    record_id: recordId,
    insect_id: insectId,
    japanese_name: insectsById.get(insectId)?.japanese_name || '',
    before: null,
    after: {
      record_id: recordId,
      insect_id: insectId,
      plant_name: plantName,
      plant_family: plantFamily,
      observation_type: observationType,
      plant_part: '',
      life_stage: '幼虫',
      reference: '日本産蛾類標準図鑑1',
      notes: notesText,
    },
    source_reference: '日本産蛾類標準図鑑1',
    pdf_part: 'second_volume_file',
    pdf_page: pdfPage,
    printed_page: printedPage,
    issue_class: 'original_pdf_supported_host_omission_or_fused_list',
    decision,
    evidence: '原PDF画像の種見出しと寄主植物欄を目視確認し、融合した複数寄主を分割または欠落した国外寄主を追加した。',
  });
}

// Thinopteryx delectans was split across two internal IDs. The original guide-1
// account (PDF page 33; printed page 174) and the flower-moth source point to the
// same taxon. Keep the established guide ID and migrate every normalized relation.
const duplicateTaxon = insectsById.get('species-21576');
const canonicalTaxon = insectsById.get('species-3743');
if (!duplicateTaxon || !canonicalTaxon) throw new Error('Thinopteryx identity rows are missing');
const thinopteryxHostIds = hostplants
  .filter(row => row.insect_id === 'species-21576')
  .map(row => row.record_id);
const thinopteryxNoteIds = notes
  .filter(row => row.insect_id === 'species-21576')
  .map(row => row.record_id);
const identityActions = {
  action: 'merge_duplicate_insect_identity',
  source_pdf_page: 33,
  printed_page: 174,
  source_reference: '日本産蛾類標準図鑑1',
  duplicate_insect_id: 'species-21576',
  canonical_insect_id: 'species-3743',
  canonical_before: canonicalTaxon,
  canonical_after: {
    ...canonicalTaxon,
    japanese_name: 'ミヤマツバメエダシャク',
  },
  duplicate_before: duplicateTaxon,
  migrate_hostplant_record_ids: thinopteryxHostIds,
  migrate_general_note_record_ids: thinopteryxNoteIds,
  expected_migration_counts: {
    hostplants: thinopteryxHostIds.length,
    general_notes: thinopteryxNoteIds.length,
  },
  evidence: '日本産蛾類標準図鑑1の原PDF画像で和名・学名・寄主欄を確認。両IDは同一の Thinopteryx delectans であり、species-3743 に著者年と図鑑寄主が既に保持されている。',
  decision: 'retain_species_3743_and_migrate_all_normalized_relations_then_remove_species_21576',
};

const countBy = (rows, key) => Object.fromEntries(
  [...rows.reduce((map, row) => map.set(row[key], (map.get(row[key]) || 0) + 1), new Map())]
    .sort(([a], [b]) => a.localeCompare(b, 'ja')),
);

const normalizedVariantKey = plantName => plantName
  .normalize('NFKC')
  .replace(/[\s・･（）()「」『』]/g, '')
  .replace(/(植物|類|属|科)$/u, '');
const variantGroups = new Map();
for (const row of sourceRows) {
  const key = `${row.reference}\u0000${row.insect_id}\u0000${normalizedVariantKey(row.plant_name)}`;
  if (!variantGroups.has(key)) variantGroups.set(key, []);
  variantGroups.get(key).push(row.record_id);
}
const variantRecordIds = new Set(
  [...variantGroups.values()].filter(rows => rows.length > 1).flat(),
);

const suspiciousPlantNames = new Set([
  '不叫', 'へ移る', '落ち菓', '浜の', '関節ブドウ', '関節クヌギ',
  'ササ顆', 'タンポポ顆', 'ヨモギ翅', 'ヒラマツギ', 'イコリヤナギ',
  'サワリン', 'ヒョウ', 'キッシル', 'ガスリ', 'ポグリ', 'ポチョウジ',
  'ハラヒノキ', 'コロコ', 'アカシ', 'ミツボシ', 'ダイサギ', 'スギモギ',
  'ネキシガラ', 'カドミ', 'ユウガキク', 'コウライジバ', 'モウソクチク',
  'テンキグサク', 'ノブドゥ', 'ブドゥ',
]);
const sourcePrintedNamesVerifiedCurrentTurn = new Set(['キッシル', 'ガスリ', 'ポグリ']);
const actionByRecordId = new Map(actions.map(action => [action.record_id, action]));
const coverageRows = sourceRows.map(row => {
  let reviewDecision = 'screened_no_high_risk_flag';
  let evidenceLevel = 'structural_and_name_screen_only';
  if (actionByRecordId.has(row.record_id)) {
    reviewDecision = actionByRecordId.get(row.record_id).action;
    evidenceLevel = 'original_pdf_image_verified_current_turn';
  } else if (row.reference === '日本産蛾類標準図鑑4') {
    reviewDecision = 'retain_prior_original_pdf_verified_partial_volume_scope';
    evidenceLevel = 'original_pdf_image_verified_prior_audit';
  } else if (row.record_id.includes('PDFAUDIT')) {
    reviewDecision = 'retain_prior_original_pdf_verified';
    evidenceLevel = 'original_pdf_image_verified_prior_audit';
  } else if (
    row.reference === '日本産蛾類標準図鑑3'
    && row.record_id.startsWith('hostplant-908')
  ) {
    reviewDecision = 'retain_original_pdf_rechecked_import_block';
    evidenceLevel = 'original_pdf_image_verified_current_turn';
  } else if (sourcePrintedNamesVerifiedCurrentTurn.has(row.plant_name)) {
    reviewDecision = 'retain_original_pdf_verified_current_turn_printed_as_source';
    evidenceLevel = 'original_pdf_image_verified_current_turn';
  } else if (suspiciousPlantNames.has(row.plant_name)) {
    reviewDecision = 'hold_name_or_boundary_suspect_original_page_not_yet_decisive';
    evidenceLevel = 'hold_no_public_claim';
  } else if (variantRecordIds.has(row.record_id)) {
    reviewDecision = 'hold_structural_plant_variant_original_page_not_rechecked';
    evidenceLevel = 'hold_no_public_claim';
  }
  return {
    record_id: row.record_id,
    insect_id: row.insect_id,
    plant_name: row.plant_name,
    reference: row.reference,
    row_sha256: sha256(JSON.stringify(row)),
    review_decision: reviewDecision,
    evidence_level: evidenceLevel,
    action_audit_id: actionByRecordId.get(row.record_id)?.audit_id || '',
  };
});

const actionCounts = countBy(actions, 'action');
const decisionCounts = countBy(coverageRows, 'review_decision');
const beforeCounts = countBy(sourceRows, 'reference');
const afterCounts = { ...beforeCounts };
for (const action of actions) {
  const source = action.source_reference;
  if (action.action === 'delete_hostplant') afterCounts[source] -= 1;
  if (action.action === 'add_hostplant') afterCounts[source] += 1;
}

const audit = {
  audit_version: 'japanese-standard-moth-guides-hostplant-integrity-v1-2026-07-12',
  reviewed_on: '2026-07-12',
  method: {
    authority_rule: 'original_pdf_image_is_authority_ocr_is_candidate_locator_only',
    coverage_rule: 'every_exact-reference_hostplant_row_receives_one_ledger_decision',
    application_rule: 'only_original_pdf_confirmed_changes_are_normalized; unresolved_rows_remain_hold',
    public_data_rule: 'public_csv_not_modified_by_this_audit',
  },
  source_pdfs: PDF_SOURCES,
  scan_scope: {
    exact_reference_rows_before: sourceRows.length,
    exact_reference_rows_before_by_reference: beforeCounts,
    exact_reference_rows_after_expected_by_reference: afterCounts,
    coverage_rows: coverageRows.length,
    coverage_unique_record_ids: new Set(coverageRows.map(row => row.record_id)).size,
    structural_plant_variant_groups: [...variantGroups.values()].filter(group => group.length > 1).length,
    action_counts: actionCounts,
    coverage_decision_counts: decisionCounts,
    guide4_scope: '445 existing rows are within the recovered printed-page 86-155 partial PDF; outside that range remains source-not-recovered hold.',
  },
  high_risk_findings: [
    {
      reference: '日本産蛾類標準図鑑3',
      finding: 'A large multi-page import block assigned neighboring species-account hosts to the wrong insect IDs.',
      resolution: 'Delete only rows contradicted by the original account; add or restore only hosts visible in the original PDF.',
    },
    {
      reference: '日本産蛾類標準図鑑3',
      finding: 'Non-host prose and host-unknown text were parsed as plant names (for example へ移る and 不叫).',
      resolution: 'Delete the non-host rows after checking the original account and column boundary.',
    },
    {
      reference: '日本産蛾類標準図鑑1',
      finding: 'Thinopteryx delectans was split between species-21576 and species-3743.',
      resolution: 'Preserve species-3743, restore the Japanese name, migrate all normalized relations, and remove the duplicate ID.',
    },
    {
      reference: '日本産蛾類標準図鑑4',
      finding: 'Only printed pages 86-155 are currently recovered.',
      resolution: 'Treat the 445 existing rows as verified within scope and make no claim about unrecovered pages.',
    },
  ],
  actions,
  identity_actions: [identityActions],
  coverage_rows: coverageRows,
};

fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(audit, null, 2)}\n`);
console.log(JSON.stringify({
  output: path.relative(ROOT, OUTPUT_PATH),
  rows: coverageRows.length,
  before_counts: beforeCounts,
  after_counts: afterCounts,
  action_counts: actionCounts,
  identity_migrations: identityActions.expected_migration_counts,
}, null, 2));

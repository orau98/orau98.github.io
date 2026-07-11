import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { fileURLToPath } from 'url';
import { collectGeneralNoteIssues } from './lib/generalNoteQuality.mjs';
import { collectTaxonomyAssertionFailures } from './lib/taxonomyAssertions.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');
const REPORTS_DIR = path.join(ROOT, 'reports');
const NORMALIZED_INSECTS_PATH = path.join(ROOT, 'normalized_data', 'insects.csv');
const PUBLIC_INSECTS_PATH = path.join(ROOT, 'public', 'insects.csv');
const KIRIGA_ECOLOGY_AUDIT_PATH = path.join(
  ROOT,
  'data',
  'source_audits',
  'japan-winter-noctuid-ecology.csv',
);
const KIRIGA_LEGACY_REFERENCE = '日本のキリガ';
const KIRIGA_CANONICAL_REFERENCE = '日本の冬夜蛾';
const KIRIGA_CANONICAL_NOTE_TYPE = '生態情報';
const KIRIGA_SOURCE_PDF_FILE = '日本のキリガ.pdf';
const KIRIGA_SOURCE_PDF_SHA256 = '8d6fdad849c967ec2ea5659fd1b455ea088e13d7bde74d936bbbea97586d703d';

const candidates = [
  path.join(ROOT, 'normalized_data'),
  path.join(ROOT, 'public')
];

const findExisting = (filename) => {
  for (const dir of candidates) {
    const full = path.join(dir, filename);
    if (fs.existsSync(full)) return full;
  }
  return null;
};

const insectsPath = findExisting('insects.csv');
const hostplantsPath = findExisting('hostplants.csv');
const notesPath = findExisting('general_notes.csv');

if (!insectsPath) {
  console.warn('[validate-normalized] insects.csv not found; skipping validation.');
  process.exit(0);
}

const parseCsv = (text) => {
  const normalizedText = (text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const parsed = Papa.parse(normalizedText, { header: true, skipEmptyLines: true });
  if (parsed.errors.length > 0) {
    throw new Error(`CSV parse failed: ${parsed.errors[0].message}`);
  }
  return parsed.data || [];
};
const cleanString = (value) => (value ?? '').toString().trim();
const kirigaAuditRows = fs.existsSync(KIRIGA_ECOLOGY_AUDIT_PATH)
  ? parseCsv(fs.readFileSync(KIRIGA_ECOLOGY_AUDIT_PATH, 'utf-8'))
  : [];
const kirigaAuditById = new Map();
kirigaAuditRows.forEach((row) => {
  const recordId = cleanString(row.record_id);
  if (!recordId) throw new Error('Kiriga ecology audit row is missing record_id');
  if (kirigaAuditById.has(recordId)) throw new Error(`Duplicate Kiriga audit record_id: ${recordId}`);
  if (cleanString(row.canonical_reference) !== KIRIGA_CANONICAL_REFERENCE) {
    throw new Error(`Kiriga audit reference mismatch: ${recordId}`);
  }
  if (cleanString(row.pdf_file) !== KIRIGA_SOURCE_PDF_FILE) {
    throw new Error(`Kiriga audit PDF filename mismatch: ${recordId}`);
  }
  if (cleanString(row.source_pdf_sha256) !== KIRIGA_SOURCE_PDF_SHA256) {
    throw new Error(`Kiriga audit PDF hash mismatch: ${recordId}`);
  }
  if (!cleanString(row.pdf_page) || !cleanString(row.printed_page)) {
    throw new Error(`Kiriga audit page evidence is missing: ${recordId}`);
  }
  if (cleanString(row.note_type) !== KIRIGA_CANONICAL_NOTE_TYPE) {
    throw new Error(`Kiriga audit note type mismatch: ${recordId}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanString(row.reviewed_on))) {
    throw new Error(`Kiriga audit review date is invalid: ${recordId}`);
  }
  if (!['include', 'exclude_subjective', 'exclude_source_bleed', 'exclude_unresolved_ocr'].includes(cleanString(row.decision))) {
    throw new Error(`Unsupported Kiriga audit decision: ${recordId}`);
  }
  kirigaAuditById.set(recordId, row);
});
const SUSPICIOUS_PLANT_NAME_SET = new Set([
  '葉',
  '葉裏',
  '葉表',
  '茎',
  '茎と葉裏',
  '主として茎',
  '根',
  '成葉の裏面',
  '生長部の茎と葉裏',
  '新梢の生長部',
  '新梢の茎',
  '穂',
  '地中の根',
]);
const SUSPICIOUS_PLANT_NAME_MARKERS = [
  'として',
  'では',
  '確認',
  '記録',
  '採集',
  '飛来',
  '普通種',
  '得られる',
  'という',
  'である',
  '屋台',
  'ページ',
  '有名',
  '判明',
  'との区別',
  '次種',
  '前種',
  '国内では不明',
  '日本では不明',
  'ヨーロッパでは',
  '欧州では',
  '国外では',
];
const NON_PLANT_HOST_NAME_SET = new Set([
  'サナギ',
  '蛹',
  'ハビロキバガ',
  'チャミノ',
]);
const SUSPICIOUS_HOSTPLANT_NOTE_SET = new Set([
  '有',
  '別',
  '例',
  '例T',
  'Mf',
  'M11',
  'N',
  '創',
  '創省',
  '国省',
  '国有',
  '割付',
  '音',
  'し',
]);
const BLOCKED_GENERAL_NOTE_RULES = [
  {
    insect_id: 'species-6031',
    phrase: '翌年5月',
    note_type: '出現時期',
    reason: 'コケイロホソキリガは標準図鑑2由来の10～1月を採用する。日本のキリガOCR由来の翌年5月行は混入させない。',
  },
  {
    insect_id: 'species-6026',
    phrase: '翌年5月',
    note_type: '出現時期',
    reason: 'モンハイイロキリガの出現時期は標準図鑑2由来の9〜11月を採用する。OCR由来の翌年5月行は混入させない。',
  },
  {
    insect_id: 'species-6027',
    phrase: '翌年5月',
    note_type: '出現時期',
    reason: 'ウスアオキリガの出現時期は標準図鑑2由来の9〜11月を採用する。生存情報と出現時期を混同したOCR由来行は混入させない。',
  },
];
const hasEmbeddedObservationType = (plantName) => /（飼育(?:可|では[^）]+)?）/.test(plantName);
const hasSuspiciousKirigaPattern = (row, plantName) => {
  if (cleanString(row.reference) !== '日本のキリガ') return false;
  return (
    /[ぁ-ん]/.test(plantName) ||
    /[0-9A-Za-z]/.test(plantName) ||
    /[<>:：!！]/.test(plantName) ||
    /（(?:有|別|例|例T|Mf|M11|N|創|創省|国省|国有|割付|音|し)）/.test(plantName) ||
    plantName === '冬規美' ||
    plantName.length >= 16
  );
};
const escapeCsv = (value) => `"${(value ?? '').toString().replace(/"/g, '""')}"`;
const hasJapaneseChars = (value) => /[\u3040-\u30ff\u3400-\u9fff]/.test(cleanString(value));
const hasScientificNameNoise = (row) => {
  const scientificName = cleanString(row.scientific_name);
  const author = cleanString(row.author);
  const year = cleanString(row.year);
  return (
    /[;；]/.test(scientificName) ||
    (hasJapaneseChars(scientificName) && /\b[A-Z][a-z]+/.test(scientificName)) ||
    /[;；]/.test(author) ||
    (hasJapaneseChars(author) && /\d{4}/.test(author)) ||
    /[;；]/.test(year)
  );
};

const writeCsvReport = (filename, headers, rows) => {
  const fullPath = path.join(REPORTS_DIR, filename);
  const headerLine = headers.join(',') + '\n';
  const body = rows
    .map((row) => headers.map((header) => escapeCsv(row[header] ?? '')).join(','))
    .join('\n');
  fs.writeFileSync(fullPath, headerLine + (body ? body + '\n' : ''), 'utf-8');
};

const insectsText = fs.readFileSync(insectsPath, 'utf-8');
const insects = parseCsv(insectsText);
const insectIdCounts = new Map();
const insectsById = new Map();
insects.forEach((row) => {
  const id = cleanString(row.insect_id);
  if (!id) return;
  insectIdCounts.set(id, (insectIdCounts.get(id) || 0) + 1);
  insectsById.set(id, row);
});
const insectIds = new Set(
  insects.map((row) => (row.insect_id || '').trim()).filter(Boolean)
);
const duplicateInsectIds = Array.from(insectIdCounts.entries())
  .filter(([, count]) => count > 1)
  .map(([insect_id, count]) => ({ insect_id, count }));
const isAphidLinkedRow = (row) => {
  if (!row) return false;
  return cleanString(row.family) === 'Aphididae' || cleanString(row.family_jp).includes('アブラムシ');
};

const missingIds = [];
const hostplantCounts = new Map();
const generalNoteCounts = new Map();
const suspiciousHostplantRows = [];
const suspiciousHostplantNoteRows = [];
const blockedGeneralNoteRows = [];
const suspiciousGeneralNoteRows = [];
const seenKirigaAuditIds = new Set();
const aphidWrongLinkRows = [];
const suspiciousScientificNameRows = insects
  .filter((row) => hasScientificNameNoise(row))
  .map((row) => ({
    insect_id: cleanString(row.insect_id),
    japanese_name: cleanString(row.japanese_name),
    scientific_name: cleanString(row.scientific_name),
    author: cleanString(row.author),
    year: cleanString(row.year),
    changes_since_standard: cleanString(row.changes_since_standard),
    notes: cleanString(row.notes),
  }));
const taxonomyAssertionFailures = collectTaxonomyAssertionFailures(insects);
const recordMissing = (source, row) => {
  const id = (row.insect_id || '').trim();
  if (!id || insectIds.has(id)) return;
  missingIds.push({ source, insect_id: id });
};

if (hostplantsPath) {
  const hostText = fs.readFileSync(hostplantsPath, 'utf-8');
  const hostRows = parseCsv(hostText);
  hostRows.forEach((row) => {
    const insectId = cleanString(row.insect_id);
    if (insectId) {
      hostplantCounts.set(insectId, (hostplantCounts.get(insectId) || 0) + 1);
    }
    if (cleanString(row.reference) === '日本原色アブラムシ図鑑') {
      const linkedInsect = insectsById.get(insectId);
      if (!isAphidLinkedRow(linkedInsect)) {
        aphidWrongLinkRows.push({
          record_id: cleanString(row.record_id),
          insect_id: insectId,
          plant_name: cleanString(row.plant_name),
          plant_part: cleanString(row.plant_part),
          linked_family_jp: cleanString(linkedInsect?.family_jp),
          linked_japanese_name: cleanString(linkedInsect?.japanese_name),
          linked_scientific_name: cleanString(linkedInsect?.scientific_name),
        });
      }
    }
    const plantName = cleanString(row.plant_name);
    const hostplantNote = cleanString(row.notes);
    const isSentenceLikePlantName = SUSPICIOUS_PLANT_NAME_MARKERS.some((marker) => plantName.includes(marker));
    if (
      SUSPICIOUS_PLANT_NAME_SET.has(plantName) ||
      NON_PLANT_HOST_NAME_SET.has(plantName) ||
      hasEmbeddedObservationType(plantName) ||
      plantName.endsWith('の葉') ||
      isSentenceLikePlantName ||
      hasSuspiciousKirigaPattern(row, plantName)
    ) {
      suspiciousHostplantRows.push({
        record_id: cleanString(row.record_id),
        insect_id: insectId,
        plant_name: plantName,
        plant_family: cleanString(row.plant_family),
        observation_type: cleanString(row.observation_type),
        plant_part: cleanString(row.plant_part),
        life_stage: cleanString(row.life_stage),
        reference: cleanString(row.reference),
        notes: cleanString(row.notes),
      });
    }
    if (SUSPICIOUS_HOSTPLANT_NOTE_SET.has(hostplantNote)) {
      suspiciousHostplantNoteRows.push({
        record_id: cleanString(row.record_id),
        insect_id: insectId,
        plant_name: plantName,
        reference: cleanString(row.reference),
        notes: hostplantNote,
      });
    }
    recordMissing('hostplants', row);
  });
} else {
  console.warn('[validate-normalized] hostplants.csv not found; skipping hostplant reference checks.');
}

if (notesPath) {
  const notesText = fs.readFileSync(notesPath, 'utf-8');
  const noteRows = parseCsv(notesText);
  noteRows.forEach((row) => {
    const recordId = cleanString(row.record_id);
    const insectId = cleanString(row.insect_id);
    if (insectId) {
      generalNoteCounts.set(insectId, (generalNoteCounts.get(insectId) || 0) + 1);
    }
    const content = cleanString(row.content);
    const noteType = cleanString(row.note_type);
    const reference = cleanString(row.reference);
    const page = cleanString(row.page);
    const audit = kirigaAuditById.get(recordId);
    const issueCodes = [];

    if (audit) {
      seenKirigaAuditIds.add(recordId);
      if (cleanString(audit.decision) !== 'include') {
        issueCodes.push('excluded_audit_row_is_public');
      } else {
        if (insectId !== cleanString(audit.insect_id)) issueCodes.push('audit_insect_id_mismatch');
        if (noteType !== KIRIGA_CANONICAL_NOTE_TYPE) issueCodes.push('legacy_note_type');
        if (reference !== KIRIGA_CANONICAL_REFERENCE) issueCodes.push('legacy_source_label');
        if (page !== cleanString(audit.printed_page)) issueCodes.push('audit_page_mismatch');
        if (content !== cleanString(audit.approved_content)) issueCodes.push('audit_content_mismatch');
        issueCodes.push(...collectGeneralNoteIssues(row));
      }
    } else if (reference === KIRIGA_CANONICAL_REFERENCE && noteType === KIRIGA_CANONICAL_NOTE_TYPE) {
      issueCodes.push('missing_audit_entry');
    }

    if (reference === KIRIGA_LEGACY_REFERENCE && ['生態', '生態情報'].includes(noteType)) {
      issueCodes.push('legacy_unaudited_kiriga_ecology');
    }

    if (issueCodes.length > 0) {
      suspiciousGeneralNoteRows.push({
        record_id: recordId,
        insect_id: insectId,
        note_type: noteType,
        content,
        reference,
        page,
        issue_codes: [...new Set(issueCodes)].join(';'),
      });
    }

    BLOCKED_GENERAL_NOTE_RULES.forEach((rule) => {
      const noteTypeHit = !rule.note_type || noteType === rule.note_type;
      if (insectId === rule.insect_id && noteTypeHit && content.includes(rule.phrase)) {
        blockedGeneralNoteRows.push({
          record_id: cleanString(row.record_id),
          insect_id: insectId,
          note_type: noteType,
          content,
          reference: cleanString(row.reference),
          reason: rule.reason,
        });
      }
    });
    recordMissing('general_notes', row);
  });

  kirigaAuditRows.forEach((audit) => {
    if (cleanString(audit.decision) !== 'include' || seenKirigaAuditIds.has(cleanString(audit.record_id))) return;
    suspiciousGeneralNoteRows.push({
      record_id: cleanString(audit.record_id),
      insect_id: cleanString(audit.insect_id),
      note_type: KIRIGA_CANONICAL_NOTE_TYPE,
      content: cleanString(audit.approved_content),
      reference: KIRIGA_CANONICAL_REFERENCE,
      page: cleanString(audit.printed_page),
      issue_codes: 'missing_approved_row',
    });
  });
} else {
  console.warn('[validate-normalized] general_notes.csv not found; skipping notes reference checks.');
}

if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

const reportPath = path.join(REPORTS_DIR, 'missing_ids.csv');
const header = 'source,insect_id\n';
const body = missingIds.map((row) => `${row.source},${row.insect_id}`).join('\n');
fs.writeFileSync(reportPath, header + (body ? body + '\n' : ''), 'utf-8');

const duplicateReportPath = path.join(REPORTS_DIR, 'duplicate_insect_ids.csv');
const duplicateHeader = 'insect_id,count\n';
const duplicateBody = duplicateInsectIds.map((row) => `${row.insect_id},${row.count}`).join('\n');
fs.writeFileSync(
  duplicateReportPath,
  duplicateHeader + (duplicateBody ? duplicateBody + '\n' : ''),
  'utf-8',
);

const blankJapaneseNameLinkedRows = insects
  .filter((row) =>
    !cleanString(row.japanese_name) &&
    ((hostplantCounts.get(cleanString(row.insect_id)) || 0) > 0 ||
      (generalNoteCounts.get(cleanString(row.insect_id)) || 0) > 0)
  )
  .map((row) => ({
    insect_id: cleanString(row.insect_id),
    family_jp: cleanString(row.family_jp),
    scientific_name: cleanString(row.scientific_name),
    hostplant_count: hostplantCounts.get(cleanString(row.insect_id)) || 0,
    general_note_count: generalNoteCounts.get(cleanString(row.insect_id)) || 0,
    notes: cleanString(row.notes),
  }));

const placeholderNoteMismatchRows = insects
  .filter((row) => {
    const insectId = cleanString(row.insect_id);
    const note = cleanString(row.notes);
    return note.includes('食草・生態情報は未入力') &&
      ((hostplantCounts.get(insectId) || 0) > 0 || (generalNoteCounts.get(insectId) || 0) > 0);
  })
  .map((row) => ({
    insect_id: cleanString(row.insect_id),
    japanese_name: cleanString(row.japanese_name),
    scientific_name: cleanString(row.scientific_name),
    hostplant_count: hostplantCounts.get(cleanString(row.insect_id)) || 0,
    general_note_count: generalNoteCounts.get(cleanString(row.insect_id)) || 0,
    notes: cleanString(row.notes),
  }));

const missingFamilyRows = insects
  .filter((row) => !cleanString(row.family))
  .map((row) => ({
    insect_id: cleanString(row.insect_id),
    japanese_name: cleanString(row.japanese_name),
    scientific_name: cleanString(row.scientific_name),
    family_jp: cleanString(row.family_jp),
  }));

writeCsvReport(
  'suspicious_hostplants.csv',
  ['record_id', 'insect_id', 'plant_name', 'plant_family', 'observation_type', 'plant_part', 'life_stage', 'reference', 'notes'],
  suspiciousHostplantRows,
);
writeCsvReport(
  'suspicious_hostplant_notes.csv',
  ['record_id', 'insect_id', 'plant_name', 'reference', 'notes'],
  suspiciousHostplantNoteRows,
);
writeCsvReport(
  'blocked_general_notes.csv',
  ['record_id', 'insect_id', 'note_type', 'content', 'reference', 'reason'],
  blockedGeneralNoteRows,
);
if (suspiciousGeneralNoteRows.length > 0) {
  writeCsvReport(
    'suspicious_general_notes.csv',
    ['record_id', 'insect_id', 'note_type', 'content', 'reference', 'page', 'issue_codes'],
    suspiciousGeneralNoteRows,
  );
}
writeCsvReport(
  'blank_japanese_name_links.csv',
  ['insect_id', 'family_jp', 'scientific_name', 'hostplant_count', 'general_note_count', 'notes'],
  blankJapaneseNameLinkedRows,
);
writeCsvReport(
  'placeholder_note_mismatch.csv',
  ['insect_id', 'japanese_name', 'scientific_name', 'hostplant_count', 'general_note_count', 'notes'],
  placeholderNoteMismatchRows,
);
writeCsvReport(
  'missing_family_insects.csv',
  ['insect_id', 'japanese_name', 'scientific_name', 'family_jp'],
  missingFamilyRows,
);
writeCsvReport(
  'aphid_wrong_links.csv',
  ['record_id', 'insect_id', 'plant_name', 'plant_part', 'linked_family_jp', 'linked_japanese_name', 'linked_scientific_name'],
  aphidWrongLinkRows,
);
writeCsvReport(
  'suspicious_scientific_names.csv',
  ['insect_id', 'japanese_name', 'scientific_name', 'author', 'year', 'changes_since_standard', 'notes'],
  suspiciousScientificNameRows,
);
writeCsvReport(
  'taxonomy_assertion_failures.csv',
  ['assertion_id', 'insect_id', 'japanese_name', 'field', 'expected', 'actual', 'source'],
  taxonomyAssertionFailures,
);

if (fs.existsSync(NORMALIZED_INSECTS_PATH) && fs.existsSync(PUBLIC_INSECTS_PATH)) {
  const normalizedRows = parseCsv(fs.readFileSync(NORMALIZED_INSECTS_PATH, 'utf-8'));
  const publicRows = parseCsv(fs.readFileSync(PUBLIC_INSECTS_PATH, 'utf-8'));
  const normalizedById = new Map(
    normalizedRows
      .map((row) => [cleanString(row.insect_id), row])
      .filter(([id]) => id),
  );
  const publicById = new Map(
    publicRows
      .map((row) => [cleanString(row.insect_id), row])
      .filter(([id]) => id),
  );

  const mismatchRows = [];
  normalizedById.forEach((normalizedRow, id) => {
    const publicRow = publicById.get(id);
    if (!publicRow) return;
    const normalizedJson = JSON.stringify(normalizedRow);
    const publicJson = JSON.stringify(publicRow);
    if (normalizedJson === publicJson) return;
    mismatchRows.push({
      kind: 'mismatch',
      insect_id: id,
      normalized_japanese_name: cleanString(normalizedRow.japanese_name),
      public_japanese_name: cleanString(publicRow.japanese_name),
      normalized_scientific_name: cleanString(normalizedRow.scientific_name),
      public_scientific_name: cleanString(publicRow.scientific_name),
    });
  });
  publicById.forEach((publicRow, id) => {
    if (normalizedById.has(id)) return;
    mismatchRows.push({
      kind: 'only_in_public',
      insect_id: id,
      normalized_japanese_name: '',
      public_japanese_name: cleanString(publicRow.japanese_name),
      normalized_scientific_name: '',
      public_scientific_name: cleanString(publicRow.scientific_name),
    });
  });

  const mismatchReportPath = path.join(REPORTS_DIR, 'public_insects_mismatch.csv');
  const mismatchHeader = [
    'kind',
    'insect_id',
    'normalized_japanese_name',
    'public_japanese_name',
    'normalized_scientific_name',
    'public_scientific_name',
  ].join(',') + '\n';
  const mismatchBody = mismatchRows
    .map((row) => [
      row.kind,
      row.insect_id,
      row.normalized_japanese_name,
      row.public_japanese_name,
      row.normalized_scientific_name,
      row.public_scientific_name,
    ].map(escapeCsv).join(','))
    .join('\n');
  fs.writeFileSync(
    mismatchReportPath,
    mismatchHeader + (mismatchBody ? mismatchBody + '\n' : ''),
    'utf-8',
  );

  if (mismatchRows.length > 0) {
    console.warn(`[validate-normalized] normalized/public insects mismatch rows: ${mismatchRows.length}`);
  }
}

const strict = process.env.STRICT_VALIDATE_NORMALIZED === '1';
if (missingIds.length > 0) {
  console.warn(`[validate-normalized] missing insect_id references: ${missingIds.length}`);
  if (strict) {
    process.exit(1);
  }
}

if (duplicateInsectIds.length > 0) {
  console.error(`[validate-normalized] duplicate insect_id rows: ${duplicateInsectIds.length}`);
  process.exit(1);
}

if (suspiciousHostplantRows.length > 0) {
  console.warn(`[validate-normalized] suspicious hostplant rows: ${suspiciousHostplantRows.length}`);
}

if (suspiciousHostplantNoteRows.length > 0) {
  console.error(`[validate-normalized] suspicious hostplant note fragments: ${suspiciousHostplantNoteRows.length}`);
  process.exit(1);
}

if (blockedGeneralNoteRows.length > 0) {
  console.error(`[validate-normalized] blocked general notes: ${blockedGeneralNoteRows.length}`);
  process.exit(1);
}

if (kirigaAuditRows.length === 0) {
  console.error('[validate-normalized] Kiriga ecology PDF audit ledger is missing or empty');
  process.exit(1);
}

if (suspiciousGeneralNoteRows.length > 0) {
  console.error(`[validate-normalized] suspicious general notes: ${suspiciousGeneralNoteRows.length}`);
  process.exit(1);
}

if (blankJapaneseNameLinkedRows.length > 0) {
  console.warn(`[validate-normalized] blank japanese_name rows with linked data: ${blankJapaneseNameLinkedRows.length}`);
}

if (placeholderNoteMismatchRows.length > 0) {
  console.warn(`[validate-normalized] placeholder notes mismatching linked data: ${placeholderNoteMismatchRows.length}`);
}

if (missingFamilyRows.length > 0) {
  console.warn(`[validate-normalized] insects missing family: ${missingFamilyRows.length}`);
}

if (aphidWrongLinkRows.length > 0) {
  console.warn(`[validate-normalized] aphid atlas rows linked to non-aphids: ${aphidWrongLinkRows.length}`);
}

if (suspiciousScientificNameRows.length > 0) {
  console.warn(`[validate-normalized] suspicious scientific_name rows: ${suspiciousScientificNameRows.length}`);
}

if (taxonomyAssertionFailures.length > 0) {
  console.error(`[validate-normalized] source-backed taxonomy assertion failures: ${taxonomyAssertionFailures.length}`);
  process.exit(1);
}

console.log('[validate-normalized] OK');

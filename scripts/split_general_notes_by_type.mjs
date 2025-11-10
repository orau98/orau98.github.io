#!/usr/bin/env node
/**
 * Split mixed general_notes rows so that emergence timing (出現時期) and ecology (生態情報)
 * are stored in dedicated records.
 *
 * Heuristics:
 *  - Sentences/clauses containing months, seasons, generation counts, etc. are treated as 出現時期.
 *  - Sentences with host-plant / habitat / behavior keywords (without clear timing cues) are treated as 生態情報.
 *  - Segments that include both are recursively split on 、 or ， delimiters. Remaining ambiguous segments are logged.
 *
 * The script rewrites both public/general_notes.csv and normalized_data/general_notes.csv
 * (or a custom list passed via CLI arguments) and produces a summary report.
 */
import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

const DEFAULT_FILES = [
  path.join('public', 'general_notes.csv'),
  path.join('normalized_data', 'general_notes.csv'),
];

const targets = process.argv.slice(2);
const files = targets.length ? targets : DEFAULT_FILES;

const EMERGENCE_REGEXES = [
  /[0-9０-９]{1,2}\s*(?:[~〜\-–—−－―]\s*[0-9０-９]{1,2})?\s*月/,
  /(初春|早春|春|晩春|梅雨|初夏|盛夏|晩夏|初秋|仲秋|晩秋|初冬|真冬|厳冬|晩冬|冬|越冬|越夏|越年|周年|通年|春季|夏季|秋季|冬季|春期|夏期|秋期|冬期)/,
  /(上旬|中旬|下旬|頃|ごろ|ころ|前半|後半)/,
  /(?:[0-9０-９一二三四五六七八九十]+|数)\s*(?:化|世代)/,
  /(発生|出現|羽化|活動|出没|現れる|飛翔|出る)\s*(?:時期|期)?/,
  /(新成虫|羽化脱出|羽脱)/,
  /(成虫|幼虫|蛹)[^。．\.！？!?、，；;]*(?:期|時期|出現|活動|越冬|越夏)/,
];

const ECOLOGY_REGEXES = [
  /(食草|食樹|食害|食す|食する|食べる|後食|餌|餌木|寄主|寄生|宿主|吸蜜|吸汁|餌植物)/,
  /(幼虫|蛹|卵|産卵|蛹化|孵化|羽化殻|脱出孔)/,
  /(花|葉|枝|幹|樹皮|樹洞|樹液|果実|実|根|地下茎|芽)/,
  /(広食性|単食性|雑食|害虫|加害|被害|寄生性)/,
  /(飼育|人工飼育|飼料|餌付)/,
  /(生活|生息|棲息|棲む|潜る|隠れる|越冬場所)/,
  /(草地|森林|林縁|雑木林|低山|山地|高山|海岸|砂丘|湿地|渓流|河川|平地|畑|庭園|公園)/,
];

function normalizeDigits(text = '') {
  return text.replace(/[０-９]/g, d => String.fromCharCode(d.charCodeAt(0) - 0xFEE0 + 0x30));
}

function normalizeForDetection(text = '') {
  return normalizeDigits(text)
    .replace(/〜/g, '~')
    .replace(/[−－―—–]/g, '-');
}

function splitIntoBaseSegments(content = '') {
  const normalized = content.replace(/\r?\n/g, ' ').replace(/\s{2,}/g, ' ').trim();
  if (!normalized) return [];
  const segments = [];
  let current = '';
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    current += ch;
    if (/^[。．\.！？!?；;]$/.test(ch)) {
      pushSegment(current);
      current = '';
    }
  }
  if (current.trim()) pushSegment(current);
  return segments;

  function pushSegment(str) {
    const raw = str.trim();
    if (!raw) return;
    const clean = raw.replace(/[。．\.！？!?；;]+$/u, '').trim();
    segments.push({ raw, clean, derived: false });
  }
}

function formatSegment(text) {
  let t = text.trim();
  if (!t) return '';
  if (!/[。．\.！？!?]$/.test(t)) t += '。';
  return t;
}

function analyzeFlags(text = '') {
  const prepared = normalizeForDetection(text);
  const hasEmergence = EMERGENCE_REGEXES.some(re => re.test(prepared));
  const hasEcology = ECOLOGY_REGEXES.some(re => re.test(prepared));
  return { hasEmergence, hasEcology };
}

function maybeSplitAmbiguous(segment) {
  const flags = analyzeFlags(segment.clean);
  if (!(flags.hasEmergence && flags.hasEcology) || !/[、，]/.test(segment.clean)) return [segment];
  const clauses = segment.clean.split(/[、，]/).map(v => v.trim()).filter(Boolean);
  if (clauses.length <= 1) return [segment];
  const derived = clauses.map(cl => ({ raw: formatSegment(cl), clean: cl, derived: true }));
  return derived.flatMap(maybeSplitAmbiguous);
}

const ADULT_CUES = /(成虫|新成虫|羽化|羽化脱出|羽脱|飛翔|灯火|採集|発生|出現|蛹化直後|成虫で越冬)/;
const IMMATURE_CUES = /(幼虫|若齢|終齢|蛹|卵|幼生|幼虫で越冬|蛹で越冬|幼虫越冬|蛹越冬|産卵)/;

function classifySegment(segment) {
  const { hasEmergence, hasEcology } = analyzeFlags(segment.clean);
  if (hasEmergence && hasEcology) {
    const hasAdult = ADULT_CUES.test(segment.clean);
    const hasImmature = IMMATURE_CUES.test(segment.clean);
    if (hasAdult && !hasImmature) return 'emergence';
    if (hasImmature && !hasAdult) return 'ecology';
    return 'ambiguous';
  }
  if (hasEmergence) return 'emergence';
  if (hasEcology) return 'ecology';
  return 'unknown';
}

function joinSegments(segments) {
  return segments.map(seg => seg.raw).join('');
}

function allocateNewRecordId(originalId, targetType, counters, existingIds) {
  const key = `${originalId}|${targetType}`;
  const next = (counters.get(key) || 0) + 1;
  counters.set(key, next);
  const suffixBase = targetType === '出現時期' ? 'E' : 'Eco';
  let candidate = `${originalId}-${suffixBase}${String(next).padStart(2, '0')}`;
  while (existingIds.has(candidate)) {
    const bump = (counters.get(`${key}|extra`) || 0) + 1;
    counters.set(`${key}|extra`, bump);
    candidate = `${originalId}-${suffixBase}${String(next + bump).padStart(2, '0')}`;
  }
  existingIds.add(candidate);
  return candidate;
}

function normalizeRow(row) {
  return {
    record_id: (row.record_id ?? '').trim(),
    insect_id: (row.insect_id ?? '').trim(),
    note_type: (row.note_type ?? '').trim(),
    content: (row.content ?? '').trim(),
    reference: (row.reference ?? '').trim(),
    page: (row.page ?? '').trim(),
    year: (row.year ?? '').trim(),
  };
}

function processFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return { file: filePath, missing: true };
  }
  const csvText = fs.readFileSync(filePath, 'utf8');
  const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: false });
  const rows = parsed.data.filter(row => row && Object.values(row).some(v => (v ?? '').toString().trim() !== ''));
  const resultRows = [];
  const existingIds = new Set(rows.map(r => (r.record_id ?? '').trim()).filter(Boolean));
  const counters = new Map();
  const ambiguousSamples = [];

  const stats = {
    file: filePath,
    totalRows: rows.length,
    rowsModified: 0,
    rowsRemoved: 0,
    newRecords: 0,
    segmentsMoved: 0,
    ambiguousSegments: 0,
  };

  for (const original of rows) {
    const row = normalizeRow(original);
    if (!row.record_id && !row.insect_id) continue;

    if (!['出現時期', '生態情報'].includes(row.note_type) || !row.content) {
      resultRows.push(row);
      continue;
    }

    let segments = splitIntoBaseSegments(row.content);
    segments = segments.flatMap(maybeSplitAmbiguous);

    const keepSegments = [];
    const movedByType = new Map();
    let movedThisRow = false;

    for (const seg of segments) {
      const classification = classifySegment(seg);
      if (classification === 'unknown') {
        keepSegments.push(seg);
        continue;
      }
      if (classification === 'ambiguous') {
        keepSegments.push(seg);
        stats.ambiguousSegments++;
        if (ambiguousSamples.length < 50) {
          ambiguousSamples.push({ record_id: row.record_id, note_type: row.note_type, segment: seg.raw });
        }
        continue;
      }
      const targetType = classification === 'emergence' ? '出現時期' : '生態情報';
      if (targetType === row.note_type) {
        keepSegments.push(seg);
      } else {
        movedThisRow = true;
        if (!movedByType.has(targetType)) movedByType.set(targetType, []);
        movedByType.get(targetType).push(seg);
      }
    }

    const keptContent = joinSegments(keepSegments).trim();
    if (keptContent) {
      if (movedThisRow || keptContent !== row.content) {
        stats.rowsModified++;
      }
      resultRows.push({ ...row, content: keptContent });
    } else {
      stats.rowsRemoved++;
    }

    for (const [targetType, segs] of movedByType.entries()) {
      const newContent = joinSegments(segs).trim();
      if (!newContent) continue;
      const newId = allocateNewRecordId(row.record_id, targetType, counters, existingIds);
      const newRow = {
        record_id: newId,
        insect_id: row.insect_id,
        note_type: targetType,
        content: newContent,
        reference: row.reference,
        page: row.page,
        year: row.year,
      };
      resultRows.push(newRow);
      stats.newRecords++;
      stats.segmentsMoved += segs.length;
    }
  }

  const outCsv = Papa.unparse(resultRows, { columns: ['record_id', 'insect_id', 'note_type', 'content', 'reference', 'page', 'year'] });
  fs.writeFileSync(filePath, outCsv + '\n', 'utf8');

  stats.ambiguousSamples = ambiguousSamples;
  return stats;
}

const report = [];
for (const filePath of files) {
  const res = processFile(filePath);
  report.push(res);
  if (res.missing) {
    console.warn(`skip: ${filePath} (not found)`);
  } else {
    console.log(`Processed ${filePath}: modified ${res.rowsModified}, new records ${res.newRecords}, ambiguous ${res.ambiguousSegments}`);
  }
}

const reportPath = path.join('reports', 'general_notes_split_report.json');
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(`Summary written to ${reportPath}`);

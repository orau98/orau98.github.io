import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { fileURLToPath } from 'url';
import {
  cleanString,
  isNonPlantResourceName,
  isSuspiciousPlantName,
  normalizePlantNameLite,
} from './lib/dataLiteBuilders.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

const args = process.argv.slice(2);
const writeIndex = args.indexOf('--write');
const writePath = writeIndex >= 0
  ? path.resolve(ROOT, args[writeIndex + 1] || 'reports/data-structure-audit.md')
  : '';

const rel = (filePath) => path.relative(ROOT, filePath);

const readText = (relativePath) => {
  const fullPath = path.join(ROOT, relativePath);
  if (!fs.existsSync(fullPath)) return '';
  return fs.readFileSync(fullPath, 'utf8');
};

const parseCsv = (relativePath) => {
  const text = readText(relativePath).replace(/^\uFEFF/, '');
  if (!text) return { rows: [], errors: [], headers: [] };
  const parsed = Papa.parse(text.replace(/\r\n/g, '\n').replace(/\r/g, '\n'), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });
  return {
    rows: parsed.data || [],
    errors: parsed.errors || [],
    headers: parsed.meta?.fields || [],
  };
};

const readJson = (relativePath) => {
  const text = readText(relativePath);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const countBy = (rows, keyFn) => {
  const counts = new Map();
  rows.forEach((row) => {
    const key = keyFn(row);
    if (!key) return;
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return counts;
};

const topEntries = (counts, limit = 12) =>
  Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), 'ja'))
    .slice(0, limit);

const duplicateEntries = (counts, limit = 12) =>
  topEntries(new Map(Array.from(counts.entries()).filter(([, count]) => count > 1)), limit);

const normalizeVariantKey = (value) => {
  const normalized = normalizePlantNameLite(value)
    .replace(/[？?]+$/g, '')
    .replace(/\s+/g, '')
    .trim();
  return normalized || cleanString(value);
};

const collectVariantBuckets = (rows, limit = 12) => {
  const buckets = new Map();
  rows.forEach((row) => {
    const rawName = cleanString(row.plant_name);
    if (!rawName) return;
    const key = normalizeVariantKey(rawName);
    if (!key) return;
    if (!buckets.has(key)) buckets.set(key, new Map());
    const variants = buckets.get(key);
    variants.set(rawName, (variants.get(rawName) || 0) + 1);
  });

  return Array.from(buckets.entries())
    .map(([key, variants]) => ({
      key,
      total: Array.from(variants.values()).reduce((sum, count) => sum + count, 0),
      variants: topEntries(variants, 8),
    }))
    .filter((bucket) => bucket.variants.length > 1)
    .sort((a, b) => b.total - a.total || a.key.localeCompare(b.key, 'ja'))
    .slice(0, limit);
};

const collectSetConflicts = (rows, entityKey, valueKey, options = {}) => {
  const { includeBlank = true, limit = 12 } = options;
  const byEntity = new Map();
  rows.forEach((row) => {
    const entity = cleanString(row[entityKey]);
    if (!entity) return;
    const value = cleanString(row[valueKey]) || '(blank)';
    if (!includeBlank && value === '(blank)') return;
    if (!byEntity.has(entity)) byEntity.set(entity, new Set());
    byEntity.get(entity).add(value);
  });

  return Array.from(byEntity.entries())
    .filter(([, values]) => values.size > 1)
    .sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0], 'ja'))
    .slice(0, limit)
    .map(([entity, values]) => [entity, Array.from(values).slice(0, 8)]);
};

const formatTable = (headers, rows) => {
  const escape = (value) => String(value ?? '').replace(/\n/g, '<br>');
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(escape).join(' | ')} |`),
  ].join('\n');
};

const formatEntryList = (entries, formatter) => {
  if (!entries.length) return '- なし';
  return entries.map((entry) => `- ${formatter(entry)}`).join('\n');
};

const countImageFiles = (relativeDir) => {
  const dir = path.join(ROOT, relativeDir);
  if (!fs.existsSync(dir)) return 0;
  const allowed = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.JPG', '.JPEG', '.PNG', '.WEBP', '.GIF']);
  return fs.readdirSync(dir).filter((name) => allowed.has(path.extname(name))).length;
};

const buildReport = () => {
  const insectsCsv = parseCsv('normalized_data/insects.csv');
  const hostplantsCsv = parseCsv('normalized_data/hostplants.csv');
  const notesCsv = parseCsv('normalized_data/general_notes.csv');
  const profilesCsv = parseCsv('normalized_data/plant_profiles.csv');
  const manifest = readJson('public/assets/data-lite/manifest.json');
  const ylistLite = readJson('public/assets/data-lite/ylist-lite.json');
  const imageIndex = readJson('public/assets/data-lite/image-index.json');

  const insects = insectsCsv.rows;
  const hostplants = hostplantsCsv.rows;
  const notes = notesCsv.rows;
  const profiles = profilesCsv.rows;

  const hostRelationKey = (row) => [
    cleanString(row.insect_id),
    cleanString(row.plant_name),
    cleanString(row.plant_family),
    cleanString(row.observation_type),
    cleanString(row.plant_part),
    cleanString(row.life_stage),
    cleanString(row.reference),
    cleanString(row.notes),
  ].join(' | ');

  const noteKey = (row) => [
    cleanString(row.insect_id),
    cleanString(row.note_type),
    cleanString(row.content),
    cleanString(row.reference),
    cleanString(row.page),
    cleanString(row.year),
  ].join(' | ');

  const rowSummary = [
    ['insects.csv', insects.length, insectsCsv.headers.length, insectsCsv.errors.length],
    ['hostplants.csv', hostplants.length, hostplantsCsv.headers.length, hostplantsCsv.errors.length],
    ['general_notes.csv', notes.length, notesCsv.headers.length, notesCsv.errors.length],
    ['plant_profiles.csv', profiles.length, profilesCsv.headers.length, profilesCsv.errors.length],
  ];

  const generatedSummary = [
    ['moths', manifest?.counts?.moths ?? ''],
    ['butterflies', manifest?.counts?.butterflies ?? ''],
    ['beetles', manifest?.counts?.beetles ?? ''],
    ['longhornbeetles', manifest?.counts?.longhornbeetles ?? ''],
    ['barkbeetles', manifest?.counts?.barkbeetles ?? ''],
    ['leafbeetles', manifest?.counts?.leafbeetles ?? ''],
    ['aphids', manifest?.counts?.aphids ?? ''],
    ['hostPlants', manifest?.counts?.hostPlants ?? ''],
    ['ylist plants', Object.keys(ylistLite?.plants || {}).length],
    ['ylist aliases', Object.keys(ylistLite?.aliasToCanonical || {}).length],
    ['insect image index', imageIndex?.names?.length ?? 0],
    ['insect image files', countImageFiles('public/images/insects')],
    ['plant image files', countImageFiles('public/images/plants')],
  ];

  const exactHostDuplicates = duplicateEntries(countBy(hostplants, hostRelationKey), 12);
  const insectPlantDuplicates = duplicateEntries(
    countBy(hostplants, (row) => `${cleanString(row.insect_id)} | ${cleanString(row.plant_name)}`),
    12,
  );
  const plantVariants = collectVariantBuckets(hostplants, 12);
  const plantFamilyConflicts = collectSetConflicts(hostplants, 'plant_name', 'plant_family', { includeBlank: true, limit: 12 });
  const suspiciousPlants = hostplants
    .filter((row) => isSuspiciousPlantName(row.plant_name))
    .slice(0, 15)
    .map((row) => [cleanString(row.record_id), cleanString(row.insect_id), cleanString(row.plant_name), cleanString(row.notes)]);
  const resourcePlants = hostplants
    .filter((row) => isNonPlantResourceName(row.plant_name))
    .slice(0, 15)
    .map((row) => [cleanString(row.record_id), cleanString(row.insect_id), cleanString(row.plant_name), cleanString(row.reference)]);
  const noteTypes = topEntries(countBy(notes, (row) => cleanString(row.note_type) || '(blank)'), 20);
  const duplicateNotes = duplicateEntries(countBy(notes, noteKey), 12);
  const duplicateProfiles = duplicateEntries(countBy(profiles, (row) => cleanString(row.plant_name)), 12);
  const profileScientificConflicts = collectSetConflicts(profiles, 'plant_name', 'scientific_name', { includeBlank: false, limit: 12 });
  const profileFamilyConflicts = collectSetConflicts(profiles, 'plant_name', 'family', { includeBlank: false, limit: 12 });
  const observationTypes = topEntries(countBy(hostplants, (row) => cleanString(row.observation_type) || '(blank)'), 12);
  const plantParts = topEntries(countBy(hostplants, (row) => cleanString(row.plant_part) || '(blank)'), 12);
  const lifeStages = topEntries(countBy(hostplants, (row) => cleanString(row.life_stage) || '(blank)'), 12);
  const missingJapaneseNames = insects.filter((row) => !cleanString(row.japanese_name)).length;

  return [
    '# Data Structure Audit',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    'This report is read-only. It audits source CSVs and generated public indexes without changing site behavior or display output.',
    '',
    '## Source CSVs',
    '',
    formatTable(['file', 'rows', 'columns', 'parse errors'], rowSummary),
    '',
    '## Generated Outputs',
    '',
    formatTable(['item', 'count'], generatedSummary),
    '',
    '## Insects',
    '',
    `- Rows without Japanese name: ${missingJapaneseNames}`,
    `- Duplicate insect_id values: ${duplicateEntries(countBy(insects, (row) => cleanString(row.insect_id)), 5).length}`,
    '',
    '## Host-Plant Relations',
    '',
    '### Exact Duplicate Rows',
    formatEntryList(exactHostDuplicates, ([key, count]) => `${count}x ${key}`),
    '',
    '### Duplicate Insect-Plant Pairs',
    formatEntryList(insectPlantDuplicates, ([key, count]) => `${count}x ${key}`),
    '',
    '### Plant Name Variants',
    formatEntryList(plantVariants, (bucket) =>
      `${bucket.key}: ${bucket.variants.map(([name, count]) => `${name} (${count})`).join(', ')}`,
    ),
    '',
    '### Plant Family Conflicts',
    formatEntryList(plantFamilyConflicts, ([plant, families]) => `${plant}: ${families.join(', ')}`),
    '',
    '### Suspicious Plant-Name Rows',
    suspiciousPlants.length
      ? formatTable(['record_id', 'insect_id', 'plant_name', 'notes'], suspiciousPlants)
      : '- なし',
    '',
    '### Non-Plant Resource Rows',
    resourcePlants.length
      ? formatTable(['record_id', 'insect_id', 'resource_name', 'reference'], resourcePlants)
      : '- なし',
    '',
    '### Controlled-Value Drift',
    '',
    formatTable(['observation_type', 'count'], observationTypes),
    '',
    formatTable(['plant_part', 'count'], plantParts),
    '',
    formatTable(['life_stage', 'count'], lifeStages),
    '',
    '## General Notes',
    '',
    formatTable(['note_type', 'count'], noteTypes),
    '',
    '### Duplicate Notes',
    formatEntryList(duplicateNotes, ([key, count]) => `${count}x ${key}`),
    '',
    '## Plant Profiles',
    '',
    '### Duplicate Profile Names',
    formatEntryList(duplicateProfiles, ([name, count]) => `${count}x ${name}`),
    '',
    '### Scientific-Name Conflicts',
    formatEntryList(profileScientificConflicts, ([plant, names]) => `${plant}: ${names.join(', ')}`),
    '',
    '### Family Conflicts',
    formatEntryList(profileFamilyConflicts, ([plant, families]) => `${plant}: ${families.join(', ')}`),
    '',
  ].join('\n');
};

const report = buildReport();

if (writePath) {
  fs.mkdirSync(path.dirname(writePath), { recursive: true });
  fs.writeFileSync(writePath, `${report}\n`, 'utf8');
  console.log(`[audit-data-structure] wrote ${rel(writePath)}`);
} else {
  console.log(report);
}

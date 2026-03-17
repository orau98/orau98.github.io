import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

const ROOT = process.cwd();
const HOSTPLANT_FILES = [
  path.join(ROOT, 'normalized_data', 'hostplants.csv'),
  path.join(ROOT, 'public', 'hostplants.csv'),
];
const INSECT_FILES = [
  path.join(ROOT, 'normalized_data', 'insects.csv'),
  path.join(ROOT, 'public', 'insects.csv'),
];

const PROBLEM_ROWS = new Map([
  ['hostplant-902222', { atlasNo: 26, hostCue: 'コナラ' }],
  ['hostplant-902223', { atlasNo: 27, hostCue: 'シリブカガシ' }],
  ['hostplant-902230', { atlasNo: 31, hostCue: 'ポプラ' }],
  ['hostplant-902348', { atlasNo: 81, hostCue: 'シラヤマギク' }],
  ['hostplant-902349', { atlasNo: 82, hostCue: '不明' }],
  ['hostplant-902363', { atlasNo: 89, hostCue: 'ジャノヒゲ' }],
  ['hostplant-902365', { atlasNo: 91, hostCue: 'イボクサ' }],
  ['hostplant-902400', { atlasNo: 105, hostCue: 'イネ科の一種' }],
  ['hostplant-902429', { atlasNo: 118, hostCue: 'クサノオウ' }],
  ['hostplant-902441', { atlasNo: 125, hostCue: 'チュウゴクオウトウ' }],
  ['hostplant-902584', { atlasNo: 182, hostCue: 'アキノタムラソウ' }],
  ['hostplant-902585', { atlasNo: 182, hostCue: 'アキノタムラソウ' }],
  ['hostplant-902599', { atlasNo: 189, hostCue: 'チカラシバ' }],
  ['hostplant-902619', { atlasNo: 196, hostCue: 'クチナシ' }],
  ['hostplant-902620', { atlasNo: 196, hostCue: 'クチナシ' }],
  ['hostplant-902621', { atlasNo: 197, hostCue: 'シャシャンボ' }],
  ['hostplant-902661', { atlasNo: 211, hostCue: 'ツリフネソウ、オタカラコウ' }],
  ['hostplant-902710', { atlasNo: 232, hostCue: 'イチゴ' }],
]);

const NEW_IDS_BY_ATLAS_NO = new Map([
  [26, 'species-23075'],
  [27, 'species-23076'],
  [31, 'species-23077'],
  [81, 'species-23078'],
  [82, 'species-23079'],
  [89, 'species-23080'],
  [91, 'species-23081'],
  [105, 'species-23082'],
  [118, 'species-23083'],
  [125, 'species-23084'],
  [182, 'species-23085'],
  [189, 'species-23086'],
  [196, 'species-23087'],
  [197, 'species-23088'],
  [211, 'species-23089'],
  [232, 'species-23090'],
]);

const ATLAS_ENTRY_BY_NO = new Map([
  [26, { japaneseName: '', scientificName: 'Tuberculatus sp. A' }],
  [27, { japaneseName: '', scientificName: 'Tuberculatus sp. B' }],
  [31, { japaneseName: '', scientificName: 'Chaitophorus sp.' }],
  [81, { japaneseName: '', scientificName: 'Acyrthosiphon sp. A' }],
  [82, { japaneseName: '', scientificName: 'Acyrthosiphon sp. B' }],
  [89, { japaneseName: '', scientificName: 'Hydronaphis sp.' }],
  [91, { japaneseName: '', scientificName: 'Rhopalosiphoninus sp.' }],
  [105, { japaneseName: '', scientificName: 'Myzus sp.' }],
  [118, { japaneseName: '', scientificName: 'Neotoxoptera sp.' }],
  [125, { japaneseName: '', scientificName: 'Tuberocephalus sp.' }],
  [182, { japaneseName: '', scientificName: 'Aphis sp.' }],
  [189, { japaneseName: '', scientificName: 'Melanaphis sp.' }],
  [196, { japaneseName: '', scientificName: 'Toxoptera sp. A' }],
  [197, { japaneseName: '', scientificName: 'Toxoptera sp. B' }],
  [211, { japaneseName: '', scientificName: 'Aleurodaphis sp.' }],
  [232, { japaneseName: '', scientificName: 'Eriosoma sp.' }],
]);

const MANUAL_PLANT_FAMILY = new Map([
  ['イチゴ', 'バラ科'],
  ['イネ科の一種', 'イネ科'],
  ['クサノオウ', 'ケシ科'],
  ['ジャノヒゲ', 'キジカクシ科'],
  ['チュウゴクオウトウ', 'バラ科'],
  ['ツリフネソウ', 'ツリフネソウ科'],
  ['オタカラコウ', 'キク科'],
]);

const cleanString = (value) => (value ?? '').toString().trim();

const loadCsvLines = (filePath) => {
  const raw = fs.readFileSync(filePath, 'utf8');
  const newline = raw.includes('\r\n') ? '\r\n' : '\n';
  const lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const header = lines[0];
  const bodyLines = lines.slice(1).filter((line) => line.length > 0);
  const columns = Papa.parse(header).data[0];
  return { raw, newline, header, bodyLines, columns };
};

const parseCsvRow = (header, line) => Papa.parse(`${header}\n${line}`, { header: true, skipEmptyLines: true }).data[0];

const serializeRow = (columns, row) => {
  const ordered = {};
  columns.forEach((column) => {
    ordered[column] = row[column] ?? '';
  });
  return Papa.unparse([ordered], { header: false, newline: '' });
};

const buildPlantFamilyLookup = () => {
  const lookup = new Map(MANUAL_PLANT_FAMILY);
  const filePath = HOSTPLANT_FILES[0];
  const text = fs.readFileSync(filePath, 'utf8');
  const rows = Papa.parse(text, { header: true, skipEmptyLines: true }).data;
  rows.forEach((row) => {
    const plantName = cleanString(row.plant_name);
    const family = cleanString(row.plant_family);
    if (!plantName || !family || lookup.has(plantName)) return;
    lookup.set(plantName, family);
  });
  return lookup;
};

const buildAphidTaxonomyLookup = () => {
  const filePath = INSECT_FILES[0];
  const text = fs.readFileSync(filePath, 'utf8');
  const rows = Papa.parse(text, { header: true, skipEmptyLines: true }).data;
  const lookup = new Map();
  rows.forEach((row) => {
    const family = cleanString(row.family);
    const familyJp = cleanString(row.family_jp);
    const genus = cleanString(row.genus);
    if (!genus) return;
    const isAphid = family === 'Aphididae' || familyJp.includes('アブラムシ');
    if (!isAphid) return;
    if (lookup.has(genus)) return;
    lookup.set(genus, {
      family: family || 'Aphididae',
      family_jp: familyJp || 'アブラムシ科',
      subfamily: cleanString(row.subfamily),
      subfamily_jp: cleanString(row.subfamily_jp),
      tribe: cleanString(row.tribe),
      tribe_jp: cleanString(row.tribe_jp),
      subgenus: cleanString(row.subgenus),
    });
  });
  return lookup;
};

const splitScientificName = (scientificName) => {
  const parts = cleanString(scientificName).split(/\s+/).filter(Boolean);
  const genus = parts[0] || '';
  const rest = parts.slice(1).join(' ');
  return {
    genus,
    species: rest || '',
    scientificName: cleanString(scientificName),
  };
};

const createInsectRow = (columns, atlasNo, taxonomyLookup) => {
  const newId = NEW_IDS_BY_ATLAS_NO.get(atlasNo);
  const atlasEntry = ATLAS_ENTRY_BY_NO.get(atlasNo);
  if (!newId || !atlasEntry) return null;
  const { genus, species, scientificName } = splitScientificName(atlasEntry.scientificName);
  const taxonomy = taxonomyLookup.get(genus) || {};
  const row = {};
  columns.forEach((column) => {
    row[column] = '';
  });
  row.insect_id = newId;
  row.family = taxonomy.family || 'Aphididae';
  row.family_jp = taxonomy.family_jp || 'アブラムシ科';
  row.subfamily = taxonomy.subfamily || '';
  row.subfamily_jp = taxonomy.subfamily_jp || '';
  row.tribe = taxonomy.tribe || '';
  row.tribe_jp = taxonomy.tribe_jp || '';
  row.genus = genus;
  row.subgenus = '';
  row.species = species;
  row.subspecies = '';
  row.author = '';
  row.year = '';
  row.japanese_name = atlasEntry.japaneseName || '';
  row.scientific_name = scientificName;
  row.notes = `日本原色アブラムシ図鑑の未解決記録（No.${atlasNo}）を一意IDで暫定追加。`;
  return row;
};

const buildExtraRowsForHostCue = (baseRow, hostCue, familyLookup) => {
  if (hostCue !== 'ツリフネソウ、オタカラコウ') return [];
  const second = { ...baseRow };
  second.record_id = 'hostplant-902661b';
  second.plant_name = 'オタカラコウ';
  second.plant_family = familyLookup.get('オタカラコウ') || '';
  return [second];
};

const applyHostplantFix = (row, familyLookup) => {
  const config = PROBLEM_ROWS.get(cleanString(row.record_id));
  if (!config) return { row, extraRows: [] };

  const atlasNo = config.atlasNo;
  const hostCue = cleanString(config.hostCue);
  const newId = NEW_IDS_BY_ATLAS_NO.get(atlasNo);
  const originalPlantName = cleanString(row.plant_name);
  const migratedNote = cleanString(row.plant_part);
  const existingNotes = cleanString(row.notes);
  const mergedNotes = [existingNotes, migratedNote]
    .filter(Boolean)
    .filter((value, index, array) => array.indexOf(value) === index)
    .join(' ');

  const updated = { ...row };
  updated.insect_id = newId;
  updated.life_stage = cleanString(row.life_stage);
  updated.reference = cleanString(row.reference);
  updated.notes = mergedNotes;
  updated.plant_part = originalPlantName;

  if (!hostCue || hostCue === '不明') {
    updated.plant_name = '';
    updated.plant_family = '';
    return { row: updated, extraRows: [] };
  }

  if (hostCue === 'ツリフネソウ、オタカラコウ') {
    updated.plant_name = 'ツリフネソウ';
    updated.plant_family = familyLookup.get('ツリフネソウ') || '';
    return {
      row: updated,
      extraRows: buildExtraRowsForHostCue(updated, hostCue, familyLookup),
    };
  }

  updated.plant_name = hostCue;
  updated.plant_family = familyLookup.get(hostCue) || '';
  return { row: updated, extraRows: [] };
};

const updateHostplantFile = (filePath, familyLookup) => {
  const { header, bodyLines, columns, newline } = loadCsvLines(filePath);
  const seenRecordIds = new Set();
  const updatedLines = [];
  const appendedRows = [];

  bodyLines.forEach((line) => {
    const row = parseCsvRow(header, line);
    const recordId = cleanString(row.record_id);
    const config = PROBLEM_ROWS.get(recordId);
    if (!config) {
      updatedLines.push(line);
      seenRecordIds.add(recordId);
      return;
    }

    const { row: fixedRow, extraRows } = applyHostplantFix(row, familyLookup);
    updatedLines.push(serializeRow(columns, fixedRow));
    seenRecordIds.add(recordId);

    extraRows.forEach((extraRow) => {
      const extraId = cleanString(extraRow.record_id);
      if (!extraId || seenRecordIds.has(extraId)) return;
      appendedRows.push(serializeRow(columns, extraRow));
      seenRecordIds.add(extraId);
    });
  });

  const out = [header, ...updatedLines, ...appendedRows].join(newline) + newline;
  fs.writeFileSync(filePath, out, 'utf8');
};

const updateInsectFile = (filePath, taxonomyLookup) => {
  const { header, bodyLines, columns, newline } = loadCsvLines(filePath);
  const updatedLines = [...bodyLines];
  const existingIds = new Set();
  bodyLines.forEach((line) => {
    const row = parseCsvRow(header, line);
    existingIds.add(cleanString(row.insect_id));
  });

  for (const atlasNo of [...NEW_IDS_BY_ATLAS_NO.keys()].sort((a, b) => a - b)) {
    const newId = NEW_IDS_BY_ATLAS_NO.get(atlasNo);
    if (existingIds.has(newId)) continue;
    const row = createInsectRow(columns, atlasNo, taxonomyLookup);
    if (!row) continue;
    updatedLines.push(serializeRow(columns, row));
    existingIds.add(newId);
  }

  const out = [header, ...updatedLines].join(newline) + newline;
  fs.writeFileSync(filePath, out, 'utf8');
};

const main = () => {
  const familyLookup = buildPlantFamilyLookup();
  const taxonomyLookup = buildAphidTaxonomyLookup();

  HOSTPLANT_FILES.forEach((filePath) => {
    if (fs.existsSync(filePath)) {
      updateHostplantFile(filePath, familyLookup);
      console.log('[fix-aphid-part-hostplants] updated hostplants:', path.relative(ROOT, filePath));
    }
  });

  INSECT_FILES.forEach((filePath) => {
    if (fs.existsSync(filePath)) {
      updateInsectFile(filePath, taxonomyLookup);
      console.log('[fix-aphid-part-hostplants] updated insects:', path.relative(ROOT, filePath));
    }
  });
};

main();

import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

const ROOT = process.cwd();
const HOSTPLANTS_PATH = path.join(ROOT, 'normalized_data', 'hostplants.csv');
const INSECT_FILES = [
  path.join(ROOT, 'normalized_data', 'insects.csv'),
  path.join(ROOT, 'public', 'insects.csv'),
];
const REPORTS_DIR = path.join(ROOT, 'reports');
const FIX_SOURCE_PATH = path.join(ROOT, 'scripts', 'fix_aphid_hostplant_ids.mjs');

const ATLAS_REFERENCE = '日本原色アブラムシ図鑑';
const SKIP_ATLAS_NOS = new Set([
  // ボタイチゴアブラムシは現行データ上で No.170 の Aphis ichigocola 行に和名別記として内包されており、
  // hostplants 側にも独立グループが存在しないため、順序復元では飛ばす。
  171,
]);

const cleanString = (value) => (value ?? '').toString().trim();
const normalizeSpaces = (value) => cleanString(value).replace(/\s+/g, ' ');

const parseCsv = (filePath) => {
  const text = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return Papa.parse(text, { header: true, skipEmptyLines: true }).data || [];
};

const writeCsv = (filePath, rows) => {
  const csv = Papa.unparse(rows, { header: true, newline: '\n' });
  fs.writeFileSync(filePath, csv, 'utf8');
};

const isAphidRow = (row) => {
  const family = cleanString(row?.family);
  const familyJp = cleanString(row?.family_jp);
  return family === 'Aphididae' || familyJp.includes('アブラムシ');
};

const looksLikeScientificName = (value) => {
  const text = normalizeSpaces(value);
  return /^[A-Z][a-z]+(?:\s+\([A-Z][a-z]+\))?\s+(?:[a-z][a-z-]+|sp\.?)(?:\s+[A-Za-z0-9-]+|[a-z][a-z-]+)?/.test(text);
};

const extractAtlasRawCsv = () => {
  const scriptText = fs.readFileSync(FIX_SOURCE_PATH, 'utf8');
  const startMarker = 'const ATLAS_NO_NAME_SCI_RAW = `';
  const endMarker = '`.trim();';
  const start = scriptText.indexOf(startMarker);
  if (start === -1) {
    throw new Error(`ATLAS_NO_NAME_SCI_RAW not found in ${FIX_SOURCE_PATH}`);
  }
  const end = scriptText.indexOf(endMarker, start + startMarker.length);
  if (end === -1) {
    throw new Error(`ATLAS_NO_NAME_SCI_RAW terminator not found in ${FIX_SOURCE_PATH}`);
  }
  return scriptText.slice(start + startMarker.length, end);
};

const extractTaxonParts = (scientificNameRaw) => {
  const raw = normalizeSpaces(scientificNameRaw)
    .replace(/[?？]+/g, '')
    .replace(/^[\"'“”]+|[\"'“”]+$/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/,/g, ' ')
    .trim();
  if (!raw) {
    return { genus: '', species: '', subspecies: '' };
  }

  const tokens = raw.split(/\s+/).filter(Boolean);
  const genus = tokens[0] || '';
  if (tokens.length < 2) {
    return { genus, species: '', subspecies: '' };
  }

  if (/^sp\.?$/i.test(tokens[1])) {
    const marker = tokens[2] || '';
    return {
      genus,
      species: marker ? `sp. ${marker}` : 'sp.',
      subspecies: '',
    };
  }

  const species = tokens[1] || '';
  const maybeSubspecies = tokens[2] || '';
  const authorParticles = new Set([
    'van',
    'von',
    'de',
    'del',
    'der',
    'di',
    'da',
    'du',
    'la',
    'le',
    'et',
    'al',
    'ex',
  ]);
  const subspecies = maybeSubspecies &&
    /^[a-z][a-z-]+$/.test(maybeSubspecies) &&
    !authorParticles.has(maybeSubspecies.toLowerCase())
    ? maybeSubspecies
    : '';
  return { genus, species, subspecies };
};

const loadAtlasEntries = () => {
  const rows = extractAtlasRawCsv()
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  return rows
    .map((line) => {
      const [noText, rawName, ...rest] = line.split(',');
      const no = Number(noText);
      if (!Number.isFinite(no) || SKIP_ATLAS_NOS.has(no)) {
        return null;
      }

      let japaneseName = cleanString(rawName);
      let scientificName = cleanString(rest.join(','));
      if (!looksLikeScientificName(scientificName) && looksLikeScientificName(japaneseName)) {
        scientificName = japaneseName;
        japaneseName = '';
      }

      return {
        no,
        japaneseName,
        scientificName,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.no - b.no);
};

const buildAtlasGroups = (hostRows) => {
  const atlasRows = hostRows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => cleanString(row.reference) === ATLAS_REFERENCE);

  const groups = [];
  let previousId = null;
  atlasRows.forEach(({ row, index }) => {
    const insectId = cleanString(row.insect_id);
    if (insectId !== previousId) {
      groups.push({
        currentInsectId: insectId,
        rowIndexes: [],
      });
      previousId = insectId;
    }
    groups[groups.length - 1].rowIndexes.push(index);
  });
  return groups;
};

const buildTaxonomyLookup = (insectRows) => {
  const lookup = new Map();
  insectRows.forEach((row) => {
    if (!isAphidRow(row)) return;
    const genus = cleanString(row.genus);
    if (!genus || lookup.has(genus)) return;
    lookup.set(genus, {
      family: cleanString(row.family) || 'Aphididae',
      family_jp: cleanString(row.family_jp) || 'アブラムシ科',
      subfamily: cleanString(row.subfamily),
      subfamily_jp: cleanString(row.subfamily_jp),
      tribe: cleanString(row.tribe),
      tribe_jp: cleanString(row.tribe_jp),
      subgenus: cleanString(row.subgenus),
    });
  });
  return lookup;
};

const buildExistingRecoveryIdMap = (insectRows) => {
  const out = new Map();
  insectRows.forEach((row) => {
    const insectId = cleanString(row.insect_id);
    const notes = cleanString(row.notes);
    const match = notes.match(/No\.(\d+)/);
    if (!insectId || !match) return;
    out.set(Number(match[1]), insectId);
  });
  return out;
};

const nextAvailableNumericSpeciesId = (insectRows) => {
  let max = 0;
  insectRows.forEach((row) => {
    const match = cleanString(row.insect_id).match(/^species-(\d+)$/);
    if (!match) return;
    max = Math.max(max, Number(match[1]));
  });
  return max + 1;
};

const createInsectRow = (columns, atlasEntry, taxonomyLookup, insectId) => {
  const row = {};
  columns.forEach((column) => {
    row[column] = '';
  });

  const { genus, species, subspecies } = extractTaxonParts(atlasEntry.scientificName);
  const taxonomy = taxonomyLookup.get(genus) || {};

  row.insect_id = insectId;
  row.family = taxonomy.family || 'Aphididae';
  row.family_jp = taxonomy.family_jp || 'アブラムシ科';
  row.subfamily = taxonomy.subfamily || '';
  row.subfamily_jp = taxonomy.subfamily_jp || '';
  row.tribe = taxonomy.tribe || '';
  row.tribe_jp = taxonomy.tribe_jp || '';
  row.genus = genus;
  row.subgenus = taxonomy.subgenus || '';
  row.species = species;
  row.subspecies = subspecies;
  row.author = '';
  row.year = '';
  row.japanese_name = atlasEntry.japaneseName || '';
  row.scientific_name = atlasEntry.scientificName;
  row.notes = `日本原色アブラムシ図鑑由来 hostplants 復旧のため暫定追加（No.${atlasEntry.no}）。`;
  return row;
};

const main = () => {
  if (!fs.existsSync(HOSTPLANTS_PATH)) {
    throw new Error(`hostplants.csv not found: ${HOSTPLANTS_PATH}`);
  }

  const hostRows = parseCsv(HOSTPLANTS_PATH);
  const normalizedInsects = parseCsv(INSECT_FILES[0]);
  const insectColumns = Object.keys(normalizedInsects[0] || {});
  const atlasEntries = loadAtlasEntries();
  const atlasGroups = buildAtlasGroups(hostRows);

  if (atlasEntries.length !== atlasGroups.length) {
    throw new Error(`Atlas entries (${atlasEntries.length}) and hostplant groups (${atlasGroups.length}) do not align.`);
  }

  const taxonomyLookup = buildTaxonomyLookup(normalizedInsects);
  const insectsById = new Map(
    normalizedInsects
      .map((row) => [cleanString(row.insect_id), row])
      .filter(([id]) => id),
  );
  const recoveryIdByNo = buildExistingRecoveryIdMap(normalizedInsects);

  let nextSpeciesNumber = nextAvailableNumericSpeciesId(normalizedInsects);
  const createdRows = [];
  const fixReportRows = [];

  atlasEntries.forEach((atlasEntry, index) => {
    const group = atlasGroups[index];
    const currentRow = insectsById.get(group.currentInsectId);
    if (isAphidRow(currentRow)) {
      return;
    }

    let targetId = recoveryIdByNo.get(atlasEntry.no);
    if (!targetId) {
      targetId = `species-${String(nextSpeciesNumber).padStart(5, '0')}`;
      nextSpeciesNumber += 1;
      recoveryIdByNo.set(atlasEntry.no, targetId);
      const newRow = createInsectRow(insectColumns, atlasEntry, taxonomyLookup, targetId);
      createdRows.push(newRow);
      insectsById.set(targetId, newRow);
    }

    group.rowIndexes.forEach((rowIndex) => {
      hostRows[rowIndex].insect_id = targetId;
    });

    fixReportRows.push({
      no: atlasEntry.no,
      old_insect_id: group.currentInsectId,
      new_insect_id: targetId,
      japanese_name: atlasEntry.japaneseName,
      scientific_name: atlasEntry.scientificName,
      old_family_jp: cleanString(currentRow?.family_jp),
      old_japanese_name: cleanString(currentRow?.japanese_name),
    });
  });

  writeCsv(HOSTPLANTS_PATH, hostRows);

  INSECT_FILES.forEach((filePath) => {
    const rows = parseCsv(filePath);
    const ids = new Set(rows.map((row) => cleanString(row.insect_id)).filter(Boolean));
    createdRows.forEach((row) => {
      if (!ids.has(row.insect_id)) {
        rows.push({ ...row });
      }
    });
    writeCsv(filePath, rows);
  });

  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }
  writeCsv(path.join(REPORTS_DIR, 'aphid_nonaphid_link_fixes.csv'), fixReportRows);

  console.log(`[fix_aphid_nonaphid_links] fixed groups: ${fixReportRows.length}`);
  console.log(`[fix_aphid_nonaphid_links] created provisional insects: ${createdRows.length}`);
};

main();

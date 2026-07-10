import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  buildInsectImageBaseCandidates,
  buildNormalizedEntries,
  normalizeCompactImageBase,
  resolveImageBaseCandidates,
} from '../src/utils/insectImageResolver.js';
import { globalJapaneseToScientificMapping } from '../src/utils/insectImageMappings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');
const DATA_PATH = path.join(ROOT, 'public', 'assets', 'data-lite', 'index.json');
const IMAGE_EXTENSIONS_PATH = path.join(ROOT, 'public', 'image_extensions.json');
const GROUPS = ['moths', 'butterflies', 'beetles', 'longhornbeetles', 'barkbeetles', 'leafbeetles', 'aphids'];

const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
const imageExtensions = JSON.parse(fs.readFileSync(IMAGE_EXTENSIONS_PATH, 'utf8'));
const imageNames = new Set(Object.keys(imageExtensions));
const normalizedEntries = buildNormalizedEntries(imageNames, imageExtensions);

const compactIndex = new Map();
for (const name of imageNames) {
  const compact = normalizeCompactImageBase(name);
  if (!compact) continue;
  const list = compactIndex.get(compact) || [];
  list.push(name);
  compactIndex.set(compact, list);
}

const rows = [];
let total = 0;
let resolved = 0;

for (const group of GROUPS) {
  for (const insect of data[group] || []) {
    total += 1;
    const mappedFilename = globalJapaneseToScientificMapping.get(insect.name);
    const candidateBases = buildInsectImageBaseCandidates(insect, mappedFilename);
    const resolvedBases = resolveImageBaseCandidates(candidateBases, {
      imageExtensions,
      imageNames,
      normalizedEntries,
    });
    const currentMatch = resolvedBases.find((base) => imageNames.has(base));
    if (currentMatch) {
      resolved += 1;
      continue;
    }

    const compactCandidates = [
      insect.name,
      insect.scientificFilename,
      insect.scientificName,
      mappedFilename,
    ]
      .filter(Boolean)
      .map((value) => normalizeCompactImageBase(value))
      .filter(Boolean);

    const compactMatches = Array.from(new Set(
      compactCandidates.flatMap((candidate) => compactIndex.get(candidate) || [])
    ));

    if (compactMatches.length > 0) {
      rows.push({
        group,
        id: insect.id,
        name: insect.name,
        scientificName: insect.scientificName,
        scientificFilename: insect.scientificFilename || '',
        compactMatches: compactMatches.join(' | '),
      });
    }
  }
}

console.log(`[audit-insect-image-resolution] resolved=${resolved}/${total}`);
console.log(`[audit-insect-image-resolution] unresolved_with_compact_match=${rows.length}`);

if (rows.length > 0) {
  console.log('group,id,name,scientific_name,scientific_filename,compact_matches');
  for (const row of rows) {
    const values = [
      row.group,
      row.id,
      row.name,
      row.scientificName,
      row.scientificFilename,
      row.compactMatches,
    ].map((value) => `"${String(value || '').replace(/"/g, '""')}"`);
    console.log(values.join(','));
  }
}

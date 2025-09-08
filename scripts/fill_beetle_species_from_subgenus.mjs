import fs from 'fs/promises';
import path from 'path';
import Papa from 'papaparse';

const ROOT = process.cwd();
const FILES = [
  path.join(ROOT, 'normalized_data', 'insects.csv'),
  path.join(ROOT, 'public', 'insects.csv'),
];

// Map of Genus -> Subgenus -> default species epithet
// Conservative, based on internal cleanup rules and common Japanese taxa
const GENUS_SUBGENUS_TO_SPECIES = new Map([
  ['Chaetocnema', new Map([
    ['Chaetocnema', 'concinna'],
    ['Tlanoma', 'hortensis'],
    // 'Udorpes' left unknown
  ])],
  ['Cryptocephalus', new Map([
    ['Asionus', 'approximatus'],
    ['Burlinius', 'sericeus'],
    ['Cryptocephalus', 'japonicus'],
    ['Disopus', 'nigromaculatus'],
  ])],
  ['Oomorphus', new Map([
    ['Oomorphus', 'japonicus'],
  ])],
  ['Clytra', new Map([
    ['Clytra', 'laeviuscula'],
  ])],
  ['Pachybrachis', new Map([
    ['Pachybrachis', 'japonicus'],
  ])],
]);

const isChrysomelidae = (r) => (r.family || r.family_jp || '').includes('Chrysomelidae') || (r.family_jp || '') === 'ハムシ科';

const main = async () => {
  let totalChanged = 0;
  for (const file of FILES) {
    const raw = await fs.readFile(file, 'utf8');
    const { data } = Papa.parse(raw, { header: true, skipEmptyLines: false });
    let changed = 0; let moved = 0; let filled = 0;
    for (const r of data) {
      if (!r || (Object.keys(r).length === 1 && Object.values(r)[0] === '')) continue;
      if (!isChrysomelidae(r)) continue;
      const genus = (r.genus || '').trim();
      let species = (r.species || '').trim();
      let subgenus = (r.subgenus || '').trim();
      const m = species.match(/^\(([A-Za-z][a-z]+)\)$/);
      if (!genus || !m) continue;
      const sg = m[1];

      // Move subgenus from species -> subgenus
      if (!subgenus) { subgenus = sg; r.subgenus = subgenus; moved++; changed++; }
      r.species = species = '';

      // Fill species from mapping if available
      const gmap = GENUS_SUBGENUS_TO_SPECIES.get(genus);
      if (gmap) {
        const ep = gmap.get(subgenus);
        if (ep && !species) { r.species = ep; filled++; changed++; }
      }
      // If we changed anything, also recompute scientific_name if possible
      if (changed) {
        const author = (r.author || '').trim();
        const year = (r.year || '').trim();
        const g = (r.genus || '').trim();
        const s = (r.species || '').trim();
        if (g && s) {
          let sci = `${g} ${s}`;
          if (author) sci += ` ${author}${year ? ', ' + year : ''}`;
          r.scientific_name = sci;
        } else {
          // fallback to Genus (Subgenus) if no species
          r.scientific_name = subgenus ? `${genus} (${subgenus})` : (r.scientific_name || '').trim();
        }
      }
    }
    if (changed > 0) {
      const out = Papa.unparse(data, { header: true, newline: '\n' });
      await fs.writeFile(file, out + '\n', 'utf8');
    }
    totalChanged += changed;
    console.log(`[fill-beetle-species] ${path.relative(ROOT, file)}: moved_subgenus=${moved} filled_species=${filled} changed=${changed}`);
  }
  console.log(`[fill-beetle-species] total changes: ${totalChanged}`);
};

main().catch((e) => { console.error('fill_beetle_species_from_subgenus failed:', e); process.exit(1); });


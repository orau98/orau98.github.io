import fs from 'fs/promises';
import path from 'path';
import Papa from 'papaparse';

const files = [
  path.join(process.cwd(), 'normalized_data', 'insects.csv'),
  path.join(process.cwd(), 'public', 'insects.csv'),
];

const trim = (v) => (v == null ? '' : String(v).trim());

const needsFix = (name) => {
  if (!name) return true; // empty → rebuild if possible
  const t = String(name).trim();
  // Heuristics: ends with comma or with "(Author," or lacks year when parentheses present
  if (/[,\s]$/.test(t)) return true;
  if (/\([^)]*,\s*$/.test(t)) return true;
  // If has '(' but not a 4-digit year before ')'
  if (/\(.*\)/.test(t) && !/\(.*\b\d{4}\b.*\)/.test(t)) return true;
  return false;
};

const buildScientificName = (row) => {
  const genus = trim(row['genus']);
  const species = trim(row['species']);
  const subspecies = trim(row['subspecies']);
  const author = trim(row['author']);
  const year = trim(row['year']);
  if (!genus || !species) return '';
  let base = `${genus} ${species}`;
  if (subspecies) base += ` ${subspecies}`;
  if (!author && !year) return base;
  // Author formatting
  if (author.startsWith('(') && author.endsWith(')')) {
    const inner = author.slice(1, -1);
    const y = year ? `, ${year}` : '';
    return `${base} (${inner}${y})`;
  } else {
    const y = year ? `, ${year}` : '';
    return `${base} ${author}${y}`;
  }
};

const processFile = async (file) => {
  let text;
  try {
    text = await fs.readFile(file, 'utf8');
  } catch (e) {
    console.warn('skip (not found):', file);
    return;
  }
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: false });
  const rows = parsed.data;
  let fixed = 0;

  rows.forEach((row) => {
    if (!row) return;
    const current = trim(row['scientific_name']);
    const genus = trim(row['genus']);
    const species = trim(row['species']);
    const subspecies = trim(row['subspecies']);
    const base = genus && species ? `${genus} ${species}${subspecies ? ' ' + subspecies : ''}` : '';
    if (needsFix(current)) {
      const rebuilt = buildScientificName(row);
      if (rebuilt) {
        row['scientific_name'] = rebuilt;
        fixed++;
      }
    }

    // Clean obviously broken synonyms that are truncated duplicates of scientific_name
    const syn = trim(row['synonyms']);
    if (syn) {
      // if synonyms is just a broken prefix like "Genus species (Author"
      if (base && syn.startsWith(base) && /\([^)]*$/.test(syn)) {
        row['synonyms'] = '';
        fixed++;
      }
      // if synonyms equals scientific_name, drop duplication
      const rebuilt = trim(row['scientific_name']);
      if (rebuilt && syn === rebuilt) {
        row['synonyms'] = '';
        fixed++;
      }
    }
  });

  if (fixed > 0) {
    const csv = Papa.unparse(rows, { header: true });
    await fs.writeFile(file, csv, 'utf8');
    console.log(`Fixed ${fixed} scientific_name entries in ${path.relative(process.cwd(), file)}`);
  } else {
    console.log(`No fixes needed for ${path.relative(process.cwd(), file)}`);
  }
};

const main = async () => {
  for (const f of files) {
    await processFile(f);
  }
};

main().catch((e) => {
  console.error('fix_scientific_names failed:', e);
  process.exit(1);
});

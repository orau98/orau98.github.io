import fs from 'fs/promises';
import path from 'path';
import Papa from 'papaparse';

const files = [
  path.join(process.cwd(), 'normalized_data', 'insects.csv'),
  path.join(process.cwd(), 'public', 'insects.csv'),
];

const trim = (v) => (v == null ? '' : String(v).trim());

const needsFix = (row) => {
  const name = row?.['scientific_name'];
  const author = trim(row?.['author']);
  const year = trim(row?.['year']);
  if (!name) return true; // empty → rebuild if possible
  const t = String(name).trim();
  // Heuristics: ends with comma/whitespace or looks like "(Author," (truncated)
  if (/[,\s]$/.test(t)) return true;
  if (/\([^)]*,\s*$/.test(t)) return true;
  // Broken parenthesis: has '(' but no ')'
  if (/\(/.test(t) && !/\)/.test(t)) return true;
  // If year exists in columns but not found in scientific_name.
  // Year cells sometimes include brackets or multiple years like "[1889]" or "[1858] 1857".
  if (year) {
    const years = (year.match(/\d{4}/g) || []);
    if (years.length > 0) {
      // If scientific_name lacks any of the year numbers → fix
      const foundAny = years.some(y => new RegExp(`\\b${y}\\b`).test(t));
      if (!foundAny) return true;
      // If scientific_name repeats year numbers more times than provided → fix
      const distinct = [...new Set(years)];
      let totalOcc = 0;
      for (const y of distinct) totalOcc += (t.match(new RegExp(`\\b${y}\\b`, 'g')) || []).length;
      if (totalOcc > distinct.length) return true;
    }
  }
  // If author exists but not visibly present in scientific_name (ignoring parentheses)
  if (author) {
    const a = author.replace(/^\(|\)$/g, '').trim();
    if (a && !t.includes(a)) return true;
  }
  // If has parentheses pair but missing 4-digit year inside
  if (/\(.*\)/.test(t) && !/\(.*\b\d{4}\b.*\)/.test(t)) return true;
  return false;
};

const sanitizeAuthorForName = (authorRaw = '') => {
  let a = trim(authorRaw);
  if (!a) return '';
  // Remove any inline year tokens from author (e.g., "Fabricius, 1775" -> "Fabricius")
  a = a.replace(/\s*,?\s*\[?\d{4}\]?/g, '');
  // Collapse whitespace and stray commas
  a = a.replace(/\s+/g, ' ').replace(/,\s*$/,'').trim();
  return a;
};

const buildScientificName = (row) => {
  const genus = trim(row['genus']);
  const species = trim(row['species']);
  const subspecies = trim(row['subspecies']);
  const authorRaw = trim(row['author']);
  const author = sanitizeAuthorForName(authorRaw);
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
    // Sanitize embedded newlines across all fields to prevent multi-line CSV records
    for (const k of Object.keys(row)) {
      if (row[k] != null) {
        row[k] = String(row[k]).replace(/\r?\n/g, ' ').trim();
      }
    }
    const current = trim(row['scientific_name']);
    const genus = trim(row['genus']);
    const species = trim(row['species']);
    const subspecies = trim(row['subspecies']);
    const base = genus && species ? `${genus} ${species}${subspecies ? ' ' + subspecies : ''}` : '';
    if (needsFix(row)) {
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

    // Clean stray species-id tokens accidentally placed into free-text fields
    const idToken = /^species-\d+$/i;
    const fields = ['synonyms', 'changes_since_standard', 'notes'];
    for (const f of fields) {
      const v = trim(row[f]);
      if (idToken.test(v)) {
        row[f] = '';
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

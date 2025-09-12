import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

const imagesDir = path.join(process.cwd(), 'public', 'images', 'insects');
const insectsCsv = path.join(process.cwd(), 'public', 'insects.csv');

function loadInsects() {
  const csv = fs.readFileSync(insectsCsv, 'utf-8');
  const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });
  if (parsed.errors?.length) {
    console.error('CSV parse errors:', parsed.errors.slice(0, 5));
  }
  return parsed.data;
}

function toScientificFilename(scientificName, genus, species) {
  // Prefer clean binomial from genus + species when available
  let name = '';
  const g = (genus || '').trim();
  const s = (species || '').trim();
  if (g && s) {
    name = `${g} ${s}`;
  } else {
    name = scientificName?.trim() || '';
  }
  if (!name) return '';
  // remove author/year in parentheses
  name = name.replace(/\s*\([^)]*\)\s*/g, '').trim();
  // collapse whitespace to underscore
  name = name.replace(/\s+/g, '_');
  // remove problematic chars except underscore and parentheses/commas (rare)
  name = name.replace(/[^A-Za-z0-9_(),-]/g, '');
  return name;
}

function isJapaneseFilename(filename) {
  // detect JP characters in basename (without extension)
  const base = filename.replace(/\.[^.]+$/, '');
  return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(base);
}

function main() {
  if (!fs.existsSync(imagesDir)) {
    console.error('Images directory not found:', imagesDir);
    process.exit(1);
  }
  if (!fs.existsSync(insectsCsv)) {
    console.error('insects.csv not found:', insectsCsv);
    process.exit(1);
  }

  const rows = loadInsects();
  const jpToSci = new Map();
  for (const r of rows) {
    const jp = (r.japanese_name || '').trim();
    if (!jp) continue;
    const sci = toScientificFilename(r.scientific_name, r.genus, r.species);
    if (sci) jpToSci.set(jp, sci);
  }

  const files = fs.readdirSync(imagesDir).filter(f => f.match(/\.(jpg|jpeg|png|gif|webp)$/i));
  const jpFiles = files.filter(isJapaneseFilename);
  if (jpFiles.length === 0) {
    console.log('No Japanese-named images found in', imagesDir);
  }

  let renamed = 0;
  for (const file of jpFiles) {
    const ext = path.extname(file);
    const base = path.basename(file, ext);
    const sci = jpToSci.get(base);
    if (!sci) {
      console.warn(`No mapping for JP name: ${base} (skipped)`);
      continue;
    }
    let target = `${sci}${ext}`;
    let targetPath = path.join(imagesDir, target);
    // avoid overwrite
    let i = 2;
    while (fs.existsSync(targetPath)) {
      target = `${sci}_${i}${ext}`;
      targetPath = path.join(imagesDir, target);
      i++;
    }
    const oldPath = path.join(imagesDir, file);
    fs.renameSync(oldPath, targetPath);
    console.log(`Renamed: ${file} -> ${target}`);
    renamed++;
  }

  // Normalize files that include author/year in filename; keep only binomial
  for (const file of files) {
    const ext = path.extname(file);
    const base = path.basename(file, ext);
    const m = base.match(/^([A-Z][a-z]+_[a-z]+)[^]*$/);
    if (m && m[1] !== base) {
      const targetBase = m[1];
      const oldPath = path.join(imagesDir, file);
      let target = `${targetBase}${ext}`;
      let targetPath = path.join(imagesDir, target);
      let i = 2;
      while (fs.existsSync(targetPath)) {
        target = `${targetBase}_${i}${ext}`;
        targetPath = path.join(imagesDir, target);
        i++;
      }
      try {
        fs.renameSync(oldPath, targetPath);
        console.log(`Normalized: ${file} -> ${target}`);
        renamed++;
      } catch (e) {
        console.warn(`Failed to normalize ${file}: ${e.message}`);
      }
    }
  }

  console.log(`Done. Renamed ${renamed} file(s).`);
}

main();

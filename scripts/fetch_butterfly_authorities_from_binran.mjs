import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

const BINRAN_BASE = 'https://web.archive.org/web/20210725000204/https://binran.lepimages.jp';
const TAXA_URL = `${BINRAN_BASE}/taxa`;

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const CSV_PATH = path.join(ROOT, 'public', 'insects.csv');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'insects-host-plant-explorer/1.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.text();
}

function extractFamilySpeciesLinks(html) {
  const links = [];
  // More tolerant pattern: find a Family line, then the second anchor for species list
  const re = /Family\s+([A-Za-z]+)\s+[^<]*?<a[^>]+\/taxa\/family\/[A-Za-z]+\/genus[^>]*>.*?<a\s+href=\"([^\"]+\/taxa\/family\/[A-Za-z]+\/species)\"/gs;
  let m;
  while ((m = re.exec(html))) {
    const fam = m[1];
    const url = m[2];
    links.push({ family: fam, url });
  }
  // Keep only butterfly families
  const keep = new Set(['Hesperiidae', 'Papilionidae', 'Pieridae', 'Lycaenidae', 'Nymphalidae']);
  return links.filter(l => keep.has(l.family));
}

function parseSpeciesList(html) {
  // Return map of key "Genus\tSpecies" -> { author, year }
  const result = new Map();
  // Items like: <i>Genus</i> <i>species</i> (Author, 1872) ... or Author, 1758
  const itemRe = /<i>([A-Z][a-z]+)<\/i>\s*<i>([a-z-]+)<\/i>[^<]*?(?:\(([^,()]+),\s*(\d{3,4}|\[\d{3,4}\])\)|\s+([A-Z][^,<>()]+),\s*(\d{3,4}|\[[^\]]+\]))/g;
  let m;
  while ((m = itemRe.exec(html))) {
    const genus = m[1];
    const species = m[2];
    const author = (m[3] || m[5] || '').trim();
    const yearRaw = (m[4] || m[6] || '').trim();
    const year = yearRaw.replace(/[\[\]]/g, '');
    const key = `${genus}\t${species}`;
    if (author && year) {
      result.set(key, { author, year });
    }
  }
  return result;
}

async function buildAuthorityMap() {
  const html = await fetchText(TAXA_URL);
  const famLinks = extractFamilySpeciesLinks(html);
  const combined = new Map();
  for (const { family, url } of famLinks) {
    try {
      const listHtml = await fetchText(url);
      const map = parseSpeciesList(listHtml);
      for (const [k, v] of map.entries()) combined.set(k, v);
      console.log(`Fetched ${family} species: +${map.size} (total ${combined.size})`);
      await sleep(300); // be gentle to Archive
    } catch (e) {
      console.warn(`Failed to fetch ${family}: ${e.message}`);
    }
  }
  return combined;
}

async function main() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`Not found: ${CSV_PATH}`);
    process.exit(1);
  }
  const raw = fs.readFileSync(CSV_PATH, 'utf-8');
  const parsed = Papa.parse(raw, { header: true, skipEmptyLines: false });
  const rows = parsed.data;

  // Build list of targets (butterflies missing author/year)
  const targets = [];
  for (const r of rows) {
    if (!r || Object.keys(r).length === 1 && Object.values(r)[0] === '') continue;
    const familyJp = (r.family_jp || r.family || '').trim();
    const isButterfly = /チョウ科$/.test(familyJp);
    if (!isButterfly) continue;
    if ((r.author?.toString().trim() || '') && (r.year?.toString().trim() || '')) continue;
    const genus = (r.genus || '').trim();
    const species = (r.species || '').trim();
    if (genus && species) targets.push({ genus, species });
  }
  console.log(`Targets needing author/year: ${targets.length}`);

  const authMap = await buildAuthorityMap();
  let updated = 0;

  for (const r of rows) {
    if (!r || Object.keys(r).length === 1 && Object.values(r)[0] === '') continue;
    const familyJp = (r.family_jp || r.family || '').trim();
    const isButterfly = /チョウ科$/.test(familyJp);
    if (!isButterfly) continue;
    const hasAuthor = (r.author || '').toString().trim().length > 0;
    const hasYear = (r.year || '').toString().trim().length > 0;
    if (hasAuthor && hasYear) continue;
    const key = `${(r.genus||'').trim()}\t${(r.species||'').trim()}`;
    const hit = authMap.get(key);
    if (hit) {
      r.author = r.author || hit.author;
      r.year = r.year || hit.year;
      updated++;
    }
  }

  const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const backup = `${CSV_PATH}.bak.binran_author_${stamp}`;
  fs.writeFileSync(backup, raw);
  const out = Papa.unparse(rows, { header: true, newline: '\n' });
  fs.writeFileSync(CSV_PATH, out + '\n');
  console.log(`Updated rows: ${updated}`);
}

main().catch(e => { console.error(e); process.exit(1); });

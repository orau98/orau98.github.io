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

function extractSpeciesListLinks(html) {
  const entries = [];
  // Family species links
  const famRe = /Family\s+([A-Za-z]+)\s+[^<]*?<a[^>]+\/taxa\/family\/[A-Za-z]+\/genus[^>]*>.*?<a\s+href=\"([^\"]+\/taxa\/family\/[A-Za-z]+\/species)\"/gs;
  let m;
  while ((m = famRe.exec(html))) {
    entries.push({ rank: 'family', name: m[1], url: m[2] });
  }
  // Subfamily species links
  const subRe = /Subfamily\s+([A-Za-z]+)\s+[^<]*?<a[^>]+\/taxa\/subfamily\/[A-Za-z]+\/genus[^>]*>.*?<a\s+href=\"([^\"]+\/taxa\/subfamily\/[A-Za-z]+\/species)\"/gs;
  while ((m = subRe.exec(html))) {
    entries.push({ rank: 'subfamily', name: m[1], url: m[2] });
  }
  const keepFamilies = new Set(['Hesperiidae', 'Papilionidae', 'Pieridae', 'Lycaenidae', 'Nymphalidae']);
  // Keep all subfamilies under these and all five families
  return entries.filter(e => (e.rank === 'family' && keepFamilies.has(e.name)) || e.rank === 'subfamily');
}

function parseSpeciesList(html) {
  // Returns { auth: Map(key->{author,year}), links: Map(key->detailUrl) }
  const auth = new Map();
  const links = new Map();
  // Items like: <i>Genus</i> <i>species</i> (Author, 1872) ... followed by a 詳細 link
  const blockRe = /<li>\s*\n?\s*<i>([A-Z][a-z]+)<\/i>\s*<i>([a-z-]+)<\/i>[\s\S]*?(?:\(([^,()]+),\s*(\d{3,4}|\[[^\]]+\])\)|\s+([A-Z][^,<>()]+),\s*(\d{3,4}|\[[^\]]+\]))[\s\S]*?<a\s+href=\"([^\"]+\/species\/\d+)\">/g;
  let m;
  while ((m = blockRe.exec(html))) {
    const genus = m[1];
    const species = m[2];
    const author = (m[3] || m[5] || '').trim();
    const yearRaw = (m[4] || m[6] || '').trim();
    const year = yearRaw.replace(/[\[\]]/g, '');
    const url = m[7];
    const key = `${genus}\t${species}`;
    if (url) links.set(key, url);
    if (author && year) auth.set(key, { author, year });
  }

  // Fallback: also try to collect links even if author/year not present inline
  const linkOnlyRe = /<li>\s*\n?\s*<i>([A-Z][a-z]+)<\/i>\s*<i>([a-z-]+)<\/i>[\s\S]*?<a\s+href=\"([^\"]+\/species\/\d+)\">/g;
  while ((m = linkOnlyRe.exec(html))) {
    const key = `${m[1]}\t${m[2]}`;
    if (!links.has(key)) links.set(key, m[3]);
  }
  return { auth, links };
}

async function buildAuthorityMap() {
  const html = await fetchText(TAXA_URL);
  const fast = process.argv.includes('--fast');
  let specLinks;
  if (fast) {
    // Only family-level species pages (5 pages)
    specLinks = [];
    const famRe = /Family\s+([A-Za-z]+)\s+[^<]*?<a[^>]+\/taxa\/family\/[A-Za-z]+\/genus[^>]*>.*?<a\s+href=\"([^\"]+\/taxa\/family\/[A-Za-z]+\/species)\"/gs;
    let m;
    while ((m = famRe.exec(html))) {
      const fam = m[1];
      if (['Hesperiidae','Papilionidae','Pieridae','Lycaenidae','Nymphalidae'].includes(fam)) {
        specLinks.push({ rank: 'family', name: m[1], url: m[2] });
      }
    }
  } else {
    specLinks = extractSpeciesListLinks(html);
  }
  const combinedAuth = new Map();
  const combinedLinks = new Map();
  const genusIndex = new Map();
  for (const { rank, name, url } of specLinks) {
    try {
      const listHtml = await fetchText(url);
      const { auth, links } = parseSpeciesList(listHtml);
      for (const [k, v] of auth.entries()) combinedAuth.set(k, v);
      for (const [k, v] of links.entries()) combinedLinks.set(k, v);
      console.log(`Fetched ${rank} ${name} species: +${auth.size} (total ${combinedAuth.size})`);
      await sleep(300); // be gentle to Archive
    } catch (e) {
      console.warn(`Failed to fetch ${rank} ${name}: ${e.message}`);
    }
  }
  // Build genus index from family genus pages
  const families = ['Hesperiidae','Papilionidae','Pieridae','Lycaenidae','Nymphalidae'];
  for (const fam of families) {
    const gListUrl = `${BINRAN_BASE}/taxa/family/${fam}/genus`;
    try {
      const gHtml = await fetchText(gListUrl);
      const re = /<td><i>([A-Z][a-z]+)<\/i><\/td>[\s\S]*?<a\s+href=\"([^\"]+\/taxa\/genus\/[A-Za-z]+\/species)\"/g;
      let m; let added = 0;
      while ((m = re.exec(gHtml))) {
        const genus = m[1];
        const url = m[2];
        if (!genusIndex.has(genus)) { genusIndex.set(genus, url); added++; }
      }
      console.log(`Genus index from ${fam}: +${added} (total ${genusIndex.size})`);
      await sleep(200);
    } catch (e) {
      console.warn(`Failed genus list for ${fam}: ${e.message}`);
    }
  }
  return { combinedAuth, combinedLinks, genusIndex };
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

  const { combinedAuth: authMap, combinedLinks: linkIndex, genusIndex } = await buildAuthorityMap();
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
      continue;
    }
    // Try detail page if link known
    let url = linkIndex.get(key);
    if (url) {
      try {
        const detail = await fetchText(url);
        // Pattern in detail table: <th>著者</th><td>Author, YYYY</td>
        const m = detail.match(/<th>著者<\/th>\s*<td>([^<]+)<\/td>/);
        if (m) {
          const val = m[1].trim();
          const parts = val.split(/,\s*/);
          const author = parts[0] || '';
          const year = (parts[1] || '').replace(/[\[\]]/g, '');
          if (author && year) {
            r.author = r.author || author;
            r.year = r.year || year;
            updated++;
          }
        }
        await sleep(200);
      } catch (e) {
        console.warn(`Detail fetch failed for ${key}: ${e.message}`);
      }
    }
    if ((!r.author || !r.author.toString().trim()) || (!r.year || !r.year.toString().trim())) {
      // Try genus-specific species page
      const genus = (r.genus || '').trim();
      const species = (r.species || '').trim();
      const gUrl = genusIndex.get(genus);
      if (gUrl) {
        try {
          const gHtml = await fetchText(gUrl);
          const safeGenus = genus.replace(/[-/\\.^$*+?()[\]{}|]/g, '');
          const safeSpecies = species.replace(/[-/\\.^$*+?()[\]{}|]/g, '');
          const blockRe = new RegExp(`<i>${safeGenus}<\\/i>\\s*<i>${safeSpecies}<\\/i>[\\s\\S]*?<a\\s+href=\\\"([^\\\"]+\/species\/\\d+)\\\">`);
          const bm = gHtml.match(blockRe);
          if (bm) {
            url = bm[1];
            // Inline author/year on genus page
            const inlineRe = new RegExp(`<i>${safeGenus}<\\/i>\\s*<i>${safeSpecies}<\\/i>[^<]*?(?:\\(([^,()]+),\\s*(\\d{3,4}|\\[[^\\]]+\\])\\)|\\s+([A-Z][^,<>()]+),\\s*(\\d{3,4}|\\[[^\\]]+\\]))`);
            const im = gHtml.match(inlineRe);
            if (im) {
              const author = (im[1] || im[3] || '').trim();
              const year = ((im[2] || im[4] || '').trim()).replace(/[\[\]]/g,'');
              if (author && year) {
                if (!r.author) r.author = author;
                if (!r.year) r.year = year;
                updated++;
              }
            }
            if ((!r.author || !r.author.toString().trim()) || (!r.year || !r.year.toString().trim())) {
              const dHtml = await fetchText(url);
              const dm = dHtml.match(/<th>著者<\/th>\s*<td>([^<]+)<\/td>/);
              if (dm) {
                const val = dm[1].trim();
                const parts = val.split(/,\s*/);
                const author = parts[0] || '';
                const year = (parts[1] || '').replace(/[\[\]]/g, '');
                if (author && year) {
                  if (!r.author) r.author = author;
                  if (!r.year) r.year = year;
                  updated++;
                }
              }
            }
            await sleep(200);
          }
        } catch (e) {
          console.warn(`Genus page fetch failed for ${genus}: ${e.message}`);
        }
      }
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

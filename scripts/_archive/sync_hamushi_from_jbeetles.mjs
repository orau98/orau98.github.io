import fs from 'fs/promises';
import path from 'path';

const ROOT = process.cwd();
const OUT_JSON = path.join(ROOT, 'reports', 'jbeetles_chrysomelidae_map.json');
const FILES = [
  path.join(ROOT, 'normalized_data', 'insects.csv'),
  path.join(ROOT, 'public', 'insects.csv'),
];

const fetchText = async (url) => {
  const res = await fetch(url, { headers: { 'User-Agent': 'ihpe-sync/1.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.text();
};

const encode = (s) => encodeURI(s);

// Crawl subfamily pages under 134-ハムシ科
// Discover all subfamily pages from the index
const INDEX = 'https://japanesebeetles.jimdofree.com/目録/134-ハムシ科/';
const listSubfamilyPages = async () => {
  const html = await fetchText(INDEX);
  const s = new Set();
  const rx = /(href=\"(\/[^"]*\/目録\/134-ハムシ科\/[^"]+\/)\")/g;
  let m; while ((m = rx.exec(html))) { s.add('https://japanesebeetles.jimdofree.com' + m[2]); }
  const rx2 = /href=\"(\/目録\/134-ハムシ科\/[^"]+\/)\"/g;
  while ((m = rx2.exec(html))) { s.add('https://japanesebeetles.jimdofree.com' + m[1]); }
  return Array.from(s);
};

// Parse species lines of the form: <em>Genus</em> (<em>Subgenus</em>) <em>species</em> Author, YEAR / <span>和名</span>
const parseSpeciesFromHtml = (html) => {
  const entries = [];
  // Pattern A: <em>Genus</em> (<em>Subgenus</em>) <em>species</em>
  let re = /<em>([A-Z][a-z]+)<\/em>(?:\s*\(<em>([A-Z][a-z]+)<\/em>\))?\s*<em>([a-z][a-z-]+(?:\s+[a-z-]+)?)<\/em>/g;
  let m;
  while ((m = re.exec(html))) {
    const genus = m[1];
    const subgenus = m[2] || '';
    const species = m[3];
    const rest = html.slice(m.index, m.index + 500); // look ahead
    // capture author/year patterns nearby
    let author = '';
    let year = '';
    let a;
    if ((a = rest.match(/\(([^,()]+),\s*(\[?\d{4}\]?)/))) {
      author = a[1].trim(); year = a[2].replace(/[\[\]]/g, '').trim();
    } else if ((a = rest.match(/\s([A-Z][^<,()]+),\s*(\[?\d{4}\]?)/))) {
      author = a[1].trim(); year = a[2].replace(/[\[\]]/g, '').trim();
    }
    // capture Japanese name if present near a slash or span
    let jp = '';
    let j1 = rest.match(/\/(?:\s*)<span[^>]*>([^<]+)<\/span>/);
    if (j1) jp = j1[1].trim();
    // Fallback: the JP name can be the next <span class="font9">
    if (!jp) {
      let j2 = rest.match(/<span[^>]*class=\"font9\"[^>]*>([^<]+)<\/span>/);
      if (j2) jp = j2[1].trim();
    }
    entries.push({ genus, subgenus, species, author, year, jp });
  }
  // Pattern B: <em>Genus species[ subspecies]</em> ... / <span>和名</span>
  re = /<em>([A-Z][a-z]+)\s+([a-z][a-z-]+(?:\s+[a-z-]+)?)<\/em>([\s\S]{0,200}?)\/(?:\s*)<span[^>]*>([^<]+)<\/span>/g;
  while ((m = re.exec(html))) {
    const genus = m[1];
    const species = m[2];
    const rest = m[3] || '';
    const jp = (m[4] || '').trim();
    let author = '';
    let year = '';
    let a = rest.match(/\(([^,()]+),\s*(\[?\d{4}\]?)/) || rest.match(/\s([A-Z][^<,()]+),\s*(\[?\d{4}\]?)/);
    if (a) {
      author = (a[1] || '').replace(/[\[\]]/g, '').trim();
      year = (a[2] || '').replace(/[\[\]]/g, '').trim();
    }
    entries.push({ genus, subgenus: '', species, author, year, jp });
  }
  return entries;
};

const buildMap = async () => {
  const pages = await listSubfamilyPages();
  const all = [];
  for (const url of pages) {
    try {
      const html = await fetchText(url);
      const items = parseSpeciesFromHtml(html);
      all.push(...items);
      await new Promise((r) => setTimeout(r, 200));
    } catch (e) {
      console.warn('Fetch failed:', url, e.message);
    }
  }
  // Build maps by Japanese name and by binomial
  const byJa = new Map();
  const byBinom = new Map();
  for (const it of all) {
    const ja = it.jp;
    const binom = `${it.genus} ${it.species}`.trim();
    if (ja) if (!byJa.has(ja)) byJa.set(ja, it);
    if (!byBinom.has(binom)) byBinom.set(binom, it);
  }
  await fs.mkdir(path.dirname(OUT_JSON), { recursive: true });
  await fs.writeFile(OUT_JSON, JSON.stringify({ total: all.length, byJa: Array.from(byJa.entries()), byBinom: Array.from(byBinom.entries()) }, null, 2), 'utf8');
  return { byJa, byBinom };
};

const applyToCsv = async (file, byJa) => {
  const txt = await fs.readFile(file, 'utf8');
  const lines = txt.split(/\r?\n/);
  const header = lines.shift();
  const H = header.split(',');
  const idx = Object.fromEntries(H.map((h, i) => [h, i]));
  const out = [header];
  let updated = 0; let examined = 0;
  for (const line of lines) {
    if (!line) continue;
    const cols = line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/g);
    const fam = (cols[idx['family']] || cols[idx['family_jp']] || '').trim();
    const famjp = (cols[idx['family_jp']] || '').trim();
    if (!(fam.includes('Chrysomelidae') || famjp === 'ハムシ科')) { out.push(line); continue; }
    const ja = (cols[idx['japanese_name']] || '').trim();
    if (!ja) { out.push(line); continue; }
    examined++;
    const hit = byJa.get(ja);
    if (!hit) { out.push(line); continue; }
    // Update genus/subgenus/species/author/year/scientific_name
    const genus = hit.genus || cols[idx['genus']];
    const subgenus = hit.subgenus || cols[idx['subgenus']];
    const species = hit.species || cols[idx['species']];
    const author = hit.author || cols[idx['author']];
    const year = hit.year || cols[idx['year']];
    cols[idx['genus']] = genus;
    cols[idx['subgenus']] = subgenus || '';
    cols[idx['species']] = species;
    cols[idx['author']] = author || '';
    cols[idx['year']] = year || '';
    if (genus && species) {
      let sci = `${genus} ${species}`;
      if (author) sci += ` ${author}${year ? ', ' + year : ''}`;
      cols[idx['scientific_name']] = sci;
    }
    updated++;
    out.push(cols.join(','));
  }
  await fs.writeFile(file, out.join('\n') + '\n', 'utf8');
  console.log(`[hamushi-sync] ${path.relative(ROOT, file)}: examined=${examined} updated=${updated}`);
};

const main = async () => {
  const { byJa } = await buildMap();
  for (const f of FILES) await applyToCsv(f, byJa);
  console.log('Hamushi sync complete');
};

main().catch((e) => { console.error('sync_hamushi_from_jbeetles failed:', e); process.exit(1); });

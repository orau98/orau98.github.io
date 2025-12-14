import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, 'public');
const REPORTS_DIR = path.join(ROOT, 'reports');

const INSECTS_CSV = path.join(PUBLIC_DIR, 'insects.csv');
const HOSTPLANTS_CSV = path.join(PUBLIC_DIR, 'hostplants.csv');
const FIX_REPORT_CSV = path.join(REPORTS_DIR, 'aphid_hostplant_id_fix_report.csv');

const ATLAS_REF = '日本原色アブラムシ図鑑';

const cleanString = (v) => (v == null ? '' : String(v)).trim();
const normalizeSpaces = (s) => cleanString(s).replace(/\s+/g, ' ');

const jpContainsAsToken = (haystack, needle) => {
  const h = cleanString(haystack);
  const n = cleanString(needle);
  if (!h || !n) return false;

  const delims = new Set([
    ' ',
    '\t',
    '\n',
    '\r',
    '　',
    '（',
    '）',
    '(',
    ')',
    '、',
    '・',
    '／',
    '/',
    ',',
    ';',
    '「',
    '」',
    '『',
    '』',
    '[',
    ']',
    '{',
    '}',
    '【',
    '】',
  ]);

  let idx = -1;
  while ((idx = h.indexOf(n, idx + 1)) !== -1) {
    const before = idx > 0 ? h[idx - 1] : '';
    const afterIdx = idx + n.length;
    const after = afterIdx < h.length ? h[afterIdx] : '';
    const beforeOk = !before || delims.has(before);
    const afterOk = !after || delims.has(after);
    if (beforeOk && afterOk) return true;
  }
  return false;
};

const extractTaxonKey = (sciRaw) => {
  const raw = normalizeSpaces(sciRaw)
    .replace(/[?？]+/g, '')
    .replace(/^[\"'“”]+|[\"'“”]+$/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/,/g, '')
    .trim();
  if (!raw) return null;

  const tokens = raw.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return null;

  const genus = tokens[0];
  if (!/^[A-Z][a-z]+$/.test(genus)) return null;

  let species = tokens[1];
  let subspecies = '';

  if (/^sp\.?$/i.test(species)) {
    const next = tokens[2] || '';
    species = next ? `sp. ${next}` : 'sp.';
    return `${genus} ${species}`.trim();
  }

  if (!/^[a-z][a-z-]+$/.test(species)) return null;

  const maybeSub = tokens[2] || '';
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
  if (maybeSub && /^[a-z][a-z-]+$/.test(maybeSub) && !authorParticles.has(maybeSub.toLowerCase())) {
    subspecies = maybeSub;
  }

  return [genus, species, subspecies].filter(Boolean).join(' ').trim() || null;
};

const loadCsv = (filePath) => {
  const text = fs.readFileSync(filePath, 'utf8');
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
  return Array.isArray(parsed.data) ? parsed.data : [];
};

const buildHostPlantMap = (hostplantsRows) => {
  // insect_id -> Set(plant_name)
  const out = new Map();
  for (const r of hostplantsRows) {
    const ref = cleanString(r.reference);
    if (!ref.includes(ATLAS_REF)) continue;
    const insectId = cleanString(r.insect_id);
    if (!insectId) continue;
    const plant = cleanString(r.plant_name);
    if (!plant) continue;
    if (!out.has(insectId)) out.set(insectId, new Set());
    out.get(insectId).add(plant);
  }
  return out;
};

const scoreCandidates = ({ atlasJp, atlasKey, atlasBinomial, atlasEpithet, hostPlants }, aphids) => {
  const candidates = [];
  const wantBinomial = atlasBinomial ? atlasBinomial.toLowerCase() : '';
  const wantEpithet = atlasEpithet ? atlasEpithet.toLowerCase() : '';
  const hostList = Array.from(hostPlants || []);

  for (const a of aphids) {
    const id = cleanString(a.insect_id);
    if (!id) continue;

    const genus = cleanString(a.genus);
    const species = cleanString(a.species);
    const subspecies = cleanString(a.subspecies);
    const jp = cleanString(a.japanese_name);
    const sci = cleanString(a.scientific_name);
    const syn = cleanString(a.synonyms);

    const combined = normalizeSpaces([sci, syn, jp, genus, species, subspecies].filter(Boolean).join(' ')).toLowerCase();

    if (wantBinomial && !combined.includes(wantBinomial) && wantEpithet && !combined.includes(wantEpithet)) continue;
    if (!wantBinomial && wantEpithet && !combined.includes(wantEpithet)) continue;

    let score = 0;
    const reasons = [];

    if (wantBinomial && combined.includes(wantBinomial)) {
      score += 100;
      reasons.push('binomial-in-text');
    }
    if (wantEpithet && species && species.toLowerCase() === wantEpithet) {
      score += 30;
      reasons.push('accepted-epithet');
    }

    // Japanese name signals
    if (atlasJp && jpContainsAsToken(jp, atlasJp)) {
      score += 80;
      reasons.push('jp-exact-token');
    } else if (atlasJp && jp && jp.includes(atlasJp)) {
      score += 30;
      reasons.push('jp-substring');
    }

    // Host plant overlaps in JP name
    let hostHit = 0;
    for (const plant of hostList) {
      if (!plant) continue;
      if (plant.length < 2) continue;
      if (jp && jp.includes(plant)) hostHit++;
      if (hostHit >= 3) break;
    }
    if (hostHit > 0) {
      score += Math.min(30, hostHit * 10);
      reasons.push(`hostplant-in-jp(${hostHit})`);
    }

    // Genus match (weak)
    if (atlasKey) {
      const atlasGenus = cleanString(atlasKey.split(/\s+/)[0]);
      if (atlasGenus && genus && atlasGenus.toLowerCase() === genus.toLowerCase()) {
        score += 10;
        reasons.push('genus-same');
      }
    }

    candidates.push({
      insect_id: id,
      scientific_name: sci,
      japanese_name: jp,
      score,
      reasons: reasons.join(';'),
    });
  }

  candidates.sort((a, b) => (b.score - a.score) || a.insect_id.localeCompare(b.insect_id));
  return candidates.slice(0, 5);
};

const main = async () => {
  if (!fs.existsSync(FIX_REPORT_CSV)) {
    console.error('Missing fix report:', FIX_REPORT_CSV);
    process.exit(1);
  }
  if (!fs.existsSync(INSECTS_CSV)) {
    console.error('Missing insects.csv:', INSECTS_CSV);
    process.exit(1);
  }
  if (!fs.existsSync(HOSTPLANTS_CSV)) {
    console.error('Missing hostplants.csv:', HOSTPLANTS_CSV);
    process.exit(1);
  }

  const fixReport = loadCsv(FIX_REPORT_CSV);
  const unmapped = fixReport.filter(r => !cleanString(r.dst_insect_id));

  const insects = loadCsv(INSECTS_CSV);
  const aphids = insects.filter(r => cleanString(r.family) === 'Aphididae' || cleanString(r.family_jp).includes('アブラムシ'));

  const hostplants = loadCsv(HOSTPLANTS_CSV);
  const hostPlantMap = buildHostPlantMap(hostplants);

  const outRows = [];
  let withCandidates = 0;
  let noCandidates = 0;
  let spCount = 0;

  for (const r of unmapped) {
    const atlasJp = cleanString(r.japanese_name);
    const atlasSci = cleanString(r.scientific_name);
    const atlasKey = extractTaxonKey(atlasSci) || '';
    const parts = atlasKey.split(/\s+/).filter(Boolean);
    const atlasBinomial = parts.length >= 2 ? `${parts[0]} ${parts[1]}` : '';
    const atlasEpithet = parts.length >= 2 ? parts[1] : '';

    const hostPlants = hostPlantMap.get(cleanString(r.src_insect_id)) || new Set();

    let candidates = [];
    let status = '';
    if (!atlasKey) {
      status = 'missing_key';
    } else if (atlasEpithet.toLowerCase() === 'sp.' || atlasKey.toLowerCase().includes(' sp.')) {
      status = 'unresolvable_sp';
      spCount++;
    } else {
      candidates = scoreCandidates({ atlasJp, atlasKey, atlasBinomial, atlasEpithet, hostPlants }, aphids);
      if (candidates.length > 0) {
        status = 'has_candidates';
        withCandidates++;
      } else {
        status = 'no_candidates';
        noCandidates++;
      }
    }

    outRows.push({
      src_insect_id: cleanString(r.src_insect_id),
      no: cleanString(r.no),
      japanese_name: atlasJp,
      scientific_name: atlasSci,
      atlas_key: atlasKey,
      hostplants: Array.from(hostPlants).slice(0, 12).join(' / '),
      candidate_count: candidates.length,
      candidates: candidates.map(c => c.insect_id).join(';'),
      candidate_scientific_names: candidates.map(c => c.scientific_name).join(' | '),
      candidate_japanese_names: candidates.map(c => c.japanese_name).join(' | '),
      candidate_scores: candidates.map(c => String(c.score)).join(';'),
      candidate_reasons: candidates.map(c => c.reasons).join(' | '),
      status,
    });
  }

  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const outPath = path.join(REPORTS_DIR, 'aphid_hostplant_unlinked_candidates.csv');
  fs.writeFileSync(outPath, Papa.unparse(outRows, { header: true }), 'utf8');

  console.log('[aphid-unlinked-candidates] unmapped placeholders:', unmapped.length);
  console.log('[aphid-unlinked-candidates] has candidates:', withCandidates);
  console.log('[aphid-unlinked-candidates] no candidates:', noCandidates);
  console.log('[aphid-unlinked-candidates] unresolvable sp.:', spCount);
  console.log('[aphid-unlinked-candidates] output:', path.relative(ROOT, outPath));
};

main().catch((e) => {
  console.error('[aphid-unlinked-candidates] failed:', e);
  process.exit(1);
});


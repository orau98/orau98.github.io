import fs from 'fs/promises';
import path from 'path';
import Papa from 'papaparse';

const ROOT = process.cwd();
const FILES = [
  path.join(ROOT, 'normalized_data', 'insects.csv'),
  path.join(ROOT, 'public', 'insects.csv'),
];

const JP_TO_LATIN = {
  'ハムシ亜科': 'Chrysomelinae',
  'ヒゲナガハムシ亜科': 'Galerucinae',
  'ホソハムシ亜科': 'Synetinae',
  'コガネハムシ亜科': 'Sagrinae',
  'マメゾウムシ亜科': 'Bruchinae',
  'ネクイハムシ亜科': 'Donaciinae',
  'クビボソハムシ亜科': 'Criocerinae',
  'カメノコハムシ亜科': 'Cassidinae',
  'サルハムシ亜科': 'Eumolpinae',
  'ツヤハムシ亜科': 'Lamprosomatinae',
  'ツツハムシ亜科': 'Cryptocephalinae',
};

const LATIN_TO_JP = Object.fromEntries(Object.entries(JP_TO_LATIN).map(([jp, la]) => [la, jp]));

const hasJa = (s='') => /[\u3040-\u30FF\u4E00-\u9FFF]/.test(s);
const hasLat = (s='') => /[A-Za-z]/.test(s);

const isBeetle = (r) => (r.family || '').includes('Chrysomelidae') || (r.family_jp || '') === 'ハムシ科';

const normalizeFile = async (file) => {
  const raw = await fs.readFile(file, 'utf8');
  const { data } = Papa.parse(raw, { header: true, skipEmptyLines: false });
  let changed = 0; let beetleRows = 0;
  for (const r of data) {
    if (!r || (Object.keys(r).length === 1 && Object.values(r)[0] === '')) continue;
    if (!isBeetle(r)) continue;
    beetleRows++;
    let sub = (r.subfamily || '').trim();
    let subJp = (r.subfamily_jp || '').trim();
    // Case: subfamily is JP label → move to subfamily_jp and set Latin
    if (sub && hasJa(sub)) {
      const la = JP_TO_LATIN[sub] || '';
      if (la) {
        r.subfamily = la;
        r.subfamily_jp = sub;
        changed++;
        continue;
      }
    }
    // Case: subfamily_jp is Latin → set JP from mapping
    if (subJp && hasLat(subJp) && !hasJa(subJp)) {
      const jp = LATIN_TO_JP[subJp] || (LATIN_TO_JP[sub] || '');
      if (jp) {
        r.subfamily_jp = jp;
        if (!sub) r.subfamily = JP_TO_LATIN[jp];
        changed++;
        continue;
      }
    }
    // Case: subfamily empty, but subfamily_jp has JP → fill Latin
    if (!sub && subJp && hasJa(subJp)) {
      const la = JP_TO_LATIN[subJp] || '';
      if (la) { r.subfamily = la; changed++; }
    }
    // Case: subfamily Latin but subfamily_jp empty → fill JP
    if (sub && !subJp && hasLat(sub) && !hasJa(sub)) {
      const jp = LATIN_TO_JP[sub] || '';
      if (jp) { r.subfamily_jp = jp; changed++; }
    }
  }
  if (changed) {
    const out = Papa.unparse(data, { header: true, newline: '\n' });
    await fs.writeFile(file, out + '\n', 'utf8');
  }
  console.log(`[beetle-subfamily-fix] ${path.relative(ROOT, file)}: beetle=${beetleRows} changed=${changed}`);
};

const main = async () => {
  for (const f of FILES) await normalizeFile(f);
};

main().catch((e) => { console.error('fix_beetle_subfamily_labels failed:', e); process.exit(1); });


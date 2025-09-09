import fs from 'fs/promises';
import path from 'path';
import Papa from 'papaparse';

const FILE = path.join(process.cwd(), 'normalized_data', 'insects.csv');

const headerOrder = [
  'insect_id','family','family_jp','subfamily','subfamily_jp','tribe','tribe_jp','genus','subgenus','species','subspecies','author','year','japanese_name','old_japanese_name','alternative_name','other_names','scientific_name','synonyms','changes_since_standard','notes'
];

const rowsToEnsure = [
  {
    insect_id: 'species-5614', family: 'Noctuidae', family_jp: 'ヤガ科', subfamily: 'Eustrotiinae', subfamily_jp: 'スジコヤガ亜科',
    tribe: '', tribe_jp: '', genus: 'Maliattha', subgenus: '', species: 'arefacta', subspecies: '', author: '(Butler)', year: '1879',
    japanese_name: 'ヒメオビコヤガ', old_japanese_name: '', alternative_name: '', other_names: '', scientific_name: 'Maliattha arefacta (Butler, 1879)',
    synonyms: '', changes_since_standard: '', notes: ''
  },
  {
    insect_id: 'species-5615', family: 'Noctuidae', family_jp: 'ヤガ科', subfamily: 'Eustrotiinae', subfamily_jp: 'スジコヤガ亜科',
    tribe: '', tribe_jp: '', genus: 'Maliattha', subgenus: '', species: 'signifera', subspecies: '', author: '(Walker)', year: '1858',
    japanese_name: 'ヒメネジロコヤガ', old_japanese_name: '', alternative_name: '', other_names: '', scientific_name: 'Maliattha signifera (Walker, 1858)',
    synonyms: '', changes_since_standard: '', notes: ''
  },
  {
    insect_id: 'species-5616', family: 'Noctuidae', family_jp: 'ヤガ科', subfamily: 'Eustrotiinae', subfamily_jp: 'スジコヤガ亜科',
    tribe: '', tribe_jp: '', genus: 'Maliattha', subgenus: '', species: 'rosacea', subspecies: '', author: '(Leech)', year: '[1889]',
    japanese_name: 'ベニモンコヤガ', old_japanese_name: '', alternative_name: '', other_names: '', scientific_name: 'Maliattha rosacea (Leech, [1889])',
    synonyms: '', changes_since_standard: '', notes: ''
  },
  {
    insect_id: 'species-5617', family: 'Noctuidae', family_jp: 'ヤガ科', subfamily: 'Eustrotiinae', subfamily_jp: 'スジコヤガ亜科',
    tribe: '', tribe_jp: '', genus: 'Maliattha', subgenus: '', species: 'chalcogramma', subspecies: '', author: '(Bryk)', year: '1948',
    japanese_name: 'ネジロコヤガ', old_japanese_name: '', alternative_name: '', other_names: '', scientific_name: 'Maliattha chalcogramma (Bryk, 1948)',
    synonyms: '', changes_since_standard: '', notes: ''
  },
  {
    insect_id: 'species-5618', family: 'Noctuidae', family_jp: 'ヤガ科', subfamily: 'Eustrotiinae', subfamily_jp: 'スジコヤガ亜科',
    tribe: '', tribe_jp: '', genus: 'Maliattha', subgenus: '', species: 'bella', subspecies: '', author: '(Staudinger)', year: '1888',
    japanese_name: 'ソトムラサキコヤガ', old_japanese_name: '', alternative_name: '', other_names: '', scientific_name: 'Maliattha bella (Staudinger, 1888)',
    synonyms: '', changes_since_standard: '', notes: ''
  }
];

const run = async () => {
  const text = await fs.readFile(FILE, 'utf8');
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
  const rows = parsed.data;
  const idToIndex = new Map();
  rows.forEach((r, i) => { if (r && r['insect_id']) idToIndex.set(String(r['insect_id']).trim(), i); });
  // Insert missing rows after species-5613
  const anchorId = 'species-5613';
  const anchorIndex = idToIndex.has(anchorId) ? idToIndex.get(anchorId) : -1;
  const missing = rowsToEnsure.filter(r => !idToIndex.has(r.insect_id));
  if (missing.length > 0) {
    const insertAt = anchorIndex >= 0 ? anchorIndex + 1 : rows.length;
    rows.splice(insertAt, 0, ...missing);
  }
  const csv = Papa.unparse(rows, { columns: headerOrder });
  await fs.writeFile(FILE, csv, 'utf8');
  console.log(`Inserted ${missing.length} missing Maliattha rows into normalized_data/insects.csv`);
};

run().catch((e) => { console.error(e); process.exit(1); });


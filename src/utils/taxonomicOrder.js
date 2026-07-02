// 詳細ページの「前の種／次の種」ナビを、五十音順ではなく分類学的な隣接順にする。
// 目的: 「次の種」で近縁種（同じ科・属）へ移動できるようにする。
//
// 昆虫: グループ(type) → 科 → 亜科 → 族 → 属 → 種小名 → 和名 → ID
// 植物: 科 → 属 → 学名 → 和名
//
// 属・種小名は classification に無いため学名から抽出する（学名は昆虫で100%整備）。

// UIの昆虫グループチップと同じ並び。ナビが種内で完結し、境界で隣グループへ続く
const INSECT_TYPE_ORDER = Object.freeze({
  moth: 0,
  butterfly: 1,
  beetle: 2,
  longhornbeetle: 3,
  leafbeetle: 4,
  aphid: 5,
});

// 学名から属名と種小名を取り出す。
// 例: "Acmaeodera (Cobosiella) luzonica Nonfried, 1895" → { genus: 'Acmaeodera', species: 'luzonica' }
//     "Micropterix aureatella (Scopoli, 1763)"          → { genus: 'Micropterix', species: 'aureatella' }
export const parseGenusSpecies = (scientificName = '') => {
  const raw = String(scientificName || '').trim();
  if (!raw) return { genus: '', species: '' };
  // 著者・年（括弧含む）以降を落とすため、先頭の学名部分だけを見る
  const tokens = raw.split(/\s+/);
  let genus = '';
  let species = '';
  for (const token of tokens) {
    // 亜属 (Subgenus) や著者の括弧はスキップ
    if (token.startsWith('(')) continue;
    // 属名: 先頭大文字で始まる最初の語
    if (!genus) {
      if (/^[A-Z][a-zA-Z.-]*$/.test(token)) genus = token;
      continue;
    }
    // 種小名: 属名の後に来る最初の小文字始まりの語（sp. / cf. などは種として扱わない）
    if (!species) {
      if (/^[a-z][a-z-]+$/.test(token) && !['sp', 'cf', 'aff', 'nr', 'of'].includes(token.replace(/\.$/, ''))) {
        species = token;
      }
      break;
    }
  }
  return { genus, species };
};

// null/空を末尾へ寄せつつ locale 比較する（空文字は最後）
const compareField = (a, b) => {
  const x = a || '';
  const y = b || '';
  if (x === y) return 0;
  if (!x) return 1;
  if (!y) return -1;
  return x.localeCompare(y, 'en');
};

const insectSortKey = (insect) => {
  const c = insect?.classification || {};
  const { genus, species } = parseGenusSpecies(insect?.scientificName);
  return {
    typeOrder: INSECT_TYPE_ORDER[insect?.type] ?? 99,
    family: c.family || c.familyJapanese || '',
    subfamily: c.subfamily || c.subfamilyJapanese || '',
    tribe: c.tribe || c.tribeJapanese || '',
    genus,
    species,
    name: insect?.name || '',
    id: String(insect?.id ?? ''),
  };
};

export const compareInsectsTaxonomically = (a, b) => {
  const ka = insectSortKey(a);
  const kb = insectSortKey(b);
  if (ka.typeOrder !== kb.typeOrder) return ka.typeOrder - kb.typeOrder;
  return (
    compareField(ka.family, kb.family) ||
    compareField(ka.subfamily, kb.subfamily) ||
    compareField(ka.tribe, kb.tribe) ||
    compareField(ka.genus, kb.genus) ||
    compareField(ka.species, kb.species) ||
    ka.name.localeCompare(kb.name, 'ja') ||
    ka.id.localeCompare(kb.id, 'en')
  );
};

export const sortInsectsTaxonomically = (insects = []) =>
  [...insects].sort(compareInsectsTaxonomically);

// 植物名を分類順に並べる。plantDetails から科・属・学名を引く。
// 分類情報の無い植物は科名を持つ植物の後ろに、和名順で並ぶ。
export const sortPlantNamesTaxonomically = (names = [], plantDetails = {}) => {
  const keyOf = (name) => {
    const d = plantDetails?.[name] || {};
    return {
      family: d.familyLatin || d.family || d.familyName || '',
      genus: d.genus || parseGenusSpecies(d.scientificName).genus || '',
      scientific: d.scientificName || '',
      name: name || '',
    };
  };
  return [...names].sort((a, b) => {
    const ka = keyOf(a);
    const kb = keyOf(b);
    return (
      compareField(ka.family, kb.family) ||
      compareField(ka.genus, kb.genus) ||
      compareField(ka.scientific, kb.scientific) ||
      ka.name.localeCompare(kb.name, 'ja')
    );
  });
};

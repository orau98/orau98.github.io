// 文献名とリンクのマッピング（書誌情報または出版社ページ）
export const sourceLinks = {
  "日本産蛾類標準図鑑1": "https://ndlsearch.ndl.go.jp/books/R100000002-I000011161861",
  "日本産蛾類標準図鑑2": "https://ndlsearch.ndl.go.jp/books/R100000002-I000011161867",
  "日本産蛾類標準図鑑3": "https://ndlsearch.ndl.go.jp/books/R100000002-I024199485",
  "日本産蛾類標準図鑑4": "https://hon.gakken.jp/book/1340511000",
  "花を訪れる蛾たち　知られざる姿を求めて": "https://ndlsearch.ndl.go.jp/books/R100000002-I000009933125",
  "花を訪れる蛾たち―知られざる姿を求めて": "https://ndlsearch.ndl.go.jp/books/R100000002-I000009933125",
  "花を訪れる蛾たち": "https://ndlsearch.ndl.go.jp/books/R100000002-I000009933125",
  "日本産タマムシ大図鑑": "https://www.mushi-sha.co.jp/shopdetail/000000000496/",
  "ハムシハンドブック": "https://ndlsearch.ndl.go.jp/books/R100000002-I025611359",
  "日本の冬夜蛾": "https://www.mushi-sha.co.jp/shopdetail/000000000506/ct6/page1/recommend/",
  "日本の冬尺蛾": "https://www.mushi-sha.co.jp/shopdetail/000000000509/ct6/page1/recommend/",
  "蛾類通信": "https://www.moth.jp/pubs/jhj",
  "日本産カミキリムシ": "https://ndlsearch.ndl.go.jp/books/R100000002-I000008480283",
  "日本産蝶類標準図鑑": "https://hon.gakken.jp/book/1320229601",
  "日本原色アブラムシ図鑑": "https://ci.nii.ac.jp/ncid/BN0139061X",
  "日本昆虫目録 第4巻 準新翅類": "https://ndlsearch.ndl.go.jp/books/R100000002-I027310173",
  "松本嘉幸 (2005)": "https://www.kahaku.go.jp/albums/abm.php?d=4893&f=abm00003991.pdf&n=p409.pdf",
  "Miyazaki (1988)": "https://dl.ndl.go.jp/pid/10653578",
  "Blackman & Eastop, Aphids on the World's Plants": "https://aphidsonworldsplants.info/d_aphids_s/",
  "Aphid Species File": "https://aphid.archive.speciesfile.org/Common/basic/Taxa.aspx?TaxonNameID=1166104",
  "日本のキリガ": "https://www.mushi-sha.co.jp/shopdetail/000000000506/",
  "日本のハマキガ1": "https://www.moth.jp/",
  "日本のハマキガ2": "https://www.moth.jp/",
  "Tinea": "https://www.moth.jp/pubs/tinea",
  "さやばね": "https://coleoptera.sakura.ne.jp/publication/sayabane/sayabane-bibliography.html",
  "Nobuchi (1964) Studies on Scolytidae III": "https://www.ffpri.go.jp/pubs/bulletin/151/documents/171-3.pdf",
  "Nobuchi (1973) Studies on Scolytidae XI": "https://www.ffpri.go.jp/pubs/bulletin/251/documents/258-2.pdf",
  "Nobuchi (1974) Studies on Scolytidae XII": "https://www.ffpri.go.jp/pubs/bulletin/251/documents/266-4.pdf",
  "Nobuchi (1975) Studies on Scolytidae XIII": "https://www.ffpri.go.jp/pubs/bulletin/251/documents/277-3.pdf",
  "Nobuchi (1979) Studies on Scolytidae XVIII": "https://www.ffpri.go.jp/pubs/bulletin/301/documents/308-1.pdf",
  "Nobuchi (1981) Revision of the genus Xylosandrus from Japan": "https://www.ffpri.go.jp/pubs/bulletin/301/documents/314-4.pdf",
};

const referenceAliases = {
  "日本のキリガ": "日本の冬夜蛾",
};

const findKnownReferenceKey = (source = "") => {
  if (!source) return "";
  for (const key of Object.keys(sourceLinks)) {
    if (source.includes(key)) return key;
  }
  return "";
};

const canonicalizeReferenceKey = (key = "") => referenceAliases[key] || key;

const getLinkByReferenceKey = (key = "") => {
  if (!key) return null;
  const canonicalKey = canonicalizeReferenceKey(key);
  return sourceLinks[canonicalKey] || sourceLinks[key] || null;
};

// 出典から参考リンクを取得する関数
export const getSourceLink = (source) => {
  if (!source) return null;

  const matchedKey = findKnownReferenceKey(String(source));
  if (matchedKey) {
    return getLinkByReferenceKey(matchedKey);
  }

  const normalized = normalizeReference(source);
  return getLinkByReferenceKey(normalized);
};

// 出典表記を正規化（余計な書誌情報を除去して短縮名に）
export const normalizeReference = (source) => {
  if (!source || typeof source !== 'string') return source || '';
  let s = source.trim();

  // 既知タイトルが含まれていれば、その短縮名に統一
  const matchedKey = findKnownReferenceKey(s);
  if (matchedKey) return canonicalizeReferenceKey(matchedKey);

  // よくある書誌情報の除去（著者・出版社・発行年・ページなど）
  s = s.replace(/著者\s*[:：][^,，。]+/g, '').replace(/出版社\s*[:：][^,，。]+/g, '')
       .replace(/発行年\s*[:：][^,，。]+/g, '').replace(/\bpp?\.\s*\d+(-\d+)?/gi, '');

  // 丸括弧内の情報は基本除去するが、号数・巻数など数字のみの括弧は残す
  // 1) 数字のみの括弧を一時退避
  const preserved = [];
  s = s.replace(/\(\s*\d+\s*\)/g, (m) => {
    preserved.push(m);
    return `__PRESERVED_REF_${preserved.length - 1}__`;
  });
  // 2) 残りの括弧を除去
  s = s.replace(/\(.*?\)/g, '');
  // 3) 一時退避を復元
  s = s.replace(/__PRESERVED_REF_(\d+)__/g, (_, i) => preserved[Number(i)] || '');
  // 記号の余剰除去
  s = s.replace(/[，,。\s]+$/g, '').replace(/\s{2,}/g, ' ').trim();

  const cleanedMatchedKey = findKnownReferenceKey(s);
  if (cleanedMatchedKey) return canonicalizeReferenceKey(cleanedMatchedKey);
  return canonicalizeReferenceKey(s);
};

export const getReferenceMeta = (source) => {
  const raw = typeof source === 'string' ? source.trim() : '';
  const displayLabel = normalizeReference(raw);

  return {
    displayLabel,
    link: getSourceLink(displayLabel || raw),
  };
};

export const getReferenceMetaList = (sources) => {
  const values = Array.isArray(sources) ? sources : [sources];
  const entries = [];
  const seen = new Map();

  values
    .flatMap((value) => String(value || '').split(/[;；]/))
    .map((value) => value.trim())
    .filter(Boolean)
    .forEach((raw) => {
      const meta = getReferenceMeta(raw);
      const key = meta.displayLabel || raw;
      if (!key) return;

      if (!seen.has(key)) {
        const entry = {
          displayLabel: key,
          link: meta.link,
        };
        seen.set(key, entry);
        entries.push(entry);
        return;
      }

      const entry = seen.get(key);
      if (!entry.link && meta.link) {
        entry.link = meta.link;
      }
    });

  return entries;
};

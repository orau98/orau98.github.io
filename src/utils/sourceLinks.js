// 文献名とリンクのマッピング（CiNiiまたはAmazonリンク）
export const sourceLinks = {
  "日本産蛾類標準図鑑1": "https://www.amazon.co.jp/日本産蛾類標準図鑑１-岸田泰則/dp/405403845X",
  "日本産蛾類標準図鑑2": "https://www.amazon.co.jp/%E6%27%A5%E6%9C%AC%E7%94%A3%E8%9B%BE%E9%A1%9E%E6%A8%99%E6%BA%96%E5%9B%B3%E9%91%91%EF%BC%92-%E5%B2%B8%E7%94%B0%E6%B3%B0%E5%89%87/dp/4054038468", 
  "日本産蛾類標準図鑑3": "https://www.amazon.co.jp/%E6%27%A5%E6%9C%AC%E7%94%A3%E8%9B%BE%E9%A1%9E%E6%A8%99%E6%BA%96%E5%9B%B3%E9%91%913-%E9%82%A3%E9%A0%88%E7%BE%A9%E6%AC%A1/dp/405405109X",
  "日本産蛾類標準図鑑4": "https://www.amazon.co.jp/s?k=日本産蛾類標準図鑑4+岸田泰則",
  "花を訪れる蛾たち　知られざる姿を求めて": "https://amzn.to/4b2pvfe",
  "花を訪れる蛾たち―知られざる姿を求めて": "https://amzn.to/4b2pvfe",
  "花を訪れる蛾たち": "https://amzn.to/4b2pvfe",
  "日本産蝶類標準図鑑": "https://www.amazon.co.jp/日本産蝶類標準図鑑-白水-隆/dp/4052022963",
  "日本産タマムシ大図鑑": "https://amzn.to/4m2vPWp",
  "ハムシハンドブック": "https://amzn.to/456YVhu",
  "日本の冬夜蛾": "https://www.mushi-sha.co.jp/shopdetail/000000000506/ct6/page1/recommend/",
  "日本の冬尺蛾": "https://www.mushi-sha.co.jp/shopdetail/000000000509/ct6/page1/recommend/",
  "蛾類通信": "http://publ.moth.jp/tsushin/",
  "日本産カミキリムシ": "https://kawamo.co.jp/roppon-ashi/sub300.htm",
  "日本産蝶類標準図鑑": "https://www.amazon.co.jp/日本産蝶類標準図鑑-白水-隆/dp/4052022963",
  "日本原色アブラムシ図鑑": "https://www.amazon.co.jp/dp/4881371533",
  "日本のキリガ": "https://www.mushi-sha.co.jp/",
  "日本のハマキガ1": "https://www.moth.jp/",
  "日本のハマキガ2": "https://www.moth.jp/",
  "Tinea": "https://www.jstage.jst.go.jp/browse/tinea",
  "さやばね": "https://coleoptera.sakura.ne.jp/publication/sayabane/sayabane-bibliography.html"
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
  const matchedKey = findKnownReferenceKey(raw);
  const displayLabel = normalizeReference(raw);
  const originalLabel = matchedKey && canonicalizeReferenceKey(matchedKey) !== matchedKey
    ? matchedKey
    : '';

  return {
    displayLabel,
    originalLabel,
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
          originalLabels: meta.originalLabel ? [meta.originalLabel] : [],
          link: meta.link,
        };
        seen.set(key, entry);
        entries.push(entry);
        return;
      }

      const entry = seen.get(key);
      if (meta.originalLabel && !entry.originalLabels.includes(meta.originalLabel)) {
        entry.originalLabels.push(meta.originalLabel);
      }
      if (!entry.link && meta.link) {
        entry.link = meta.link;
      }
    });

  return entries;
};

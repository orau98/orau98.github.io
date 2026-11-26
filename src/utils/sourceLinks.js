import { buildAmazonBookUrl } from './amazonAssociates.js';
import {
  formatBibliographyCitation,
  formatCitationAuthorYear,
  formatCitationTitle,
  getBibliographyEntry,
} from './bibliography.js';

// 文献名とリンクのマッピング（書籍はAmazonアソシエイト、非売品・論文等は一次情報）
export const sourceLinks = {
  "日本産蛾類標準図鑑1": buildAmazonBookUrl('405403845X'),
  "日本産蛾類標準図鑑2": buildAmazonBookUrl('4054038468'),
  "日本産蛾類標準図鑑3": buildAmazonBookUrl('405405109X'),
  "日本産蛾類標準図鑑4": buildAmazonBookUrl('4054051103'),
  "花を訪れる蛾たち　知られざる姿を求めて": buildAmazonBookUrl('490264908X'),
  "花を訪れる蛾たち―知られざる姿を求めて": buildAmazonBookUrl('490264908X'),
  "花を訪れる蛾たち": buildAmazonBookUrl('490264908X'),
  "日本産タマムシ大図鑑": buildAmazonBookUrl('494395507X'),
  "ハムシハンドブック": buildAmazonBookUrl('4829981229'),
  "日本の冬夜蛾": "https://www.mushi-sha.co.jp/shopdetail/000000000506/ct6/page1/recommend/",
  "日本の冬尺蛾": "https://www.mushi-sha.co.jp/shopdetail/000000000509/ct6/page1/recommend/",
  "平野 (2023)": "https://www.moth.jp/pubs/jhj",
  "河野 (2023)": "https://www.moth.jp/pubs/jhj",
  "松井ら (2023)": "https://www.moth.jp/pubs/jhj",
  "松井英子 (1984)": "https://www.moth.jp/pubs/jhj",
  "大林隆司・竹内浩二 (1996)": "https://www.moth.jp/pubs/jhj",
  "富永智 (1998) 蛾類通信198号": "https://www.moth.jp/pubs/jhj",
  "越野誠一郎 (1999) 蛾類通信202号": "https://www.moth.jp/pubs/jhj",
  "蛾類通信": "https://www.moth.jp/pubs/jhj",
  "日本産カミキリムシ": buildAmazonBookUrl('4486017412'),
  "日本産蝶類標準図鑑": buildAmazonBookUrl('4052022963'),
  "日本原色アブラムシ図鑑": buildAmazonBookUrl('4881370170'),
  "日本昆虫目録 第4巻 準新翅類": buildAmazonBookUrl('4434218220'),
  "松本嘉幸 (2005)": "https://www.kahaku.go.jp/albums/abm.php?d=4893&f=abm00003991.pdf&n=p409.pdf",
  "寺本憲之 (1993)": "https://dl.ndl.go.jp/pid/10654502",
  "Miyazaki (1988)": "https://dl.ndl.go.jp/pid/10653578",
  "Blackman & Eastop, Aphids on the World's Plants": "https://aphidsonworldsplants.info/d_aphids_s/",
  "Aphid Species File": "https://aphid.archive.speciesfile.org/Common/basic/Taxa.aspx?TaxonNameID=1166104",
  "日本のキリガ": "https://www.mushi-sha.co.jp/shopdetail/000000000506/",
  "日本のハマキガ1": "https://www.moth.jp/pubs/special",
  "日本のハマキガ2": "https://www.moth.jp/pubs/special",
  "日本のハマキガ3": "https://www.moth.jp/pubs/special",
  "Arita et al. (2016)": "https://www.moth.jp/pubs/tinea",
  "Nasu (2021)": "https://www.moth.jp/pubs/tinea",
  "Yata et al. (2023)": "https://www.moth.jp/pubs/tinea",
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
  const bibliographyEntry = getBibliographyEntry(source);
  if (bibliographyEntry?.url) return bibliographyEntry.url;
  const journalLink = getLinkByReferenceKey(bibliographyEntry?.journal);
  if (journalLink) return journalLink;

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

const resolveReference = (source) => {
  const raw = typeof source === 'string' ? source.trim() : '';
  const exact = getBibliographyEntry(raw);
  if (exact) return { raw, entry: exact, location: '' };

  const pageSuffix = raw.match(/^(.*?)\s+((?:PDF\s+)?pp?\.\s*[0-9０-９].*)$/i);
  const entry = pageSuffix && getBibliographyEntry(pageSuffix[1]);
  return { raw, entry, location: entry ? pageSuffix[2] : '' };
};

const formatReferenceMeta = ({ raw, entry, location }) => {
  const citation = entry ? formatBibliographyCitation(entry) : raw;

  return {
    displayLabel: [citation, location].filter(Boolean).join(' '),
    link: entry?.pageLinks?.[location] || entry?.url || getSourceLink(raw),
    key: entry ? [entry.key, location].filter(Boolean).join(' ') : raw,
  };
};

export const getReferenceMeta = (source) => formatReferenceMeta(resolveReference(source));

export const getCompactReferenceMeta = (source) => {
  const reference = resolveReference(source);
  const { raw, entry, location } = reference;
  const meta = formatReferenceMeta(reference);
  if (!entry) {
    const authorYear = raw.match(/^(.+?)\s*[（(]\s*((?:18|19|20)\d{2})\s*[）)](?:\s+(.*))?$/);
    return {
      ...meta,
      label: authorYear ? `${authorYear[1].trim()} (${authorYear[2]})` : raw,
      publication: authorYear?.[3] || '',
    };
  }

  const issue = entry.volume && entry.issue ? `${entry.volume}(${entry.issue})` : entry.volume || entry.issue;
  return {
    ...meta,
    label: formatCitationAuthorYear(entry) || entry.title,
    publication: entry.journal ? [entry.journal, issue].filter(Boolean).join(' ') : formatCitationTitle(entry),
    pages: entry.journal && !location ? entry.pages : '',
    location,
  };
};

export const getReferenceMetaList = (sources, { compact = false } = {}) => {
  const values = Array.isArray(sources) ? sources : [sources];
  const entries = [];
  const seen = new Map();

  values
    .flatMap((value) => String(value || '').split(/[;；]/))
    .map((value) => value.trim())
    .filter(Boolean)
    .forEach((raw) => {
      const meta = compact ? getCompactReferenceMeta(raw) : getReferenceMeta(raw);
      const key = meta.key || raw;
      if (!key) return;

      if (!seen.has(key)) {
        const entry = {
          ...(compact ? meta : {}),
          displayLabel: meta.displayLabel || raw,
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

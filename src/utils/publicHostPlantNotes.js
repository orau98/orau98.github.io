const normalizeDigits = (value = '') => String(value).replace(/[０-９]/g, (char) =>
  String.fromCharCode(char.charCodeAt(0) - 0xFEE0)
);

const splitSegments = (note = '') => String(note)
  .split(/[\r\n\/／;；。]+/)
  .map((segment) => segment.trim())
  .filter(Boolean);

const isSourceLocatorSegment = (segment = '') => {
  const value = normalizeDigits(segment).replace(/．/g, '.').trim();

  if (/^(?:図鑑\d*|冊子|PDF|本書)?\s*p{1,2}\.?\s*\d+(?:\s*[-–—〜～~]\s*\d+)?$/i.test(value)) {
    return true;
  }
  if (/^(?:掲載)?(?:頁|ページ)\s*[:：]?\s*\d+(?:\s*[-–—〜～~]\s*\d+)?$/i.test(value)) {
    return true;
  }

  return false;
};

const isRedundantGeographySegment = (segment = '') => {
  const value = String(segment || '').trim();

  if (/^(?:海外|国外)記録(?:（我が国では(?:未知|未確認)）)?$/.test(value)) return true;
  if (/^(?:ヨーロッパ|欧州)(?:(?:での|の)記録(?:（[^）]+）)?|記録)?$/.test(value)) return true;
  if (/^(?:中国|フィジー)(?:(?:で|の)記録|の文献記録)?$/.test(value)) return true;
  if (/^(?:台湾|ロシア|オーストラリア|北アメリカ|マレー半島|パラワン島|ラオス|朝鮮半島)(?:(?:で|の)記録|記録)?$/.test(value)) return true;
  if (/^中国で記録、日本では未確認$/.test(value)) return true;
  if (/^日本での寄主植物は(?:未知|未確認)$/.test(value)) return true;
  if (/^(?:国内では不明|日本での幼生期は不明)$/.test(value)) return true;
  if (/^後2種はヨーロッパの記録$/.test(value)) return true;
  if (/^国内のヤナギ類からの個体は別種の可能性があるため国外記録のみ採用$/.test(value)) return true;

  return false;
};

const isInternalCatalogNoteSegment = (segment = '') => {
  const value = String(segment || '').trim();
  if (!value) return true;

  if (/^日本列島の甲虫全種目録(?:\(2026\)参照|2026年版)/.test(value)) return true;
  if (/^(?:国内|国外)分布\s*[:：]/.test(value)) return true;
  if (/^食草・生態情報(?:は未入力|の再配分は未実施)/.test(value)) return true;
  if (/^寄主植物情報は日本産カミキリムシにもとづく/.test(value)) return true;

  return false;
};

export const isInternalHostPlantNoteSegment = (segment = '') => {
  const value = String(segment || '').trim();
  if (!value) return true;

  if (/^OCR(?:索引|名)?\s*[:：=]?/i.test(value)) return true;
  if (/^OCR由来/i.test(value)) return true;
  if (/^curated(?:\s+long-block)?\s+cleanup\b/i.test(value)) return true;
  if (/^audit(?:\s+cleanup)?\b/i.test(value)) return true;
  if (/^(?:記録地域|地域根拠|原著植物名|YList採用名|寄主根拠|掲載頁)\s*[:：]/i.test(value)) return true;
  if (/^PDF本文(?:・寄主植物一覧)?で確認$/.test(value)) return true;
  if (isSourceLocatorSegment(value)) return true;
  if (isRedundantGeographySegment(value)) return true;

  const numeric = normalizeDigits(value).replace(/\s+/g, '');
  return /^\d{2,}(?:[-–—〜～~]\d{2,})?$/.test(numeric);
};

export const getHostPlantNoteCleanup = (note = '') => {
  const segments = splitSegments(note);
  const removedSegments = segments.filter(isInternalHostPlantNoteSegment);
  const keptSegments = segments.filter((segment) => !isInternalHostPlantNoteSegment(segment));

  return {
    keptSegments,
    removedSegments,
    note: keptSegments.join(' / '),
  };
};

export const getPublicHostPlantNoteSegments = (note = '') =>
  getHostPlantNoteCleanup(note).keptSegments;

export const getPublicHostPlantNote = (note = '') =>
  getPublicHostPlantNoteSegments(note).join(' / ');

export const getPublicHostPlantSectionNote = (note = '') =>
  splitSegments(note)
    .filter((segment) => !isInternalHostPlantNoteSegment(segment))
    .filter((segment) => !isInternalCatalogNoteSegment(segment))
    .join(' / ');

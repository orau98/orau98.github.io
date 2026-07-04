const normalizeDigits = (value = '') => String(value).replace(/[０-９]/g, (char) =>
  String.fromCharCode(char.charCodeAt(0) - 0xFEE0)
);

const splitSegments = (note = '') => String(note)
  .split(/[\r\n\/／;；。]+/)
  .map((segment) => segment.trim())
  .filter(Boolean);

const isInternalCatalogNoteSegment = (segment = '') => {
  const value = String(segment || '').trim();
  if (!value) return true;

  if (/^日本列島の甲虫全種目録\(2026\)参照/.test(value)) return true;
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

  const numeric = normalizeDigits(value).replace(/\s+/g, '');
  return /^\d{2,}(?:[-–—〜～~]\d{2,})?$/.test(numeric);
};

export const getPublicHostPlantNoteSegments = (note = '') =>
  splitSegments(note).filter((segment) => !isInternalHostPlantNoteSegment(segment));

export const getPublicHostPlantNote = (note = '') =>
  getPublicHostPlantNoteSegments(note).join(' / ');

export const getPublicHostPlantSectionNote = (note = '') =>
  splitSegments(note)
    .filter((segment) => !isInternalHostPlantNoteSegment(segment))
    .filter((segment) => !isInternalCatalogNoteSegment(segment))
    .join(' / ');

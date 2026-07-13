const CJK_CHAR = '一-龯ぁ-んァ-ヶー々〆〇';
const CJK_INTERNAL_SPACE_RE = new RegExp(`([${CJK_CHAR}])\\s+([${CJK_CHAR}])`, 'g');

export const normalizePlantProfileText = (value = '') => {
  let text = String(value || '')
    .trim()
    .replace(/，/g, '、')
    .replace(/(?<=\d)\s*ー\s*(?=\d)/g, '～');
  let previous = '';
  while (text !== previous) {
    previous = text;
    text = text.replace(CJK_INTERNAL_SPACE_RE, '$1$2');
  }
  return text
    .replace(/\s+([、。，．；：・])/g, '$1')
    .replace(/([、。，．；：・])\s+(?=[一-龯ぁ-んァ-ヶ々〆〇])/g, '$1')
    .replace(/（\s+/g, '（')
    .replace(/\s+）/g, '）');
};

const normalizeSourceText = (value = '') => String(value || '')
  .replace(/\s+([、。])/g, '$1')
  .trim();
const formatPageReferences = (value = '') => normalizeSourceText(value).replace(/;/g, '・');
const splitPageReferences = (value = '') => normalizeSourceText(value)
  .split(';')
  .map((part) => part.trim())
  .filter(Boolean);

const unpairedPdfPageReferences = (pdfPages = '', printedPages = '') => {
  const printed = splitPageReferences(printedPages).map(Number).filter(Number.isInteger);
  return splitPageReferences(pdfPages).filter((reference) => {
    const pdfPage = Number(reference);
    if (!Number.isInteger(pdfPage)) return true;
    return !printed.some((printedPage) => (
      printedPage === 2 * pdfPage - 2 || printedPage === 2 * pdfPage - 1
    ));
  });
};

// 出典 + ページを 1 文字列に整形（HostPlantDetail の SourceCitation で使用）
export const buildSourceLabel = (profile = {}) => {
  const source = normalizeSourceText(profile.source);
  const printedPage = normalizeSourceText(profile.printedPage);
  const pdfPage = normalizeSourceText(profile.page);
  const pageParts = [];
  if (printedPage) pageParts.push(`p.${formatPageReferences(printedPage)}`);
  const pdfPagesToShow = printedPage
    ? unpairedPdfPageReferences(pdfPage, printedPage).join(';')
    : pdfPage;
  if (pdfPagesToShow) pageParts.push(`PDF p.${formatPageReferences(pdfPagesToShow)}`);
  return [source, pageParts.join(' / ')].filter(Boolean).join(' ');
};

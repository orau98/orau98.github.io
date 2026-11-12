/**
 * 表示するページ番号の並び。最初と最後のページは常に出し、現在のページの前後を window 件出す。
 * 間が1ページだけ空くときは「…」ではなくその番号を出す（「1 … 3」より「1 2 3」の方が押しやすい）
 */
export const buildPageItems = (currentPage, totalPages, windowSize = 5) => {
  if (totalPages <= 1) return [1];
  const half = Math.floor(windowSize / 2);
  let start = Math.max(1, currentPage - half);
  let end = Math.min(totalPages, start + windowSize - 1);
  start = Math.max(1, end - windowSize + 1);
  const items = [];
  if (start > 1) {
    items.push(1);
    if (start === 3) items.push(2);
    else if (start > 3) items.push('gap-start');
  }
  for (let page = start; page <= end; page += 1) items.push(page);
  if (end < totalPages) {
    if (end === totalPages - 2) items.push(totalPages - 1);
    else if (end < totalPages - 2) items.push('gap-end');
    items.push(totalPages);
  }
  return items;
};

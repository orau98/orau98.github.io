export const normalizeAssetBase = (baseUrl = '/') =>
  (baseUrl || '/').endsWith('/') ? baseUrl : `${baseUrl}/`;

export function buildResizedImageUrl({
  baseUrl = import.meta.env.BASE_URL || '/',
  folder = 'insects',
  filename,
  width = 1024,
  query,
}) {
  if (!filename) return '';
  const safeBase = normalizeAssetBase(baseUrl);
  const ver = import.meta.env.VITE_ASSET_VERSION || '';
  const qs = typeof query === 'string' ? query : (ver ? `?v=${ver}` : '');
  return `${safeBase}images/resized/${folder}/${encodeURIComponent(filename)}.${width}.jpg${qs}`;
}

export function buildResponsiveSrcset({
  baseUrl = import.meta.env.BASE_URL || '/',
  folder = 'insects',
  filename,
  ext: _ext = '.jpg',
  widths = [320, 640, 1024],
  sizes = '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
  query,
}) {
  if (!filename) return {};
  const safeBase = normalizeAssetBase(baseUrl);
  const ver = import.meta.env.VITE_ASSET_VERSION || '';
  const qs = typeof query === 'string' ? query : (ver ? `?v=${ver}` : '');
  const normalizedWidths = Array.isArray(widths) && widths.length
    ? Array.from(new Set(widths)).sort((a, b) => a - b)
    : [1024];
  const srcWidth = normalizedWidths[normalizedWidths.length - 1];
  const src = buildResizedImageUrl({
    baseUrl: safeBase,
    folder,
    filename,
    width: srcWidth,
    query: qs,
  });
  const entries = normalizedWidths.map(
    (width) => `${buildResizedImageUrl({ baseUrl: safeBase, folder, filename, width, query: qs })} ${width}w`,
  );
  return {
    src,
    srcSet: entries.join(', '),
    sizes,
  };
}

export const normalizeAssetBase = (baseUrl = '/') =>
  (baseUrl || '/').endsWith('/') ? baseUrl : `${baseUrl}/`;

const normalizeResizedImageFormat = (value = 'jpg') => {
  const normalized = String(value || 'jpg').replace(/^\./, '').toLowerCase();
  if (normalized === 'jpeg') return 'jpg';
  return normalized || 'jpg';
};

export function buildResizedImageUrl({
  baseUrl = import.meta.env.BASE_URL || '/',
  folder = 'insects',
  filename,
  width = 1024,
  query,
  format = 'jpg',
  ext,
}) {
  if (!filename) return '';
  const safeBase = normalizeAssetBase(baseUrl);
  const ver = import.meta.env.VITE_ASSET_VERSION || '';
  const qs = typeof query === 'string' ? query : (ver ? `?v=${ver}` : '');
  const outputFormat = normalizeResizedImageFormat(format || ext || 'jpg');
  return `${safeBase}images/resized/${folder}/${encodeURIComponent(filename)}.${width}.${outputFormat}${qs}`;
}

export function buildResponsiveSrcset({
  baseUrl = import.meta.env.BASE_URL || '/',
  folder = 'insects',
  filename,
  ext = '.jpg',
  format,
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
    format: format || ext,
    ext,
  });
  const entries = normalizedWidths.map(
    (width) => `${buildResizedImageUrl({
      baseUrl: safeBase,
      folder,
      filename,
      width,
      query: qs,
      format: format || ext,
      ext,
    })} ${width}w`,
  );
  return {
    src,
    srcSet: entries.join(', '),
    sizes,
  };
}

export function buildResponsivePicture({
  baseUrl = import.meta.env.BASE_URL || '/',
  folder = 'insects',
  filename,
  widths = [320, 640, 1024],
  sizes = '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
  query,
}) {
  if (!filename) return { src: '', srcSet: '', sizes, sources: [] };
  const fallback = buildResponsiveSrcset({
    baseUrl,
    folder,
    filename,
    widths,
    sizes,
    query,
    format: 'jpg',
  });
  return {
    ...fallback,
    sources: ['avif', 'webp'].map((type) => ({
      type: `image/${type}`,
      srcSet: buildResponsiveSrcset({
        baseUrl,
        folder,
        filename,
        widths,
        sizes,
        query,
        format: type,
      }).srcSet,
      sizes,
    })),
  };
}

export function buildResponsiveSrcset({
  baseUrl = import.meta.env.BASE_URL || '/',
  folder = 'insects',
  filename,
  ext = '.jpg',
  widths = [320, 640, 1024],
  sizes = '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
}) {
  if (!filename) return {};
  const safeBase = (baseUrl || '/').endsWith('/') ? baseUrl : baseUrl + '/';
  const ver = import.meta.env.VITE_ASSET_VERSION || '';
  const qs = ver ? `?v=${ver}` : '';
  const src = `${safeBase}images/${folder}/${encodeURIComponent(filename)}${ext}${qs}`;
  const entries = widths.map(w => `${safeBase}images/resized/${folder}/${encodeURIComponent(filename)}.${w}.jpg${qs} ${w}w`);
  return {
    src,
    srcSet: entries.join(', '),
    sizes,
  };
}

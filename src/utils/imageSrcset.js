export const normalizeAssetBase = (baseUrl = '/') =>
  (baseUrl || '/').endsWith('/') ? baseUrl : `${baseUrl}/`;

const normalizeResizedImageFormat = (value = 'jpg') => {
  const normalized = String(value || 'jpg').replace(/^\./, '').toLowerCase();
  if (normalized === 'jpeg') return 'jpg';
  return normalized || 'jpg';
};

const JPG_ONLY_INSECT_IMAGE_NAMES = new Set([
  'Acronicta_alni',
  'Acropteris_iphiata',
  'Actebia_praecurrens',
  'Actias_aliena',
  'Albocosta_triangularis',
  'Ambulyx_ochracea',
  'Aromia_bungii',
  'Bhadorcosma_lonicerae',
  'Botyodes_principalis',
  'Cnephasia_stephensiana',
  'Cyrtoclytus_caproides',
  'Enarmonia_flammeata',
  'Epiblema_strenuana',
  'Epodonta_lineata',
  'Eugnathia_pulcherrima',
  'Eugoa_grisea',
  'Euplexia_angusta',
  'Gesonia_fallax',
  'Hedya_inouei',
  'Hypostrotia_cinerea',
  'Lamprodila_vivata',
  'Lethe_diana',
  'Lithophane_plumbeolimbata',
  'Lomaspilis_marginata',
  'Menophra_senilis',
  'Mythimna_flavostigma',
  'Neoanathamna_nipponica',
  'Pandemis_monticolana',
  'Polygonia_c',
  'Psacothea_hilaris',
  'Pygopteryx_suava',
  'Rusicada_leucolopha',
  'Xerodes_rufescentarius',
  'Xestia_fuscostigma',
  'Xestia_semiherbida',
  'Zizeeria_maha',
]);

const shouldUseJpgFallbackOnly = (folder, filename) =>
  folder === 'insects' && JPG_ONLY_INSECT_IMAGE_NAMES.has(filename);

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
  sourceFormats = ['avif', 'webp'],
}) {
  if (!filename) return { src: '', srcSet: '', sizes, sources: [] };
  const jpgFallbackOnly = shouldUseJpgFallbackOnly(folder, filename);
  const fallback = buildResponsiveSrcset({
    baseUrl,
    folder,
    filename,
    widths,
    sizes,
    query,
    format: 'jpg',
  });
  const formats = jpgFallbackOnly
    ? []
    : (Array.isArray(sourceFormats)
      ? Array.from(new Set(sourceFormats.map(normalizeResizedImageFormat)))
          .filter((format) => format && format !== 'jpg')
      : ['avif', 'webp']);
  return {
    ...fallback,
    sources: formats.map((type) => ({
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

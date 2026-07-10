import { isEnglishLocale } from './locale.js';

export const EN_SITE_NAME = 'Insects and Host Plants of Japan';

export const EN_TYPE_LABELS = Object.freeze({
  moth: 'Moth',
  butterfly: 'Butterfly',
  beetle: 'Jewel Beetle',
  longhornbeetle: 'Longhorn Beetle',
  barkbeetle: 'Bark Beetle',
  leafbeetle: 'Leaf Beetle',
  aphid: 'Aphid',
  plant: 'Plant',
});

export const EN_TYPE_PLURALS = Object.freeze({
  moth: 'Moths',
  butterfly: 'Butterflies',
  beetle: 'Jewel Beetles',
  longhornbeetle: 'Longhorn Beetles',
  barkbeetle: 'Bark Beetles',
  leafbeetle: 'Leaf Beetles',
  aphid: 'Aphids',
  plant: 'Plants',
});

export const ENGLISH_NAMING_NOTICE =
  'English common names are not assigned automatically on this site. Scientific names are used as the primary identifier when available, and Japanese names are shown only as local reference names.';

export function stripScientificAuthor(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return raw.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

export function slugifyScientificLabel(value = '') {
  const stripped = stripScientificAuthor(value);
  if (!stripped) return '';
  return stripped
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function getPrimaryEnglishName({
  scientificName = '',
  japaneseName = '',
  fallback = 'Unknown entry',
} = {}) {
  const scientific = String(scientificName || '').trim();
  const japanese = String(japaneseName || '').trim();
  if (scientific) return scientific;
  if (japanese) return japanese;
  return fallback;
}

export function buildJapaneseReferenceLabel(japaneseName = '') {
  const value = String(japaneseName || '').trim();
  return value ? `Japanese name: ${value}` : '';
}

export function getLocalizedTaxonomyLabel({
  locale = 'ja',
  japaneseName = '',
  scientificName = '',
  fallback = '',
} = {}) {
  const japanese = String(japaneseName || '').trim();
  const scientific = String(scientificName || '').trim();
  const fallbackValue = String(fallback || '').trim();
  if (isEnglishLocale(locale)) {
    return scientific || japanese || fallbackValue;
  }
  return japanese || scientific || fallbackValue;
}

export function buildLocalizedTaxonomyChip({
  locale = 'ja',
  japaneseName = '',
  scientificName = '',
  fallback = '',
} = {}) {
  const label = getLocalizedTaxonomyLabel({
    locale,
    japaneseName,
    scientificName,
    fallback,
  });
  const queryValue = isEnglishLocale(locale)
    ? String(scientificName || japaneseName || fallback || '').trim()
    : String(japaneseName || scientificName || fallback || '').trim();
  const referenceLabel =
    isEnglishLocale(locale) &&
    japaneseName &&
    label &&
    label !== String(japaneseName || '').trim()
      ? String(japaneseName || '').trim()
      : '';
  return { label, queryValue, referenceLabel };
}

export function joinLocalizedNameList(values = [], locale = 'ja') {
  const items = Array.isArray(values)
    ? values
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    : [];
  return items.join(isEnglishLocale(locale) ? ', ' : '、');
}

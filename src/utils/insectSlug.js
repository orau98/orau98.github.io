import { getCurrentLocale } from './locale';
import { getLocalizedInsectRouteBase } from './siteTaxonomy';

export const slugifyInsectName = (name = '') => {
  if (!name) return '';
  // encodeURIComponent handles most cases; normalize spaces just in case
  return encodeURIComponent(name.trim());
};

export const buildInsectPath = (insect, locale = getCurrentLocale()) => {
  if (!insect) {
    return locale === 'en' ? '/en/moth/unknown' : '/moth/unknown';
  }
  const base = getLocalizedInsectRouteBase(insect.type, 'moth', locale);
  const slug = slugifyInsectName(insect.name) || insect.id;
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  return `${normalizedBase}${slug}`;
};

export const decodeSlug = (slug = '') => {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
};

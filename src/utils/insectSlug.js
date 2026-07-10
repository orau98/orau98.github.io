import { getCurrentLocale } from './locale.js';
import { getLocalizedInsectRouteBase } from './siteTaxonomy.js';
import { decodeRouteParam } from './urlEncoding.js';

export const slugifyInsectName = (name = '') => {
  if (!name) return '';
  const normalizedName = String(name).trim();
  // A percent-encoded slash can still be decoded as a path separator by the
  // origin server. Use the stable insect id for malformed/source aliases that
  // contain URL path delimiters instead of creating an unreachable route.
  if (!normalizedName || /[/\\?#%]/.test(normalizedName)) return '';
  return encodeURIComponent(normalizedName);
};

export const isLikelyInsectId = (value = '') =>
  /^(species|catalog|moth|butterfly|butterfly-csv|beetle|longhornbeetle|barkbeetle|leafbeetle|aphid)[-_]?[a-z]*\d+[a-z]*$/i
    .test(String(value));

export const buildInsectPath = (insect, locale = getCurrentLocale()) => {
  if (!insect) {
    return locale === 'en' ? '/en/moth/unknown/' : '/moth/unknown/';
  }
  const base = getLocalizedInsectRouteBase(insect.type, 'moth', locale);
  const slug = slugifyInsectName(insect.routeName || insect.name) || insect.id;
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  // GitHub Pages redirects directory URLs without a final slash. Its raw
  // Japanese Location header can be interpreted as Latin-1 by Chrome, turning
  // アオアツバ into ã¢ãª.... Emit the final form and bypass that redirect.
  return `${normalizedBase}${slug}/`;
};

export const decodeSlug = (slug = '') => decodeRouteParam(slug);

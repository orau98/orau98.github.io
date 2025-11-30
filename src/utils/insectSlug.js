export const slugifyInsectName = (name = '') => {
  if (!name) return '';
  // encodeURIComponent handles most cases; normalize spaces just in case
  return encodeURIComponent(name.trim());
};

export const buildInsectPath = (insect) => {
  if (!insect) return '/moth/unknown';
  const base =
    insect.type === 'butterfly'
      ? '/butterfly/'
      : insect.type === 'beetle'
        ? '/beetle/'
        : insect.type === 'leafbeetle'
          ? '/leafbeetle/'
          : '/moth/';
  const slug = slugifyInsectName(insect.name) || insect.id;
  return `${base}${slug}`;
};

export const decodeSlug = (slug = '') => {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
};

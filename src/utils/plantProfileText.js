const CJK_CHAR = '一-龯ぁ-んァ-ヶ々〆〇';
const CJK_INTERNAL_SPACE_RE = new RegExp(`([${CJK_CHAR}])\\s+([${CJK_CHAR}])`, 'g');

export const normalizePlantProfileText = (value = '') => String(value || '')
  .replace(CJK_INTERNAL_SPACE_RE, '$1$2')
  .replace(/\s+([、。])/g, '$1')
  .trim();

const uniqueCleanValues = (values = []) => Array.from(new Set(
  values
    .map(normalizePlantProfileText)
    .filter(Boolean)
));

const normalizeSourceText = (value = '') => String(value || '')
  .replace(/\s+([、。])/g, '$1')
  .trim();

const ensureJapanesePeriod = (value = '') => {
  const text = String(value || '').replace(/\s+([、。])/g, '$1').trim();
  if (!text) return '';
  return /[。！？]$/.test(text) ? text : `${text}。`;
};

// 出典 + ページを 1 文字列に整形（HostPlantDetail の SourceCitation で使用）
export const buildSourceLabel = (profile = {}) => [
  normalizeSourceText(profile.source),
  profile.page ? `p.${normalizeSourceText(profile.page)}` : '',
].filter(Boolean).join(' ');

export const buildPlantProfileSummary = ({
  name = '',
  profile = null,
  family = '',
  genus = '',
  scientificName = '',
  isEnglish = false,
} = {}) => {
  if (!profile) return '';

  const plantName = normalizePlantProfileText(name);
  const familyName = normalizePlantProfileText(family);
  const habit = normalizePlantProfileText(profile.habit);
  const height = normalizePlantProfileText(profile.height);
  const flowerPeriod = normalizePlantProfileText(profile.flowerPeriod);
  const distribution = normalizePlantProfileText(profile.distribution);
  const habitat = normalizePlantProfileText(profile.habitat);
  const genusValues = uniqueCleanValues([profile.genusJp, genus]);
  const latinName = normalizePlantProfileText(scientificName);

  if (isEnglish) {
    const subject = plantName || 'This plant';
    const sentences = [];
    if (familyName || habit) {
      const classification = [
        familyName ? `family ${familyName}` : '',
        habit ? `habit ${habit}` : '',
      ].filter(Boolean).join(', ');
      sentences.push(`${subject} is recorded with ${classification}.`);
    }
    if (latinName) sentences.push(`Scientific name: ${latinName}.`);
    if (genusValues.length) sentences.push(`Genus: ${genusValues.join(' / ')}.`);
    if (height) sentences.push(`Size: ${height}.`);
    if (flowerPeriod) sentences.push(`Flowering: ${flowerPeriod}.`);
    if (habitat) sentences.push(`Habitat: ${habitat}.`);
    if (distribution) sentences.push(`Distribution: ${distribution}.`);
    return sentences.join(' ');
  }

  const sentences = [];
  if (plantName && (familyName || habit)) {
    const classification = `${familyName ? `${familyName}の` : ''}${habit || '植物'}`;
    sentences.push(`${plantName}は${classification}です。`);
  }
  if (latinName) sentences.push(`学名は${latinName}。`);
  if (genusValues.length) sentences.push(`属は${genusValues.join(' / ')}。`);
  if (height) sentences.push(`大きさは${height}。`);
  if (flowerPeriod) sentences.push(`花期は${flowerPeriod}。`);
  if (habitat) sentences.push(`生育環境は${habitat}。`);
  if (distribution) sentences.push(`分布は${distribution}。`);

  return sentences.map(ensureJapanesePeriod).join('');
};

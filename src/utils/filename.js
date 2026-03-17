// Filename and plant-name helpers shared across components

const hasJapaneseText = (value = '') => /[\u3040-\u30ff\u3400-\u9fff]/.test(String(value));

const normalizePlantImageName = (value = '') =>
  String(value)
    .replace(/＿/g, '_')
    .trim();

const SCIENTIFIC_RANK_TOKENS = new Set([
  'subsp',
  'ssp',
  'var',
  'subvar',
  'f',
  'fo',
  'forma',
  'nothosubsp',
  'nothovar',
  'grex',
  'cv',
  'x',
]);

// Remove family annotations and special characters to create a safe base filename
export const createSafePlantFilename = (plantName = '') => {
  try {
    let cleanedName = String(plantName)
      // remove family annotations like （○○科） and (○○科)
      .replace(/（[^）]*科[^）]*）/g, '')
      .replace(/\([^)]*科[^)]*\)/g, '')
      // remove any other parentheses content
      .replace(/（[^）]*）/g, '')
      .replace(/\([^)]*\)/g, '')
      // remove trailing '科'
      .replace(/科$/g, '')
      // strip non-word (keep latin/japanese chars and digits)
      .replace(/[^a-zA-Z0-9ぁ-んァ-ヶ一-龠]/g, '');
    return cleanedName;
  } catch {
    return String(plantName || '');
  }
};

export const createSafeScientificPlantFilename = (scientificName = '') => {
  const cleaned = String(scientificName || '')
    .replace(/\s*\(.*?(?:\)|\s*$)/g, ' ')
    .replace(/,/g, ' ')
    .replace(/×/g, ' x ')
    .replace(/\./g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';

  const tokens = cleaned
    .split(' ')
    .map((token) => token.replace(/[^A-Za-z0-9-]/g, ''))
    .filter(Boolean);

  const kept = [];
  for (const token of tokens) {
    if (kept.length === 0) {
      if (/^[A-Z][a-z0-9-]*$/.test(token)) {
        kept.push(token);
      }
      continue;
    }

    const lower = token.toLowerCase();
    if (SCIENTIFIC_RANK_TOKENS.has(lower)) {
      kept.push(lower);
      continue;
    }
    if (/^[a-z][a-z0-9-]*$/.test(token)) {
      kept.push(lower);
      continue;
    }
    if (/^[0-9]+$/.test(token)) {
      continue;
    }
    break;
  }

  return kept.join('_');
};

// Plant image suffixes with labels (shared ordering/priority)
export const PLANT_IMAGE_SUFFIXES = [
  { suffix: '_葉表', label: '葉表' },
  { suffix: '_葉', label: '葉' },
  { suffix: '_葉裏', label: '葉裏' },
  { suffix: '_ダニ室', label: 'ダニ室' },
  { suffix: '_葉表白化', label: '葉表白化' },
  { suffix: '_羽状複葉', label: '羽状複葉' },
  { suffix: '_樹皮', label: '樹皮' },
  { suffix: '_実', label: '実' },
  { suffix: '_果実', label: '果実' },
  { suffix: '_花', label: '花' },
  { suffix: '_蕾', label: '蕾' },
  { suffix: '_若葉', label: '若葉' },
  { suffix: '_冬芽', label: '冬芽' },
  { suffix: '_芽', label: '芽' },
  { suffix: '_茎', label: '茎' },
  { suffix: '_枝', label: '枝' },
  { suffix: '_枝先', label: '枝先' },
  { suffix: '_断面', label: '断面' },
];

const SORTED_PLANT_SUFFIX_LABELS = Array.from(
  new Set(PLANT_IMAGE_SUFFIXES.map(({ label }) => label).filter(Boolean)),
).sort((a, b) => b.length - a.length);

export const normalizePlantImageSuffix = (suffix = '') =>
  String(suffix || '')
    .replace(/^[＿_]+/, '')
    .replace(/＿/g, '_')
    .trim();

export const buildPlantImageFilename = (base = '', suffix = '') => {
  const normalizedBase = String(base || '').trim();
  if (!normalizedBase) return '';
  const normalizedSuffix = normalizePlantImageSuffix(suffix);
  return normalizedSuffix ? `${normalizedBase}_${normalizedSuffix}` : normalizedBase;
};

export const splitPlantImageBaseAndSuffix = (filename = '') => {
  const withoutExt = String(filename).replace(/\.[^.]+$/, '').trim();
  if (!withoutExt) return { base: '', suffix: '', suffixTokens: [] };

  const normalized = normalizePlantImageName(withoutExt);
  const tokens = normalized.split('_').filter(Boolean);

  if (tokens.length > 1) {
    if (hasJapaneseText(tokens[0])) {
      const suffixTokens = tokens.slice(1);
      return {
        base: tokens[0],
        suffix: suffixTokens.join('_'),
        suffixTokens,
      };
    }

    const firstJapaneseTokenIndex = tokens.findIndex(
      (token, index) => index > 0 && hasJapaneseText(token),
    );
    if (firstJapaneseTokenIndex > 0) {
      const suffixTokens = tokens.slice(firstJapaneseTokenIndex);
      return {
        base: tokens.slice(0, firstJapaneseTokenIndex).join('_'),
        suffix: suffixTokens.join('_'),
        suffixTokens,
      };
    }

    return { base: normalized, suffix: '', suffixTokens: [] };
  }

  const matchedLabel = SORTED_PLANT_SUFFIX_LABELS.find(
    (label) => withoutExt !== label && withoutExt.endsWith(label),
  );
  if (matchedLabel) {
    return {
      base: withoutExt.slice(0, -matchedLabel.length),
      suffix: matchedLabel,
      suffixTokens: [matchedLabel],
    };
  }

  return { base: withoutExt, suffix: '', suffixTokens: [] };
};

export const splitFilenameBase = (filename = '') =>
  splitPlantImageBaseAndSuffix(filename).base;

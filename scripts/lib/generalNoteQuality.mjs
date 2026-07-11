const JAPANESE_CHAR = '\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}々〆ヶ';

const SUBJECTIVE_PATTERNS = [
  {
    code: 'subjective_aesthetic',
    pattern: /美し|上品|品格|シブ(?:い|さ|く|め)|かっこ|格別|素晴らし|魅力|存在感|好感|良さ|よさ|良い蛾/,
  },
  {
    code: 'subjective_emotion',
    pattern: /幸福感|至福|うれし|嬉し|楽しい|感激|たまらない|残念|ドキドキ|憧れ|あこがれ/,
  },
  {
    code: 'collector_advice',
    pattern: /採りたい|採ってお|集めたい|並べたい|押さえたい|狙いたい|頑張りたい|選んで採集|頂戴/,
  },
  {
    code: 'collector_context',
    pattern: /初心者|玄人|蛾屋|冬夜蛾屋|一人前|コレクション|業界用語|珍品|大物|病状|触手/,
  },
];

const PAGE_OR_COLUMN_BLEED = /---\s*ページ|分布図|[［【]採集例[］】]|[［【]\s*(?:寄主植物|寄主|食草|寄生|分布|生態|成虫発生時期)\s*[］】]|よく似た種類の見分け方|近似種との区別点|本誌表紙|裏表紙の写真|[［【]\s*p\.\s*\d/i;
const SOURCE_COLUMN_PREFIX = /^(?:寄生|寄主植物|寄主|食草)\s*[:：]/;
const EDITORIAL_GUIDANCE = /幼生期(?:について|の形態)?は?，?[^。．]*に詳しい|(?:詳しくは|詳細は)[^。．]*(?:参照|を見よ)|[^。．]+を参照(?:されたい)?/;
const KNOWN_OCR_SEMANTIC_CORRUPTION = /年\s*\d+\s*円|止山治水|年間開して|深翅|前翅面をなかで/;
const BROKEN_MONTH_BLEED = /月\s*1月|月[.．]\\?寄|月\s*[、，]?\s*[［【]|[.．]\s*[［【]|月\s*・\s*$/;

const SOURCE_FAMILY_SCOPES = [
  {
    references: new Set(['日本産蝶類標準図鑑']),
    families: new Set(['Papilionidae', 'Pieridae', 'Lycaenidae', 'Riodinidae', 'Nymphalidae', 'Hesperiidae']),
  },
  { references: new Set(['日本原色アブラムシ図鑑']), families: new Set(['Aphididae']) },
  { references: new Set(['日本産カミキリムシ']), families: new Set(['Cerambycidae']) },
  { references: new Set(['日本産タマムシ大図鑑']), families: new Set(['Buprestidae']) },
  {
    references: new Set(['日本のハマキガ1', '日本のハマキガ2', '日本のハマキガ3']),
    families: new Set(['Tortricidae']),
  },
  { references: new Set(['日本の冬尺蛾']), families: new Set(['Geometridae']) },
];

const hasReversedLonghornMonthRange = (row, content) => {
  if (row?.reference !== '日本産カミキリムシ' || row?.note_type !== '出現時期') return false;
  const match = content.match(/(\d{1,2})\s*[〜～~]\s*(\d{1,2})\s*月/);
  if (!match) return false;
  const start = Number(match[1]);
  const end = Number(match[2]);
  return start >= 1 && start <= 12 && end >= 1 && end <= 12 && start > end;
};

export function normalizeOcrLayoutWhitespace(value) {
  return (value ?? '')
    .toString()
    .normalize('NFC')
    .replace(/\u3000/g, ' ')
    .replace(new RegExp(`(?<=[${JAPANESE_CHAR}])\\s+(?=[${JAPANESE_CHAR}])`, 'gu'), '')
    .replace(new RegExp(`(?<=[${JAPANESE_CHAR}])\\s+(?=\\d)`, 'gu'), '')
    .replace(new RegExp(`(?<=\\d)\\s+(?=[${JAPANESE_CHAR}])`, 'gu'), '')
    .replace(new RegExp(`(?<=[${JAPANESE_CHAR}])\\s+(?=[♀♂])`, 'gu'), '')
    .replace(new RegExp(`(?<=[♀♂])\\s+(?=[${JAPANESE_CHAR}])`, 'gu'), '')
    .replace(/(?<=\d)\s+(?=℃)/g, '')
    .replace(/(?<=[～〜~])\s+(?=\d)/g, '')
    .replace(/(?<=\d)\s+(?=[～〜~])/g, '')
    .replace(/\s+([。、，．！？）］】])/g, '$1')
    .replace(/([（［【])\s+/g, '$1')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

export function canonicalizeEcologyNoteType(value) {
  return value === '生態' ? '生態情報' : value;
}

export function collectLiteratureSourceTaxonIssues(reference, insectRow) {
  const source = (reference ?? '').toString().trim();
  const family = (insectRow?.family ?? '').toString().trim();
  const scope = SOURCE_FAMILY_SCOPES.find(candidate => candidate.references.has(source));
  if (!scope) return [];
  if (!family) return ['source_target_family_missing'];
  return scope.families.has(family) ? [] : ['source_target_family_mismatch'];
}

export function collectGeneralNoteIssues(row) {
  const content = (row?.content ?? '').toString().trim();
  const issues = [];

  if (normalizeOcrLayoutWhitespace(content) !== content) {
    issues.push('ocr_layout_gap');
  }
  if (PAGE_OR_COLUMN_BLEED.test(content)) {
    issues.push('page_or_column_bleed');
  }
  if (SOURCE_COLUMN_PREFIX.test(content)) {
    issues.push('source_column_prefix');
  }
  if (EDITORIAL_GUIDANCE.test(content)) {
    issues.push('editorial_guidance');
  }
  if (KNOWN_OCR_SEMANTIC_CORRUPTION.test(content)) {
    issues.push('known_ocr_semantic_corruption');
  }
  if (row?.note_type === '出現時期' && BROKEN_MONTH_BLEED.test(content)) {
    issues.push('broken_month_or_column_bleed');
  }
  if (hasReversedLonghornMonthRange(row, content)) {
    issues.push('reversed_longhorn_month_range');
  }
  SUBJECTIVE_PATTERNS.forEach(({ code, pattern }) => {
    if (pattern.test(content)) issues.push(code);
  });
  if (row?.note_type === '生態') {
    issues.push('legacy_note_type');
  }
  if (row?.note_type === '生態情報' && !(row?.page ?? '').toString().trim()) {
    issues.push('missing_source_page');
  }

  return [...new Set(issues)];
}

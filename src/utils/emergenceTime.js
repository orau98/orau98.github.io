const FULL_YEAR_MARKER = /一年中|1年中|周年|通年|年中/;
const EMERGENCE_HINT_PATTERN = /(成虫|出現|羽化|発生|得られ|見られ|採れ|採集|越冬|越年|春の蛾|夏の蛾|秋の蛾|冬の蛾|周年|通年|年中)/;
const FUZZY_SEASON_CUES = [
  { pattern: /(初春|早春)/, months: [2, 3] },
  { pattern: /(晩春)/, months: [4, 5] },
  { pattern: /(翌春|春にも|春まで|春ごろ|春頃|春先|春に|春の|春型|春季|春期|春)/, months: [3, 4, 5] },
  { pattern: /(初夏)/, months: [5, 6] },
  { pattern: /(盛夏)/, months: [7, 8] },
  { pattern: /(晩夏)/, months: [8, 9] },
  { pattern: /(翌夏|夏にも|夏まで|夏ごろ|夏頃|夏に|夏の|夏型|夏季|夏期|夏)/, months: [6, 7, 8] },
  { pattern: /(初秋)/, months: [9, 10] },
  { pattern: /(晩秋)/, months: [10, 11] },
  { pattern: /(翌秋|秋にも|秋まで|秋ごろ|秋頃|秋に|秋の|秋型|秋季|秋期|秋)/, months: [9, 10, 11] },
  { pattern: /(初冬|晩冬|真冬|厳冬)/, months: [12, 1, 2] },
  { pattern: /(翌冬|冬にも|冬まで|冬ごろ|冬頃|冬に|冬の|冬型|冬季|冬期)/, months: [12, 1, 2] }
];

const addMonthPeriods = (monthSet, periodSet, month) => {
  if (!(month >= 1 && month <= 12)) return;
  monthSet.add(month);
  for (let p = 1; p <= 3; p++) {
    periodSet.add(month + p * 0.1);
  }
};

const getNextMonth = (month) => (month === 12 ? 1 : month + 1);

const findNextTargetMonth = (anchorMonth, targetMonths = []) => {
  const targetSet = new Set((targetMonths || []).filter((month) => month >= 1 && month <= 12));
  if (!anchorMonth || targetSet.size === 0) return null;
  let month = getNextMonth(anchorMonth);
  for (let i = 0; i < 12; i++) {
    if (targetSet.has(month)) return month;
    month = getNextMonth(month);
  }
  return null;
};

const addBridgePeriodsUntilSeason = (monthSet, periodSet, anchorMonth, targetMonths = []) => {
  const targetMonth = findNextTargetMonth(anchorMonth, targetMonths);
  if (!targetMonth) return;
  let month = getNextMonth(anchorMonth);
  while (month !== targetMonth) {
    addMonthPeriods(monthSet, periodSet, month);
    month = getNextMonth(month);
  }
};

const extractMentionedMonths = (text = '') =>
  Array.from(text.matchAll(/(\d{1,2})月/g))
    .map((match) => parseInt(match[1], 10))
    .filter((month) => month >= 1 && month <= 12);

export const shouldAnalyzeEmergenceHint = (text = '', isPrimary = false) => {
  if (!text) return false;
  if (isPrimary) return true;
  return EMERGENCE_HINT_PATTERN.test(text);
};

const collectFuzzyEmergenceHints = (primaryText, supplementalTexts = [], anchorMonths = []) => {
  const fuzzyMonths = new Set();
  const fuzzyPeriods = new Set();
  const bridgedMonths = new Set();
  const bridgedPeriods = new Set();
  const texts = [primaryText, ...supplementalTexts]
    .map((text) => String(text || '').trim())
    .filter(Boolean);

  texts.forEach((text, index) => {
    const isPrimary = index === 0;
    if (!shouldAnalyzeEmergenceHint(text, isPrimary)) return;

    const matchedSeasonMonths = [];
    const cueText = extractMentionedMonths(text).length ? text.replace(/[春夏秋冬]型|越夏|夏眠/g, '') : text;
    FUZZY_SEASON_CUES.forEach(({ pattern, months }) => {
      if (pattern.test(cueText)) {
        matchedSeasonMonths.push(months);
        months.forEach((month) => addMonthPeriods(fuzzyMonths, fuzzyPeriods, month));
      }
    });

    const mentionedMonths = extractMentionedMonths(text);
    const anchorMonth = mentionedMonths.length > 0
      ? mentionedMonths[mentionedMonths.length - 1]
      : (anchorMonths.length > 0 ? anchorMonths[anchorMonths.length - 1] : null);

    if (anchorMonth && /(越冬|越年)/.test(text)) {
      matchedSeasonMonths.forEach((months) => {
        addBridgePeriodsUntilSeason(bridgedMonths, bridgedPeriods, anchorMonth, months);
      });
    }
  });

  return {
    months: Array.from(fuzzyMonths).sort((a, b) => a - b),
    periods: Array.from(fuzzyPeriods).sort((a, b) => a - b),
    bridgedMonths: Array.from(bridgedMonths).sort((a, b) => a - b),
    bridgedPeriods: Array.from(bridgedPeriods).sort((a, b) => a - b)
  };
};

const MONTH_NUMBER = String.raw`\d{1,2}`;
const RANGE_MARK = '[〜~－–—−-]';
const MONTH_LIST_ITEM = String.raw`${MONTH_NUMBER}(?:\s*${RANGE_MARK}\s*${MONTH_NUMBER})?`;
const ELIDED_MONTH_LIST = new RegExp(
  String.raw`(?<![\d.年])(?:${MONTH_LIST_ITEM}\s*[、,・]\s*)+${MONTH_LIST_ITEM}\s*月`,
  'g',
);
const PART = `(?:[上中下](?:[・、]?[上中下])?旬|初旬|初め|初|末|前半|後半|[上中下](?=\\s*(?:${RANGE_MARK}|[、,。]|$)))`;
const APPROXIMATE = '(?:頃|ごろ)?';
const DATE = String.raw`(?:${MONTH_NUMBER}\s*月?\s*${RANGE_MARK}\s*)?${MONTH_NUMBER}\s*月\s*(?:${PART})?\s*${APPROXIMATE}`;
const DATE_PREFIX = String.raw`(?<!\d)(?<!\d\.)`;
const NEXT_YEAR = '(?<nextYear>翌年?)?';
const APPEARANCE = '(?:羽化(?:脱出)?|出現|発生|現れ|あらわれ)';
const APPEARANCE_CLAUSE = '(?:(?:羽化(?:脱出)?|出現|発生)(?:し(?:て|始め)?|する)|(?:現れ|あらわれ)(?:て|る)?)';
const SCOPE = '(?:(?:地域によっては?|暖地では|寒冷地では|越冬後の)[、,]?)?';

const EXPLICIT_RANGE = new RegExp(
  String.raw`${DATE_PREFIX}(?<start>${DATE})\s*(?:に?${APPEARANCE})?\s*(?:${RANGE_MARK}|から|より)\s*${SCOPE}\s*${NEXT_YEAR}\s*(?<end>${DATE}|${PART})`,
  'g',
);
const CONTINUOUS_APPEARANCE = new RegExp(
  String.raw`${DATE_PREFIX}(?<start>${DATE})\s*(?:から|より|に)?\s*(?:成虫[がは])?${APPEARANCE_CLAUSE}\s*[、,]?\s*(?:(?:成虫(?:で|のまま))?越冬(?:して|し[、,]?))?\s*${SCOPE}\s*${NEXT_YEAR}\s*(?<end>${DATE})(?=\s*(?:まで|にかけて))`,
  'g',
);
const DATE_PARTS = new RegExp(
  String.raw`^(?:(${MONTH_NUMBER})\s*月?\s*${RANGE_MARK}\s*)?(${MONTH_NUMBER})\s*月\s*(${PART})?`,
);
const POINT_DATES = new RegExp(String.raw`${DATE_PREFIX}${DATE}`, 'g');
const UNPARSED_EXPLICIT_RANGE = new RegExp(
  String.raw`${DATE_PREFIX}${DATE}\s*(?:に?${APPEARANCE})?\s*${RANGE_MARK}[^、,。；;]{0,24}?${DATE}`,
  'g',
);
const NEGATED_APPEARANCE = /^\s*(?:頃|ごろ)?(?:までは?|には?|では?|は)?\s*(?:見られ|現れ|出現し|発生し|羽化し)な(?:い|かった)/;
const PEAK_DAY = /ピーク\s*(?:は|が|:)\s*\d{1,2}\s*月\s*\d{1,2}\s*日(?:前後|頃|ごろ|過ぎ)?(?=\s*(?:[、,)]|$))/g;

const KANJI_MONTHS = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];

function normalizeCalendarText(value) {
  return String(value ?? '').normalize('NFKC')
    .replace(/(?<![一二三四五六七八九十])(?:十[一二]?|[一二三四五六七八九])(?=\s*月)/g,
      (word) => String(KANJI_MONTHS.indexOf(word) + 1))
    // 末尾だけに「月」が付く列挙では、各項目に単位を補う。
    .replace(ELIDED_MONTH_LIST, (list, offset, text) => NEGATED_APPEARANCE.test(text.slice(offset + list.length))
      ? list
      : list.replace(/(\d)(?=\s*[、,・])/g, '$1月'));
}

export const hasCalendarMonth = (text) => /\d{1,2}\s*月/.test(normalizeCalendarText(text));

export const hasContinuousEmergenceRange = (text) => normalizeCalendarText(text).search(CONTINUOUS_APPEARANCE) !== -1;

function boundsOfPart(part) {
  if (!part) return [1, 3];
  if (/^初/.test(part)) return [1, 1];
  if (part === '末') return [3, 3];
  if (part === '前半') return [1, 2];
  if (part === '後半') return [2, 3];
  const parts = Array.from(part).filter((character) => '上中下'.includes(character))
    .map((character) => '上中下'.indexOf(character) + 1);
  return [parts[0], parts.at(-1)];
}

function readDate(date, defaultMonth) {
  const parsed = DATE_PARTS.exec(date);
  if (!parsed) return [defaultMonth, ...boundsOfPart(date), defaultMonth];
  const [, firstMonth, month, part] = parsed;
  return [Number(month), ...boundsOfPart(part), Number(firstMonth || month)];
}

function addDateRange(months, periods, firstMonth, firstPart, lastMonth, lastPart, nextYear) {
  if (firstMonth < 1 || firstMonth > 12 || lastMonth < 1 || lastMonth > 12) return;
  const first = (firstMonth - 1) * 3 + firstPart - 1;
  let last = (lastMonth - 1) * 3 + lastPart - 1;
  if (nextYear || firstMonth > lastMonth) last += 36;
  for (let index = first; index <= Math.min(last, first + 35); index++) {
    const month = Math.floor(index / 3) % 12 + 1;
    months.add(month);
    periods.add(month + (index % 3 + 1) * 0.1);
  }
}

function collectNumericPeriods(text, months, periods) {
  // 特定の日付で示されたピークを、発生月全体として扱わない。
  let remaining = text.replace(PEAK_DAY, '。');
  // 完結した期間を先に消費し、両端の月を単独月として再解釈しない。
  for (const pattern of [CONTINUOUS_APPEARANCE, EXPLICIT_RANGE]) {
    remaining = remaining.replace(pattern, (phrase, startText, nextYear, endText, offset, sentence) => {
      const [startMonth, startPart, , firstMonth] = readDate(startText);
      const [endMonth, , endPart] = readDate(endText, startMonth);
      if (!NEGATED_APPEARANCE.test(sentence.slice(offset + phrase.length))) {
        addDateRange(months, periods, firstMonth, firstMonth === startMonth ? startPart : 1,
          endMonth, endPart, nextYear);
      }
      // 文中の別の節を誤って接続しないよう消費済み範囲を区切る。
      return '。';
    });
  }
  // 明示的な範囲を読み取れない場合、両端を独立した観察月として描かない。
  remaining = remaining.replace(UNPARSED_EXPLICIT_RANGE, '。');
  for (const match of remaining.matchAll(POINT_DATES)) {
    const [month, firstPart, lastPart, firstMonth] = readDate(match[0]);
    if (!NEGATED_APPEARANCE.test(remaining.slice(match.index + match[0].length))) {
      addDateRange(months, periods, firstMonth, firstMonth === month ? firstPart : 1, month, lastPart, false);
    }
  }
}

function yearRoundCoverage(text) {
  let coverage = 'none';
  for (const sentence of text.split(/[。！？;\r\n]/)) {
    const marker = FULL_YEAR_MARKER.exec(sentence);
    if (!marker) continue;
    const before = sentence.slice(0, marker.index);
    const after = sentence.slice(marker.index + marker[0].length).split(/[、,（(]/, 1)[0];
    if (/経過|可能性|不明|かどうか|(?:発生|出現|見られ)(?:し)?ない/.test(after)
      || /を(?:除|のぞ)(?:き|く|いて)\s*[、,]?\s*(?:ほぼ)?\s*$/.test(before)) continue;
    if (!/ほぼ\s*$/.test(before)) return 'exact';
    coverage = 'broad';
  }
  return coverage;
}

const sorted = (values) => [...values].sort((a, b) => a - b);

export const hasEmergencePeriods = (emergenceTime, supplementalTexts = []) => {
  const parsed = parseEmergenceTime(emergenceTime, supplementalTexts);
  return parsed.periods.length > 0 || parsed.fuzzyPeriods.length > 0;
};

export const parseEmergenceTime = (emergenceTime, supplementalTexts = []) => {
  const primary = normalizeCalendarText(emergenceTime);
  const supplemental = (supplementalTexts || []).map(normalizeCalendarText);
  const months = new Set();
  const periods = new Set();
  const annual = [primary, ...supplemental].map(yearRoundCoverage);
  if (annual.includes('exact')) {
    addDateRange(months, periods, 1, 1, 12, 3, false);
  }
  for (const sentence of primary.split(/[。！？;\r\n]/)) collectNumericPeriods(sentence, months, periods);
  const fuzzy = collectFuzzyEmergenceHints(primary, supplemental, sorted(months));
  fuzzy.bridgedMonths.forEach((month) => months.add(month));
  fuzzy.bridgedPeriods.forEach((period) => periods.add(period));
  const fuzzyMonths = new Set(fuzzy.months);
  const fuzzyPeriods = new Set(fuzzy.periods);
  if (!annual.includes('exact') && annual.includes('broad')) {
    addDateRange(fuzzyMonths, fuzzyPeriods, 1, 1, 12, 3, false);
  }
  return { months: sorted(months), periods: sorted(periods), fuzzyMonths: sorted(fuzzyMonths), fuzzyPeriods: sorted(fuzzyPeriods) };
};

import { parseEmergenceTime } from './emergenceTime.js';
import { extractEmergenceTime, normalizeEmergenceTime } from './emergenceTimeUtils.js';

const ECOLOGY_TYPE = /^(生態情報|生態)$/;
const SEASON_TYPE = /出現|発生時期|羽化時期/;
const MONTH = /[0-9０-９]{1,2}\s*月/;
const SEASON = /[春夏秋冬](?:季|先|頃|の|に|から|まで|$)|周年|通年|年中/;
const ADULT_EVENT = /出現|発生|羽化|あらわれ|現れ|見られ|確認され|得られ/;
const GENERATIONS = /年[0-9０-９一二三四五数〜～~–-]+(?:化|回(?:発生)?)/;
const ECOLOGY = /幼虫|幼生|卵|蛹|越冬|越年|配偶|交尾|羽化後|飛翔|昼飛|夜行|活動|摂食|後食|食害|食性|寄主|食草|訪花|集ま|棲息|生息|分布|普通種|普通に産|スウィーピング/;
const DETAILED_RANGE = /^(.*?)(\d{1,2}月[上中下]旬)[〜～~-]\d{1,2}月[上中下]旬に出現し始め、(\d{1,2}月[上中下]旬)まで見られる$/;

const cleanText = (text) => String(text ?? '').trim();
const hasText = (text) => Boolean(text) && !/^(?:不明|[-–—])(?:。)?$/.test(text);
const seasonKey = (text) => text.normalize('NFKC')
  .replace(/[\s。；;]+/g, '')
  .replace(/[〜～~–－]/g, '-')
  .replace(/(\d)-(\d{1,2}月)/g, '$1月-$2')
  .replace(/^成虫(?:の発生時期|の出現時期|は)[:：]?/, '')
  .replace(/(?:に(?:発生|出現|羽化)する|に見られる|に現れる)$/, '');

function splitSentences(text) {
  return text.match(/[^。！？\r\n]+[。！？]?/g)?.map(cleanText).filter(Boolean) || [];
}

function splitAdultTimingClause(sentence) {
  if (!MONTH.test(sentence) && !SEASON.test(sentence)) return [sentence];
  // 「成虫は5月に発生し、モモなどを後食する」のように、日付と行動を別々に表示する。
  const match = /^(.*?)(出現し|発生し|羽化し|現れ|見られ|確認され)[、,，]\s*(.+)$/.exec(sentence);
  if (!match) return [sentence];
  const [, timing, verb, ecology] = match;
  if (ECOLOGY.test(timing) || !(MONTH.test(timing) || SEASON.test(timing)) || !ECOLOGY.test(ecology)) return [sentence];
  const ending = verb.endsWith('し') ? `${verb.slice(0, -1)}する` : `${verb}る`;
  return [`${timing}${ending}。`, ecology];
}

function isAdultTiming(sentence) {
  const text = sentence.replace(/[。！？]$/, '');
  if (ECOLOGY.test(text.replace(/越冬成虫/g, '成虫'))) return false;
  return GENERATIONS.test(text)
    || (/^(?:成虫(?:の)?(?:発生|出現)時期|発生時期|羽化時期)[:：]/.test(text))
    || ((MONTH.test(text) || SEASON.test(text)) && ADULT_EVENT.test(text));
}

function hasEcologyInsteadOfTiming(sentence) {
  return /幼虫|卵|蛹|配偶|産卵|後食|摂食|訪花|昼飛|飛翔|越冬する|越年する/.test(sentence)
    && !isAdultTiming(sentence)
    && !/(?:越冬成虫|成虫越冬).*(?:出現|見られ)|月[（(](?:新|越冬)成虫/.test(sentence);
}

function addSentence(records, sentence, source, group) {
  const key = seasonKey(sentence);
  const existing = records.get(key);
  if (existing) {
    if (source) existing.sources.add(source);
    return;
  }
  records.set(key, { text: sentence, sources: new Set(source ? [source] : []), group });
}

function groupSentences(records) {
  const groups = new Map();
  for (const { text, sources, group } of records.values()) {
    const notes = groups.get(group) || [];
    notes.push({ text, sources });
    groups.set(group, notes);
  }
  return Array.from(groups.values(), (notes) => ({
    content: notes.map(({ text }, index) =>
      index < notes.length - 1 && !/[。！？]$/.test(text) ? `${text}。` : text
    ).join(''),
    sources: [...new Set(notes.flatMap((note) => [...note.sources]))],
  }));
}

export function buildInsectDetailNotes(insect) {
  const period = new Map();
  const ecology = new Map();
  const notes = insect?.generalNotes || [];
  const showLegacySeason = ['moth', 'butterfly', 'leafbeetle'].includes(insect?.type);
  const seasonNotes = notes.filter((note) => SEASON_TYPE.test(cleanText(note.type)));

  function addSeasonRecord(content, source, group) {
    for (const sentence of splitSentences(content).flatMap(splitAdultTimingClause)) {
      if (!hasText(sentence)) continue;
      addSentence(hasEcologyInsteadOfTiming(sentence) ? ecology : period, sentence, source, group);
    }
  }

  // Prefer typed literature records. The other fields often contain copies of those records.
  if (seasonNotes.length) {
    for (const note of seasonNotes) {
      addSeasonRecord(cleanText(note.content), cleanText(note.reference), note);
    }
  } else if (insect?.emergenceTimeDetailed?.length) {
    for (const note of insect.emergenceTimeDetailed) {
      addSeasonRecord(cleanText(note.period), cleanText(note.source), note);
    }
  } else if (hasText(cleanText(insect?.emergenceTime))) {
    addSeasonRecord(cleanText(insect.emergenceTime), cleanText(insect.emergenceTimeSource), insect);
  }

  for (const note of notes) {
    const source = cleanText(note.reference);
    const content = cleanText(note.content);
    if (!ECOLOGY_TYPE.test(cleanText(note.type)) || !hasText(content)) continue;

    for (let sentence of splitSentences(content).flatMap(splitAdultTimingClause)) {
      const recorded = period.get(seasonKey(sentence));
      if (recorded || isAdultTiming(sentence)) {
        addSentence(period, sentence, source, note);
        continue;
      }

      // 開始時期を別に記録済みなら、昼飛性の説明から季節の修飾だけを除く。
      if ([...period.values()].some((record) => record.sources.has(source) && MONTH.test(record.text))) {
        sentence = sentence.replace(/^(?:典型的な)?(?:早|晩|初)?[春夏秋冬](?:に(?:出現する|現れる)|の)(?=昼飛性)/, '');
      }
      addSentence(ecology, sentence, source, note);
    }
  }

  if (!period.size && showLegacySeason) {
    const legacyText = [insect.notes, insect.type === 'butterfly' ? insect.geographicalRemarks : '']
      .map(cleanText).filter(Boolean).join('\n');
    const seasonalSentences = splitSentences(legacyText).filter(isAdultTiming);
    if (seasonalSentences.length) {
      addSeasonRecord(seasonalSentences.join('\n'), cleanText(insect.source), insect);
    } else if (/(?:成虫の?)?(?:発生|出現|羽化)時期[:：]/.test(legacyText)) {
      const { emergenceTime } = extractEmergenceTime(legacyText.replace(/：/g, ':'));
      addSeasonRecord(normalizeEmergenceTime(emergenceTime), cleanText(insect.source), insect);
    }
  }

  // A concise range and a statement of its first and last sightings can describe the same span.
  // Use the more precise statement only when the locality wording and source agree.
  for (const record of period.values()) {
    const detailedRange = DETAILED_RANGE.exec(seasonKey(record.text));
    if (!detailedRange) continue;
    const [, locality, start, end] = detailedRange;
    const simpleKey = `${locality}${start}-${end}`;
    const simple = period.get(simpleKey);
    if (simple && [...simple.sources].every((source) => record.sources.has(source))) {
      period.set(simpleKey, { ...record, group: simple.group });
      period.delete(seasonKey(record.text));
    }
  }

  const seasonRecords = groupSentences(period);
  return {
    showSeason: seasonRecords.length > 0 || (showLegacySeason && seasonNotes.length > 0),
    seasonTexts: seasonRecords.map((record) => record.content),
    seasonSources: [...new Set(seasonRecords.flatMap((record) => record.sources))],
    ecologyNotes: groupSentences(ecology),
  };
}

export function parseInsectDetailSeason(seasonTexts) {
  // Parse each sentence separately to avoid filling gaps between distinct regional records.
  const records = seasonTexts.flatMap((text) => splitSentences(text).map((sentence) => {
    const plotText = sentence.replace(/。$/, '').replace(DETAILED_RANGE, '$1$2〜$3');
    return parseEmergenceTime(plotText);
  }));
  const collect = (key) => [...new Set(records.flatMap((record) => record[key]))];
  const months = collect('months');
  const periods = collect('periods');
  return {
    months,
    periods,
    fuzzyMonths: collect('fuzzyMonths').filter((month) => !months.includes(month)),
    fuzzyPeriods: collect('fuzzyPeriods').filter((period) => !periods.includes(period)),
  };
}

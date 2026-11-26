import { parseEmergenceTime } from './emergenceTime.js';
import { extractEmergenceTime, normalizeEmergenceTime } from './emergenceTimeUtils.js';

const ECOLOGY_TYPE = /^(生態情報|生態)$/;
const SEASON_TYPE = /出現|発生時期|羽化時期/;
const MONTH = /[0-9０-９]{1,2}\s*月/;
const SEASON = /(?:早|晩|初)?[春夏秋冬](?:季|期|先|頃|の|に|から|まで|[、。]|$)|周年|通年|年中/;
const ADULT_EVENT = /出現|発生|羽化|あらわれ|現れ|見られ|確認され|得られ|採集され|観察され/;
const IMMATURE_OR_CAPTIVE = /幼虫|幼生|幼体|若虫|幼若|卵|蛹|飼育|室内|実験|加温|低温処理|温室/;
const ECOLOGY = /越冬|越年|配偶|交尾|産卵|羽化後|飛翔|昼飛|夜行|活動|摂食|後食|食害|食性|食葉|広食|加害|大発生|多発生|越夏|休眠|割り出|材から|寄主|食草|訪花|集ま|棲息|生息|分布|普通種|普通に産|スウィーピング|灯火|飛来/;
const INDIVIDUAL_RECORD = /\d{4}年\s*\d{1,2}月|[0-9０-９一二三]\s*(?:♂|♀|頭|個体|例のみ)|(?:♂|♀)\s*[0-9０-９一二三]/;
const DETAILED_RANGE = /^(.*?)(\d{1,2}月[上中下]旬)[〜～~-]\d{1,2}月[上中下]旬に出現し始め、(\d{1,2}月[上中下]旬)まで見られる$/;

const cleanText = (text) => String(text ?? '').trim();
const hasText = (text) => Boolean(text) && !/^(?:不明|[-–—])(?:。)?$/.test(text);
const seasonKey = (text) => text.normalize('NFKC')
  .replace(/[\s。；;]+/g, '')
  .replace(/[〜～~–－]/g, '-')
  .replace(/(\d)-(\d{1,2}月)/g, '$1月-$2')
  .replace(/^成虫(?:の発生時期|の出現時期|は)[:：]?/, '')
  .replace(/(?:に(?:発生|出現|羽化)する|に見られる|に(?:あらわれ|現れ)る)$/, '');

function splitSentences(text) {
  return text.match(/[^。！？\r\n]+[。！？]?/g)?.map(cleanText).filter(Boolean) || [];
}

const hasSeason = (text) => MONTH.test(text) || SEASON.test(text);
const ADULT_SEASON_LABEL = /成虫(?:の)?(?:活動|発生|出現|羽化)(?:時期|期)/;
const OCR_RANGE = /[0-9０-９]\s*[一ー]\s*[0-9０-９]\s*月/;

function splitAdultTimingClause(sentence) {
  if (!hasSeason(sentence)) return [sentence];
  // つなぎを終止形に戻し、同じ文の後食・訪花などを生態欄へ残す。
  const match = /^(.*?)(出現して?|発生して?|羽化(?:脱出)?して?|あらわれて?|現れて?|見られて?|確認されて?|得られて?|観察されて?|採集されて?)[、,，]\s*(.+)$/.exec(sentence);
  if (!match) return [sentence];
  const [, timing, verb, ecology] = match;
  if (!hasSeason(timing) || IMMATURE_OR_CAPTIVE.test(timing) || ECOLOGY.test(timing.replace(/越冬成虫/g, '成虫'))
    || !ECOLOGY.test(ecology) && !IMMATURE_OR_CAPTIVE.test(ecology)) return [sentence];
  // 後続節が別地域・別世代の成虫期を含む場合は一方だけを切り出さない。
  if (hasSeason(ecology) && ADULT_EVENT.test(ecology) && !IMMATURE_OR_CAPTIVE.test(ecology)) return [sentence];
  const base = verb.replace(/て$/, '');
  const ending = base.endsWith('し') ? base.slice(0, -1) + 'する' : base + 'る';
  return [timing + ending + '。', ecology];
}

function isAdultTiming(sentence) {
  const text = sentence.replace(/[。！？]$/, '');
  // 飼育羽化、幼生の季節、単発の採集を野外での一般的な成虫期と混同しない。
  if (IMMATURE_OR_CAPTIVE.test(text) || INDIVIDUAL_RECORD.test(text) || OCR_RANGE.test(text)
    || ECOLOGY.test(text.replace(/越冬成虫/g, '成虫').replace(ADULT_SEASON_LABEL, ''))) return false;
  return hasSeason(text) && (ADULT_EVENT.test(text) || ADULT_SEASON_LABEL.test(text));
}

export function splitEcologyOccurrence(value) {
  const occurrence = [];
  const ecology = [];
  for (const sentence of splitSentences(cleanText(value)).flatMap(splitAdultTimingClause)) {
    if (!hasText(sentence)) continue;
    (isAdultTiming(sentence) ? occurrence : ecology).push(sentence);
  }
  return { occurrence, ecology };
}

function hasEcologyInsteadOfTiming(sentence) {
  return /幼虫|卵|蛹|配偶|産卵|後食|摂食|訪花|昼飛|飛翔|越冬する|越年する/.test(sentence)
    && !isAdultTiming(sentence)
    && !/(?:越冬成虫|成虫越冬).*(?:出現|見られ)|月[（(](?:新|越冬)成虫/.test(sentence);
}

function addSentence(records, sentence, source, group) {
  const key = seasonKey(sentence);
  const page = cleanText(group?.page);
  const citation = source && /^[0-9０-９]/.test(page) && !/[;；]/.test(source)
    ? `${source} p. ${page.replace(/[;；]/g, '・')}`
    : source;
  const existing = records.get(key);
  if (existing) {
    if (source) existing.sources.add(source);
    if (citation) existing.citations.add(citation);
    return;
  }
  records.set(key, {
    text: sentence,
    sources: new Set(source ? [source] : []),
    citations: new Set(citation ? [citation] : []),
    group,
  });
}

function groupSentences(records) {
  const groups = new Map();
  for (const { text, citations, group } of records.values()) {
    const notes = groups.get(group) || [];
    notes.push({ text, citations });
    groups.set(group, notes);
  }
  const rows = [];
  for (const notes of groups.values()) {
    let row;
    for (const { text, citations } of notes) {
      if (row && row.sources.length === citations.size && row.sources.every((source) => citations.has(source))) {
        row.content += /[。！？]$/.test(row.content) ? text : `。${text}`;
      } else {
        row = { content: text, sources: [...citations] };
        rows.push(row);
      }
    }
  }
  return rows;
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
    if (!ECOLOGY_TYPE.test(cleanText(note.type))) continue;
    const source = cleanText(note.reference);
    const mixed = splitEcologyOccurrence(note.content);
    for (const sentence of mixed.occurrence) addSentence(period, sentence, source, note);

    for (let sentence of mixed.ecology) {
      if (period.has(seasonKey(sentence))) {
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
      period.set(simpleKey, {
        ...record,
        citations: new Set([...simple.citations, ...record.citations]),
        group: simple.group,
      });
      period.delete(seasonKey(record.text));
    }
  }

  const seasonRecords = groupSentences(period);
  return {
    showSeason: seasonRecords.length > 0 || (showLegacySeason && seasonNotes.length > 0),
    seasonRecords,
    ecologyNotes: groupSentences(ecology),
  };
}

export function parseInsectDetailSeason(seasonTexts) {
  // 表示文の国外・飼育・個別採集記録は残し、野外の国内成虫期の図には加えない。
  const overseas = /(?:外国|国外|海外|ヨーロッパ|欧州|台湾|中国|韓国|朝鮮半島|ロシア|北米|オーストラリア)(?:では|での|において|の記録)/;
  const records = seasonTexts.flatMap((text) => splitSentences(text).flatMap((sentence) => {
    const overseasAt = sentence.search(overseas);
    const domestic = overseasAt < 0 ? sentence : sentence.slice(0, overseasAt);
    const plotText = domestic.replace(/[。、，]$/, '').replace(DETAILED_RANGE, '$1$2〜$3');
    if (!hasSeason(plotText) || IMMATURE_OR_CAPTIVE.test(plotText) || INDIVIDUAL_RECORD.test(plotText)
      || /偶産(?:種)?(?:と考え|と思われ|の記録)/.test(plotText)) return [];
    return [parseEmergenceTime(plotText)];
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

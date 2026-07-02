import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowPathIcon,
  ArrowRightIcon,
  BoltIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  FireIcon,
  TrophyIcon,
  XCircleIcon,
} from '@heroicons/react/24/solid';
import { Link, useSearchParams } from 'react-router-dom';
import ImageWithFallback from './components/ImageWithFallback';
import SourceCitation from './components/ui/SourceCitation';
import useInsectImageCandidates from './hooks/useInsectImageCandidates';
import useSeoMeta from './hooks/useSeoMeta';
import { loadInsectImageIndexes, loadPlantImageFilenames } from './services/imageIndex';
import {
  DEFAULT_QUIZ_LENGTH,
  QUIZ_MODES,
  buildQuizQuestions,
  getQuizHostPlantRecords,
  isCorrectAnswer,
  normalizePlantNameForQuiz,
  normalizeQuizMode,
} from './utils/quiz';
import {
  buildPlantImageFilename,
  createSafePlantFilename,
  createSafeScientificPlantFilename,
  splitFilenameBase,
} from './utils/filename';
import { buildResponsivePicture } from './utils/imageSrcset';
import { buildInsectPath } from './utils/insectSlug';
import { isEnglishLocale, localizePath } from './utils/locale';
import { absUrl } from './utils/origin';
import { buildPlantPath } from './utils/siteTaxonomy';
import { formatScientificNameReact } from './utils/scientificNameFormatter.jsx';

const REVIEW_LIMIT = 48;
const DAY_MS = 24 * 60 * 60 * 1000;
const EMPTY_INSECT_IMAGE_INDEX = Object.freeze({ names: new Set(), exts: {}, ready: false });
const QUIZ_STYLES = Object.freeze({
  GUIDED: 'guided',
  PHOTO: 'photo',
});

const normalizeInsectImageIndex = ({ names, exts } = {}, ready = true) => ({
  names: new Set(names || []),
  exts: exts || {},
  ready,
});

const getBestStorageKey = (locale, mode) => `ihpe-quiz-best:v1:${locale}:${mode}`;
const getReviewStorageKey = (locale, mode) => `ihpe-quiz-review:v1:${locale}:${mode}`;

const normalizeQuizStyle = (style) =>
  style === QUIZ_STYLES.PHOTO || style === QUIZ_STYLES.GUIDED
    ? style
    : QUIZ_STYLES.GUIDED;

const safeReadJson = (key, fallback) => {
  try {
    if (typeof window === 'undefined') return fallback;
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const safeWriteJson = (key, value) => {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {}
};

const normalizeReviewEntries = (entries = []) => (
  Array.isArray(entries)
    ? entries
        .filter((entry) => entry?.key)
        .map((entry) => {
          const misses = Number(entry.misses || 0);
          const lastSeen = Number(entry.lastSeen || 0);
          const intervalDays = Math.max(0, Number(entry.intervalDays || 0));
          const legacyDueAt = misses > 0 ? lastSeen : lastSeen + DAY_MS;
          return {
            key: entry.key,
            misses,
            correct: Number(entry.correct || 0),
            intervalDays,
            dueAt: Number(entry.dueAt || legacyDueAt || 0),
            lastSeen,
            lastResult: entry.lastResult || (misses > 0 ? 'missed' : 'correct'),
          };
        })
    : []
);

const getDueReviewEntries = (locale, mode, now = Date.now()) =>
  normalizeReviewEntries(safeReadJson(getReviewStorageKey(locale, mode), []))
    .filter((entry) => entry.dueAt <= now)
    .sort((a, b) => a.dueAt - b.dueAt || b.misses - a.misses || a.lastSeen - b.lastSeen);

const updateReviewEntries = ({ previous = [], answers = [] }) => {
  const map = new Map(
    normalizeReviewEntries(previous)
      .map((entry) => [entry.key, entry]),
  );
  const now = Date.now();

  answers.forEach((answer) => {
    if (!answer?.reviewKey) return;
    const current = map.get(answer.reviewKey) || {
      key: answer.reviewKey,
      misses: 0,
      correct: 0,
      intervalDays: 0,
      dueAt: now,
      lastSeen: 0,
      lastResult: '',
    };
    if (answer.isCorrect) {
      const nextIntervalDays = current.lastResult === 'missed'
        ? 1
        : Math.min(30, Math.max(1, Math.round((current.intervalDays || 0.5) * 2)));
      map.set(answer.reviewKey, {
        ...current,
        correct: current.correct + 1,
        intervalDays: nextIntervalDays,
        dueAt: now + nextIntervalDays * DAY_MS,
        lastSeen: now,
        lastResult: 'correct',
      });
      return;
    }
    map.set(answer.reviewKey, {
      ...current,
      key: answer.reviewKey,
      misses: current.misses + 1,
      correct: 0,
      intervalDays: 0,
      dueAt: now,
      lastSeen: now,
      lastResult: 'missed',
    });
  });

  return Array.from(map.values())
    .sort((a, b) => a.dueAt - b.dueAt || b.misses - a.misses || b.lastSeen - a.lastSeen)
    .slice(0, REVIEW_LIMIT);
};

const modeLabels = {
  ja: {
    [QUIZ_MODES.INSECT_TO_PLANT]: '昆虫→食草',
    [QUIZ_MODES.PLANT_TO_INSECT]: '食草→昆虫',
  },
  en: {
    [QUIZ_MODES.INSECT_TO_PLANT]: 'Insect to host plant',
    [QUIZ_MODES.PLANT_TO_INSECT]: 'Host plant to insect',
  },
};

const optionNumbers = ['1', '2', '3', '4'];

const labelsFor = (isEnglish) => ({
  title: isEnglish ? 'Four-Choice Host Plant Quiz' : '昆虫と食草の4択図鑑',
  subtitle: isEnglish
    ? 'A ten-question game for learning moth and butterfly host-plant links.'
    : '蛾・蝶と幼虫食草のつながりを10問で覚える学習ゲーム。',
  today: isEnglish ? "Today's 10" : '今日の10問',
  todayLead: isEnglish ? 'Start with the next useful set. Review appears only when it is due.' : '次に覚えるべき10問だけを出します。復習は必要な時だけ混ざります。',
  settings: isEnglish ? 'Question settings' : '出題設定',
  reviewDue: isEnglish ? 'Due now' : '今日の復習',
  answered: isEnglish ? 'Answered' : '回答済み',
  stageChoose: isEnglish ? 'Choose one answer' : '1つ選択',
  stageCheck: isEnglish ? 'Check the link' : '答え合わせ',
  start: isEnglish ? 'Start 10 questions' : '10問を始める',
  starting: isEnglish ? 'Preparing the first question...' : '最初の問題を準備中…',
  startStages: {
    images: isEnglish ? 'Checking photo indexes...' : '写真索引を確認中…',
    questions: isEnglish ? 'Selecting today’s questions...' : '今日の10問を選定中…',
  },
  restart: isEnglish ? 'Try again' : 'もう一度挑戦',
  nextSession: isEnglish ? 'Next useful 10' : '次の10問へ',
  next: isEnglish ? 'Next question' : '次の問題',
  result: isEnglish ? 'Session result' : '結果',
  score: isEnglish ? 'Score' : '正答',
  streak: isEnglish ? 'Streak' : '連続正解',
  best: isEnglish ? 'Best' : '自己ベスト',
  review: isEnglish ? 'Review list' : '復習候補',
  noReview: isEnglish ? 'No missed questions this round.' : '今回の復習候補はありません。',
  weakPoints: isEnglish ? 'Next focus' : '次に覚えるポイント',
  noWeakPoints: isEnglish ? 'No weak point stood out in this round.' : 'この回で目立った弱点はありません。',
  reviewTop: isEnglish ? 'Review these first' : 'まず復習する3問',
  source: isEnglish ? 'Source' : '出典',
  details: isEnglish ? 'Show details' : '詳しい記録を見る',
  hideDetails: isEnglish ? 'Hide details' : '詳細を閉じる',
  correct: isEnglish ? 'Correct' : '正解',
  incorrect: isEnglish ? 'Review this one' : '復習しよう',
  correctPair: isEnglish ? 'Correct link' : '正しいつながり',
  yourChoice: isEnglish ? 'Your choice' : '選んだ答え',
  learningPoint: isEnglish ? 'Learning point' : '覚えるポイント',
  comparePhotos: isEnglish ? 'Photo comparison' : '写真で確認',
  loading: isEnglish ? 'Preparing quiz data...' : 'クイズデータを準備しています…',
  notReady: isEnglish
    ? 'Quiz data is still loading. Please try again in a moment.'
    : 'クイズに使うデータを読み込み中です。少し待ってから始めてください。',
  halfway: isEnglish ? 'Halfway. Keep the rhythm.' : '半分到達。いいテンポです。',
  finish: isEnglish ? 'Last question complete.' : '10問完了です。',
  keyboard: isEnglish ? 'Keys 1-4 answer, Enter advances.' : '1〜4で回答、Enterで次へ進めます。',
  mode: isEnglish ? 'Mode' : 'モード',
  style: isEnglish ? 'Style' : '表示',
  guidedStyle: isEnglish ? 'Guided' : '標準',
  photoStyle: isEnglish ? 'Photo ID' : '写真識別',
  guidedStyleDesc: isEnglish ? 'Balanced photo and text practice.' : '写真と文字をバランスよく確認します。',
  photoStyleDesc: isEnglish ? 'Larger photos and shorter choices for visual identification.' : '写真を大きく見せ、候補を短く並べます。',
  session: isEnglish ? 'Session' : 'セッション',
  insectPrompt: isEnglish ? 'Choose the larval host plant.' : 'この昆虫の幼虫食草を選んでください。',
  plantPrompt: isEnglish ? 'Choose the insect linked to this host plant.' : 'この植物を食草にする昆虫を選んでください。',
  openInsect: isEnglish ? 'Open insect page' : '昆虫ページへ',
  openPlant: isEnglish ? 'Open plant page' : '植物ページへ',
  home: isEnglish ? 'Back to explorer' : '図鑑へ戻る',
  focused: isEnglish ? 'Focused from detail page' : '詳細ページから優先出題',
});

const summarizeBest = (best, isEnglish) => {
  const score = Number(best?.score || 0);
  const streak = Number(best?.bestStreak || 0);
  return isEnglish
    ? `${score}/${DEFAULT_QUIZ_LENGTH}, streak ${streak}`
    : `${DEFAULT_QUIZ_LENGTH}問中${score}問・連続${streak}問`;
};

const getPlantRankLabel = (rank, isEnglish) => {
  const labels = {
    species: isEnglish ? 'species-level plant' : '種レベルの植物',
    genus: isEnglish ? 'genus-level plant' : '属レベルの植物',
    family: isEnglish ? 'plant family' : '科レベルの植物',
    group: isEnglish ? 'plant group' : '植物グループ',
  };
  return labels[rank] || (isEnglish ? 'host plant' : '食草');
};

const getInsectFamily = (insect = {}) =>
  insect.classification?.familyJapanese || insect.classification?.family || insect.family || '';

const buildCorrectLinkLabel = (question, isEnglish) => {
  const insectName = question.explanation?.insect?.name || question.prompt?.title || '';
  const plantName = question.explanation?.plant?.name || question.explanation?.correctLabel || '';
  return isEnglish ? `${insectName} - ${plantName}` : `${insectName} → ${plantName}`;
};

const buildLearningPoint = ({ question, selectedOption, correctOption, isEnglish }) => {
  if (!question || !correctOption) return '';
  if (question.mode === QUIZ_MODES.INSECT_TO_PLANT) {
    const rankLabel = getPlantRankLabel(correctOption.taxonRank, isEnglish);
    const family = correctOption.family || question.explanation?.plant?.family || '';
    const correctGroup = family || correctOption.label;
    if (selectedOption && selectedOption.id !== correctOption.id) {
      if (family && selectedOption.family === family) {
        return isEnglish
          ? `Both choices are in ${family}. Use the exact host-plant name after checking the family.`
          : `選んだ候補も${family}です。まず科をそろえた上で、正確な食草名を見分ける問題です。`;
      }
      return isEnglish
        ? `This is a ${rankLabel} question. The correct answer is ${correctGroup}.`
        : `これは${rankLabel}を選ぶ問題です。正解は${correctGroup}です。`;
    }
    return isEnglish
      ? `You matched the insect to the recorded ${rankLabel}${family ? ` in ${family}` : ''}.`
      : `${rankLabel}${family ? `（${family}）` : ''}として記録された食草を選べています。`;
  }

  const insectFamily = getInsectFamily(question.explanation?.insect);
  if (selectedOption && selectedOption.id !== correctOption.id) {
    if (insectFamily && selectedOption.family === insectFamily) {
      return isEnglish
        ? `Both insects are in ${insectFamily}. The useful cue is the exact host-plant link.`
        : `選んだ昆虫も${insectFamily}です。科だけでなく、この植物との食草関係で見分けます。`;
    }
    return isEnglish
      ? `The recorded insect is in ${insectFamily || 'the linked moth/butterfly group'}.`
      : `この植物に記録されている昆虫は${insectFamily || '関連する蛾・蝶のグループ'}です。`;
  }
  return isEnglish
    ? `You matched the plant to the linked insect${insectFamily ? ` in ${insectFamily}` : ''}.`
    : `この植物と結びつく昆虫${insectFamily ? `（${insectFamily}）` : ''}を選べています。`;
};

const countBy = (items, getKey) => {
  const map = new Map();
  items.forEach((item) => {
    const key = getKey(item);
    if (!key) return;
    map.set(key, (map.get(key) || 0) + 1);
  });
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ja'))
    .map(([label, count]) => ({ label, count }));
};

const buildWeaknessItems = (missedAnswers, isEnglish) => {
  const plantFamilies = countBy(
    missedAnswers,
    (answer) => answer.question?.explanation?.plant?.family || answer.question?.options?.find((option) => option.id === answer.correctOptionId)?.family,
  );
  const insectFamilies = countBy(
    missedAnswers,
    (answer) => getInsectFamily(answer.question?.explanation?.insect),
  );
  const ranks = countBy(
    missedAnswers,
    (answer) => getPlantRankLabel(answer.question?.explanation?.plant?.taxonRank, isEnglish),
  );
  return [
    ...plantFamilies.slice(0, 1).map((item) => ({
      ...item,
      label: isEnglish ? `Host plants in ${item.label}` : `${item.label}の食草`,
    })),
    ...insectFamilies.slice(0, 1).map((item) => ({
      ...item,
      label: isEnglish ? `Insects in ${item.label}` : `${item.label}の昆虫`,
    })),
    ...ranks.slice(0, 1),
  ].slice(0, 3);
};

const resolvePlantImageFilename = ({ plantName, plantDetails = {}, plantImageFilenames = [] }) => {
  const detail = plantDetails[plantName] || {};
  const baseCandidates = [
    createSafePlantFilename(plantName),
    createSafeScientificPlantFilename(detail.scientificName),
    plantName,
  ].filter(Boolean);
  const preferredSuffixes = ['', '葉表', '葉', '葉裏', '花', '実', '樹皮'];
  const filenameSet = new Set(plantImageFilenames);

  for (const base of baseCandidates) {
    for (const suffix of preferredSuffixes) {
      const candidate = buildPlantImageFilename(base, suffix);
      if (filenameSet.has(candidate)) return candidate;
    }
  }

  for (const base of baseCandidates) {
    const match = plantImageFilenames.find((filename) => {
      const splitBase = splitFilenameBase(filename);
      return splitBase === base || filename === base || filename.startsWith(`${base}_`);
    });
    if (match) return match;
  }
  return '';
};

const PlantMedia = ({ plantName, plantDetails, plantImageFilenames, isEnglish, variant = 'default' }) => {
  const filename = resolvePlantImageFilename({ plantName, plantDetails, plantImageFilenames });
  const baseUrl = import.meta.env.BASE_URL || '/';
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const encodedFilename = filename ? encodeURIComponent(filename) : '';
  const originalCandidates = filename
    ? ['jpg', 'JPG', 'jpeg', 'JPEG', 'png', 'PNG'].map(
        (ext) => `${normalizedBase}images/plants/${encodedFilename}.${ext}`,
      )
    : [];
  const picture = filename
    ? buildResponsivePicture({
        baseUrl: normalizedBase,
        folder: 'plants',
        filename,
        widths: [320, 640, 1024],
        sizes: '(max-width: 768px) 100vw, 42vw',
        sourceFormats: ['webp'],
      })
    : null;
  const fallbackCandidates = filename
    ? Array.from(new Set([
        picture?.src,
        ...originalCandidates,
      ].filter(Boolean)))
    : [];

  return (
    <div className={`relative overflow-hidden rounded-lg bg-emerald-100 dark:bg-emerald-950/60 ${
      variant === 'photo' ? 'aspect-[16/10] lg:aspect-[4/3]' : 'aspect-[4/3]'
    }`}
    >
      {filename ? (
        <ImageWithFallback
          src={picture.src || originalCandidates[0]}
          candidates={fallbackCandidates}
          alt={isEnglish ? `${plantName} photograph` : `${plantName}の写真`}
          width="800"
          height="600"
          className="h-full w-full"
          imgClassName="object-center"
          fit="cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-emerald-700 dark:text-emerald-200">
          <svg className="h-20 w-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M12 22c-4.97 0-9-4.03-9-9 0-4.97 4.03-9 9-9 1.73 0 3.35.49 4.72 1.34C15.25 4.47 13.68 4 12 4c-3.87 0-7 3.13-7 7 0 3.87 3.13 7 7 7 1.98 0 3.77-.83 5.04-2.16A8.96 8.96 0 0 1 12 22z" />
          </svg>
        </div>
      )}
    </div>
  );
};

const InsectMedia = ({ insect, isEnglish, variant = 'default' }) => {
  const { getImageCandidates, placeholderSrc } = useInsectImageCandidates({ useAssetVersionInProd: true });
  const candidates = useMemo(() => getImageCandidates(insect), [getImageCandidates, insect]);
  return (
    <div className={`relative overflow-hidden rounded-lg bg-slate-200 dark:bg-slate-800 ${
      variant === 'photo' ? 'aspect-[16/10] lg:aspect-[4/3]' : 'aspect-[4/3]'
    }`}
    >
      {candidates.length > 0 ? (
        <ImageWithFallback
          src={candidates[0]}
          candidates={candidates.slice(1)}
          fallbackSrc={placeholderSrc}
          alt={isEnglish ? `${insect?.name || 'insect'} photograph` : `${insect?.name || '昆虫'}の写真`}
          width="800"
          height="600"
          className="h-full w-full"
          imgClassName="object-center"
          fit="cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-slate-500 dark:text-slate-300">
          <svg className="h-20 w-20" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C9.8 2 8 3.8 8 6v1H6c-1.1 0-2 .9-2 2v2c0 .6.4 1 1 1h1v6c0 2.2 1.8 4 4 4h4c2.2 0 4-1.8 4-4v-6h1c.6 0 1-.4 1-1V9c0-1.1-.9-2-2-2h-2V6c0-2.2-1.8-4-4-4zm-1 6h2v2h-2V8z" />
          </svg>
        </div>
      )}
    </div>
  );
};

const PromptMedia = ({ question, plantDetails, plantImageFilenames, isEnglish, variant = 'default' }) => {
  if (!question) return null;
  if (question.prompt.type === 'plant') {
    return (
      <PlantMedia
        plantName={question.prompt.plantName}
        plantDetails={plantDetails}
        plantImageFilenames={plantImageFilenames}
        isEnglish={isEnglish}
        variant={variant}
      />
    );
  }
  return <InsectMedia insect={question.prompt.insect} isEnglish={isEnglish} variant={variant} />;
};

const FeedbackPhotoPair = ({ question, plantDetails, plantImageFilenames, isEnglish, labels }) => {
  const insect = question?.explanation?.insect;
  const plantName = question?.explanation?.plant?.name || question?.detailLinks?.plantName;
  if (!insect && !plantName) return null;
  return (
    <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-700">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
        {labels.comparePhotos}
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {insect && (
          <div>
            <InsectMedia insect={insect} isEnglish={isEnglish} />
            <p className="mt-2 text-sm font-bold text-slate-700 dark:text-slate-200">{insect.name}</p>
          </div>
        )}
        {plantName && (
          <div>
            <PlantMedia
              plantName={plantName}
              plantDetails={plantDetails}
              plantImageFilenames={plantImageFilenames}
              isEnglish={isEnglish}
            />
            <p className="mt-2 text-sm font-bold text-slate-700 dark:text-slate-200">{plantName}</p>
          </div>
        )}
      </div>
    </div>
  );
};

const ProgressDots = ({ total, answered, currentIndex }) => (
  <div className="grid grid-cols-10 gap-1" aria-label={`${answered}/${total}`}>
    {Array.from({ length: total }, (_, index) => {
      const done = index < answered;
      const current = index === currentIndex;
      return (
        <span
          key={index}
          className={`h-2 rounded-full transition ${
            done
              ? 'bg-emerald-500'
              : current
                ? 'bg-amber-400'
                : 'bg-slate-300 dark:bg-slate-700'
          }`}
        />
      );
    })}
  </div>
);

const Metric = ({ icon: Icon, label, value, tone = 'slate' }) => {
  const toneClasses = {
    slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
    emerald: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-200',
    amber: 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-200',
    blue: 'bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-200',
    rose: 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-200',
  };
  return (
    <div className="min-w-0 rounded-lg bg-slate-100/80 p-3 dark:bg-slate-800/70">
      <div className="flex items-center gap-2">
        <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${toneClasses[tone]}`}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="block text-xs font-bold text-slate-500 dark:text-slate-400">{label}</span>
          <span className="block text-base font-bold leading-tight text-slate-950 dark:text-white">{value}</span>
        </span>
      </div>
    </div>
  );
};

const ModeButton = ({ active, children, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={`rounded-lg border px-3 py-2.5 text-sm font-bold transition ${
      active
        ? 'border-slate-900 bg-slate-900 text-white shadow-md dark:border-white dark:bg-white dark:text-slate-950'
        : 'border-slate-300 bg-white text-slate-700 hover:border-emerald-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
    }`}
  >
    {children}
  </button>
);

const QuizPage = ({
  moths = [],
  butterflies = [],
  plantDetails = {},
  locale = 'ja',
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const isEnglish = isEnglishLocale(locale);
  const labels = labelsFor(isEnglish);
  const mode = normalizeQuizMode(searchParams.get('mode'));
  const quizStyle = normalizeQuizStyle(searchParams.get('style'));
  const isPhotoStyle = quizStyle === QUIZ_STYLES.PHOTO;
  const focusedInsectKey = searchParams.get('focusInsect') || '';
  const focusedPlantKey = searchParams.get('focusPlant') || '';
  const [plantImageFilenames, setPlantImageFilenames] = useState([]);
  const [insectImageIndex, setInsectImageIndex] = useState(EMPTY_INSECT_IMAGE_INDEX);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [selectedOptionId, setSelectedOptionId] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [startStage, setStartStage] = useState('');
  // null = セッション未生成、true/false = 直近セッションに優先問題が含まれたか
  const [priorityIncluded, setPriorityIncluded] = useState(null);
  const [reviewRevision, setReviewRevision] = useState(0);
  const [best, setBest] = useState(() => safeReadJson(getBestStorageKey(locale, mode), {
    score: 0,
    bestStreak: 0,
    plays: 0,
  }));

  useSeoMeta({
    title: isEnglish
      ? 'Four-Choice Host Plant Quiz | Insects and Host Plants of Japan'
      : '昆虫と食草の4択図鑑 | 昆虫植物図鑑',
    description: isEnglish
      ? 'A ten-question quiz for learning moth and butterfly host plant links in Japan.'
      : '蛾・蝶と幼虫食草のつながりを4択で学ぶ10問クイズです。',
    url: absUrl(localizePath('/quiz', locale)),
    siteName: isEnglish ? 'Insects and Host Plants of Japan' : '昆虫植物図鑑',
    htmlLang: isEnglish ? 'en' : 'ja',
  });

  useEffect(() => {
    if (searchParams.get('mode') && searchParams.get('mode') !== mode) {
      const next = new URLSearchParams(searchParams);
      next.set('mode', mode);
      setSearchParams(next, { replace: true });
    }
    if (searchParams.get('style') && searchParams.get('style') !== quizStyle) {
      const next = new URLSearchParams(searchParams);
      next.set('style', quizStyle);
      setSearchParams(next, { replace: true });
    }
  }, [mode, quizStyle, searchParams, setSearchParams]);

  useEffect(() => {
    setBest(safeReadJson(getBestStorageKey(locale, mode), {
      score: 0,
      bestStreak: 0,
      plays: 0,
    }));
  }, [locale, mode]);

  useEffect(() => {
    let cancelled = false;
    loadInsectImageIndexes()
      .then((index) => {
        if (!cancelled) {
          setInsectImageIndex(normalizeInsectImageIndex(index));
        }
      })
      .catch(() => {
        if (!cancelled) setInsectImageIndex(normalizeInsectImageIndex({}, true));
      });
    loadPlantImageFilenames()
      .then((filenames) => {
        if (!cancelled) setPlantImageFilenames(filenames);
      })
      .catch(() => {
        if (!cancelled) setPlantImageFilenames([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const modeLabel = modeLabels[isEnglish ? 'en' : 'ja'][mode];
  const hasData = (moths?.length || 0) + (butterflies?.length || 0) > 0;
  const isResult = questions.length > 0 && currentIndex >= questions.length;
  const currentQuestion = questions[currentIndex] || null;
  const currentAnswer = answers[currentIndex] || null;
  const answeredCount = answers.filter(Boolean).length;
  const currentScore = answers.filter((answer) => answer.isCorrect).length;
  const currentStreak = answers.reduce((streak, answer) => (answer.isCorrect ? streak + 1 : 0), 0);
  const bestStreakInSession = answers.reduce(
    (max, answer) => {
      const next = answer.isCorrect ? max.running + 1 : 0;
      return { running: next, best: Math.max(max.best, next) };
    },
    { running: 0, best: 0 },
  ).best;
  const missedAnswers = answers.filter((answer) => !answer.isCorrect);
  const dueReviewEntries = useMemo(
    () => getDueReviewEntries(locale, mode, Date.now() + reviewRevision * 0),
    [locale, mode, reviewRevision],
  );
  const reviewCount = useMemo(() => {
    return dueReviewEntries.length;
  }, [dueReviewEntries.length]);
  const prioritySubjectKeys = useMemo(() => {
    if (mode === QUIZ_MODES.PLANT_TO_INSECT && focusedPlantKey) {
      const normalizedPlantKey = normalizePlantNameForQuiz(focusedPlantKey);
      return normalizedPlantKey ? [normalizedPlantKey] : [];
    }
    if (mode === QUIZ_MODES.INSECT_TO_PLANT && focusedInsectKey) return [focusedInsectKey];
    return [];
  }, [focusedInsectKey, focusedPlantKey, mode]);
  const hasPriorityCandidates = useMemo(() => {
    if (prioritySubjectKeys.length === 0) return false;
    const prioritySet = new Set(prioritySubjectKeys);
    const candidateInsects = [...(moths || []), ...(butterflies || [])].filter(
      (item) => item && (item.type === 'moth' || item.type === 'butterfly'),
    );
    if (mode === QUIZ_MODES.PLANT_TO_INSECT) {
      return candidateInsects.some((item) =>
        getQuizHostPlantRecords(item).some((record) => prioritySet.has(record.name)),
      );
    }
    return candidateInsects.some(
      (item) =>
        prioritySet.has(item.id || item.name) &&
        getQuizHostPlantRecords(item).length > 0,
    );
  }, [butterflies, mode, moths, prioritySubjectKeys]);

  const setMode = useCallback((nextMode) => {
    const normalized = normalizeQuizMode(nextMode);
    const next = new URLSearchParams(searchParams);
    next.set('mode', normalized);
    setSearchParams(next, { replace: true });
    setQuestions([]);
    setCurrentIndex(0);
    setAnswers([]);
    setSelectedOptionId('');
    setPriorityIncluded(null);
  }, [searchParams, setSearchParams]);

  const setQuizStyle = useCallback((nextStyle) => {
    const normalized = normalizeQuizStyle(nextStyle);
    const next = new URLSearchParams(searchParams);
    if (normalized === QUIZ_STYLES.GUIDED) {
      next.delete('style');
    } else {
      next.set('style', normalized);
    }
    setSearchParams(next, { replace: true });
    setQuestions([]);
    setCurrentIndex(0);
    setAnswers([]);
    setSelectedOptionId('');
    setPriorityIncluded(null);
  }, [searchParams, setSearchParams]);

  const startSession = useCallback(() => {
    if (!hasData || isStarting) return;
    setIsStarting(true);
    setQuestions([]);
    setCurrentIndex(0);
    setAnswers([]);
    setSelectedOptionId('');
    setDetailsOpen(false);
    setStartStage('questions');

    const prepareSession = async () => {
      try {
        let imageIndexForSession = insectImageIndex;
        if (!imageIndexForSession.ready) {
          setStartStage('images');
          try {
            const loadedIndex = normalizeInsectImageIndex(await loadInsectImageIndexes());
            imageIndexForSession = loadedIndex;
            setInsectImageIndex(loadedIndex);
          } catch {
            imageIndexForSession = normalizeInsectImageIndex({}, true);
            setInsectImageIndex(imageIndexForSession);
          }
        }
        setStartStage('questions');
        const reviewKeys = getDueReviewEntries(locale, mode).map((entry) => entry.key);
        const seed = `${mode}:${Date.now()}:${Math.random().toString(16).slice(2)}`;
        const nextQuestions = buildQuizQuestions({
          moths,
          butterflies,
          plantDetails,
          insectImageNames: imageIndexForSession.names,
          insectImageExtensions: imageIndexForSession.exts,
          mode,
          questionCount: DEFAULT_QUIZ_LENGTH,
          seed,
          reviewKeys,
          prioritySubjectKeys,
        });
        setQuestions(nextQuestions);
        setPriorityIncluded(
          prioritySubjectKeys.length > 0
            ? nextQuestions.some((question) => question.isPriority)
            : null,
        );
      } catch (error) {
        console.error('Failed to prepare quiz session', error);
        setQuestions([]);
        setPriorityIncluded(null);
      } finally {
        setIsStarting(false);
        setStartStage('');
      }
    };

    if (typeof window !== 'undefined' && typeof window.setTimeout === 'function') {
      window.setTimeout(() => {
        void prepareSession();
      }, 0);
      return;
    }
    void prepareSession();
  }, [butterflies, hasData, insectImageIndex, isStarting, locale, mode, moths, plantDetails, prioritySubjectKeys]);

  const persistSession = useCallback((nextAnswers) => {
    const score = nextAnswers.filter((answer) => answer.isCorrect).length;
    const bestStreak = nextAnswers.reduce(
      (state, answer) => {
        const running = answer.isCorrect ? state.running + 1 : 0;
        return { running, best: Math.max(state.best, running) };
      },
      { running: 0, best: 0 },
    ).best;
    const storageKey = getBestStorageKey(locale, mode);
    const previousBest = safeReadJson(storageKey, { score: 0, bestStreak: 0, plays: 0 });
    const nextBest = {
      score: Math.max(Number(previousBest.score || 0), score),
      bestStreak: Math.max(Number(previousBest.bestStreak || 0), bestStreak),
      plays: Number(previousBest.plays || 0) + 1,
      updatedAt: Date.now(),
    };
    safeWriteJson(storageKey, nextBest);
    setBest(nextBest);

    const reviewKey = getReviewStorageKey(locale, mode);
    const previousReview = safeReadJson(reviewKey, []);
    safeWriteJson(reviewKey, updateReviewEntries({ previous: previousReview, answers: nextAnswers }));
    setReviewRevision((value) => value + 1);
  }, [locale, mode]);

  const answerQuestion = useCallback((optionId) => {
    if (!currentQuestion || selectedOptionId) return;
    const option = currentQuestion.options.find((item) => item.id === optionId);
    if (!option) return;
    const isCorrect = isCorrectAnswer(currentQuestion, optionId);
    const correctOption = currentQuestion.options.find((item) => item.id === currentQuestion.correctOptionId);
    const answer = {
      questionId: currentQuestion.id,
      reviewKey: currentQuestion.reviewKey,
      selectedOptionId: optionId,
      selectedLabel: option.label,
      selectedOption: option,
      correctOptionId: currentQuestion.correctOptionId,
      correctLabel: correctOption?.label || '',
      correctOption,
      learningPoint: buildLearningPoint({
        question: currentQuestion,
        selectedOption: option,
        correctOption,
        isEnglish,
      }),
      isCorrect,
      question: currentQuestion,
    };
    setSelectedOptionId(optionId);
    setDetailsOpen(false);
    setAnswers((prev) => {
      const next = [...prev];
      next[currentIndex] = answer;
      return next;
    });
  }, [currentIndex, currentQuestion, isEnglish, selectedOptionId]);

  const nextQuestion = useCallback(() => {
    if (!currentQuestion || !selectedOptionId) return;
    const nextAnswers = answers.filter(Boolean);
    if (currentIndex + 1 >= questions.length) {
      persistSession(nextAnswers);
      setCurrentIndex(questions.length);
      setSelectedOptionId('');
      setDetailsOpen(false);
      return;
    }
    setCurrentIndex((index) => index + 1);
    setSelectedOptionId('');
    setDetailsOpen(false);
  }, [answers, currentIndex, currentQuestion, persistSession, questions.length, selectedOptionId]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!currentQuestion || isResult) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const targetTag = event.target?.tagName;
      if (targetTag === 'INPUT' || targetTag === 'TEXTAREA' || event.target?.isContentEditable) return;
      if (!selectedOptionId && /^[1-4]$/.test(event.key)) {
        const option = currentQuestion.options[Number(event.key) - 1];
        if (option) {
          event.preventDefault();
          answerQuestion(option.id);
        }
      }
      if (selectedOptionId && event.key === 'Enter') {
        event.preventDefault();
        nextQuestion();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [answerQuestion, currentQuestion, isResult, nextQuestion, selectedOptionId]);

  const midpointMessage =
    selectedOptionId && currentIndex === 4
      ? labels.halfway
      : selectedOptionId && currentIndex === DEFAULT_QUIZ_LENGTH - 1
        ? labels.finish
        : '';

  const renderDetailLinks = (question) => (
    <div className="mt-4 flex flex-wrap gap-2">
      {question.detailLinks?.insect && (
        <Link
          to={buildInsectPath(question.detailLinks.insect, locale)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-emerald-500 hover:text-emerald-700 dark:border-slate-700 dark:text-slate-200 dark:hover:text-emerald-300"
        >
          {labels.openInsect}
        </Link>
      )}
      {question.detailLinks?.plantName && (
        <Link
          to={buildPlantPath(question.detailLinks.plantName, locale)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-500 hover:text-blue-700 dark:border-slate-700 dark:text-slate-200 dark:hover:text-blue-300"
        >
          {labels.openPlant}
        </Link>
      )}
    </div>
  );

  const renderStart = () => {
    const startingLabel = startStage ? labels.startStages[startStage] : labels.starting;
    return (
      <section className="mx-auto max-w-3xl px-4 py-5 md:px-8 md:py-8">
        <section className="rounded-card border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
              {labels.session}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950 dark:text-white">{labels.today}</h1>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">
              {labels.todayLead}
            </p>
          </div>
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200">
            <BoltIcon className="h-5 w-5" />
          </span>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Metric icon={TrophyIcon} label={labels.best} value={summarizeBest(best, isEnglish)} tone="amber" />
          <Metric icon={ArrowPathIcon} label={labels.reviewDue} value={reviewCount} tone={reviewCount ? 'rose' : 'slate'} />
        </div>

        {prioritySubjectKeys.length > 0 && hasPriorityCandidates && priorityIncluded !== false && (
          <p className="mt-4 inline-flex rounded-lg bg-blue-100 px-3 py-1.5 text-sm font-bold text-blue-800 dark:bg-blue-950/60 dark:text-blue-200">
            {labels.focused}
          </p>
        )}

        <div className="mt-5">
          <button
            type="button"
            onClick={startSession}
            disabled={!hasData || isStarting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-5 py-4 text-base font-bold text-white shadow-lg shadow-slate-900/15 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
          >
            {!hasData ? labels.loading : isStarting ? startingLabel : labels.start}
            {hasData && !isStarting && <ChevronRightIcon className="h-5 w-5" />}
          </button>
          {isStarting && (
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800" aria-label={startingLabel}>
              <div className={`h-full rounded-full bg-emerald-500 transition-all duration-300 ${
                startStage === 'images' ? 'w-1/3' : 'w-2/3'
              }`}
              />
            </div>
          )}
          {!hasData && (
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{labels.notReady}</p>
          )}
          <p className="mt-3 text-xs font-semibold text-slate-500 dark:text-slate-400">{labels.keyboard}</p>
        </div>

        <div className="mt-5 border-t border-slate-200 pt-5 dark:border-slate-800">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
            {labels.settings}
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-bold text-slate-700 dark:text-slate-200">{labels.mode}</p>
              <div className="grid grid-cols-2 gap-2">
                <ModeButton active={mode === QUIZ_MODES.INSECT_TO_PLANT} onClick={() => setMode(QUIZ_MODES.INSECT_TO_PLANT)}>
                  {modeLabels[isEnglish ? 'en' : 'ja'][QUIZ_MODES.INSECT_TO_PLANT]}
                </ModeButton>
                <ModeButton active={mode === QUIZ_MODES.PLANT_TO_INSECT} onClick={() => setMode(QUIZ_MODES.PLANT_TO_INSECT)}>
                  {modeLabels[isEnglish ? 'en' : 'ja'][QUIZ_MODES.PLANT_TO_INSECT]}
                </ModeButton>
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-bold text-slate-700 dark:text-slate-200">{labels.style}</p>
              <div className="grid grid-cols-2 gap-2">
                <ModeButton active={quizStyle === QUIZ_STYLES.GUIDED} onClick={() => setQuizStyle(QUIZ_STYLES.GUIDED)}>
                  {labels.guidedStyle}
                </ModeButton>
                <ModeButton active={quizStyle === QUIZ_STYLES.PHOTO} onClick={() => setQuizStyle(QUIZ_STYLES.PHOTO)}>
                  {labels.photoStyle}
                </ModeButton>
              </div>
              <p className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                {isPhotoStyle ? labels.photoStyleDesc : labels.guidedStyleDesc}
              </p>
            </div>
          </div>
        </div>
      </section>
    </section>
    );
  };

  const renderQuestion = () => {
    const promptInstruction =
      mode === QUIZ_MODES.PLANT_TO_INSECT ? labels.plantPrompt : labels.insectPrompt;
    const feedbackIcon = currentAnswer?.isCorrect ? CheckCircleIcon : XCircleIcon;
    const FeedbackIcon = feedbackIcon;
    const correctOption = currentQuestion.options.find((item) => item.id === currentQuestion.correctOptionId);
    const selectedOption = currentAnswer?.selectedOption;
    const questionGridClass = isPhotoStyle
      ? 'grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(22rem,0.75fr)]'
      : 'grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]';
    return (
      <section className={`${isPhotoStyle ? 'mx-auto max-w-7xl' : 'mx-auto max-w-6xl'} px-3 py-4 md:px-8 md:py-7`}>
        <div className="sticky top-0 z-20 -mx-3 mb-4 border-b border-slate-200 bg-slate-100/95 px-3 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 md:-mx-8 md:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                  {modeLabel}
                </p>
                <h1 className="mt-1 text-xl font-bold text-slate-950 dark:text-white">
                  {currentIndex + 1}/{questions.length}
                </h1>
              </div>
              <div className="flex flex-wrap gap-2 text-sm font-bold">
                <span className="rounded-lg bg-white px-3 py-1.5 text-slate-700 shadow-sm dark:bg-slate-900 dark:text-slate-200">
                  {labels.score} {currentScore}/{answeredCount}
                </span>
                <span className="rounded-lg bg-amber-100 px-3 py-1.5 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
                  {labels.streak} {currentStreak}
                </span>
                <span className="rounded-lg bg-blue-100 px-3 py-1.5 text-blue-800 dark:bg-blue-950/60 dark:text-blue-200">
                  {selectedOptionId ? labels.stageCheck : labels.stageChoose}
                </span>
              </div>
            </div>
            <ProgressDots total={questions.length} answered={answeredCount} currentIndex={currentIndex} />
          </div>
        </div>

        <div className={questionGridClass}>
          <PromptMedia
            question={currentQuestion}
            plantDetails={plantDetails}
            plantImageFilenames={plantImageFilenames}
            isEnglish={isEnglish}
            variant={isPhotoStyle ? 'photo' : 'default'}
          />

          <div className="rounded-card border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
              {promptInstruction}
            </p>
            <h2 className="mt-3 text-2xl font-bold leading-tight tracking-normal text-slate-950 dark:text-white sm:text-3xl">
              {currentQuestion.prompt.title}
            </h2>
            {currentQuestion.prompt.subtitle && (
              <p className="mt-2 text-base text-slate-500 dark:text-slate-300">
                {currentQuestion.prompt.type === 'insect'
                  ? formatScientificNameReact(currentQuestion.prompt.subtitle)
                  : currentQuestion.prompt.subtitle}
              </p>
            )}
            {currentQuestion.prompt.family && (
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{currentQuestion.prompt.family}</p>
            )}

            <div className="mt-5 grid gap-2.5">
              {currentQuestion.options.map((option, index) => {
                const isSelected = selectedOptionId === option.id;
                const isCorrect = Boolean(selectedOptionId && option.id === currentQuestion.correctOptionId);
                const isWrong = Boolean(selectedOptionId && isSelected && !isCorrect);
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => answerQuestion(option.id)}
                    disabled={Boolean(selectedOptionId)}
                    className={`group flex min-h-[4.35rem] w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition sm:px-4 ${
                      isCorrect
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/50 dark:text-emerald-100'
                        : isWrong
                          ? 'border-rose-500 bg-rose-50 text-rose-950 dark:bg-rose-950/50 dark:text-rose-100'
                          : selectedOptionId
                            ? 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-400'
                            : 'border-slate-200 bg-slate-50 text-slate-900 hover:border-slate-400 hover:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-slate-500'
                    }`}
                  >
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white text-sm font-bold text-slate-700 shadow-sm dark:bg-slate-950 dark:text-slate-100">
                      {optionNumbers[index]}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-base font-bold sm:text-lg">
                        {option.type === 'insect' && option.subtitle ? option.label : option.label}
                      </span>
                      {option.subtitle && (
                        <span className="mt-0.5 block text-sm text-slate-500 dark:text-slate-300">
                          {option.type === 'insect' ? formatScientificNameReact(option.subtitle) : option.subtitle}
                        </span>
                      )}
                    </span>
                    {isCorrect && <CheckCircleIcon className="ml-auto h-6 w-6 flex-shrink-0 text-emerald-600 dark:text-emerald-300" />}
                    {isWrong && <XCircleIcon className="ml-auto h-6 w-6 flex-shrink-0 text-rose-600 dark:text-rose-300" />}
                  </button>
                );
              })}
            </div>

            <p className="mt-3 hidden text-xs text-slate-500 dark:text-slate-400 sm:block">{labels.keyboard}</p>

            {selectedOptionId && (
              <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-700">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 gap-3">
                    <span className={`mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${
                      currentAnswer?.isCorrect
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200'
                        : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-200'
                    }`}
                    >
                      <FeedbackIcon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className={`text-sm font-bold ${currentAnswer?.isCorrect ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>
                        {currentAnswer?.isCorrect ? labels.correct : labels.incorrect}
                      </p>
                      <p className="mt-1 text-lg font-bold text-slate-950 dark:text-white">
                        {currentQuestion.explanation.correctLabel}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-600 dark:text-slate-300">
                        {labels.correctPair}: {buildCorrectLinkLabel(currentQuestion, isEnglish)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={nextQuestion}
                    className="flex min-h-[44px] items-center gap-2 rounded-lg bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                  >
                    {labels.next}
                    <ArrowRightIcon className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-3 pl-12">
                  {currentAnswer?.selectedLabel && !currentAnswer?.isCorrect && (
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                      {labels.yourChoice}: {currentAnswer.selectedLabel}
                    </p>
                  )}
                  {(currentAnswer?.learningPoint || buildLearningPoint({
                    question: currentQuestion,
                    selectedOption,
                    correctOption,
                    isEnglish,
                  })) && (
                    <p className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                      {labels.learningPoint}: {currentAnswer?.learningPoint || buildLearningPoint({
                        question: currentQuestion,
                        selectedOption,
                        correctOption,
                        isEnglish,
                      })}
                    </p>
                  )}
                  {currentQuestion.explanation.sourceLabel && (
                    <SourceCitation
                      sources={currentQuestion.explanation.sourceLabel}
                      isEnglish={isEnglish}
                      resolveLinks={false}
                      className="mt-1"
                    />
                  )}
                  {midpointMessage && (
                    <p className="mt-2 text-sm font-semibold text-amber-700 dark:text-amber-300">{midpointMessage}</p>
                  )}
                  {!currentAnswer?.isCorrect && renderDetailLinks(currentQuestion)}
                </div>

                <button
                  type="button"
                  onClick={() => setDetailsOpen((value) => !value)}
                  className="mt-4 inline-flex min-h-[44px] items-center py-2 pl-12 text-sm font-bold text-blue-700 underline decoration-blue-300 underline-offset-4 dark:text-blue-300"
                >
                  {detailsOpen ? labels.hideDetails : labels.details}
                </button>
                {detailsOpen && (
                  <div className="mt-3 border-t border-slate-200 pt-3 text-sm leading-6 text-slate-700 dark:border-slate-700 dark:text-slate-200">
                    {currentQuestion.explanation.sourceRecords?.length > 0 ? (
                      <ul className="space-y-1">
                        {currentQuestion.explanation.sourceRecords.map((record, index) => (
                          <li key={`${record.name}-${index}`}>
                            {record.displayName || record.name}
                            {record.reference ? ` / ${record.reference}` : ''}
                            {record.notes ? ` / ${record.notes}` : ''}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>{currentQuestion.explanation.sourceLabel || currentQuestion.explanation.correctLabel}</p>
                    )}
                    {renderDetailLinks(currentQuestion)}
                  </div>
                )}
                {isPhotoStyle && (
                  <FeedbackPhotoPair
                    question={currentQuestion}
                    plantDetails={plantDetails}
                    plantImageFilenames={plantImageFilenames}
                    isEnglish={isEnglish}
                    labels={labels}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    );
  };

  const renderResult = () => {
    const gradeText = isEnglish
      ? `${currentScore}/${questions.length} correct`
      : `${questions.length}問中${currentScore}問正解`;
    const weakItems = buildWeaknessItems(missedAnswers, isEnglish);
    const topReviewAnswers = missedAnswers.slice(0, 3);
    return (
      <section className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-10">
        <div className="overflow-hidden rounded-card border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="bg-slate-950 p-5 text-white sm:p-7">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">{labels.result}</p>
            <h1 className="mt-3 text-4xl font-bold leading-tight tracking-normal sm:text-6xl">{gradeText}</h1>
            <div className="mt-5">
              <ProgressDots total={questions.length} answered={questions.length} currentIndex={questions.length - 1} />
            </div>
          </div>

          <div className="grid gap-3 p-5 sm:grid-cols-3 sm:p-6">
            <Metric icon={FireIcon} label={labels.streak} value={bestStreakInSession} tone="amber" />
            <Metric icon={TrophyIcon} label={labels.best} value={summarizeBest(best, isEnglish)} tone="emerald" />
            <Metric icon={ArrowPathIcon} label={labels.reviewDue} value={missedAnswers.length} tone={missedAnswers.length ? 'rose' : 'slate'} />
          </div>

          <div className="border-t border-slate-200 px-5 py-4 dark:border-slate-800 sm:px-6">
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={startSession}
                disabled={isStarting}
                className="flex items-center gap-2 rounded-lg bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:bg-slate-400 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
              >
                {isStarting ? (startStage ? labels.startStages[startStage] : labels.starting) : labels.nextSession}
                <ArrowRightIcon className="h-4 w-4" />
              </button>
              <Link
                to={localizePath('/', locale)}
                className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700 transition hover:border-slate-500 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-500"
              >
                {labels.home}
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="rounded-card border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-xl font-bold text-slate-950 dark:text-white">{labels.weakPoints}</h2>
            {weakItems.length === 0 ? (
              <p className="mt-3 text-slate-600 dark:text-slate-300">{labels.noWeakPoints}</p>
            ) : (
              <div className="mt-4 grid gap-2">
                {weakItems.map((item) => (
                  <div key={item.label} className="flex items-center justify-between rounded-lg bg-slate-100 px-3 py-2 dark:bg-slate-800">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{item.label}</span>
                    <span className="rounded-md bg-white px-2 py-1 text-xs font-bold text-slate-700 dark:bg-slate-950 dark:text-slate-200">
                      {item.count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-card border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-xl font-bold text-slate-950 dark:text-white">{labels.reviewTop}</h2>
            {topReviewAnswers.length === 0 ? (
              <p className="mt-3 text-slate-600 dark:text-slate-300">{labels.noReview}</p>
            ) : (
              <div className="mt-4 grid gap-3">
                {topReviewAnswers.map((answer) => (
                  <div key={`top-${answer.questionId}`} className="border-l-4 border-rose-400 pl-3">
                    <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
                      {answer.question.prompt.title}
                    </p>
                    <p className="mt-1 text-base font-bold text-slate-950 dark:text-white">
                      {answer.correctLabel}
                    </p>
                    {answer.learningPoint && (
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{answer.learningPoint}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 rounded-card border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-slate-950 dark:text-white">{labels.review}</h2>
            <span className="rounded-lg bg-slate-100 px-3 py-1 text-sm font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {missedAnswers.length}/{questions.length}
            </span>
          </div>
          {missedAnswers.length === 0 ? (
            <p className="mt-3 text-slate-600 dark:text-slate-300">{labels.noReview}</p>
          ) : (
            <div className="mt-4 grid gap-3">
              {missedAnswers.map((answer) => (
                <div key={answer.questionId} className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                  <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
                    {answer.question.prompt.title}
                  </p>
                  <p className="mt-1 text-base font-bold text-slate-950 dark:text-white">
                    {isEnglish ? 'Correct answer:' : '正解:'} {answer.correctLabel}
                  </p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    {isEnglish ? 'Your answer:' : 'あなたの回答:'} {answer.selectedLabel}
                  </p>
                  {answer.learningPoint && (
                    <p className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                      {labels.learningPoint}: {answer.learningPoint}
                    </p>
                  )}
                  {renderDetailLinks(answer.question)}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    );
  };

  return (
    <div className="min-h-screen text-slate-900 dark:text-slate-100">
      {questions.length === 0 && renderStart()}
      {questions.length > 0 && !isResult && currentQuestion && renderQuestion()}
      {isResult && renderResult()}
    </div>
  );
};

export default QuizPage;

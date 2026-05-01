import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import ImageWithFallback from './components/ImageWithFallback';
import useInsectImageCandidates from './hooks/useInsectImageCandidates';
import useSeoMeta from './hooks/useSeoMeta';
import { loadInsectImageIndexes, loadPlantImageFilenames } from './services/imageIndex';
import {
  DEFAULT_QUIZ_LENGTH,
  QUIZ_MODES,
  buildQuizQuestions,
  isCorrectAnswer,
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

const REVIEW_LIMIT = 24;
const EMPTY_INSECT_IMAGE_INDEX = Object.freeze({ names: new Set(), exts: {}, ready: false });

const normalizeInsectImageIndex = ({ names, exts } = {}, ready = true) => ({
  names: new Set(names || []),
  exts: exts || {},
  ready,
});

const getBestStorageKey = (locale, mode) => `ihpe-quiz-best:v1:${locale}:${mode}`;
const getReviewStorageKey = (locale, mode) => `ihpe-quiz-review:v1:${locale}:${mode}`;

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

const updateReviewEntries = ({ previous = [], answers = [] }) => {
  const map = new Map(
    Array.isArray(previous)
      ? previous
          .filter((entry) => entry?.key)
          .map((entry) => [entry.key, { key: entry.key, misses: Number(entry.misses || 0), lastSeen: Number(entry.lastSeen || 0) }])
      : [],
  );
  const now = Date.now();

  answers.forEach((answer) => {
    if (!answer?.reviewKey) return;
    if (answer.isCorrect) {
      map.delete(answer.reviewKey);
      return;
    }
    const current = map.get(answer.reviewKey) || { key: answer.reviewKey, misses: 0, lastSeen: 0 };
    map.set(answer.reviewKey, {
      key: answer.reviewKey,
      misses: current.misses + 1,
      lastSeen: now,
    });
  });

  return Array.from(map.values())
    .sort((a, b) => b.misses - a.misses || a.lastSeen - b.lastSeen)
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

const optionLetters = ['A', 'B', 'C', 'D'];

const labelsFor = (isEnglish) => ({
  title: isEnglish ? 'Four-Choice Host Plant Quiz' : '昆虫と食草の4択図鑑',
  subtitle: isEnglish
    ? 'A ten-question game for learning moth and butterfly host-plant links.'
    : '蛾・蝶と幼虫食草のつながりを10問で覚える学習ゲーム。',
  start: isEnglish ? 'Start 10 questions' : '10問を始める',
  starting: isEnglish ? 'Preparing the first question...' : '最初の問題を準備中…',
  restart: isEnglish ? 'Try again' : 'もう一度挑戦',
  next: isEnglish ? 'Next question' : '次の問題',
  result: isEnglish ? 'Session result' : '結果',
  score: isEnglish ? 'Score' : '正答',
  streak: isEnglish ? 'Streak' : '連続正解',
  best: isEnglish ? 'Best' : '自己ベスト',
  review: isEnglish ? 'Review list' : '復習候補',
  noReview: isEnglish ? 'No missed questions this round.' : '今回の復習候補はありません。',
  source: isEnglish ? 'Source' : '出典',
  details: isEnglish ? 'Show details' : '詳しい記録を見る',
  hideDetails: isEnglish ? 'Hide details' : '詳細を閉じる',
  correct: isEnglish ? 'Correct' : '正解',
  incorrect: isEnglish ? 'Review this one' : '復習しよう',
  loading: isEnglish ? 'Preparing quiz data...' : 'クイズデータを準備しています…',
  notReady: isEnglish
    ? 'Quiz data is still loading. Please try again in a moment.'
    : 'クイズに使うデータを読み込み中です。少し待ってから始めてください。',
  halfway: isEnglish ? 'Halfway. Keep the rhythm.' : '半分到達。いいテンポです。',
  finish: isEnglish ? 'Last question complete.' : '10問完了です。',
  keyboard: isEnglish ? 'Keys 1-4 answer, Enter advances.' : '1〜4で回答、Enterで次へ進めます。',
  mode: isEnglish ? 'Mode' : 'モード',
  insectPrompt: isEnglish ? 'Choose the larval host plant.' : 'この昆虫の幼虫食草を選んでください。',
  plantPrompt: isEnglish ? 'Choose the insect linked to this host plant.' : 'この植物を食草にする昆虫を選んでください。',
  openInsect: isEnglish ? 'Open insect page' : '昆虫ページへ',
  openPlant: isEnglish ? 'Open plant page' : '植物ページへ',
  home: isEnglish ? 'Back to explorer' : '図鑑へ戻る',
});

const summarizeBest = (best, isEnglish) => {
  const score = Number(best?.score || 0);
  const streak = Number(best?.bestStreak || 0);
  return isEnglish
    ? `${score}/${DEFAULT_QUIZ_LENGTH}, streak ${streak}`
    : `${DEFAULT_QUIZ_LENGTH}問中${score}問・連続${streak}問`;
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

const PlantMedia = ({ plantName, plantDetails, plantImageFilenames, isEnglish }) => {
  const filename = resolvePlantImageFilename({ plantName, plantDetails, plantImageFilenames });
  const baseUrl = import.meta.env.BASE_URL || '/';
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const picture = filename
    ? buildResponsivePicture({
        baseUrl: normalizedBase,
        folder: 'plants',
        filename,
        widths: [320, 640, 1024],
        sizes: '(max-width: 768px) 100vw, 42vw',
      })
    : null;

  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-emerald-100 dark:bg-emerald-950/60">
      {filename ? (
        <ImageWithFallback
          src={picture.src}
          srcSet={picture.srcSet}
          sizes={picture.sizes}
          sources={picture.sources}
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

const InsectMedia = ({ insect, isEnglish }) => {
  const { getImageCandidates, placeholderSrc } = useInsectImageCandidates({ useAssetVersionInProd: true });
  const candidates = useMemo(() => getImageCandidates(insect), [getImageCandidates, insect]);
  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-slate-200 dark:bg-slate-800">
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

const PromptMedia = ({ question, plantDetails, plantImageFilenames, isEnglish }) => {
  if (!question) return null;
  if (question.prompt.type === 'plant') {
    return (
      <PlantMedia
        plantName={question.prompt.plantName}
        plantDetails={plantDetails}
        plantImageFilenames={plantImageFilenames}
        isEnglish={isEnglish}
      />
    );
  }
  return <InsectMedia insect={question.prompt.insect} isEnglish={isEnglish} />;
};

const ModeButton = ({ active, children, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={`rounded-xl border px-4 py-3 text-sm font-bold transition ${
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
  const [plantImageFilenames, setPlantImageFilenames] = useState([]);
  const [insectImageIndex, setInsectImageIndex] = useState(EMPTY_INSECT_IMAGE_INDEX);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [selectedOptionId, setSelectedOptionId] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [lastSeed, setLastSeed] = useState('');
  const [isStarting, setIsStarting] = useState(false);
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
  }, [mode, searchParams, setSearchParams]);

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

  const setMode = useCallback((nextMode) => {
    const normalized = normalizeQuizMode(nextMode);
    const next = new URLSearchParams(searchParams);
    next.set('mode', normalized);
    setSearchParams(next, { replace: true });
    setQuestions([]);
    setCurrentIndex(0);
    setAnswers([]);
    setSelectedOptionId('');
  }, [searchParams, setSearchParams]);

  const startSession = useCallback(() => {
    if (!hasData || isStarting) return;
    setIsStarting(true);
    setQuestions([]);
    setCurrentIndex(0);
    setAnswers([]);
    setSelectedOptionId('');
    setDetailsOpen(false);

    const prepareSession = async () => {
      try {
        let imageIndexForSession = insectImageIndex;
        if (!imageIndexForSession.ready) {
          try {
            const loadedIndex = normalizeInsectImageIndex(await loadInsectImageIndexes());
            imageIndexForSession = loadedIndex;
            setInsectImageIndex(loadedIndex);
          } catch {
            imageIndexForSession = normalizeInsectImageIndex({}, true);
            setInsectImageIndex(imageIndexForSession);
          }
        }
        const reviewEntries = safeReadJson(getReviewStorageKey(locale, mode), []);
        const reviewKeys = Array.isArray(reviewEntries) ? reviewEntries.map((entry) => entry.key).filter(Boolean) : [];
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
        });
        setLastSeed(seed);
        setQuestions(nextQuestions);
      } catch (error) {
        console.error('Failed to prepare quiz session', error);
        setQuestions([]);
      } finally {
        setIsStarting(false);
      }
    };

    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => {
        window.setTimeout(() => {
          void prepareSession();
        }, 0);
      });
      return;
    }
    void prepareSession();
  }, [butterflies, hasData, insectImageIndex, isStarting, locale, mode, moths, plantDetails]);

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
  }, [locale, mode]);

  const answerQuestion = useCallback((optionId) => {
    if (!currentQuestion || selectedOptionId) return;
    const option = currentQuestion.options.find((item) => item.id === optionId);
    if (!option) return;
    const isCorrect = isCorrectAnswer(currentQuestion, optionId);
    const answer = {
      questionId: currentQuestion.id,
      reviewKey: currentQuestion.reviewKey,
      selectedOptionId: optionId,
      selectedLabel: option.label,
      correctOptionId: currentQuestion.correctOptionId,
      correctLabel: currentQuestion.options.find((item) => item.id === currentQuestion.correctOptionId)?.label || '',
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
  }, [currentIndex, currentQuestion, selectedOptionId]);

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

  const renderStart = () => (
    <section className="mx-auto grid max-w-6xl gap-8 px-4 py-8 md:grid-cols-[minmax(0,1fr)_22rem] md:px-8 md:py-12">
      <div className="flex min-h-[34rem] flex-col justify-between rounded-3xl bg-slate-950 p-6 text-white shadow-2xl sm:p-8">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-300">
            {isEnglish ? 'Learn by choosing' : '選ぶほど覚える'}
          </p>
          <h1 className="mt-4 max-w-3xl text-[clamp(2.4rem,6vw,5.8rem)] font-black leading-[0.95] tracking-tight">
            {labels.title}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-200 sm:text-lg">
            {labels.subtitle}
          </p>
        </div>
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {[
            isEnglish ? '10 quick questions' : '10問で区切る',
            isEnglish ? 'Immediate feedback' : 'すぐ答え合わせ',
            isEnglish ? 'Review misses later' : '間違いは次回復習',
          ].map((text) => (
            <div key={text} className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-slate-100">
              {text}
            </div>
          ))}
        </div>
      </div>

      <aside className="flex flex-col gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            {labels.mode}
          </p>
          <div className="mt-3 grid gap-2">
            <ModeButton active={mode === QUIZ_MODES.INSECT_TO_PLANT} onClick={() => setMode(QUIZ_MODES.INSECT_TO_PLANT)}>
              {modeLabels[isEnglish ? 'en' : 'ja'][QUIZ_MODES.INSECT_TO_PLANT]}
            </ModeButton>
            <ModeButton active={mode === QUIZ_MODES.PLANT_TO_INSECT} onClick={() => setMode(QUIZ_MODES.PLANT_TO_INSECT)}>
              {modeLabels[isEnglish ? 'en' : 'ja'][QUIZ_MODES.PLANT_TO_INSECT]}
            </ModeButton>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-slate-500 dark:text-slate-400">{labels.best}</dt>
              <dd className="mt-1 font-bold text-slate-900 dark:text-slate-50">{summarizeBest(best, isEnglish)}</dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">{isEnglish ? 'Scope' : '対象'}</dt>
              <dd className="mt-1 font-bold text-slate-900 dark:text-slate-50">{isEnglish ? 'Moths, butterflies' : '蛾・蝶'}</dd>
            </div>
          </dl>
          <button
            type="button"
            onClick={startSession}
            disabled={!hasData || isStarting}
            className="mt-5 w-full rounded-xl bg-emerald-600 px-5 py-3 text-base font-black text-white shadow-lg shadow-emerald-900/20 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {!hasData ? labels.loading : isStarting ? labels.starting : labels.start}
          </button>
          {!hasData && (
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{labels.notReady}</p>
          )}
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{labels.keyboard}</p>
        </div>
      </aside>
    </section>
  );

  const renderQuestion = () => {
    const promptInstruction =
      mode === QUIZ_MODES.PLANT_TO_INSECT ? labels.plantPrompt : labels.insectPrompt;
    return (
      <section className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
              {labels.mode}: {modeLabel}
            </p>
            <h1 className="mt-1 text-2xl font-black text-slate-950 dark:text-white">
              {currentIndex + 1}/{questions.length}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2 text-sm font-bold">
            <span className="rounded-full bg-white px-3 py-1.5 text-slate-700 shadow-sm dark:bg-slate-900 dark:text-slate-200">
              {labels.score} {currentScore}/{answers.length}
            </span>
            <span className="rounded-full bg-amber-100 px-3 py-1.5 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
              {labels.streak} {currentStreak}
            </span>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <PromptMedia
            question={currentQuestion}
            plantDetails={plantDetails}
            plantImageFilenames={plantImageFilenames}
            isEnglish={isEnglish}
          />

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
              {promptInstruction}
            </p>
            <h2 className="mt-3 text-3xl font-black leading-tight text-slate-950 dark:text-white">
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

            <div className="mt-6 grid gap-3">
              {currentQuestion.options.map((option, index) => {
                const isSelected = selectedOptionId === option.id;
                const isCorrect = selectedOptionId && option.id === currentQuestion.correctOptionId;
                const isWrong = selectedOptionId && isSelected && !isCorrect;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => answerQuestion(option.id)}
                    disabled={Boolean(selectedOptionId)}
                    className={`group flex min-h-[4.6rem] w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
                      isCorrect
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/50 dark:text-emerald-100'
                        : isWrong
                          ? 'border-rose-500 bg-rose-50 text-rose-950 dark:bg-rose-950/50 dark:text-rose-100'
                          : 'border-slate-200 bg-slate-50 text-slate-900 hover:border-slate-400 hover:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-slate-500'
                    }`}
                  >
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white text-sm font-black text-slate-700 shadow-sm dark:bg-slate-950 dark:text-slate-100">
                      {optionLetters[index]}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-base font-black sm:text-lg">
                        {option.type === 'insect' && option.subtitle ? option.label : option.label}
                      </span>
                      {option.subtitle && (
                        <span className="mt-0.5 block text-sm text-slate-500 dark:text-slate-300">
                          {option.type === 'insect' ? formatScientificNameReact(option.subtitle) : option.subtitle}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>

            {selectedOptionId && (
              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/60">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className={`text-sm font-black ${currentAnswer?.isCorrect ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>
                      {currentAnswer?.isCorrect ? labels.correct : labels.incorrect}
                    </p>
                    <p className="mt-1 text-lg font-black text-slate-950 dark:text-white">
                      {currentQuestion.explanation.correctLabel}
                    </p>
                    {currentQuestion.explanation.sourceLabel && (
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                        {labels.source}: {currentQuestion.explanation.sourceLabel}
                      </p>
                    )}
                    {midpointMessage && (
                      <p className="mt-2 text-sm font-semibold text-amber-700 dark:text-amber-300">{midpointMessage}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={nextQuestion}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-black text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-950"
                  >
                    {labels.next}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setDetailsOpen((value) => !value)}
                  className="mt-4 text-sm font-bold text-blue-700 underline decoration-blue-300 underline-offset-4 dark:text-blue-300"
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
    return (
      <section className="mx-auto max-w-5xl px-4 py-8 md:px-8 md:py-12">
        <div className="rounded-3xl bg-slate-950 p-6 text-white shadow-2xl sm:p-8">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-300">{labels.result}</p>
          <h1 className="mt-3 text-[clamp(2.8rem,7vw,6rem)] font-black leading-none tracking-tight">{gradeText}</h1>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
              <p className="text-sm text-slate-300">{labels.streak}</p>
              <p className="mt-1 text-3xl font-black">{bestStreakInSession}</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
              <p className="text-sm text-slate-300">{labels.best}</p>
              <p className="mt-1 text-xl font-black">{summarizeBest(best, isEnglish)}</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
              <p className="text-sm text-slate-300">{isEnglish ? 'Seed' : '出題セット'}</p>
              <p className="mt-1 truncate text-sm font-semibold text-slate-200">{lastSeed || '-'}</p>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={startSession}
              disabled={isStarting}
              className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-600"
            >
              {isStarting ? labels.starting : labels.restart}
            </button>
            <Link
              to={localizePath('/', locale)}
              className="rounded-xl border border-white/20 px-5 py-3 text-sm font-black text-white transition hover:bg-white/10"
            >
              {labels.home}
            </Link>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-xl font-black text-slate-950 dark:text-white">{labels.review}</h2>
          {missedAnswers.length === 0 ? (
            <p className="mt-3 text-slate-600 dark:text-slate-300">{labels.noReview}</p>
          ) : (
            <div className="mt-4 grid gap-3">
              {missedAnswers.map((answer) => (
                <div key={answer.questionId} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                  <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
                    {answer.question.prompt.title}
                  </p>
                  <p className="mt-1 text-base font-black text-slate-950 dark:text-white">
                    {isEnglish ? 'Correct answer:' : '正解:'} {answer.correctLabel}
                  </p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    {isEnglish ? 'Your answer:' : 'あなたの回答:'} {answer.selectedLabel}
                  </p>
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
    <div className="min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {questions.length === 0 && renderStart()}
      {questions.length > 0 && !isResult && currentQuestion && renderQuestion()}
      {isResult && renderResult()}
    </div>
  );
};

export default QuizPage;

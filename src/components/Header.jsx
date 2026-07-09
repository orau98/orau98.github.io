import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';
import { slugifyInsectName, decodeSlug } from '../utils/insectSlug';
import {
  isEnglishLocale,
  localizePath,
  stripLocalePrefix,
} from '../utils/locale';
import { getSectionConfigByRouteSegment } from '../utils/siteTaxonomy';
import { formatScientificNameReact } from '../utils/scientificNameFormatter.jsx';
import LocaleSwitcher from './LocaleSwitcher';

const Header = ({ locale = 'ja', theme, setTheme, moths, butterflies = [], beetles = [], longhornbeetles = [], leafbeetles = [], aphids = [], hostPlants: _hostPlants, plantDetails }) => {
  const location = useLocation();
  const isEnglish = isEnglishLocale(locale);
  const insectListsByType = {
    moth: moths,
    butterfly: butterflies,
    beetle: beetles,
    longhornbeetle: longhornbeetles,
    leafbeetle: leafbeetles,
    aphid: aphids,
  };
  
  // Get current moth or plant data for classification display
  const repairLatinBinomial = (s) => {
    if (!s || typeof s !== 'string') return s;
    const t = s.trim();
    // Only attempt when it looks like Latin and no Japanese
    if (/[\u3040-\u30FF\u3400-\u9FFF]/.test(t)) return t;
    // If already binomial, normalize to a single space
    const spaced = t.match(/^([A-Z][a-z]+)\s+([a-z-]{3,})(.*)$/);
    if (spaced) return `${spaced[1]} ${spaced[2]}${spaced[3] || ''}`.trim();
    // Otherwise, repair compact form
    const m = t.replace(/\s+/g, '').match(/^([A-Z][a-z]+)([a-z-]{3,})(.*)$/);
    return m ? `${m[1]} ${m[2]}${m[3] || ''}`.trim() : t;
  };
  const findBySlugOrId = (list = [], slugOrId) => {
    if (!slugOrId) return null;
    const decoded = decodeSlug(slugOrId);
    const normalizedSlug = slugifyInsectName(decoded);
    return (
      list.find((m) => slugifyInsectName(m.name) === normalizedSlug) ||
      list.find((m) => m.id === decoded || m.id === slugOrId)
    );
  };

  const getCurrentSpeciesInfo = () => {
    const normalizedPath = stripLocalePrefix(location.pathname || '/');
    const [, routeSegment, slug] = normalizedPath.split('/');

    if (routeSegment === 'plant' && slug) {
      // decodeURIComponentは不正な%エンコードでthrowする。Headerはエラーバウンダリの
      // 外にあり、ここで例外が出るとアプリ全体が白画面になるため必ずガード付きで復号する
      const plantName = decodeSlug(slug);
      const displayName = repairLatinBinomial(plantName);
      const plantDetail = plantDetails[plantName];
      if (plantDetail) {
        const scientificPlantName = repairLatinBinomial(plantDetail.scientificName || '');
        return {
          type: 'plant',
          name: isEnglish ? (scientificPlantName || displayName) : displayName,
          scientificName: scientificPlantName,
          family: isEnglish
            ? (plantDetail.familyLatin || plantDetail.family || '')
            : plantDetail.family,
          genus: plantDetail.genus
        };
      }
      return null;
    }

    const section = getSectionConfigByRouteSegment(routeSegment);
    if (!section || section.type === 'plant' || !slug) {
      return null;
    }

    const insect = findBySlugOrId(insectListsByType[section.type], slug);
    if (insect) {
      const familyLabel = isEnglish
        ? (insect.classification?.family || insect.classification?.familyJapanese || '')
        : (insect.classification?.familyJapanese || insect.classification?.family || '');
      return {
        type: section.type,
        name: isEnglish ? (insect.scientificName || insect.name) : insect.name,
        scientificName: insect.scientificName,
        classification: {
          ...insect.classification,
          familyLabel,
        }
      };
    }
    return null;
  };

  const speciesInfo = getCurrentSpeciesInfo();
  const headerRef = useRef(null);
  const homePath = localizePath('/', locale);
  const quizPath = localizePath('/quiz', locale);
  // ヘッダーにナビ項目は置かない（昆虫/植物はタブ＋パンくず、その他はフッターで回遊）。

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return undefined;
    const root = document.documentElement;
    const update = () => {
      const h = headerRef.current
        ? headerRef.current.getBoundingClientRect().height
        : 0;
      root.style.setProperty('--app-main-header-height', `${Math.max(0, Math.round(h))}px`);
    };
    update();
    window.addEventListener('resize', update, { passive: true });
    return () => {
      window.removeEventListener('resize', update);
      root.style.setProperty('--app-main-header-height', '0px');
    };
  }, [speciesInfo]);

  return (
    <header ref={headerRef} className="bg-gradient-to-r from-slate-900 via-emerald-900/30 to-slate-900 dark:from-slate-950 dark:via-emerald-950/30 dark:to-slate-950 backdrop-blur-xl border-b border-emerald-600/20 dark:border-emerald-500/20 shadow-2xl relative z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-2.5 py-3 sm:min-h-20 sm:py-2">
          <Link to={homePath} className="group flex min-w-0 flex-1 items-center gap-2.5 transition-transform duration-200 sm:gap-3 sm:hover:scale-105">
            <div className="relative">
              {/* タイル背景はサイトアイコン（favicon）と同じ緑→青緑の2色グラデに統一 */}
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 shadow-lg transition-all duration-300 group-hover:rotate-3 group-hover:shadow-2xl group-hover:shadow-emerald-500/50 sm:h-12 sm:w-12">
                {/* サイトアイコンと同じ「かじられた葉」。食痕と主脈はマスクで透過させ、タイルのグラデーションを透かす。
                    タイル内で葉が小さく見えないよう、タイル幅の8割程度まで拡大して描画する */}
                <svg className="h-8 w-8 text-white drop-shadow-lg sm:h-10 sm:w-10" viewBox="0 0 64 64" aria-hidden="true">
                  <defs>
                    <mask id="logo-leaf-bite">
                      <rect width="64" height="64" fill="#fff" />
                      <circle cx="53" cy="25" r="8.5" fill="#000" />
                      <circle cx="45" cy="51" r="7" fill="#000" />
                      <circle cx="20" cy="16" r="5.5" fill="#000" />
                      <path d="M30 15 C30 27 32 40 36 51" fill="none" stroke="#000" strokeWidth="2.6" strokeLinecap="round" />
                    </mask>
                  </defs>
                  <path d="M32 10 C48 16 54 30 50 44 C46 54 36 56 30 54 C18 50 12 36 16 24 C19 15 26 11 32 10 Z" fill="currentColor" mask="url(#logo-leaf-bite)" />
                </svg>
              </div>
            </div>
            <div className="hidden min-w-0 sm:block">
              <div className="truncate text-2xl font-black bg-gradient-to-r from-emerald-100 via-white to-blue-100 bg-clip-text text-transparent group-hover:from-emerald-200 group-hover:via-teal-100 group-hover:to-blue-200 transition-all duration-500 tracking-tight xl:text-3xl">
                {isEnglish
                  ? 'Insects and Host Plants of Japan'
                  : '"繋がり"が見える昆虫植物図鑑'}
              </div>
              <p className="truncate text-sm text-emerald-300/90 font-semibold tracking-widest uppercase">
                {isEnglish ? 'Ecological links in Japan' : 'Insect Host Plant Explorer'}
              </p>
            </div>
            <div className="min-w-0 sm:hidden">
              {isEnglish ? (
                <div className="bg-gradient-to-r from-emerald-100 via-white to-blue-100 bg-clip-text text-[clamp(0.95rem,4.2vw,1.15rem)] font-black leading-none text-transparent">
                  <span className="block whitespace-nowrap">Insects &amp;</span>
                  <span className="block whitespace-nowrap">Host Plants</span>
                </div>
              ) : (
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="max-w-full truncate text-[0.68rem] font-semibold tracking-[0.18em] text-emerald-100/75">
                    &quot;繋がり&quot;が見える
                  </span>
                  <span className="bg-gradient-to-r from-emerald-100 via-white to-blue-100 bg-clip-text text-[clamp(1.15rem,4.7vw,1.4rem)] font-black leading-none text-transparent whitespace-nowrap">
                    昆虫植物図鑑
                  </span>
                </div>
              )}
            </div>
          </Link>
          
          <div className="flex flex-shrink-0 items-center gap-2 sm:gap-4">
            {/* Dynamic species classification info */}
            {speciesInfo && (
              <div className="hidden min-w-0 max-w-[16rem] lg:flex items-center space-x-3 bg-gradient-to-r from-emerald-500/10 to-blue-500/10 backdrop-blur-sm rounded-2xl px-5 py-2.5 border border-emerald-400/20 shadow-lg xl:max-w-xs">
                {speciesInfo.type === 'plant' ? (
                  <div className="flex items-center space-x-2">
                    <div className="text-sm">
                      <span className="text-white font-medium">
                        {isEnglish && speciesInfo.scientificName
                          ? formatScientificNameReact(speciesInfo.name)
                          : speciesInfo.name}
                      </span>
                      {speciesInfo.family && (
                        <>
                          {' '}
                          <Link
                            to={localizePath(`/?tab=plants&pfamily=${encodeURIComponent(speciesInfo.family)}`, locale)}
                            className="text-slate-300 ml-2 underline decoration-emerald-300/60 hover:decoration-emerald-400"
                            aria-label={
                              isEnglish
                                ? `Search plants in ${speciesInfo.family}`
                                : `${speciesInfo.family} の植物を検索`
                            }
                          >
                            ({speciesInfo.family})
                          </Link>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex min-w-0 items-center space-x-2">
                    <div className="truncate text-sm">
                      <span className="text-white font-medium">
                        {isEnglish && speciesInfo.scientificName
                          ? formatScientificNameReact(speciesInfo.name)
                          : speciesInfo.name}
                      </span>
                      {speciesInfo.classification?.familyLabel && (
                        <span className="text-slate-300 ml-2">({speciesInfo.classification.familyLabel})</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <LocaleSwitcher locale={locale} compact />

            <Link
              to={quizPath}
              className="group inline-flex min-h-[44px] items-center gap-2 rounded-2xl border border-amber-300/30 bg-amber-400/15 px-2.5 py-2 text-sm font-black text-amber-100 shadow-lg transition hover:bg-amber-400/25 focus:outline-none focus:ring-2 focus:ring-amber-300/50 sm:px-4 sm:py-2.5"
              aria-label={isEnglish ? 'Open four-choice quiz' : '4択図鑑を開く'}
            >
              {/* 「クイズ」と直感的に伝わる吹き出し＋？アイコン（旧: 書類アイコンは用途が伝わらなかった） */}
              <svg className="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087A9.72 9.72 0 0012 20.25z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.1 9.4a1.95 1.95 0 113.4 1.3c-.5.55-1.4.9-1.4 1.8v.25" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.6} d="M12.1 15.5h.01" />
              </svg>
              <span className="hidden sm:inline">{isEnglish ? 'Quiz' : '4択図鑑'}</span>
            </Link>
            
            <ThemeToggle theme={theme} setTheme={setTheme} locale={locale} variant="header" />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;

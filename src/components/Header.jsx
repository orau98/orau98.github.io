import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { SunIcon, MoonIcon } from '@heroicons/react/24/solid';
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
      const plantName = decodeURIComponent(slug);
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
        <div className="flex items-center justify-between gap-3 py-3 sm:h-20 sm:py-0">
          <Link to={homePath} className="group flex min-w-0 flex-1 items-center gap-2.5 transition-transform duration-200 sm:gap-3 sm:hover:scale-105">
            <div className="relative">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-blue-500 shadow-lg transition-all duration-300 group-hover:rotate-3 group-hover:shadow-2xl group-hover:shadow-emerald-500/50 sm:h-12 sm:w-12">
                <svg className="h-6 w-6 text-white drop-shadow-lg sm:h-7 sm:w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              </div>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-3xl font-black bg-gradient-to-r from-emerald-100 via-white to-blue-100 bg-clip-text text-transparent group-hover:from-emerald-200 group-hover:via-teal-100 group-hover:to-blue-200 transition-all duration-500 tracking-tight">
                {isEnglish
                  ? 'Insects and Host Plants of Japan'
                  : '"繋がり"が見える昆虫植物図鑑'}
              </h1>
              <p className="text-sm text-emerald-400/70 font-semibold tracking-widest uppercase">
                {isEnglish ? 'Ecological links in Japan' : 'Insect Host Plant Explorer'}
              </p>
            </div>
            <div className="min-w-0 sm:hidden">
              <h1 className="bg-gradient-to-r from-emerald-100 via-white to-blue-100 bg-clip-text text-[clamp(1rem,4.9vw,1.35rem)] font-black leading-[1.05] text-transparent">
                {isEnglish ? (
                  <>
                    <span className="block">Insects &amp;</span>
                    <span className="block">Host Plants</span>
                  </>
                ) : (
                  <>
                    <span className="block">"繋がり"が見える</span>
                    <span className="block">昆虫植物図鑑</span>
                  </>
                )}
              </h1>
            </div>
          </Link>
          
          <div className="flex flex-shrink-0 items-center gap-2 sm:gap-4">
            {/* Dynamic species classification info */}
            {speciesInfo && (
              <div className="hidden lg:flex items-center space-x-3 bg-gradient-to-r from-emerald-500/10 to-blue-500/10 backdrop-blur-sm rounded-2xl px-5 py-2.5 border border-emerald-400/20 shadow-lg">
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
                  <div className="flex items-center space-x-2">
                    <div className="text-sm">
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
            
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="group relative rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/20 to-blue-500/20 p-2.5 shadow-xl transition-all duration-300 hover:scale-110 hover:from-emerald-500/30 hover:to-blue-500/30 hover:shadow-emerald-500/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 dark:border-emerald-400/20 dark:from-emerald-500/10 dark:to-blue-500/10 dark:hover:from-emerald-500/20 dark:hover:to-blue-500/20 sm:p-3"
              aria-label={isEnglish ? 'Toggle theme' : 'テーマを切り替え'}
            >
              <div className="relative">
                {theme === 'dark' ? (
                  <SunIcon className="h-5 w-5 text-yellow-400 transition-all duration-300 group-hover:rotate-180 group-hover:text-yellow-300 sm:h-6 sm:w-6" />
                ) : (
                  <MoonIcon className="h-5 w-5 text-blue-400 transition-all duration-300 group-hover:-rotate-12 group-hover:text-blue-300 sm:h-6 sm:w-6" />
                )}
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-400/30 to-blue-400/30 rounded-full opacity-0 group-hover:opacity-100 transition-opacity blur-lg"></div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;

import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  NOINDEX_NOFOLLOW_ROBOTS,
  setRobotsMetaContent,
} from '../utils/robotsMeta';
import { isEnglishLocale, localizePath } from '../utils/locale';

const NotFoundPage = ({ locale = 'ja' }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const isEnglish = isEnglishLocale(locale);
  const [query, setQuery] = useState('');

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    const term = query.trim();
    if (!term) return;
    navigate(`${localizePath('/', locale)}?q=${encodeURIComponent(term)}`);
  };

  useEffect(() => {
    const prevTitle = document.title;
    const robots = document.querySelector('meta[name="robots"]');
    const prevRobots = robots ? robots.getAttribute('content') : null;
    setRobotsMetaContent(NOINDEX_NOFOLLOW_ROBOTS);
    document.title = isEnglish
      ? '404 | Page not found - Insects and Host Plants of Japan'
      : '404 | ページが見つかりません - 昆虫植物図鑑';

    return () => {
      document.title = prevTitle;
      if (robots && prevRobots != null) {
        robots.setAttribute('content', prevRobots);
      }
    };
  }, [isEnglish]);

  return (
    <section className="min-h-[60vh] px-4 py-12 flex items-center justify-center">
      <div className="w-full max-w-2xl rounded-3xl border border-slate-200/70 dark:border-slate-700/70 bg-white/90 dark:bg-slate-900/80 shadow-xl p-8 md:p-10 text-center">
        <p className="text-sm font-semibold tracking-wide text-emerald-600 dark:text-emerald-400 mb-2">
          404 Not Found
        </p>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-3">
          {isEnglish ? 'Page not found' : 'ページが見つかりません'}
        </h1>
        <p className="text-sm md:text-base text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
          {isEnglish
            ? 'The requested URL may have moved or does not exist.'
            : '指定されたURLは移動したか、存在しない可能性があります。'}
        </p>
        {location?.pathname && (
          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mb-6 break-all">
            URL: {location.pathname}
          </p>
        )}
        {/* その場で再検索できる回復動線 */}
        <form onSubmit={handleSearchSubmit} className="mb-6 flex items-center justify-center gap-2">
          <label htmlFor="notfound-search" className="sr-only">
            {isEnglish ? 'Search insects and plants' : '昆虫・植物を検索'}
          </label>
          <input
            id="notfound-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={isEnglish ? 'Search insects or plants…' : '昆虫名・植物名で検索…'}
            className="w-full max-w-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-transparent focus:ring-2 focus:ring-emerald-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
          />
          <button type="submit" className="ui-btn ui-btn-primary shrink-0">
            {isEnglish ? 'Search' : '検索'}
          </button>
        </form>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link to={localizePath('/', locale)} className="ui-btn ui-btn-primary">
            {isEnglish ? 'Go to homepage' : 'トップページへ戻る'}
          </Link>
          <Link to={localizePath('/?tab=insects', locale)} className="ui-btn ui-btn-secondary">
            {isEnglish ? 'Browse insects' : '昆虫一覧へ'}
          </Link>
          <Link to={localizePath('/?tab=plants', locale)} className="ui-btn ui-btn-secondary">
            {isEnglish ? 'Browse plants' : '植物一覧へ'}
          </Link>
        </div>
      </div>
    </section>
  );
};

export default NotFoundPage;

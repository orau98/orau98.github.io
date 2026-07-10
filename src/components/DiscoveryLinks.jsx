import { memo } from 'react';
import {
  getDiscoveryHubLinks,
  JAPANESE_PLANT_DISCOVERY_LINKS,
} from '../utils/discoveryLinks.js';
import { isEnglishLocale } from '../utils/locale.js';

const DiscoveryLinks = memo(({ locale = 'ja' }) => {
  const isEnglish = isEnglishLocale(locale);
  const hubLinks = getDiscoveryHubLinks(locale);

  return (
    <nav
      data-home-discovery-links
      aria-label={isEnglish ? 'Browse the database by topic' : '目的別の図鑑入口'}
      className="rounded-2xl border border-emerald-200/60 bg-white/85 p-4 shadow-lg backdrop-blur-xl dark:border-emerald-800/60 dark:bg-slate-800/85 sm:p-5"
    >
      <div className="mb-3">
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 sm:text-xl">
          {isEnglish ? 'Browse by topic' : '目的から探す'}
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {isEnglish
            ? 'Browse topic indexes for insects and their recorded host-plant relationships.'
            : '文献・図鑑に記録された昆虫と植物の関係を、一覧からたどれます。'}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {hubLinks.map((link) => (
          <a
            key={link.path}
            href={link.path}
            className="group flex min-h-20 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-left transition hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 motion-reduce:transform-none dark:border-slate-700 dark:bg-slate-900/50 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/30 dark:focus-visible:ring-offset-slate-900"
          >
            <span>
              <span className="block font-semibold text-emerald-800 dark:text-emerald-200">
                {link.label}
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                {link.description}
              </span>
            </span>
            <span
              aria-hidden="true"
              className="text-lg text-emerald-600 transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none motion-reduce:transition-none dark:text-emerald-300"
            >
              →
            </span>
          </a>
        ))}
      </div>

      {!isEnglish && (
        <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-700">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">
            身近な植物の記録を見る
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            植物ごとに、食草・寄主として記録された虫や幼虫を確認できます。
          </p>
          <div className="mt-2 flex gap-2 overflow-x-auto p-1 sm:flex-wrap sm:overflow-visible">
            {JAPANESE_PLANT_DISCOVERY_LINKS.map((link) => (
              <a
                key={link.path}
                href={link.path}
                className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-800 transition hover:border-blue-300 hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200 dark:hover:bg-blue-900/50 dark:focus-visible:ring-offset-slate-900"
              >
                {link.label}
              </a>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-slate-400 sm:hidden" aria-hidden="true">
            横にスクロールしてほかの植物を見る →
          </p>
        </div>
      )}
    </nav>
  );
});

DiscoveryLinks.displayName = 'DiscoveryLinks';

export default DiscoveryLinks;

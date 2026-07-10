import { Link } from 'react-router-dom';
import { isEnglishLocale, localizePath } from '../utils/locale';

const shouldPreserveNativeNavigation = (event) =>
  event.defaultPrevented ||
  event.button !== 0 ||
  event.metaKey ||
  event.ctrlKey ||
  event.shiftKey ||
  event.altKey;

const StaticPageLink = ({ href, className, children }) => {
  const handleClick = (event) => {
    if (shouldPreserveNativeNavigation(event)) return;
    event.preventDefault();
    if (typeof window !== 'undefined') {
      window.location.assign(href);
    }
  };

  return (
    <a href={href} onClick={handleClick} className={className}>
      {children}
    </a>
  );
};

const Footer = ({ locale = 'ja' }) => {
  const isEnglish = isEnglishLocale(locale);
  const metaBase = isEnglish ? 'en/meta' : 'meta';
  const appLinks = isEnglish
    ? [
        { to: localizePath('/quiz', locale), label: 'Four-choice quiz' },
      ]
    : [
        { to: localizePath('/quiz', locale), label: '4択図鑑' },
      ];
  const hubLink = (segment, label) => ({
    href: `${import.meta.env.BASE_URL}${metaBase}/${segment}/index.html`,
    label,
  });
  const utilityLinks = isEnglish
    ? [
        { href: `${import.meta.env.BASE_URL}sitemap.html`, label: 'Sitemap' },
        hubLink('moth', 'Moths'),
        hubLink('butterfly', 'Butterflies'),
        hubLink('beetle', 'Jewel beetles'),
        hubLink('longhornbeetle', 'Longhorn beetles'),
        hubLink('leafbeetle', 'Leaf beetles'),
        hubLink('aphid', 'Aphids'),
        hubLink('plant', 'Host plants'),
      ]
    : [
        { href: `${import.meta.env.BASE_URL}sitemap.html`, label: 'サイトマップ' },
        hubLink('moth', '蛾一覧'),
        hubLink('butterfly', '蝶一覧'),
        hubLink('beetle', 'タマムシ一覧'),
        hubLink('longhornbeetle', 'カミキリムシ一覧'),
        hubLink('leafbeetle', 'ハムシ一覧'),
        hubLink('aphid', 'アブラムシ一覧'),
        hubLink('plant', '食草・植物一覧'),
      ];
  return (
    <footer className="bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md shadow-sm mt-12">
      <div className="container mx-auto px-4 py-6 text-center text-neutral-500 dark:text-neutral-400">
        <p className="text-sm">
          {isEnglish
            ? 'A database built from personal field observation and collection records. Source code on '
            : '個人の観察・採集記録にもとづく図鑑データベースです。ソースコードは '}
          <a
            href="https://github.com/orau98/orau98.github.io"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            GitHub
          </a>
          {isEnglish ? '.' : ' で公開しています。'}
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs">
          {appLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="text-emerald-700 hover:underline dark:text-emerald-300"
            >
              {link.label}
            </Link>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs">
          {utilityLinks.map((link) => (
            <StaticPageLink
              key={link.href}
              href={link.href}
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              {link.label}
            </StaticPageLink>
          ))}
        </div>
      </div>
    </footer>
  );
};

export default Footer;

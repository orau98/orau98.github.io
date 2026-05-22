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
  const utilityLinks = isEnglish
    ? [
        { href: `${import.meta.env.BASE_URL}en/guides/`, label: 'Search guides' },
        { href: `${import.meta.env.BASE_URL}sitemap.html`, label: 'Sitemap' },
        { href: `${import.meta.env.BASE_URL}${metaBase}/moth/index.html`, label: 'All insect pages' },
        { href: `${import.meta.env.BASE_URL}${metaBase}/plant/index.html`, label: 'All plant pages' },
      ]
    : [
        { href: `${import.meta.env.BASE_URL}guides/`, label: '調べ方ガイド' },
        { href: `${import.meta.env.BASE_URL}sitemap.html`, label: 'サイトマップ' },
        { href: `${import.meta.env.BASE_URL}${metaBase}/moth/index.html`, label: '蛾メタ一覧' },
        { href: `${import.meta.env.BASE_URL}${metaBase}/plant/index.html`, label: '植物メタ一覧' },
      ];
  return (
    <footer className="bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md shadow-sm mt-12">
      <div className="container mx-auto px-4 py-6 text-center text-neutral-500 dark:text-neutral-400">
        <p className="text-sm">
          {isEnglish ? 'Curated private collection data. Source code on ' : 'Private collection data. Open source on '}
          <a 
            href="https://github.com/orau98/orau98.github.io" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            GitHub
          </a>.
        </p>
        <p className="text-xs mt-2">
          {isEnglish ? 'Built with React and Tailwind CSS.' : 'Built with React and Tailwind CSS.'}
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

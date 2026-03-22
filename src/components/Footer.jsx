import { isEnglishLocale } from '../utils/locale';

const Footer = ({ locale = 'ja' }) => {
  const isEnglish = isEnglishLocale(locale);
  const metaBase = isEnglish ? 'en/meta' : 'meta';
  const utilityLinks = isEnglish
    ? [
        { href: `${import.meta.env.BASE_URL}sitemap.html`, label: 'Sitemap' },
        { href: `${import.meta.env.BASE_URL}${metaBase}/moth/index.html`, label: 'All insect pages' },
        { href: `${import.meta.env.BASE_URL}${metaBase}/plant/index.html`, label: 'All plant pages' },
      ]
    : [
        { href: `${import.meta.env.BASE_URL}sitemap.html`, label: 'サイトマップ' },
        { href: `${import.meta.env.BASE_URL}${metaBase}/moth/index.html`, label: '蛾メタ一覧' },
        { href: `${import.meta.env.BASE_URL}${metaBase}/plant/index.html`, label: '植物メタ一覧' },
      ];
  const topicLinks = isEnglish
    ? [
        { href: `${import.meta.env.BASE_URL}topics/index.html`, label: 'Topic guides' },
        { href: `${import.meta.env.BASE_URL}topics/sakura-insects.html`, label: 'Insects on cherry trees' },
        { href: `${import.meta.env.BASE_URL}topics/kunugi-insects.html`, label: 'Insects on sawtooth oak' },
      ]
    : [
        { href: `${import.meta.env.BASE_URL}topics/index.html`, label: '特集ページ一覧' },
        { href: `${import.meta.env.BASE_URL}topics/sakura-insects.html`, label: 'サクラにつく虫' },
        { href: `${import.meta.env.BASE_URL}topics/kunugi-insects.html`, label: 'クヌギにつく虫' },
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
          {utilityLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              {link.label}
            </a>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs">
          {topicLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
};

export default Footer;

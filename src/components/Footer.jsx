import { isEnglishLocale } from '../utils/locale';

const Footer = ({ locale = 'ja' }) => {
  const isEnglish = isEnglishLocale(locale);
  const metaBase = isEnglish ? 'en/meta' : 'meta';
  return (
    <footer className="bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md shadow-sm mt-12">
      <div className="container mx-auto px-4 py-6 text-center text-neutral-500 dark:text-neutral-400">
        <p className="text-sm">
          {isEnglish ? 'Private collection data. Open source on ' : 'Private collection data. Open source on '}
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
        <div className="text-xs mt-3 space-x-4">
          <a 
            href={`${import.meta.env.BASE_URL}privacy-policy.html`}
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            {isEnglish ? 'Privacy policy' : 'プライバシーポリシー'}
          </a>
          <span className="text-neutral-400">|</span>
          <a 
            href={`${import.meta.env.BASE_URL}terms-of-service.html`}
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            {isEnglish ? 'Terms' : '利用規約'}
          </a>
          <span className="text-neutral-400">|</span>
          <a 
            href={`${import.meta.env.BASE_URL}sitemap.html`}
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            {isEnglish ? 'Sitemap' : 'サイトマップ'}
          </a>
          <span className="text-neutral-400">|</span>
          <a 
            href={`${import.meta.env.BASE_URL}${metaBase}/moth/index.html`}
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            {isEnglish ? 'Moth meta pages' : '蛾メタ一覧'}
          </a>
          <span className="text-neutral-400">|</span>
          <a 
            href={`${import.meta.env.BASE_URL}${metaBase}/plant/index.html`}
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            {isEnglish ? 'Plant meta pages' : '植物メタ一覧'}
          </a>
        </div>
        <div className="text-xs mt-3 space-x-4">
          <a
            href={`${import.meta.env.BASE_URL}topics/index.html`}
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            {isEnglish ? 'Topics' : '特集ページ一覧'}
          </a>
          <span className="text-neutral-400">|</span>
          <a
            href={`${import.meta.env.BASE_URL}topics/sakura-insects.html`}
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            {isEnglish ? 'Insects on cherry trees' : 'サクラにつく虫'}
          </a>
          <span className="text-neutral-400">|</span>
          <a
            href={`${import.meta.env.BASE_URL}topics/kunugi-insects.html`}
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            {isEnglish ? 'Insects on sawtooth oak' : 'クヌギにつく虫'}
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

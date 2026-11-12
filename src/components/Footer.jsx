import { Link } from 'react-router-dom';
import { isEnglishLocale, localizePath } from '../utils/locale';
import { CONTACT_FORM_URL, SITE_POLICY_PATH } from '../utils/siteContact';

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
  // 検索ハブは自己canonicalの静的シェルを持つ着地ページ（/moth/・/plant/）。
  // 末尾スラッシュ付きで書かないと GitHub Pages 直リンク時に301を挟む。
  const appLinks = isEnglish
    ? [
        { to: '/en/moth/', label: 'Insect search' },
        { to: '/en/plant/', label: 'Plant search' },
        { to: localizePath('/quiz', locale), label: 'Four-choice quiz' },
      ]
    : [
        { to: '/moth/', label: '昆虫から食草を検索' },
        { to: '/plant/', label: '植物から昆虫を逆引き検索' },
        { to: localizePath('/quiz', locale), label: '4択クイズ' },
      ];
  const hubLink = (segment, label) => ({
    // 日本語の名前一覧は、検索画面へ置き換わる旧metaハブではなく
    // 各分類の全詳細へたどれるHTML一覧を使う。
    href: isEnglish
      ? `${import.meta.env.BASE_URL}${metaBase}/${segment}/index.html`
      : `${import.meta.env.BASE_URL}sitemap/${segment}/`,
    label,
  });
  const utilityLinks = isEnglish
    ? [
        { href: `${import.meta.env.BASE_URL}sitemap.html`, label: 'Sitemap' },
        hubLink('moth', 'Moths'),
        hubLink('butterfly', 'Butterflies'),
        hubLink('beetle', 'Jewel beetles'),
        hubLink('longhornbeetle', 'Longhorn beetles'),
        hubLink('barkbeetle', 'Bark beetles'),
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
        hubLink('barkbeetle', 'キクイムシ一覧'),
        hubLink('leafbeetle', 'ハムシ一覧'),
        hubLink('aphid', 'アブラムシ一覧'),
        hubLink('plant', '食草・植物一覧'),
      ];
  return (
    <footer className="bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md shadow-sm mt-12">
      <div className="container mx-auto px-4 py-6 text-center text-neutral-600 dark:text-neutral-300">
        <p className="text-sm">
          {isEnglish
            ? 'A database built from personal field observation and collection records. Source code on '
            : '個人の観察・採集記録にもとづく図鑑データベースです。ソースコードは '}
          <a
            href="https://github.com/orau98/orau98.github.io"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-700 dark:text-blue-300 hover:underline"
          >
            GitHub
          </a>
          {isEnglish ? '.' : ' で公開しています。'}
        </p>
        {/* リンクは指で押しやすいよう高さ32px以上・間隔を広めにする（以前は高さ16pxで隣と近かった） */}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm">
          {appLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="inline-flex min-h-[32px] items-center text-emerald-800 hover:underline dark:text-emerald-300"
            >
              {link.label}
            </Link>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm">
          {utilityLinks.map((link) => (
            <StaticPageLink
              key={link.href}
              href={link.href}
              className="inline-flex min-h-[32px] items-center text-blue-700 dark:text-blue-300 hover:underline"
            >
              {link.label}
            </StaticPageLink>
          ))}
        </div>
        {/* 誤りの報告先・サイトの方針（免責・写真・プライバシー）へは、どのページからも行けるようにする */}
        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm">
          <a
            href={CONTACT_FORM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[32px] items-center font-semibold text-slate-700 hover:underline dark:text-slate-200"
          >
            {isEnglish ? 'Report an error / Contact' : '誤りの報告・お問い合わせ'}
          </a>
          <StaticPageLink
            href={`${import.meta.env.BASE_URL}${SITE_POLICY_PATH}`}
            className="inline-flex min-h-[32px] items-center text-slate-700 hover:underline dark:text-slate-200"
          >
            {isEnglish ? 'About this site / Privacy policy' : 'サイトについて・プライバシーポリシー'}
          </StaticPageLink>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

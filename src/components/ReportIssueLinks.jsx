import { CONTACT_FORM_URL, SITE_POLICY_PATH } from '../utils/siteContact';

/**
 * 個別ページの「誤りを報告」。以前は報告先（Googleフォーム）がトップページ最下部の折りたたみの中にしか無く、
 * 種や植物のページで誤りに気づいても報告の仕方が分からなかった
 */
const ReportIssueLinks = ({ isEnglish = false, className = '' }) => (
  <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-sm ${className}`}>
    <a
      href={CONTACT_FORM_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-[40px] items-center gap-1.5 font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4 hover:text-emerald-700 hover:decoration-emerald-400 dark:text-slate-200 dark:decoration-slate-600 dark:hover:text-emerald-300"
    >
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m0 3.75h.008M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
      {isEnglish ? 'Report an error on this page' : 'このページの誤りを報告'}
    </a>
    <a
      href={`${import.meta.env.BASE_URL}${SITE_POLICY_PATH}`}
      className="inline-flex min-h-[40px] items-center text-slate-600 underline decoration-slate-300 underline-offset-4 hover:text-emerald-700 dark:text-slate-300 dark:decoration-slate-600 dark:hover:text-emerald-300"
    >
      {isEnglish ? 'About this site' : 'サイトについて'}
    </a>
  </div>
);

export default ReportIssueLinks;

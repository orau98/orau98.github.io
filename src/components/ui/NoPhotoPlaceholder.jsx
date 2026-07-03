import React from 'react';

/**
 * 画像未掲載・読み込み失敗時のプレースホルダー。
 *
 * 経緯: 従来は汎用の「風景写真」アイコンを全画面で使い回しており、
 * 昆虫・植物の図鑑という文脈では「何を意味するアイコンなのか」が一目で
 * 伝わらなかった。被写体のシルエット（チョウ・甲虫・芽生え）に小さな
 * カメラバッジを重ねることで「この生き物の写真がまだ無い」ことを
 * 言葉に頼らず伝える。
 */

/**
 * 昆虫の種別キー（siteTaxonomy の type）からシルエットを選ぶ。
 * 植物は 'plant' を渡す。
 */
export const resolvePlaceholderSubject = (insectType) => {
  switch (insectType) {
    case 'beetle':
    case 'longhornbeetle':
    case 'leafbeetle':
    case 'aphid':
      return 'bug';
    case 'plant':
      return 'sprout';
    case 'moth':
    case 'butterfly':
    default:
      return 'butterfly';
  }
};

const SILHOUETTES = {
  // チョウ（蛾・蝶）
  butterfly: (
    <>
      <g fill="currentColor">
        <path d="M11.2 12.3C10.9 9.2 8.9 6.3 6.2 5.3 4.4 4.6 2.7 5.6 2.7 7.5c0 2.9 3.5 4.9 8.5 5.2z" />
        <path d="M12.8 12.3c.3-3.1 2.3-6 5-7 1.8-.7 3.5.3 3.5 2.2 0 2.9-3.5 4.9-8.5 5.2z" />
        <path d="M11.3 13.2c-4.1.1-6.9 1.7-6.9 4 0 1.6 1.3 2.8 2.9 2.8 2.3 0 3.8-2.1 4-5.2z" />
        <path d="M12.7 13.2c4.1.1 6.9 1.7 6.9 4 0 1.6-1.3 2.8-2.9 2.8-2.3 0-3.8-2.1-4-5.2z" />
        <rect x="11.2" y="9" width="1.6" height="9.4" rx="0.8" />
        <circle cx="12" cy="7.9" r="1.15" />
      </g>
      <path
        d="M11.4 7.1C10.7 5.9 9.9 5.1 8.9 4.6M12.6 7.1c.7-1.2 1.5-2 2.5-2.5"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        fill="none"
      />
    </>
  ),
  // 甲虫（タマムシ・カミキリムシ・ハムシ・アブラムシ）
  // 頭部・前胸背板・左右の上翅を分け、合わせ目（縦の割れ線）で「甲虫」と分かる形にする
  bug: (
    <>
      <g fill="currentColor">
        <circle cx="12" cy="5.3" r="1.5" />
        <path d="M12 6.6c1.8 0 3 .8 3 1.9 0 .9-1.2 1.5-3 1.5s-3-.6-3-1.5c0-1.1 1.2-1.9 3-1.9z" />
        <path d="M11.7 10.6H9.6c-1.5.3-2.5 1.7-2.5 3.6 0 3.1 1.9 5.7 4.6 6.3z" />
        <path d="M12.3 10.6h2.1c1.5.3 2.5 1.7 2.5 3.6 0 3.1-1.9 5.7-4.6 6.3z" />
      </g>
      <g stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M11.1 4.3C10 3.4 8.6 3 7 3.3M12.9 4.3c1.1-.9 2.5-1.3 4.1-1" />
        <path d="M9.2 9 6.7 8.3 5 9M8.4 13.2l-2.9-.4-1.9 1.3M8.9 16.9l-2.4 1.4-.7 2.4" />
        <path d="M14.8 9l2.5-.7L19 9M15.6 13.2l2.9-.4 1.9 1.3M15.1 16.9l2.4 1.4.7 2.4" />
      </g>
    </>
  ),
  // 芽生え（植物）
  sprout: (
    <>
      <path
        d="M12 21.2v-7.4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />
      <g fill="currentColor">
        <path d="M12.2 14.3c.2-4.8 3.6-8.2 8.6-8.5.4 0 .7.3.6.7-.4 4.9-3.8 7.9-9.2 7.8z" />
        <path d="M11.8 14.3C11.6 10.9 9.2 8.5 5.6 8.3c-.4 0-.7.3-.6.7.3 3.5 2.8 5.6 6.8 5.3z" />
      </g>
    </>
  ),
};

export const SubjectSilhouette = ({ subject = 'butterfly', className = '' }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    {SILHOUETTES[subject] || SILHOUETTES.butterfly}
  </svg>
);

export const CameraGlyph = ({ className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    aria-hidden="true"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 19h16a1.5 1.5 0 0 0 1.5-1.5V8.6A1.6 1.6 0 0 0 19.9 7h-2.6a1.4 1.4 0 0 1-1.17-.63l-.86-1.3A1.6 1.6 0 0 0 13.94 4h-3.88a1.6 1.6 0 0 0-1.33 1.07l-.86 1.3A1.4 1.4 0 0 1 6.7 7H4.1a1.6 1.6 0 0 0-1.6 1.6v8.9A1.5 1.5 0 0 0 4 19z" />
    <circle cx="12" cy="12.5" r="3.4" />
  </svg>
);

// シルエットとカメラバッジの寸法セット
const SIZE_STYLES = {
  sm: {
    silhouette: 'w-9 h-9',
    badge: '-right-1.5 -bottom-0.5 h-4 w-4 p-[2px]',
    label: 'text-[10px]',
    gap: 'gap-0.5',
  },
  md: {
    silhouette: 'w-12 h-12',
    badge: '-right-2 -bottom-0.5 h-5 w-5 p-[3px]',
    label: 'text-xs',
    gap: 'gap-1',
  },
  lg: {
    silhouette: 'w-16 h-16',
    badge: '-right-2.5 -bottom-1 h-7 w-7 p-1',
    label: 'text-xs',
    gap: 'gap-1.5',
  },
};

/**
 * 被写体シルエット + カメラバッジ（+ 任意のラベル）。
 * 色は親の text-* を継承する（シルエットは currentColor で描画）。
 */
const NoPhotoPlaceholder = ({
  subject = 'butterfly',
  size = 'md',
  label,
  className = '',
  labelClassName = '',
}) => {
  const s = SIZE_STYLES[size] || SIZE_STYLES.md;
  return (
    <div className={`flex flex-col items-center justify-center ${s.gap} ${className}`}>
      <div className="relative">
        <SubjectSilhouette subject={subject} className={s.silhouette} />
        <span
          className={`absolute flex items-center justify-center rounded-full bg-white/95 text-slate-500 shadow-sm ring-1 ring-slate-300/70 dark:bg-slate-900/90 dark:text-slate-300 dark:ring-slate-600/70 ${s.badge}`}
        >
          <CameraGlyph className="h-full w-full" />
        </span>
      </div>
      {label && <span className={`${s.label} font-medium ${labelClassName}`}>{label}</span>}
    </div>
  );
};

export default NoPhotoPlaceholder;

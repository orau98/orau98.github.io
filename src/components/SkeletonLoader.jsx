// 実際の初期画面（ヒーロー＋種一覧カードグリッド）に合わせたスケルトン。
// 読み込み完了時のレイアウトシフト（CLS）を抑えるため、
// カードの縦横比・カラム数を MothList の実グリッドと揃えている。
const SkeletonCard = () => (
  <div className="overflow-hidden rounded-xl border border-slate-200/70 bg-white/80 shadow-md dark:border-slate-700/50 dark:bg-slate-800/80">
    <div className="aspect-[4/3] bg-slate-200/70 dark:bg-slate-700/60" />
    <div className="space-y-3 p-4">
      <div className="h-4 w-3/4 rounded-md bg-slate-200/70 dark:bg-slate-700/60" />
      <div className="h-3 w-1/2 rounded-md bg-slate-200/60 dark:bg-slate-700/50" />
      <div className="h-3 w-2/3 rounded-md bg-slate-200/60 dark:bg-slate-700/50" />
    </div>
  </div>
);

const SkeletonLoader = () => {
  return (
    <div className="animate-pulse space-y-6" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">読み込み中…</span>
      {/* ヒーロー相当のブロック */}
      <div aria-hidden="true" className="h-40 rounded-2xl bg-gradient-to-br from-slate-300/60 to-slate-200/60 dark:from-slate-800/80 dark:to-slate-900/80 sm:h-44 sm:rounded-3xl" />
      {/* 種一覧カードグリッド相当 */}
      <div aria-hidden="true" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
};

// 詳細ページ（昆虫・植物）用のスケルトン。
// 実レイアウト（チップ行 → lg:2カラムの写真＋情報カード）に骨格を合わせ、
// 一覧用SkeletonLoaderを流用した場合の大きなレイアウトシフトを防ぐ。
export const DetailSkeleton = () => {
  return (
    <div className="mx-auto max-w-7xl animate-pulse space-y-6 px-4 pt-4 pb-8 sm:pt-8" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">読み込み中…</span>
      {/* パンくず＋チップ行相当 */}
      <div aria-hidden="true" className="space-y-3">
        <div className="h-3 w-48 rounded-md bg-slate-200/70 dark:bg-slate-700/60" />
        <div className="flex gap-2">
          <div className="h-8 w-24 rounded-full bg-slate-200/70 dark:bg-slate-700/60" />
          <div className="h-8 w-20 rounded-full bg-slate-200/60 dark:bg-slate-700/50" />
          <div className="h-8 w-20 rounded-full bg-slate-200/60 dark:bg-slate-700/50" />
        </div>
      </div>
      {/* 写真パネル＋情報カラム相当 */}
      <div aria-hidden="true" className="space-y-6 lg:grid lg:grid-cols-5 lg:items-start lg:gap-6 lg:space-y-0">
        <div className="lg:col-span-3">
          <div className="aspect-[4/3] rounded-2xl bg-slate-200/70 dark:bg-slate-700/60" />
        </div>
        <div className="space-y-4 lg:col-span-2">
          <div className="space-y-3 rounded-2xl border border-slate-200/70 bg-white/80 p-6 dark:border-slate-700/50 dark:bg-slate-800/80">
            <div className="h-7 w-2/3 rounded-md bg-slate-200/70 dark:bg-slate-700/60" />
            <div className="h-4 w-1/2 rounded-md bg-slate-200/60 dark:bg-slate-700/50" />
          </div>
          <div className="space-y-3 rounded-2xl border border-slate-200/70 bg-white/80 p-6 dark:border-slate-700/50 dark:bg-slate-800/80">
            <div className="h-5 w-1/3 rounded-md bg-slate-200/70 dark:bg-slate-700/60" />
            <div className="h-10 w-full rounded-lg bg-slate-200/60 dark:bg-slate-700/50" />
            <div className="h-10 w-full rounded-lg bg-slate-200/60 dark:bg-slate-700/50" />
            <div className="h-10 w-5/6 rounded-lg bg-slate-200/60 dark:bg-slate-700/50" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SkeletonLoader;

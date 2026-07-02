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
    <div className="animate-pulse space-y-6">
      {/* ヒーロー相当のブロック */}
      <div className="h-40 rounded-2xl bg-gradient-to-br from-slate-300/60 to-slate-200/60 dark:from-slate-800/80 dark:to-slate-900/80 sm:h-44 sm:rounded-3xl" />
      {/* 種一覧カードグリッド相当 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
};

export default SkeletonLoader;

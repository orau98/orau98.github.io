import React from 'react';

// 安全重視の簡易スタブ版
// 既存のAPIシグネチャを維持しつつ、描画をスキップしてビルド失敗を防ぐ
const FoodWebGraph = React.memo(function FoodWebGraphStub({
  width,
  height
}) {
  return (
    <div
      className="w-full h-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/70 flex items-center justify-center text-slate-500 dark:text-slate-400 text-sm"
      style={{ minHeight: height || 400 }}
    >
      ネットワーク図は一時的に表示を省略しています
    </div>
  );
});

export default FoodWebGraph;

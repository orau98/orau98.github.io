import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const NotFoundPage = () => {
  const location = useLocation();

  return (
    <section className="min-h-[60vh] px-4 py-12 flex items-center justify-center">
      <div className="w-full max-w-2xl rounded-3xl border border-slate-200/70 dark:border-slate-700/70 bg-white/90 dark:bg-slate-900/80 shadow-xl p-8 md:p-10 text-center">
        <p className="text-sm font-semibold tracking-wide text-emerald-600 dark:text-emerald-400 mb-2">
          404 Not Found
        </p>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-3">
          ページが見つかりません
        </h1>
        <p className="text-sm md:text-base text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
          指定されたURLは移動したか、存在しない可能性があります。
        </p>
        {location?.pathname && (
          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mb-6 break-all">
            URL: {location.pathname}
          </p>
        )}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link to="/" className="ui-btn ui-btn-primary">
            トップページへ戻る
          </Link>
          <Link to="/?tab=insects" className="ui-btn ui-btn-secondary">
            昆虫一覧へ
          </Link>
          <Link to="/?tab=plants" className="ui-btn ui-btn-secondary">
            植物一覧へ
          </Link>
        </div>
      </div>
    </section>
  );
};

export default NotFoundPage;

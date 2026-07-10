import React from 'react';
import logger from '../utils/logger';
import {
  isChunkLoadError,
  recoverFromChunkLoadError,
} from '../utils/chunkRecovery';

/**
 * Catches lazy component failures without leaving a blank page.
 * Missing/stale Vite chunks require a document reload; retrying the same
 * dynamic-import URL cannot recover them.
 */
export default class ChunkErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      error: null,
      isChunkError: false,
      recoveryPending: false,
    };
  }

  static getDerivedStateFromError(error) {
    const isChunkError = isChunkLoadError(error);
    return {
      error,
      isChunkError,
      recoveryPending: isChunkError,
    };
  }

  componentDidCatch(error, info) {
    try {
      logger.error('Lazy chunk load failed:', error, info);
    } catch {
      // ignore logging errors
    }

    if (!isChunkLoadError(error)) return;

    // Normally main.jsx handles vite:preloadError before React receives it.
    // Keep this boundary path for browsers/errors that reach React directly.
    if (!recoverFromChunkLoadError()) {
      this.setState({ recoveryPending: false });
    }
  }

  handleRetry = () => {
    recoverFromChunkLoadError({ force: true });
  };

  render() {
    const { error, isChunkError, recoveryPending } = this.state;
    const { fallback } = this.props;

    if (error && !isChunkError) {
      return (
        <div className="max-w-3xl mx-auto my-10 p-6 rounded-2xl border border-amber-300 bg-amber-50 dark:bg-amber-900/30 dark:border-amber-700 text-amber-900 dark:text-amber-200 shadow-sm">
          <p className="font-semibold mb-2">ページの表示中に問題が発生しました</p>
          <p className="text-sm mb-4 text-amber-800 dark:text-amber-300">
            URLが正しくない可能性があります。トップページからやり直してください。
          </p>
          <a
            href={import.meta.env.BASE_URL || '/'}
            className="inline-block px-4 py-2 min-h-[44px] rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition"
          >
            トップページへ戻る
          </a>
        </div>
      );
    }

    if (error) {
      if (fallback) {
        return typeof fallback === 'function'
          ? fallback({ error, retry: this.handleRetry })
          : fallback;
      }

      return (
        <div className="max-w-3xl mx-auto my-10 p-6 rounded-2xl border border-amber-300 bg-amber-50 dark:bg-amber-900/30 dark:border-amber-700 text-amber-900 dark:text-amber-200 shadow-sm">
          <p className="font-semibold mb-2">ページの読み込みに失敗しました</p>
          <p className="text-sm mb-4 text-amber-800 dark:text-amber-300">
            {recoveryPending
              ? 'サイトの最新版へ自動で接続し直しています。'
              : '自動復旧が続けて失敗しました。通信状態を確認して再読み込みしてください。'}
          </p>
          {recoveryPending && (
            <div className="mb-4 flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              最新版を確認中...
            </div>
          )}
          <button
            onClick={this.handleRetry}
            disabled={recoveryPending}
            className="px-4 py-2 min-h-[44px] rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {recoveryPending ? '再接続中...' : 'ページを再読み込み'}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

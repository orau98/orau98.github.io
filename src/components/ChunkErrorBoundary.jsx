import React from 'react';
import logger from '../utils/logger';

/**
 * Catches failures from React.lazy (e.g., chunk 429/404) and shows
 * a lightweight retry UI instead of leaving a blank page.
 * 自動リトライ機能付き（最大3回まで）
 */
export default class ChunkErrorBoundary extends React.Component {
  static MAX_AUTO_RETRIES = 3;
  static RETRY_DELAYS = [1000, 2000, 4000]; // 指数バックオフ

  constructor(props) {
    super(props);
    this.state = { error: null, attempt: 0, autoRetrying: false, autoRetryCount: 0 };
    this.autoRetryTimeoutRef = null;
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    try {
      logger.error('Lazy chunk load failed:', error, info);
    } catch {
      // ignore logging errors
    }

    // 自動リトライを開始
    this.scheduleAutoRetry();
  }

  componentWillUnmount() {
    if (this.autoRetryTimeoutRef) {
      clearTimeout(this.autoRetryTimeoutRef);
    }
  }

  scheduleAutoRetry = () => {
    const { autoRetryCount } = this.state;

    if (autoRetryCount >= ChunkErrorBoundary.MAX_AUTO_RETRIES) {
      this.setState({ autoRetrying: false });
      return;
    }

    const delay = ChunkErrorBoundary.RETRY_DELAYS[autoRetryCount] || 4000;
    this.setState({ autoRetrying: true });

    this.autoRetryTimeoutRef = setTimeout(() => {
      this.setState((prev) => ({
        error: null,
        attempt: prev.attempt + 1,
        autoRetryCount: prev.autoRetryCount + 1,
        autoRetrying: false,
      }));
      if (typeof this.props.onRetry === 'function') {
        this.props.onRetry();
      }
    }, delay);
  };

  handleRetry = () => {
    // 手動リトライ時はカウンターをリセット
    if (this.autoRetryTimeoutRef) {
      clearTimeout(this.autoRetryTimeoutRef);
    }
    this.setState((prev) => ({
      error: null,
      attempt: prev.attempt + 1,
      autoRetrying: false,
      autoRetryCount: 0
    }));
    if (typeof this.props.onRetry === 'function') {
      this.props.onRetry();
    }
  };

  render() {
    const { error, attempt, autoRetrying, autoRetryCount } = this.state;
    const { fallback } = this.props;

    if (error) {
      if (fallback) {
        return typeof fallback === 'function'
          ? fallback({ error, retry: this.handleRetry })
          : fallback;
      }

      return (
        <div className="max-w-3xl mx-auto my-10 p-6 rounded-2xl border border-amber-300 bg-amber-50 dark:bg-amber-900/30 dark:border-amber-700 text-amber-900 dark:text-amber-200 shadow-sm">
          <p className="font-semibold mb-2">データの読み込みに失敗しました</p>
          <p className="text-sm mb-4 text-amber-800 dark:text-amber-300">
            通信が混み合っているか、一時的にアクセスできない状態です。
            {autoRetrying ? (
              <span className="block mt-2">
                自動で再試行しています... ({autoRetryCount + 1}/{ChunkErrorBoundary.MAX_AUTO_RETRIES})
              </span>
            ) : autoRetryCount >= ChunkErrorBoundary.MAX_AUTO_RETRIES ? (
              <span className="block mt-2">
                自動リトライに失敗しました。手動で再試行してください。
              </span>
            ) : null}
          </p>
          {autoRetrying && (
            <div className="mb-4 flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              再接続中...
            </div>
          )}
          <button
            onClick={this.handleRetry}
            disabled={autoRetrying}
            className="px-4 py-2 min-h-[44px] rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {autoRetrying ? '再試行中...' : 'もう一度読み込む'}
          </button>
        </div>
      );
    }

    // Remount children when retrying to trigger a fresh dynamic import
    return <React.Fragment key={attempt}>{this.props.children}</React.Fragment>;
  }
}

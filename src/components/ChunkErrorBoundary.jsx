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
  // デプロイ直後は旧HTMLが参照するハッシュ付きチャンクが恒久404になるため、
  // リトライ枯渇時は新しいindex.htmlを取り直すハードリロードで復旧する
  static RELOAD_FLAG = 'chunk-error-hard-reloaded';
  // フラグ解除はマウント直後ではなく「しばらく安定表示できた後」に行う。
  // マウント直後に解除すると、リロード→即エラーのループでガードが毎回消され
  // 無限ハードリロードになる
  static RELOAD_FLAG_CLEAR_DELAY_MS = 10000;

  // 動的import（チャンク読み込み）の失敗だけが自動リトライ・ハードリロードの対象。
  // 子コンポーネントのレンダー例外（URIError等）まで通信障害と誤分類すると、
  // 決定的なエラーなのに「通信が混み合っています」+リロードの無限ループになる
  static isChunkLoadError(error) {
    const text = `${error?.name || ''} ${error?.message || ''}`;
    return /ChunkLoadError|Loading chunk|dynamically imported module|Importing a module script failed|Failed to fetch/i.test(
      text,
    );
  }

  constructor(props) {
    super(props);
    this.state = { error: null, isChunkError: false, attempt: 0, autoRetrying: false, autoRetryCount: 0 };
    this.autoRetryTimeoutRef = null;
    this.flagClearTimeoutRef = null;
  }

  static getDerivedStateFromError(error) {
    return { error, isChunkError: ChunkErrorBoundary.isChunkLoadError(error) };
  }

  componentDidMount() {
    // 一定時間エラーなく表示できたら、次回デプロイでも再度ハードリロードできるようフラグを解除
    try {
      if (!this.state.error) {
        this.flagClearTimeoutRef = setTimeout(() => {
          try {
            sessionStorage.removeItem(ChunkErrorBoundary.RELOAD_FLAG);
          } catch {}
        }, ChunkErrorBoundary.RELOAD_FLAG_CLEAR_DELAY_MS);
      }
    } catch {
      // sessionStorage が使えない環境では何もしない
    }
  }

  componentDidCatch(error, info) {
    try {
      logger.error('Lazy chunk load failed:', error, info);
    } catch {
      // ignore logging errors
    }
    if (this.flagClearTimeoutRef) {
      clearTimeout(this.flagClearTimeoutRef);
      this.flagClearTimeoutRef = null;
    }

    // チャンク読み込み失敗のみ自動リトライ（それ以外は手動リトライUIで停止）
    if (ChunkErrorBoundary.isChunkLoadError(error)) {
      this.scheduleAutoRetry();
    }
  }

  componentWillUnmount() {
    if (this.autoRetryTimeoutRef) {
      clearTimeout(this.autoRetryTimeoutRef);
    }
    if (this.flagClearTimeoutRef) {
      clearTimeout(this.flagClearTimeoutRef);
    }
  }

  attemptHardReload = () => {
    try {
      if (sessionStorage.getItem(ChunkErrorBoundary.RELOAD_FLAG)) {
        return false;
      }
      sessionStorage.setItem(ChunkErrorBoundary.RELOAD_FLAG, '1');
    } catch {
      // sessionStorage が使えない場合は無限リロードを防げないため諦める
      return false;
    }
    window.location.reload();
    return true;
  };

  scheduleAutoRetry = () => {
    const { autoRetryCount } = this.state;

    if (autoRetryCount >= ChunkErrorBoundary.MAX_AUTO_RETRIES) {
      // 同一URLの再試行では直らない（=旧デプロイのチャンクが404）可能性が高いので
      // 一度だけページ全体を再読み込みして最新のアセット参照を取得する
      if (this.attemptHardReload()) {
        return;
      }
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
    if (this.autoRetryTimeoutRef) {
      clearTimeout(this.autoRetryTimeoutRef);
    }
    // 自動リトライが尽きた後の手動操作は、ユーザーの明示的な意思なので
    // フラグに関係なくページ全体を再読み込みする
    if (this.state.autoRetryCount >= ChunkErrorBoundary.MAX_AUTO_RETRIES) {
      window.location.reload();
      return;
    }
    // 手動リトライ時はカウンターをリセット
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
    const { error, isChunkError, attempt, autoRetrying, autoRetryCount } = this.state;
    const { fallback } = this.props;

    if (error && !isChunkError) {
      // レンダー例外など通信起因でないエラー: リロードで直らないため
      // 自動リトライせず、安定したエラーUIと帰還導線だけを出す
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
          <p className="font-semibold mb-2">データの読み込みに失敗しました</p>
          <p className="text-sm mb-4 text-amber-800 dark:text-amber-300">
            通信が混み合っているか、一時的にアクセスできない状態です。
            {autoRetrying ? (
              <span className="block mt-2">
                自動で再試行しています... ({autoRetryCount + 1}/{ChunkErrorBoundary.MAX_AUTO_RETRIES})
              </span>
            ) : autoRetryCount >= ChunkErrorBoundary.MAX_AUTO_RETRIES ? (
              <span className="block mt-2">
                サイトが更新された可能性があります。ページを再読み込みしてください。
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
            {autoRetrying
              ? '再試行中...'
              : autoRetryCount >= ChunkErrorBoundary.MAX_AUTO_RETRIES
                ? 'ページを再読み込み'
                : 'もう一度読み込む'}
          </button>
        </div>
      );
    }

    // Remount children when retrying to trigger a fresh dynamic import
    return <React.Fragment key={attempt}>{this.props.children}</React.Fragment>;
  }
}

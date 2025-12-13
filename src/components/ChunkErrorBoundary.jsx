import React from 'react';
import logger from '../utils/logger';

/**
 * Catches failures from React.lazy (e.g., chunk 429/404) and shows
 * a lightweight retry UI instead of leaving a blank page.
 */
export default class ChunkErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, attempt: 0 };
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
  }

  handleRetry = () => {
    // Reset error and bump key so descendants remount
    this.setState((prev) => ({ error: null, attempt: prev.attempt + 1 }));
    if (typeof this.props.onRetry === 'function') {
      this.props.onRetry();
    }
  };

  render() {
    const { error, attempt } = this.state;
    const { fallback } = this.props;

    if (error) {
      if (fallback) {
        return typeof fallback === 'function'
          ? fallback({ error, retry: this.handleRetry })
          : fallback;
      }

      return (
        <div className="max-w-3xl mx-auto my-10 p-6 rounded-2xl border border-amber-300 bg-amber-50 text-amber-900 shadow-sm">
          <p className="font-semibold mb-2">データの読み込みに失敗しました。</p>
          <p className="text-sm mb-4">
            通信が混み合っているか、GitHub Pages が一時的に 429 を返しています。
            少し待ってから再試行してください。
          </p>
          <button
            onClick={this.handleRetry}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition"
          >
            もう一度読み込む
          </button>
        </div>
      );
    }

    // Remount children when retrying to trigger a fresh dynamic import
    return <React.Fragment key={attempt}>{this.props.children}</React.Fragment>;
  }
}

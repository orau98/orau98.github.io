/**
 * Tailwind 設定
 * デザイントークン（src/index.css の CSS 変数）を theme.extend にマッピングする。
 * - すべて additive（既存の emerald / slate 系ユーティリティはそのまま利用可）。
 * - rgb(var(--token) / alpha) 形式なので opacity 修飾（bg-surface/90 等）が効く。
 */
const withAlpha = (token) => `rgb(var(${token}) / <alpha-value>)`;

const brandRamp = Object.fromEntries(
  [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((step) => [
    step,
    withAlpha(`--brand-${step}`),
  ]),
);

module.exports = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 洗練エメラルド（現テーマの種色）
        brand: brandRamp,
        // セマンティック面 — .dark で値がスワップする
        surface: {
          DEFAULT: withAlpha('--surface'),
          raised: withAlpha('--surface-raised'),
          overlay: withAlpha('--surface-overlay'),
        },
        line: {
          DEFAULT: withAlpha('--line'),
          strong: withAlpha('--line-strong'),
        },
        ink: {
          DEFAULT: withAlpha('--ink'),
          muted: withAlpha('--ink-muted'),
          subtle: withAlpha('--ink-subtle'),
        },
        ring: {
          brand: withAlpha('--ring'),
        },
      },
      borderRadius: {
        control: 'var(--radius-control)',
        card: 'var(--radius-card)',
      },
      boxShadow: {
        e1: 'var(--shadow-1)',
        e2: 'var(--shadow-2)',
        e3: 'var(--shadow-3)',
      },
    },
  },
  plugins: [require('tailwind-scrollbar')],
};

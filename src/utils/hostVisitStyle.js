/**
 * 食草（幼虫の食草・食樹）と訪花（成虫の訪花）の視覚言語を一元管理する。
 *
 * 経緯: 同じ「食草」「訪花」という概念が、一覧カード・コンパクト行・詳細ページで
 * それぞれ別の色（訪花: rose / yellow / pink、食草: emerald / green / slate）と
 * 別のアイコン（葉SVG / 星SVG / 絵文字 / 無し）で描かれ、面をまたぐと印象が
 * バラバラだった。ここに定義を集約し、全画面から参照することで再発を防ぐ。
 *
 * 決定:
 *  - 食草（larval host）= emerald 系（サイト基調色）
 *  - 訪花（flower visit）= rose 系（最も露出の多い一覧カードと詳細の凡例で既に採用）
 */

export const HOST_STYLE = {
  // アイコン付き丸バッジ（一覧カードのプレビュー用）
  chipBg: 'bg-emerald-100 dark:bg-emerald-900/30',
  chipText: 'text-emerald-700 dark:text-emerald-300',
  // セクション見出し・ラベル用の文字色
  headingText: 'text-emerald-700 dark:text-emerald-300',
  // 小見出し（uppercaseラベル等）用のやや濃い文字色
  labelText: 'text-emerald-600 dark:text-emerald-300',
  // バッジ（枠付きピル）用
  badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
};

export const FLOWER_STYLE = {
  chipBg: 'bg-rose-100 dark:bg-rose-900/30',
  chipText: 'text-rose-700 dark:text-rose-300',
  headingText: 'text-rose-600 dark:text-rose-300',
  labelText: 'text-rose-600 dark:text-rose-300',
  badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
};

/**
 * 「他N種」の省略表現を全画面で統一する。
 * 日本語は「他N種」、英語は「+N more」に揃える。
 */
export const buildMoreLabel = (count, isEnglish) =>
  isEnglish ? `+${count} more` : `他${count}種`;

/**
 * 展開ボタン用の「他N種を表示 / Show N more」。
 */
export const buildShowMoreLabel = (count, isEnglish) =>
  isEnglish ? `Show ${count} more` : `他${count}種を表示`;

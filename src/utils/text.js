// Utility: Hiragana to Katakana conversion
export const hiraganaToKatakana = (str = '') => {
  return String(str).replace(/[\u3041-\u3096]/g, (ch) => {
    return String.fromCharCode(ch.charCodeAt(0) + 0x60);
  });
};

// \u691c\u7d22\u7528\u306e\u6b63\u898f\u5316\u3002\u691c\u7d22\u8a9e\u3068\u6bd4\u8f03\u5bfe\u8c61\u306e\u4e21\u65b9\u306b\u9069\u7528\u3059\u308b\u3053\u3068\u3067\u3001
// \u3072\u3089\u304c\u306a/\u30ab\u30bf\u30ab\u30ca\u30fb\u5168\u89d2/\u534a\u89d2\u306e\u8868\u8a18\u3086\u308c\uff08\u4f8b: \u3076\u306a\u2192\u30d6\u30ca\uff09\u3092\u5438\u53ce\u3059\u308b\u3002
export const normalizeForSearch = (str = '') => {
  let s = String(str ?? '');
  if (typeof s.normalize === 'function') {
    s = s.normalize('NFKC');
  }
  return hiraganaToKatakana(s.trim().toLowerCase());
};

// NFKC正規化のみ（かな変換なし）。検索語から「原文」と「カタカナ変換」の
// 2バリアントを作る箇所で、半角カナ・全角英数の表記ゆれを先に吸収するために使う。
export const normalizeNFKC = (str = '') => {
  const s = String(str ?? '');
  return typeof s.normalize === 'function' ? s.normalize('NFKC') : s;
};


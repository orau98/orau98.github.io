// Utility: Hiragana to Katakana conversion
export const hiraganaToKatakana = (str = '') => {
  return String(str).replace(/[\u3041-\u3096]/g, (ch) => {
    return String.fromCharCode(ch.charCodeAt(0) + 0x60);
  });
};


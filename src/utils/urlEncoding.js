const PERCENT_ENCODED_BYTE_RE = /%[0-9a-f]{2}/i;
const MOJIBAKE_MARKER_RE = /(?:Ã|Â|ã|�|[\u0080-\u009f])/;
const JAPANESE_TEXT_RE = /[\u3040-\u30ff\u3400-\u9fff]/;

const countMatches = (text, re) =>
  (String(text || '').match(new RegExp(re.source, 'g')) || []).length;

const scoreReadableText = (value = '') =>
  countMatches(value, JAPANESE_TEXT_RE) * 2 -
  countMatches(value, MOJIBAKE_MARKER_RE) * 3;

export const safeDecodeURIComponent = (value = '') => {
  try {
    return decodeURIComponent(value);
  } catch {
    return String(value || '');
  }
};

export const decodePercentEncodedText = (value = '', maxPasses = 2) => {
  let current = String(value || '');

  for (let i = 0; i < maxPasses; i += 1) {
    if (!PERCENT_ENCODED_BYTE_RE.test(current)) break;
    const decoded = safeDecodeURIComponent(current);
    if (decoded === current) break;
    current = decoded;
  }

  return current;
};

export const repairUtf8Mojibake = (value = '') => {
  const text = String(value || '');
  if (!MOJIBAKE_MARKER_RE.test(text)) return text;

  const bytes = [];
  for (const char of text) {
    const code = char.charCodeAt(0);
    if (code > 0xff) return text;
    bytes.push(code);
  }

  try {
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(
      Uint8Array.from(bytes),
    );
    return scoreReadableText(decoded) > scoreReadableText(text) ? decoded : text;
  } catch {
    return text;
  }
};

export const decodeRouteParam = (value = '') =>
  repairUtf8Mojibake(decodePercentEncodedText(value));

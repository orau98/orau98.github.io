// 依存パッケージ不要の RFC4180 準拠 CSV ユーティリティ。
// CRLF・引用符・埋め込み改行に対応し、各フィールドの生テキスト範囲を保持することで
// 書式を保ったままセル単位の置換を可能にする。audit-csv-quality.mjs と回帰テストで共有する。

export function parseCsv(text) {
  let bom = '';
  let i = 0;
  const n = text.length;
  if (text.charCodeAt(0) === 0xfeff) {
    bom = '﻿';
    i = 1;
  }
  const records = [];
  while (i < n) {
    const recStart = i;
    const fields = [];
    const ranges = [];
    while (true) {
      const fStart = i;
      let value = '';
      if (text[i] === '"') {
        i++; // opening quote
        while (i < n) {
          if (text[i] === '"') {
            if (text[i + 1] === '"') {
              value += '"';
              i += 2;
            } else {
              i++; // closing quote
              break;
            }
          } else {
            value += text[i];
            i++;
          }
        }
        // 閉じ引用符の後に区切り/改行以外が続く不正ケースも取りこぼさない
        while (i < n && text[i] !== ',' && text[i] !== '\n' && text[i] !== '\r') {
          value += text[i];
          i++;
        }
      } else {
        while (i < n && text[i] !== ',' && text[i] !== '\n' && text[i] !== '\r') {
          value += text[i];
          i++;
        }
      }
      fields.push(value);
      ranges.push([fStart, i]);
      if (i < n && text[i] === ',') {
        i++;
        continue;
      }
      break;
    }
    let eol = '';
    if (text[i] === '\r') {
      eol += '\r';
      i++;
    }
    if (text[i] === '\n') {
      eol += '\n';
      i++;
    }
    records.push({ fields, ranges, start: recStart, end: i, eol });
    if (i >= n) break;
  }
  const header = records.length ? records[0].fields.map((h) => h.trim()) : [];
  return { bom, header, records };
}

export const serializeField = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// records に対する {recordIndex, fieldIndex, newValue} の編集を、生テキストの該当
// フィールド範囲のみ差し替えて適用する（他セルの書式は完全保持）。
export function applyEdits(text, records, edits) {
  const flat = edits.map((e) => {
    const rec = records[e.recordIndex];
    const [s, en] = rec.ranges[e.fieldIndex];
    return { start: s, end: en, replacement: serializeField(e.newValue) };
  });
  flat.sort((a, b) => b.start - a.start); // 後ろから適用してオフセットを保つ
  let out = text;
  for (const ed of flat) {
    out = out.slice(0, ed.start) + ed.replacement + out.slice(ed.end);
  }
  return out;
}

// ヘッダ付きCSVをオブジェクト配列に変換する。__recordIndex は records 配列上の位置
// （0はヘッダ）で、applyEdits の recordIndex に使える。
export function toObjects(parsed) {
  const { header, records } = parsed;
  return records.slice(1).map((rec, idx) => {
    const obj = {};
    header.forEach((h, ci) => {
      obj[h] = rec.fields[ci] ?? '';
    });
    obj.__recordIndex = idx + 1;
    return obj;
  });
}

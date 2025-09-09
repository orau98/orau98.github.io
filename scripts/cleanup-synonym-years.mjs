import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

// 対象CSVファイル
const targets = [
  path.join(process.cwd(), 'public', 'insects.csv'),
  path.join(process.cwd(), 'normalized_data', 'insects.csv'),
];

// 年だけ（または括弧や区切り記号付きの年だけ）を検出するヘルパー
function isYearToken(token) {
  if (!token) return false;
  const t = String(token).trim();
  if (!t) return false;
  // 括弧・句読点・カンマ・セミコロン・中点などを除去して評価
  const compact = t
    .replace(/[()（）\[\]【】『』「」、，,;；\.・・/\-]/g, '')
    .trim();
  return /^\d{4}$/.test(compact);
}

// 名前系フィールドをクリーニング（年トークンのみ除去）
function cleanNameField(value) {
  if (!value) return '';
  const raw = String(value).trim();
  if (!raw) return '';

  // 区切りで分割し、年トークンのみを除去
  const parts = raw
    .split(/[,;，；、\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const kept = parts.filter((p) => !isYearToken(p));
  return kept.join('; ');
}

for (const file of targets) {
  if (!fs.existsSync(file)) {
    console.log(`skip (not found): ${file}`);
    continue;
  }
  const csv = fs.readFileSync(file, 'utf8');
  const parsed = Papa.parse(csv, { header: true, skipEmptyLines: false });
  const rows = parsed.data;
  if (!Array.isArray(rows) || rows.length === 0) {
    console.log(`skip (no rows): ${file}`);
    continue;
  }

  const header = parsed.meta?.fields || Object.keys(rows[0]);
  let fixed = 0;
  for (const r of rows) {
    if (!r) continue;
    const cols = ['synonyms', 'alternative_name', 'other_names'];
    for (const col of cols) {
      if (!Object.prototype.hasOwnProperty.call(r, col)) continue;
      const before = r[col] ?? '';
      const after = cleanNameField(before);
      if (String(before).trim() !== String(after).trim()) {
        r[col] = after;
        fixed += 1;
      }
    }
  }

  const out = Papa.unparse(rows, { header: true, columns: header });
  fs.writeFileSync(file, out, 'utf8');
  console.log(`${path.relative(process.cwd(), file)}: cleaned ${fixed} rows`);
}

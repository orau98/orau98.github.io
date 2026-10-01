// サイトマップの lastmod（最終更新日）を「そのページの内容が実際に変わった日」にする。
//
// ページごとに本文の指紋（ハッシュ）を取り、前回公開したときの指紋と比べる。
// 同じなら前回の日付を引き継ぎ、違えば今日の日付にする。前回の指紋と日付は
// sitemap-lastmod.json として公開サイトに置き、次のビルドがそれを読み直す
// （CI は毎回まっさらな環境で動くため、公開サイトを記録の置き場にしている）。
import crypto from 'crypto';
import fs from 'fs';

export const SITEMAP_LASTMOD_FILENAME = 'sitemap-lastmod.json';
export const SITEMAP_LASTMOD_VERSION = 1;

// 前回の記録が無いページ全体の日付（初回公開時・記録を読めなかったとき）。
// 直近で全詳細ページの本文構成が変わった日（食草と訪花の分離、2026-09-13）。
// 記録が無いときに全ページを「今日更新」にすると、実際には変わっていないページまで
// 更新されたと伝えてしまうため、この日付にとどめる。
export const INITIAL_SITEMAP_LASTMOD = '2026-09-13';

const decodeEntities = (value = '') => String(value)
  .replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;/g, "'")
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&amp;/g, '&');

// 表示される文字だけを取り出す（タグ・スクリプト・空白の違いは本文の変更とみなさない）。
// 写真の追加・差し替えも内容の変更なので、画像の代替テキストは残す。
const visibleText = (html = '') => String(html || '')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/<img\b[^>]*?\balt=(?:"([^"]*)"|'([^']*)')[^>]*>/gi, (_, dq, sq) => ` ${dq ?? sq ?? ''} `)
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

// ページの指紋。title・説明文・見出し（meta-header）・本文（main）から作る。
// main の無いページ（トップなど）は body 全体の表示文字を使う。
export const computePageContentHash = (html = '') => {
  const text = String(html || '');
  const title = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '';
  const descriptionTag = text.match(/<meta\b[^>]*\bname=["']description["'][^>]*>/i)?.[0] || '';
  const description = descriptionTag.match(/\bcontent=(?:"([^"]*)"|'([^']*)')/i)?.slice(1).find((v) => v !== undefined) || '';
  const body = text.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] || '';
  const heading = body.match(
    /<header\b[^>]*\bclass=["'][^"']*\bmeta-header\b[^"']*["'][^>]*>[\s\S]*?<\/header>/i,
  )?.[0] || '';
  const main = body.match(/<main\b[^>]*>[\s\S]*?<\/main>/i)?.[0] || '';
  const content = [
    visibleText(title),
    visibleText(decodeEntities(description)),
    visibleText(heading),
    visibleText(main || body),
  ].join('\n');
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
};

// 記録のキーは URL のパス（%エンコードを戻して短くする）
export const toSitemapLastmodKey = (loc = '') => {
  try {
    const { pathname } = new URL(loc);
    try {
      return decodeURIComponent(pathname);
    } catch {
      return pathname;
    }
  } catch {
    return String(loc || '');
  }
};

// manifest が null（前回の記録なし）なら初回の日付、新しいページなら今日、
// 指紋が前回と同じなら前回の日付、違えば今日。
export const resolveSitemapLastmod = ({
  manifest,
  key,
  hash,
  today,
  initial = INITIAL_SITEMAP_LASTMOD,
}) => {
  if (!manifest) return initial;
  const previous = manifest.entries?.[key];
  if (!Array.isArray(previous)) return today;
  const [previousHash, previousLastmod] = previous;
  if (previousHash === hash && /^\d{4}-\d{2}-\d{2}$/.test(String(previousLastmod || ''))) {
    // 時計のずれなどで未来の日付が入っていたら今日に丸める
    return previousLastmod > today ? today : previousLastmod;
  }
  return today;
};

export const buildSitemapLastmodManifest = (entries, generatedAt) => ({
  version: SITEMAP_LASTMOD_VERSION,
  generatedAt,
  entries: Object.fromEntries(
    Array.from(entries)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  ),
});

// 形の崩れた記録は使わない（null を返して初回扱いにする）
export const parseSitemapLastmodManifest = (text) => {
  let payload = null;
  try {
    payload = JSON.parse(String(text || ''));
  } catch {
    return null;
  }
  if (!payload || payload.version !== SITEMAP_LASTMOD_VERSION) return null;
  if (!payload.entries || typeof payload.entries !== 'object' || Array.isArray(payload.entries)) return null;
  return payload;
};

// 前回の記録を読む。source は URL（公開サイト）か手元のファイルパス。'none' なら読まない。
// 読めなかった理由は log に渡し、null を返す（ビルドは止めない）。
export const loadPreviousSitemapLastmodManifest = async ({
  source,
  fetchImpl = globalThis.fetch,
  timeoutMs = 8000,
  attempts = 2,
  log = () => {},
} = {}) => {
  if (!source || source === 'none') {
    log('前回の記録を読まない設定です');
    return null;
  }
  if (!/^https?:\/\//i.test(source)) {
    if (!fs.existsSync(source)) {
      log(`前回の記録ファイルがありません: ${source}`);
      return null;
    }
    const manifest = parseSitemapLastmodManifest(fs.readFileSync(source, 'utf8'));
    if (!manifest) log(`前回の記録ファイルの形式が正しくありません: ${source}`);
    return manifest;
  }
  if (typeof fetchImpl !== 'function') {
    log('fetch が使えないため前回の記録を読めません');
    return null;
  }
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchImpl(source, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: { 'cache-control': 'no-cache' },
      });
      if (response.status === 404) {
        log(`公開サイトにまだ記録がありません（初回）: ${source}`);
        return null;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const manifest = parseSitemapLastmodManifest(await response.text());
      if (!manifest) {
        log(`公開サイトの記録の形式が正しくありません: ${source}`);
        return null;
      }
      return manifest;
    } catch (error) {
      log(`前回の記録を取得できません（${attempt}/${attempts}回目）: ${error?.message || error}`);
    }
  }
  return null;
};

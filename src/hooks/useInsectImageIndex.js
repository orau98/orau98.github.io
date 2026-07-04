import { useEffect, useState } from 'react';
import { loadInsectImageIndexes, getCachedInsectImageIndexes } from '../services/imageIndex';
import { buildNormalizedEntriesCached } from '../utils/insectImageResolver';

const EMPTY_NAMES = new Set();
const EMPTY_EXTS = {};

// 昆虫画像インデックス（ベース名Set + 拡張子マップ + 正規化エントリ）の共有フック。
// 以前は一覧・詳細・クイズ・食物網グラフ等が同じ読み込みとstate化を個別に実装し、
// 正規化エントリ（3,000件規模）も画面ごとに再構築していた。
// ロード済みキャッシュがあれば同期初期化し、再マウント直後の初回レンダーから確定値を返す。
// 返すSet/object/配列はサービス・消費側全体で共有する読み取り専用の参照。
export default function useInsectImageIndex() {
  const [index, setIndex] = useState(getCachedInsectImageIndexes);

  useEffect(() => {
    let cancelled = false;
    loadInsectImageIndexes()
      .then(({ names, exts }) => {
        if (cancelled) return;
        setIndex((prev) =>
          prev && prev.names === names && prev.exts === exts
            ? prev
            : { names: names || EMPTY_NAMES, exts: exts || EMPTY_EXTS },
        );
      })
      .catch(() => {
        if (!cancelled) setIndex((prev) => prev || { names: EMPTY_NAMES, exts: EMPTY_EXTS });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const imageNames = index?.names || EMPTY_NAMES;
  const imageExtensions = index?.exts || EMPTY_EXTS;
  return {
    imageNames,
    imageExtensions,
    normalizedEntries: buildNormalizedEntriesCached(imageNames, imageExtensions),
    // 中身が取得できたか（並べ替え等、インデックス依存の処理を始めてよいか）
    isReady: imageNames.size > 0 || Object.keys(imageExtensions).length > 0,
    // 取得の成否を問わず解決済みか（失敗時もリストを描画するために使う）
    resolved: index !== null,
  };
}

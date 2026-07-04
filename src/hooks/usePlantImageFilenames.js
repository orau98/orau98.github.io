import { useEffect, useState } from 'react';
import { loadPlantImageFilenames, getCachedPlantImageFilenames } from '../services/imageIndex';

const EMPTY = [];

// 植物画像ファイル名一覧の共有フック。
// ロード済みキャッシュがあれば同期初期化する。返す配列は読み取り専用の共有参照。
export default function usePlantImageFilenames() {
  const [filenames, setFilenames] = useState(() => getCachedPlantImageFilenames() || EMPTY);

  useEffect(() => {
    let cancelled = false;
    loadPlantImageFilenames()
      .then((list) => {
        if (!cancelled) setFilenames(Array.isArray(list) ? list : EMPTY);
      })
      .catch(() => {
        if (!cancelled) setFilenames(EMPTY);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return filenames;
}

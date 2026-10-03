import { useLayoutEffect } from 'react';
import { releasePrerenderedSnapshot, removeStaticStylesheet } from '../utils/prerenderedSnapshot';

/**
 * 個別ページの画面を描いたら、静的HTMLの本文の写しと静的ページ用のスタイルシート（meta-styles.css）を片付ける。
 * - スタイルシートは最初の描画（ペイント）の前に外す。描いた後に外すと、外したスタイルの分だけ画面がずれる
 * - 写しはページの画面が前に入った時点で CSS（index.css）が隠しているので、片付けは描画の後に回す。
 *   描画の前に片付けると React がその場で描き直し、ページの useEffect まで描画前にまとめて走るため、
 *   植物ページでは遅い端末で約1秒の重いスタイル再計算が起きていた
 */
export default function useReleasePrerenderedSnapshot(ready = true) {
  useLayoutEffect(() => {
    if (!ready) return;
    removeStaticStylesheet();
    setTimeout(releasePrerenderedSnapshot, 0);
  }, [ready]);
}

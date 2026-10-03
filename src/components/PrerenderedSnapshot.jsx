import { memo, useSyncExternalStore } from 'react';
import { useLocation } from 'react-router-dom';
import {
  getPrerenderedSnapshot,
  normalizeSnapshotPath,
  subscribePrerenderedSnapshot,
} from '../utils/prerenderedSnapshot';

const getServerSnapshot = () => null;

/**
 * 最初に開いた個別ページ（昆虫・植物）の、静的HTMLに入っていた本文の写し。
 * App の main の先頭（読み込み中の画面とページの画面で共通の位置）に置き、
 * そのページの画面を描くまで出し続ける。位置を変えずに出し続けるので、
 * データ待ち → 画面のJS待ちと切り替わっても作り直されず、写真もちらつかない。
 * ページの画面（data-route-page）が前に入ったら CSS（index.css）ですぐ隠し、
 * hooks/useReleasePrerenderedSnapshot が描画の後に片付ける。
 */
const PrerenderedSnapshot = () => {
  const { pathname } = useLocation();
  const snapshot = useSyncExternalStore(
    subscribePrerenderedSnapshot,
    getPrerenderedSnapshot,
    getServerSnapshot,
  );
  if (!snapshot || normalizeSnapshotPath(pathname) !== snapshot.path) return null;
  return (
    <div
      className="meta-page"
      data-prerendered-snapshot={snapshot.profile}
      // 自サイトのビルドで作った静的HTML（広告枠・scriptは除去済み）。
      // 同じオブジェクトを渡し続け、App の描き直しのたびに innerHTML を入れ直させない
      dangerouslySetInnerHTML={snapshot.markup}
    />
  );
};

export default memo(PrerenderedSnapshot);

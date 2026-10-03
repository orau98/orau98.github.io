import { useSyncExternalStore } from 'react';
import { useLocation } from 'react-router-dom';
import { DetailSkeleton } from './SkeletonLoader';
import {
  getPrerenderedSnapshot,
  normalizeSnapshotPath,
  subscribePrerenderedSnapshot,
} from '../utils/prerenderedSnapshot';

const getServerSnapshot = () => null;

/**
 * 個別ページ（昆虫・植物）のデータや画面のJSを待つ間の表示。
 * 最初に開いたページでは、静的HTMLの本文の写し（components/PrerenderedSnapshot）が
 * 出ているので何も出さない。写しが無いとき（アプリ内で移動してきたときなど）はスケルトンを出す。
 */
const RouteLoadingFallback = ({ showSkeleton = true }) => {
  const { pathname } = useLocation();
  const snapshot = useSyncExternalStore(
    subscribePrerenderedSnapshot,
    getPrerenderedSnapshot,
    getServerSnapshot,
  );
  if (snapshot && normalizeSnapshotPath(pathname) === snapshot.path) return null;
  return showSkeleton ? <DetailSkeleton /> : null;
};

export default RouteLoadingFallback;

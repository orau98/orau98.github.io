import { useEffect, useState } from 'react';

/**
 * グローバルローディングバー
 * ページ遷移やデータ読み込み時に上部に表示
 */
const LoadingBar = ({ isLoading }) => {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isLoading) {
      setVisible(true);
      setProgress(0);

      // 段階的に進捗を増加
      const timer1 = setTimeout(() => setProgress(30), 100);
      const timer2 = setTimeout(() => setProgress(60), 300);
      const timer3 = setTimeout(() => setProgress(80), 600);

      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
      };
    } else {
      // 完了時は100%まで行ってからフェードアウト
      setProgress(100);
      const hideTimer = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 300);

      return () => clearTimeout(hideTimer);
    }
  }, [isLoading]);

  if (!visible && progress === 0) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[9999] h-1 transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      role="progressbar"
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="ページ読み込み中"
    >
      <div
        className="h-full bg-gradient-to-r from-emerald-500 via-blue-500 to-emerald-500 transition-all duration-300 ease-out shadow-lg shadow-emerald-500/30"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
};

export default LoadingBar;

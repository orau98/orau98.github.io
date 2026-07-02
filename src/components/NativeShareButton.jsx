import { useEffect, useState } from 'react';

// OS標準の共有シート（navigator.share）を開くボタン。
// 対応環境（主にモバイルブラウザ）でのみ表示される。
const NativeShareButton = ({ url, title, text, isEnglish = false }) => {
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setCanShare(
      typeof navigator !== 'undefined' && typeof navigator.share === 'function',
    );
  }, []);

  if (!canShare || !url) return null;

  const handleShare = async () => {
    try {
      await navigator.share({ url, title, text });
    } catch {
      // ユーザーが共有シートを閉じた場合も reject されるため握りつぶす
    }
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-500 transition-all duration-200 hover:scale-105 hover:shadow-lg font-medium text-sm"
      aria-label={isEnglish ? 'Share via device share sheet' : '端末の共有メニューで共有'}
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4m0 0L8 6m4-4v13" />
      </svg>
      {isEnglish ? 'Share…' : '共有…'}
    </button>
  );
};

export default NativeShareButton;

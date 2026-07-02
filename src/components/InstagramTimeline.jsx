import { useEffect } from 'react';
import InstagramEmbed from './InstagramEmbed';

const InstagramTimeline = ({ urls = [], className = '' }) => {
  useEffect(() => {
    // Re-process embeds when list changes
    if (window.instgrm && window.instgrm.Embeds) {
      try { window.instgrm.Embeds.process(); } catch {}
    }
  }, [urls]);

  if (!urls || urls.length === 0) return null;

  return (
    <div className={`space-y-4 ${className}`}>
      {urls.map((url, idx) => (
        <div
          key={`${idx}-${url}`}
          className="rounded-lg overflow-hidden bg-white/60 p-0 dark:bg-slate-800/60 dark:p-2 dark:ring-1 dark:ring-slate-700/80 sm:dark:p-3"
        >
          <InstagramEmbed url={url} />
        </div>
      ))}
    </div>
  );
};

export default InstagramTimeline;

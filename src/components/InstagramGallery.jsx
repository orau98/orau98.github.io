import { useEffect, useMemo, useRef, useState } from 'react';
import InstagramIcon from './InstagramIcon';

const normalizeAssetUrl = (value) => {
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  const base = import.meta.env.BASE_URL || '/';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  if (value.startsWith('/')) {
    if (normalizedBase === '/') return value;
    return `${normalizedBase.replace(/\/$/, '')}${value}`;
  }
  return `${normalizedBase}${value}`;
};

const buildFallbackImageUrl = (permalink) => {
  if (!permalink) return '';
  try {
    const url = new URL(permalink);
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length >= 2) {
      const shortcode = parts[1];
      if (shortcode) {
        return `https://www.instagram.com/p/${shortcode}/media/?size=l`;
      }
    }
  } catch {
    // ignore
  }
  return '';
};

const pickImageUrl = (post) => {
  if (!post) return '';
  if (post.local_url) return normalizeAssetUrl(post.local_url);
  if (post.localUrl) return normalizeAssetUrl(post.localUrl);
  const type = String(post.media_type || '').toUpperCase();
  if (type === 'VIDEO' || type === 'REEL') {
    return post.thumbnail_url || post.media_url || '';
  }
  return post.media_url || post.thumbnail_url || '';
};

const InstagramGallery = ({ posts = [], limit = 6, className = '', onAllFailed }) => {
  const visible = useMemo(
    () => (Array.isArray(posts) ? posts.slice(0, limit) : []),
    [posts, limit],
  );
  const fallbackByKey = useMemo(() => {
    const map = new Map();
    visible.forEach((post, idx) => {
      const permalink = post?.permalink || '';
      const key = `${permalink}-${idx}`;
      const fallback = buildFallbackImageUrl(permalink);
      if (fallback) map.set(key, fallback);
    });
    return map;
  }, [visible]);
  const keyList = useMemo(
    () =>
      visible.map((post, idx) => {
        const permalink = post?.permalink || '';
        return `${permalink}-${idx}`;
      }),
    [visible],
  );
  const [failed, setFailed] = useState({});
  const notifiedRef = useRef(false);

  useEffect(() => {
    notifiedRef.current = false;
  }, [keyList]);

  useEffect(() => {
    if (typeof onAllFailed !== 'function') return;
    if (keyList.length === 0) return;
    const allFailed = keyList.every((key) => failed[key] === 'final');
    if (allFailed && !notifiedRef.current) {
      notifiedRef.current = true;
      onAllFailed();
    }
  }, [failed, keyList, onAllFailed]);

  if (visible.length === 0) return null;

  return (
    <div className={`grid grid-cols-2 gap-3 ${className}`}>
      {visible.map((post, idx) => {
        const imageUrl = pickImageUrl(post);
        const permalink = post?.permalink || '#';
        const type = String(post?.media_type || '').toUpperCase();
        const isVideo = type === 'VIDEO' || type === 'REEL';
        const label = `Instagram投稿 ${idx + 1}`;
        const key = `${permalink}-${idx}`;
        const hasFallback = fallbackByKey.has(key);
        const triedFallback = failed[key] && hasFallback;
        const isFinalFailure = failed[key] === 'final';
        const resolvedImageUrl = triedFallback ? fallbackByKey.get(key) : imageUrl;
        const showImage = Boolean(resolvedImageUrl) && !isFinalFailure;

        return (
          <a
            key={key}
            href={permalink}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={label}
            className="group block rounded-lg overflow-hidden border border-slate-200/80 bg-white/90 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="relative aspect-square bg-slate-100">
              {showImage ? (
                <img
                  src={resolvedImageUrl}
                  alt={label}
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  onError={() => {
                    if (hasFallback && !triedFallback) {
                      setFailed((prev) => ({ ...prev, [key]: true }));
                      return;
                    }
                    setFailed((prev) => ({ ...prev, [key]: 'final' }));
                  }}
                />
              ) : (
                <div className="h-full w-full flex flex-col items-center justify-center text-slate-400 gap-2">
                  <InstagramIcon className="w-6 h-6" />
                  <span className="text-xs font-medium">Instagram投稿</span>
                </div>
              )}
              {isVideo && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                  <div className="flex items-center justify-center rounded-full bg-white/85 p-2 shadow-sm">
                    <svg
                      viewBox="0 0 24 24"
                      className="h-4 w-4 text-slate-800"
                      aria-hidden="true"
                    >
                      <path d="M8 5v14l11-7z" fill="currentColor" />
                    </svg>
                  </div>
                </div>
              )}
            </div>
          </a>
        );
      })}
    </div>
  );
};

export default InstagramGallery;

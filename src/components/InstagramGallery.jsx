import React from 'react';
import InstagramIcon from './InstagramIcon';

const pickImageUrl = (post) => {
  if (!post) return '';
  const type = String(post.media_type || '').toUpperCase();
  if (type === 'VIDEO' || type === 'REEL') {
    return post.thumbnail_url || post.media_url || '';
  }
  return post.media_url || post.thumbnail_url || '';
};

const InstagramGallery = ({ posts = [], limit = 6, className = '' }) => {
  const visible = Array.isArray(posts) ? posts.slice(0, limit) : [];
  if (visible.length === 0) return null;

  return (
    <div className={`grid grid-cols-2 gap-3 ${className}`}>
      {visible.map((post, idx) => {
        const imageUrl = pickImageUrl(post);
        const permalink = post?.permalink || '#';
        const type = String(post?.media_type || '').toUpperCase();
        const isVideo = type === 'VIDEO' || type === 'REEL';
        const label = `Instagram投稿 ${idx + 1}`;

        return (
          <a
            key={`${permalink}-${idx}`}
            href={permalink}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={label}
            className="group block rounded-lg overflow-hidden border border-slate-200/80 bg-white/90 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="relative aspect-square bg-slate-100">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={label}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-slate-400">
                  <InstagramIcon className="w-6 h-6" />
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

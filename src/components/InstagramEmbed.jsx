import React, { useEffect, useState } from 'react';

const InstagramEmbed = ({ url, className = "" }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!url) return;

    // Reset states on URL change
    setIsLoading(true);
    setHasError(false);

    let timeoutId;
    let isMounted = true;

    const safeSetState = (stateSetter, value) => {
      if (isMounted) {
        stateSetter(value);
      }
    };

    const processEmbeds = () => {
      try {
        if (window.instgrm && window.instgrm.Embeds && typeof window.instgrm.Embeds.process === 'function') {
          console.log('Processing Instagram embeds...');
          window.instgrm.Embeds.process();
          
          // Simple timeout to hide loading state
          timeoutId = setTimeout(() => {
            safeSetState(setIsLoading, false);
          }, 3000);
        } else {
          // If Instagram API not available, show error state
          safeSetState(setHasError, true);
          safeSetState(setIsLoading, false);
        }
      } catch (error) {
        console.error('Instagram embed error:', error);
        safeSetState(setHasError, true);
        safeSetState(setIsLoading, false);
      }
    };

    const scriptId = 'instagram-embed-script';
    let script = document.getElementById(scriptId);

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://www.instagram.com/embed.js';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        console.log('Instagram script loaded');
        setTimeout(processEmbeds, 1000);
      };
      script.onerror = () => {
        console.error('Failed to load Instagram script');
        safeSetState(setHasError, true);
        safeSetState(setIsLoading, false);
      };
      
      // Only append script if component is still mounted
      if (isMounted) {
        document.body.appendChild(script);
      }
    } else {
      setTimeout(processEmbeds, 1000);
    }

    // Fallback timeout - if still loading after 10 seconds, show error
    const fallbackTimeout = setTimeout(() => {
      console.warn('Instagram embed timeout');
      safeSetState(setHasError, true);
      safeSetState(setIsLoading, false);
    }, 10000);

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
      if (fallbackTimeout) clearTimeout(fallbackTimeout);
    };
  }, [url]);

  if (!url) return null;

  if (hasError) {
    return (
      <div className={`instagram-embed-container ${className} w-full flex justify-center`}>
        <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-6 max-w-md w-full text-center">
          <div className="text-slate-600 dark:text-slate-400 mb-4">
            <svg className="w-12 h-12 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.664-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <p className="font-medium">Instagram投稿を読み込めませんでした</p>
            <p className="text-sm mt-2">ネットワーク接続を確認してください</p>
          </div>
          <a 
            href={url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-lg hover:from-pink-600 hover:to-purple-600 transition-all duration-200"
          >
            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
            </svg>
            Instagramで見る
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className={`instagram-embed-container ${className} w-full flex justify-center`}>
      {isLoading && (
        <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-6 max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500 mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Instagram投稿を読み込み中...</p>
        </div>
      )}
      <blockquote
        className="instagram-media"
        data-instgrm-permalink={url}
        data-instgrm-version="14"
        data-instgrm-captioned
        style={{
          background: '#FFF',
          border: '1px solid #dbdbdb',
          borderRadius: '3px',
          boxShadow: '0 0 1px 0 rgba(0,0,0,0.5),0 1px 10px 0 rgba(0,0,0,0.15)',
          margin: '1px',
          maxWidth: '540px',
          minWidth: '326px',
          padding: '0',
          width: 'calc(100% - 2px)',
          display: isLoading ? 'none' : 'block'
        }}
      >
        <a href={url} target="_blank" rel="noopener noreferrer">
          Instagram投稿を見る
        </a>
      </blockquote>
    </div>
  );
};

export default InstagramEmbed;
import React, { useEffect, useRef } from 'react';

const InstagramEmbed = ({ url, className = "" }) => {
  const embedRef = useRef(null);

  useEffect(() => {
    if (url && embedRef.current) {
      // Clear previous content
      embedRef.current.innerHTML = '';
      
      // Create blockquote element
      const blockquote = document.createElement('blockquote');
      blockquote.className = 'instagram-media';
      blockquote.setAttribute('data-instgrm-permalink', url);
      blockquote.setAttribute('data-instgrm-version', '14');
      blockquote.style.background = '#FFF';
      blockquote.style.border = '0';
      blockquote.style.borderRadius = '3px';
      blockquote.style.boxShadow = '0 0 1px 0 rgba(0,0,0,0.5),0 1px 10px 0 rgba(0,0,0,0.15)';
      blockquote.style.margin = '1px';
      blockquote.style.maxWidth = '540px';
      blockquote.style.minWidth = '326px';
      blockquote.style.padding = '0';
      blockquote.style.width = '100%';
      
      // Add link inside blockquote
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'View this post on Instagram';
      link.style.color = '#c9c8cd';
      link.style.fontFamily = 'Arial,sans-serif';
      link.style.fontSize = '14px';
      link.style.fontStyle = 'normal';
      link.style.fontWeight = 'normal';
      link.style.lineHeight = '17px';
      link.style.textDecoration = 'none';
      
      blockquote.appendChild(link);
      embedRef.current.appendChild(blockquote);
      
      // Load Instagram embed script
      if (window.instgrm) {
        window.instgrm.Embeds.process();
      } else {
        const script = document.createElement('script');
        script.src = '//www.instagram.com/embed.js';
        script.async = true;
        document.body.appendChild(script);
      }
    }
  }, [url]);

  if (!url) return null;

  return (
    <div className={`instagram-embed-container ${className}`} ref={embedRef}>
      {/* Fallback content while loading */}
      <div className="flex items-center justify-center h-64 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 rounded-lg">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-pink-200 border-t-pink-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Instagram投稿を読み込んでいます...</p>
        </div>
      </div>
    </div>
  );
};

export default InstagramEmbed;
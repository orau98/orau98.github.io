import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const FloatingActionButton = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Show/hide based on scroll
  useEffect(() => {
    const toggleVisibility = () => {
      if (window.pageYOffset > 300) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener('scroll', toggleVisibility);
    return () => window.removeEventListener('scroll', toggleVisibility);
  }, []);

  // Close menu when location changes
  useEffect(() => {
    setIsOpen(false);
  }, [location]);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
    setIsOpen(false);
  };

  const handleSearch = () => {
    // If on home page, scroll to search bar
    if (location.pathname === '/') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      // Focus search input logic could be added here if needed
    } else {
      // If not on home, go to home (which has search)
      navigate('/');
    }
    setIsOpen(false);
  };

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  // Don't render if not visible (scrolled down)
  // But we might want it always visible on mobile? 
  // Let's stick to scroll-based for "Back to Top" context, 
  // but maybe we want search access always?
  // For now, let's make it appear after scroll to avoid cluttering hero.
  if (!isVisible) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* Menu Items */}
      <div
        className={`flex flex-col gap-3 transition-all duration-300 origin-bottom ${
          isOpen
            ? 'opacity-100 scale-100 translate-y-0'
            : 'opacity-0 scale-90 translate-y-10 pointer-events-none'
        }`}
      >
        {/* Search Button */}
        <button
          onClick={handleSearch}
          className="flex items-center justify-center w-12 h-12 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-full shadow-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          aria-label="検索"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>

        {/* Back to Top Button */}
        <button
          onClick={scrollToTop}
          className="flex items-center justify-center w-12 h-12 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-full shadow-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          aria-label="トップへ戻る"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
        </button>
      </div>

      {/* Main FAB Toggle */}
      <button
        onClick={toggleMenu}
        className={`flex items-center justify-center w-14 h-14 rounded-full shadow-xl transition-all duration-300 ${
          isOpen
            ? 'bg-slate-700 text-white rotate-45'
            : 'bg-blue-600 text-white hover:bg-blue-700 hover:scale-105'
        }`}
        aria-label={isOpen ? "メニューを閉じる" : "メニューを開く"}
      >
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      </button>
      
      {/* Overlay to close when clicking outside */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[-1]" 
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

export default FloatingActionButton;

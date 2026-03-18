import React, { useEffect, useId, useRef, useState } from 'react';

const ALIGN_CLASS = {
  left: 'left-0',
  center: 'left-1/2 -translate-x-1/2',
  right: 'right-0'
};

const InfoPopover = ({
  title,
  children,
  align = 'right',
  buttonAriaLabel = '説明を表示',
  buttonContent = '?',
  buttonClassName = '',
  panelClassName = '',
  contentClassName = '',
  titleClassName = ''
}) => {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);
  const panelId = useId();
  const alignClass = ALIGN_CLASS[align] || ALIGN_CLASS.right;

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (!wrapperRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown, { passive: true });
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={wrapperRef}
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={(event) => {
        if (!wrapperRef.current?.contains(event.relatedTarget)) {
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        className={buttonClassName || 'inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900/80 dark:text-slate-100 dark:hover:bg-slate-800'}
        aria-label={buttonAriaLabel}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((prev) => !prev)}
      >
        {buttonContent}
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          className={`absolute top-full z-40 mt-2 ${alignClass} w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white/98 p-3 text-left text-slate-700 shadow-2xl backdrop-blur dark:border-slate-700 dark:bg-slate-900/96 dark:text-slate-100 ${panelClassName}`}
        >
          {title && (
            <div className={`mb-2 text-sm font-semibold text-slate-900 dark:text-white ${titleClassName}`}>
              {title}
            </div>
          )}
          <div className={`text-xs leading-5 ${contentClassName}`}>
            {children}
          </div>
        </div>
      )}
    </div>
  );
};

export default InfoPopover;

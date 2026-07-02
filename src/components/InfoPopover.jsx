import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const ALIGN_CLASS = {
  left: 'left',
  center: 'center',
  right: 'right'
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
  const panelRef = useRef(null);
  const buttonRef = useRef(null);
  // クリックで開いた場合のみパネルへフォーカスを移す（hoverでは移さない）
  const shouldFocusPanelRef = useRef(false);
  const closeTimerRef = useRef(null);
  const [panelStyle, setPanelStyle] = useState(null);
  const panelId = useId();
  const resolvedAlign = ALIGN_CLASS[align] || ALIGN_CLASS.right;

  const clearCloseTimer = () => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const openPopover = () => {
    clearCloseTimer();
    setOpen(true);
  };

  const closePopover = () => {
    clearCloseTimer();
    setOpen(false);
  };

  const scheduleClose = () => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false);
      closeTimerRef.current = null;
    }, 90);
  };

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      // パネルはportalでbody直下にあるため、パネル内クリックも「内側」として扱う
      if (
        !wrapperRef.current?.contains(event.target) &&
        !panelRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        // パネル内にフォーカスがある状態で閉じたら、開いたボタンへ戻す
        if (panelRef.current?.contains(document.activeElement)) {
          buttonRef.current?.focus();
        }
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

  useEffect(() => () => clearCloseTimer(), []);

  // クリック起点で開いたときはパネルにフォーカスを移し、SR/キーボードで読み進められるようにする
  useEffect(() => {
    if (open && shouldFocusPanelRef.current) {
      shouldFocusPanelRef.current = false;
      panelRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open || typeof window === 'undefined') return undefined;

    const updatePosition = () => {
      const trigger = wrapperRef.current;
      const panel = panelRef.current;
      if (!trigger || !panel) return;

      const triggerRect = trigger.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const margin = 12;
      const gap = 10;

      let left = triggerRect.right - panelRect.width;
      if (resolvedAlign === 'left') {
        left = triggerRect.left;
      } else if (resolvedAlign === 'center') {
        left = triggerRect.left + (triggerRect.width - panelRect.width) / 2;
      }

      left = Math.max(margin, Math.min(left, viewportWidth - panelRect.width - margin));

      const fitsBelow = triggerRect.bottom + gap + panelRect.height <= viewportHeight - margin;
      const fitsAbove = triggerRect.top - gap - panelRect.height >= margin;
      const placeAbove = !fitsBelow && fitsAbove;
      const top = placeAbove
        ? triggerRect.top - panelRect.height - gap
        : Math.min(triggerRect.bottom + gap, viewportHeight - panelRect.height - margin);

      setPanelStyle({
        left,
        top,
        minWidth: Math.min(220, Math.max(triggerRect.width, 0)),
        transformOrigin: placeAbove ? 'bottom right' : 'top right'
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition, { passive: true });
    window.addEventListener('scroll', updatePosition, { passive: true, capture: true });

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, resolvedAlign, children, title]);

  return (
    <div
      ref={wrapperRef}
      className="relative inline-flex"
      onMouseEnter={openPopover}
      onMouseLeave={scheduleClose}
      onFocusCapture={openPopover}
      onBlurCapture={(event) => {
        // portal先のパネルへフォーカスが移った場合は「外に出た」とみなさない
        if (
          !wrapperRef.current?.contains(event.relatedTarget) &&
          !panelRef.current?.contains(event.relatedTarget)
        ) {
          closePopover();
        }
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        className={buttonClassName || 'relative inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-sm transition before:absolute before:-inset-2 before:content-[""] hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900/80 dark:text-slate-100 dark:hover:bg-slate-800'}
        aria-label={buttonAriaLabel}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          clearCloseTimer();
          setOpen((prev) => {
            const next = !prev;
            if (next) shouldFocusPanelRef.current = true;
            return next;
          });
        }}
      >
        {buttonContent}
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div
          id={panelId}
          ref={panelRef}
          role="dialog"
          tabIndex={-1}
          className={`pointer-events-auto fixed z-[120] w-[min(22rem,calc(100vw-1.5rem))] rounded-2xl border border-slate-200/95 bg-white p-3 text-left text-slate-700 shadow-[0_24px_80px_-28px_rgba(15,23,42,0.55)] ring-1 ring-black/5 backdrop-blur-sm outline-none dark:border-slate-700/95 dark:bg-slate-950 dark:text-slate-100 dark:ring-white/10 ${panelClassName}`}
          style={panelStyle || undefined}
          onMouseEnter={openPopover}
          onMouseLeave={scheduleClose}
        >
          {title && (
            <div className={`mb-2 text-sm font-semibold text-slate-900 dark:text-white ${titleClassName}`}>
              {title}
            </div>
          )}
          <div className={`text-xs leading-5 text-slate-600 dark:text-slate-200 ${contentClassName}`}>
            {children}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default InfoPopover;

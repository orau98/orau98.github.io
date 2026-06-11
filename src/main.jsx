import logger from './utils/logger';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import PageViewTracker from './components/PageViewTracker';
import './index.css';

// Enable debug logs via query param (?debug=1) in production
try {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search || '');
    if (params.has('debug')) {
      window.DEBUG_LOGS = true;
    }
  }
} catch (_) {
  // ignore
}

// Silence verbose logs in production while keeping errors/warnings
if (import.meta && import.meta.env && import.meta.env.PROD && typeof window !== 'undefined' && !window.DEBUG_LOGS) {
  try {
    const noop = () => {};
    console.log = noop;
    console.debug = noop;
    console.info = noop;
  } catch (_) {
    // Ignore if console is not writable
  }
}

// Global error handler to suppress harmless browser extension errors
const isExtensionLike = (text) => {
  const value = String(text || '');
  return (
    value.includes('chrome-extension://') ||
    value.includes('moz-extension://') ||
    value.includes('safari-extension://') ||
    value.includes('extension://')
  );
};

const isExtensionErrorEvent = (event) => {
  const filename = String(event?.filename || '');
  const stack = String(event?.error?.stack || '');
  return (
    isExtensionLike(filename) ||
    isExtensionLike(stack) ||
    filename.includes('content.js')
  );
};

const isExtensionRejection = (event) => {
  const stack = String(event?.reason?.stack || '');
  const message = String(event?.reason?.message || '');
  return isExtensionLike(stack) || isExtensionLike(message);
};

const isPrimaryNavigationClick = (event) =>
  !!event &&
  !event.defaultPrevented &&
  event.button === 0 &&
  !event.metaKey &&
  !event.ctrlKey &&
  !event.shiftKey &&
  !event.altKey;

const shouldUseDocumentNavigation = (anchor) => {
  if (typeof window === 'undefined' || !anchor?.href) return false;
  if (anchor.target && anchor.target !== '_self') return false;
  if (anchor.hasAttribute('download')) return false;

  let targetUrl;
  try {
    targetUrl = new URL(anchor.href, window.location.href);
  } catch {
    return false;
  }

  if (targetUrl.origin !== window.location.origin) return false;

  const currentPath = `${window.location.pathname}${window.location.search}`;
  const targetPath = `${targetUrl.pathname}${targetUrl.search}`;

  if (targetPath === currentPath && targetUrl.hash) {
    return false;
  }

  return targetUrl.href !== window.location.href;
};

window.addEventListener('error', (event) => {
  const errorMessage = event.error?.message || '';
  const isExtension = isExtensionErrorEvent(event);
  
  // Suppress removeChild errors
  if (isExtension && errorMessage.includes('removeChild') && errorMessage.includes('not a child of this node')) {
    logger.debug('Suppressed removeChild error (harmless):', errorMessage);
    event.preventDefault();
    return false;
  }
  
  // Suppress browser extension errors (Weblio, etc.)
  if (isExtension && errorMessage.includes('startContainer')) {
    logger.debug('Suppressed browser extension error (harmless):', errorMessage);
    event.preventDefault();
    return false;
  }

  // Minimal inline reporter in debug mode to avoid white screen without clues
  try {
    if (typeof window !== 'undefined' && window.DEBUG_LOGS) {
      const id = 'debug-error-overlay';
      let box = document.getElementById(id);
      if (!box) {
        box = document.createElement('pre');
        box.id = id;
        box.style.cssText = 'position:fixed;bottom:0;left:0;right:0;max-height:40vh;overflow:auto;background:#111;color:#f66;padding:8px;margin:0;z-index:99999;font-size:12px;white-space:pre-wrap;';
        document.body.appendChild(box);
      }
      const msg = `[error] ${errorMessage || event.message || 'unknown error'}\n` + (event.error?.stack || '');
      box.textContent += `\n${msg}`;
    }
  } catch {}
});

// Also handle unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  const reasonMessage = event.reason?.message || '';
  const isExtension = isExtensionRejection(event);
  
  if (isExtension && reasonMessage.includes('removeChild') && reasonMessage.includes('not a child of this node')) {
    logger.debug('Suppressed removeChild promise rejection (harmless):', reasonMessage);
    event.preventDefault();
    return false;
  }
  
  // Suppress extension-related promise rejections
  if (isExtension && reasonMessage.includes('startContainer')) {
    logger.debug('Suppressed extension promise rejection (harmless):', reasonMessage);
    event.preventDefault();
    return false;
  }

  // Minimal inline reporter in debug mode for async errors
  try {
    if (typeof window !== 'undefined' && window.DEBUG_LOGS) {
      const id = 'debug-error-overlay';
      let box = document.getElementById(id);
      if (!box) {
        box = document.createElement('pre');
        box.id = id;
        box.style.cssText = 'position:fixed;bottom:0;left:0;right:0;max-height:40vh;overflow:auto;background:#111;color:#f66;padding:8px;margin:0;z-index:99999;font-size:12px;white-space:pre-wrap;';
        document.body.appendChild(box);
      }
      const msg = `[unhandledrejection] ${reasonMessage || String(event.reason)}\n` + (event.reason?.stack || '');
      box.textContent += `\n${msg}`;
    }
  } catch {}
});

if (typeof document !== 'undefined') {
  document.addEventListener(
    'click',
    (event) => {
      if (!isPrimaryNavigationClick(event)) return;
      const anchor = event.target?.closest?.('a[href]');
      if (!anchor || !shouldUseDocumentNavigation(anchor)) return;
      event.preventDefault();
      window.location.assign(anchor.href);
    },
    true,
  );
}

// Note: SPA deep-link redirect is handled by 404.html -> index.html
// and restoration logic in index.html. No additional handler here.

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter basename={import.meta.env.BASE_URL}>
    <PageViewTracker />
    <App />
  </BrowserRouter>
);

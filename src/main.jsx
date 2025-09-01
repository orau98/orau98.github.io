import React from 'react';
import logger from './utils/logger';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

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

// Bot detection and anti-scraping measures
(function() {
  // Detect headless browsers and automation tools
  const suspiciousFeatures = [
    !window.navigator.webdriver === undefined,
    window.chrome && window.chrome.runtime && window.chrome.runtime.onConnect,
    window.phantom,
    window._phantom,
    window.__nightmare,
    window.domAutomation,
    window.callPhantom,
    navigator.userAgent.includes('PhantomJS'),
    navigator.userAgent.includes('HeadlessChrome'),
    navigator.userAgent.includes('bot'),
    navigator.userAgent.includes('crawler'),
    navigator.userAgent.includes('spider'),
    navigator.webdriver === true
  ];

  if (suspiciousFeatures.some(feature => feature)) {
    logger.warn('Bot detection triggered, but allowing access for debugging');
    // TEMPORARILY DISABLED: document.body.innerHTML = '<div style="text-align:center;padding:50px;">Access Restricted</div>';
    // TEMPORARILY DISABLED: throw new Error('Automated access detected');
  }

  // Rate limiting check
  const accessKey = 'page_access_count';
  const timeKey = 'page_access_time';
  const maxRequests = 100;
  const timeWindow = 3600000; // 1 hour
  
  const currentTime = Date.now();
  const lastAccess = localStorage.getItem(timeKey);
  const accessCount = parseInt(localStorage.getItem(accessKey) || '0');
  
  if (lastAccess && (currentTime - parseInt(lastAccess)) < timeWindow) {
    if (accessCount > maxRequests) {
      logger.warn('Rate limit would be triggered, but allowing access for debugging');
      // TEMPORARILY DISABLED: document.body.innerHTML = '<div style="text-align:center;padding:50px;">Rate limit exceeded</div>';
      // TEMPORARILY DISABLED: throw new Error('Rate limit exceeded');
    }
    localStorage.setItem(accessKey, (accessCount + 1).toString());
  } else {
    localStorage.setItem(accessKey, '1');
    localStorage.setItem(timeKey, currentTime.toString());
  }
})();

// Global error handler to suppress harmless browser extension errors
window.addEventListener('error', (event) => {
  const errorMessage = event.error?.message || '';
  
  // Suppress removeChild errors
  if (errorMessage.includes('removeChild') && errorMessage.includes('not a child of this node')) {
    logger.debug('Suppressed removeChild error (harmless):', errorMessage);
    event.preventDefault();
    return false;
  }
  
  // Suppress browser extension errors (Weblio, etc.)
  if (errorMessage.includes('startContainer') || 
      event.filename?.includes('content.js') ||
      event.filename?.includes('extension')) {
    logger.debug('Suppressed browser extension error (harmless):', errorMessage);
    event.preventDefault();
    return false;
  }
});

// Also handle unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  const reasonMessage = event.reason?.message || '';
  
  if (reasonMessage.includes('removeChild') && reasonMessage.includes('not a child of this node')) {
    logger.debug('Suppressed removeChild promise rejection (harmless):', reasonMessage);
    event.preventDefault();
    return false;
  }
  
  // Suppress extension-related promise rejections
  if (reasonMessage.includes('startContainer') || reasonMessage.includes('extension')) {
    logger.debug('Suppressed extension promise rejection (harmless):', reasonMessage);
    event.preventDefault();
    return false;
  }
});

// Note: SPA deep-link redirect is handled by 404.html -> index.html
// and restoration logic in index.html. No additional handler here.

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);

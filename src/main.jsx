import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

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
    document.body.innerHTML = '<div style="text-align:center;padding:50px;">Access Restricted</div>';
    throw new Error('Automated access detected');
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
      document.body.innerHTML = '<div style="text-align:center;padding:50px;">Rate limit exceeded</div>';
      throw new Error('Rate limit exceeded');
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
    console.debug('Suppressed removeChild error (harmless):', errorMessage);
    event.preventDefault();
    return false;
  }
  
  // Suppress browser extension errors (Weblio, etc.)
  if (errorMessage.includes('startContainer') || 
      event.filename?.includes('content.js') ||
      event.filename?.includes('extension')) {
    console.debug('Suppressed browser extension error (harmless):', errorMessage);
    event.preventDefault();
    return false;
  }
});

// Also handle unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  const reasonMessage = event.reason?.message || '';
  
  if (reasonMessage.includes('removeChild') && reasonMessage.includes('not a child of this node')) {
    console.debug('Suppressed removeChild promise rejection (harmless):', reasonMessage);
    event.preventDefault();
    return false;
  }
  
  // Suppress extension-related promise rejections
  if (reasonMessage.includes('startContainer') || reasonMessage.includes('extension')) {
    console.debug('Suppressed extension promise rejection (harmless):', reasonMessage);
    event.preventDefault();
    return false;
  }
});

// GitHub Pages SPA redirect script
(function(l) {
  if (l.search[1] === '/' ) {
    var decoded = l.search.slice(1).split('&').map(function(s) { 
      return s.replace(/~and~/g, '&')
    }).join('?');
    window.history.replaceState(null, null,
        l.pathname.slice(0, -1) + decoded + l.hash
    );
  }
}(window.location))

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter basename="/insects-host-plant-explorer-">
    <App />
  </BrowserRouter>
);
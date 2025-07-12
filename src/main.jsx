import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

// Global error handler to suppress removeChild errors
window.addEventListener('error', (event) => {
  if (event.error && event.error.message && 
      event.error.message.includes('removeChild') &&
      event.error.message.includes('not a child of this node')) {
    console.debug('Suppressed removeChild error (harmless):', event.error.message);
    event.preventDefault();
    return false;
  }
});

// Also handle unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason && event.reason.message && 
      event.reason.message.includes('removeChild') &&
      event.reason.message.includes('not a child of this node')) {
    console.debug('Suppressed removeChild promise rejection (harmless):', event.reason.message);
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
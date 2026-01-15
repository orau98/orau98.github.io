/**
 * Simple logger utility that respects production/debug settings
 */
const isDev = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV;
const isDebug = typeof window !== 'undefined' && window.DEBUG_LOGS;

const logger = {
  log: (...args) => {
    if (isDev || isDebug) {
      console.log('[LOG]', ...args);
    }
  },
  debug: (...args) => {
    if (isDev || isDebug) {
      console.debug('[DEBUG]', ...args);
    }
  },
  info: (...args) => {
    if (isDev || isDebug) {
      console.info('[INFO]', ...args);
    }
  },
  warn: (...args) => {
    console.warn('[WARN]', ...args);
  },
  error: (...args) => {
    console.error('[ERROR]', ...args);
  },
};

export default logger;

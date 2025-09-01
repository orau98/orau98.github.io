// Lightweight logger utility with environment-aware output control
// - debug/info: shown in dev or when window.DEBUG_LOGS === true
// - warn/error: always shown

const isBrowser = typeof window !== 'undefined';
const isDev = typeof import.meta !== 'undefined' && import.meta.env && !!import.meta.env.DEV;
const allowVerbose = (isDev || (isBrowser && !!window.DEBUG_LOGS));

const safeCall = (fn, ...args) => {
  try {
    // Some environments may lock console methods; guard just in case
    return fn && fn.apply ? fn.apply(console, args) : undefined;
  } catch (_) {
    return undefined;
  }
};

const logger = {
  debug: (...args) => { if (allowVerbose) safeCall(console.debug, ...args); },
  info: (...args) => { if (allowVerbose) safeCall(console.info, ...args); },
  warn: (...args) => { safeCall(console.warn, ...args); },
  error: (...args) => { safeCall(console.error, ...args); },
  group: (label) => { if (allowVerbose) safeCall(console.group, label); },
  groupEnd: () => { if (allowVerbose) safeCall(console.groupEnd); },
  time: (label) => { if (allowVerbose) safeCall(console.time, label); },
  timeEnd: (label) => { if (allowVerbose) safeCall(console.timeEnd, label); },
};

export default logger;

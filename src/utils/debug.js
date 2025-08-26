// Debug utility with toggleable output
// Set DEBUG_MODE to true in localStorage to enable debug messages
// localStorage.setItem('STRATA_DEBUG_MODE', 'true')

const isDebugMode = () => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('STRATA_DEBUG_MODE') === 'true';
};

const debug = {
  log: (...args) => {
    if (isDebugMode()) {
      console.log(...args);
    }
  },
  
  warn: (...args) => {
    if (isDebugMode()) {
      console.warn(...args);
    }
  },
  
  error: (...args) => {
    // Always show errors
    console.error(...args);
  },
  
  info: (...args) => {
    if (isDebugMode()) {
      console.info(...args);
    }
  },
  
  debug: (...args) => {
    if (isDebugMode()) {
      console.debug(...args);
    }
  },
  
  trace: (...args) => {
    if (isDebugMode()) {
      console.trace(...args);
    }
  },
  
  group: (...args) => {
    if (isDebugMode()) {
      console.group(...args);
    }
  },
  
  groupEnd: () => {
    if (isDebugMode()) {
      console.groupEnd();
    }
  },
  
  table: (...args) => {
    if (isDebugMode()) {
      console.table(...args);
    }
  }
};

// Export both the debug object and individual methods for convenience
export default debug;
export const { log, warn, error, info, trace, group, groupEnd, table } = debug;
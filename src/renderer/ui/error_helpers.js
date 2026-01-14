/**
 * Centralized error handling and logging utility
 * Reduces boilerplate try-catch-console patterns throughout the codebase
 */

// Log levels
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

// Current log level (can be configured)
let currentLogLevel = LOG_LEVELS.INFO;

/**
 * Set the current log level
 * @param {string|number} level - 'ERROR', 'WARN', 'INFO', 'DEBUG' or numeric value
 */
function setLogLevel(level) {
  if (typeof level === 'string') {
    currentLogLevel = LOG_LEVELS[level.toUpperCase()] ?? LOG_LEVELS.INFO;
  } else if (typeof level === 'number') {
    currentLogLevel = level;
  }
}

/**
 * Safe console.error wrapper
 * @param {string} prefix - Log prefix (e.g., '[broker]')
 * @param {...any} args - Arguments to log
 */
function logError(prefix, ...args) {
  if (currentLogLevel >= LOG_LEVELS.ERROR) {
    try {
      console.error(prefix, ...args);
    } catch (_) {}
  }
}

/**
 * Safe console.warn wrapper
 * @param {string} prefix - Log prefix
 * @param {...any} args - Arguments to log
 */
function logWarn(prefix, ...args) {
  if (currentLogLevel >= LOG_LEVELS.WARN) {
    try {
      console.warn(prefix, ...args);
    } catch (_) {}
  }
}

/**
 * Safe console.log wrapper (info level)
 * @param {string} prefix - Log prefix
 * @param {...any} args - Arguments to log
 */
function logInfo(prefix, ...args) {
  if (currentLogLevel >= LOG_LEVELS.INFO) {
    try {
      console.log(prefix, ...args);
    } catch (_) {}
  }
}

/**
 * Safe console.log wrapper (debug level)
 * @param {string} prefix - Log prefix
 * @param {...any} args - Arguments to log
 */
function logDebug(prefix, ...args) {
  if (currentLogLevel >= LOG_LEVELS.DEBUG) {
    try {
      console.log(prefix, ...args);
    } catch (_) {}
  }
}

/**
 * Execute function with error handling
 * @param {Function} fn - Function to execute
 * @param {*} defaultValue - Default value to return on error
 * @param {string} errorPrefix - Prefix for error logging
 * @returns {*} - Result of fn or defaultValue on error
 */
function safe(fn, defaultValue = undefined, errorPrefix = '[safe]') {
  try {
    return fn();
  } catch (e) {
    if (currentLogLevel >= LOG_LEVELS.ERROR) {
      logError(errorPrefix, e);
    }
    return defaultValue;
  }
}

/**
 * Execute async function with error handling
 * @param {Function} fn - Async function to execute
 * @param {*} defaultValue - Default value to return on error
 * @param {string} errorPrefix - Prefix for error logging
 * @returns {Promise<*>} - Result of fn or defaultValue on error
 */
async function safeAsync(fn, defaultValue = undefined, errorPrefix = '[safeAsync]') {
  try {
    return await fn();
  } catch (e) {
    if (currentLogLevel >= LOG_LEVELS.ERROR) {
      logError(errorPrefix, e);
    }
    return defaultValue;
  }
}

/**
 * Execute function with silent error handling (no logging)
 * @param {Function} fn - Function to execute
 * @param {*} defaultValue - Default value to return on error
 * @returns {*} - Result of fn or defaultValue on error
 */
function silent(fn, defaultValue = undefined) {
  try {
    return fn();
  } catch (_) {
    return defaultValue;
  }
}

/**
 * Execute async function with silent error handling (no logging)
 * @param {Function} fn - Async function to execute
 * @param {*} defaultValue - Default value to return on error
 * @returns {Promise<*>} - Result of fn or defaultValue on error
 */
async function silentAsync(fn, defaultValue = undefined) {
  try {
    return await fn();
  } catch (_) {
    return defaultValue;
  }
}

/**
 * Wrap a function with automatic error handling
 * @param {Function} fn - Function to wrap
 * @param {Object} options - Options { defaultValue, errorPrefix, silent }
 * @returns {Function} - Wrapped function
 */
function wrap(fn, options = {}) {
  const { defaultValue, errorPrefix = '[wrap]', silent: isSilent = false } = options;
  return function (...args) {
    try {
      return fn.apply(this, args);
    } catch (e) {
      if (!isSilent && currentLogLevel >= LOG_LEVELS.ERROR) {
        logError(errorPrefix, e);
      }
      return defaultValue;
    }
  };
}

/**
 * Wrap an async function with automatic error handling
 * @param {Function} fn - Async function to wrap
 * @param {Object} options - Options { defaultValue, errorPrefix, silent }
 * @returns {Function} - Wrapped async function
 */
function wrapAsync(fn, options = {}) {
  const { defaultValue, errorPrefix = '[wrapAsync]', silent: isSilent = false } = options;
  return async function (...args) {
    try {
      return await fn.apply(this, args);
    } catch (e) {
      if (!isSilent && currentLogLevel >= LOG_LEVELS.ERROR) {
        logError(errorPrefix, e);
      }
      return defaultValue;
    }
  };
}

/**
 * Create a logger instance with a fixed prefix
 * @param {string} prefix - Log prefix
 * @returns {Object} - Logger object with error, warn, info, debug methods
 */
function createLogger(prefix) {
  return {
    error: (...args) => logError(prefix, ...args),
    warn: (...args) => logWarn(prefix, ...args),
    info: (...args) => logInfo(prefix, ...args),
    debug: (...args) => logDebug(prefix, ...args),
    safe: (fn, defaultValue) => safe(fn, defaultValue, prefix),
    safeAsync: (fn, defaultValue) => safeAsync(fn, defaultValue, prefix),
    silent: (fn, defaultValue) => silent(fn, defaultValue),
    silentAsync: (fn, defaultValue) => silentAsync(fn, defaultValue)
  };
}

/**
 * Measure execution time of a function
 * @param {string} label - Label for timing
 * @param {Function} fn - Function to time
 * @returns {*} - Result of fn
 */
function time(label, fn) {
  try {
    const start = performance.now();
    const result = fn();
    const duration = performance.now() - start;
    logDebug(`[time] ${label}`, `${duration.toFixed(2)}ms`);
    return result;
  } catch (e) {
    logError(`[time] ${label} failed`, e);
    throw e;
  }
}

/**
 * Measure execution time of an async function
 * @param {string} label - Label for timing
 * @param {Function} fn - Async function to time
 * @returns {Promise<*>} - Result of fn
 */
async function timeAsync(label, fn) {
  try {
    const start = performance.now();
    const result = await fn();
    const duration = performance.now() - start;
    logDebug(`[time] ${label}`, `${duration.toFixed(2)}ms`);
    return result;
  } catch (e) {
    logError(`[time] ${label} failed`, e);
    throw e;
  }
}

// Export for use in renderer scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    LOG_LEVELS,
    setLogLevel,
    logError,
    logWarn,
    logInfo,
    logDebug,
    safe,
    safeAsync,
    silent,
    silentAsync,
    wrap,
    wrapAsync,
    createLogger,
    time,
    timeAsync
  };
}

// Also expose globally for inline scripts
if (typeof window !== 'undefined') {
  window.ErrorHelpers = {
    LOG_LEVELS,
    setLogLevel,
    logError,
    logWarn,
    logInfo,
    logDebug,
    safe,
    safeAsync,
    silent,
    silentAsync,
    wrap,
    wrapAsync,
    createLogger,
    time,
    timeAsync
  };
}

/**
 * Shared IPC utility patterns for main process
 * Reduces boilerplate in IPC handler modules
 */

/**
 * Create a safe IPC handler with automatic error handling
 * @param {Function} handler - Handler function (can be async)
 * @param {string} [logPrefix] - Optional log prefix for errors
 * @returns {Function} - Wrapped handler
 */
function createSafeHandler(handler, logPrefix = '[ipc]') {
  return async (event, ...args) => {
    try {
      return await handler(event, ...args);
    } catch (e) {
      console.error(`${logPrefix} handler error:`, e);
      return undefined;
    }
  };
}

/**
 * Register multiple IPC handlers at once
 * @param {object} ipcMain - IPC main instance
 * @param {object} handlers - Map of channel names to handlers
 * @param {string} [logPrefix] - Optional log prefix for errors
 */
function registerHandlers(ipcMain, handlers, logPrefix) {
  for (const [channel, handler] of Object.entries(handlers)) {
    try {
      ipcMain.handle(channel, createSafeHandler(handler, `${logPrefix || '[ipc]'}[${channel}]`));
    } catch (e) {
      console.error(`Failed to register handler for ${channel}:`, e);
    }
  }
}

/**
 * Register multiple IPC listeners (fire-and-forget) at once
 * @param {object} ipcMain - IPC main instance
 * @param {object} listeners - Map of channel names to listeners
 * @param {string} [logPrefix] - Optional log prefix for errors
 */
function registerListeners(ipcMain, listeners, logPrefix) {
  for (const [channel, listener] of Object.entries(listeners)) {
    try {
      ipcMain.on(channel, createSafeHandler(listener, `${logPrefix || '[ipc]'}[${channel}]`));
    } catch (e) {
      console.error(`Failed to register listener for ${channel}:`, e);
    }
  }
}

/**
 * Safe webContents.send wrapper
 * @param {object} webContents - WebContents instance
 * @param {string} channel - Channel name
 * @param {*} payload - Payload to send
 */
function safeSend(webContents, channel, payload) {
  try {
    if (webContents && !webContents.isDestroyed()) {
      webContents.send(channel, payload);
    }
  } catch (e) {
    console.error(`[safeSend] ${channel} error:`, e);
  }
}

/**
 * Broadcast to multiple webContents
 * @param {object[]} webContentsList - Array of webContents
 * @param {string} channel - Channel name
 * @param {*} payload - Payload to send
 */
function broadcastToMany(webContentsList, channel, payload) {
  for (const wc of webContentsList) {
    safeSend(wc, channel, payload);
  }
}

/**
 * Get safe response wrapper for invoke handlers
 * @param {*} data - Data to return
 * @param {string|null} error - Error message if any
 * @returns {object} - Response object { success, data, error }
 */
function response(data = null, error = null) {
  return {
    success: !error,
    data,
    error
  };
}

/**
 * Create an IPC module with consistent setup
 * @param {string} moduleName - Module name for logging
 * @returns {object} - Module helper object
 */
function createIpcModule(moduleName) {
  const prefix = `[ipc:${moduleName}]`;
  
  return {
    /**
     * Register handlers for this module
     * @param {object} ipcMain - IPC main instance
     * @param {object} handlers - Map of channel names to handlers
     */
    registerHandlers: (ipcMain, handlers) => registerHandlers(ipcMain, handlers, prefix),
    
    /**
     * Register listeners for this module
     * @param {object} ipcMain - IPC main instance
     * @param {object} listeners - Map of channel names to listeners
     */
    registerListeners: (ipcMain, listeners) => registerListeners(ipcMain, listeners, prefix),
    
    /**
     * Create a safe handler with module prefix
     * @param {Function} handler - Handler function
     * @returns {Function} - Wrapped handler
     */
    safeHandler: (handler) => createSafeHandler(handler, prefix),
    
    /**
     * Log info message
     * @param {...any} args - Arguments to log
     */
    log: (...args) => {
      try {
        console.log(prefix, ...args);
      } catch (_) {}
    },
    
    /**
     * Log error message
     * @param {...any} args - Arguments to log
     */
    error: (...args) => {
      try {
        console.error(prefix, ...args);
      } catch (_) {}
    },
    
    /**
     * Create response object
     * @param {*} data - Data to return
     * @param {string|null} error - Error message if any
     * @returns {object} - Response object
     */
    response: (data, error) => response(data, error)
  };
}

module.exports = {
  createSafeHandler,
  registerHandlers,
  registerListeners,
  safeSend,
  broadcastToMany,
  response,
  createIpcModule
};

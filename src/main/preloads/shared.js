// Shared helpers for preload scripts
// Centralizes common patterns used across main.js and shim

const { ipcRenderer } = require('electron');

/**
 * Create IPC subscription with unsubscribe function
 * @param {string} channel - IPC channel name
 * @param {Function} wrap - Callback wrapper function
 * @returns {Function} Unsubscribe function
 */
function withUnsub(channel, wrap){
  const handler = (_, payload) => { try { wrap(payload); } catch(_){ } };
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

module.exports = { withUnsub };

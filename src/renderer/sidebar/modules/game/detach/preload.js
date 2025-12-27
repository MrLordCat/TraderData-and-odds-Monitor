/**
 * Game Detached Window - Preload Script
 * 
 * Exposes minimal API for communication between
 * detached window and main process (which routes to GameCore in sidebar)
 */

const { contextBridge, ipcRenderer } = require('electron');

// Message handler storage
let messageHandler = null;

// Listen for messages from main process
ipcRenderer.on('game-message', (_, message) => {
  if (messageHandler) {
    try { messageHandler(message); } catch (e) { console.error('[gamePreload] handler error:', e); }
  }
});

// Expose API to renderer
contextBridge.exposeInMainWorld('gameAPI', {
  /**
   * Register handler for messages from GameCore
   * @param {Function} callback - (message: {type, payload, ts}) => void
   */
  onMessage: (callback) => {
    messageHandler = callback;
  },

  /**
   * Send input action to GameCore
   * @param {string} action - 'up', 'down', 'left', 'right', 'action'
   */
  sendInput: (action) => {
    ipcRenderer.send('game-input', { action });
  },

  /**
   * Send command to GameCore
   * @param {string} cmd - 'start', 'stop', 'reset', 'togglePause', 'attach'
   */
  sendCommand: (cmd) => {
    ipcRenderer.send('game-command', { cmd });
  },

  /**
   * Notify main process that window is ready
   */
  notifyReady: () => {
    ipcRenderer.send('game-window-ready');
  },

  /**
   * Notify main process that window is closing
   */
  notifyClose: () => {
    ipcRenderer.send('game-window-close');
  }
});

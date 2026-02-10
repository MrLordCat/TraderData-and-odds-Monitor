/**
 * Theme IPC Module
 * 
 * v0.3.0 - Global theme toggle support
 * Handles theme persistence and broadcast to all windows/views.
 */

const { ipcMain, BrowserWindow } = require('electron');

const VALID_THEMES = ['dark', 'light'];
const DEFAULT_THEME = 'dark';

function sanitizeTheme(value) {
  return VALID_THEMES.includes(value) ? value : DEFAULT_THEME;
}

/**
 * Broadcast theme change to all windows and views
 * @param {string} theme - 'dark' or 'light'
 */
function broadcastTheme(theme) {
  try {
    BrowserWindow.getAllWindows().forEach(win => {
      if (win.isDestroyed()) return;
      
      // Send to window
      try {
        win.webContents.send('theme-changed', theme);
      } catch (_) { }
      
      // Send to all BrowserViews attached to window
      try {
        if (typeof win.getBrowserViews === 'function') {
          win.getBrowserViews().forEach(view => {
            try {
              if (view.webContents && !view.webContents.isDestroyed()) {
                view.webContents.send('theme-changed', theme);
              }
            } catch (_) { }
          });
        }
      } catch (_) { }
    });
  } catch (e) {
    console.error('[theme] broadcastTheme failed:', e);
  }
}

/**
 * Initialize theme IPC handlers
 * @param {Object} ctx - Context object with store
 * @param {Store} ctx.store - electron-store instance
 */
function initThemeIpc({ store, statsManager }) {
  // Get current theme
  ipcMain.handle('theme-get', () => {
    try {
      return sanitizeTheme(store.get('appTheme'));
    } catch (_) {
      return DEFAULT_THEME;
    }
  });
  
  // Set theme and broadcast to all windows
  ipcMain.handle('theme-set', (_, theme) => {
    const sanitized = sanitizeTheme(theme);
    try {
      store.set('appTheme', sanitized);
      console.log('[theme] Theme set to:', sanitized);
      broadcastTheme(sanitized);
      try { statsManager?.refreshCoverTheme?.(); } catch(_){ }
    } catch (e) {
      console.error('[theme] Failed to set theme:', e);
    }
    return sanitized;
  });
  
  // Toggle theme (convenience handler)
  ipcMain.handle('theme-toggle', () => {
    try {
      const current = sanitizeTheme(store.get('appTheme'));
      const next = current === 'dark' ? 'light' : 'dark';
      store.set('appTheme', next);
      console.log('[theme] Theme toggled to:', next);
      broadcastTheme(next);
      try { statsManager?.refreshCoverTheme?.(); } catch(_){ }
      return next;
    } catch (e) {
      console.error('[theme] Failed to toggle theme:', e);
      return DEFAULT_THEME;
    }
  });
  
  console.log('[theme] IPC handlers registered');
}

module.exports = { initThemeIpc, broadcastTheme };

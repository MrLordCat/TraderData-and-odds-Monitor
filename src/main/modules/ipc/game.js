/**
 * Game Module - IPC Handlers for Main Process
 * 
 * These handlers manage communication between:
 * - Sidebar (GameCore) <-> Main Process <-> Detached Window
 * 
 * Flow:
 *   GameCore broadcasts → main forwards to detached window
 *   Detached input → main forwards to sidebar → GameCore.input()
 */

const { BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// Store active game windows
const gameWindows = new Map();

// Reference to main window (set during init)
let mainWindowRef = null;

/**
 * Initialize game IPC handlers
 * @param {object} ctx - Context with mainWindow reference
 */
function initGameIpc(ctx = {}) {
  mainWindowRef = ctx.mainWindow || null;
  
  // ============================================
  // DETACH / ATTACH
  // ============================================
  
  /**
   * Create detached game window
   * Returns { windowId } on success
   */
  ipcMain.handle('game-detach', async (event, config = {}) => {
    try {
      const preloadPath = path.join(__dirname, '..', '..', '..', 'renderer', 'sidebar', 'modules', 'game', 'detach', 'preload.js');
      const htmlPath = path.join(__dirname, '..', '..', '..', 'renderer', 'sidebar', 'modules', 'game', 'detach', 'window.html');
      
      const win = new BrowserWindow({
        width: config.width || 340,
        height: config.height || 460,
        minWidth: 280,
        minHeight: 380,
        frame: true,
        resizable: true,
        alwaysOnTop: false,
        backgroundColor: '#1a1a2e',
        title: 'Game',
        webPreferences: {
          preload: preloadPath,
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: false
        }
      });
      
      // Remove menu
      win.setMenu(null);
      
      await win.loadFile(htmlPath);
      
      const windowId = win.id;
      gameWindows.set(windowId, {
        win,
        senderWebContentsId: event.sender.id
      });
      
      // Handle window close
      win.on('closed', () => {
        gameWindows.delete(windowId);
        // Notify sidebar that window closed
        try {
          if (mainWindowRef && !mainWindowRef.isDestroyed()) {
            mainWindowRef.webContents.send('game-window-closed', { windowId });
          }
        } catch (e) { /* ignore */ }
      });
      
      console.log('[GameIPC] Detached window created:', windowId);
      return { windowId, success: true };
      
    } catch (err) {
      console.error('[GameIPC] Failed to create detached window:', err);
      return { success: false, error: err.message };
    }
  });
  
  /**
   * Close detached game window (attach back to sidebar)
   */
  ipcMain.handle('game-attach', async (event, { windowId }) => {
    try {
      const entry = gameWindows.get(windowId);
      if (entry && entry.win && !entry.win.isDestroyed()) {
        entry.win.close();
      }
      gameWindows.delete(windowId);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
  
  // ============================================
  // MESSAGE FORWARDING: SIDEBAR → DETACHED
  // ============================================
  
  /**
   * Forward game state/frame from sidebar to detached window
   */
  ipcMain.on('game-broadcast', (event, { windowId, message }) => {
    try {
      const entry = gameWindows.get(windowId);
      if (entry && entry.win && !entry.win.isDestroyed()) {
        entry.win.webContents.send('game-message', message);
      }
    } catch (e) {
      console.warn('[GameIPC] broadcast error:', e.message);
    }
  });
  
  /**
   * Broadcast to ALL detached game windows
   */
  ipcMain.on('game-broadcast-all', (event, { message }) => {
    gameWindows.forEach((entry, windowId) => {
      try {
        if (entry.win && !entry.win.isDestroyed()) {
          entry.win.webContents.send('game-message', message);
        }
      } catch (e) { /* ignore */ }
    });
  });
  
  // ============================================
  // MESSAGE FORWARDING: DETACHED → SIDEBAR
  // ============================================
  
  /**
   * Forward input from detached window to sidebar
   */
  ipcMain.on('game-input', (event, { action }) => {
    try {
      // Find which sidebar this belongs to
      let targetWc = null;
      
      // First try to find by sender
      for (const [windowId, entry] of gameWindows) {
        if (entry.win && entry.win.webContents.id === event.sender.id) {
          // Found the detached window, route to its parent sidebar
          const parentWc = findWebContentsById(entry.senderWebContentsId);
          if (parentWc) targetWc = parentWc;
          break;
        }
      }
      
      // Fallback: send to main window
      if (!targetWc && mainWindowRef && !mainWindowRef.isDestroyed()) {
        targetWc = mainWindowRef.webContents;
      }
      
      if (targetWc) {
        targetWc.send('game-detached-input', { action });
      }
    } catch (e) {
      console.warn('[GameIPC] input forward error:', e.message);
    }
  });
  
  /**
   * Forward command from detached window to sidebar
   */
  ipcMain.on('game-command', (event, { cmd }) => {
    try {
      if (mainWindowRef && !mainWindowRef.isDestroyed()) {
        mainWindowRef.webContents.send('game-detached-command', { cmd });
      }
    } catch (e) {
      console.warn('[GameIPC] command forward error:', e.message);
    }
  });
  
  /**
   * Detached window ready notification
   */
  ipcMain.on('game-window-ready', (event) => {
    try {
      // Find windowId and notify sidebar
      for (const [windowId, entry] of gameWindows) {
        if (entry.win && entry.win.webContents.id === event.sender.id) {
          if (mainWindowRef && !mainWindowRef.isDestroyed()) {
            mainWindowRef.webContents.send('game-window-ready', { windowId });
          }
          // Send connected message to window
          entry.win.webContents.send('game-message', { type: 'connected' });
          break;
        }
      }
    } catch (e) { /* ignore */ }
  });
  
  /**
   * Detached window close notification
   */
  ipcMain.on('game-window-close', (event) => {
    // Window will be cleaned up in 'closed' event handler
  });
  
  // ============================================
  // UTILITIES
  // ============================================
  
  /**
   * Get list of active game window IDs
   */
  ipcMain.handle('game-list-windows', () => {
    return Array.from(gameWindows.keys());
  });
  
  console.log('[GameIPC] Handlers initialized');
}

/**
 * Find webContents by ID
 */
function findWebContentsById(id) {
  const allWindows = BrowserWindow.getAllWindows();
  for (const win of allWindows) {
    if (!win.isDestroyed() && win.webContents.id === id) {
      return win.webContents;
    }
  }
  return null;
}

/**
 * Update main window reference (call if mainWindow changes)
 */
function setMainWindow(win) {
  mainWindowRef = win;
}

/**
 * Close all game windows (call on app quit)
 */
function closeAllGameWindows() {
  gameWindows.forEach((entry) => {
    try {
      if (entry.win && !entry.win.isDestroyed()) {
        entry.win.close();
      }
    } catch (e) { /* ignore */ }
  });
  gameWindows.clear();
}

module.exports = {
  initGameIpc,
  setMainWindow,
  closeAllGameWindows
};

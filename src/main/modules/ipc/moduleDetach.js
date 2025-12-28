/**
 * Module Detach IPC handlers
 * 
 * Universal mechanism to detach any sidebar module into separate window
 */

const { ipcMain, BrowserWindow } = require('electron');
const path = require('path');

// Track detached windows by module id
const detachedWindows = new Map();

// Store module states for transfer between windows
const moduleStates = new Map();

/**
 * Close all detached windows (called on app quit)
 */
function closeAllDetachedWindows() {
  console.log(`[moduleDetach] Closing all detached windows (${detachedWindows.size})`);
  for (const [id, win] of detachedWindows) {
    try {
      if (win && !win.isDestroyed()) {
        win.destroy(); // Force destroy to avoid blocking quit
      }
    } catch (e) {
      console.warn(`[moduleDetach] Error closing ${id}:`, e.message);
    }
  }
  detachedWindows.clear();
  moduleStates.clear();
}

function registerModuleDetachIpc({ mainWindow, store, getStatsWebContentsList }) {
  
  /**
   * Store module state before detach
   */
  ipcMain.handle('module-store-state', async (event, { moduleId, state }) => {
    try {
      moduleStates.set(moduleId, state);
      console.log(`[moduleDetach] Stored state for module: ${moduleId}`);
      return { success: true };
    } catch (e) {
      console.error(`[moduleDetach] Failed to store state:`, e);
      return { success: false, error: e.message };
    }
  });
  
  /**
   * Get stored module state
   */
  ipcMain.handle('module-get-state', async (event, { moduleId }) => {
    try {
      const state = moduleStates.get(moduleId);
      console.log(`[moduleDetach] Retrieved state for module: ${moduleId}, hasState: ${!!state}`);
      return { success: true, state };
    } catch (e) {
      console.error(`[moduleDetach] Failed to get state:`, e);
      return { success: false, error: e.message };
    }
  });
  
  /**
   * Clear module state (when no longer needed)
   */
  ipcMain.handle('module-clear-state', async (event, { moduleId }) => {
    moduleStates.delete(moduleId);
    return { success: true };
  });
  
  /**
   * Create detached window for a module
   */
  ipcMain.handle('module-detach', async (event, { moduleId, modulePath, title, width, height }) => {
    try {
      // Close existing if any
      if (detachedWindows.has(moduleId)) {
        const existing = detachedWindows.get(moduleId);
        if (existing && !existing.isDestroyed()) {
          existing.focus();
          return { success: true, reused: true };
        }
      }
      
      console.log(`[moduleDetach] Creating window for: ${moduleId}, path: ${modulePath}`);
      
      const win = new BrowserWindow({
        width: width || 600,
        height: height || 800,
        minWidth: 300,
        minHeight: 400,
        title: title || 'Module',
        frame: true,
        resizable: true,
        show: false,
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false,
          webSecurity: false
        }
      });
      
      // Load detach HTML template
      const detachHtmlPath = path.join(__dirname, '..', '..', '..', 'renderer', 'pages', 'module_detach.html');
      console.log(`[moduleDetach] Loading HTML: ${detachHtmlPath}`);
      
      await win.loadFile(detachHtmlPath, {
        query: {
          moduleId,
          modulePath: encodeURIComponent(modulePath),
          title
        }
      });
      
      // Show window - use both ready-to-show and a fallback timer
      let shown = false;
      win.once('ready-to-show', () => {
        if (!shown) {
          shown = true;
          win.show();
          console.log(`[moduleDetach] Window shown (ready-to-show): ${moduleId}`);
        }
      });
      
      // Fallback: show after 500ms if ready-to-show didn't fire
      setTimeout(() => {
        if (!shown && win && !win.isDestroyed()) {
          shown = true;
          win.show();
          console.log(`[moduleDetach] Window shown (fallback timer): ${moduleId}`);
        }
      }, 500);
      
      win.on('closed', () => {
        detachedWindows.delete(moduleId);
        // Notify stats panel (where addon_loader lives) that module was reattached
        // Send to all stats webContents since addon_loader is in stats panel
        try {
          const statsWcList = getStatsWebContentsList ? getStatsWebContentsList() : [];
          for (const wc of statsWcList) {
            if (wc && !wc.isDestroyed()) {
              wc.send('module-reattached', { moduleId });
            }
          }
          console.log(`[moduleDetach] Sent module-reattached to ${statsWcList.length} stats webContents`);
        } catch (e) {
          console.warn(`[moduleDetach] Failed to notify stats panel:`, e.message);
        }
        // Also notify main window (for potential future use)
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('module-reattached', { moduleId });
        }
      });
      
      detachedWindows.set(moduleId, win);
      
      console.log(`[moduleDetach] Detached module: ${moduleId}`);
      return { success: true };
      
    } catch (e) {
      console.error(`[moduleDetach] Failed to detach ${moduleId}:`, e);
      return { success: false, error: e.message };
    }
  });
  
  /**
   * Close detached window and reattach
   */
  ipcMain.handle('module-attach', async (event, { moduleId }) => {
    try {
      const win = detachedWindows.get(moduleId);
      if (win && !win.isDestroyed()) {
        win.close();
      }
      detachedWindows.delete(moduleId);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  
  /**
   * Check if module is detached
   */
  ipcMain.handle('module-is-detached', async (event, { moduleId }) => {
    const win = detachedWindows.get(moduleId);
    return win && !win.isDestroyed();
  });
  
  /**
   * Get all detached module ids
   */
  ipcMain.handle('module-get-detached', async () => {
    const ids = [];
    for (const [id, win] of detachedWindows) {
      if (win && !win.isDestroyed()) {
        ids.push(id);
      }
    }
    return ids;
  });
}

module.exports = { registerModuleDetachIpc, closeAllDetachedWindows };

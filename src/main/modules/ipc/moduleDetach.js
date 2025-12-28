/**
 * Module Detach IPC handlers
 * 
 * Universal mechanism to detach any sidebar module into separate window
 */

const { ipcMain, BrowserWindow } = require('electron');
const path = require('path');

// Track detached windows by module id
const detachedWindows = new Map();

function registerModuleDetachIpc({ mainWindow, store }) {
  
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
      await win.loadFile(detachHtmlPath, {
        query: {
          moduleId,
          modulePath: encodeURIComponent(modulePath),
          title
        }
      });
      
      win.once('ready-to-show', () => {
        win.show();
      });
      
      win.on('closed', () => {
        detachedWindows.delete(moduleId);
        // Notify main window that module was reattached
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

module.exports = { registerModuleDetachIpc };

/**
 * IPC handlers for Extension Bridge (upTime Edge extension)
 */

const { ipcMain } = require('electron');

function initExtensionBridgeIpc({ extensionBridge, extensionInstaller, mainWindow, store }) {
  if (!extensionBridge) {
    console.warn('[ipc/extensionBridge] extensionBridge not provided');
    return;
  }

  // Get extension connection status
  ipcMain.handle('extension-bridge-status', () => {
    return {
      connected: extensionBridge.isConnected(),
      version: extensionBridge.getExtensionVersion(),
      bundledVersion: extensionBridge.BUNDLED_EXTENSION_VERSION
    };
  });

  // Get extension path for manual install
  ipcMain.handle('extension-get-path', () => {
    if (extensionInstaller) {
      return extensionInstaller.getExtensionPath();
    }
    return null;
  });

  // Show install dialog
  ipcMain.handle('extension-show-install-dialog', async (event) => {
    if (extensionInstaller && mainWindow) {
      return await extensionInstaller.showInstallDialog(mainWindow);
    }
    return -1;
  });

  // Show update dialog
  ipcMain.handle('extension-show-update-dialog', async (event, currentVersion, latestVersion) => {
    if (extensionInstaller && mainWindow) {
      return await extensionInstaller.showUpdateDialog(mainWindow, currentVersion, latestVersion);
    }
    return -1;
  });

  // Dismiss install prompt (don't show again)
  ipcMain.on('extension-dismiss-install', () => {
    if (extensionInstaller) {
      extensionInstaller.dismissInstallPrompt();
    }
  });

  // Force send current map to extension
  ipcMain.on('extension-send-map', (event, map) => {
    extensionBridge.sendCurrentMap(map);
  });

  // Force send Excel odds to extension
  ipcMain.on('extension-send-excel-odds', (event, odds, map) => {
    extensionBridge.sendExcelOdds(odds, map);
  });

  // ========== DS Auto Mode IPC handlers ==========
  
  // Get DS Auto mode enabled state
  ipcMain.handle('ds-auto-mode-get', () => {
    return store?.get('dsAutoModeEnabled', false) || false;
  });

  // Set DS Auto mode enabled state
  ipcMain.handle('ds-auto-mode-set', (event, enabled) => {
    store?.set('dsAutoModeEnabled', !!enabled);
    // Broadcast to all views
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('ds-auto-mode-updated', !!enabled);
    }
    return !!enabled;
  });

  // Send auto command to DS extension
  ipcMain.handle('ds-auto-command', (event, command, opts = {}) => {
    if (!extensionBridge.isConnected()) {
      console.warn('[ipc/extensionBridge] DS auto command failed - not connected');
      return { success: false, error: 'extension-not-connected' };
    }
    const sent = extensionBridge.sendAutoCommand(command, opts);
    return { success: sent };
  });

  // Get DS connection status (for Auto mode availability check)
  ipcMain.handle('ds-connection-status', () => {
    return {
      connected: extensionBridge.isConnected(),
      lastOdds: extensionBridge.getLastDsOdds?.() || null
    };
  });

  // Get latest DS odds (for DS Auto mode - use as reference instead of Excel)
  ipcMain.handle('ds-get-last-odds', () => {
    return extensionBridge.getLastDsOdds?.() || null;
  });
}

module.exports = { initExtensionBridgeIpc };

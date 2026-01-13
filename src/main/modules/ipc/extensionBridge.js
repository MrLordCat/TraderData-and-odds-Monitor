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
}

module.exports = { initExtensionBridgeIpc };

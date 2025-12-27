/**
 * IPC handlers for Addon Manager
 */

const { ipcMain, shell } = require('electron');
const { clearCache } = require('../updater/githubApi');

function registerAddonIpc({ addonManager }) {
  // Get all addons info (installed + available)
  ipcMain.handle('addons-get-info', async () => {
    return addonManager.getAddonsInfo();
  });
  
  // Fetch available addons from registry (with optional force refresh)
  ipcMain.handle('addons-fetch-available', async (event, { forceRefresh } = {}) => {
    if (forceRefresh) {
      clearCache();
    }
    return addonManager.fetchAvailableAddons();
  });
  
  // Install addon
  ipcMain.handle('addons-install', async (event, { addonId, downloadUrl }) => {
    return addonManager.installAddon(addonId, downloadUrl);
  });
  
  // Uninstall addon
  ipcMain.handle('addons-uninstall', async (event, { addonId }) => {
    return addonManager.uninstallAddon(addonId);
  });
  
  // Enable/disable addon
  ipcMain.handle('addons-set-enabled', async (event, { addonId, enabled }) => {
    return addonManager.setAddonEnabled(addonId, enabled);
  });
  
  // Get enabled addon paths (for sidebar loading)
  ipcMain.handle('addons-get-enabled-paths', async () => {
    return addonManager.getEnabledAddonPaths();
  });
  
  // Get addons directory path
  ipcMain.handle('addons-get-dir', async () => {
    return addonManager.getAddonsDir();
  });
  
  // Check for addon updates (with optional force refresh)
  ipcMain.handle('addons-check-updates', async (event, { forceRefresh } = {}) => {
    if (forceRefresh) {
      clearCache();
    }
    return addonManager.checkForUpdates();
  });
  
  // Update addon to latest version
  ipcMain.handle('addons-update', async (event, { addonId }) => {
    return addonManager.updateAddon(addonId);
  });
  
  // Get addon update channel (dev/release)
  ipcMain.handle('addons-get-channel', async () => {
    return addonManager.getAddonChannel();
  });
  
  // Set addon update channel (dev/release)
  ipcMain.handle('addons-set-channel', async (event, { channel }) => {
    return addonManager.setAddonChannel(channel);
  });
  
  // Open path in file explorer
  ipcMain.on('shell-open-path', (event, dirPath) => {
    try {
      shell.openPath(dirPath);
    } catch (e) {
      console.error('[addons] shell.openPath failed:', e);
    }
  });
}

module.exports = { registerAddonIpc };

/**
 * IPC handlers for Addon Manager
 */

const { ipcMain, shell } = require('electron');
const { clearCache } = require('../updater/githubApi');

function registerAddonIpc({ addonManager }) {
  // Simple passthrough handlers
  const HANDLERS = {
    'addons-get-info':          () => addonManager.getAddonsInfo(),
    'addons-install':           p  => addonManager.installAddon(p.addonId, p.downloadUrl),
    'addons-uninstall':         p  => addonManager.uninstallAddon(p.addonId),
    'addons-set-enabled':       p  => addonManager.setAddonEnabled(p.addonId, p.enabled),
    'addons-get-enabled-paths': () => addonManager.getEnabledAddonPaths(),
    'addons-get-dir':           () => addonManager.getAddonsDir(),
    'addons-update':            p  => addonManager.updateAddon(p.addonId),
    'addons-get-channel':       () => addonManager.getAddonChannel(),
    'addons-set-channel':       p  => addonManager.setAddonChannel(p.channel),
  };
  Object.entries(HANDLERS).forEach(([ch, fn]) => {
    ipcMain.handle(ch, async (_e, p) => fn(p || {}));
  });

  // Handlers with extra logic
  ipcMain.handle('addons-fetch-available', async (_e, { forceRefresh } = {}) => {
    if (forceRefresh) clearCache();
    return addonManager.fetchAvailableAddons();
  });
  ipcMain.handle('addons-check-updates', async (_e, { forceRefresh } = {}) => {
    if (forceRefresh) clearCache();
    return addonManager.checkForUpdates();
  });
  
  // Open path in file explorer
  ipcMain.on('shell-open-path', (_e, dirPath) => {
    try { shell.openPath(dirPath); } catch (e) { console.error('[addons] shell.openPath failed:', e); }
  });
  ipcMain.handle('shell-open-path', async (_e, dirPath) => {
    try { await shell.openPath(dirPath); return { success: true }; }
    catch (e) { console.error('[addons] shell.openPath failed:', e); return { success: false, error: e.message }; }
  });
}

module.exports = { registerAddonIpc };

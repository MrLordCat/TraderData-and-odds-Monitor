// IPC handlers for auto-update system
// Exposes updater functions to renderer process

const { ipcMain } = require('electron');

function initUpdaterIpc({ updateManager }) {
  if (!updateManager) {
    console.warn('[ipc/updater] updateManager not provided');
    return;
  }

  // Get current status
  ipcMain.handle('updater-get-status', () => {
    try {
      return updateManager.getStatus();
    } catch (e) {
      return { error: e.message };
    }
  });

  // Check for updates
  ipcMain.handle('updater-check', async (_, { silent } = {}) => {
    try {
      const result = await updateManager.check(silent);
      return result;
    } catch (e) {
      return { error: e.message };
    }
  });

  // Set update channel (stable/dev)
  ipcMain.handle('updater-set-channel', async (_, channel) => {
    try {
      updateManager.setChannel(channel);
      return { success: true };
    } catch (e) {
      return { error: e.message };
    }
  });

  // Set auto-check enabled
  ipcMain.handle('updater-set-auto-check', async (_, enabled) => {
    try {
      updateManager.setAutoCheck(enabled);
      return { success: true };
    } catch (e) {
      return { error: e.message };
    }
  });

  // Download and install available update
  ipcMain.handle('updater-download', async () => {
    try {
      const status = updateManager.getStatus();
      if (status.availableUpdate) {
        await updateManager.downloadAndInstall(status.availableUpdate);
        return { success: true };
      }
      return { success: false, error: 'No update available' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // Get current version info
  ipcMain.handle('updater-get-version', () => {
    try {
      return {
        version: updateManager.getCurrentVersion(),
        commit: updateManager.getCurrentCommit(),
        buildInfo: updateManager.getBuildInfo()
      };
    } catch (e) {
      return { error: e.message };
    }
  });

  // Restart to apply update
  ipcMain.handle('updater-restart', () => {
    try {
      updateManager.restart();
      return { success: true };
    } catch (e) {
      return { error: e.message };
    }
  });

  console.log('[ipc/updater] Initialized');
}

module.exports = { initUpdaterIpc };

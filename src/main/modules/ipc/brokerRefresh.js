// Broker Refresh settings IPC
// Handles get/set of broker refresh settings (map reselect, stale reload)

function initBrokerRefreshIpc({ ipcMain, store }) {
  // Default settings
  const DEFAULTS = {
    mapReselectEnabled: true,
    mapReselectIntervalSec: 10,
    staleReloadEnabled: true,
    staleMissingTimeoutMin: 1,
    staleUnchangedTimeoutMin: 3
  };

  // Get settings with defaults
  ipcMain.handle('get-broker-refresh-settings', () => {
    try {
      const saved = store.get('brokerRefreshSettings');
      return { ...DEFAULTS, ...(saved || {}) };
    } catch (_) {
      return DEFAULTS;
    }
  });

  // Set settings
  ipcMain.on('set-broker-refresh-settings', (_e, settings) => {
    try {
      const current = store.get('brokerRefreshSettings') || {};
      const merged = { ...current, ...settings };
      store.set('brokerRefreshSettings', merged);
    } catch (_) { }
  });
}

module.exports = { initBrokerRefreshIpc };

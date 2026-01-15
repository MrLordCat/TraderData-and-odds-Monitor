// Auto-refresh toggle IPC extracted from main.js
// initAutoRefreshIpc({ ipcMain, store, mainWindow, autoRefreshEnabledRef })

function initAutoRefreshIpc(ctx){
  const { ipcMain, store, mainWindow, autoRefreshEnabledRef } = ctx;
  ipcMain.handle('get-auto-refresh-enabled', () => autoRefreshEnabledRef.value);
  ipcMain.on('set-auto-refresh-enabled', (_e, value) => {
    autoRefreshEnabledRef.value = !!value;
    try { store.set('autoRefreshEnabled', autoRefreshEnabledRef.value); } catch(_) {}
    if (mainWindow && !mainWindow.isDestroyed()) {
      try { mainWindow.webContents.send('auto-refresh-updated', { enabled: autoRefreshEnabledRef.value }); } catch(_) {}
    }
  });
}

module.exports = { initAutoRefreshIpc };
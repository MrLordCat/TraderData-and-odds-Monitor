// IPC handlers for Chrome/Edge extension management

function initExtensionIpc({ ipcMain, wsServer }) {
  // Get WebSocket server status
  ipcMain.handle('extension-get-status', () => {
    try {
      if (wsServer) {
        return wsServer.getStatus();
      }
      return { running: false, port: 9988, clients: 0 };
    } catch (err) {
      console.error('[extension-ipc] get-status error:', err);
      return { running: false, port: 9988, clients: 0, error: err.message };
    }
  });

  // Restart WebSocket server
  ipcMain.handle('extension-restart-server', () => {
    try {
      if (wsServer) {
        wsServer.stop();
        setTimeout(() => {
          wsServer.start();
        }, 500);
        return { success: true };
      }
      return { success: false, error: 'Server not initialized' };
    } catch (err) {
      console.error('[extension-ipc] restart-server error:', err);
      return { success: false, error: err.message };
    }
  });

  // Send command to extension
  ipcMain.handle('extension-send-command', (_event, command, data) => {
    try {
      if (wsServer) {
        const count = wsServer.sendCommand(command, data);
        return { success: true, clients: count };
      }
      return { success: false, error: 'Server not initialized' };
    } catch (err) {
      console.error('[extension-ipc] send-command error:', err);
      return { success: false, error: err.message };
    }
  });

  console.log('[extension-ipc] IPC handlers registered');
}

module.exports = { initExtensionIpc };

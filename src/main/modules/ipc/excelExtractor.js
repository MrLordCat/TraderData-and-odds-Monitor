function initExcelExtractorIpc({ ipcMain, controller }) {
  if (!ipcMain || !controller) return;

  ipcMain.on('excel-extractor-toggle', () => {
    try { controller.toggle(); } catch (_) { }
  });

  ipcMain.handle('excel-extractor-status-get', () => {
    try { return controller.getStatus(); } catch (_) { return { running: false, starting: false, error: 'status-get failed', installing: false, ahk: { running: false, starting: false, error: null, pid: null } }; }
  });

  ipcMain.on('excel-extractor-set-path', (_e, p) => {
    try { controller.setExcelScriptPath(p); } catch (_) { }
  });

  ipcMain.on('excel-extractor-install-deps', () => {
    try { controller.installDeps(); } catch (_) { }
  });
}

module.exports = { initExcelExtractorIpc };

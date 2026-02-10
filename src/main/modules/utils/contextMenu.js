// Shared context menu builder for BrowserViews (stats slots, broker views)
const { Menu, clipboard } = require('electron');

function attachContextMenu(view, mainWindow, label, extras) {
  if (!view || view.__ctxMenuAttached) return;
  view.__ctxMenuAttached = true;
  view.webContents.on('context-menu', (_e, params) => {
    try {
      const template = [];
      const nav = view.webContents.navigationHistory;
      const canBack = nav ? nav.canGoBack() : (typeof view.webContents.canGoBack === 'function' && view.webContents.canGoBack());
      const canFwd = nav ? nav.canGoForward() : (typeof view.webContents.canGoForward === 'function' && view.webContents.canGoForward());
      if (canBack) template.push({ label: 'Back', click: () => { try { nav ? nav.goBack() : view.webContents.goBack(); } catch (_) {} } });
      if (canFwd) template.push({ label: 'Forward', click: () => { try { nav ? nav.goForward() : view.webContents.goForward(); } catch (_) {} } });
      template.push({ label: 'Reload', click: () => { try { view.webContents.reload(); } catch (_) {} } });
      if (extras && extras.hardReload) template.push({ label: 'Hard Reload (ignore cache)', click: () => { try { view.webContents.reloadIgnoringCache(); } catch (_) {} } });
      try { const cur = view.webContents.getURL(); if (cur) template.push({ label: 'Copy Page URL', click: () => { try { clipboard.writeText(cur); } catch (_) {} } }); } catch (_) {}
      if (params.linkURL) template.push({ label: 'Copy Link URL', click: () => { try { clipboard.writeText(params.linkURL); } catch (_) {} } });
      template.push({ type: 'separator' });
      if (params.isEditable) template.push({ role: 'cut' });
      template.push({ role: 'copy' });
      if (params.isEditable) template.push({ role: 'paste' });
      template.push({ role: 'selectAll' });
      template.push({ type: 'separator' });
      template.push({ label: 'Open DevTools', click: () => { try { view.webContents.openDevTools({ mode: 'detach' }); } catch (_) {} } });
      if (typeof params.x === 'number' && typeof params.y === 'number') template.push({ label: 'Inspect Element', click: () => { try { view.webContents.inspectElement(params.x, params.y); } catch (_) {} } });
      template.push({ type: 'separator' });
      template.push({ label: (label || '?'), enabled: false });
      Menu.buildFromTemplate(template).popup({ window: mainWindow });
    } catch (err) { console.warn('[ctxmenu] build fail', err.message); }
  });
}

module.exports = { attachContextMenu };

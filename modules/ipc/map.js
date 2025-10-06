// Map selection IPC handlers extracted from main.js
// Exports initMapIpc({ ipcMain, store, views, mainWindow, boardWindowRef, boardManager, statsManager })

function initMapIpc({ ipcMain, store, views, mainWindow, boardManager, statsManager }){
  ipcMain.on('set-map', (e, { id, map }) => {
    try {
      const mapVal = parseInt(map,10) || 0;
      try { store.set('lastMap', mapVal); } catch(_){ }
      const sendTo = [];
      Object.values(views).forEach(v=>{ if(v && v.webContents && !v.webContents.isDestroyed()) sendTo.push(v.webContents); });
      if (mainWindow && !mainWindow.isDestroyed()) sendTo.push(mainWindow.webContents);
  // boardWindow removed
      try { if(boardManager && boardManager.getWebContents){ const bwc = boardManager.getWebContents(); if(bwc && !bwc.isDestroyed()) sendTo.push(bwc); } } catch(_){ }
      try {
        if(statsManager && statsManager.views){
          Object.values(statsManager.views).forEach(v=>{ try { if(v && v.webContents && !v.webContents.isDestroyed()) sendTo.push(v.webContents); } catch(_){ } });
        }
      } catch(_){ }
      const seen = new Set();
      sendTo.forEach(wc=>{ if(!wc || seen.has(wc)) return; seen.add(wc); try { wc.send('set-map', mapVal); } catch(_){ } });
    } catch(_err) { }
  });
  // isLast flag (only influences brokers with match-as-final semantics e.g. bet365)
  ipcMain.on('set-is-last', (e, val) => {
    try {
      const boolVal = !!val;
      try { store.set('isLast', boolVal); } catch(_){ }
      const sendTo = [];
      Object.values(views).forEach(v=>{ try { if(v && v.webContents && !v.webContents.isDestroyed()) sendTo.push(v.webContents); } catch(_){ } });
      if (mainWindow && !mainWindow.isDestroyed()) sendTo.push(mainWindow.webContents);
  // boardWindow removed
      try { if(statsManager && statsManager.views){ Object.values(statsManager.views).forEach(v=>{ if(v && v.webContents && !v.webContents.isDestroyed()) sendTo.push(v.webContents); }); } } catch(_){ }
      const seen=new Set();
      sendTo.forEach(wc=>{ if(!wc || seen.has(wc)) return; seen.add(wc); try { wc.send('set-is-last', boolVal); } catch(_){ } });
    } catch(_){ }
  });
  ipcMain.handle('get-is-last', ()=>{ try { return !!store.get('isLast'); } catch(_){ return false; } });
  ipcMain.handle('get-last-map', () => store.get('lastMap'));
}

module.exports = { initMapIpc };
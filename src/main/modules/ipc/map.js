// Map selection IPC handlers extracted from main.js
// Exports initMapIpc({ ipcMain, store, views, mainWindow, boardManager, statsManager, extensionBridgeRef })

function initMapIpc({ ipcMain, store, views, mainWindow, boardManager, statsManager, extensionBridgeRef }){
  
  // Helper: broadcast map config to all views atomically
  function broadcastMapConfig(mapVal, isLastVal){
    const config = { map: mapVal, isLast: isLastVal };
    const sendTo = [];
    Object.values(views).forEach(v=>{ if(v && v.webContents && !v.webContents.isDestroyed()) sendTo.push(v.webContents); });
    if (mainWindow && !mainWindow.isDestroyed()) sendTo.push(mainWindow.webContents);
    try { if(boardManager && boardManager.getWebContents){ const bwc = boardManager.getWebContents(); if(bwc && !bwc.isDestroyed()) sendTo.push(bwc); } } catch(_){ }
    try {
      if(statsManager && statsManager.views){
        Object.values(statsManager.views).forEach(v=>{ try { if(v && v.webContents && !v.webContents.isDestroyed()) sendTo.push(v.webContents); } catch(_){ } });
      }
    } catch(_){ }
    const seen = new Set();
    sendTo.forEach(wc=>{ if(!wc || seen.has(wc)) return; seen.add(wc); try { wc.send('set-map-config', config); } catch(_){ } });
    // Send to extension via WebSocket
    try {
      if(extensionBridgeRef && extensionBridgeRef.value && extensionBridgeRef.value.sendCurrentMap){
        extensionBridgeRef.value.sendCurrentMap(mapVal, isLastVal);
      }
    } catch(_){ }
  }
  
  // Atomic map config handler - preferred way
  ipcMain.on('set-map-config', (e, { map, isLast }) => {
    try {
      const mapVal = parseInt(map,10) || 1;
      const isLastVal = !!isLast;
      try { store.set('lastMap', mapVal); } catch(_){ }
      try { store.set('isLast', isLastVal); } catch(_){ }
      broadcastMapConfig(mapVal, isLastVal);
    } catch(_err) { }
  });
  
  // Legacy: set-map only (read current isLast from store)
  ipcMain.on('set-map', (e, payload) => {
    try {
      // Support both { id, map } object and direct number
      const mapVal = typeof payload === 'object' ? (parseInt(payload.map,10) || 1) : (parseInt(payload,10) || 1);
      const isLastVal = !!store.get('isLast');
      try { store.set('lastMap', mapVal); } catch(_){ }
      broadcastMapConfig(mapVal, isLastVal);
    } catch(_err) { }
  });
  
  // Legacy: set-is-last only (read current map from store)
  ipcMain.on('set-is-last', (e, val) => {
    try {
      const isLastVal = !!val;
      const mapVal = store.get('lastMap') || 1;
      try { store.set('isLast', isLastVal); } catch(_){ }
      broadcastMapConfig(mapVal, isLastVal);
    } catch(_){ }
  });
  
  ipcMain.handle('get-is-last', ()=>{ try { return !!store.get('isLast'); } catch(_){ return false; } });
  ipcMain.handle('get-last-map', () => store.get('lastMap'));
  // New: get both atomically
  ipcMain.handle('get-map-config', () => {
    try {
      return { map: store.get('lastMap') || 1, isLast: !!store.get('isLast') };
    } catch(_){ return { map: 1, isLast: false }; }
  });
}

module.exports = { initMapIpc };
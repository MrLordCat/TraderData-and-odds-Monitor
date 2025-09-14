// Early minimal IPC handlers to satisfy renderer requests before full bootstrap
// initEarlyIpc({ ipcMain, store, boardManagerRef })

function initEarlyIpc({ ipcMain, store, boardManagerRef }){
  try { ipcMain.handle('get-board-state', ()=>{ try { const bm = boardManagerRef.value; return bm && bm.getState? bm.getState(): { mode:'hidden' }; } catch(_) { return { mode:'hidden' }; } }); } catch(_){}
  try { ipcMain.handle('get-layout-preset', ()=>{ try { return store.get('layoutPreset'); } catch(_) { return null; } }); } catch(_){}
}

module.exports = { initEarlyIpc };
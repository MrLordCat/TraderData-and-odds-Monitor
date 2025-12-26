// Early minimal IPC handlers to satisfy renderer requests before full bootstrap
// initEarlyIpc({ ipcMain, store, boardManagerRef })

function initEarlyIpc({ ipcMain, store, boardManagerRef }){
  try {
    ipcMain.handle('get-board-state', ()=>{
      try {
        const bm = boardManagerRef.value;
        if(bm && bm.getState) return bm.getState();
      } catch(_){ }
      // Fallback while bootstrapping
      try {
        return {
          side: store.get('boardSide') || 'right',
          width: store.get('boardWidth') || 320
        };
      } catch(_){
        return { side: 'right', width: 320 };
      }
    });
  } catch(_){ }
  try { ipcMain.handle('get-layout-preset', ()=>{ try { return store.get('layoutPreset'); } catch(_) { return null; } }); } catch(_){}
}

module.exports = { initEarlyIpc };
// Early minimal IPC handlers to satisfy renderer requests before full bootstrap
// initEarlyIpc({ ipcMain, store, boardManagerRef })
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

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

  // Changelog: read CHANGELOG.md from app root
  try {
    ipcMain.handle('get-changelog', () => {
      try {
        const filePath = path.join(app.getAppPath(), 'CHANGELOG.md');
        if(fs.existsSync(filePath)){
          return fs.readFileSync(filePath, 'utf8');
        }
      } catch(_){}
      return null;
    });
  } catch(_){}
}

module.exports = { initEarlyIpc };
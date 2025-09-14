// Board docking / window IPC wiring extracted from main.js
// initBoardIpc({ ipcMain, boardManager })

function initBoardIpc(ctx){
  const { ipcMain, boardManager } = ctx;
  if(!ipcMain || !boardManager) return;
  // Register action channels (state handler may be registered early in main.js already)
  ['board-toggle','board-detach','board-attach','board-set-side','board-set-width','board-replay'].forEach(ch=>{
    try { ipcMain.on(ch, (_e,p)=> boardManager.handleIpc && boardManager.handleIpc(ch,p)); } catch(_){}
  });
}

module.exports = { initBoardIpc };
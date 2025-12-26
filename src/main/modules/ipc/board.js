// Board docking / unified panel IPC wiring extracted from main.js
// initBoardIpc({ ipcMain, boardManager, statsManager })

function initBoardIpc(ctx){
  const { ipcMain, boardManager, statsManager } = ctx;
  if(!ipcMain) return;
  
  // Register action channels - forward to both boardManager and statsManager
  ['board-set-side','board-set-width','board-replay'].forEach(ch=>{
    try { 
      ipcMain.on(ch, (_e,p)=> {
        // boardManager handles state persistence and layout offset
        if(boardManager && boardManager.handleIpc) boardManager.handleIpc(ch,p);
        // statsManager also handles these for unified panel positioning
        if(statsManager && statsManager.handleIpc) statsManager.handleIpc(ch,p);
      }); 
    } catch(_){}
  });
}

module.exports = { initBoardIpc };
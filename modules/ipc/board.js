// Board docking / window IPC wiring extracted from main.js
// initBoardIpc({ ipcMain, boardManager, statsManager })

function initBoardIpc(ctx){
  const { ipcMain, boardManager, statsManager } = ctx;
  if(!ipcMain || !boardManager) return;
  // Register action channels (state handler may be registered early in main.js already)
  ['board-set-side','board-set-width','board-replay'].forEach(ch=>{
    try { ipcMain.on(ch, (_e,p)=> boardManager.handleIpc && boardManager.handleIpc(ch,p)); } catch(_){}
  });

  // Keep stats side in sync with board side (single source of truth for left/right).
  try {
    ipcMain.on('board-set-side', (_e,p)=>{
      try {
        const side = p && p.side;
        if(statsManager && (typeof statsManager.setSide==='function' || typeof statsManager.handleIpc==='function')){
          if(typeof statsManager.setSide==='function') statsManager.setSide(side);
          else statsManager.handleIpc('stats-set-side', { side });
        }
      } catch(_){ }
    });
  } catch(_){ }
}

module.exports = { initBoardIpc };
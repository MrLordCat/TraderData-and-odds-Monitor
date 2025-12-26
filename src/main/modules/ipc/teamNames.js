// LoL team names sync IPC extracted from main.js
// initTeamNamesIpc({ ipcMain, store, boardManager, mainWindow, boardWindowRef, statsManager, lolTeamNamesRef })

function initTeamNamesIpc(ctx){
  const { ipcMain, store, boardManager, mainWindow, statsManager, lolTeamNamesRef } = ctx;
  ipcMain.on('lol-team-names-set', (_e, payload)=>{
    try {
      if(!payload || typeof payload!=='object') return;
      const { team1, team2 } = payload;
      if(team1) lolTeamNamesRef.value.team1 = String(team1).trim() || lolTeamNamesRef.value.team1;
      if(team2) lolTeamNamesRef.value.team2 = String(team2).trim() || lolTeamNamesRef.value.team2;
      try { store.set('lolTeamNames', lolTeamNamesRef.value); } catch(_){}
      // boardWindow removed
      if(mainWindow && !mainWindow.isDestroyed()){
        try { mainWindow.webContents.send('lol-team-names-update', lolTeamNamesRef.value); } catch(_){ }
      }
      try { if(statsManager && statsManager.views && statsManager.views.panel){ statsManager.views.panel.webContents.send('lol-team-names-update', lolTeamNamesRef.value); } } catch(_){ }
      try { if(boardManager && boardManager.getWebContents){ const bwc = boardManager.getWebContents(); if(bwc && !bwc.isDestroyed()) bwc.send('lol-team-names-update', lolTeamNamesRef.value); } } catch(_){ }
    } catch(err){ try { console.warn('lol-team-names-set failed', err); } catch(_){} }
  });
  ipcMain.handle('lol-team-names-get', ()=> ({ ...lolTeamNamesRef.value }));
}

module.exports = { initTeamNamesIpc };
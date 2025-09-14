// Stats (panel / embedded) IPC extracted from main.js
// initStatsIpc({ ipcMain, store, statsManager, views, stageBoundsRef, mainWindow, boardManager, toggleStatsEmbedded, refs })
// refs: { statsState, savedBoardMode, lastStatsToggleTs }

function initStatsIpc(ctx){
  const { ipcMain, statsManager, views, stageBoundsRef, mainWindow, boardManager, toggleStatsEmbedded, refs } = ctx;
  if(!ipcMain || !statsManager) return;
  const { statsState, savedBoardMode, lastStatsToggleTs } = refs;
  ipcMain.handle('get-stats-state', ()=> statsState);
  ipcMain.on('stats-toggle', ()=> toggleStatsEmbedded());
  ipcMain.on('stats-detach', ()=>{
    if(statsState.mode==='embedded'){
      statsManager.detachToWindow();
      statsState.mode='window';
      try { mainWindow.webContents.send('stats-state-updated', statsState); } catch(_){ }
    } else if(statsState.mode==='window'){
      statsManager.open();
    } else if(statsState.mode==='hidden'){
      statsManager.open();
      statsState.mode='window';
      try { mainWindow.webContents.send('stats-state-updated', statsState); } catch(_){ }
    }
  });
  ipcMain.on('stats-attach', ()=>{
    if(statsState.mode==='window'){
      const offsetY = stageBoundsRef && stageBoundsRef.value ? Number(stageBoundsRef.value.y) : 0;
      statsManager.createEmbedded(offsetY);
      statsState.mode='embedded';
      try { mainWindow.webContents.send('stats-state-updated', statsState); } catch(_){ }
    }
  });
  ['stats-set-url','stats-layout','stats-open-devtools','stats-toggle-side','stats-reload-slot','lol-stats-settings'].forEach(ch=>{
    ipcMain.on(ch, (e,p)=>{ try { statsManager.handleIpc(ch, p); } catch(_){ } });
  });
}

module.exports = { initStatsIpc };
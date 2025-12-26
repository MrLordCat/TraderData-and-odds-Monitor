// Periodic map re-broadcast (odds refresh) shared status
// initMapAutoRefreshIpc({ ipcMain, store, mainWindow, boardManager, statsManager })

const INTERVAL_MS = 10_000; // 10s auto reselect interval

function initMapAutoRefreshIpc({ ipcMain, store, mainWindow, boardManager, statsManager, views }) {
  const stateRef = { value: !!store.get('mapAutoRefreshEnabled') };
  let timer = null;

  function broadcastStatus(){
    const payload = { enabled: stateRef.value, intervalMs: INTERVAL_MS, nextAt: timer? (Date.now()+INTERVAL_MS) : 0 };
    try { if(mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('map-auto-refresh-status', payload); } catch(_){ }
    try {
      if(boardManager && boardManager.getWebContents){
        const wc = boardManager.getWebContents(); if(wc && !wc.isDestroyed()) wc.send('map-auto-refresh-status', payload);
      }
    } catch(_){ }
    try {
      if(statsManager && statsManager.views){
        Object.values(statsManager.views).forEach(v=>{ try { if(v && v.webContents && !v.webContents.isDestroyed()) v.webContents.send('map-auto-refresh-status', payload); } catch(_){ } });
      }
    } catch(_){ }
  }

  function rebroadcastMap(){
    try {
      const mapVal = parseInt(store.get('lastMap'),10) || 0;
      // Re-use existing map IPC full broadcast (includes broker views) via original handler
      ipcMain.emit('set-map', {}, { id:'*', map: mapVal });
    } catch(_){ }
  }

  function ensureTimer(){
    if(!stateRef.value){ if(timer){ clearInterval(timer); timer=null; } return; }
    if(timer) return;
    timer = setInterval(()=>{ rebroadcastMap(); broadcastStatus(); }, INTERVAL_MS);
  }
  ensureTimer();
  broadcastStatus();

  ipcMain.on('toggle-map-auto-refresh', ()=>{
    stateRef.value = !stateRef.value;
    try { store.set('mapAutoRefreshEnabled', stateRef.value); } catch(_){ }
    if(!stateRef.value && timer){ clearInterval(timer); timer=null; }
    ensureTimer();
    broadcastStatus();
  });
  ipcMain.handle('get-map-auto-refresh-status', ()=>({ enabled: stateRef.value, intervalMs: INTERVAL_MS, nextAt: timer? (Date.now()+INTERVAL_MS) : 0 }));
}

module.exports = { initMapAutoRefreshIpc };
// Periodic map re-broadcast (odds refresh) shared status
// initMapAutoRefreshIpc({ ipcMain, store, mainWindow, boardManager, statsManager })

const DEFAULT_INTERVAL_SEC = 10;

function initMapAutoRefreshIpc({ ipcMain, store, mainWindow, boardManager, statsManager, views }) {
  const stateRef = { value: !!store.get('mapAutoRefreshEnabled') };
  let timer = null;
  let currentIntervalMs = DEFAULT_INTERVAL_SEC * 1000;

  function getSettings() {
    try {
      const saved = store.get('brokerRefreshSettings');
      return {
        mapReselectEnabled: saved?.mapReselectEnabled !== false,
        mapReselectIntervalSec: saved?.mapReselectIntervalSec || DEFAULT_INTERVAL_SEC
      };
    } catch (_) {
      return { mapReselectEnabled: true, mapReselectIntervalSec: DEFAULT_INTERVAL_SEC };
    }
  }

  function broadcastStatus(){
    const settings = getSettings();
    const intervalMs = settings.mapReselectIntervalSec * 1000;
    const payload = { enabled: stateRef.value, intervalMs, nextAt: timer? (Date.now()+intervalMs) : 0 };
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
    const settings = getSettings();
    // Only rebroadcast if mapReselectEnabled is true
    if(!settings.mapReselectEnabled) return;
    
    try {
      const mapVal = parseInt(store.get('lastMap'),10) || 1;
      const isLastVal = !!store.get('isLast');
      // Re-use existing map IPC full broadcast (includes broker views) via atomic handler
      // force: true tells broker.js to always trigger navigation (for periodic reselect)
      ipcMain.emit('set-map-config', {}, { map: mapVal, isLast: isLastVal, force: true });
    } catch(_){ }
  }

  function ensureTimer(){
    const settings = getSettings();
    const newIntervalMs = settings.mapReselectIntervalSec * 1000;
    
    // If disabled, clear timer
    if(!stateRef.value){ 
      if(timer){ clearInterval(timer); timer=null; } 
      return; 
    }
    
    // If interval changed, restart timer
    if(timer && currentIntervalMs !== newIntervalMs){
      clearInterval(timer);
      timer = null;
    }
    
    if(timer) return;
    
    currentIntervalMs = newIntervalMs;
    timer = setInterval(()=>{ rebroadcastMap(); broadcastStatus(); }, currentIntervalMs);
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
  
  ipcMain.handle('get-map-auto-refresh-status', ()=>{
    const settings = getSettings();
    const intervalMs = settings.mapReselectIntervalSec * 1000;
    return { enabled: stateRef.value, intervalMs, nextAt: timer? (Date.now()+intervalMs) : 0 };
  });
  
  // Listen for settings changes to update timer
  ipcMain.on('set-broker-refresh-settings', ()=>{
    // Re-check timer interval on settings change
    ensureTimer();
    broadcastStatus();
  });
}

module.exports = { initMapAutoRefreshIpc };
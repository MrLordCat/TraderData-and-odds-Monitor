// Periodic map re-broadcast (odds refresh) shared status
// Reselect is ALWAYS active regardless of toggle button state.
// Smart mode: if any active broker has missing odds, reselect runs at FAST_INTERVAL_MS.
// The toggle button only controls the visual indicator.

const DEFAULT_INTERVAL_SEC = 10;
const FAST_INTERVAL_MS = 3000; // Fast reselect when odds are missing

function initMapAutoRefreshIpc({ ipcMain, store, mainWindow, boardManager, statsManager, views, latestOddsRef, activeBrokerIdsRef }) {
  const stateRef = { value: !!store.get('mapAutoRefreshEnabled') };
  let timer = null;
  let currentIntervalMs = DEFAULT_INTERVAL_SEC * 1000;
  let inFastMode = false;

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

  /** Check if any active broker has missing or empty odds */
  function hasMissingOdds() {
    try {
      const activeIds = activeBrokerIdsRef?.value;
      const odds = latestOddsRef?.value;
      if (!activeIds || !odds || !activeIds.length) return false;
      for (const id of activeIds) {
        const rec = odds[id];
        if (!rec || !Array.isArray(rec.odds)) return true;
        if (rec.odds[0] === '-' || rec.odds[1] === '-') return true;
      }
    } catch (_) { }
    return false;
  }

  function broadcastStatus(){
    const settings = getSettings();
    const effectiveMs = inFastMode ? FAST_INTERVAL_MS : (settings.mapReselectIntervalSec * 1000);
    const payload = { enabled: stateRef.value, intervalMs: effectiveMs, nextAt: timer ? (Date.now() + effectiveMs) : 0, fast: inFastMode };
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
    if(!settings.mapReselectEnabled) return;
    
    try {
      const mapVal = parseInt(store.get('lastMap'),10) || 1;
      const isLastVal = !!store.get('isLast');
      ipcMain.emit('set-map-config', {}, { map: mapVal, isLast: isLastVal, force: true });
    } catch(_){ }
  }

  function tick() {
    rebroadcastMap();
    // After rebroadcast, check if we need to switch between fast/normal mode
    const missing = hasMissingOdds();
    if (missing !== inFastMode) {
      inFastMode = missing;
      restartTimer();
    }
    broadcastStatus();
  }

  function restartTimer() {
    if (timer) { clearInterval(timer); timer = null; }
    const settings = getSettings();
    currentIntervalMs = inFastMode ? FAST_INTERVAL_MS : (settings.mapReselectIntervalSec * 1000);
    timer = setInterval(tick, currentIntervalMs);
  }

  function ensureTimer(){
    const settings = getSettings();
    const normalMs = settings.mapReselectIntervalSec * 1000;
    const targetMs = inFastMode ? FAST_INTERVAL_MS : normalMs;
    
    if(timer && currentIntervalMs !== targetMs){
      clearInterval(timer);
      timer = null;
    }
    
    if(timer) return;
    
    currentIntervalMs = targetMs;
    timer = setInterval(tick, currentIntervalMs);
  }
  ensureTimer();
  broadcastStatus();

  ipcMain.on('toggle-map-auto-refresh', ()=>{
    stateRef.value = !stateRef.value;
    try { store.set('mapAutoRefreshEnabled', stateRef.value); } catch(_){ }
    if(stateRef.value) rebroadcastMap();
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
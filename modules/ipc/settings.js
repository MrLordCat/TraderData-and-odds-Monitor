// Settings & theme IPC extracted from main.js
// initSettingsIpc({ ipcMain, store, settingsOverlay, statsManager })

function initSettingsIpc(ctx){
  const { ipcMain, store, settingsOverlay, statsManager } = ctx;
  ipcMain.on('open-settings', ()=> settingsOverlay.open());
  ipcMain.on('close-settings', ()=> settingsOverlay.close());
  function forwardHeatBar(cfg){
    try { if(statsManager && statsManager.views && statsManager.views.panel){ statsManager.views.panel.webContents.send('gs-heatbar-apply', cfg); } } catch(_){ }
  }
  ipcMain.on('gs-heatbar-preview', (_e, cfg)=>{ forwardHeatBar(cfg); });
  ipcMain.on('gs-heatbar-save', (_e, cfg)=>{ try { store.set('gsHeatBar', cfg); } catch(_){} forwardHeatBar(cfg); });
  ipcMain.handle('get-setting', (e,key)=> store.get(key));
  ipcMain.on('set-setting', (e,{key,value})=>{ store.set(key,value); });
  ipcMain.on('settings-contrast-preview', ()=>{});
  ipcMain.on('settings-contrast-save', ()=>{});

  // Auto odds tolerance (percent). Persist under key 'autoTolerancePct'.
  function clampTol(v){ return Math.max(0.01, Math.min(5, v)); }
  ipcMain.handle('auto-tolerance-get', ()=>{
    try {
      const v = store.get('autoTolerancePct');
      if(typeof v === 'number' && !isNaN(v)) return clampTol(v);
    } catch(_){ }
    return 0.15; // default
  });
  ipcMain.on('auto-tolerance-set', (_e, payload)=>{
    try {
      const v = payload && typeof payload.tolerancePct==='number'? clampTol(payload.tolerancePct): null;
      if(v){
        store.set('autoTolerancePct', v);
        // Broadcast to all renderers (board + embedded stats). We reuse generic channel.
        try { const bw = require('electron').BrowserWindow.getAllWindows(); bw.forEach(w=>{ try { w.webContents.send('auto-tolerance-updated', v); } catch(_){} }); } catch(_){ }
      }
    } catch(_){ }
  });
}

module.exports = { initSettingsIpc };
// Stats (panel / embedded) IPC extracted from main.js
// initStatsIpc({ ipcMain, store, statsManager, views, stageBoundsRef, mainWindow, boardManager, toggleStatsEmbedded, refs })
// refs: { statsState, lastStatsToggleTs }

function initStatsIpc(ctx){
  const { ipcMain, statsManager, views, stageBoundsRef, mainWindow, boardManager, toggleStatsEmbedded, refs, store } = ctx;
  if(!ipcMain || !statsManager) return;
  const { statsState, lastStatsToggleTs } = refs;
  ipcMain.handle('get-stats-state', ()=> statsState);
  ipcMain.on('stats-toggle', ()=> toggleStatsEmbedded());
  // stats-detach / stats-attach removed (window mode deleted)
  // Forward common stats panel control channels + config/persistence updates to statsManager
  ['stats-set-url','stats-layout','stats-open-devtools','stats-toggle-side','stats-reload-slot','lol-stats-settings','stats-config-set','stats-single-window'].forEach(ch=>{
    ipcMain.on(ch, (e,p)=>{ try { statsManager.handleIpc(ch, p); } catch(_){ } });
  });

  // ===== Persistent section order (stats panel) =====
  // Renderer (stats_embedded.js) previously used localStorage. We centralize in main store for portability.
  ipcMain.handle('stats-section-order-get', ()=>{
    try { return store && store.get ? (store.get('statsSectionOrder')||[]) : []; } catch(_){ return []; }
  });
  ipcMain.on('stats-section-order-set', (_e, order)=>{
    try {
      if(!Array.isArray(order)) return;
      if(store && store.set) store.set('statsSectionOrder', order);
    } catch(_){ }
  });
}

module.exports = { initStatsIpc };
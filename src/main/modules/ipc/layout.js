// Layout-related IPC extracted from main.js
// initLayoutIpc({ ipcMain, store, layoutManager, views, stageBoundsRef, boardManager, statsManager })

function initLayoutIpc(ctx){
  const { ipcMain, store, layoutManager, views, stageBoundsRef, boardManager, statsManager } = ctx;
  ipcMain.handle('get-layout', () => {
    const layout = {};
    for (const [id, v] of Object.entries(views)) {
      try { layout[id] = v.getBounds(); } catch(_){ }
    }
    return layout;
  });
  ipcMain.on('apply-layout-preset', (e, presetId)=>{ 
    layoutManager.applyLayoutPreset(presetId);
    // Reassert stats panel topmost order (prevent brokers covering panel after preset change)
    try { statsManager?.deferEnsureTopmost?.(); } catch(_){ }
  });
  // Handle may already be registered early in main (early safe handler) -> swallow duplicate attempts
  try {
    ipcMain.handle('get-layout-preset', () => { try { return store.get('layoutPreset'); } catch(e){ return null; } });
  } catch(err){ /* duplicate registration ignored */ }
  ipcMain.on('set-view-bounds', (e, { id, bounds }) => {
    const v = views[id]; if (!v) return; v.setBounds(bounds);
    const layout = store.get('layout', {}); layout[id] = bounds; store.set('layout', layout);
  });
  ipcMain.on('set-stage-bounds', (e, bounds) => {
    stageBoundsRef.value = bounds;
    try { boardManager && boardManager.handleStageResized && boardManager.handleStageResized(); } catch(_){ }
    try { statsManager && statsManager.handleStageResized && statsManager.handleStageResized(); } catch(_){ }
    if (layoutManager.getCurrentPresetId()) {
      layoutManager.applyLayoutPreset(layoutManager.getCurrentPresetId());
    } else {
      Object.keys(views).forEach(id => layoutManager.clampViewToStage(id));
    }
    // After stage resize the broker views might overlap; raise stats again if active
    try { statsManager?.deferEnsureTopmost?.(); } catch(_){ }
  });
}

module.exports = { initLayoutIpc };
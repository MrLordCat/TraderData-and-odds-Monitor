// Broker-related IPC extracted from main.js
// initBrokerIpc({ ipcMain, store, views, brokerManager, statsManager, mainWindow, boardManagerRef, brokerHealth,
//                 latestOddsRef, zoom, SNAP, stageBoundsRef })

function initBrokerIpc(ctx){
  const { ipcMain, store, views, brokerManager, statsManager, mainWindow, boardManagerRef, brokerHealth, latestOddsRef, zoom, SNAP, stageBoundsRef } = ctx;
  const latestOdds = latestOddsRef.value;
  // (Drag state removed – broker window dragging disabled)

  ipcMain.on('bv-odds-update', (e, data) => {
    try {
      const wc = e.sender;
      const partition = wc.session?.getPartition?.();
      let brokerId = Object.keys(views).find(id => wc === views[id].webContents) || partition?.replace('persist:','');
      if (!brokerId) brokerId = 'unknown';
      if (!views[brokerId]) return;
      const payload = { ...data, broker: brokerId };
      if (brokerId && brokerHealth[brokerId]) {
        let signature;
        try { signature = payload && payload.odds ? JSON.stringify(payload.odds) : JSON.stringify(payload); } catch(e2){ signature = String(Date.now()); }
        if (brokerHealth[brokerId].lastOdds !== signature) {
          brokerHealth[brokerId].lastOdds = signature;
          brokerHealth[brokerId].lastChange = Date.now();
        }
      }
      latestOdds[brokerId] = payload;
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('odds-update', payload);
      try { if (statsManager && statsManager.views && statsManager.views.panel) { statsManager.views.panel.webContents.send('odds-update', payload); } } catch(_){ }
  try { const bm = boardManagerRef && boardManagerRef.value; bm && bm.sendOdds && bm.sendOdds(payload); } catch(_){ }
    } catch(err) { console.error('bv-odds-update error', err); }
  });

  ipcMain.on('capture-credentials', (e, { broker, hostname, username, password }) => {
    try {
      if(!hostname || !username || !password) return;
      const credsAll = store.get('siteCredentials') || {};
      credsAll[hostname] = { username, password, broker: broker || null, ts: Date.now() };
      store.set('siteCredentials', credsAll);
      Object.entries(views).forEach(([id,v])=>{
        try {
          const url = v.webContents.getURL();
          if(url && url.includes(hostname)){
            v.webContents.send('apply-credentials', { hostname, username, password });
          }
        } catch(_){ }
      });
    } catch(err){ console.error('capture-credentials failed', err); }
  });

  ipcMain.on('bv-zoom-wheel', (e, { deltaY }) => {
    try {
      const wc = e.sender;
      const brokerId = Object.keys(views).find(id => views[id].webContents === wc);
      if (!brokerId) return;
      zoom.adjust(brokerId, deltaY);
    } catch(_){ }
  });

  ipcMain.on('refresh-broker', (e, id) => { views[id]?.webContents.reloadIgnoringCache(); });
  ipcMain.on('refresh-all', () => { Object.values(views).forEach(v => { try { v.webContents.reloadIgnoringCache(); } catch(_){ } }); });
  ipcMain.on('close-broker', (e,id)=> {
    try {
      let brokerId = id;
      try {
        if(!brokerId || !views[brokerId]){
          const wc = e && e.sender;
          if(wc){
            brokerId = Object.keys(views).find(k => views[k] && views[k].webContents === wc);
            if(!brokerId){
              const part = wc.session?.getPartition?.();
              if(part && part.startsWith('persist:')) brokerId = part.slice('persist:'.length);
            }
          }
        }
      } catch(_){ }
      if(!brokerId || !views[brokerId]) return;
      brokerManager.closeBroker(brokerId);
      // Purge cached latest odds so replay won't resurrect removed broker
      try { if(latestOddsRef && latestOddsRef.value) delete latestOddsRef.value[id]; } catch(_){}
      // Build fresh active list (exclude slot-* views)
      const ids = Object.keys(views).filter(k=> !k.startsWith('slot-'));
      // Notify main window (some renderers may listen for brokers-sync to rebuild rows)
  try { if(mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('brokers-sync', { ids }); } catch(_){ }
      // Explicit broker-closed event (some listeners rely on it for immediate row removal)
      try { if(mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('broker-closed', { id }); } catch(_){ }
      // Also proactively notify every slot-* view so its inline picker (if open) can refresh availability
      try {
        Object.entries(views).forEach(([vid,v])=>{
          if(vid.startsWith('slot-') && v && v.webContents && !v.webContents.isDestroyed()){
            v.webContents.send('brokers-sync', { ids });
            try { v.webContents.send('broker-closed', { id }); } catch(_){ }
          }
        });
      } catch(_){ }
      // Notify board window / docked view via boardManager replay (will emit brokers-sync + remaining odds)
      try { const bm = boardManagerRef && boardManagerRef.value; if(bm && bm.replayOdds) bm.replayOdds(); } catch(_){ }
      // Emit placeholder removal marker so any listeners (board aggregation, stats panel) can drop it immediately
  const removalPayload = { broker: brokerId, odds:['-','-'], removed:true };
      try { if(mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('odds-update', removalPayload); } catch(_){ }
      try { if(statsManager && statsManager.views && statsManager.views.panel) statsManager.views.panel.webContents.send('odds-update', removalPayload); } catch(_){ }
      // Direct broker-closed for stats panel (in case odds removal races with initial render)
      try { if(statsManager && statsManager.views && statsManager.views.panel) statsManager.views.panel.webContents.send('broker-closed', { id: brokerId }); } catch(_){ }
      try { console.log('[broker][close] cleaned', brokerId); } catch(_){ }
    } catch(err){ try { console.warn('close-broker handling failed', err.message); } catch(_){ } }
  });
  ipcMain.on('request-add-broker-data', (e, { slotIndex, includeActive }) => {
    try {
      const activeBrokerIds = Object.keys(views).filter(i=>!i.startsWith('slot-'));
      let list = [];
      if(brokerManager.getAllBrokers){
        const all = brokerManager.getAllBrokers();
        list = includeActive ? all : all.filter(b=>!activeBrokerIds.includes(b.id));
      }
      e.sender.send('add-broker-data', { brokers: list, slotIndex, activeIds: includeActive? activeBrokerIds: [] });
    } catch(err){ console.error('request-add-broker-data failed', err); }
  });
  ipcMain.on('add-broker-selected', (e,{ id })=> brokerManager.addBroker(id));

  // Global toolbar trigger: open first empty slot picker (or force layout to create one if none)
  ipcMain.on('global-open-broker-picker', ()=>{
    try {
      const activeIds = Object.keys(views).filter(v=>!v.startsWith('slot-'));
      // Find a slot view
      let slotEntry = Object.entries(views).find(([id])=> id.startsWith('slot-'));
      if(!slotEntry){
        // Force reapply layout preset to ensure at least one slot
        const lm = ctx.layoutManager;
        if(lm && lm.getCurrentPresetId()) lm.applyLayoutPreset(lm.getCurrentPresetId());
        slotEntry = Object.entries(views).find(([id])=> id.startsWith('slot-'));
      }
      if(slotEntry){
        const [sid, slotView] = slotEntry;
        const idx = parseInt(sid.split('-')[1],10);
        // Raise slot view to top (last added order) by re-adding
        try { ctx.mainWindow.addBrowserView(slotView); } catch(_){ }
        slotView.webContents.send('open-slot-picker', { slotIndex: idx });
      }
    } catch(err){ console.error('global-open-broker-picker failed', err); }
  });
  ipcMain.handle('picker-list-brokers', ()=>{
    try {
      const activeBrokerIds = Object.keys(views).filter(i=>!i.startsWith('slot-'));
      const all = brokerManager.getAllBrokers ? brokerManager.getAllBrokers(): [];
      return { brokers: all, active: activeBrokerIds };
    } catch(err){ console.error('picker-list-brokers failed', err); return { brokers:[], active:[] }; }
  });
}

module.exports = { initBrokerIpc };
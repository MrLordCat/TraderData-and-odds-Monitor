// Broker-related IPC extracted from main.js
// initBrokerIpc({ ipcMain, store, views, brokerManager, statsManager, boardWindowRef, mainWindow, boardManager, brokerHealth,
//                 latestOddsRef, zoom, SNAP, stageBoundsRef })

function initBrokerIpc(ctx){
  const { ipcMain, store, views, brokerManager, statsManager, boardWindowRef, mainWindow, boardManagerRef, brokerHealth, latestOddsRef, zoom, SNAP, stageBoundsRef } = ctx;
  const latestOdds = latestOddsRef.value;
  const dragState = { current: null };

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
      const boardWindow = boardWindowRef && boardWindowRef.value;
      if (boardWindow && !boardWindow.isDestroyed()) boardWindow.webContents.send('odds-update', payload);
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

  function handleDragDelta(id, dx, dy){
    const mv = views[id]; if (!mv) return;
    const stageBounds = stageBoundsRef.value;
    const b0 = mv.getBounds();
    const nb = { x: b0.x + dx, y: b0.y + dy, width: b0.width, height: b0.height };
    nb.x = Math.max(stageBounds.x, Math.min(stageBounds.x + stageBounds.width - nb.width, nb.x));
    nb.y = Math.max(stageBounds.y, Math.min(stageBounds.y + stageBounds.height - nb.height, nb.y));
    for (const [oid, ov] of Object.entries(views)) {
      if (oid === id) continue;
      try {
        const ob = ov.getBounds();
        if (Math.abs((nb.x + nb.width) - ob.x) < SNAP) nb.x = ob.x - nb.width;
        if (Math.abs(nb.x - (ob.x + ob.width)) < SNAP) nb.x = ob.x + ob.width;
        if (Math.abs((nb.y + nb.height) - ob.y) < SNAP) nb.y = ob.y - nb.height;
        if (Math.abs(nb.y - (ob.y + ob.height)) < SNAP) nb.y = ob.y + ob.height;
        if (Math.abs(nb.y - ob.y) < SNAP) nb.y = ob.y;
        if (Math.abs(nb.x - ob.x) < SNAP) nb.x = ob.x;
      } catch(_){ }
    }
    if (Math.abs(nb.x - stageBounds.x) < SNAP) nb.x = stageBounds.x;
    if (Math.abs(nb.y - stageBounds.y) < SNAP) nb.y = stageBounds.y;
    if (Math.abs((nb.x + nb.width) - (stageBounds.x + stageBounds.width)) < SNAP) nb.x = stageBounds.x + stageBounds.width - nb.width;
    if (Math.abs((nb.y + nb.height) - (stageBounds.y + stageBounds.height)) < SNAP) nb.y = stageBounds.y + stageBounds.height - nb.height;
    mv.setBounds(nb);
  }
  ipcMain.on('bv-drag-start', (e, { id }) => { dragState.current = { id }; });
  ipcMain.on('bv-drag-delta', (e, { id, dx, dy }) => { if (!dragState.current || dragState.current.id !== id) return; handleDragDelta(id, dx, dy); });
  ipcMain.on('bv-drag-end', (e, { id }) => {
    if (dragState.current && dragState.current.id === id) {
      const mv = views[id]; if (mv) {
        const layout = store.get('layout', {});
        layout[id] = mv.getBounds();
        store.set('layout', layout);
      }
    }
    dragState.current = null;
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
  ipcMain.on('close-broker', (e,id)=> brokerManager.closeBroker(id));
  // Deprecated popup path: ignore slot-request-add (inline picker handles UI)
  ipcMain.on('slot-request-add', ()=> { /* intentionally no-op */ });
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
  // DataServices dynamic pseudo-broker
  ipcMain.on('add-broker-dataservices', (e,{ url })=>{
    try {
      if(!url || !/^https?:\/\//i.test(url)) return;
      brokerManager.addBroker('dataservices', url);
    } catch(err){ console.warn('add-broker-dataservices failed', err); }
  });

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
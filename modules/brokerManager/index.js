const { BrowserView } = require('electron');
const path = require('path');

// Broker manager: creates/tears down bookmaker BrowserViews and exposes add/close dialog handling
function createBrokerManager(ctx){
  const {
    BROKERS, store, views, zoom, layoutManager, scheduleMapReapply,
  broadcastPlaceholderOdds, SNAP, GAP, stageBoundsRef, activeBrokerIdsRef,
  mainWindow, onActiveListChanged
  } = ctx;
  const brokerHealth = ctx.brokerHealth;
  const loadFailures = ctx.loadFailures;

  function syncBoard(){ /* legacy board window removed; docking manager handles sync separately */ }

  function createAll(){
    const disabled = store.get('disabledBrokers', []);
    const layout = store.get('layout', {});
    const lastUrls = store.get('lastUrls', {});
    let cursorX = stageBoundsRef.value.x;
    activeBrokerIdsRef.value = BROKERS.filter(b=>!disabled.includes(b.id) && !b.inactive).map(b=>b.id);
    if(onActiveListChanged) onActiveListChanged(activeBrokerIdsRef.value.slice());
    for(const b of BROKERS.filter(b=> activeBrokerIdsRef.value.includes(b.id))){
      createSingleInternal(b, layout[b.id], lastUrls[b.id] || b.url, cursorX);
      const vb = views[b.id].getBounds();
      cursorX += vb.width + GAP;
    }
    syncBoard();
  }

  function createSingleInternal(brokerDef, existingBounds, startUrl, cursorX){
    const view = new BrowserView({ webPreferences:{ preload: path.join(__dirname,'..','..','brokerPreload.js'), partition:'persist:'+brokerDef.id, nodeIntegration:false, contextIsolation:true, sandbox:false, javascript:true, backgroundThrottling:false } });
    views[brokerDef.id] = view;
    mainWindow.addBrowserView(view);
    // Capture keyboard shortcuts inside broker views
    try {
      view.webContents.on('before-input-event', (event, input) => {
        if (input.type==='keyDown' && !input.isAutoRepeat) {
          // Ctrl+R / F5: reload broker view. Ctrl+Shift+R: hard reload (ignore cache)
          if ((input.key === 'r' || input.key === 'R') && input.control) {
            try {
              if (input.shift) { view.webContents.reloadIgnoringCache(); } else { view.webContents.reload(); }
            } catch(_) {}
            event.preventDefault();
            return;
          }
          if (input.key === 'F5') {
            try { view.webContents.reload(); } catch(_) {}
            event.preventDefault();
            return;
          }
          // Space toggles stats unless focus is editable
          if (input.key === ' ') {
          // Defer to page context to decide if focus is in an editable control
          try {
            view.webContents.executeJavaScript(`(function(){
              const ae=document.activeElement; if(!ae) return false;
              const tag=ae.tagName; const editable=ae.isContentEditable;
              if(editable) return true;
              if(tag==='INPUT'){ const tp=(ae.getAttribute('type')||'text').toLowerCase(); if(['text','search','number','email','password','url','tel'].includes(tp)) return true; }
              if(tag==='TEXTAREA') return true;
              return false; })();`, true).then(isEditable => {
                if(isEditable){ return; }
                mainWindow.webContents.send('stats-toggle');
                event.preventDefault();
              }).catch(()=>{});
          } catch(_) {}
          }
        }
      });
    } catch(_) {}
    zoom.attachToView(view, brokerDef.id);
    brokerHealth[brokerDef.id] = { lastChange:Date.now(), lastOdds:null, lastRefresh:0 };
    broadcastPlaceholderOdds(brokerDef.id);
    try { view.webContents.setBackgroundThrottling(false); } catch(_){}
  // Apply a consistent modern Chrome UA (without Electron) for all brokers to minimize detection differences
  try { view.webContents.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'); } catch(_){ }
    const vb = layoutManager.sanitizeInitialBounds(existingBounds, cursorX);
    view.setBounds(vb);
    view.setAutoResize({ width:false, height:false });
    layoutManager.clampViewToStage(brokerDef.id);
    view.webContents.loadURL(startUrl);
    view.webContents.on('did-finish-load', ()=>{ try { view.webContents.insertCSS(ctx.BROKER_FRAME_CSS); } catch(_){} scheduleMapReapply(view); });
    view.webContents.on('did-fail-load', (e, errorCode, errorDesc, validatedURL, isMainFrame)=>{
      if(errorCode === -3) return;
      if(!isMainFrame) return;
      loadFailures[brokerDef.id] = (loadFailures[brokerDef.id]||0)+1;
      if(loadFailures[brokerDef.id] <= 3){
        const delay = 1200 * loadFailures[brokerDef.id];
        setTimeout(()=>{ try { view.webContents.reloadIgnoringCache(); } catch(_){}; }, delay);
        return;
      }
      const safeMsg = `${errorDesc}`.replace(/</g,'_').slice(0,180);
      try { view.webContents.loadFile(path.join(__dirname,'..','..','renderer','error.html'), { query:{ bid:brokerDef.id, code:String(errorCode), msg:safeMsg, target: validatedURL||'' } }); } catch(err){ }
    });
    view.webContents.on('did-navigate', (e,url)=>{ try { const lu=store.get('lastUrls',{}); lu[brokerDef.id]=url; store.set('lastUrls', lu); } catch(_){} scheduleMapReapply(view); });
    view.webContents.on('did-navigate-in-page', (e,url,isMainFrame)=>{ if(!isMainFrame) return; try { const lu=store.get('lastUrls',{}); lu[brokerDef.id]=url; store.set('lastUrls', lu); } catch(_){} scheduleMapReapply(view); });
  }

  function addBroker(id){
    if(views[id]) return;
    const def = BROKERS.find(b=>b.id===id); if(!def) return;
    const dis = store.get('disabledBrokers', []);
    if(dis.includes(id)) store.set('disabledBrokers', dis.filter(d=>d!==id));
    activeBrokerIdsRef.value = activeBrokerIdsRef.value.concat(id);
    if(onActiveListChanged) onActiveListChanged(activeBrokerIdsRef.value.slice());
    createSingleInternal(def, null, def.url, stageBoundsRef.value.x);
    if(layoutManager.getCurrentPresetId()) layoutManager.applyLayoutPreset(layoutManager.getCurrentPresetId()); else layoutManager.relayoutAll();
    syncBoard();
  }

  function closeBroker(id){
    const v = views[id]; if(!v) return;
    try { mainWindow.removeBrowserView(v); } catch(_){ }
    try { v.webContents.removeAllListeners(); } catch(_){}
    try { v.webContents.destroy(); } catch(_){}
    delete views[id]; delete brokerHealth[id];
    activeBrokerIdsRef.value = activeBrokerIdsRef.value.filter(b=>b!==id);
    if(onActiveListChanged) onActiveListChanged(activeBrokerIdsRef.value.slice());
    const dis = store.get('disabledBrokers', []);
    if(!dis.includes(id)){ dis.push(id); store.set('disabledBrokers', dis); }
    if(layoutManager.getCurrentPresetId()) layoutManager.applyLayoutPreset(layoutManager.getCurrentPresetId()); else layoutManager.relayoutAll();
    syncBoard();
  }

  // Deprecated: inline picker now used instead of popup dialog.
  function openAddBrokerDialog(){ /* no-op retained for backward IPC compatibility */ }

  function getAllBrokers(){ return BROKERS.slice(); }

  return { createAll, addBroker, closeBroker, openAddBrokerDialog, getAllBrokers };
}

module.exports = { createBrokerManager };

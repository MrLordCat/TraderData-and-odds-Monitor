const { BrowserView } = require('electron');
const path = require('path');
const { Menu, clipboard } = require('electron');

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
  const extraArgs = [];
  if(brokerDef.id === 'dataservices') extraArgs.push('--forced-broker-id=dataservices');
  const view = new BrowserView({ webPreferences:{ preload: path.join(__dirname,'..','..','brokerPreload.js'), partition:'persist:'+brokerDef.id, nodeIntegration:false, contextIsolation:true, sandbox:false, javascript:true, backgroundThrottling:false, additionalArguments: extraArgs } });
    views[brokerDef.id] = view;
  mainWindow.addBrowserView(view);
  try { if(ctx.statsManager && ctx.statsManager.ensureTopmost) ctx.statsManager.ensureTopmost(); } catch(_){ }
    // DevTools Network Conditions: принудительно имитируем снятую галочку "Use browser default" через CDP override.
    try {
      let chromeVer = (process.versions && process.versions.chrome) ? process.versions.chrome : '140.0.0.0';
      const major = chromeVer.split('.')[0]||'140';
      const ua = `Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVer} Safari/537.36`;
      view.webContents.setUserAgent(ua);
      view.webContents.debugger.attach('1.3');
      view.webContents.debugger.sendCommand('Emulation.setUserAgentOverride', {
        userAgent: ua,
        userAgentMetadata: {
          brands:[
            { brand:'Not A;Brand', version:'99' },
            { brand:'Chromium', version:major },
            { brand:'Google Chrome', version:major }
          ],
          fullVersion: chromeVer,
          fullVersionList:[
            { brand:'Not A;Brand', version:'99.0.0.0' },
            { brand:'Chromium', version:chromeVer },
            { brand:'Google Chrome', version:chromeVer }
          ],
          platform:'Windows', platformVersion:'10.0', architecture:'x86', bitness:'64', model:'', mobile:false
        }
      });
    } catch(_){ }
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
          // F12 opens DevTools for THIS broker view explicitly
          if (input.key === 'F12') {
            try { view.webContents.openDevTools({ mode:'detach' }); } catch(_) {}
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
    // (UA уже задан выше через setUserAgent + CDP override)
    const vb = layoutManager.sanitizeInitialBounds(existingBounds, cursorX);
    view.setBounds(vb);
    view.setAutoResize({ width:false, height:false });
    layoutManager.clampViewToStage(brokerDef.id);
    view.webContents.loadURL(startUrl);
    if(brokerDef.id==='dataservices'){
      try { view.webContents.executeJavaScript(`window.__FORCED_BROKER_ID='dataservices';`, true).catch(()=>{}); } catch(_){ }
    }
    view.webContents.on('did-finish-load', ()=>{
      try { view.webContents.insertCSS(ctx.BROKER_FRAME_CSS); } catch(_){}
      scheduleMapReapply(view);
      // Apply stored credentials (auto-fill) if available
      try {
        const credsAll = store.get('siteCredentials') || {};
        const curUrl = view.webContents.getURL();
        const host = new URL(curUrl).hostname;
        const creds = credsAll[host];
        if(creds){
          try { console.log('[cred][brokerManager] apply creds host', host, 'user='+creds.username); } catch(_){ }
          view.webContents.send('apply-credentials', { hostname: host, username: creds.username, password: creds.password });
        }
      } catch(_){ }
    });
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
    view.webContents.on('did-navigate', (e,url)=>{
      try { const lu=store.get('lastUrls',{}); lu[brokerDef.id]=url; store.set('lastUrls', lu); } catch(_){}
      scheduleMapReapply(view);
      // Try to auto-fill credentials on login/redirect pages (e.g., dataservices auth flow)
      try {
        const credsAll = store.get('siteCredentials') || {};
        const host = new URL(url).hostname;
        const creds = credsAll[host];
        if(creds){ view.webContents.send('apply-credentials', { hostname: host, username: creds.username, password: creds.password }); }
      } catch(_){ }
    });
    view.webContents.on('did-navigate-in-page', (e,url,isMainFrame)=>{
      if(!isMainFrame) return;
      try { const lu=store.get('lastUrls',{}); lu[brokerDef.id]=url; store.set('lastUrls', lu); } catch(_){}
      scheduleMapReapply(view);
      // Re-apply credentials for SPA route changes where login form mounts late
      try {
        const credsAll = store.get('siteCredentials') || {};
        const host = new URL(url).hostname;
        const creds = credsAll[host];
        if(creds){ view.webContents.send('apply-credentials', { hostname: host, username: creds.username, password: creds.password }); }
      } catch(_){ }
    });

    // Attach context menu (right-click) once
    try {
      if(!view.__ctxMenuAttached){
        view.__ctxMenuAttached = true;
        view.webContents.on('context-menu', (e, params)=>{
          try {
            const template = [];
            // Navigation / reload
            const nav = view.webContents.navigationHistory;
            const canBack = nav ? nav.canGoBack() : (typeof view.webContents.canGoBack==='function' && view.webContents.canGoBack());
            const canFwd  = nav ? nav.canGoForward() : (typeof view.webContents.canGoForward==='function' && view.webContents.canGoForward());
            if(canBack) template.push({ label:'Back', click:()=>{ try { nav? nav.goBack(): view.webContents.goBack(); } catch(_){ } } });
            if(canFwd) template.push({ label:'Forward', click:()=>{ try { nav? nav.goForward(): view.webContents.goForward(); } catch(_){ } } });
            template.push({ label:'Reload', click:()=>{ try { view.webContents.reload(); } catch(_){ } } });
            template.push({ label:'Hard Reload (ignore cache)', click:()=>{ try { view.webContents.reloadIgnoringCache(); } catch(_){ } } });
            // URL helpers
            try { const cur=view.webContents.getURL(); if(cur) template.push({ label:'Copy Page URL', click:()=>{ try { clipboard.writeText(cur); } catch(_){ } } }); } catch(_){ }
            if(params.linkURL) template.push({ label:'Copy Link URL', click:()=>{ try { clipboard.writeText(params.linkURL); } catch(_){ } } });
            template.push({ type:'separator' });
            // Edit actions
            if(params.isEditable) template.push({ role:'cut' });
            template.push({ role:'copy' });
            if(params.isEditable) template.push({ role:'paste' });
            template.push({ role:'selectAll' });
            template.push({ type:'separator' });
            // DevTools / Inspect
            template.push({ label:'Open DevTools', click:()=>{ try { view.webContents.openDevTools({ mode:'detach' }); } catch(_){ } } });
            if(typeof params.x==='number' && typeof params.y==='number') template.push({ label:'Inspect Element', click:()=>{ try { view.webContents.inspectElement(params.x, params.y); } catch(_){ } } });
            template.push({ type:'separator' });
            template.push({ label:'Broker: '+brokerDef.id, enabled:false });
            const menu = Menu.buildFromTemplate(template);
            menu.popup({ window: mainWindow });
          } catch(err){ try { console.warn('[brokerCtxMenu] build fail', err.message); } catch(_){ } }
        });
      }
    } catch(_){ }

    // If stats embedded panel is active, newly added broker might overlap z-order; re-assert panel topmost.
    try {
      if(ctx.statsManager && typeof ctx.statsManager.ensureTopmost === 'function'){
        [0,60,180,360].forEach(delay=> setTimeout(()=>{ try { ctx.statsManager.ensureTopmost(); } catch(_){ } }, delay));
      }
    } catch(_){ }
  }

  function addBroker(id, startUrlOverride){
    if(views[id]){ // If dataservices exists and new URL override provided -> navigate
      if(id==='dataservices' && startUrlOverride){
        try { const cur=views[id].webContents.getURL(); if(cur!==startUrlOverride) views[id].webContents.loadURL(startUrlOverride); } catch(_){ }
      }
      return;
    }
    let def = BROKERS.find(b=>b.id===id);
    if(!def){
      if(id==='dataservices'){
        def = { id:'dataservices', url: startUrlOverride || 'about:blank' };
      } else return; // unknown broker
    }
    const dis = store.get('disabledBrokers', []);
    if(dis.includes(id)) store.set('disabledBrokers', dis.filter(d=>d!==id));
    activeBrokerIdsRef.value = activeBrokerIdsRef.value.concat(id);
    if(onActiveListChanged) onActiveListChanged(activeBrokerIdsRef.value.slice());
    // If there is at least one slot-* placeholder view, reuse its bounds for consistent layout placement
    let slotBounds = null;
    let claimedSlotId = null;
    for(const [vid,v] of Object.entries(views)){
      if(vid.startsWith('slot-')){ try { slotBounds = v.getBounds(); } catch(_){} claimedSlotId = vid; break; }
    }
    createSingleInternal(def, slotBounds, startUrlOverride || def.url, stageBoundsRef.value.x);
    // Proactive immediate map/team replay for newly added dataservices broker (avoids waiting solely on did-finish-load scheduleMapReapply)
    if(id==='dataservices'){
      try {
        const lastMap = store.get('lastMap');
        const teamNames = store.get('lolTeamNames');
        const wc = views[id] && views[id].webContents;
        if(wc && !wc.isDestroyed()){
          [250, 900, 1800].forEach(d=> setTimeout(()=>{
            try {
              if(wc.isDestroyed()) return;
              if(typeof lastMap !== 'undefined') wc.send('set-map', lastMap);
              if(teamNames) wc.send('set-team-names', teamNames);
              // Light diagnostic
              console.log('[map][ds][injectAddBrokerReplay]', d,'ms lastMap=', lastMap);
            } catch(_){ }
          }, d));
        }
      } catch(_){ }
    }
    // Remove the claimed slot after adding broker (so layout manager won't think it's still available)
    if(claimedSlotId){
      const sv = views[claimedSlotId];
      if(sv){
        try { mainWindow.removeBrowserView(sv); } catch(_){ }
        try { sv.webContents.destroy(); } catch(_){ }
        delete views[claimedSlotId];
      }
    }
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

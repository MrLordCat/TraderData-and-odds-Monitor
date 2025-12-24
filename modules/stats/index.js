// Unified side panel Stats Manager (panel always docked, A/B slots optional for stats mode)
// Panel is now the primary side panel containing odds board + stats sections.
// Stats mode (A/B views) toggled separately. Panel docked by default.

const { BrowserView, Menu, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');

function createStatsManager({ store, mainWindow, stageBoundsRef, hotkeys, boardManagerRef: initialBoardRef }) {
  // --- Persistent + session state ---------------------------------------------------------
  const { STATS_PANEL_WIDTH: DEFAULT_PANEL_WIDTH } = require('../utils/constants');
  let boardManagerRef = initialBoardRef; // Mutable ref for late binding
  const GAP = 4;
  const DEFAULT_URLS = { A: 'https://portal.grid.gg', B: 'https://www.twitch.tv' };
  const urls = Object.assign({}, DEFAULT_URLS, store.get('statsUrls', {}));
  let mode = store.get('statsLayoutMode', 'split');               // split|focusA|focusB|vertical
  // Side is unified with docked board side to avoid mismatches between modes.
  let side = store.get('boardSide') || store.get('statsPanelSide', 'right'); // left|right
  let panelWidth = store.get('boardWidth') || DEFAULT_PANEL_WIDTH; // unified panel width
  let panelHidden = false; // Panel is always visible (no longer hideable)
  let embedOffsetY = 0;                                           // toolbar offset
  let singleWindow = !!store.get('statsSingleWindow', false);     // when true, only one slot is active

  // LoL stats related
  let lolManualMode = store.get('lolManualMode', false);
  let lolManualData = store.get('lolManualData', null);
  let lolMetricMarks = store.get('lolMetricMarks', {});
  let lolMetricVisibility = store.get('lolMetricVisibility', {});
  let lolMetricOrder = store.get('lolMetricOrder', null);
  const DEFAULT_STATS_CONFIG = { animationsEnabled:true, animationDurationMs:450, animationScale:1, animationPrimaryColor:'#3b82f6', animationSecondaryColor:'#f59e0b', heatBarOpacity:0.55, winLoseEnabled:true };
  let statsConfig = Object.assign({}, DEFAULT_STATS_CONFIG, store.get('statsConfig', {}));

  // Views container: panel is always created, A/B only when stats mode is active
  const views = { A:null, B:null, panel:null };
  let panelActive = false;    // Panel view created and docked
  let statsActive = false;    // Stats mode (A/B views visible)

  let hotkeysRef = hotkeys || null;

  // Temporary cover for stats mode
  const COVER_BG = '#0d0f17';
  let coverView = null;
  let coverShown = false;

  function getCoverBounds(){
    try {
      if(!mainWindow || mainWindow.isDestroyed()) return null;
      const full = mainWindow.getContentBounds();
      const stage = stageBoundsRef && stageBoundsRef.value ? stageBoundsRef.value : full;
      const baseY = (typeof embedOffsetY === 'number' && embedOffsetY) ? embedOffsetY : (stage.y || 0);
      const h = full.height - baseY;
      return { x:0, y:baseY, width: full.width, height: Math.max(0, h) };
    } catch(_){ return null; }
  }
  // Persistent background layer while Stats is active.
  function showCover(){
    try {
      if(!mainWindow || mainWindow.isDestroyed()) return;
      const b = getCoverBounds();
      if(!b) return;
      if(!coverView){
        coverView = new BrowserView({ webPreferences:{ contextIsolation:true, sandbox:true } });
        try { coverView.webContents.setBackgroundColor(COVER_BG); } catch(_){ }
        try {
          const html = `<!doctype html><html><head><meta charset="utf-8"/></head><body style="margin:0;background:${COVER_BG};"></body></html>`;
          coverView.webContents.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
        } catch(_){ }
      }
      // Attach only once; re-attaching every toggle can make Electron accumulate internal listeners.
      try {
        const attached = typeof mainWindow.getBrowserViews==='function' && mainWindow.getBrowserViews().includes(coverView);
        if(!attached) mainWindow.addBrowserView(coverView);
      } catch(_){ }
      try { coverView.setBounds(b); } catch(_){ }
      coverShown = true;
    } catch(_){ }
  }
  function hideCover(){
    try {
      if(!coverView) return;
      // Keep attached; just hide.
      try { coverView.setBounds({ x:0, y:0, width:0, height:0 }); } catch(_){ }
      coverShown = false;
    } catch(_){ }
  }

  // --- Persistence ------------------------------------------------------------------------
  function persist(){
    store.set('statsUrls', urls);
    store.set('statsLayoutMode', mode);
    store.set('statsPanelSide', side);
    // Keep canonical side in sync (used by board manager).
    try { store.set('boardSide', side); } catch(_){ }
    store.set('boardWidth', panelWidth);
    store.set('statsSingleWindow', singleWindow);
    store.set('lolMetricVisibility', lolMetricVisibility);
    if(lolMetricOrder) store.set('lolMetricOrder', lolMetricOrder);
    store.set('statsConfig', statsConfig);
    store.set('lolManualMode', lolManualMode);
    if(lolManualData) store.set('lolManualData', lolManualData);
    store.set('lolMetricMarks', lolMetricMarks);
  }

  // --- Helpers ---------------------------------------------------------------------------
  function canonicalHost(h){
    try {
      if(!h) return h;
      if(/(^|\.)grid\.gg$/i.test(h)) return 'grid.gg';
      const p = h.split('.');
      if(p.length>2) return p.slice(-2).join('.');
      return h;
    } catch(_) { return h; }
  }

  // Layout panel (always docked) + optional A/B stats views
  function layout(){
    if(!mainWindow || mainWindow.isDestroyed()) return;
    const full = mainWindow.getContentBounds();
    const stage = stageBoundsRef && stageBoundsRef.value ? stageBoundsRef.value : full;
    if(!embedOffsetY) embedOffsetY = stage.y || 0;
    const baseY = embedOffsetY;
    const h = full.height - baseY;
    const curPanelWidth = panelWidth;
    const panelX = side==='left'?0:(full.width - curPanelWidth);
    
    // Position panel (always visible when panelActive)
    if(panelActive && views.panel){
      try { views.panel.setBounds({ x:panelX, y:baseY, width:curPanelWidth, height:h }); } catch(_){}
    }

    // Stats views only when statsActive
    if(!statsActive) return;
    if(!views.A && !views.B) return;
    
    const contentX = side==='left'? curPanelWidth:0;
    const contentW = full.width - curPanelWidth;
    const setSafe=(v,r)=>{ if(v) try { v.setBounds(r); } catch(_){ } };
    const effectiveMode = singleWindow && (mode==='split' || mode==='vertical') ? (mode='focusA', persist(), 'focusA') : mode;
    if(effectiveMode==='split'){
      const hHalf = Math.floor((h-GAP)/2);
      setSafe(views.A,{ x:contentX,y:baseY,width:contentW,height:hHalf });
      setSafe(views.B,{ x:contentX,y:baseY+hHalf+GAP,width:contentW,height:h-hHalf-GAP });
    } else if(effectiveMode==='focusA'){
      setSafe(views.A,{ x:contentX,y:baseY,width:contentW,height:h });
      setSafe(views.B,{ x:contentX,y:baseY,width:0,height:0 });
    } else if(effectiveMode==='focusB'){
      setSafe(views.A,{ x:contentX,y:baseY,width:0,height:0 });
      setSafe(views.B,{ x:contentX,y:baseY,width:contentW,height:h });
    } else if(effectiveMode==='vertical'){
      const wHalf = Math.floor((contentW-GAP)/2);
      setSafe(views.A,{ x:contentX,y:baseY,width:wHalf,height:h });
      setSafe(views.B,{ x:contentX+wHalf+GAP,y:baseY,width:contentW-wHalf-GAP,height:h });
    }

    // Keep background aligned while Stats is active.
    if(coverShown && coverView){
      try { coverView.setBounds({ x:0, y:baseY, width: full.width, height: Math.max(0, h) }); } catch(_){ }
    }
  }
  function setMode(m){
    if(!['split','focusA','focusB','vertical'].includes(m)) return;
    // Block modes that imply two active windows when singleWindow is on
    if(singleWindow){
      if(m==='split' || m==='vertical'){ mode='focusA'; persist(); layout(); return; }
      // Also block switching focus from current slot when singleWindow is enabled
      if((mode==='focusA' && m==='focusB') || (mode==='focusB' && m==='focusA')){ layout(); return; }
    }
    mode=m; persist(); layout();
  }
  function broadcastSide(){
    try { if(views.panel) views.panel.webContents.send('stats-side-updated', { side }); } catch(_){ }
    try { if(mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('board-updated', { side, width: panelWidth }); } catch(_){ }
  }

  function setSide(next){
    if(next!=='left' && next!=='right') return;
    if(next===side) return;
    side = next;
    persist();
    layout();
    broadcastSide();
  }
  
  function setWidth(w){
    const MIN_W = 280, MAX_W = 600;
    const nw = Math.max(MIN_W, Math.min(MAX_W, Math.round(w)));
    if(nw === panelWidth) return;
    panelWidth = nw;
    persist();
    layout();
    broadcastSide();
  }

  function toggleSide(){ setSide(side==='left'?'right':'left'); }
  // Panel hidden is deprecated - panel is always visible
  function setPanelHidden(hidden){ /* noop - panel always visible */ }
  function togglePanelHidden(){ /* noop */ }

  function applySingleWindow(enabled){
    singleWindow = !!enabled; persist();
    try {
      if(singleWindow){
        // Suspend background slot by loading about:blank
        const bg = (mode==='focusA') ? 'B' : (mode==='focusB' ? 'A' : 'B');
        const v = views[bg]; if(v){ try { v.webContents.loadURL('about:blank'); } catch(_){ } }
        if(mode==='split' || mode==='vertical'){ mode='focusA'; }
      } else {
        // Resume only the background slot to its URL; do NOT reload the currently active slot
        // Determine active slot based on current mode (fallback to 'A')
        const active = (mode==='focusA') ? 'A' : (mode==='focusB' ? 'B' : 'A');
        const bg = active==='A' ? 'B' : 'A';
        const bgView = views[bg];
        const desiredUrl = urls[bg];
        if(bgView && desiredUrl){
          try {
            const cur = bgView.webContents.getURL();
            // If desired is embed:lolstats, current will be a file:// URL to renderer/lolstats/index.html
            const isDesiredEmbed = typeof desiredUrl==='string' && desiredUrl.startsWith('embed:lolstats');
            const curIsEmbedLol = typeof cur==='string' && /renderer[\\\/]lolstats[\\\/]index\.html/i.test(cur);
            const shouldLoad = !cur || cur==='about:blank' || (isDesiredEmbed ? !curIsEmbedLol : cur !== desiredUrl);
            if(shouldLoad){ resolveAndLoad(bgView, desiredUrl); }
          } catch(_){ resolveAndLoad(bgView, desiredUrl); }
        }
      }
    } catch(_){ }
    layout();
  }

  function resolveAndLoad(view, raw){
    if(!view) return;
    if(raw==='embed:lolstats'){
      try { view.webContents.loadFile(path.join(__dirname,'..','..','renderer','lolstats','index.html')); } catch(_){ }
      return;
    }
    try {
      const u = new URL(raw); const host=u.hostname; const canon=canonicalHost(host); const sess=view.webContents.session;
      const all = store.get('siteCookies')||{}; const saved = all[host]||all[canon];
      if(Array.isArray(saved)) saved.forEach(c=>{ try { sess.cookies.set({ url:`${u.protocol}//${host}${c.path||'/'}`, name:c.name, value:c.value, domain:c.domain, path:c.path, secure:c.secure, httpOnly:c.httpOnly, expirationDate:c.expirationDate, sameSite:c.sameSite }).catch(()=>{}); } catch(_){ } });
      view.webContents.loadURL(raw);
    } catch(e){ try { console.warn('[stats] load fail', raw, e.message); } catch(_){ } }
  }
  function setUrl(slot,u){ if(['A','B'].includes(slot) && u){ urls[slot]=u; persist(); resolveAndLoad(views[slot],u); } }

  // --- LoL stats integration --------------------------------------------------------------
  let lolStats = null; const lastPortal = { A:null,B:null }; const portalInjectedOnce=new WeakSet(); const slotInit={ A:false,B:false }; let ipcLolRegistered=false;
  function ensureLolStats(){
    if(lolStats) return;
    const { createLolStatsModule } = require('../../lolstats');
    lolStats = createLolStatsModule({
      loadHistory: () => {
        try { return store.get('lolStatsHistory') || []; } catch(_) { return []; }
      },
      saveHistory: (h) => {
        try { store.set('lolStatsHistory', h); } catch(_) { }
      }
    });
    registerLolIpc();
  }
  function broadcast(snapshot){ if(views.panel) try { views.panel.webContents.send('lol-stats-update', snapshot); } catch(_){ } ['A','B'].forEach(s=>{ if(urls[s]==='embed:lolstats'){ const v=views[s]; if(v){ try { v.webContents.executeJavaScript(`window.postMessage({ __lolStatsPayload: ${JSON.stringify(snapshot)} }, '*');`).catch(()=>{}); } catch(_){ } } } }); }
  function registerLolIpc(){ if(ipcLolRegistered) return; ipcLolRegistered=true; const { ipcMain } = require('electron'); ipcMain.on('lol-stats-raw',(_e,{ slot,data })=>{ if(!lolStats) return; if(data && data.source==='lol-reset-trigger'){ lolStats.reset(); broadcast(lolStats.snapshot()); return; } lolStats.handleRaw(data); broadcast(lolStats.snapshot()); }); ipcMain.on('lol-stats-reset',()=>{ if(lolStats){ lolStats.reset(); broadcast(lolStats.snapshot()); } }); }
  function maybeAutoReset(slot,url){ if(!lolStats) return; if(!/portal\.grid\.gg/i.test(url)) return; if(lastPortal[slot] && lastPortal[slot]!==url){ try { lolStats.reset(); lolStats.reinject && lolStats.reinject(views[slot]); views[slot].webContents.executeJavaScript(`window.postMessage({ type:'restart_data_collection', reason:'url-change' }, '*');`).catch(()=>{}); broadcast(lolStats.snapshot()); } catch(_){ } } lastPortal[slot]=url; }
  function attachNavTracking(slot, view){
    if(!view || slotInit[slot]) return;
    slotInit[slot] = true;
    const update = (u) => {
      try {
        // When single-window mode is enabled, ignore about:blank navigations for the background slot
        // to avoid clobbering the persisted URL with a placeholder.
        if(singleWindow && u === 'about:blank') return;
        urls[slot] = u; persist();
        if(views.panel) views.panel.webContents.send('stats-url-update',{ slot, url:u });
      } catch(_){}
    };
    view.webContents.on('did-navigate', (_e,u)=> update(u));
    view.webContents.on('did-navigate-in-page', (_e,u)=> update(u));
    view.webContents.on('did-finish-load', ()=>{
      try {
        const cur = view.webContents.getURL();
        update(cur);
        const credsAll = store.get('siteCredentials')||{};
        const host = new URL(cur).hostname;
        const canon = canonicalHost(host);
        const creds = credsAll[host] || credsAll[canon];
        try { maybeInstallUblock(view, canon); } catch(_){ }
        if(creds){
          view.webContents.send('apply-credentials',{ hostname:host, username:creds.username, password:creds.password });
          if(views.panel) views.panel.webContents.send('stats-credentials-status',{ slot, hostname:host, has:true, username:creds.username });
        }
        const sess = view.webContents.session;
        sess.cookies.get({ url: cur.startsWith('http')? cur: undefined }).then(cookies=>{
          const filtered=cookies.filter(c=>c.domain && !c.domain.endsWith('localhost'));
            const bag=store.get('siteCookies')||{};
            bag[host]=filtered.map(c=>({ name:c.name,value:c.value,domain:c.domain,path:c.path,secure:c.secure,httpOnly:c.httpOnly,expirationDate:c.expirationDate,sameSite:c.sameSite }));
            if(canon!==host) bag[canon]=bag[host];
            store.set('siteCookies', bag);
        }).catch(()=>{});
        if(/portal\.grid\.gg/.test(cur)){
          ensureLolStats();
          try { view.webContents.send('identify-slot', slot); } catch(_){ }
          try {
            if(!portalInjectedOnce.has(view)){
              lolStats.init(view, slot,(snap)=> broadcast(snap));
              portalInjectedOnce.add(view);
            } else {
              lolStats.reinject && lolStats.reinject(view);
            }
          } catch(_){ }
          maybeAutoReset(slot, cur);
          broadcast(lolStats.snapshot());
        }
      } catch(_){ }
    });
    view.webContents.on('did-navigate', (_e,u)=> maybeAutoReset(slot,u));
    view.webContents.on('did-navigate-in-page', (_e,u)=> maybeAutoReset(slot,u));
  }

  // --- Context menu ----------------------------------------------------------------------
  function attachContextMenu(view,label){ if(!view || view.__statsCtxMenuAttached) return; view.__statsCtxMenuAttached=true; view.webContents.on('context-menu',(e,params)=>{ try { const template=[]; const nav=view.webContents.navigationHistory; const canBack= nav? nav.canGoBack(): (view.webContents.canGoBack && view.webContents.canGoBack()); const canFwd= nav? nav.canGoForward(): (view.webContents.canGoForward && view.webContents.canGoForward()); if(canBack) template.push({ label:'Back', click:()=>{ try { nav? nav.goBack(): view.webContents.goBack(); } catch(_){ } } }); if(canFwd) template.push({ label:'Forward', click:()=>{ try { nav? nav.goForward(): view.webContents.goForward(); } catch(_){ } } }); template.push({ label:'Reload', click:()=>{ try { view.webContents.reload(); } catch(_){ } } }); try { const curUrl=view.webContents.getURL(); if(curUrl) template.push({ label:'Copy Page URL', click:()=>{ try { clipboard.writeText(curUrl); } catch(_){ } } }); } catch(_){ } if(params.linkURL) template.push({ label:'Copy Link URL', click:()=>{ try { clipboard.writeText(params.linkURL); } catch(_){ } } }); template.push({ type:'separator' }); if(params.isEditable) template.push({ role:'cut' }); template.push({ role:'copy' }); if(params.isEditable) template.push({ role:'paste' }); template.push({ role:'selectAll' }); template.push({ type:'separator' }); template.push({ label:'Open DevTools', click:()=>{ try { view.webContents.openDevTools({ mode:'detach' }); } catch(_){ } } }); if(typeof params.x==='number' && typeof params.y==='number') template.push({ label:'Inspect Element', click:()=>{ try { view.webContents.inspectElement(params.x, params.y); } catch(_){ } } }); template.push({ type:'separator' }); template.push({ label:'Stats Slot: '+(label||'?'), enabled:false }); const menu=Menu.buildFromTemplate(template); menu.popup({ window: mainWindow }); } catch(err){ try { console.warn('[stats][ctxmenu] build fail', err.message); } catch(_){ } } }); }


  // --- Panel lifecycle (always docked) ---------------------------------------------------
  function createPanel(offsetY){
    if(panelActive) return;
    if(!mainWindow || mainWindow.isDestroyed()) return;
    
    if(!views.panel){
      views.panel = new BrowserView({ 
        webPreferences:{ 
          partition:'persist:statsPanel', 
          contextIsolation:false, 
          nodeIntegration:true, 
          backgroundThrottling:false 
        } 
      });
      try { views.panel.webContents.setBackgroundThrottling(false); } catch(_){ }
      try { views.panel.webContents.setBackgroundColor(COVER_BG); } catch(_){ }
      try { mainWindow.addBrowserView(views.panel); } catch(_){ }
      attachContextMenu(views.panel,'Panel');
      
      // Unified window-active hotkeys (TAB/F1/F2/F3)
      try { if(hotkeysRef && hotkeysRef.attachToWebContents) hotkeysRef.attachToWebContents(views.panel.webContents); } catch(_){ }
      
      try { views.panel.webContents.loadFile(path.join(__dirname,'..','..','renderer','stats_panel.html')); } catch(_){ }
      views.panel.webContents.on('did-finish-load', ()=>{ 
        try { 
          const hb = store.get('gsHeatBar'); 
          views.panel.webContents.send('stats-init', { 
            urls, mode, side, panelWidth, 
            lolManualMode, lolMetricVisibility, lolMetricOrder, 
            gsHeatBar: hb, statsConfig, lolManualData, lolMetricMarks, singleWindow,
            panelOnly: !statsActive  // Indicate if only panel is active (no A/B views)
          }); 
          if(hb) views.panel.webContents.send('gs-heatbar-apply', hb); 
          // Replay odds to panel after load
          try { 
            if(boardManagerRef && boardManagerRef.value && boardManagerRef.value.replayOdds){
              boardManagerRef.value.replayOdds();
            }
          } catch(_){ }
          // Replay Excel team names to panel after load
          try {
            if(global.__excelWatcher && global.__excelWatcher.rebroadcastTeamNames){
              global.__excelWatcher.rebroadcastTeamNames();
            }
          } catch(_){ }
        } catch(_){ } 
      });
    }
    
    panelActive = true;
    embedOffsetY = typeof offsetY === 'number' ? offsetY : embedOffsetY;
    layout();
    setTimeout(layout, 60);
    
    // Assert panel topmost
    try { if(views.panel) mainWindow.setTopBrowserView(views.panel); } catch(_){ }
    [0,80,200].forEach(d=> setTimeout(()=>{ try { ensureTopmost(); } catch(_){ } }, d));
  }
  
  // --- Stats views (A/B) lifecycle -------------------------------------------------------
  function createStatsViews(offsetY){
    if(statsActive) return;
    if(!mainWindow || mainWindow.isDestroyed()) return;
    
    // Ensure panel exists first
    if(!panelActive) createPanel(offsetY);
    
    // Show cover while loading stats views
    showCover();
    
    const freshViews = !(views.A && views.B);
    
    if(freshViews){
      views.A = new BrowserView({ 
        webPreferences:{ 
          partition:'persist:statsA', 
          contextIsolation:true, 
          sandbox:false, 
          preload:path.join(__dirname,'..','..','statsContentPreload.js'), 
          backgroundThrottling:false 
        } 
      });
      views.B = new BrowserView({ 
        webPreferences:{ 
          partition:'persist:statsB', 
          contextIsolation:true, 
          sandbox:false, 
          preload:path.join(__dirname,'..','..','statsContentPreload.js'), 
          backgroundThrottling:false 
        } 
      });
      
      try { mainWindow.addBrowserView(views.A); mainWindow.addBrowserView(views.B); } catch(_){ }
      attachContextMenu(views.A,'A');
      attachContextMenu(views.B,'B');
      
      // Disable background throttling
      try { views.A.webContents.setBackgroundThrottling(false); } catch(_){ }
      try { views.B.webContents.setBackgroundThrottling(false); } catch(_){ }
      try { views.A.webContents.setBackgroundColor(COVER_BG); } catch(_){ }
      try { views.B.webContents.setBackgroundColor(COVER_BG); } catch(_){ }
      
      // Unified window-active hotkeys
      try { 
        if(hotkeysRef && hotkeysRef.attachToWebContents){ 
          hotkeysRef.attachToWebContents(views.A.webContents); 
          hotkeysRef.attachToWebContents(views.B.webContents); 
        } 
      } catch(_){ }
      
      resolveAndLoad(views.A, urls.A);
      resolveAndLoad(views.B, urls.B);
      attachNavTracking('A', views.A);
      attachNavTracking('B', views.B);
    }
    
    statsActive = true;
    embedOffsetY = typeof offsetY === 'number' ? offsetY : embedOffsetY;
    layout();
    setTimeout(layout, 60);
    
    // Assert topmost ordering
    try { ['panel','A','B'].forEach(k=>{ const v=views[k]; if(v) try { mainWindow.setTopBrowserView(v); } catch(_){ } }); } catch(_){ }
    [0,80,200].forEach(d=> setTimeout(()=>{ try { ensureTopmost(); } catch(_){ } }, d));
    
    // Notify panel that stats mode is active
    try { if(views.panel) views.panel.webContents.send('stats-mode-changed', { active: true }); } catch(_){ }
  }
  
  function hideStatsViews(){
    if(!statsActive) return;
    try { hideCover(); } catch(_){ }
    
    // Hide A/B views but keep panel visible
    ['A','B'].forEach(k=>{
      const v = views[k];
      if(v) try { v.setBounds({ x:0, y:0, width:0, height:0 }); } catch(_){ }
    });
    
    statsActive = false;
    
    // Notify panel that stats mode is inactive
    try { if(views.panel) views.panel.webContents.send('stats-mode-changed', { active: false }); } catch(_){ }
  }
  
  // Backward compatibility aliases
  function createEmbedded(offsetY){ createStatsViews(offsetY); }
  function destroyEmbedded(force){ 
    hideStatsViews();
    if(force){
      ['A','B'].forEach(k=>{ 
        const v=views[k]; 
        if(v) try { v.webContents.destroy(); } catch(_){ } 
        views[k] = null;
      });
    }
  }
  function detachToWindow(){ /* noop (removed) */ }
  
  function handleStageResized(){ 
    try { 
      const sy = stageBoundsRef && stageBoundsRef.value ? Number(stageBoundsRef.value.y) : embedOffsetY; 
      if(!isNaN(sy) && sy !== embedOffsetY) embedOffsetY = sy; 
    } catch(_){ } 
    layout(); 
  }
  
  function ensureTopmost(){ 
    if(!mainWindow || mainWindow.isDestroyed()) return;
    if(typeof mainWindow.setTopBrowserView !== 'function') return;
    
    // Panel always on top, then A/B if stats active
    if(statsActive){
      ['A','B','panel'].forEach(k=>{ 
        const v=views[k]; 
        if(v) try { mainWindow.setTopBrowserView(v); } catch(_){ } 
      });
    } else if(panelActive && views.panel){
      try { mainWindow.setTopBrowserView(views.panel); } catch(_){ }
    }
  }

  // --- IPC command dispatcher -------------------------------------------------------------
  function handleIpc(ch,payload){
    switch(ch){
      case 'stats-set-url': setUrl(payload.slot,payload.url); break;
      case 'stats-layout': setMode(payload.mode); break;
      case 'stats-open-devtools':
        try {
          if(payload && payload.target==='panel' && views.panel){ views.panel.webContents.openDevTools({ mode:'detach' }); break; }
          const slot = payload && payload.slot; if(['A','B'].includes(slot)){ const v=views[slot]; if(v) v.webContents.openDevTools({ mode:'detach' }); }
        } catch(_){}
        break;
      case 'stats-toggle-side': toggleSide(); break;
      case 'stats-set-side': setSide(payload && payload.side); break;
    case 'stats-panel-set-hidden': setPanelHidden(payload && payload.hidden); break;
    case 'stats-panel-toggle': togglePanelHidden(); break;
  case 'stats-single-window': applySingleWindow(payload && payload.enabled); break;
      case 'stats-reload-slot':
        try { const slot=payload && payload.slot; if(['A','B'].includes(slot)){ const v=views[slot]; if(v) try { v.webContents.reloadIgnoringCache(); } catch(_){ try { v.webContents.reload(); } catch(_2){} } } } catch(_){}
        break;
      case 'stats-save-credentials':
        try { const { slot, username, password } = payload||{}; if(slot && username){ const v=views[slot]; if(v){ const host=new URL(v.webContents.getURL()).hostname; const all=store.get('siteCredentials')||{}; all[host]={ username,password }; store.set('siteCredentials',all); v.webContents.send('apply-credentials',{ hostname:host, username, password }); if(views.panel) views.panel.webContents.send('stats-credentials-status',{ slot, hostname:host, has:true, username }); } } } catch(_){}
        break;
      case 'board-set-side': setSide(payload && payload.side); break;
      case 'board-set-width': setWidth(payload && payload.width); break;
      case 'lol-stats-settings':
        if(payload){
          if(typeof payload.manualMode==='boolean') lolManualMode=payload.manualMode;
            if(payload.metricVisibility) lolMetricVisibility={ ...lolMetricVisibility, ...payload.metricVisibility };
            if(Array.isArray(payload.metricOrder)) lolMetricOrder=payload.metricOrder.slice();
            if(payload.manualData) lolManualData = payload.manualData;
            if(payload.metricMarks) lolMetricMarks = payload.metricMarks;
            persist();
        }
        break;
      case 'lol-manual-data-set':
        try { if(payload && typeof payload==='object'){ lolManualData = payload; persist(); } } catch(_){ }
        break;
      case 'lol-metric-marks-set':
        try { if(payload && typeof payload==='object'){ lolMetricMarks = payload; persist(); } } catch(_){ }
        break;
      case 'stats-config-set':
        try { if(payload && typeof payload==='object'){ Object.keys(payload).forEach(k=>{ if(k in statsConfig) statsConfig[k]=payload[k]; }); persist(); if(views.panel) views.panel.webContents.send('stats-config-applied', statsConfig); } } catch(_){}
        break;
    }
  }

  // Public API
  function setHotkeys(h){ hotkeysRef = h || null; }
  function setBoardManagerRef(ref){ boardManagerRef = ref; }
  function getPanelView(){ return views.panel; }
  function isStatsActive(){ return statsActive; }
  function isPanelActive(){ return panelActive; }

  return { 
    // Backward compatibility
    open: ()=>{}, 
    handleIpc, 
    views, 
    createEmbedded, 
    destroyEmbedded, 
    detachToWindow, 
    handleStageResized, 
    ensureTopmost, 
    setUrl, 
    getMode: ()=>mode, 
    getSide: ()=>side, 
    getPanelHidden: ()=>panelHidden, 
    setSide, 
    setWidth,
    setHotkeys,
    // New API for unified panel
    createPanel,
    createStatsViews,
    hideStatsViews,
    setBoardManagerRef,
    getPanelView,
    isStatsActive,
    isPanelActive,
    getPanelWidth: ()=>panelWidth
  };
}

module.exports = { createStatsManager };

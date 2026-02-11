// Unified side panel Stats Manager (panel always docked, A/B slots optional for stats mode)
// Panel is now the primary side panel containing odds board + stats sections.
// Stats mode (A/B views) toggled separately. Panel docked by default.

const { BrowserView } = require('electron');
const { attachContextMenu: attachCtxMenu } = require('../utils/contextMenu');
const path = require('path');

// Module-level flag to prevent duplicate IPC registration
let soundIpcRegistered = false;
// Module-level ref to current statsManager instance (for IPC handler to use latest instance)
let currentStatsManagerRef = { views: null, panelActive: false, createPanel: null, embedOffsetY: 0, panelReadyForSounds: false, pendingSoundEvents: [], flushPendingSoundEvents: null };

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
  // Migrate: if stored width matches old default (360), bump to new default
  if(panelWidth === 360 && DEFAULT_PANEL_WIDTH !== 360){ panelWidth = DEFAULT_PANEL_WIDTH; store.set('boardWidth', panelWidth); }
  let embedOffsetY = 0;                                           // toolbar offset
  let singleWindow = !!store.get('statsSingleWindow', false);     // when true, only one slot is active

  // LoL stats related
  let lolManualMode = store.get('lolManualMode', false);
  let lolManualData = store.get('lolManualData', null);
  let lolMetricMarks = store.get('lolMetricMarks', {});
  let lolMetricVisibility = store.get('lolMetricVisibility', {});
  let lolMetricOrder = store.get('lolMetricOrder', null);
  let lolTemplate = store.get('lolTemplate', 'all');
  const DEFAULT_STATS_CONFIG = { animationsEnabled:true, animationDurationMs:450, animationScale:1, animationPrimaryColor:'#3b82f6', animationSecondaryColor:'#f59e0b', heatBarOpacity:0.55, winLoseEnabled:true };
  let statsConfig = Object.assign({}, DEFAULT_STATS_CONFIG, store.get('statsConfig', {}));

  // Views container: panel is always created, A/B only when stats mode is active
  const views = { A:null, B:null, panel:null };
  let panelActive = false;    // Panel view created and docked
  let statsActive = false;    // Stats mode (A/B views visible)

  let hotkeysRef = hotkeys || null;

  // Queue for sound events that arrive before panel is ready
  const pendingSoundEvents = [];
  let panelReadyForSounds = false;
  
  // Update module-level ref so IPC handler can access this instance
  currentStatsManagerRef.views = views;
  currentStatsManagerRef.pendingSoundEvents = pendingSoundEvents;

  // Register sound event IPC early (before Grid loads) - only once per process
  if (!soundIpcRegistered) {
    soundIpcRegistered = true;
    const { ipcMain } = require('electron');
    ipcMain.on('lol-sound-event', (_e, { type, timestamp, gameNum }) => {
      // Use module-level ref to get current instance's values
      const ref = currentStatsManagerRef;
      console.log('[stats] 📢 Sound event received:', type, 'panel=', !!ref.views?.panel, 'panelActive=', ref.panelActive, 'ready=', ref.panelReadyForSounds);
      
      // If panel doesn't exist yet, create it to handle sounds
      if (ref.views && !ref.views.panel && !ref.panelActive && ref.createPanel) {
        console.log('[stats] 📢 Creating panel for sound playback');
        ref.createPanel(ref.embedOffsetY);
      }
      
      // If panel is ready, send immediately; otherwise queue
      if (ref.panelReadyForSounds && ref.views?.panel && !ref.views.panel.webContents.isDestroyed()) {
        try { 
          ref.views.panel.webContents.send('lol-sound-event', { type, timestamp, gameNum }); 
          console.log('[stats] 📢 Sound event sent to panel');
        } catch(err){ 
          console.error('[stats] send to panel failed:', err); 
        }
      } else if (ref.pendingSoundEvents) {
        // Queue the event for when panel is ready
        ref.pendingSoundEvents.push({ type, timestamp, gameNum });
        console.log('[stats] 📢 Sound event queued, queue size:', ref.pendingSoundEvents.length);
      }
    });
  }
  
  // Function to flush pending sound events (called when panel is ready)
  function flushPendingSoundEvents() {
    if (!views.panel || views.panel.webContents.isDestroyed()) return;
    panelReadyForSounds = true;
    currentStatsManagerRef.panelReadyForSounds = true;
    while (pendingSoundEvents.length > 0) {
      const event = pendingSoundEvents.shift();
      try {
        views.panel.webContents.send('lol-sound-event', event);
        console.log('[stats] 📢 Flushed queued sound event:', event.type);
      } catch(err) {
        console.error('[stats] flush sound event failed:', err);
      }
    }
  }
  
  // Store flushPendingSoundEvents in ref for IPC handler
  currentStatsManagerRef.flushPendingSoundEvents = flushPendingSoundEvents;

  // Temporary cover for stats mode (theme-aware)
  const COVER_DARK = '#0d0f17';
  const COVER_LIGHT = '#f9f9ff';
  function coverBg(){ return (store.get('appTheme') === 'light') ? COVER_LIGHT : COVER_DARK; }
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
      const bg = coverBg();
      if(!coverView){
        coverView = new BrowserView({ webPreferences:{ contextIsolation:true, sandbox:true } });
        try { coverView.webContents.setBackgroundColor(bg); } catch(_){ }
        try {
          const html = `<!doctype html><html><head><meta charset="utf-8"/></head><body style="margin:0;background:${bg};"></body></html>`;
          coverView.webContents.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
        } catch(_){ }
      }
      const attached = typeof mainWindow.getBrowserViews==='function' && mainWindow.getBrowserViews().includes(coverView);
      if(!attached) try { mainWindow.addBrowserView(coverView); } catch(_){ }
      try { coverView.setBounds(b); } catch(_){ }
      coverShown = true;
    } catch(_){ }
  }
  function hideCover(){
    if(!coverView) return;
    try { coverView.setBounds({ x:0, y:0, width:0, height:0 }); } catch(_){ }
    coverShown = false;
  }

  // --- Persistence ------------------------------------------------------------------------
  function persist(){
    store.set('statsUrls', urls);
    store.set('statsLayoutMode', mode);
    store.set('statsPanelSide', side);
    // Keep canonical side in sync (used by board manager).
    store.set('boardSide', side);
    store.set('boardWidth', panelWidth);
    store.set('statsSingleWindow', singleWindow);
    store.set('lolMetricVisibility', lolMetricVisibility);
    if(lolMetricOrder) store.set('lolMetricOrder', lolMetricOrder);
    store.set('lolTemplate', lolTemplate);
    store.set('statsConfig', statsConfig);
    store.set('lolManualMode', lolManualMode);
    if(lolManualData) store.set('lolManualData', lolManualData);
    store.set('lolMetricMarks', lolMetricMarks);
  }

  // --- Helpers ---------------------------------------------------------------------------
  function canonicalHost(h){
    if(!h) return h;
    if(/(^|\.)grid\.gg$/i.test(h)) return 'grid.gg';
    const p = h.split('.');
    if(p.length>2) return p.slice(-2).join('.');
    return h;
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
      try { view.webContents.loadFile(path.join(__dirname,'..','..','..','renderer','lolstats','index.html')); } catch(_){ }
      return;
    }
    try {
      const u = new URL(raw); const host=u.hostname; const canon=canonicalHost(host); const sess=view.webContents.session;
      const all = store.get('siteCookies')||{}; const saved = all[host]||all[canon];
      if(Array.isArray(saved)) saved.forEach(c=>{ try { sess.cookies.set({ url:`${u.protocol}//${host}${c.path||'/'}`, name:c.name, value:c.value, domain:c.domain, path:c.path, secure:c.secure, httpOnly:c.httpOnly, expirationDate:c.expirationDate, sameSite:c.sameSite }).catch(()=>{}); } catch(_){ } });
      view.webContents.loadURL(raw);
    } catch(e){ console.warn('[stats] load fail', raw, e.message); }
  }
  function setUrl(slot,u){ if(['A','B'].includes(slot) && u){ urls[slot]=u; persist(); resolveAndLoad(views[slot],u); } }

  // --- LoL stats integration --------------------------------------------------------------
  let lolStats = null; const lastPortal = { A:null,B:null }; const slotInit={ A:false,B:false }; let ipcLolRegistered=false;
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
  function registerLolIpc(){ 
    if(ipcLolRegistered) return; 
    ipcLolRegistered=true; 
    const { ipcMain } = require('electron'); 
    ipcMain.on('lol-stats-raw',(_e,{ slot,data })=>{ 
      if(!lolStats) return; 
      if(data && data.source==='lol-reset-trigger'){ lolStats.reset(); broadcast(lolStats.snapshot()); return; } 
      lolStats.handleRaw(data); 
      broadcast(lolStats.snapshot()); 
    }); 
    ipcMain.on('lol-stats-reset',()=>{ if(lolStats){ lolStats.reset(); broadcast(lolStats.snapshot()); } });
    // Note: lol-sound-event IPC is registered early in createStatsManager initialization
  }
  function maybeAutoReset(slot,url){ if(!lolStats) return; if(!/portal\.grid\.gg/i.test(url)) return; if(lastPortal[slot] && lastPortal[slot]!==url){ try { lolStats.reset(); lolStats.reinject && lolStats.reinject(views[slot]); views[slot].webContents.executeJavaScript(`window.postMessage({ type:'restart_data_collection', reason:'url-change' }, '*');`).catch(()=>{}); broadcast(lolStats.snapshot()); } catch(_){ } } lastPortal[slot]=url; }
  
  // Early injection on dom-ready to intercept WebSocket before page creates connections
  function maybeEarlyInject(slot, view, url){
    if(!url || !/portal\.grid\.gg/i.test(url)) return;
    ensureLolStats();
    try { view.webContents.send('identify-slot', slot); } catch(_){ }
    try {
      // Always call init first (sets up sendFn, adds to injectedViews)
      lolStats.init(view, slot, (snap)=> broadcast(snap));
      // ALWAYS reinject on dom-ready - this handles page reloads where init() is skipped
      // because view is already in injectedViews. Without this, reload breaks data collection.
      lolStats.reinject(view);
      console.log('[stats] Grid injection complete for slot', slot);
    } catch(e){ console.error('[stats] Injection error:', e); }
  }
  
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
    view.webContents.on('did-navigate', (_e,u)=>{ update(u); });
    view.webContents.on('did-navigate-in-page', (_e,u)=>{ update(u); });
    
    // CRITICAL: Inject on dom-ready (BEFORE did-finish-load) to intercept WebSocket
    view.webContents.on('dom-ready', ()=>{
      try {
        const cur = view.webContents.getURL();
        console.log(`[stats] dom-ready for slot ${slot}: ${cur}`);
        maybeEarlyInject(slot, view, cur);
      } catch(e){ console.error('[stats] dom-ready error:', e); }
    });
    
    view.webContents.on('did-finish-load', ()=>{
      try {
        const cur = view.webContents.getURL();
        update(cur);
        const credsAll = store.get('siteCredentials')||{};
        const host = new URL(cur).hostname;
        const canon = canonicalHost(host);
        const creds = credsAll[host] || credsAll[canon];
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
          // Note: main injection happens on dom-ready now for earlier WebSocket interception
          // Here we just mark as initialized and broadcast current state
          try { view.webContents.send('identify-slot', slot); } catch(_){ }
          maybeAutoReset(slot, cur);
          broadcast(lolStats.snapshot());
        }
      } catch(_){ }
    });
    view.webContents.on('did-navigate', (_e,u)=> maybeAutoReset(slot,u));
    view.webContents.on('did-navigate-in-page', (_e,u)=> maybeAutoReset(slot,u));
  }

  // --- Context menu (shared utility) -----------------------------------------------------
  function attachContextMenu(view, label) { attachCtxMenu(view, mainWindow, 'Stats Slot: ' + (label || '?')); }


  function deferEnsureTopmost() { [0,80,200].forEach(d=> setTimeout(()=>{ try { ensureTopmost(); } catch(_){ } }, d)); }

  /** Common BrowserView setup: add to window, context menu, throttling, hotkeys */
  function setupView(view, label) {
    try { mainWindow.addBrowserView(view); } catch(_){ }
    attachContextMenu(view, label);
    try { view.webContents.setBackgroundThrottling(false); } catch(_){ }
    try { view.webContents.setBackgroundColor(coverBg()); } catch(_){ }
    try { if(hotkeysRef?.attachToWebContents) hotkeysRef.attachToWebContents(view.webContents); } catch(_){ }
  }

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
      setupView(views.panel, 'Panel');
      
      try { views.panel.webContents.loadFile(path.join(__dirname,'..','..','..','renderer','pages','stats_panel.html')); } catch(_){ }
      views.panel.webContents.on('did-finish-load', ()=>{ 
        try { 
          const hb = store.get('gsHeatBar'); 
          views.panel.webContents.send('stats-init', { 
            urls, mode, side, panelWidth, 
            lolManualMode, lolMetricVisibility, lolMetricOrder, lolTemplate,
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
          
          // Flush any pending sound events now that panel is ready
          // Small delay to ensure stats_sounds.js has initialized
          setTimeout(() => {
            try { flushPendingSoundEvents(); } catch(_){ }
          }, 500);
        } catch(_){ } 
      });
    }
    
    panelActive = true;
    currentStatsManagerRef.panelActive = true;
    embedOffsetY = typeof offsetY === 'number' ? offsetY : embedOffsetY;
    currentStatsManagerRef.embedOffsetY = embedOffsetY;
    layout();
    setTimeout(layout, 60);
    
    try { if(views.panel) mainWindow.setTopBrowserView(views.panel); } catch(_){ }
    deferEnsureTopmost();
  }
  
  // Update module-level ref with createPanel function now that it's defined
  currentStatsManagerRef.createPanel = createPanel;
  
  // --- Stats views (A/B) lifecycle -------------------------------------------------------
  function createStatsViews(offsetY){
    if(statsActive) return;
    if(!mainWindow || mainWindow.isDestroyed()) return;
    
    // Ensure panel exists first
    if(!panelActive) createPanel(offsetY);
    
    // Show cover while loading stats views
    try { showCover(); } catch(_){ }
    
    const freshViews = !(views.A && views.B);
    
    if(freshViews){
      ['A','B'].forEach(slot=>{
        views[slot] = new BrowserView({
          webPreferences:{
            partition:'persist:stats'+slot,
            contextIsolation:true, sandbox:false,
            preload:path.join(__dirname,'..','..','preloads','statsContent.js'),
            backgroundThrottling:false
          }
        });
        setupView(views[slot], slot);
        resolveAndLoad(views[slot], urls[slot]);
        attachNavTracking(slot, views[slot]);
      });
    }
    
    statsActive = true;
    embedOffsetY = typeof offsetY === 'number' ? offsetY : embedOffsetY;
    layout();
    setTimeout(layout, 60);
    
    // Assert topmost ordering
    try { ['panel','A','B'].forEach(k=>{ const v=views[k]; if(v) try { mainWindow.setTopBrowserView(v); } catch(_){ } }); } catch(_){ }
    deferEnsureTopmost();
    
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
  const IPC_SIMPLE = {
    'stats-set-url': p=> setUrl(p.slot, p.url),
    'stats-layout': p=> setMode(p.mode),
    'stats-toggle-side': ()=> toggleSide(),
    'stats-set-side': p=> setSide(p?.side),
    'stats-single-window': p=> applySingleWindow(p?.enabled),
    'board-set-side': p=> setSide(p?.side),
    'board-set-width': p=> setWidth(p?.width),
  };
  function handleIpc(ch,payload){
    if(IPC_SIMPLE[ch]){ IPC_SIMPLE[ch](payload); return; }
    switch(ch){
      case 'stats-open-devtools':
        try {
          if(payload && payload.target==='panel' && views.panel){ views.panel.webContents.openDevTools({ mode:'detach' }); break; }
          const slot = payload && payload.slot; if(['A','B'].includes(slot)){ const v=views[slot]; if(v) v.webContents.openDevTools({ mode:'detach' }); }
        } catch(_){}
        break;
      case 'stats-reload-slot':
        try { const slot=payload && payload.slot; if(['A','B'].includes(slot)){ const v=views[slot]; if(v) try { v.webContents.reloadIgnoringCache(); } catch(_){ try { v.webContents.reload(); } catch(_2){} } } } catch(_){}
        break;
      case 'stats-save-credentials':
        try { const { slot, username, password } = payload||{}; if(slot && username){ const v=views[slot]; if(v){ const host=new URL(v.webContents.getURL()).hostname; const all=store.get('siteCredentials')||{}; all[host]={ username,password }; store.set('siteCredentials',all); v.webContents.send('apply-credentials',{ hostname:host, username, password }); if(views.panel) views.panel.webContents.send('stats-credentials-status',{ slot, hostname:host, has:true, username }); } } } catch(_){}
        break;
      case 'lol-stats-settings':
        if(payload){
          if(typeof payload.manualMode==='boolean') lolManualMode=payload.manualMode;
            if(payload.metricVisibility) lolMetricVisibility={ ...lolMetricVisibility, ...payload.metricVisibility };
            if(Array.isArray(payload.metricOrder)) lolMetricOrder=payload.metricOrder.slice();
            if(typeof payload.template==='string') lolTemplate=payload.template;
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

  /** Re-apply background color on theme change */
  function refreshCoverTheme(){
    const bg = coverBg();
    if(coverView) try { coverView.webContents.setBackgroundColor(bg); } catch(_){ }
    ['A','B'].forEach(k=>{ if(views[k]) try { views[k].webContents.setBackgroundColor(bg); } catch(_){ } });
  }

  /** Pre-create A/B views during splash so Tab opens instantly */
  function warmupViews(){
    if(views.A && views.B) return; // already created
    if(!mainWindow || mainWindow.isDestroyed()) return;
    if(!panelActive) return; // panel must exist first
    ['A','B'].forEach(slot=>{
      if(views[slot]) return;
      views[slot] = new BrowserView({
        webPreferences:{
          partition:'persist:stats'+slot,
          contextIsolation:true, sandbox:false,
          preload:path.join(__dirname,'..','..','preloads','statsContent.js'),
          backgroundThrottling:false
        }
      });
      setupView(views[slot], slot);
      // Hide at zero bounds (not shown until Tab is pressed)
      try { views[slot].setBounds({ x:0, y:0, width:0, height:0 }); } catch(_){ }
      resolveAndLoad(views[slot], urls[slot]);
      attachNavTracking(slot, views[slot]);
    });
    console.log('[stats] warmupViews complete — A/B pre-created');
  }

  return { 
    handleIpc, 
    views, 
    handleStageResized, 
    ensureTopmost,
    deferEnsureTopmost, 
    setUrl, 
    getMode: ()=>mode, 
    getSide: ()=>side,
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
    refreshCoverTheme,
    warmupViews,
    getPanelWidth: ()=>panelWidth
  };
}

module.exports = { createStatsManager };

// Stats window manager: two switchable content BrowserViews (A,B) plus panel (UI + future game stats)
// Supports layout modes: split, focusA, focusB and panel side left/right.

const { BrowserWindow, BrowserView } = require('electron');
const path = require('path');

function createStatsManager({ store, mainWindow, stageBoundsRef, quittingRef, upscalerManager }) {
  function canonicalHost(h){
    try {
      if(!h) return h;
      if(/(^|\.)grid\.gg$/i.test(h)) return 'grid.gg';
      const parts = h.split('.');
      if(parts.length>2) return parts.slice(-2).join('.');
      return h;
    } catch(_) { return h; }
  }
  let statsWindow = null; // detached window
  let embedded = { active:false, container:null }; // embedded BrowserViews in main window
  let embedOffsetY = 0; // locked toolbar offset when entering embedded mode
  const views = { A: null, B: null, panel: null }; // content views + control panel
  const DEFAULT_URLS = { A: 'https://portal.grid.gg', B: 'https://www.twitch.tv' };
  const urls = Object.assign({}, DEFAULT_URLS, store.get('statsUrls', {}));
  let mode = store.get('statsLayoutMode', 'split'); // 'split' | 'focusA' | 'focusB' | 'vertical'
  let side = store.get('statsPanelSide', 'right'); // 'left' | 'right'
  // Direct constants import to avoid circular dependency via parent barrel
  const { STATS_PANEL_WIDTH: PANEL_WIDTH } = require('../utils/constants');
  const GAP = 4;

  // Additional persisted settings for LoL stats panel
  let lolManualMode = store.get('lolManualMode', false);
  let lolMetricVisibility = store.get('lolMetricVisibility', {}); // metric -> true (visible)
  let lolMetricOrder = store.get('lolMetricOrder', null); // array or null
  // LoL panel animation settings
  let lolAnimEnabled = store.get('lolAnimEnabled', true);
  let lolAnimDurationMs = store.get('lolAnimDurationMs', 3000);

  function persist() {
    store.set('statsUrls', urls);
    store.set('statsLayoutMode', mode);
    store.set('statsPanelSide', side);
    store.set('lolManualMode', lolManualMode);
  store.set('lolMetricVisibility', lolMetricVisibility);
  if(lolMetricOrder) store.set('lolMetricOrder', lolMetricOrder);
  store.set('lolAnimEnabled', !!lolAnimEnabled);
  store.set('lolAnimDurationMs', Number(lolAnimDurationMs)||3000);
  }

  function layout() {
    if (!statsWindow) return;
    // When embedded, statsWindow is a shim returning mainWindow content bounds (full window). We must respect stage (below toolbar)
    const full = statsWindow.getContentBounds();
    const stage = (embedded.active && stageBoundsRef && stageBoundsRef.value) ? stageBoundsRef.value : full;
    // base rectangle we actually draw into (below toolbar)
  const baseY = embedded.active ? embedOffsetY : 0;
    const baseH = embedded.active ? stage.height : full.height;
    const b = { x: 0, y: baseY, width: full.width, height: baseH };
    if (!views.panel) return; // not ready yet
  const panelX = side === 'left' ? 0 : (b.width - PANEL_WIDTH);
  const contentX = side === 'left' ? PANEL_WIDTH : 0;
  const contentW = b.width - PANEL_WIDTH;
  const offsetY = b.y;
  try { views.panel.setBounds({ x: panelX, y: offsetY, width: PANEL_WIDTH, height: b.height }); } catch(_){ }
  const setSafe = (view, rect) => { if(view) try { view.setBounds(rect); } catch(_){ } };
    if (mode === 'split') {
      const hHalf = Math.floor((b.height - GAP) / 2);
  setSafe(views.A, { x: contentX, y: offsetY, width: contentW, height: hHalf });
  setSafe(views.B, { x: contentX, y: offsetY + hHalf + GAP, width: contentW, height: b.height - hHalf - GAP });
    } else if (mode === 'focusA') {
  setSafe(views.A, { x: contentX, y: offsetY, width: contentW, height: b.height });
  setSafe(views.B, { x: contentX, y: offsetY, width: 0, height: 0 });
    } else if (mode === 'focusB') {
  setSafe(views.A, { x: contentX, y: offsetY, width: 0, height: 0 });
  setSafe(views.B, { x: contentX, y: offsetY, width: contentW, height: b.height });
    } else if (mode === 'vertical') {
      const wHalf = Math.floor((contentW - GAP) / 2);
  setSafe(views.A, { x: contentX, y: offsetY, width: wHalf, height: b.height });
  setSafe(views.B, { x: contentX + wHalf + GAP, y: offsetY, width: contentW - wHalf - GAP, height: b.height });
    }
  }

  function setMode(m) {
    if (!['split','focusA','focusB','vertical'].includes(m)) return;
    mode = m; persist(); layout();
  }
  function toggleSide(){ side = side === 'left' ? 'right' : 'left'; persist(); layout(); }
  function resolveAndLoad(view, rawUrl){
    if(!view) return;
    if(rawUrl === 'embed:lolstats'){
      try { view.webContents.loadFile(path.join(__dirname,'..','..','renderer','lolstats','index.html')); } catch(e){ console.error('Failed load lolstats embed', e); }
      return;
    }
  try {
      const u = new URL(rawUrl);
      const host = u.hostname;
      const canonHost = canonicalHost(host);
      const sess = view.webContents.session;
      const savedCookiesAll = (store.get('siteCookies')||{});
      const saved = savedCookiesAll[host] || savedCookiesAll[canonHost];
  try { console.log('[cred][statsManager] resolveAndLoad host', host, 'canon', canonHost, 'cookiesSaved='+(saved? saved.length:0)); } catch(_){}
      if (Array.isArray(saved) && saved.length){
        saved.forEach(c => {
          const cookie = { url: `${u.protocol}//${c.domain.startsWith('.')? (host): c.domain}${c.path||'/'}`, name: c.name, value: c.value };
          if(c.domain) cookie.domain = c.domain; if(c.path) cookie.path=c.path; if(c.secure!=null) cookie.secure=c.secure; if(c.httpOnly!=null) cookie.httpOnly=c.httpOnly; if(c.expirationDate) cookie.expirationDate=c.expirationDate; if(c.sameSite) cookie.sameSite=c.sameSite;
          try { sess.cookies.set(cookie).catch(()=>{}); } catch(_) {}
        });
      }
  view.webContents.loadURL(rawUrl);
    } catch(e){ console.error('Failed load URL', rawUrl, e); }
  }
  function setUrl(slot, url){
    if(!['A','B'].includes(slot) || !url) return; 
    urls[slot]=url; persist();
    const v=views[slot]; 
    resolveAndLoad(v, url);
  }

  // --- Shared LoL stats + navigation tracking (works for both window & embedded) ---
  let lolStats = null;
  const lastPortalUrl = { A:null, B:null };
  let ipcLolRegistered = false;
  const slotInit = { A:false, B:false };
  // Track initial script injection per BrowserView so we can reinject bundle on reload
  const portalInjectedOnce = new WeakSet();

  function ensureLolStats(){
    if(lolStats) return;
    const { createLolStatsModule } = require('../../lolstats');
    lolStats = createLolStatsModule({
      loadHistory: () => { try { return store.get('lolStatsHistory') || []; } catch(_) { return []; } },
      saveHistory: (h) => { try { store.set('lolStatsHistory', h); } catch(_){} }
    });
    registerLolIpc();
  }
  function broadcast(snapshot){
    if(views.panel){ try { views.panel.webContents.send('lol-stats-update', snapshot); } catch(_){} }
    ['A','B'].forEach(slot=>{ if(urls[slot]==='embed:lolstats'){ const v=views[slot]; if(v){ try { v.webContents.executeJavaScript(`window.postMessage({ __lolStatsPayload: ${JSON.stringify(snapshot)} }, '*');`).catch(()=>{}); } catch(_){} } } });
  }
  function registerLolIpc(){
    if(ipcLolRegistered) return; ipcLolRegistered=true;
    const { ipcMain } = require('electron');
    ipcMain.on('lol-stats-raw', (evt, { slot, data }) => {
      if(!lolStats) return;
      if(data && data.source === 'lol-reset-trigger') { lolStats.reset(); broadcast(lolStats.snapshot()); return; }
      lolStats.handleRaw(data); broadcast(lolStats.snapshot());
    });
    ipcMain.on('lol-stats-reset', ()=>{ if(lolStats){ lolStats.reset(); broadcast(lolStats.snapshot()); } });
  }
  function maybeAutoReset(slot, url){
    if(!lolStats) return;
    if(!/portal\.grid\.gg/i.test(url)) return;
    if(lastPortalUrl[slot] && lastPortalUrl[slot] !== url){
      try {
        lolStats.reset();
        lolStats.reinject && lolStats.reinject(views[slot]);
        views[slot].webContents.executeJavaScript(`window.postMessage({ type:'restart_data_collection', reason:'url-change' }, '*');`).catch(()=>{});
      } catch(_){ }
      broadcast(lolStats.snapshot());
    }
    lastPortalUrl[slot] = url;
  }
  function attachNavTracking(slot, view){
    if(!view || slotInit[slot]) return; slotInit[slot]=true;
    const update = (u)=>{ try { urls[slot]=u; persist(); if(views.panel){ try { views.panel.webContents.send('stats-url-update',{ slot, url:u }); } catch(_){} } } catch(_){} };
    view.webContents.on('did-navigate', (_, u)=> update(u));
    view.webContents.on('did-navigate-in-page', (_, u)=> update(u));
  view.webContents.on('did-finish-load', ()=>{
      try {
        const cur = view.webContents.getURL();
        update(cur);
    // Upscaler injection after initial load (only slot A)
    try { if(upscalerManager) upscalerManager.maybeInject(view, slot); } catch(_){ }
        const credsAll = store.get('siteCredentials') || {};
        const host = new URL(cur).hostname;
        const ch = canonicalHost(host);
        const creds = credsAll[host] || credsAll[ch];
        if(creds){
          try { console.log('[cred][statsManager] applying creds host', host, 'canon', ch, 'user='+creds.username); } catch(_){ }
          view.webContents.send('apply-credentials', { hostname: host, username: creds.username, password: creds.password });
        }
        const sess = view.webContents.session;
        sess.cookies.get({ url: cur.startsWith('http') ? cur : undefined }).then(cookies => {
          const filtered = cookies.filter(c=> c.domain && !c.domain.endsWith('localhost'));
          const bag = store.get('siteCookies') || {};
          bag[host] = filtered.map(c=>({ name:c.name, value:c.value, domain:c.domain, path:c.path, secure:c.secure, httpOnly:c.httpOnly, expirationDate:c.expirationDate, sameSite:c.sameSite }));
          if(ch!==host) bag[ch] = bag[host];
          store.set('siteCookies', bag);
        }).catch(()=>{});
        if(views.panel){ try { views.panel.webContents.send('stats-credentials-status', { slot, hostname: host, has: !!creds, username: creds?.username||null }); } catch(_){} }
        // LoL stats injection
        if(/portal\.grid\.gg/.test(cur)){
          ensureLolStats();
          try { view.webContents.send('identify-slot', slot); } catch(_){ }
          try {
            if(!portalInjectedOnce.has(view)){
              // First time for this BrowserView instance
              lolStats.init(view, slot, (snap)=> broadcast(snap));
              portalInjectedOnce.add(view);
              view.webContents.executeJavaScript(`console.log('[lol-stats] initial inject into ${slot}')`).catch(()=>{});
            } else {
              // Reload or navigation within same view: force reinjection (previous scripts wiped by reload)
              lolStats.reinject && lolStats.reinject(view);
              view.webContents.executeJavaScript(`console.log('[lol-stats] reinjected bundle into ${slot} (reload/navigation)')`).catch(()=>{});
            }
          } catch(_){ }
          maybeAutoReset(slot, cur);
          broadcast(lolStats.snapshot());
        }
      } catch(_){ }
    });
    view.webContents.on('did-navigate', (_, u)=>{ maybeAutoReset(slot, u); });
    view.webContents.on('did-navigate-in-page', (_, u)=>{ maybeAutoReset(slot, u); });
    // Additional hook: slight delay inject in case of dynamic video elements
    view.webContents.on('did-navigate', ()=>{ setTimeout(()=>{ try { if(upscalerManager) upscalerManager.maybeInject(view, slot); } catch(_){ } }, 800); });
    view.webContents.on('did-navigate-in-page', ()=>{ setTimeout(()=>{ try { if(upscalerManager) upscalerManager.maybeInject(view, slot); } catch(_){ } }, 800); });
  }

  function open() {
    if (statsWindow && !statsWindow.isDestroyed()) {
      try { if(!statsWindow.isVisible()) statsWindow.show(); } catch(_){ }
      try { statsWindow.focus(); } catch(_){ }
      return;
    }
    const saved = store.get('statsBounds');
    statsWindow = new BrowserWindow({ width: saved?.width || 1400, height: saved?.height || 900, x: saved?.x, y: saved?.y, title: 'Game Stats', autoHideMenuBar: true, webPreferences: { preload: path.join(__dirname,'..','..','preload.js') } });
    statsWindow.on('close', (e)=>{
      try { store.set('statsBounds', statsWindow.getBounds()); } catch(_){ }
      const q = quittingRef && quittingRef.value;
      if(!q){ try { e.preventDefault(); } catch(_){ } try { statsWindow.hide(); } catch(_){ } return; }
    });
    statsWindow.on('closed', ()=>{ statsWindow=null; });
    views.panel = new BrowserView({ webPreferences: { partition: 'persist:statsPanel', contextIsolation: false, nodeIntegration: true } });
    statsWindow.addBrowserView(views.panel);
    try { views.panel.webContents.loadFile(path.join(__dirname,'..','..','renderer','stats_panel.html')); } catch(_){ }
    views.panel.webContents.on('did-finish-load', ()=>{
      try {
        const hb = store.get('gsHeatBar');
        views.panel.webContents.send('stats-init', { urls, mode, side, lolManualMode, lolMetricVisibility, lolMetricOrder, lolAnimEnabled, lolAnimDurationMs, gsHeatBar: hb });
        const t = store.get('gsTheme'); if(t) views.panel.webContents.send('gs-theme-apply', t);
        if(hb) views.panel.webContents.send('gs-heatbar-apply', hb);
        // Inject lightweight console tap to pipe logs through stats-debug channel
        try { views.panel.webContents.executeJavaScript(`(function(){ if(window.__logTapInstalled) return; window.__logTapInstalled=true; const origLog=console.log, origErr=console.error, origWarn=console.warn; function wrap(kind, fn){ return function(){ try { const args=[...arguments].map(a=> typeof a==='object'? JSON.stringify(a): String(a)); require('electron').ipcRenderer.send('stats-debug',{ tap:kind, msg: args.join(' ')}); } catch(_){ } try { return fn.apply(this, arguments); } catch(_2){ } }; } console.log=wrap('log',origLog); console.warn=wrap('warn',origWarn); console.error=wrap('err',origErr); console.log('[logTap] installed'); })();`).catch(()=>{}); } catch(_){ }
        // Sentinel diagnostics
        try { views.panel.webContents.executeJavaScript(`setTimeout(()=>{ try { const rows=document.querySelectorAll('#lt-body tr').length; console.log('[panel-sentinel] rowsAfterInit', rows); } catch(e){} }, 400);`).catch(()=>{}); } catch(_){ }
      } catch(_){ }
    });
    try {
      views.panel.webContents.on('console-message', (_e, level, message, line, sourceId)=>{
        try { console.log('[stats-panel-console]', level, message); } catch(_){ }
        try {
          if(statsWindow && !statsWindow.isDestroyed()){
            // Forward to stats log window through stats-debug pipe
            const payload = { from:'panel-console', level, message, src:sourceId, line };
            if(require('electron').ipcMain){ /* noop main */ }
            // Use direct injection into log window (simpler than abusing ipcRenderer in main)
            if(globalThis.statsLogWindow && !globalThis.statsLogWindow.isDestroyed){ /* not accessible here reliably */ }
          }
        } catch(_){}
      });
    } catch(_){ }
    views.A = new BrowserView({ webPreferences: { partition: 'persist:statsA', contextIsolation: true, sandbox: false, preload: path.join(__dirname,'..','..','statsContentPreload.js') } });
    views.B = new BrowserView({ webPreferences: { partition: 'persist:statsB', contextIsolation: true, sandbox: false, preload: path.join(__dirname,'..','..','statsContentPreload.js') } });
    statsWindow.addBrowserView(views.A); statsWindow.addBrowserView(views.B);
    resolveAndLoad(views.A, urls.A); resolveAndLoad(views.B, urls.B);
    attachNavTracking('A', views.A); attachNavTracking('B', views.B);
    statsWindow.on('resize', layout);
    setTimeout(layout, 80);
  }

  function handleIpc(channel, payload) {
    switch(channel){
      case 'stats-set-url': setUrl(payload.slot, payload.url); break;
      case 'stats-layout': setMode(payload.mode); break;
      case 'stats-open-devtools':
        try {
          if(payload && payload.target==='panel' && views.panel){ views.panel.webContents.openDevTools({ mode:'detach' }); break; }
          const slot = payload && payload.slot; // 'A' | 'B'
            if(['A','B'].includes(slot)){
              const view = views[slot];
              if(view) view.webContents.openDevTools({ mode:'detach' });
            }
        } catch(_){ }
        break;
      case 'stats-toggle-side': toggleSide(); break;
      case 'stats-reload-slot':
        try {
          const slot = payload && payload.slot;
          if(['A','B'].includes(slot)){
            const v = views[slot];
            if(v && v.webContents){
              // Reload keeping the same URL (no cache-bust param modification)
              try { v.webContents.reloadIgnoringCache(); } catch(_) { try { v.webContents.reload(); } catch(_){} }
            }
          }
        } catch(_){}
        break;
      case 'stats-save-credentials':
        try { const { slot, username, password } = payload || {}; if(slot && username){ const credsAll=store.get('siteCredentials')||{}; const view=views[slot]; if(view){ const host=new URL(view.webContents.getURL()).hostname; credsAll[host]={ username, password }; store.set('siteCredentials', credsAll); view.webContents.send('apply-credentials',{ hostname:host, username, password }); if(views.panel){ views.panel.webContents.send('stats-credentials-status',{ slot, hostname:host, has:true, username }); } } } } catch(_){ }
        break;
      case 'lol-stats-settings':
        if(typeof payload.manualMode === 'boolean') lolManualMode = payload.manualMode;
        if(payload.metricVisibility && typeof payload.metricVisibility === 'object') {
          lolMetricVisibility = { ...lolMetricVisibility, ...payload.metricVisibility };
        }
        if(Array.isArray(payload.metricOrder)) {
          lolMetricOrder = payload.metricOrder.slice();
        }
        if(typeof payload.animEnabled === 'boolean') lolAnimEnabled = payload.animEnabled;
        if(payload.animDurationMs!=null) {
          const v = Number(payload.animDurationMs);
          if(!isNaN(v) && v>0 && v<60000) lolAnimDurationMs = v;
        }
        persist();
        break;
      case 'stats-open-devtools':
        try {
          const slot = payload.slot || 'A';
          if(['A','B'].includes(slot)){
            const view = views[slot];
            if(view){ view.webContents.openDevTools({ mode:'detach' }); }
          }
        } catch(_){ }
        break;
    }
  }

  function createEmbedded(offsetYOverride){
    if(embedded.active) return;
    if(!mainWindow || mainWindow.isDestroyed()) return;
    // If we have a real statsWindow with existing views (window mode) move them instead of rebuilding
    let transferringFromWindow = false;
    if(statsWindow && !statsWindow.isDestroyed() && views.panel && views.A && views.B){
      transferringFromWindow = true;
      try { statsWindow.removeBrowserView(views.panel); } catch(_){ }
      try { statsWindow.removeBrowserView(views.A); } catch(_){ }
      try { statsWindow.removeBrowserView(views.B); } catch(_){ }
      // Destroy the empty window (will not destroy views)
      try { statsWindow.destroy(); } catch(_){ }
      statsWindow = null;
    }
    const fresh = !(views.panel && views.A && views.B) || transferringFromWindow===false && !(views.panel && views.A && views.B);
    // Lock current stage.y as offset (or override); if reusing keep previous unless new provided
    try { embedOffsetY = (typeof offsetYOverride === 'number') ? offsetYOverride : ((stageBoundsRef && stageBoundsRef.value && Number(stageBoundsRef.value.y)) || embedOffsetY || 0); } catch(_) { embedOffsetY = 0; }
    try { console.log('[stats][embed] init offsetY', embedOffsetY, 'fresh=', fresh); } catch(_){ }
  if(fresh){
      views.panel = new BrowserView({ webPreferences: { partition: 'persist:statsPanel', contextIsolation: false, nodeIntegration: true } });
      views.A = new BrowserView({ webPreferences: { partition: 'persist:statsA', contextIsolation: true, sandbox: false, preload: path.join(__dirname,'..','..','statsContentPreload.js') } });
      views.B = new BrowserView({ webPreferences: { partition: 'persist:statsB', contextIsolation: true, sandbox: false, preload: path.join(__dirname,'..','..','statsContentPreload.js') } });
      mainWindow.addBrowserView(views.panel);
      mainWindow.addBrowserView(views.A);
      mainWindow.addBrowserView(views.B);
      try { views.panel.webContents.loadFile(path.join(__dirname,'..','..','renderer','stats_panel.html')); } catch(_){ }
      views.panel.webContents.on('did-finish-load', ()=>{
        try {
          const hb = store.get('gsHeatBar');
          views.panel.webContents.send('stats-init', { urls, mode, side, lolManualMode, lolMetricVisibility, lolMetricOrder, lolAnimEnabled, lolAnimDurationMs, gsHeatBar: hb });
          const t = store.get('gsTheme'); if(t) views.panel.webContents.send('gs-theme-apply', t);
          if(hb) views.panel.webContents.send('gs-heatbar-apply', hb);
        } catch(_){ }
      });
      resolveAndLoad(views.A, urls.A); resolveAndLoad(views.B, urls.B);
  // Attach tracking for new views
  attachNavTracking('A', views.A); attachNavTracking('B', views.B);
    } else {
      // Reattach cached views (no reload)
      try { mainWindow.addBrowserView(views.panel); } catch(_){ }
      try { mainWindow.addBrowserView(views.A); } catch(_){ }
      try { mainWindow.addBrowserView(views.B); } catch(_){ }
  // Ensure tracking attached if not yet
  attachNavTracking('A', views.A); attachNavTracking('B', views.B);
    }
    embedded.active = true;
    statsWindow = { getContentBounds: ()=> mainWindow.getContentBounds(), isDestroyed:()=>false };
    layout();
    [60,120,240,480].forEach(d=> setTimeout(()=>{ if(embedded.active){
      try {
        const sy = stageBoundsRef && stageBoundsRef.value ? Number(stageBoundsRef.value.y) : embedOffsetY;
        if(!isNaN(sy) && sy !== embedOffsetY) { embedOffsetY = sy; }
      } catch(_){ }
      layout();
    } }, d));
  }
  function destroyEmbedded(force){
    if(!embedded.active && !force) return;
    if(embedded.active){
      ['A','B','panel'].forEach(k=>{ const v=views[k]; if(v){ try { mainWindow.removeBrowserView(v); } catch(_){} } });
    }
    if(force){
      // Full destroy (detach / app shutdown)
      ['A','B','panel'].forEach(k=>{ const v=views[k]; if(v){ try { v.webContents.destroy(); } catch(_){} views[k]=null; } });
    }
    embedded.active=false; statsWindow=null;
  }

  // Move existing embedded BrowserViews into a new detached BrowserWindow without reloading
  function detachToWindow(){
    if(!embedded.active) return open(); // fallback
    if(!views.panel || !views.A || !views.B) return open();
    // Create window first (no new views yet)
    const saved = store.get('statsBounds');
    statsWindow = new BrowserWindow({ width: saved?.width || 1400, height: saved?.height || 900, x: saved?.x, y: saved?.y, title: 'Game Stats', autoHideMenuBar: true, webPreferences: { preload: path.join(__dirname,'..','..','preload.js') } });
    statsWindow.on('close', (e)=>{
      try { store.set('statsBounds', statsWindow.getBounds()); } catch(_){ }
      const q = quittingRef && quittingRef.value;
      if(!q){ try { e.preventDefault(); } catch(_){ } try { statsWindow.hide(); } catch(_){ } return; }
    });
    statsWindow.on('closed', ()=>{ statsWindow=null; });
    // Remove from main window and attach to statsWindow (Electron allows addBrowserView on new window after removal)
    ['panel','A','B'].forEach(k=>{ const v=views[k]; if(!v) return; try { mainWindow.removeBrowserView(v); } catch(_){ } try { statsWindow.addBrowserView(v); } catch(_){ } });
    embedded.active=false; // now in window mode
    // When moving panel view we must ensure it already had loaded (embedded did). Re-send init only if still loading
    try {
      if(views.panel && views.panel.webContents && views.panel.webContents.isLoading && views.panel.webContents.isLoading()){
        views.panel.webContents.once('did-finish-load', ()=>{ try { views.panel.webContents.send('stats-init', { urls, mode, side, lolManualMode, lolMetricVisibility, lolMetricOrder, lolAnimEnabled, lolAnimDurationMs }); } catch(_){ } });
      } else if(views.panel){
        views.panel.webContents.send('stats-init', { urls, mode, side, lolManualMode, lolMetricVisibility, lolMetricOrder, lolAnimEnabled, lolAnimDurationMs });
      }
    } catch(_){ }
    // Reassign layout context: statsWindow is real now
    embedOffsetY = 0;
    layout();
    setTimeout(layout, 50);
  }

  function handleStageResized(){
    if(embedded.active){
      try {
        const sy = stageBoundsRef && stageBoundsRef.value ? Number(stageBoundsRef.value.y) : embedOffsetY;
        if(!isNaN(sy) && sy !== embedOffsetY){ embedOffsetY = sy; try { console.log('[stats][embed] stage resize new offsetY', embedOffsetY); } catch(_){ } }
      } catch(_){ }
      layout();
    }
  }

  return { open, handleIpc, views, createEmbedded, destroyEmbedded, detachToWindow, handleStageResized };
}

module.exports = { createStatsManager };

// Simplified embedded-only Stats Manager (A, B slots + panel)
// Removed detachable window mode. Provides layout modes: split | focusA | focusB | vertical and panel side left/right.

const { BrowserView, Menu, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');

function createStatsManager({ store, mainWindow, stageBoundsRef }) {
  // --- Persistent + session state ---------------------------------------------------------
  const { STATS_PANEL_WIDTH: PANEL_WIDTH } = require('../utils/constants');
  const GAP = 4;
  const DEFAULT_URLS = { A: 'https://portal.grid.gg', B: 'https://www.twitch.tv' };
  const urls = Object.assign({}, DEFAULT_URLS, store.get('statsUrls', {}));
  let mode = store.get('statsLayoutMode', 'split');               // split|focusA|focusB|vertical
  let side = store.get('statsPanelSide', 'right');                // left|right
  let embedOffsetY = 0;                                           // toolbar offset

  // LoL stats related
  let lolManualMode = false; // session only
  let lolMetricVisibility = store.get('lolMetricVisibility', {});
  let lolMetricOrder = store.get('lolMetricOrder', null);
  const DEFAULT_STATS_CONFIG = { animationsEnabled:true, animationDurationMs:450, animationScale:1, animationPrimaryColor:'#3b82f6', animationSecondaryColor:'#f59e0b', heatBarOpacity:0.55, winLoseEnabled:true };
  let statsConfig = Object.assign({}, DEFAULT_STATS_CONFIG, store.get('statsConfig', {}));

  // Views container (embedded only)
  const views = { A:null, B:null, panel:null };
  let embeddedActive = false;

  // --- Persistence ------------------------------------------------------------------------
  function persist(){
    store.set('statsUrls', urls);
    store.set('statsLayoutMode', mode);
    store.set('statsPanelSide', side);
    store.set('lolMetricVisibility', lolMetricVisibility);
    if(lolMetricOrder) store.set('lolMetricOrder', lolMetricOrder);
    store.set('statsConfig', statsConfig);
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

  // uBlock (manual on-demand only)
  const UBLOCK_DIR = path.join(__dirname,'..','..','ublock');
  function maybeInstallUblock(view, host){
    try {
      if(!view||!host) return; if(!fs.existsSync(UBLOCK_DIR)) return;
      const sess = view.webContents.session; if(!sess || sess.__ublockLoaded) return;
      const loader = (sess.extensions && sess.extensions.loadExtension) ? (p)=> sess.extensions.loadExtension(p,{allowFileAccess:true}) : (p)=> sess.loadExtension(p,{ allowFileAccess:true });
      sess.__ublockLoaded = 'pending';
      loader(UBLOCK_DIR).then(ext=>{ sess.__ublockLoaded=true; try { sess.__ublockExtInfo=ext; } catch(_){ } }).catch(()=>{ try { sess.__ublockLoaded=false; } catch(_){ } });
    } catch(_){}
  }

  function layout(){
    if(!embeddedActive) return;
    if(!mainWindow || mainWindow.isDestroyed()) return;
    if(!views.panel) return;
    const full = mainWindow.getContentBounds();
    const stage = stageBoundsRef && stageBoundsRef.value ? stageBoundsRef.value : full;
    if(!embedOffsetY) embedOffsetY = stage.y || 0;
    const baseY = embedOffsetY;
    const h = full.height - baseY;
    const panelX = side==='left'?0:(full.width - PANEL_WIDTH);
    const contentX = side==='left'? PANEL_WIDTH:0;
    const contentW = full.width - PANEL_WIDTH;
    try { views.panel.setBounds({ x:panelX, y:baseY, width:PANEL_WIDTH, height:h }); } catch(_){}
    const setSafe=(v,r)=>{ if(v) try { v.setBounds(r); } catch(_){ } };
    if(mode==='split'){
      const hHalf = Math.floor((h-GAP)/2);
      setSafe(views.A,{ x:contentX,y:baseY,width:contentW,height:hHalf });
      setSafe(views.B,{ x:contentX,y:baseY+hHalf+GAP,width:contentW,height:h-hHalf-GAP });
    } else if(mode==='focusA'){
      setSafe(views.A,{ x:contentX,y:baseY,width:contentW,height:h });
      setSafe(views.B,{ x:contentX,y:baseY,width:0,height:0 });
    } else if(mode==='focusB'){
      setSafe(views.A,{ x:contentX,y:baseY,width:0,height:0 });
      setSafe(views.B,{ x:contentX,y:baseY,width:contentW,height:h });
    } else if(mode==='vertical'){
      const wHalf = Math.floor((contentW-GAP)/2);
      setSafe(views.A,{ x:contentX,y:baseY,width:wHalf,height:h });
      setSafe(views.B,{ x:contentX+wHalf+GAP,y:baseY,width:contentW-wHalf-GAP,height:h });
    }
  }
  function setMode(m){ if(['split','focusA','focusB','vertical'].includes(m)){ mode=m; persist(); layout(); } }
  function toggleSide(){ side = side==='left'?'right':'left'; persist(); layout(); }

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
  function attachContextMenu(view,label){ if(!view || view.__statsCtxMenuAttached) return; view.__statsCtxMenuAttached=true; view.webContents.on('context-menu',(e,params)=>{ try { const template=[]; const nav=view.webContents.navigationHistory; const canBack= nav? nav.canGoBack(): (view.webContents.canGoBack && view.webContents.canGoBack()); const canFwd= nav? nav.canGoForward(): (view.webContents.canGoForward && view.webContents.canGoForward()); if(canBack) template.push({ label:'Back', click:()=>{ try { nav? nav.goBack(): view.webContents.goBack(); } catch(_){ } } }); if(canFwd) template.push({ label:'Forward', click:()=>{ try { nav? nav.goForward(): view.webContents.goForward(); } catch(_){ } } }); template.push({ label:'Reload', click:()=>{ try { view.webContents.reload(); } catch(_){ } } }); try { const curUrl=view.webContents.getURL(); if(curUrl) template.push({ label:'Copy Page URL', click:()=>{ try { clipboard.writeText(curUrl); } catch(_){ } } }); } catch(_){ } if(params.linkURL) template.push({ label:'Copy Link URL', click:()=>{ try { clipboard.writeText(params.linkURL); } catch(_){ } } }); template.push({ type:'separator' }); if(params.isEditable) template.push({ role:'cut' }); template.push({ role:'copy' }); if(params.isEditable) template.push({ role:'paste' }); template.push({ role:'selectAll' }); template.push({ type:'separator' }); template.push({ label:'Open DevTools', click:()=>{ try { view.webContents.openDevTools({ mode:'detach' }); } catch(_){ } } }); if(typeof params.x==='number' && typeof params.y==='number') template.push({ label:'Inspect Element', click:()=>{ try { view.webContents.inspectElement(params.x, params.y); } catch(_){ } } }); template.push({ type:'separator' }); const sess=view.webContents.session; const stateRaw=sess && sess.__ublockLoaded; if(stateRaw){ template.push({ label:'uBlock: '+(stateRaw===true?'loaded': stateRaw==='pending'?'loading…':'not loaded'), enabled:false }); } if(!stateRaw) template.push({ label:'Enable uBlock', click:()=>{ try { const host=new URL(view.webContents.getURL()).hostname; maybeInstallUblock(view,host); } catch(_){ } } }); template.push({ type:'separator' }); template.push({ label:'Stats Slot: '+(label||'?'), enabled:false }); const menu=Menu.buildFromTemplate(template); menu.popup({ window: mainWindow }); } catch(err){ try { console.warn('[stats][ctxmenu] build fail', err.message); } catch(_){ } } }); }

  // --- Capture ----------------------------------------------------------------------------
  async function captureSlot(slot, roiPct){ try { const view=views[slot]; if(!view) throw new Error('view-missing'); const bounds=view.getBounds(); const r=Object.assign({ x:0,y:0,w:1,h:0.16 }, roiPct||{}); const clip={ x:Math.max(0,Math.floor(bounds.width*r.x)), y:Math.max(0,Math.floor(bounds.height*r.y)), width:Math.max(10,Math.floor(bounds.width*r.w)), height:Math.max(10,Math.floor(bounds.height*r.h)) }; const img=await view.webContents.capturePage(clip); const png=img.toPNG(); return { ok:true, slot, clip, width:clip.width, height:clip.height, pngBase64: png.toString('base64') }; } catch(err){ return { ok:false, error: err.message||String(err) }; } }

  // --- Embedded lifecycle ----------------------------------------------------------------
  function createEmbedded(offsetY){ if(embeddedActive) return; if(!mainWindow||mainWindow.isDestroyed()) return; const fresh = !(views.panel && views.A && views.B); if(fresh){ views.panel=new BrowserView({ webPreferences:{ partition:'persist:statsPanel', contextIsolation:false, nodeIntegration:true } }); views.A=new BrowserView({ webPreferences:{ partition:'persist:statsA', contextIsolation:true, sandbox:false, preload:path.join(__dirname,'..','..','statsContentPreload.js') } }); views.B=new BrowserView({ webPreferences:{ partition:'persist:statsB', contextIsolation:true, sandbox:false, preload:path.join(__dirname,'..','..','statsContentPreload.js') } }); try { mainWindow.addBrowserView(views.panel); mainWindow.addBrowserView(views.A); mainWindow.addBrowserView(views.B); } catch(_){ } attachContextMenu(views.A,'A'); attachContextMenu(views.B,'B'); attachContextMenu(views.panel,'Panel'); try { views.panel.webContents.loadFile(path.join(__dirname,'..','..','renderer','stats_panel.html')); } catch(_){ } views.panel.webContents.on('did-finish-load',()=>{ try { const hb=store.get('gsHeatBar'); views.panel.webContents.send('stats-init',{ urls, mode, side, lolManualMode, lolMetricVisibility, lolMetricOrder, gsHeatBar:hb, statsConfig }); if(hb) views.panel.webContents.send('gs-heatbar-apply', hb); } catch(_){ } }); resolveAndLoad(views.A, urls.A); resolveAndLoad(views.B, urls.B); attachNavTracking('A', views.A); attachNavTracking('B', views.B); }
    embeddedActive=true; embedOffsetY = typeof offsetY==='number'? offsetY: embedOffsetY; layout(); setTimeout(layout,60); }
  function destroyEmbedded(force){ if(!embeddedActive && !force) return; if(embeddedActive){ ['A','B','panel'].forEach(k=>{ const v=views[k]; if(v) try { v.setBounds({ x:0,y:0,width:10,height:10 }); } catch(_){ } }); } if(force){ ['A','B','panel'].forEach(k=>{ const v=views[k]; if(v) try { v.webContents.destroy(); } catch(_){ } }); } embeddedActive=false; }
  function detachToWindow(){ /* noop (removed) */ }
  function handleStageResized(){ if(embeddedActive){ try { const sy = stageBoundsRef && stageBoundsRef.value? Number(stageBoundsRef.value.y): embedOffsetY; if(!isNaN(sy) && sy!==embedOffsetY) embedOffsetY=sy; } catch(_){ } layout(); } }
  function ensureTopmost(){ if(!embeddedActive) return; if(!mainWindow||mainWindow.isDestroyed()) return; if(typeof mainWindow.setTopBrowserView!=='function') return; ['A','B','panel'].forEach(k=>{ const v=views[k]; if(v) try { mainWindow.setTopBrowserView(v); } catch(_){ } }); }

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
      case 'stats-reload-slot':
        try { const slot=payload && payload.slot; if(['A','B'].includes(slot)){ const v=views[slot]; if(v) try { v.webContents.reloadIgnoringCache(); } catch(_){ try { v.webContents.reload(); } catch(_2){} } } } catch(_){}
        break;
      case 'stats-capture-slot':
        try { if(payload && ['A','B'].includes(payload.slot)){ captureSlot(payload.slot, payload.roi).then(res=>{ if(views.panel) try { views.panel.webContents.send('stats-capture-result',{ slot:payload.slot, result:res }); } catch(_){ } }); } } catch(_){}
        break;
      case 'stats-save-credentials':
        try { const { slot, username, password } = payload||{}; if(slot && username){ const v=views[slot]; if(v){ const host=new URL(v.webContents.getURL()).hostname; const all=store.get('siteCredentials')||{}; all[host]={ username,password }; store.set('siteCredentials',all); v.webContents.send('apply-credentials',{ hostname:host, username, password }); if(views.panel) views.panel.webContents.send('stats-credentials-status',{ slot, hostname:host, has:true, username }); } } } catch(_){}
        break;
      case 'lol-stats-settings':
        if(payload){ if(typeof payload.manualMode==='boolean') lolManualMode=payload.manualMode; if(payload.metricVisibility) lolMetricVisibility={ ...lolMetricVisibility, ...payload.metricVisibility }; if(Array.isArray(payload.metricOrder)) lolMetricOrder=payload.metricOrder.slice(); persist(); }
        break;
      case 'stats-config-set':
        try { if(payload && typeof payload==='object'){ Object.keys(payload).forEach(k=>{ if(k in statsConfig) statsConfig[k]=payload[k]; }); persist(); if(views.panel) views.panel.webContents.send('stats-config-applied', statsConfig); } } catch(_){}
        break;
    }
  }

  // Public API (open kept as noop for backward compatibility)
  return { open: ()=>{}, handleIpc, views, createEmbedded, destroyEmbedded, detachToWindow, handleStageResized, ensureTopmost, captureSlot, setUrl, getMode:()=>mode, getSide:()=>side, maybeInstallUblock };
}

module.exports = { createStatsManager };

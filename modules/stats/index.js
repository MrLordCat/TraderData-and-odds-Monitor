// Stats window manager: two switchable content BrowserViews (A,B) plus panel (UI + future game stats)
// Supports layout modes: split, focusA, focusB and panel side left/right.

const { BrowserWindow, BrowserView } = require('electron');
const { ensureSingleClosedListener, hideView } = require('../utils/views');
const path = require('path');

function createStatsManager({ store, mainWindow, stageBoundsRef, quittingRef }) {
  // (ensureSingleClosedListener now imported from utils/views.js)
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
  let views = { A: null, B: null, panel: null }; // CURRENT active view set (embedded or window)
  const embeddedViews = views; // persistent embedded set
  let embeddedInitialized = false; // tracks initial addBrowserView of embedded set
  let windowViews = null; // { A,B,panel } when in window mode
  const DEFAULT_URLS = { A: 'https://portal.grid.gg', B: 'https://www.twitch.tv' };
  const urls = Object.assign({}, DEFAULT_URLS, store.get('statsUrls', {}));
  let mode = store.get('statsLayoutMode', 'split'); // 'split' | 'focusA' | 'focusB' | 'vertical'
  let side = store.get('statsPanelSide', 'right'); // 'left' | 'right'
  // Direct constants import to avoid circular dependency via parent barrel
  const { STATS_PANEL_WIDTH: PANEL_WIDTH } = require('../utils/constants');
  const GAP = 4;

    // --- Conditional uBlock Origin integration (stats only) ----------------------------------
    // Причина доработки: прямое раннее подключение расширения ломало загрузку YouTube во втором слоте.
    // Здесь загружаем uBlock лениво ПОСЛЕ первой навигации и только для хостов, где хотим блокировать рекламу.
    // Видео-платформы (YouTube, Twitch) исключаем, чтобы не нарушать их работу.
    // Переключатель хранится в store ключ 'statsUblockEnabled' (default: true). Можно позже сделать UI.
    const fs = require('fs');
    const UBLOCK_DIR = path.join(__dirname, '..', '..', 'ublock');
    // Упрощённая модель: НЕ грузим автоматически. Загружается только при выборе в контекстном меню.
    // Храним глобальный флаг одного запуска (если когда-то загружали в этой сессии — повторно не логируем лишнее).
    const UBLOCK_AUTO_DISABLED = true; // семантическая метка
    const UBLOCK_EXCLUDE = new Set(); // не используем теперь, оставлено для совместимости
  // При упрощении логики переменная UBLOCK_ALLOW была удалена, но ниже в контекстном меню осталась ссылка.
  // Это вызывало ReferenceError внутри try{} и блок uBlock не добавлялся в меню.
  // Восстанавливаем пустой набор (для совместимости) — теперь меню снова работает.
  const UBLOCK_ALLOW = new Set();
    // Runtime overrides (в текущей сессии пользователь может форсировать загрузку для хоста)
    const ublockHostOverrides = new Set();
    function maybeInstallUblock(view, host, opts={}){
      try {
        const force = true; // теперь всегда force т.к. только вручную
        if(!view || !view.webContents) return;
        if(!host) return; // подождём пока будет известен
        const canon = host.toLowerCase();
        // Списки allow/deny больше не применяются — всегда можно загрузить вручную
        if(!fs.existsSync(UBLOCK_DIR)) { try { console.warn('[stats][ublock] dir missing', UBLOCK_DIR); } catch(_){ } return; }
        const sess = view.webContents.session;
        if(!sess || sess.__ublockLoaded) return;
        // Electron >= 32: session.extensions.loadExtension; старый API deprecated.
        const loader = (sess.extensions && sess.extensions.loadExtension) ? (p)=> sess.extensions.loadExtension(p, { allowFileAccess:true }) : (p)=> sess.loadExtension(p, { allowFileAccess:true });
        sess.__ublockLoaded = 'pending';
        loader(UBLOCK_DIR).then(ext=>{
          sess.__ublockLoaded = true;
          try { sess.__ublockExtInfo = ext; } catch(_){ }
          // sess.getPartition() is not available in newer Electron; just log presence of session
          try { console.log('[stats][ublock] loaded (session ok)', 'ext=', ext && ext.name, force? '[forced]':'' ); } catch(_){ }
        }).catch(err=>{ sess.__ublockLoaded=false; try { console.warn('[stats][ublock] load fail', err.message); } catch(_){ } });
      } catch(e){ try { console.warn('[stats][ublock] exception', e.message); } catch(_){ } }
    }

  // Additional persisted settings for LoL stats panel
  // Manual mode no longer persisted between sessions; always start disabled (false)
  let lolManualMode = false;
  let lolMetricVisibility = store.get('lolMetricVisibility', {}); // metric -> true (visible)
  let lolMetricOrder = store.get('lolMetricOrder', null); // array or null
  // (Removed legacy LoL panel animation settings)
  const DEFAULT_STATS_CONFIG = { animationsEnabled:true, animationDurationMs:450, animationScale:1, animationPrimaryColor:'#3b82f6', animationSecondaryColor:'#f59e0b', heatBarOpacity:0.55, winLoseEnabled:true };
  let statsConfig = Object.assign({}, DEFAULT_STATS_CONFIG, store.get('statsConfig', {}));

  function persist() {
    store.set('statsUrls', urls);
    store.set('statsLayoutMode', mode);
    store.set('statsPanelSide', side);
    // lolManualMode intentionally NOT persisted (session-only)
  store.set('lolMetricVisibility', lolMetricVisibility);
  if(lolMetricOrder) store.set('lolMetricOrder', lolMetricOrder);
  store.set('statsConfig', statsConfig);
  // (Animation settings no longer persisted)
  }

  // One-time legacy key purge (animation settings removed)
  try {
    if(store.has && store.has('lolAnimEnabled')) { try { store.delete('lolAnimEnabled'); } catch(_){} }
    if(store.has && store.has('lolAnimDurationMs')) { try { store.delete('lolAnimDurationMs'); } catch(_){} }
  } catch(_){}

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
        const credsAll = store.get('siteCredentials') || {};
        const host = new URL(cur).hostname;
        const ch = canonicalHost(host);
        const creds = credsAll[host] || credsAll[ch];
        // Пытаемся загрузить uBlock (once per session) после того как определили host
        try { maybeInstallUblock(view, ch); } catch(_){ }
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
  }

  // --- Context menu support (right-click) ONLY for stats views ------------------------------
  const { Menu } = require('electron');
  function attachContextMenu(view, label){
    try {
      if(!view || view.__statsCtxMenuAttached) return;
      view.__statsCtxMenuAttached = true;
      view.webContents.on('context-menu', (e, params)=>{
        try {
          const template = [];
          // Updated for Electron deprecations: prefer navigationHistory API, fallback to legacy
          const nav = view.webContents.navigationHistory;
          const canBack = nav ? nav.canGoBack() : (typeof view.webContents.canGoBack==='function' && view.webContents.canGoBack());
          const canFwd  = nav ? nav.canGoForward() : (typeof view.webContents.canGoForward==='function' && view.webContents.canGoForward());
          if(canBack) template.push({ label:'Back', click:()=>{ try { nav? nav.goBack(): view.webContents.goBack(); } catch(_){} } });
          if(canFwd) template.push({ label:'Forward', click:()=>{ try { nav? nav.goForward(): view.webContents.goForward(); } catch(_){} } });
          // Custom stack restore (when we open extension pages inside slot and want to return)
          if(Array.isArray(view.__navStack) && view.__navStack.length){
            template.push({ label:'Return to Previous (Slot)', click:()=>{ try { const prev=view.__navStack.pop(); if(prev) view.webContents.loadURL(prev); } catch(_){} } });
          }
          template.push({ label:'Reload', click:()=>{ try { view.webContents.reload(); } catch(_){} } });
          try { const curUrl=view.webContents.getURL(); if(curUrl) template.push({ label:'Copy Page URL', click:()=>{ try { require('electron').clipboard.writeText(curUrl); } catch(_){} } }); } catch(_){}
          if(params.linkURL) template.push({ label:'Copy Link URL', click:()=>{ try { require('electron').clipboard.writeText(params.linkURL); } catch(_){} } });
          template.push({ type:'separator' });
          if(params.isEditable) template.push({ role:'cut' });
          template.push({ role:'copy' });
          if(params.isEditable) template.push({ role:'paste' });
          template.push({ role:'selectAll' });
          template.push({ type:'separator' });
          template.push({ label:'Open DevTools', click:()=>{ try { view.webContents.openDevTools({ mode:'detach' }); } catch(_){} } });
          if(typeof params.x==='number' && typeof params.y==='number') template.push({ label:'Inspect Element', click:()=>{ try { view.webContents.inspectElement(params.x, params.y); } catch(_){} } });
          template.push({ type:'separator' });
          // uBlock status/actions
          try {
            const curUrl = view.webContents.getURL();
            let host=null; try { host=new URL(curUrl).hostname; } catch(_e){}
            const sess = view.webContents.session;
            if(sess){
              const stateRaw = sess.__ublockLoaded;
              const loaded = stateRaw === true;
              const pending = stateRaw === 'pending';
              const canon = (host||'').toLowerCase();
              const excluded = UBLOCK_EXCLUDE.has(canon);
              const allowed = UBLOCK_ALLOW.has(canon);
              const overridden = ublockHostOverrides.has(canon);
              let statusLabel;
              if(loaded) statusLabel='loaded';
              else if(pending) statusLabel='loading…';
              else statusLabel='not loaded';
              template.push({ label:'uBlock: '+statusLabel, enabled:false });
              if(!loaded && !pending){
                template.push({ label:'Enable uBlock for this slot', click:()=>{ try { maybeInstallUblock(view, canon, { force:true }); } catch(_e2){} } });
              } else if(loaded){
                template.push({ label:'Re-run uBlock Self Test', click:()=>{ try { runUblockSelfTest(view); } catch(_e3){} } });
                // --- Rich interaction submenu (simulate extension toolbar) ---
                try {
                  const extInfo = sess.__ublockExtInfo || {}; // { id, name, ... }
                  const extId = extInfo.id; // chrome-extension id if available
                  const hasId = !!extId;
                  function injectUblockContrast(webc){
                    try {
                      if(!webc || webc.__ublockContrastHooked) return; webc.__ublockContrastHooked=true;
                      const injectJS = `(function(){ if(window.__ublockContrastPatched) return; window.__ublockContrastPatched=true; try { var st=document.createElement('style'); st.id='__ublock_contrast_patch'; st.textContent = `+
                        JSON.stringify(`html,body{color:#dadfe6 !important; background:#0b0e11 !important;}
                        body *:not(svg):not(path){color:#d2d6dc !important;}
                        a{color:#85baff !important;}
                        input,select,textarea{background:#1b2229 !important; color:#f1f4f7 !important; border:1px solid #3a4654 !important;}
                        .button, button{color:#f2f5f7 !important; background:#25303a !important; border:1px solid #445366 !important;}
                        .button:hover, button:hover{background:#314050 !important;}
                        ::placeholder{color:#88919b !important;} .mdl-switch__label{color:#d0d5db !important;}
                        table{color:#dce2e8 !important;} .tabButton{color:#e2e8ee !important;} .tabButton.selected{background:#1f2730 !important;}
                        #dashboard-nav a{color:#dfe7ff !important;} .notice, .modal{background:#182028 !important; color:#d9dde2 !important;}
                        .checkbox input:checked+span:before{background:#3d79d2 !important; border-color:#3d79d2 !important;}`)+
                        `; document.documentElement.appendChild(st); }catch(e){ console.warn('[ublock-contrast] inject fail', e.message); } })();`;
                      const hook = ()=>{ try { webc.executeJavaScript(injectJS).catch(()=>{}); } catch(_){ } };
                      webc.on('did-finish-load', hook);
                    } catch(_){ }
                  }
                  function injectUblockDashboardFallback(webc){
                    try {
                      if(!webc) return;
                      // Attach after each load: if dashboard stays 'notReady' too long due to missing background messaging, stub it.
                      const script = '(()=>{\n'
                        +
                        ' if(window.__ubDashFallbackInstalled) return; window.__ubDashFallbackInstalled=true;\n'+
                        " const STUB_USER_SETTINGS={ advancedUserEnabled:false, uiTheme:'dark', uiAccentCustom:false, uiAccentCustom0:'#3d79d2', prefetchingDisabled:true, hyperlinkAuditingDisabled:true, webrtcIPAddressHidden:true, largeMediaSize:5000, collapseBlocked:true };\n"+
                        " const STUB_LOCAL_DATA={ storageUsed:0, lastBackupFile:'', lastRestoreFile:'', cloudStorageSupported:false, privacySettingsSupported:true, lastBackupTime:Date.now(), lastRestoreTime:Date.now() };\n"+
                        " function patchMessaging(vAPI){ if(!vAPI||!vAPI.messaging||typeof vAPI.messaging.send!=='function'||vAPI.messaging.__stubbed) return; const orig=vAPI.messaging.send.bind(vAPI.messaging); vAPI.messaging.__stubbed=true; vAPI.messaging.send=function(channel,msg){ try { if(channel==='dashboard'&&msg){ switch(msg.what){ case 'readyToFilter': return Promise.resolve(true); case 'dashboardConfig': return Promise.resolve({ noDashboard:false }); case 'userSettings': return Promise.resolve(STUB_USER_SETTINGS); case 'getLocalData': return Promise.resolve(STUB_LOCAL_DATA); case 'backupUserData': return Promise.resolve({ userData:{ userSettings:STUB_USER_SETTINGS, whitelist:[], filterLists:{} }, localData:STUB_LOCAL_DATA }); case 'restoreUserData': return Promise.resolve({ ok:true }); case 'resetUserData': return Promise.resolve({ ok:true }); } } } catch(e){} return orig(channel,msg); }; }\n"+
                        " function injectContrast(doc){ try { if(!doc||doc.getElementById('__ubo_iframe_contrast')) return; const st=doc.createElement('style'); st.id='__ubo_iframe_contrast'; st.textContent='html,body{background:#0b0e11 !important; color:#dbe1e7 !important;} body *:not(svg):not(path){color:#d7dde3 !important;} a{color:#88bdff !important;} input,select,textarea{background:#1c242c !important; color:#f2f6fa !important; border:1px solid #3e4b58 !important;} .tabButton,button{color:#e6ecf2 !important;} ::placeholder{color:#889099 !important;} .checkbox label,.checkbox span{color:#ccd2d8 !important;}'; doc.documentElement.appendChild(st);} catch(_){ } }\n"+
                        " function patchIframe(w){ try { patchMessaging(w.vAPI); injectContrast(w.document); if(!w.__uboPatchedOnce){ w.__uboPatchedOnce=true; try { // pre-inject globals expected by settings.js to avoid null accesses\n"+
                        "   w.STUB_USER_SETTINGS && (w.__userSettings = STUB_USER_SETTINGS); } catch(_){ } } } catch(_){ } }\n"+
                        " const rescueNav=()=>{ try { const iframe=document.getElementById('iframe'); if(!iframe) return; const btns=Array.from(document.querySelectorAll('.tabButton')); if(!btns.length) return; btns.forEach(b=>{ b.addEventListener('click', ()=>{ try { const pane=b.getAttribute('data-pane'); if(!pane) return; iframe.src=pane; btns.forEach(x=>x.classList.remove('selected')); b.classList.add('selected'); if(!location.hash || location.hash.slice(1)!==pane) location.hash='#'+pane; } catch(_){ } }); }); const first=document.querySelector('.tabButton[data-pane=\"settings.html\"]')||btns[0]; if(first){ first.click(); } console.warn('[ublock-dashboard-fallback] minimal nav wired'); iframe.addEventListener('load', ()=>{ try { const w=iframe.contentWindow; if(!w) return; patchIframe(w); } catch(_){ } }); } catch(e){ console.warn('[ublock-dashboard-fallback] rescueNav err', e.message); } };\n"+
                        " const apply=()=>{ try { const path=(location.pathname||'')+location.hash; if(path.indexOf('dashboard.html')===-1) return; const body=document.body; if(!body) return; if(!body.classList.contains('notReady')) return; if(!(window.vAPI && vAPI.messaging && typeof vAPI.messaging.send==='function')) { console.warn('[ublock-dashboard-fallback] vAPI.messaging missing; using manual nav'); body.classList.remove('notReady'); rescueNav(); return; } patchMessaging(vAPI); body.classList.remove('notReady'); if(!location.hash){ location.hash='#settings.html'; } setTimeout(()=>{ try { if(!document.querySelector('.tabButton.selected')) rescueNav(); } catch(_){ } },80); console.warn('[ublock-dashboard-fallback] applied stub (no background response)'); } catch(e){ console.warn('[ublock-dashboard-fallback] error', e.message); } };\n"+
                        " setTimeout(apply,1200); setTimeout(apply,2400); setTimeout(apply,4000);\n"+
                        '})();';
                      const hook=()=>{ try { webc.executeJavaScript(script).catch(()=>{}); } catch(_){ } };
                      webc.on('did-finish-load', hook);
                    } catch(_){ }
                  }
                  function openExtPage(page, target){
                    try {
                      if(!hasId){ // fallback: open local file path
                        // Special handling: dashboard.html in local-file mode is broken (needs background messaging). Use our stub.
                        if(page==='dashboard.html'){
                          const stub = require('path').join(__dirname,'..','..','renderer','ublock_dashboard_stub.html');
                          if(target==='window') {
                            const { BrowserWindow } = require('electron');
                            const w = new BrowserWindow({ width:1100,height:760, title:'uBlock — Dashboard (Stub)', autoHideMenuBar:true, backgroundColor:'#0b0e11', webPreferences:{ session: sess } });
                            w.loadFile(stub).catch(()=>{});
                          } else {
                            try { view.__navStack = view.__navStack || []; const cur=view.webContents.getURL(); if(cur) view.__navStack.push(cur); } catch(_){}
                            view.webContents.loadFile(stub).catch(()=>{});
                          }
                          return;
                        }
                        const full = require('path').join(UBLOCK_DIR, page);
                        if(target==='window') {
                          const { BrowserWindow } = require('electron');
                          // Reuse underlying session directly instead of deprecated getPartition()
                          const w = new BrowserWindow({ width:820,height:700, title:'uBlock '+page, autoHideMenuBar:true, backgroundColor:'#0d0f13', webPreferences:{ session: sess } });
                          injectUblockContrast(w.webContents);
                          // (dashboard fallback disabled for local-file; stub used instead)
                          w.loadFile(full).catch(()=>{});
                        } else {
                          // Maintain manual history stack so user can return
                          try { view.__navStack = view.__navStack || []; const cur=view.webContents.getURL(); if(cur) view.__navStack.push(cur); } catch(_eStack){}
                          injectUblockContrast(view.webContents);
                          // (dashboard fallback disabled for local-file; stub used instead)
                          view.webContents.loadFile(full).catch(()=>{});
                        }
                        return;
                      }
                      const url = 'chrome-extension://'+extId+'/'+page;
                      if(target==='window') {
                        const { BrowserWindow } = require('electron');
                        const w = new BrowserWindow({ width:820,height:700,title:'uBlock '+page, autoHideMenuBar:true, backgroundColor:'#0d0f13', webPreferences:{ session: sess } });
                        injectUblockContrast(w.webContents);
                        if(page==='dashboard.html'){ injectUblockDashboardFallback(w.webContents); w.webContents.once('did-finish-load', ()=>{ try { w.webContents.openDevTools({ mode:'detach' }); } catch(_){ } }); }
                        w.loadURL(url).catch(()=>{});
                      } else {
                        try { view.__navStack = view.__navStack || []; const cur=view.webContents.getURL(); if(cur) view.__navStack.push(cur); } catch(_e2){}
                        injectUblockContrast(view.webContents);
                        if(page==='dashboard.html') injectUblockDashboardFallback(view.webContents);
                        view.webContents.loadURL(url).catch(()=>{});
                      }
                    } catch(err){ try { console.warn('[stats][ublock] open page fail', page, err.message); } catch(_){} }
                  }
                  const ublockPages = [
                    { label:'Dashboard', file:'dashboard.html' },
                    { label:'Settings', file:'settings.html' },
                    { label:'My Filters (1P)', file:'1p-filters.html' },
                    { label:'Filter Lists (3P)', file:'3p-filters.html' },
                    { label:'Logger', file:'logger-ui.html' }
                  ];
                  template.push({
                    label:'uBlock Pages',
                    submenu: ublockPages.map(p=>({
                      label:p.label,
                      submenu:[
                        { label:'Open in Slot', click:()=> openExtPage(p.file,'slot') },
                        { label:'Open in Window', click:()=> openExtPage(p.file,'window') }
                      ]
                    }))
                  });
                } catch(_){ }
              } else {
                template.push({ label:'Self Test (wait loading)', enabled:false });
              }
              if(!loaded) template.push({ label:'uBlock: Self Test (may show partial)', click:()=>{ try { runUblockSelfTest(view); } catch(_e4){} } });
              template.push({ type:'separator' });
            }
          } catch(_){ }
          template.push({ label:'Stats Slot: '+(label||'?'), enabled:false });
          const menu = Menu.buildFromTemplate(template);
          menu.popup({ window: (statsWindow && !statsWindow.isDestroyed()) ? statsWindow : (mainWindow && !mainWindow.isDestroyed()? mainWindow: undefined) });
        } catch(err){ try { console.warn('[stats][ctxmenu] build fail', err.message); } catch(_){} }
      });
    } catch(e){ try { console.warn('[stats][ctxmenu] attach error', e.message); } catch(_){} }
  }
  // Dedicated self-test helper (shared by menus)
  function runUblockSelfTest(view){
    try {
      const js = "(async ()=>{ const tests=["+
        "'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js',"+
        "'https://ad.doubleclick.net/ddm/adj/N123.test/abc;sz=1x1;ord=' + Math.random(),"+
        "'https://static.doubleclick.net/exchange/async_sra.html'"+
      "]; console.log('[ublock-test] start –', tests.length,'requests'); for(const u of tests){ const t0=performance.now(); try { const r = await fetch(u, { mode:'no-cors', cache:'no-store' }); console.log('[ublock-test]', u, 'OK/opaque status=', r.status||'(opaque)', 'elapsed', (performance.now()-t0).toFixed(1)+'ms'); } catch(err){ console.warn('[ublock-test][blocked?]', u, err.message); } } try { const exts = (window.chrome && chrome.runtime && chrome.runtime.getManifest)? '[manifest] '+chrome.runtime.getManifest().name : '(no extension manifest from page context)'; console.log('[ublock-test] manifest probe', exts); } catch(_e){} console.log('[ublock-test] done'); })();";
      view.webContents.executeJavaScript(js).catch(()=>{});
    } catch(e){ try { console.warn('[stats][ublock-test] exec error', e.message); } catch(_){ } }
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
  ensureSingleClosedListener(statsWindow, 'statsWindow-null-reset', ()=>{ statsWindow=null; });
    views.panel = new BrowserView({ webPreferences: { partition: 'persist:statsPanel', contextIsolation: false, nodeIntegration: true } });
    statsWindow.addBrowserView(views.panel);
    try { views.panel.webContents.loadFile(path.join(__dirname,'..','..','renderer','stats_panel.html')); } catch(_){ }
    views.panel.webContents.on('did-finish-load', ()=>{
      try {
        const hb = store.get('gsHeatBar');
  views.panel.webContents.send('stats-init', { urls, mode, side, lolManualMode, lolMetricVisibility, lolMetricOrder, gsHeatBar: hb, statsConfig });
  if(hb) views.panel.webContents.send('gs-heatbar-apply', hb);
        // Inject lightweight console tap to pipe logs through stats-debug channel
  try { views.panel.webContents.executeJavaScript('(function(){ if(window.__logTapInstalled) return; window.__logTapInstalled=true; const origLog=console.log, origErr=console.error, origWarn=console.warn; function wrap(kind, fn){ return function(){ try { const args=[...arguments].map(a=> typeof a===\'object\'? JSON.stringify(a): String(a)); require(\'electron\').ipcRenderer.send(\'stats-debug\',{ tap:kind, msg: args.join(\' \')}); } catch(_){ } try { return fn.apply(this, arguments); } catch(_2){ } }; } console.log=wrap(\'log\',origLog); console.warn=wrap(\'warn\',origWarn); console.error=wrap(\'err\',origErr); console.log(\'[logTap] installed\'); })();').catch(()=>{}); } catch(_){ }
        // Forward embedded autoSim logs (panel variant) to main terminal
  try { views.panel.webContents.executeJavaScript('(function(){ if(window.__autoSimFwdInstalled) return; window.__autoSimFwdInstalled=true; const { ipcRenderer }=require(\'electron\'); const lv=[\'log\',\'warn\',\'error\']; const orig={}; function match(args){ try { return /\\\\[autoSim\\\\]\\\\[embedded\\\\]/.test(args.map(a=>\'\'+a).join(\' \')); } catch(_){ return false; } } lv.forEach(k=>{ orig[k]=console[k].bind(console); console[k]=function(){ try{ orig[k].apply(console, arguments);}catch(_){ } try{ if(match(Array.from(arguments))){ ipcRenderer.send(\'renderer-log-forward\',{ level:k, args:Array.from(arguments).map(v=> typeof v===\'string\'? v: (v&&v.message)||String(v))}); } }catch(_2){} }; }); console.log(\'[autoSimFwd][embedded][panel] installed\'); })();').catch(()=>{}); } catch(_){ }
        // Sentinel diagnostics
  try { views.panel.webContents.executeJavaScript('setTimeout(()=>{ try { const rows=document.querySelectorAll(\'#lt-body tr\').length; console.log(\'[panel-sentinel] rowsAfterInit\', rows); } catch(e){} }, 400);').catch(()=>{}); } catch(_){ }
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
  // Context menus
  attachContextMenu(views.A, 'A');
  attachContextMenu(views.B, 'B');
  attachContextMenu(views.panel, 'Panel');
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
      case 'stats-capture-slot':
        try {
          if(payload && ['A','B'].includes(payload.slot)){
            captureSlot(payload.slot, payload.roi).then(async res=>{
              if(res.ok && payload.slot==='B'){
                // Attempt OCR (kills only phase)
                try {
                  const { extractKillsFromScoreboard } = require('../ocr/scoreboard');
                  const ocr = await extractKillsFromScoreboard({ pngBase64: res.pngBase64, width: res.width, height: res.height });
                  res.ocr = ocr;
                } catch(err){ res.ocr = { ok:false, error: err.message||String(err) }; }
              }
              if(views.panel){ try { views.panel.webContents.send('stats-capture-result', { slot: payload.slot, result: res }); } catch(_){ } }
            });
          }
        } catch(_){ }
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
        // (animation settings ignored)
        persist();
        break;
      case 'stats-config-set':
        try {
          if(payload && typeof payload==='object'){
            Object.keys(payload).forEach(k=>{ if(k in statsConfig) statsConfig[k]=payload[k]; });
            persist();
            if(views.panel){ try { views.panel.webContents.send('stats-config-applied', statsConfig); } catch(_){} }
          }
        } catch(_){}
        break;
    }
  }

  // --- Slot capture (prototype for scoreboard OCR) ---
  async function captureSlot(slot, roiPct){
    try {
      const view = views[slot]; if(!view) throw new Error('view-missing');
      const bounds = view.getBounds();
      const r = Object.assign({ x:0, y:0, w:1, h:0.16 }, roiPct||{}); // default top 16% of video
      const clip = { x: Math.max(0, Math.floor(bounds.width * r.x)), y: Math.max(0, Math.floor(bounds.height * r.y)), width: Math.max(10, Math.floor(bounds.width * r.w)), height: Math.max(10, Math.floor(bounds.height * r.h)) };
      const img = await view.webContents.capturePage(clip);
      const png = img.toPNG();
      return { ok:true, slot, clip, width:clip.width, height:clip.height, pngBase64: png.toString('base64') };
    } catch(err){ return { ok:false, error: err.message||String(err) }; }
  }
  // NOTE (2025-09 regression fix): earlier OCR integration inserted an early return here WITHOUT `views`,
  // breaking modules expecting `statsManager.views.panel` (odds, credentials status, etc.).
  // We now defer returning until end of factory so callers always receive `views` plus new APIs.

  function createEmbedded(offsetYOverride){
    // If already embedded, nothing to do
    if(embedded.active) return;
    if(!mainWindow || mainWindow.isDestroyed()) return;
    // If currently in window mode (windowViews active), tear it down and restore embedded set
    if(windowViews){
      try { if(statsWindow && !statsWindow.isDestroyed()) statsWindow.close(); } catch(_){}
      statsWindow = null;
      windowViews = null;
      views = embeddedViews;
      // Restore bounds of embedded views (they may be shrunk)
      Object.values(embeddedViews).forEach(v=>{ if(v){ try { v.setBounds({ x:0, y:0, width:10, height:10 }); } catch(_){} } });
      embedded.active = true;
      layout();
      setTimeout(layout,40);
      // Reassert z-order after window -> embedded transition
      try { ensureTopmost(); } catch(_){ }
      ;[30,120,300].forEach(d=> setTimeout(()=>{ if(embedded.active) try { ensureTopmost(); } catch(_){ } }, d));
      return;
    }
    // Standard path: embedded views not yet created
    // If we have a real statsWindow with existing views (window mode) move them instead of rebuilding
  const fresh = !(embeddedViews.panel && embeddedViews.A && embeddedViews.B);
    // Lock current stage.y as offset (or override); if reusing keep previous unless new provided
    try { embedOffsetY = (typeof offsetYOverride === 'number') ? offsetYOverride : ((stageBoundsRef && stageBoundsRef.value && Number(stageBoundsRef.value.y)) || embedOffsetY || 0); } catch(_) { embedOffsetY = 0; }
    try { console.log('[stats][embed] init offsetY', embedOffsetY, 'fresh=', fresh); } catch(_){ }
    if(fresh){
      embeddedViews.panel = new BrowserView({ webPreferences: { partition: 'persist:statsPanel', contextIsolation: false, nodeIntegration: true } });
      embeddedViews.A = new BrowserView({ webPreferences: { partition: 'persist:statsA', contextIsolation: true, sandbox: false, preload: path.join(__dirname,'..','..','statsContentPreload.js') } });
      embeddedViews.B = new BrowserView({ webPreferences: { partition: 'persist:statsB', contextIsolation: true, sandbox: false, preload: path.join(__dirname,'..','..','statsContentPreload.js') } });
      try { mainWindow.addBrowserView(embeddedViews.panel); } catch(_){ }
      try { mainWindow.addBrowserView(embeddedViews.A); } catch(_){ }
      try { mainWindow.addBrowserView(embeddedViews.B); } catch(_){ }
  // Context menus (embedded variant)
  attachContextMenu(embeddedViews.A, 'A');
  attachContextMenu(embeddedViews.B, 'B');
  attachContextMenu(embeddedViews.panel, 'Panel');
      embeddedInitialized = true;
      try { embeddedViews.panel.webContents.loadFile(path.join(__dirname,'..','..','renderer','stats_panel.html')); } catch(_){ }
      embeddedViews.panel.webContents.on('did-finish-load', ()=>{
        try {
          const hb = store.get('gsHeatBar');
          embeddedViews.panel.webContents.send('stats-init', { urls, mode, side, lolManualMode, lolMetricVisibility, lolMetricOrder, gsHeatBar: hb, statsConfig });
          if(hb) embeddedViews.panel.webContents.send('gs-heatbar-apply', hb);
          try { embeddedViews.panel.webContents.executeJavaScript(`(function(){ if(window.__autoSimFwdInstalled) return; window.__autoSimFwdInstalled=true; const { ipcRenderer }=require('electron'); const lv=['log','warn','error']; const orig={}; function match(a){ try { return /\\[autoSim\\]\\[embedded\\]/.test(a.map(x=>''+x).join(' ')); } catch(_){ return false; } } lv.forEach(k=>{ orig[k]=console[k].bind(console); console[k]=function(){ try{ orig[k].apply(console, arguments);}catch(_){ } try{ if(match(Array.from(arguments))){ ipcRenderer.send('renderer-log-forward',{ level:k, args:Array.from(arguments).map(v=> typeof v==='string'? v: (v&&v.message)||String(v))}); } }catch(_2){} }; }); console.log('[autoSimFwd][embedded][embedMode] installed'); })();`).catch(()=>{}); } catch(_){ }
        } catch(_){ }
      });
      resolveAndLoad(embeddedViews.A, urls.A); resolveAndLoad(embeddedViews.B, urls.B);
      attachNavTracking('A', embeddedViews.A); attachNavTracking('B', embeddedViews.B);
    } else {
      // On reuse: DO NOT re-add if already attached. Just restore bounds.
      try {
        const existing = mainWindow.getBrowserViews();
        if(!embeddedInitialized){
          // First reuse after some force-destroy path: attach only missing
          ['panel','A','B'].forEach(k=>{ const v=embeddedViews[k]; if(v && !existing.includes(v)){ try { mainWindow.addBrowserView(v); } catch(_){} } });
          embeddedInitialized = true;
        }
      } catch(_){ }
      Object.values(embeddedViews).forEach(v=>{ if(v){ try { v.setBounds({ x:0, y:0, width:10, height:10 }); } catch(_){} } });
    }
    embedded.active = true;
    views = embeddedViews; // switch active set
    statsWindow = { getContentBounds: ()=> mainWindow.getContentBounds(), isDestroyed:()=>false };
    layout();
  // Immediate and delayed z-order enforcement so any broker added just before embed doesn't cover panel
  try { ensureTopmost(); } catch(_){ }
  ;[10,60,180,360].forEach(d=> setTimeout(()=>{ if(embedded.active) try { ensureTopmost(); } catch(_){ } }, d));
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
      // Instead of removing BrowserViews (что порождает новые internal listeners при повторном add) — схлопываем их.
  ['A','B','panel'].forEach(k=>{ const v=embeddedViews[k]; if(v){ hideView(v); } });
    }
    if(force){
      ['A','B','panel'].forEach(k=>{ const v=embeddedViews[k]; if(v){ try { v.webContents.destroy(); } catch(_){} embeddedViews[k]=null; } });
    }
    embedded.active=false; statsWindow=null;
  }

  // Move existing embedded BrowserViews into a new detached BrowserWindow without reloading
  function detachToWindow(){
    if(!embedded.active) return; // only detach from embedded
    if(!embeddedViews.panel || !embeddedViews.A || !embeddedViews.B) return;
    // Shrink embedded views instead of removing
  ['panel','A','B'].forEach(k=>{ const v=embeddedViews[k]; if(v){ hideView(v); } });
    // Create window & separate view set
    const saved = store.get('statsBounds');
    statsWindow = new BrowserWindow({ width: saved?.width || 1400, height: saved?.height || 900, x: saved?.x, y: saved?.y, title: 'Game Stats', autoHideMenuBar: true, webPreferences: { preload: path.join(__dirname,'..','..','preload.js') } });
    statsWindow.on('close', (e)=>{
      try { store.set('statsBounds', statsWindow.getBounds()); } catch(_){ }
      const q = quittingRef && quittingRef.value;
      if(!q){ try { e.preventDefault(); } catch(_){ } try { statsWindow.hide(); } catch(_){ } return; }
    });
    ensureSingleClosedListener(statsWindow, 'statsWindow-null-reset', ()=>{ statsWindow=null; });
    windowViews = {
      panel: new BrowserView({ webPreferences: { partition: 'persist:statsPanelWin', contextIsolation: false, nodeIntegration: true } }),
      A: new BrowserView({ webPreferences: { partition: 'persist:statsAWin', contextIsolation: true, sandbox:false, preload: path.join(__dirname,'..','..','statsContentPreload.js') } }),
      B: new BrowserView({ webPreferences: { partition: 'persist:statsBWin', contextIsolation: true, sandbox:false, preload: path.join(__dirname,'..','..','statsContentPreload.js') } })
    };
    try { statsWindow.addBrowserView(windowViews.panel); } catch(_){ }
    try { statsWindow.addBrowserView(windowViews.A); } catch(_){ }
    try { statsWindow.addBrowserView(windowViews.B); } catch(_){ }
    // Context menus (window mode after detach)
    attachContextMenu(windowViews.A, 'A');
    attachContextMenu(windowViews.B, 'B');
    attachContextMenu(windowViews.panel, 'Panel');
    try { windowViews.panel.webContents.loadFile(path.join(__dirname,'..','..','renderer','stats_panel.html')); } catch(_){ }
    windowViews.panel.webContents.on('did-finish-load', ()=>{
      try {
        const hb = store.get('gsHeatBar');
        windowViews.panel.webContents.send('stats-init', { urls, mode, side, lolManualMode, lolMetricVisibility, lolMetricOrder, gsHeatBar: hb, statsConfig });
        if(hb) windowViews.panel.webContents.send('gs-heatbar-apply', hb);
        try { windowViews.panel.webContents.executeJavaScript(`(function(){ if(window.__autoSimFwdInstalled) return; window.__autoSimFwdInstalled=true; const { ipcRenderer }=require('electron'); const lv=['log','warn','error']; const orig={}; function match(a){ try { return /\\[autoSim\\]\\[embedded\\]/.test(a.map(x=>''+x).join(' ')); } catch(_){ return false; } } lv.forEach(k=>{ orig[k]=console[k].bind(console); console[k]=function(){ try{ orig[k].apply(console, arguments);}catch(_){ } try{ if(match(Array.from(arguments))){ ipcRenderer.send('renderer-log-forward',{ level:k, args:Array.from(arguments).map(v=> typeof v==='string'? v: (v&&v.message)||String(v))}); } }catch(_2){} }; }); console.log('[autoSimFwd][embedded][windowMode] installed'); })();`).catch(()=>{}); } catch(_){ }
      } catch(_){ }
    });
    resolveAndLoad(windowViews.A, urls.A); resolveAndLoad(windowViews.B, urls.B);
    attachNavTracking('A', windowViews.A); attachNavTracking('B', windowViews.B);
    // Switch active set to window views
    views = windowViews;
    embedded.active = false;
    embedOffsetY = 0;
    // Layout now based on statsWindow instead of mainWindow shim
    layout();
    setTimeout(layout,50);
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

  // Ensure stats embedded views are top-most (above any newly added broker view)
  function ensureTopmost(){
    if(!embedded.active) return; // only relevant when embedded
    if(!mainWindow || mainWindow.isDestroyed()) return;
    const hasSetter = typeof mainWindow.setTopBrowserView === 'function';
    if(!hasSetter) return; // graceful noop if Electron version lacks API
    try {
      // Order matters: set A and B first, then panel last so panel always stays above broker views.
      ['A','B','panel'].forEach(k=>{ const v = embeddedViews[k]; if(v) { try { mainWindow.setTopBrowserView(v); } catch(_){ } } });
    } catch(_){ }
  }

  // Unified public surface (ensure single authoritative export)
  return { 
    open,
    handleIpc,
    views,
    createEmbedded,
    destroyEmbedded,
    detachToWindow,
    handleStageResized,
    ensureTopmost,
    captureSlot,            // OCR capture prototype
    setUrl,                 // external url set (used by IPC layer)
    getMode: ()=> mode,
    getSide: ()=> side,
    maybeInstallUblock      // exposed for potential future on-demand enable
  };
}

module.exports = { createStatsManager };

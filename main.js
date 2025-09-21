const { app, BrowserWindow, BrowserView, ipcMain, screen, Menu, globalShortcut } = require('electron');
// Adjust default max listeners (prevent benign warnings after intentional layering). Allow override via MAX_LISTENERS env.
try {
  const EventEmitter = require('events');
  const base = Number(process.env.MAX_LISTENERS)||15;
  if(EventEmitter.defaultMaxListeners < base) EventEmitter.defaultMaxListeners = base;
} catch(_){ }
const path = require('path');
const Store = require('electron-store');
const store = new Store({ name: 'prefs' });
// Diagnostic hook for investigating MaxListenersExceededWarning on BrowserWindow 'closed'
// Enable with: DEBUG_CLOSED_LISTENERS=1
// Extra options:
//   DEBUG_CLOSED_LISTENERS_THRESHOLD=8  (change threshold)
//   DEBUG_CLOSED_LISTENERS_RAISE=1      (raise defaultMaxListeners to 30)
//   DEBUG_CLOSED_LISTENERS_CLEAN=1      (attempt to remove surplus anonymous duplicates heuristically)
try {
  if (process.env.DEBUG_CLOSED_LISTENERS) {
    const EventEmitter = require('events');
    const origOn = BrowserWindow.prototype.on;
    const origOnce = BrowserWindow.prototype.once;
    function wrapAttach(methodName, origFn){
      return function(ev, listener){
        if(ev === 'closed'){
          const win = this;
          const before = typeof win.listenerCount === 'function' ? win.listenerCount('closed') : undefined;
          // Capture stack at registration site (exclude this wrapper frames later)
          const attachStack = (new Error('[diag][closed-listener] attach site')).stack;
          const ret = origFn.call(win, ev, listener);
          setImmediate(()=>{ // after internal adjustments
            try {
              const after = win.listenerCount('closed');
              const id = (win && win.id) || 'unknown';
              const THRESH = Number(process.env.DEBUG_CLOSED_LISTENERS_THRESHOLD)||10;
              const verbose = !!process.env.DEBUG_CLOSED_LISTENERS_VERBOSE;
              const delta = (typeof before==='number' && typeof after==='number') ? (after-before) : 0;
              // Suppress noise: a single +1 (delta===1) below threshold is expected when adding a BrowserView.
              if(!(delta===1 && after<=THRESH && !verbose)){
                console.log(`[diag][closed-listener] method=${methodName} winId=${id} before=${before} after=${after} delta=${delta}`);
              }
              if(after > THRESH){
                console.log(attachStack);
                if(process.env.DEBUG_CLOSED_LISTENERS_CLEAN){
                  try {
                    const listeners = win.rawListeners ? win.rawListeners('closed') : win.listeners('closed');
                    if(Array.isArray(listeners) && listeners.length>THRESH){
                      const seen = new Set();
                      for(let i=listeners.length-1;i>=0;i--){
                        const fn = listeners[i];
                        const sig = fn && fn.toString().slice(0,120);
                        if(seen.has(sig)){
                          try { win.removeListener('closed', fn); } catch(_){ }
                        } else seen.add(sig);
                      }
                      if(verbose) console.log('[diag][closed-listener] cleanup attempted; newCount=', win.listenerCount('closed'));
                    }
                  } catch(_){ }
                }
              }
            } catch(e){ }
          });
          return ret;
        }
        return origFn.call(this, ev, listener);
      };
    }
    BrowserWindow.prototype.on = wrapAttach('on', origOn);
    BrowserWindow.prototype.once = wrapAttach('once', origOnce);
    // Optionally raise default max listeners to reduce noise while diagnosing (not required)
    if(process.env.DEBUG_CLOSED_LISTENERS_RAISE){
      try { EventEmitter.defaultMaxListeners = Math.max(EventEmitter.defaultMaxListeners, 30); } catch(_){}
    }
    console.log('[diag] BrowserWindow closed-listener instrumentation active');
  }
} catch(_){ /* ignore diagnostic setup errors */ }
// Centralized shared constants (direct import to avoid circular barrel dependency)
const constants = require('./modules/utils/constants');
// Local constants (some consumed by modularized managers)
const SNAP = constants.SNAP_DISTANCE; // snap threshold for drag/resize logic (needed by brokerManager ctx)

// Global safety nets for unexpected errors (prevent silent crashes)
try {
  process.on('unhandledRejection', (reason, p)=>{ try { console.warn('[unhandledRejection]', reason); } catch(_){} });
  process.on('uncaughtException', (err)=>{ try { console.error('[uncaughtException]', err); } catch(_){} });
} catch(_){}

// Placeholder odds broadcaster now uses shared util factory
const { makePlaceholderOdds } = require('./modules/utils/odds');
function broadcastPlaceholderOdds(id){
  try {
    const payload = makePlaceholderOdds(id);
    if (mainWindow && !mainWindow.isDestroyed()) { try { mainWindow.webContents.send('odds-update', payload); } catch(_){} }
    if (boardWindow && !boardWindow.isDestroyed()) { try { boardWindow.webContents.send('odds-update', payload); } catch(_){} }
    try { if(boardManager && boardManager.sendOdds) boardManager.sendOdds(payload); } catch(_){ }
    try { if(statsManager && statsManager.views && statsManager.views.panel){ statsManager.views.panel.webContents.send('odds-update', payload); } } catch(_){ }
  } catch(err){ try { console.warn('broadcastPlaceholderOdds failed', err); } catch(_){} }
}

// Deferred map reapply scheduling (called by brokerManager on navigation events)
// Ensures that if user had a map selected previously, it is re-sent after a short delay
function scheduleMapReapply(view){
  try {
    const lastMap = store.get('lastMap');
    if(typeof lastMap === 'undefined') return;
    // send twice with delays to survive transitional DOM states / SPA route swaps
    [400, 1400].forEach(delay=>{
      setTimeout(()=>{ try { if(view && view.webContents && !view.webContents.isDestroyed()) view.webContents.send('set-map', lastMap); } catch(_){} }, delay);
    });
  } catch(e){ /* swallow */ }
}

// Ensure single instance (prevents profile/partition LOCK conflicts)
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}
app.on('second-instance', () => {
  try {
    if (typeof mainWindow !== 'undefined' && mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  } catch(_) {}
});

// List of bookmakers to open as BrowserViews
const BROKERS = [
  { id: 'rivalry', url: 'https://www.rivalry.com/esports/league-of-legends-110' },
  { id: 'gg', url: 'https://gg.bet/?sportId=esports_league_of_legends' },
  { id: 'thunder', url: 'https://thunderpick.io/esports/league-of-legends' },
  { id: 'betboom', url: 'https://betboom.ru/esport/league-of-legends?type=live' },
  { id: 'pari', url: 'https://pari.ru/esports/category/lol?dateInterval=2' },
  { id: 'marathon', url: 'https://www.marathonbet.dk/en/live/1372932' },
  { id: 'bet365', url: 'https://www.bet365.ee/?_h=YWr28275L1TkpH0FsQpP8g%3D%3D&btsffd=1#/IP/B151' }
];
const INITIAL_URLS = BROKERS.reduce((acc,b)=>{acc[b.id]=b.url;return acc;},{});

// DataServices URL prompt overlay BrowserView ref
let dsPromptView = null;

function openDsPrompt(){
  if(!mainWindow || mainWindow.isDestroyed()) return;
  if(dsPromptView) return; // already open
  const last = store.get('lastDataservicesUrl') || '';
  dsPromptView = new BrowserView({ webPreferences:{ preload: path.join(__dirname,'preload.js'), nodeIntegration:false, contextIsolation:true } });
  try { mainWindow.addBrowserView(dsPromptView); } catch(_){ }
  try {
    // Use content bounds (excludes window frame) for more accurate centering
    const mb = (typeof mainWindow.getContentBounds === 'function') ? mainWindow.getContentBounds() : mainWindow.getBounds();
    dsPromptView.setBounds({ x:0,y:0,width:mb.width,height:mb.height });
    dsPromptView.setAutoResize({ width:true, height:true });
    // Ensure prompt is on top of other BrowserViews (z-order). addBrowserView puts it last, but
    // if future logic re-adds broker views after, explicitly re-append prompt to top.
    try { if(mainWindow.getBrowserViews){ const all = mainWindow.getBrowserViews(); if(all[all.length-1]!==dsPromptView){ mainWindow.removeBrowserView(dsPromptView); mainWindow.addBrowserView(dsPromptView); } } } catch(_){ }
  } catch(_){ }
  const filePath = path.join(__dirname,'renderer','ds_url.html');
  try { dsPromptView.webContents.loadFile(filePath, { query:{ last:last } }); } catch(e){ console.warn('ds prompt load failed', e); }
  // Blur brokers (reuse settings overlay blur logic simplified: inject CSS into each broker view)
  try {
    const css='html,body{filter:blur(18px) brightness(.7) saturate(1.1)!important;transition:filter .18s ease;}';
    Object.entries(views).forEach(([id,v])=>{ try { 
      if(!v.__dsBlurKeys) v.__dsBlurKeys = [];
      const p = v.webContents.insertCSS(css).then(k=>{ v.__dsBlurKeys.push(k); return k; });
      v.__dsBlurKeyPromise = p; // keep last promise reference
    } catch(_){ } });
    try { mainWindow.webContents.send('ui-blur-on'); } catch(_){ }
  } catch(_){ }
}
function closeDsPrompt(){
  if(!dsPromptView) return;
  try { mainWindow.removeBrowserView(dsPromptView); } catch(_){ }
  try { dsPromptView.webContents.destroy(); } catch(_){ }
  dsPromptView=null;
  // Clear blur; wait for any pending insertCSS promises so late resolutions don't re-apply
  const all = Object.values(views);
  all.forEach(v=>{
    const clearAll = ()=>{
      if(Array.isArray(v.__dsBlurKeys)){
        for(const k of v.__dsBlurKeys){ try { v.webContents.removeInsertedCSS(k); } catch(_){} }
      } else if(v.__dsBlurKey){ // legacy single key
        try { v.webContents.removeInsertedCSS(v.__dsBlurKey); } catch(_){}
      }
      v.__dsBlurKeys=[]; v.__dsBlurKey=null; v.__dsBlurKeyPromise=null;
    };
    if(v.__dsBlurKeyPromise && typeof v.__dsBlurKeyPromise.then==='function'){
      v.__dsBlurKeyPromise.then(()=>{ clearAll(); }).catch(()=>{ clearAll(); });
    } else clearAll();
  });
  try { mainWindow.webContents.send('ui-blur-off'); } catch(_){ }
}

// Subtle frame CSS injected into each broker view for consistent visual borders
const BROKER_FRAME_CSS = `body::after{content:"";position:fixed;inset:0;pointer-events:none;border:1px solid rgba(255,255,255,0.08);border-radius:10px;box-shadow:0 0 0 1px rgba(255,255,255,0.04) inset;}body{background-clip:padding-box !important;}`;

let mainWindow;
let boardWindow; // secondary window displaying aggregated odds
let boardManager; // docking/board manager
let settingsOverlay; // module instance
// BrowserView registry & state caches (restored after accidental removal in refactor)
const views = {}; // id -> BrowserView
let activeBrokerIds = []; // ordered list of currently opened broker ids
const latestOdds = {}; // brokerId -> last odds payload
const latestOddsRef = { value: latestOdds };
// LoL team names shared with board & stats
let lolTeamNames = { team1: 'Team 1', team2: 'Team 2' };
try {
  const storedNames = store.get('lolTeamNames');
  if(storedNames && typeof storedNames==='object'){
    if(storedNames.team1) lolTeamNames.team1 = String(storedNames.team1);
    if(storedNames.team2) lolTeamNames.team2 = String(storedNames.team2);
  }
} catch(_){}
// (stats/upscaler IPC wiring deferred to bootstrap to avoid stale statsManager reference)
// --- Broker health tracking (stale odds auto-refresh) ---
const brokerHealth = {}; // id -> { lastChange, lastOdds, lastRefresh }
const STALE_MS = constants.STALE_MS; // centralized (5 minutes)
const HEALTH_CHECK_INTERVAL = constants.HEALTH_CHECK_INTERVAL; // centralized (60s)
// Persisted auto-refresh feature flag (default ON when undefined)
let autoRefreshEnabled = (()=>{ const v = store.get('autoRefreshEnabled'); return (v === undefined ? true : !!v); })();
// Track initial load/network failures to retry before showing fallback error page
const loadFailures = {}; // id -> count
// Zoom manager (extracted module)
const { createZoomManager } = require('./modules/zoom'); // now modules/zoom/index.js
const zoom = createZoomManager({ store, views });
// Stats manager (initialized after stageBoundsRef defined; recreated once mainWindow exists)
const { createStatsManager } = require('./modules/stats'); // modules/stats/index.js
let statsManager; // temporary undefined until after stageBoundsRef creation
let statsState = { mode: 'hidden' }; // 'hidden' | 'embedded' | 'window'
// (savedBoardMode no longer needed: board stays docked when stats embed)
let savedBoardMode = null; // retained for backward compatibility but unused now
let lastStatsToggleTs = 0; // throttle for space hotkey
// Dedicated stats log window (detached) - lightweight
let statsLogWindow = null;
// Dev helper moved to dev/devCssWatcher.js
const { initDevCssWatcher } = require('./modules/dev/devCssWatcher');
// Optional video upscaler for stats slot A
const { createUpscalerManager } = require('./modules/upscaler');
const upscalerManager = createUpscalerManager({ store });
// Early refs required by statsManager; define before first createStatsManager call
let stageBounds = { x: 0, y: 300, width: 1600, height: 600 }; // initial placeholder; updated later
const stageBoundsRef = { value: stageBounds };
const quittingRef = { value:false };
statsManager = createStatsManager({ store, mainWindow: null, stageBoundsRef, quittingRef, upscalerManager });

// (Removed) forwardGsTheme – theme customization for stats table deprecated

// Layout manager (needs refs defined above)
const { createLayoutManager } = require('./modules/layout');
// Ref wrapper for active broker ids (used by layout & board managers)
const activeBrokerIdsRef = { value: activeBrokerIds };
const mainWindowRef = { value: null }; // passed for lazy use inside layout manager
const GAP = constants.VIEW_GAP; // already centralized
const layoutManager = createLayoutManager({ store, mainWindowRef, views, BROKERS, stageBoundsRef, activeBrokerIdsRef, GAP });

// Early IPC handlers moved to modules/ipc/early.js
const { initEarlyIpc } = require('./modules/ipc/early');
const earlyBoardRef = { value: null };
initEarlyIpc({ ipcMain, store, boardManagerRef: earlyBoardRef });

// Stats debug & raw mirroring moved to modules/ipc/statsDebug.js (initialized after stats log window helper is defined)


const { ensureVisibleBounds } = require('./modules/utils/display');
// Deferred IPC module requires (kept top-level so bundle analyzers see them)
const { initStatsIpc } = require('./modules/ipc/stats');
const { initUpscalerIpc } = require('./modules/ipc/upscaler');
const { initTeamNamesIpc } = require('./modules/ipc/teamNames');
const { initAutoRefreshIpc } = require('./modules/ipc/autoRefresh');
const lolTeamNamesRef = { value: lolTeamNames };
const autoRefreshEnabledRef = { value: autoRefreshEnabled };
function createMainWindow() {
  const saved = ensureVisibleBounds(store.get('mainBounds'));
  const defaults = { width: 1600, height: 950 };
  mainWindow = new BrowserWindow({
    width: saved ? saved.width : defaults.width,
    height: saved ? saved.height : defaults.height,
    x: saved ? saved.x : undefined,
    y: saved ? saved.y : undefined,
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js') }
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  // Auto-maximize on first launch or if user hasn't explicitly sized window (no saved bounds)
  try {
    if (!saved) {
      mainWindow.once('ready-to-show', () => {
        try { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.maximize(); } catch(_) {}
      });
    } else {
      // If saved size is significantly smaller than available work area (>85% rule), still respect user size; else maximize.
      const primary = screen.getPrimaryDisplay().workArea;
      if (saved.width < primary.width * 0.55 || saved.height < primary.height * 0.55) {
        // Probably user used a small window intentionally; do nothing.
      } else if (saved.width >= primary.width * 0.90 && saved.height >= primary.height * 0.90) {
        // Saved bounds already near full screen; just maximize to remove borders.
        mainWindow.once('ready-to-show', () => {
          try { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.maximize(); } catch(_) {}
        });
      }
    }
  } catch(_) {}
  mainWindow.on('close', () => {
    try { store.set('mainBounds', mainWindow.getBounds()); } catch(e) {}
  });
  // late injection for layout manager (mutable ref)
  layoutManager.setMainWindow(mainWindow);
  // Recreate stats manager now that mainWindow exists (enables embedded stats creation)
  try {
    const prevMode = statsState.mode;
  statsManager = createStatsManager({ store, mainWindow, stageBoundsRef, quittingRef, upscalerManager });
    // Keep previous mode only if window mode requested; embedded cannot be auto-restored yet
    statsState.mode = (prevMode === 'window') ? 'window' : 'hidden';
  } catch(e){ console.warn('Failed to re-init statsManager with mainWindow', e); }
}

// Settings overlay now in module
const { createSettingsOverlay } = require('./modules/settingsOverlay');

// Broker manager module
const { createBrokerManager } = require('./modules/brokerManager');
let brokerManager;

// Broker IPC moved to modules/ipc/brokers.js


// (manual resize logic removed; layoutManager handles broker sizing)

// IPC handlers
// Return only currently open (active) brokers, not the full master list
ipcMain.handle('list-brokers', () => Object.keys(views).filter(id=>!id.startsWith('slot-')));
ipcMain.handle('get-disabled-brokers', () => store.get('disabledBrokers', []));
ipcMain.on('set-disabled-brokers', (e, list) => {
  store.set('disabledBrokers', list);
});

// (refresh-broker / refresh-all moved to brokers IPC module)
// (layout IPC moved to modules/ipc/layout.js)

// (settings + heatbar + contrast + layout preset IPC moved to modules/ipc/settings.js & modules/ipc/layout.js)

// --- Close broker handler from renderer drag bar ---
// (close-broker moved to brokers IPC module)

// --- Add broker via slot placeholder ---
// (slot-request-add moved to brokers IPC module)
// Data request from addBroker dialog preload
// (add-broker-selected & request-add-broker-data moved to brokers IPC module)
// Map IPC moved to modules/ipc/map.js

const { createStaleMonitor } = require('./modules/staleMonitor');
let staleMonitor;
// IPC modularized handlers
const { initMapIpc } = require('./modules/ipc/map');
const { initSettingsIpc } = require('./modules/ipc/settings');
const { initBrokerIpc } = require('./modules/ipc/brokers');
const { initLayoutIpc } = require('./modules/ipc/layout');

// inline dev watcher removed (moved to modules/dev/devCssWatcher.js)

function bootstrap() {
  createMainWindow();
  // Remove application menu (hidden UI footprint)
  try { Menu.setApplicationMenu(null); } catch(_){}
  settingsOverlay = createSettingsOverlay({ mainWindow, views, store });
  // Initialize settings-related IPC now (requires settingsOverlay)
  initSettingsIpc({ ipcMain, store, settingsOverlay, statsManager });
  brokerManager = createBrokerManager({
    BROKERS, store, views, zoom, layoutManager, scheduleMapReapply,
    broadcastPlaceholderOdds, SNAP, GAP, stageBoundsRef, activeBrokerIdsRef,
    brokerHealth, loadFailures, BROKER_FRAME_CSS,
    mainWindow,
  onActiveListChanged: (list)=>{ activeBrokerIds = list; activeBrokerIdsRef.value = list; }
  });
  // Initialize broker-related IPC now that brokerManager exists
  const boardManagerRef = { value: null };
  initBrokerIpc({ ipcMain, store, views, brokerManager, statsManager, boardWindowRef:{ value: boardWindow }, mainWindow, boardManagerRef, brokerHealth, latestOddsRef, zoom, SNAP, stageBoundsRef });
  // Layout IPC (needs layoutManager + refs ready)
  initLayoutIpc({ ipcMain, store, layoutManager, views, stageBoundsRef, boardManager, statsManager });
  // DataServices prompt IPC
  ipcMain.on('open-dataservices-url-prompt', ()=> openDsPrompt());
  ipcMain.on('dataservices-url-submit', (e,{ url })=>{
    // Close prompt first to prevent blur race affecting new view
    closeDsPrompt();
    try {
      if(typeof url === 'string'){
        let u = url.trim();
        if(!/^https?:\/\//i.test(u) && /[.]/.test(u)) u = 'https://'+u;
        if(/^https?:\/\//i.test(u)){
          try { store.set('lastDataservicesUrl', u); } catch(_){}
          if(brokerManager && brokerManager.addBroker){ brokerManager.addBroker('dataservices', u); }
        }
      }
    } catch(_){ }
  });
  ipcMain.on('dataservices-url-cancel', ()=> closeDsPrompt());
  // (Legacy Marathon migration logic removed – Marathon now treated like any other broker)
  brokerManager.createAll();
  // Board manager (docking system)
  const { createBoardManager } = require('./modules/board');
  boardManager = createBoardManager({
    mainWindow,
    store,
    layoutManager,
    latestOddsRef,
    activeBrokerIdsRef,
  stageBoundsRef,
    replayOddsFn: (id)=> broadcastPlaceholderOdds(id)
  });
  boardManager.init();
  boardManagerRef.value = boardManager;
  // Initialize map selection IPC (needs boardManager, statsManager, mainWindow references)
  initMapIpc({ ipcMain, store, views, mainWindow, boardWindowRef:{ value: boardWindow }, boardManager, statsManager });
  // Board IPC wiring now modular
  const { initBoardIpc } = require('./modules/ipc/board');
  initBoardIpc({ ipcMain, boardManager });
  // Now that boardManager & statsManager are finalized, initialize IPC modules that depend on them
  try { initUpscalerIpc({ ipcMain, upscalerManager, statsManager }); } catch(e){ console.warn('initUpscalerIpc failed', e); }
  try { initTeamNamesIpc({ ipcMain, store, boardManager, mainWindow, boardWindowRef:{ value: boardWindow }, statsManager, lolTeamNamesRef }); } catch(e){ console.warn('initTeamNamesIpc failed', e); }
  try { initAutoRefreshIpc({ ipcMain, store, boardWindowRef:{ value: boardWindow }, mainWindow, autoRefreshEnabledRef }); } catch(e){ console.warn('initAutoRefreshIpc failed', e); }
  try { initStatsIpc({ ipcMain, statsManager, views, stageBoundsRef, mainWindow, boardManager, toggleStatsEmbedded, refs:{ statsState, savedBoardMode, lastStatsToggleTs } }); } catch(e){ console.warn('initStatsIpc (deferred) failed', e); }
  // Expose mutable refs for diagnostic / future module hot-swap
  try { Object.defineProperty(global, '__oddsMoniSync', { value:{ autoRefreshEnabledRef, lolTeamNamesRef }, enumerable:false }); } catch(_){}
  staleMonitor = createStaleMonitor({ intervalMs: HEALTH_CHECK_INTERVAL, staleMs: STALE_MS, brokerHealth, views, enabledRef:{ value:autoRefreshEnabled }, onReload:(id)=>{ try { views[id].webContents.reloadIgnoringCache(); } catch(e){} } });
  // Restore previously saved layout preset (after views created)
  try {
    const savedPreset = store.get('layoutPreset');
    if (savedPreset) {
      setTimeout(()=>{ layoutManager.applyLayoutPreset(savedPreset); }, 150);
    } else {
      // Apply a default preset so empty slots (add buttons) appear even with zero/disabled brokers
  setTimeout(()=>{ layoutManager.applyLayoutPreset('2x2'); }, 200);
    }
  } catch(e) {}
  // After a short delay (views loading), broadcast persisted map selection if any
  const lastMap = store.get('lastMap');
  if (typeof lastMap !== 'undefined') {
    setTimeout(() => {
      for (const id of Object.keys(views)) {
        try { views[id].webContents.send('set-map', lastMap); } catch(e) {}
      }
    }, 1200);
  }
  // Menu intentionally suppressed (user prefers F12 only)
  // Removed broker-id partition probing to avoid creating unused persistent profiles
}

// buildAppMenu removed per user request (F12 hotkey only)

function toggleStatsEmbedded(){
  if(!mainWindow || mainWindow.isDestroyed()) return;
  if(statsState.mode==='hidden'){
    // NOTE: Раньше мы удаляли ВСЕ broker BrowserView (removeBrowserView) и потом добавляли обратно,
    // что вызывало многократное накопление внутренних служебных 'closed' listeners в Electron.
    // Теперь мы НЕ снимаем брокерские вью — просто кладём поверх них stats BrowserViews (они добавятся последними).
    // При необходимости скрытия CPU нагрузки можно позже добавить shrink/restore bounds, но сейчас главное – остановить listener leak.
  // Removed auto-detach of docked board: it now remains docked under stats views.
    const offsetY = stageBoundsRef && stageBoundsRef.value ? Number(stageBoundsRef.value.y) : 0;
    try { console.log('[stats][toggle] createEmbedded with offsetY', offsetY); } catch(_){ }
  statsManager.createEmbedded(offsetY);
  statsState.mode='embedded'; // (log window no longer auto-opens)
  } else if(statsState.mode==='embedded') {
    statsManager.destroyEmbedded();
    // Брокерские вью никогда не удалялись -> не нужно addBrowserView, иначе снова накопим listeners.
  // No reattach needed (we never detached board for stats embed).
    statsState.mode='hidden';
  } else if(statsState.mode==='window') {
    // If window is open, focus instead of embedding (explicit detach path remains)
  try { statsManager.open(); } catch(_){ }
    return;
  }
  try { mainWindow.webContents.send('stats-state-updated', statsState); } catch(_){ }
}
// (duplicate early IPC init block removed; handled in bootstrap())

app.whenReady().then(()=>{
  bootstrap();
  initDevCssWatcher({ app, mainWindow, boardWindowRef:{ value: boardWindow }, statsManager, baseDir: __dirname });
  // Register global shortcut for opening Stats Log window
  try {
    if(globalShortcut.isRegistered('Control+Alt+L')) globalShortcut.unregister('Control+Alt+L');
    const ok = globalShortcut.register('Control+Alt+L', () => {
      try { openStatsLogWindow(); } catch(e){ console.warn('[shortcut][stats-log] open failed', e); }
    });
    if(!ok) console.warn('[shortcut][stats-log] registration returned false');
    else console.log('[shortcut][stats-log] registered Ctrl+Alt+L');
  } catch(e){ console.warn('[shortcut][stats-log] registration error', e); }
});
// Hotkey strategy:
//  - Global 'Space' accelerator was REMOVED to prevent capturing space keystrokes when user focus is outside the app.
//  - We now rely only on window-level before-input-event handlers (see browser-window-created listener below).
//  - Broker BrowserViews also have their own before-input-event logic (in brokerManager) with editable element guard.
// Optional future fallback (example):
//  if(false){ /* re-enable guarded global shortcut */ /* globalShortcut.register('Space', () => { ... guarded toggle ... }); */ }
app.on('will-quit', ()=>{ try { globalShortcut.unregisterAll(); } catch(_){} });
// Global space hotkey (throttled) to toggle stats embedded view
app.on('browser-window-created', (_e, win)=>{
  try {
    win.webContents.on('before-input-event', (_event, input)=>{
      if(input.type==='keyDown' && !input.isAutoRepeat){
        // Space toggles embedded stats
        if(input.key===' '){
          const now=Date.now();
          if(now - lastStatsToggleTs < 500) return; // throttle 500ms
          lastStatsToggleTs = now;
          toggleStatsEmbedded();
          return;
        }
        // F12 -> open devtools (active broker if possible else main window)
        if(input.key==='F12'){
          try {
            // Prefer first in activeBrokerIds order; fallback to any view; then main window.
            const active = (activeBrokerIds.find(id=>views[id]) || Object.keys(views).find(id=>!id.startsWith('slot-')));
            if(active && views[active]){
              views[active].webContents.openDevTools({ mode:'detach' });
            } else if(mainWindow){
              mainWindow.webContents.openDevTools({ mode:'detach' });
            }
          } catch(e){ console.warn('[hotkey][F12] failed', e); }
          return;
        }
        // Ctrl+Alt+L opens (or focuses) the Stats Log window (fallback if global shortcut unavailable)
        if((input.control || input.meta) && input.alt && (input.key==='L' || input.key==='l')){
          try { openStatsLogWindow(); } catch(e){ console.warn('[shortcut][stats-log][fallback] open failed', e); }
          return;
        }
      }
    });
  } catch(_) {}
});
app.on('before-quit', ()=>{ quittingRef.value=true; });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

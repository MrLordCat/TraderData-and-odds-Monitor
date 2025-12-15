const { app, BrowserWindow, BrowserView, ipcMain, screen, Menu, globalShortcut, dialog } = require('electron');
// Raise EventEmitter listener cap to 15 (requested) unconditionally (was env-gated before)
try {
  const EventEmitter = require('events');
  const desired = 18;
  if (EventEmitter.defaultMaxListeners < desired) {
    EventEmitter.defaultMaxListeners = desired;
  }
  // Also patch setMaxListeners shortcut for any new emitters created before modules import
  try { process.setMaxListeners && process.setMaxListeners(desired); } catch(_){ }
} catch(_){ }
const path = require('path');
const Store = require('electron-store');
const store = new Store({ name: 'prefs' });
const fs = require('fs');
// Centralized shared constants (direct import to avoid circular barrel dependency)
const constants = require('./modules/utils/constants');
// Local constants (some consumed by modularized managers)
const SNAP = constants.SNAP_DISTANCE; // snap threshold for drag/resize logic (needed by brokerManager ctx)
2
// Allow renderer toolbar 'Dev' button to open main window DevTools
ipcMain.on('open-devtools', () => {
  try {
    // Prefer board dock view (чтобы видеть логи odds / excel watcher и т.п.)
    let opened = false;
    try {
      if(typeof boardManager?.getWebContents === 'function'){
        const bwc = boardManager.getWebContents();
        if(bwc && !bwc.isDestroyed()) { bwc.openDevTools({ mode:'detach' }); opened = true; }
      }
    } catch(_){ }
    if(!opened && mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.openDevTools({ mode: 'detach' });
  } catch(e){ console.warn('openDevTools failed', e); }
});

// Reapply stored map & team names after broker navigation (multi-delay strategy as documented in project instructions)
function scheduleMapReapply(view){
  try {
    if(!view || view.isDestroyed()) return;
    const lastMap = store.get('lastMap');
    const teamNames = store.get('lolTeamNames');
    // Default map when nothing persisted yet
    const defaultMap = 1;
    const mapToApply = (typeof lastMap !== 'undefined') ? lastMap : defaultMap;
    const isLastFlag = !!store.get('isLast');
    const delays = [400, 1400, 3000, 5000];
    delays.forEach(d=> setTimeout(()=>{
      try {
        if(view.isDestroyed()) return;
        // Always assert a map (use default when no persisted lastMap yet)
        view.webContents.send('set-map', mapToApply);
        if(teamNames) view.webContents.send('set-team-names', teamNames);
        // Re-apply isLast bet365 semantic flag as well
        view.webContents.send('set-is-last', isLastFlag);
        // Nudge an immediate collection shortly after applying controls
        setTimeout(()=>{ try { if(!view.isDestroyed()) view.webContents.send('collect-now'); } catch(_){ } }, 250);
      } catch(_){ }
    }, d));
  } catch(_){ }
}

// Prepare dynamic SendInput helper script (F23/F24) for global key injection (AHK hook)
let __sendInputScriptPath;
try {
  __sendInputScriptPath = path.join(__dirname,'sendKeyInject.ps1');
  if(!fs.existsSync(__sendInputScriptPath)){
    const psBody = `param([int]$vk)\nAdd-Type -TypeDefinition @\"\nusing System;\nusing System.Runtime.InteropServices;\npublic static class KBSend {\n [DllImport(\"user32.dll\")] static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);\n const uint KEYEVENTF_KEYUP = 0x0002;\n public static void Tap(byte vk){\n  keybd_event(vk,0,0,UIntPtr.Zero);\n  keybd_event(vk,0,KEYEVENTF_KEYUP,UIntPtr.Zero);\n }\n}\n\"@ -ErrorAction SilentlyContinue\n[KBSend]::Tap([byte]$vk)\n`;
    try { fs.writeFileSync(__sendInputScriptPath, psBody); } catch(e){ console.warn('[auto-press][init] write sendKeyInject.ps1 fail', e.message); }
  }
} catch(e){ console.warn('[auto-press][init] sendInput script prep failed', e.message); }

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
// (Removed stray early key injection block from previous patch attempt)

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

// (Removed: DataServices URL prompt overlay and blur logic)

// Subtle frame CSS injected into each broker view for consistent visual borders
const BROKER_FRAME_CSS = `body::after{content:"";position:fixed;inset:0;pointer-events:none;border:1px solid rgba(255,255,255,0.08);border-radius:10px;box-shadow:0 0 0 1px rgba(255,255,255,0.04) inset;}body{background-clip:padding-box !important;}`;

let mainWindow;
let boardWindow; // secondary window displaying aggregated odds
let boardManager; // docking/board manager
const boardManagerRef = { value: null };
let settingsOverlay; // module instance
let hotkeys; // unified hotkey manager (TAB/F1/F2/F3)
const hotkeysRef = { value: null };

// Cross-window auto state snapshot (used by hotkeys and late-loaded views)
let __autoLast = { active:false, resume:true };
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
let statsState = { mode: 'hidden', panelHidden: !!store.get('statsPanelHidden', false) }; // 'hidden' | 'embedded', plus panelHidden
let lastStatsToggleTs = 0; // throttle for space hotkey
// Dedicated stats log window (detached) - lightweight
let statsLogWindow = null;
// Dev helper moved to dev/devCssWatcher.js
const { initDevCssWatcher } = require('./modules/dev/devCssWatcher');
// Early refs required by statsManager; define before first createStatsManager call
let stageBounds = { x: 0, y: 300, width: 1600, height: 600 }; // initial placeholder; updated later
const stageBoundsRef = { value: stageBounds };
const quittingRef = { value:false };
statsManager = createStatsManager({ store, mainWindow: null, stageBoundsRef, quittingRef });

// (Removed) forwardGsTheme – theme customization for stats table deprecated

// Layout manager (needs refs defined above)
const { createLayoutManager } = require('./modules/layout');
// Ref wrapper for active broker ids (used by layout & board managers)
const activeBrokerIdsRef = { value: activeBrokerIds };
const mainWindowRef = { value: null }; // passed for lazy use inside layout manager
const GAP = constants.VIEW_GAP; // already centralized
const layoutManager = createLayoutManager({ store, mainWindowRef, views, BROKERS, stageBoundsRef, activeBrokerIdsRef, hotkeysRef, GAP });

// Early IPC handlers moved to modules/ipc/early.js
const { initEarlyIpc } = require('./modules/ipc/early');
initEarlyIpc({ ipcMain, store, boardManagerRef });

// Stats debug & raw mirroring moved to modules/ipc/statsDebug.js (initialized after stats log window helper is defined)


const { ensureVisibleBounds } = require('./modules/utils/display');
// Deferred IPC module requires (kept top-level so bundle analyzers see them)
const { initStatsIpc } = require('./modules/ipc/stats');
const { initTeamNamesIpc } = require('./modules/ipc/teamNames');
const { initAutoRefreshIpc } = require('./modules/ipc/autoRefresh');
// External Excel odds JSON watcher (pseudo broker 'excel')
const { createExcelWatcher } = require('./modules/excelWatcher');
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
  statsManager = createStatsManager({ store, mainWindow, stageBoundsRef, quittingRef });
    // Keep previous mode only if window mode requested; embedded cannot be auto-restored yet
    statsState.mode = (prevMode === 'window') ? 'window' : 'hidden';
    try { statsState.panelHidden = !!statsManager.getPanelHidden?.(); } catch(_){ }
  } catch(e){ console.warn('Failed to re-init statsManager with mainWindow', e); }
}

// Settings overlay now in module
const { createSettingsOverlay } = require('./modules/settingsOverlay');

// Hotkeys manager
const { createHotkeyManager } = require('./modules/hotkeys');

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
  // First-run defaults: don't auto-open any brokers. Populate disabled list once.
  try {
    const hasLaunched = !!store.get('hasLaunched');
    if (!hasLaunched) {
      try { store.set('disabledBrokers', BROKERS.map(b => b.id)); } catch(_) {}
      try { store.set('hasLaunched', true); } catch(_) {}
    }
    // Cleanup deprecated keys from older builds (dataservices overlay remnants)
    try { if(store.get('lastDataservicesUrl')!==undefined) store.delete('lastDataservicesUrl'); } catch(_) {}
  } catch(_) {}
  createMainWindow();
  // Remove application menu (hidden UI footprint)
  try { Menu.setApplicationMenu(null); } catch(_){}
  // Unified window-active hotkeys (TAB/F1/F2/F3)
  function broadcastAutoToggleAll(){
    try {
      const bwc = (typeof boardWindow!=='undefined' && boardWindow && !boardWindow.isDestroyed()) ? boardWindow.webContents : (boardManager && boardManager.getWebContents ? boardManager.getWebContents() : null);
      if(bwc && !bwc.isDestroyed()) bwc.send('auto-toggle-all');
    } catch(_){ }
    try { mainWindow && mainWindow.webContents && mainWindow.webContents.send('auto-toggle-all'); } catch(_){ }
    try {
      if(statsManager && statsManager.views){
        const vs = statsManager.views;
        ['panel','A','B'].forEach(k=>{ const v=vs[k]; if(v && v.webContents && !v.webContents.isDestroyed()){ try { v.webContents.send('auto-toggle-all'); } catch(_){ } } });
      }
    } catch(_){ }
  }
  function broadcastAutoResumeSet(on){
    try { __autoLast.resume = !!on; } catch(_){ }
    const p = { on: !!on };
    try {
      const bwc = (typeof boardWindow!=='undefined' && boardWindow && !boardWindow.isDestroyed()) ? boardWindow.webContents : (boardManager && boardManager.getWebContents ? boardManager.getWebContents() : null);
      if(bwc && !bwc.isDestroyed()) bwc.send('auto-resume-set', p);
    } catch(_){ }
    try { mainWindow && mainWindow.webContents && mainWindow.webContents.send('auto-resume-set', p); } catch(_){ }
    try {
      if(statsManager && statsManager.views){
        const vs = statsManager.views;
        ['panel','A','B'].forEach(k=>{ const v=vs[k]; if(v && v.webContents && !v.webContents.isDestroyed()){ try { v.webContents.send('auto-resume-set', p); } catch(_){ } } });
      }
    } catch(_){ }
  }

  hotkeys = createHotkeyManager({
    actions: {
      toggleStats: ()=>{ try { toggleStatsEmbedded(); } catch(_){ } },
      toggleAuto: ()=>{ try { broadcastAutoToggleAll(); } catch(_){ } },
      toggleAutoResume: ()=>{ try { broadcastAutoResumeSet(!__autoLast.resume); } catch(_){ } },
	  startScript: ()=>{ try { if(typeof excelProc !== 'undefined' && excelProc){ stopExcelExtractor(); } else { startExcelExtractor(); } } catch(_){ } },
    },
    state: { __autoLast }
  });

  // Allow early-created slot-* views (placeholders) to receive hotkeys too.
  try { hotkeysRef.value = hotkeys; } catch(_){ }
  try { layoutManager && layoutManager.relayoutAll && layoutManager.relayoutAll(); } catch(_){ }

  // Also attach to main window (covers cases where focus is on the base renderer).
  try { hotkeys && hotkeys.attachToWebContents && hotkeys.attachToWebContents(mainWindow.webContents); } catch(_){ }

  settingsOverlay = createSettingsOverlay({ mainWindow, views, store });
  // Initialize settings-related IPC now (requires settingsOverlay)
  initSettingsIpc({ ipcMain, store, settingsOverlay, statsManager });
  brokerManager = createBrokerManager({
    BROKERS, store, views, zoom, layoutManager, scheduleMapReapply,
    broadcastPlaceholderOdds, SNAP, GAP, stageBoundsRef, activeBrokerIdsRef,
    brokerHealth, loadFailures, BROKER_FRAME_CSS,
    mainWindow,
    hotkeys,
  onActiveListChanged: (list)=>{ activeBrokerIds = list; activeBrokerIdsRef.value = list; }
  });
  // Initialize broker-related IPC now that brokerManager exists
  initBrokerIpc({ ipcMain, store, views, brokerManager, statsManager, boardWindowRef:{ value: boardWindow }, mainWindow, boardManagerRef, brokerHealth, latestOddsRef, zoom, SNAP, stageBoundsRef });
  // Layout IPC (needs layoutManager + refs ready)
  initLayoutIpc({ ipcMain, store, layoutManager, views, stageBoundsRef, boardManager, statsManager });
  // (Removed: DataServices prompt IPC)
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
    hotkeys,
    replayOddsFn: (id)=> broadcastPlaceholderOdds(id)
  });
  boardManager.init();
  boardManagerRef.value = boardManager;

  // Hotkeys were created after statsManager; inject so fresh stats views get handlers.
  try { if(statsManager && typeof statsManager.setHotkeys==='function') statsManager.setHotkeys(hotkeys); } catch(_){ }
  // Cleanup stray bilibili/generic views (removed from supported sources). Closes any broker ids containing 'bilibili'.
  try {
    const stray = activeBrokerIdsRef.value.filter(id=> /bilibili/i.test(id));
    if(stray.length){
      console.warn('[startup][cleanup] closing stray bilibili views', stray);
      stray.forEach(id=>{ try { brokerManager.closeBroker(id); } catch(_){ } });
    }
    ipcMain.on('cleanup-foreign-views', ()=>{
      try {
        const toClose = activeBrokerIdsRef.value.filter(id=> /bilibili/i.test(id));
        toClose.forEach(id=>{ try { brokerManager.closeBroker(id); } catch(_){ } });
        console.log('[cleanup-foreign-views] closed', toClose);
      } catch(err){ console.warn('[cleanup-foreign-views] error', err.message); }
    });
  } catch(_){ }
  // Initialize excel watcher after board manager so early odds push displays
  try {
    if(!global.__excelWatcher){
      const forward = (p)=>{
        // Forward to docked/window board
        try { if(boardManager && boardManager.sendOdds) boardManager.sendOdds(p); } catch(_){ }
        // Also forward directly into stats panel (embedded/window) so Excel odds appear there (was missing before)
        try {
          if(statsManager && statsManager.views && statsManager.views.panel && statsManager.views.panel.webContents && !statsManager.views.panel.webContents.isDestroyed()){
            statsManager.views.panel.webContents.send('odds-update', p);
          }
        } catch(_){ }
        // Persist into latestOddsRef cache so future replays (board detach/load) include Excel without re-selecting map
        try { if(latestOddsRef && latestOddsRef.value) latestOddsRef.value[p.broker] = p; } catch(_){ }
        // Keep a global last Excel odds snapshot for stats panel late load replay
        try { global.__lastExcelOdds = p; } catch(_){ }
      };
      // Annotate forward with a hint for template sync side-channel
      try { Object.defineProperty(forward, '__acceptsTemplateSync', { value: false, enumerable:false }); } catch(_){ }
      global.__excelWatcher = createExcelWatcher({ win: mainWindow, store, sendOdds: forward });
    }
  } catch(e){ console.warn('[excel][watcher] init failed', e.message); }
  // Initialize map selection IPC (needs boardManager, statsManager, mainWindow references)
  initMapIpc({ ipcMain, store, views, mainWindow, boardWindowRef:{ value: boardWindow }, boardManager, statsManager });
  // Initialize periodic map re-broadcast (odds refresh auto loop)
  try {
    const { initMapAutoRefreshIpc } = require('./modules/ipc/mapAutoRefresh');
  initMapAutoRefreshIpc({ ipcMain, store, mainWindow, boardManager, statsManager, views });
  } catch(e){ console.warn('initMapAutoRefreshIpc failed', e.message); }
  // Lightweight IPC to fetch last excel odds (used by stats panel / board after load to avoid needing map reselect)
  try {
    ipcMain.handle('excel-last-odds', ()=>{ return global.__lastExcelOdds || null; });
  } catch(_){ }
  // Board IPC wiring now modular
  const { initBoardIpc } = require('./modules/ipc/board');
  initBoardIpc({ ipcMain, boardManager, statsManager });
  // Now that boardManager & statsManager are finalized, initialize IPC modules that depend on them
  try { initTeamNamesIpc({ ipcMain, store, boardManager, mainWindow, boardWindowRef:{ value: boardWindow }, statsManager, lolTeamNamesRef }); } catch(e){ console.warn('initTeamNamesIpc failed', e); }
  try { initAutoRefreshIpc({ ipcMain, store, boardWindowRef:{ value: boardWindow }, mainWindow, autoRefreshEnabledRef }); } catch(e){ console.warn('initAutoRefreshIpc failed', e); }
  try { initStatsIpc({ ipcMain, statsManager, views, stageBoundsRef, mainWindow, boardManager, toggleStatsEmbedded, refs:{ statsState, lastStatsToggleTs }, store }); } catch(e){ console.warn('initStatsIpc (deferred) failed', e); }
  // -------- Excel extractor (Python) process control --------
  // Lightweight toggle: user triggers start/stop via board "S" button.
  // We spawn a detached python process reading the workbook and writing current_state.json.
  // Guard against rapid respawn; maintain status broadcast to renderer.
  const { spawn } = require('child_process');
  let excelProc = null;
  let excelProcStarting = false;
  let lastExcelStartTs = 0;
  let excelProcError = null; // last error message (non-zero exit or spawn failure)
  let excelDepsInstalling = false;

  // Optional AHK helper (screen-click automation for Excel)
  let ahkProc = null;
  let ahkProcStarting = false;
  let ahkProcError = null;

  function resolveAhkScriptPath(){
    // Store override
    try {
      const custom = store.get('ahkScriptPath');
      if(custom && typeof custom === 'string' && fs.existsSync(custom.trim())) return custom.trim();
    } catch(_){ }
    // Default: Excel Extractor/script159_v2.ahk
    try {
      const appRoot = path.resolve(__dirname);
      const candidates = [
        path.join(appRoot, 'Excel Extractor', 'script159_v2.ahk'),
        path.join(appRoot, 'Excel Extractor', 'script159.ahk'),
        path.join(process.cwd(), 'Excel Extractor', 'script159_v2.ahk'),
        path.join(process.cwd(), 'Excel Extractor', 'script159.ahk')
      ];
      for(const p of candidates){ try { if(fs.existsSync(p)) return p; } catch(_){ } }
    } catch(_){ }
    return null;
  }

  function resolveAhkExe(){
    // User override
    try {
      const custom = store.get('ahkExePath');
      if(custom && typeof custom === 'string' && custom.trim()) return custom.trim();
    } catch(_){ }
    // Fall back to PATH resolution
    return 'AutoHotkey64.exe';
  }

  function startAhkHelper(){
    if(ahkProc || ahkProcStarting) return;
    ahkProcStarting = true;
    ahkProcError = null;
    broadcastExcelStatus();
    try {
      const scriptPath = resolveAhkScriptPath();
      if(!scriptPath){
        ahkProcError = 'AHK script not found (script159_v2.ahk)';
        ahkProcStarting = false;
        broadcastExcelStatus();
        return;
      }
      let exe = resolveAhkExe();
      const cwd = path.dirname(scriptPath);

      function spawnAhk(exeToTry, secondTry){
        try {
          ahkProc = spawn(exeToTry, [scriptPath], { cwd, stdio:['ignore','pipe','pipe'], windowsHide:true });
          let didFallback = false;
          ahkProc.on('error', (err)=>{
            try { console.warn('[ahk][error]', err && err.message ? err.message : String(err)); } catch(_){ }
            // Most common case: ENOENT (AutoHotkey not installed / not in PATH)
            if(secondTry && !didFallback){
              didFallback = true;
              try { if(ahkProc) ahkProc.removeAllListeners(); } catch(_){ }
              try { ahkProc = null; } catch(_){ }
              try { secondTry(); return; } catch(_){ }
            }
            ahkProc = null;
            ahkProcStarting = false;
            const msg = (err && err.code === 'ENOENT')
              ? 'AutoHotkey not found (set ahkExePath)'
              : ('AHK spawn error: ' + (err && err.message ? err.message : String(err)));
            ahkProcError = msg;
            broadcastExcelStatus();
          });
          ahkProc.on('spawn', ()=>{ ahkProcStarting = false; ahkProcError = null; broadcastExcelStatus(); });
          let errBuf='';
          ahkProc.stdout.on('data', d=>{ /* keep quiet by default */ try { const s=d.toString().trim(); if(s) console.log('[ahk][stdout]', s); } catch(_){ } });
          ahkProc.stderr.on('data', d=>{ try { const s=d.toString(); errBuf += s; console.warn('[ahk][stderr]', s.trim()); } catch(_){ } });
          ahkProc.on('exit', (code, sig)=>{
            if(code && code !== 0){
              ahkProcError = 'AHK exit code ' + code;
              if(errBuf && /requires|error|cannot|failed/i.test(errBuf)){
                ahkProcError = errBuf.trim().slice(0, 180);
              }
            } else if(sig){
              ahkProcError = null;
            }
            ahkProc = null;
            ahkProcStarting = false;
            broadcastExcelStatus();
          });
          broadcastExcelStatus();
        } catch(err){
          ahkProc = null;
          if(secondTry){
            try { secondTry(); return; } catch(_){ }
          }
          ahkProcError = 'AHK spawn failed: ' + (err && err.message ? err.message : String(err));
          ahkProcStarting = false;
          broadcastExcelStatus();
        }
      }

      // If AutoHotkey64.exe is not found, try AutoHotkey.exe
      spawnAhk(exe, ()=>{
        if(exe.toLowerCase() === 'autohotkey64.exe'){
          spawnAhk('AutoHotkey.exe');
        }
      });
    } catch(err){
      ahkProc = null;
      ahkProcError = 'AHK start error: ' + (err && err.message ? err.message : String(err));
      ahkProcStarting = false;
      broadcastExcelStatus();
    }
  }

  function stopAhkHelper(){
    if(!ahkProc) { ahkProcStarting = false; return; }
    try { console.log('[ahk] stopping pid', ahkProc.pid); ahkProc.kill(); } catch(_){ }
  }
    function excelLog(){
      const msg = Array.from(arguments).map(a=>{
        if(a instanceof Error) return a.stack||a.message;
        if(typeof a==='object'){ try { return JSON.stringify(a); } catch(_){ return String(a); } }
        return String(a);
      }).join(' ');
      try { console.log('[excel-extractor][log]', msg); } catch(_){ }
      try { if(mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('excel-extractor-log', { ts:Date.now(), msg }); } catch(_){ }
      try {
        if(typeof boardManager?.getWebContents==='function'){
          const bwc = boardManager.getWebContents();
          if(bwc && !bwc.isDestroyed()) bwc.send('excel-extractor-log', { ts:Date.now(), msg });
        }
      } catch(_){ }
    }
  
  function resolveExcelScriptPath(){
    // 1. Store override
    try { const custom = store.get('excelScriptPath'); if(custom && fs.existsSync(custom)) return custom; } catch(_){}
    // 2. Common filenames & subfolders inside project
    const names = ['excel_watcher.py','excel-watcher.py','excelWatcher.py'];
    const dirs = ['', 'scripts', 'script', 'python', 'excel', 'Excel Extractor', 'extractor'];
    const isDev = !app.isPackaged;
    if(isDev){
      // In dev часто нужно добавить корень проекта и cwd варианты
      try {
        const cwd = process.cwd();
        dirs.push(cwd);
        dirs.push(path.join(cwd, 'Excel Extractor'));
      } catch(_){ }
    }
    // When packaged, __dirname points at resources/app; also attempt explicit resources/app and resources/app/Excel Extractor
    try {
      if(process.resourcesPath){
        const base = path.join(process.resourcesPath, 'app');
        dirs.push(base);
        dirs.push(path.join(base, 'Excel Extractor'));
      }
    } catch(_){}
  const tried = [];
    for(const d of dirs){
      for(const n of names){
        const p = path.join(__dirname, d, n);
        tried.push(p);
        try { if(fs.existsSync(p)) { 
          console.warn('[excel-extractor] resolveExcelScriptPath: found', p);
          return p; 
        }} catch(_){}
      }
    }
    // 3. Shallow recursive scan (depth 2) to be more forgiving
    try {
      const scanDirs=[__dirname];
      const visited=new Set();
      while(scanDirs.length){
        const cur=scanDirs.shift();
        if(visited.has(cur)) continue; visited.add(cur);
        let entries=[]; try { entries = fs.readdirSync(cur, { withFileTypes:true }); } catch(_){ continue; }
        for(const ent of entries){
          if(ent.isDirectory()){
            const relDepth = cur.replace(__dirname,'').split(path.sep).filter(Boolean).length;
            if(relDepth < 2) scanDirs.push(path.join(cur, ent.name));
          } else if(/excel[_-]?watcher\.py$/i.test(ent.name)){
            const full = path.join(cur, ent.name);
            console.warn('[excel-extractor] resolveExcelScriptPath: found (scan)', full);
            return full;
          }
        }
      }
    } catch(_){}
    // Log what we tried for diagnostics
    try { console.warn('[excel-extractor] script not found, tried:', tried); } catch(_){}
    if(isDev){
      console.warn('[excel-extractor] DEV HINT: размести excel_watcher.py в корень или папку "Excel Extractor" либо укажи путь через IPC excel-extractor-set-path');
    }
    return null;
  }
  function broadcastExcelStatus(){
    try {
      const payload = {
        running: !!excelProc,
        starting: excelProcStarting,
        error: excelProcError,
        installing: excelDepsInstalling,
        ahk: {
          running: !!ahkProc,
          starting: ahkProcStarting,
          error: ahkProcError
        }
      };
      if(mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('excel-extractor-status', payload);
      }
      // Also broadcast to board BrowserView if present
      try {
        if(typeof boardManager?.getWebContents === 'function'){
          const bwc = boardManager.getWebContents();
          if(bwc && !bwc.isDestroyed()) bwc.send('excel-extractor-status', payload);
        }
      } catch(_){ }
      // And to stats panel / slots if present
      try {
        if(statsManager && statsManager.views){
          const vs = statsManager.views;
          ['panel','A','B'].forEach(k=>{ const v=vs[k]; if(v && v.webContents && !v.webContents.isDestroyed()){ try { v.webContents.send('excel-extractor-status', payload); } catch(_){ } } });
        }
      } catch(_){ }
    } catch(_){ }
  }
  function startExcelExtractor(){
    if(excelProc || excelProcStarting) return;
    const now=Date.now(); if(now - lastExcelStartTs < 1500) { return; }
    lastExcelStartTs = now;
    excelProcStarting = true; excelProcError=null; broadcastExcelStatus();
    try {
      // Resolve script path: prefer user override from store key excelScriptPath else fallback to ./excel_watcher.py
      let scriptPath = resolveExcelScriptPath();
      if(!scriptPath){ excelLog('script not found (resolveExcelScriptPath returned null)'); excelProcStarting=false; broadcastExcelStatus(); return; }
      // Pick python executable: allow store override (excelPythonPath) else rely on 'python'
      let py = 'python';
      try { const pyOverride = store.get('excelPythonPath'); if(pyOverride) py = pyOverride; } catch(_){}

      // Resolve workbook path (persisted). If missing/invalid, ask user to choose.
      let workbookPath = null;
      try {
        const saved = store.get('excelWorkbookPath');
        if(saved && typeof saved === 'string') workbookPath = saved.trim();
      } catch(_){ }
      try {
        if(!workbookPath || !fs.existsSync(workbookPath)){
          const picked = dialog && dialog.showOpenDialogSync ? dialog.showOpenDialogSync(mainWindow, {
            title: 'Select Excel workbook for extractor',
            properties: ['openFile'],
            filters: [
              { name: 'Excel', extensions: ['xlsm','xlsx','xls'] },
              { name: 'All Files', extensions: ['*'] }
            ]
          }) : null;
          if(!picked || !picked.length){
            excelProcError = 'Excel file not selected';
            excelProcStarting = false;
            broadcastExcelStatus();
            return;
          }
          workbookPath = picked[0];
          store.set('excelWorkbookPath', workbookPath);
          excelLog('excelWorkbookPath set', workbookPath);
        }
      } catch(err){
        excelProcError = 'File picker failed: '+(err && err.message ? err.message : String(err));
        excelProcStarting = false;
        broadcastExcelStatus();
        return;
      }

      // Use unbuffered mode (-u) to force immediate flush of stdout/stderr (so logs visible in board DevTools)
      const args = ['-u', scriptPath, '--file', workbookPath];
      const cwd = path.dirname(scriptPath);
      // Log all details before spawn
      excelLog('spawn attempt', JSON.stringify({ python:py, args, cwd, scriptPath }));
      // Quick absolute path existence check if user provided full path
      if(/[\\/]/.test(py)){
        try { if(!fs.existsSync(py)) excelLog('warning: python path does not exist:', py); } catch(_){ }
      }
      const spawnEnv = Object.assign({}, process.env, {
        PYTHONUNBUFFERED: '1',
        PYTHONIOENCODING: 'utf-8'
      });
      excelProc = spawn(py, args, { cwd, stdio:['ignore','pipe','pipe'], env: spawnEnv });
      excelLog('spawned pid', excelProc.pid, 'script', scriptPath);
      excelProc.on('spawn', ()=>{ excelProcStarting=false; broadcastExcelStatus(); });

      // Start AHK helper alongside Python extractor (non-fatal if missing)
      try { startAhkHelper(); } catch(_){ }
      // If user hasn't overridden excelDumpPath, set it to current script directory/current_state.json for watcher alignment
      try {
        const existingDump = store.get('excelDumpPath');
        const dumpCandidate = path.join(cwd, 'current_state.json');
        const needReset = !existingDump || path.dirname(existingDump) !== cwd || !fs.existsSync(existingDump);
        if(needReset){
          store.set('excelDumpPath', dumpCandidate);
          excelLog('excelDumpPath synced to', dumpCandidate, '(needReset=', needReset, ')');
        } else {
          excelLog('excelDumpPath ok', existingDump);
        }
      } catch(_){ }
      let stderrBuf='';
      let gotAnyOutput = false;
      let firstOutputTimer = setTimeout(()=>{
        if(!gotAnyOutput && excelProc){
          excelLog('no-output-first-4s: возможно скрипт ждёт Excel или не установлен pywin32. Убедитесь что: Excel открыт с нужной книгой и выполнен pip install pywin32');
        }
      }, 4000);
      function markOutput(){ if(!gotAnyOutput){ gotAnyOutput=true; try { clearTimeout(firstOutputTimer); } catch(_){ } } }
      excelProc.stdout.on('data', d=>{ try { markOutput(); const s=d.toString(); excelLog('[stdout]', s.trim()); if(/ERROR|Traceback|exception/i.test(s)) console.warn('[excel-extractor][stdout]', s.trim()); } catch(_){ } });
      excelProc.stderr.on('data', d=>{ try { markOutput(); const t=d.toString(); stderrBuf += t; excelLog('[stderr]', t.trim()); } catch(_){ } });
      excelProc.on('exit', (code, sig)=>{ 
        excelLog('exit code', code, 'sig', sig||'');
        try { clearTimeout(firstOutputTimer); } catch(_){ }
        if(code && code!==0){
          // Detect missing pywin32
          if(/pywin32/i.test(stderrBuf)){
            excelProcError = 'pywin32 не установлен (pip install pywin32)';
          } else {
            excelProcError = 'Exit code '+code;
          }
        } else if(sig){
          excelProcError = null; // normal manual stop
        }
        excelProc=null; excelProcStarting=false; broadcastExcelStatus();
      });
      broadcastExcelStatus();
    } catch(err){
      excelLog('spawn failed', err.message);
      excelProcError = err.message; excelProcStarting=false; excelProc=null; broadcastExcelStatus();
    }
  }
  function stopExcelExtractor(){
    // Stop both Python extractor and AHK helper
    try { if(excelProc){ console.log('[excel-extractor] stopping pid', excelProc.pid); excelProc.kill(); } } catch(_){ }
    try { stopAhkHelper(); } catch(_){ }
  }
  ipcMain.on('excel-extractor-toggle', ()=>{ try { if(excelProc || ahkProc){ stopExcelExtractor(); } else { startExcelExtractor(); } } catch(_){ } });
  ipcMain.handle('excel-extractor-status-get', ()=> ({
    running: !!excelProc,
    starting: excelProcStarting,
    error: excelProcError,
    installing: excelDepsInstalling,
    ahk: { running: !!ahkProc, starting: ahkProcStarting, error: ahkProcError }
  }));
  ipcMain.on('excel-extractor-set-path', (_e, p)=>{
    try {
      if(!p || typeof p !== 'string') return;
      const trimmed = p.trim();
      if(fs.existsSync(trimmed)){
        store.set('excelScriptPath', trimmed);
        console.log('[excel-extractor] custom path set', trimmed);
        // if process not running attempt immediate start for feedback
        if(!excelProc) startExcelExtractor(); else broadcastExcelStatus();
      } else {
        console.warn('[excel-extractor] set-path file does not exist', trimmed);
      }
    } catch(err){ console.warn('[excel-extractor] set-path error', err.message); }
  });
  // Broadcast initial status (not running)
  setTimeout(()=> broadcastExcelStatus(), 500);
  app.on('before-quit', ()=>{ try { stopExcelExtractor(); } catch(_){ } });
  // Dependency installer (currently only pywin32)
  ipcMain.on('excel-extractor-install-deps', ()=>{
    if(excelDepsInstalling) return;
    // Determine python exe (same logic as spawn)
    let py='python';
    try { const pyOverride = store.get('excelPythonPath'); if(pyOverride) py=pyOverride; } catch(_){ }
    excelDepsInstalling = true; excelProcError=null; broadcastExcelStatus();
    try {
      const inst = spawn(py, ['-m','pip','install','pywin32'], { stdio:['ignore','pipe','pipe'] });
      let errBuf='';
      inst.stdout.on('data', d=>{ try { console.log('[excel-extractor][install][stdout]', d.toString().trim()); } catch(_){ } });
      inst.stderr.on('data', d=>{ try { const s=d.toString(); errBuf+=s; console.warn('[excel-extractor][install][stderr]', s.trim()); } catch(_){ } });
      inst.on('exit', (code)=>{
        excelDepsInstalling=false;
        if(code===0){
          excelProcError=null;
          // Auto-start after successful install if not running
          setTimeout(()=>{ if(!excelProc) startExcelExtractor(); }, 400);
        } else {
          excelProcError = 'Install failed (code '+code+')';
        }
        broadcastExcelStatus();
      });
    } catch(err){ excelDepsInstalling=false; excelProcError = 'Install spawn err: '+err.message; broadcastExcelStatus(); }
  });
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
  try { statsState.panelHidden = !!statsManager.getPanelHidden?.(); } catch(_){ }
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
  try {
    if(statsManager && statsManager.getPanelHidden) statsState.panelHidden = !!statsManager.getPanelHidden();
    mainWindow.webContents.send('stats-state-updated', statsState);
  } catch(_){ }
}
// (duplicate early IPC init block removed; handled in bootstrap())

app.whenReady().then(()=>{
  bootstrap();
  initDevCssWatcher({ app, mainWindow, boardWindowRef:{ value: boardWindow }, statsManager, baseDir: __dirname });
  // Expose manual auto-press IPC for external automation or future menus
  try {
    const { ipcMain } = require('electron');
    if(!app.__autoPressHandlerRegistered){
      app.__autoPressHandlerRegistered=true;
      // Centralized de-duplication for F21 (suspend) presses across windows
      // Prevents double sends when both board and embedded stats AutoHubs trigger simultaneously,
      // and also when both schedule their 500ms retry. Separate buckets for initial and retry.
      let __lastF21SentAt = 0;
      let __lastF21RetrySentAt = 0;
      ipcMain.handle('send-auto-press', (_e, payload)=>{
        let side = 0; // default
        let vk = null; // explicit virtual key if provided (0x86 F23 / 0x87 F24)
        let keyLabel = null;
        let direction = null;
        let diffPct = null;
        let noConfirm = false; // if true, skip auto F22 scheduling (renderer will trigger confirm itself)
        let isRetry = false; // renderer may flag retry
        // Backward compat: numeric or undefined -> treat as side index like before (0->F23,1->F24)
        if(typeof payload === 'number'){
          side = (payload===1?1:0);
        } else if(payload && typeof payload === 'object'){
          if(typeof payload.side === 'number') side = (payload.side===1?1:0);
          if(typeof payload.key === 'string') keyLabel = payload.key.toUpperCase();
          if(typeof payload.direction === 'string') direction = payload.direction;
          if(typeof payload.diffPct === 'number') diffPct = payload.diffPct;
          if(payload.noConfirm===true) noConfirm = true;
          if(payload.retry===true) isRetry = true;
        }
  // Mapping rules override default if keyLabel present
  // F21 -> 0x84, F22 -> 0x85, F23 -> 0x86, F24 -> 0x87
  if(keyLabel === 'F21') vk = 0x84;
  else if(keyLabel === 'F22') vk = 0x85;
        else if(keyLabel === 'F23') vk = 0x86;
        else if(keyLabel === 'F24') vk = 0x87;
        // Only apply legacy side fallback when NO explicit keyLabel provided (avoid misinterpreting unknown keys like F22)
        if(vk==null && !keyLabel){
          vk = side===1 ? 0x87 : 0x86; keyLabel = side===1? 'F24':'F23';
        }
        if(keyLabel === 'F22'){ try { console.log('[auto-press][ipc] confirm request F22'); } catch(_){ } }
        // Normalize retry flag from direction suffix for older senders
        if(!isRetry && typeof direction === 'string' && direction.indexOf(':retry') !== -1){ isRetry = true; }
        // Global de-dup for F21 initial and retry
        if(keyLabel === 'F21'){
          const nowTs = Date.now();
          const initialWindowMs = 300; // collapse near-simultaneous initial F21
          const retryWindowMs = 400;   // collapse near-simultaneous retry F21 (~500ms schedules from multiple renderers)
          if(isRetry){
            if(nowTs - __lastF21RetrySentAt < retryWindowMs){
              try { console.log('[auto-press][ipc][dedupe] suppress F21 retry', { direction, ts: nowTs }); } catch(_){ }
              return true;
            }
            __lastF21RetrySentAt = nowTs;
          } else {
            if(nowTs - __lastF21SentAt < initialWindowMs){
              try { console.log('[auto-press][ipc][dedupe] suppress F21 initial', { direction, ts: nowTs }); } catch(_){ }
              return true;
            }
            __lastF21SentAt = nowTs;
          }
        }
        const ts = Date.now();
        try { console.log('[auto-press][ipc] request', { side, key:keyLabel, vk: '0x'+vk.toString(16), direction, diffPct, ts }); } catch(_){ }
        try {
          // Board (odds) view
          if(boardManager && boardManager.getWebContents){
            const bwc = boardManager.getWebContents();
            if(bwc && !bwc.isDestroyed()) bwc.send('auto-press', { side, key:keyLabel, direction });
          }
          // Main window (embedded stats lives here)
          if(mainWindow && !mainWindow.isDestroyed()){
            mainWindow.webContents.send('auto-press', { side, key:keyLabel, direction });
          }
          // Stats panel/window + slots if present
          if(statsManager && statsManager.views){
            const vs = statsManager.views;
            ['panel','A','B'].forEach(k=>{ const v=vs[k]; if(v && v.webContents && !v.webContents.isDestroyed()){ try { v.webContents.send('auto-press', { side, key:keyLabel, direction }); } catch(_){ } } });
          }
        } catch(err){ try { console.warn('[auto-press][ipc] send fail', err); } catch(_){ } }
        let sent=false;
  // Always write a file signal so AHK can react even if virtual key injection is blocked
  try { fs.writeFileSync(path.join(__dirname,'auto_press_signal.json'), JSON.stringify({ side, key:keyLabel, direction, ts })); } catch(_){ }
        // Only SendInput via helper script using F22/F23/F24 virtual keys (0x85/0x86/0x87) so AHK v2 can hook them.
        try {
          const { exec } = require('child_process');
            const injVk = vk; // already resolved mapping
            if(typeof __sendInputScriptPath !== 'undefined' && __sendInputScriptPath && injVk!=null){
              const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -File "${__sendInputScriptPath}" ${injVk}`;
              exec(cmd, (err)=>{
                const dbg = { side, key:keyLabel, direction, diffPct, tsStart: ts, injVk, cmd, ok: !err, err: err? err.message: null, tsDone: Date.now() };
                try { fs.writeFileSync(path.join(__dirname,'auto_press_debug.json'), JSON.stringify(dbg)); } catch(_){ }
                if(err){ try { console.warn('[auto-press][ipc][si] FAIL', err.message); } catch(_){ } }
                else { try { console.log('[auto-press][ipc][si] SENT', keyLabel, 'injVk', injVk); } catch(_){ } }
              });
              sent=true;
              // AUTO CONFIRM: if this was a directional key (F23/F24) schedule F22 after 100ms
              if(!noConfirm && (keyLabel==='F23' || keyLabel==='F24')){
                const confirmDelayMs = 100;
                const confirmVk = 0x85; // F22
                setTimeout(()=>{
                  try {
                    const confirmCmd = `powershell -NoProfile -ExecutionPolicy Bypass -File "${__sendInputScriptPath}" ${confirmVk}`;
                    exec(confirmCmd, (cerr)=>{
                      const cdbg = { kind:'confirm', parentKey:keyLabel, confirmKey:'F22', confirmVk, confirmCmd, ok: !cerr, err: cerr? cerr.message: null, tsParent: ts, tsDone: Date.now() };
                      try { fs.writeFileSync(path.join(__dirname,'auto_press_confirm_debug.json'), JSON.stringify(cdbg)); } catch(_){ }
                      if(cerr){ try { console.warn('[auto-press][ipc][confirm] FAIL', cerr.message); } catch(_){ } }
                      else { try { console.log('[auto-press][ipc][confirm] SENT F22 after', confirmDelayMs,'ms'); } catch(_){ } }
                    });
                  } catch(e2){ try { console.warn('[auto-press][ipc][confirm] schedule error', e2.message); } catch(_){ } }
                }, confirmDelayMs);
              }
            }
        } catch(e){ try { console.warn('[auto-press][ipc][si] unavailable', e.message); } catch(_){ } }
        if(!sent){
          try { fs.writeFileSync(path.join(__dirname,'auto_press_signal.json'), JSON.stringify({ side, key:keyLabel, direction, ts })); } catch(_){ }
        }
        return true;
      });
      // Additional passive logging channels from renderer
      ipcMain.on('auto-mode-changed', (_e, payload)=>{ try { console.log('[autoSim][mode]', payload); } catch(_){ } });
      // Relay auto mode ON/OFF across views so board and embedded stay in sync
      ipcMain.on('auto-mode-changed', (_e, payload)=>{
        try {
          const on = !!(payload && payload.active);
          // send to board
          try {
            const bwc = (typeof boardWindow!=='undefined' && boardWindow && !boardWindow.isDestroyed()) ? boardWindow.webContents : (boardManager && boardManager.getWebContents ? boardManager.getWebContents() : null);
            if(bwc && !bwc.isDestroyed()) bwc.send('auto-set-all', { on });
          } catch(_){ }
          // send to main window (embedded) + stats views
          try { mainWindow && mainWindow.webContents && mainWindow.webContents.send('auto-set-all', { on }); } catch(_){ }
          try {
            if(statsManager && statsManager.views){
              const vs = statsManager.views;
              ['panel','A','B'].forEach(k=>{ const v=vs[k]; if(v && v.webContents && !v.webContents.isDestroyed()){ try { v.webContents.send('auto-set-all', { on }); } catch(_){ } } });
            }
          } catch(_){ }
        } catch(_){ }
      });
      ipcMain.on('auto-fire-attempt', (_e, payload)=>{ try { console.log('[autoSim][fireAttempt]', payload); } catch(_){ } });
      // Store last auto states to serve late-loaded windows
      ipcMain.on('auto-active-set', (_e, p)=>{ try { __autoLast.active = !!(p&&p.on); } catch(_){ } try {
        const bwc = (typeof boardWindow!=='undefined' && boardWindow && !boardWindow.isDestroyed()) ? boardWindow.webContents : (boardManager && boardManager.getWebContents ? boardManager.getWebContents() : null);
        if(bwc && !bwc.isDestroyed()) bwc.send('auto-active-set', p);
        mainWindow && mainWindow.webContents && mainWindow.webContents.send('auto-active-set', p);
        if(statsManager && statsManager.views){ const vs=statsManager.views; ['panel','A','B'].forEach(k=>{ const v=vs[k]; if(v && v.webContents && !v.webContents.isDestroyed()){ v.webContents.send('auto-active-set', p); } }); }
      } catch(_){ } });
      ipcMain.on('auto-resume-set', (_e, p)=>{ try { __autoLast.resume = !!(p&&p.on); } catch(_){ } });
  ipcMain.handle('auto-state-get', ()=> { try { console.log('[auto][state-get] return', { active: __autoLast.active, resume: __autoLast.resume }); } catch(_){ } return ({ active: __autoLast.active, resume: __autoLast.resume }); });
      // Cross-window sync for Auto Resume (R)
      ipcMain.on('auto-resume-set', (_e, p)=>{
        try {
          const bwc = (typeof boardWindow!=='undefined' && boardWindow && !boardWindow.isDestroyed()) ? boardWindow.webContents : (boardManager && boardManager.getWebContents ? boardManager.getWebContents() : null);
          if(bwc && !bwc.isDestroyed()) bwc.send('auto-resume-set', p);
        } catch(_){ }
        try { mainWindow && mainWindow.webContents && mainWindow.webContents.send('auto-resume-set', p); } catch(_){ }
        try {
          if(statsManager && statsManager.views){
            const vs = statsManager.views;
            ['panel','A','B'].forEach(k=>{ const v=vs[k]; if(v && v.webContents && !v.webContents.isDestroyed()){ try { v.webContents.send('auto-resume-set', p); } catch(_){ } } });
          }
        } catch(_){ }
        try { console.log('[auto][resume-broadcast]', p); } catch(_){ }
      });
      // Forwarded renderer console lines (selective)
      ipcMain.on('renderer-log-forward', (_e, payload)=>{
        try {
          if(!payload || !payload.level) return;
          const line = '[renderer][fwd]['+payload.level+'] '+ (payload.args? payload.args.join(' '):'');
          console[payload.level] ? console[payload.level](line) : console.log(line);
        } catch(err){ try { console.warn('[renderer-log-forward] fail', err.message); } catch(_){} }
      });
    }
  } catch(e){ console.warn('[ipc][send-auto-press] register failed', e); }
  // Register global shortcut for opening Stats Log window
  try {
    if(globalShortcut.isRegistered('Control+Alt+L')) globalShortcut.unregister('Control+Alt+L');
    const ok = globalShortcut.register('Control+Alt+L', () => {
      try { openStatsLogWindow(); } catch(e){ console.warn('[shortcut][stats-log] open failed', e); }
    });
    if(!ok) console.warn('[shortcut][stats-log] registration returned false');
    else console.log('[shortcut][stats-log] registered Ctrl+Alt+L');
    // Global Numpad5 toggle for auto modes (board + embedded stats) even when app not focused
    try {
      // Try several accelerator variants to improve cross-OS/keyboard reliability
      const candidates = ['Num5','Numpad5','num5'];
      const handler = () => {
        try {
          const broadcastAutoToggleAll = ()=>{
            try {
              const bwc = (typeof boardWindow!=='undefined' && boardWindow && !boardWindow.isDestroyed()) ? boardWindow.webContents : (boardManager && boardManager.getWebContents ? boardManager.getWebContents() : null);
              if(bwc && !bwc.isDestroyed()) bwc.send('auto-toggle-all');
            } catch(_){ }
            try { mainWindow && mainWindow.webContents && mainWindow.webContents.send('auto-toggle-all'); } catch(_){ }
            try {
              if(statsManager && statsManager.views){
                const vs = statsManager.views;
                ['panel','A','B'].forEach(k=>{ const v=vs[k]; if(v && v.webContents && !v.webContents.isDestroyed()){ try { v.webContents.send('auto-toggle-all'); } catch(_){ } } });
              }
            } catch(_){ }
          };
          broadcastAutoToggleAll();
          try { console.log('[hotkey][global][Num5] broadcast auto-toggle-all'); } catch(_){ }
        } catch(err){ console.warn('[hotkey][global][Num5] failed', err); }
      };
      let registeredWith = null;
      for(const key of candidates){
        try { if(globalShortcut.isRegistered(key)) globalShortcut.unregister(key); } catch(_){}
        try {
          if(globalShortcut.register(key, handler)){ registeredWith = key; break; }
        } catch(_){ /* try next */ }
      }
      if(!registeredWith) console.warn('[shortcut][Num5] registration returned false (tried: '+candidates.join(', ')+')');
      else console.log('[shortcut][Num5] registered global as', registeredWith);
    } catch(e){ console.warn('[shortcut][Num5] registration error', e); }
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
        // Numpad5 fallback (if global shortcut didn't register on this OS)
        try {
          const isNum5 = (String(input.code||'').toLowerCase()==='numpad5') || ((input.key==='5' || input.key==='Num5') && input.location===3);
          if(isNum5){
            const broadcast = ()=>{
              try {
                const bwc = (typeof boardWindow!=='undefined' && boardWindow && !boardWindow.isDestroyed()) ? boardWindow.webContents : (boardManager && boardManager.getWebContents ? boardManager.getWebContents() : null);
                if(bwc && !bwc.isDestroyed()) bwc.send('auto-toggle-all');
              } catch(_){ }
              try { mainWindow && mainWindow.webContents && mainWindow.webContents.send('auto-toggle-all'); } catch(_){ }
              try {
                if(statsManager && statsManager.views){
                  const vs = statsManager.views;
                  ['panel','A','B'].forEach(k=>{ const v=vs[k]; if(v && v.webContents && !v.webContents.isDestroyed()){ try { v.webContents.send('auto-toggle-all'); } catch(_){ } } });
                }
              } catch(_){ }
            };
            broadcast();
            try { console.log('[hotkey][window][Num5] broadcast auto-toggle-all'); } catch(_){ }
            return;
          }
        } catch(_){ }
        // Ctrl+F12 -> open Board (odds) BrowserView DevTools
        if(input.key==='F12' && input.control){
          try {
            if(boardManager && boardManager.getWebContents){
              const bwc = boardManager.getWebContents();
              if(bwc) bwc.openDevTools({ mode:'detach' });
            }
          } catch(e){ console.warn('[hotkey][Ctrl+F12][board] failed', e); }
          return;
        }
        // F12 (no Ctrl) -> open devtools (active broker if possible else main window)
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
        // Alt+C -> disable all auto modes (board + embedded stats)
        if(input.alt && (input.key==='C' || input.key==='c')){
          try {
            // Broadcast to board window if open
            if(boardWindow && !boardWindow.isDestroyed()) boardWindow.webContents.send('auto-disable-all');
            // Broadcast to main window embedded stats panel & stats window BrowserViews
            try { mainWindow && mainWindow.webContents.send('auto-disable-all'); } catch(_){ }
            try {
              if(statsManager && statsManager.views){
                const vs = statsManager.views;
                ['panel','A','B'].forEach(k=>{ const v=vs[k]; if(v && v.webContents && !v.webContents.isDestroyed()){ try { v.webContents.send('auto-disable-all'); } catch(_){ } } });
              }
            } catch(_){ }
            console.log('[hotkey][Alt+C] broadcast auto-disable-all');
          } catch(e){ console.warn('[hotkey][Alt+C] failed', e); }
          return;
        }
        // Ctrl+Alt+L opens (or focuses) the Stats Log window (fallback if global shortcut unavailable)
        if((input.control || input.meta) && input.alt && (input.key==='L' || input.key==='l')){
          try { openStatsLogWindow(); } catch(e){ console.warn('[shortcut][stats-log][fallback] open failed', e); }
          return;
        }
        // Manual auto odds press mapping remains for brackets BUT internal automation now emits only F23/F24.
        if(input.key==='[' || input.key===']'){
          try {
            const side = input.key===']' ? 1 : 0;
            if(boardManager && boardManager.getWebContents){
              const bwc = boardManager.getWebContents();
              if(bwc && !bwc.isDestroyed()) bwc.send('auto-press', { side });
            }
            const ts = Date.now();
            try { console.log('[auto-press][hotkey] attempt side', side, 'key', input.key, 'ts', ts); } catch(_){ }
            let sent=false;
            // Send only F23/F24 (do not resend bracket)
            try {
              const { exec } = require('child_process');
              const injVk = side===1 ? 0x87 : 0x86;
              if(typeof __sendInputScriptPath !== 'undefined' && __sendInputScriptPath){
                const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -File \"${__sendInputScriptPath}\" ${injVk}`;
                exec(cmd, (err)=>{
                  if(err){ try { console.warn('[auto-press][hotkey][si] FAIL', err.message); } catch(_){ } }
                  else { try { console.log('[auto-press][hotkey][si] SENT injVk', injVk); } catch(_){ } }
                });
                sent=true;
              }
            } catch(e){ try { console.warn('[auto-press][hotkey][si] unavailable', e.message); } catch(_){ } }
            if(!sent){
              try { fs.writeFileSync(path.join(__dirname,'auto_press_signal.json'), JSON.stringify({ side, ts })); } catch(_){ }
            }
          } catch(e){ console.warn('[hotkey][auto-press] send failed', e); }
          return; // prevent fallthrough
        }
      }
    });
  } catch(_) {}
});
app.on('before-quit', ()=>{ quittingRef.value=true; });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

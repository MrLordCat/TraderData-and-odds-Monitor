const { app, BrowserWindow, ipcMain, screen, Menu, globalShortcut, dialog } = require('electron');

// Enable WebGL for addons (Power Towers TD)
// v0.2.5 dev build - extractors modular, esbuild bundles
app.commandLine.appendSwitch('ignore-gpu-blacklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('enable-features', 'VaapiVideoDecoder');

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
// One-time migration: old gsHeatBar.decayPerSec values > 1 are seconds, convert to rate
{ const hb = store.get('gsHeatBar'); if(hb && typeof hb.decayPerSec === 'number' && hb.decayPerSec > 1) { store.set('gsHeatBar', { ...hb, decayPerSec: 1 / hb.decayPerSec }); } }
const fs = require('fs');
const { exec } = require('child_process');
// Centralized shared constants (direct import to avoid circular barrel dependency)
const constants = require('./modules/utils/constants');
// Broadcast helper (eliminates repeated board/main/stats iteration)
const { broadcastToAll, getBoardWebContents, getStatsWebContentsList } = require('./modules/utils/broadcast');
// Local constants (some consumed by modularized managers)
const SNAP = constants.SNAP_DISTANCE; // snap threshold for drag/resize logic (needed by brokerManager ctx)

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

// Open main window DevTools (renderer console)
ipcMain.on('open-main-devtools', () => {
  try {
    if(mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  } catch(e){ console.warn('openMainDevTools failed', e); }
});

// Open user data folder (contains logs, settings, addons)
ipcMain.on('open-userdata-folder', () => {
  try {
    const { shell } = require('electron');
    shell.openPath(app.getPath('userData'));
  } catch(e){ console.warn('openUserDataFolder failed', e); }
});

// Reapply stored map & team names after broker navigation (atomic config approach)
function scheduleMapReapply(view){
  try {
    if(!view || view.isDestroyed()) return;
    const lastMap = store.get('lastMap');
    const teamNames = store.get('lolTeamNames');
    // Default map when nothing persisted yet
    const defaultMap = 1;
    const mapToApply = (typeof lastMap !== 'undefined') ? lastMap : defaultMap;
    const isLastFlag = !!store.get('isLast');
    // Send atomic config with both map and isLast to avoid race conditions
    const config = { map: mapToApply, isLast: isLastFlag };
    const delays = [400, 1400, 3000, 5000];
    delays.forEach(d=> setTimeout(()=>{
      try {
        if(view.isDestroyed()) return;
        // Atomic map config - broker receives both values together
        view.webContents.send('set-map-config', config);
        if(teamNames) view.webContents.send('set-team-names', teamNames);
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
  process.on('unhandledRejection', (reason, p)=>{ console.warn('[unhandledRejection]', reason); });
  process.on('uncaughtException', (err)=>{ console.error('[uncaughtException]', err); });
} catch(_){}

// --- Handle --apply-update argument (run update script before app starts) ---
try {
  const updateArgIdx = process.argv.indexOf('--apply-update');
  if (updateArgIdx !== -1 && process.argv[updateArgIdx + 1]) {
    const updateScript = process.argv[updateArgIdx + 1];
    console.log('[updater] Applying update via script:', updateScript);
    // Run batch file hidden using wscript
    const vbsPath = updateScript.replace('.bat', '.vbs');
    const vbs = `CreateObject("WScript.Shell").Run """${updateScript.replace(/\\/g, '\\\\')}""", 0, False`;
    require('fs').writeFileSync(vbsPath, vbs);
    exec(`wscript "${vbsPath}"`, { windowsHide: true });
    // Give it time to start
    setTimeout(() => process.exit(0), 300);
    return;
  }
} catch (e) {
  console.warn('[updater] apply-update handler failed:', e.message);
}

// Placeholder odds broadcaster now uses shared util factory
const { makePlaceholderOdds } = require('./modules/utils/odds');
function broadcastPlaceholderOdds(id){
  try {
    const payload = makePlaceholderOdds(id);
    broadcastToAll(getBroadcastCtx(), 'odds-update', payload);
    try { if(boardManager && boardManager.sendOdds) boardManager.sendOdds(payload); } catch(_){ }
  } catch(err){ console.warn('broadcastPlaceholderOdds failed', err); }
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
  { id: 'bet365', url: 'https://www.bet365.ee/?_h=YWr28275L1TkpH0FsQpP8g%3D%3D&btsffd=1#/IP/B151' },
  { id: 'parimatch', url: 'https://pm-bet.kz/en/e-sports/live' },
  { id: 'simulator', url: 'file://' + path.join(__dirname, '..', 'renderer', 'pages', 'simulator.html').replace(/\\/g, '/') }
];
const INITIAL_URLS = BROKERS.reduce((acc,b)=>{acc[b.id]=b.url;return acc;},{});

// Subtle frame CSS injected into each broker view for consistent visual borders
const BROKER_FRAME_CSS = `body::after{content:"";position:fixed;inset:0;pointer-events:none;border:1px solid rgba(255,255,255,0.08);border-radius:10px;box-shadow:0 0 0 1px rgba(255,255,255,0.04) inset;}body{background-clip:padding-box !important;}`;

let mainWindow;
let boardManager; // docking/board manager (docked panel replaced separate boardWindow)
const boardManagerRef = { value: null };
let settingsOverlay; // module instance
let hotkeys; // unified hotkey manager (TAB/F1/F2/F3)
const hotkeysRef = { value: null };
// Helper to get broadcast context (avoids inline repetition)
const getBroadcastCtx = () => ({ mainWindow, boardManager, statsManager });

// === Auto State Management (centralized in main process) ===
// Cross-window auto state snapshot (used by hotkeys and late-loaded views)
// Requirement: Auto Resume (R) must start OFF on every app launch.
let __autoLast = { active:false, resume:false };

// Unified broadcast for auto-toggle-all (triggers toggle in renderer)
function broadcastAutoToggleAll(){
  console.log('[main] broadcastAutoToggleAll called');
  broadcastToAll(getBroadcastCtx(), 'auto-toggle-all', {});
}
// BrowserView registry & state caches (restored after accidental removal in refactor)
const views = {}; // id -> BrowserView
let activeBrokerIds = []; // ordered list of currently opened broker ids
const latestOdds = {}; // brokerId -> last odds payload
const latestOddsRef = { value: latestOdds };
// Shared odds forwarding (board + stats panel + latestOddsRef cache)
function forwardOdds(p){
  try { if(boardManager && boardManager.sendOdds) boardManager.sendOdds(p); } catch(_){ }
  try { if(statsManager?.views?.panel?.webContents && !statsManager.views.panel.webContents.isDestroyed()) statsManager.views.panel.webContents.send('odds-update', p); } catch(_){ }
  try { if(latestOddsRef.value) latestOddsRef.value[p.broker] = p; } catch(_){ }
}
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
const brokerHealth = {}; // id -> { lastChange, lastOdds, lastRefresh, missingStart }
const HEALTH_CHECK_INTERVAL = constants.HEALTH_CHECK_INTERVAL; // 10s check interval
// Persisted auto-refresh feature flag (default ON when undefined)
let autoRefreshEnabled = (()=>{ const v = store.get('autoRefreshEnabled'); return (v === undefined ? true : !!v); })();
// Track initial load/network failures to retry before showing fallback error page
const loadFailures = {}; // id -> count
// Zoom manager (extracted module)
const { createZoomManager } = require('./modules/zoom/');
const zoom = createZoomManager({ store, views });
// Stats manager (initialized after stageBoundsRef defined; recreated once mainWindow exists)
const { createStatsManager } = require('./modules/stats/');
let statsManager; // temporary undefined until after stageBoundsRef creation
let statsState = { mode: 'hidden' }; // 'hidden' | 'embedded'
let lastStatsToggleTs = 0; // throttle for space hotkey
// Dev helper moved to dev/devCssWatcher.js
const { initDevCssWatcher } = require('./modules/dev/devCssWatcher');
// Early refs required by statsManager; define before first createStatsManager call
let stageBounds = { x: 0, y: 300, width: 1600, height: 600 }; // initial placeholder; updated later
const stageBoundsRef = { value: stageBounds };
const quittingRef = { value:false };
statsManager = createStatsManager({ store, mainWindow: null, stageBoundsRef, quittingRef });

// Layout manager (needs refs defined above)
const { createLayoutManager } = require('./modules/layout/');
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
const { initSwapIpc } = require('./modules/ipc/swap');
const { initExcelExtractorIpc } = require('./modules/ipc/excelExtractor');
// Updater module for auto-updates (stable releases + dev commits)
const { createUpdateManager } = require('./modules/updater');
const { initUpdaterIpc } = require('./modules/ipc/updater');
// Addon Manager for loading external modules
const { createAddonManager } = require('./modules/addonManager');
const { registerAddonIpc } = require('./modules/ipc/addons');
// Module detach for sidebar modules (used by addons)
const { registerModuleDetachIpc, closeAllDetachedWindows } = require('./modules/ipc/moduleDetach');
// Extension Bridge for Edge upTime extension
const { createExtensionBridge } = require('./modules/extensionBridge');
const { createExtensionInstaller } = require('./modules/extensionBridge/installer');
const { initExtensionBridgeIpc } = require('./modules/ipc/extensionBridge');
let extensionBridge = null; // initialized in bootstrap()
let extensionInstaller = null; // initialized in bootstrap()
const extensionBridgeRef = { value: null }; // ref for IPC modules
let addonManager = null; // initialized in bootstrap()
let updateManager = null; // initialized in bootstrap()
// External Excel odds JSON watcher (pseudo broker 'excel')
const { createExcelWatcher } = require('./modules/excelWatcher');
const { createExcelExtractorController } = require('./modules/excelExtractorController');
const { createSplashManager } = require('./modules/splash');
let excelExtractorController = null; // initialized in bootstrap()
let splashManager = null; // splash screen manager
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
    show: false, // Hidden initially, shown after splash warm-up
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preloads', 'main.js'), sandbox: false }
  });
  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'pages', 'index.html'));
  // Determine if we should maximize (but don't do it yet - splash will handle it)
  let shouldMaximize = !saved;
  if(saved){
    const wa = screen.getPrimaryDisplay().workArea;
    if(saved.width >= wa.width * 0.90 && saved.height >= wa.height * 0.90) shouldMaximize = true;
  }
  // Store maximize flag for splash to use
  mainWindow.__shouldMaximize = shouldMaximize;
  mainWindow.on('close', () => {
    try { store.set('mainBounds', mainWindow.getBounds()); } catch(e) {}
    try { closeAllDetachedWindows(); } catch(e) {}
  });
  // Auto-focus mainWindow webContents after load so hotkeys work immediately
  mainWindow.webContents.once('did-finish-load', () => {
    try { setTimeout(()=>{ if(mainWindow && !mainWindow.isDestroyed()) { mainWindow.focus(); mainWindow.webContents.focus(); } }, 100); } catch(_){ }
  });
  // late injection for layout manager (mutable ref)
  layoutManager.setMainWindow(mainWindow);
  // Recreate stats manager now that mainWindow exists (enables embedded stats creation)
  try {
    const prevMode = statsState.mode;
  statsManager = createStatsManager({ store, mainWindow, stageBoundsRef, quittingRef });
    // Keep previous mode only if window mode requested; embedded cannot be auto-restored yet
    statsState.mode = (prevMode === 'window') ? 'window' : 'hidden';
  } catch(e){ console.warn('Failed to re-init statsManager with mainWindow', e); }
}

// Settings overlay now in module
const { createSettingsOverlay } = require('./modules/settingsOverlay');

// Hotkeys manager
const { createHotkeyManager } = require('./modules/hotkeys');

// Broker manager module
const { createBrokerManager } = require('./modules/brokerManager/');
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

const { createStaleMonitor } = require('./modules/staleMonitor/');
let staleMonitor;
// IPC modularized handlers
const { initMapIpc } = require('./modules/ipc/map');
const { initSettingsIpc } = require('./modules/ipc/settings');
const { initBrokerIpc } = require('./modules/ipc/brokers');
const { initLayoutIpc } = require('./modules/ipc/layout');
const { initThemeIpc } = require('./modules/ipc/theme');

// inline dev watcher removed (moved to modules/dev/devCssWatcher.js)

function bootstrap() {
  // --- Show Splash Screen ---
  splashManager = createSplashManager({ app });
  splashManager.create();
  
  // First-run defaults: don't auto-open any brokers.
  // Also handle upgrades/migrations where `disabledBrokers` key might be missing.
  try {
    const hasLaunched = !!store.get('hasLaunched');
    const disabledRaw = store.get('disabledBrokers');
    const disabledValid = Array.isArray(disabledRaw);
    if (!hasLaunched || !disabledValid) {
      // If it's truly first run OR legacy prefs are missing/invalid, start with 0 active brokers.
      try { store.set('disabledBrokers', BROKERS.map(b => b.id)); } catch(_) {}
      try { store.set('hasLaunched', true); } catch(_) {}
    }
  } catch(_) {}
  
  // Update splash progress
  splashManager.updateProgress(10, 'Creating main window...');
  
  createMainWindow();
  splashManager.setMainWindow(mainWindow);
  
  // Remove application menu (hidden UI footprint)
  try { Menu.setApplicationMenu(null); } catch(_){}

  hotkeys = createHotkeyManager({
    actions: {
      toggleStats: ()=>{ try { toggleStatsEmbedded(); } catch(_){ } },
      toggleAuto: ()=>{ try { broadcastAutoToggleAll(); } catch(_){ } },
      startScript: ()=>{ try { if(excelExtractorController && excelExtractorController.toggle) excelExtractorController.toggle(); } catch(_){ } },
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
  // Initialize theme IPC
  initThemeIpc({ store, statsManager });
  brokerManager = createBrokerManager({
    BROKERS, store, views, zoom, layoutManager, scheduleMapReapply,
    broadcastPlaceholderOdds, SNAP, GAP, stageBoundsRef, activeBrokerIdsRef,
    brokerHealth, loadFailures, BROKER_FRAME_CSS,
    mainWindow,
    hotkeys,
  onActiveListChanged: (list)=>{ activeBrokerIds = list; activeBrokerIdsRef.value = list; }
  });
  // Initialize broker-related IPC now that brokerManager exists
  initBrokerIpc({ ipcMain, store, views, brokerManager, statsManager, mainWindow, boardManagerRef, brokerHealth, latestOddsRef, zoom, SNAP, stageBoundsRef });
  // Layout IPC (needs layoutManager + refs ready)
  initLayoutIpc({ ipcMain, store, layoutManager, views, stageBoundsRef, boardManager, statsManager });
  brokerManager.createAll();
  // Board manager (virtual - no longer creates its own BrowserView)
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
  boardManagerRef.value = boardManager;

  // Hotkeys were created after statsManager; inject so fresh stats views get handlers.
  try { if(statsManager && typeof statsManager.setHotkeys==='function') statsManager.setHotkeys(hotkeys); } catch(_){ }
  
  // Link boardManager and statsManager for unified panel
  try { if(statsManager && typeof statsManager.setBoardManagerRef==='function') statsManager.setBoardManagerRef(boardManagerRef); } catch(_){ }
  
  // Create unified side panel (stats panel is now always docked)
  try {
    const offsetY = stageBoundsRef && stageBoundsRef.value ? Number(stageBoundsRef.value.y) : 0;
    statsManager.createPanel(offsetY);
    // Link panel view to boardManager for odds forwarding
    const panelView = statsManager.getPanelView && statsManager.getPanelView();
    if(panelView && boardManager.setStatsPanelRef){
      boardManager.setStatsPanelRef({ value: panelView });
    }
  } catch(e){ console.warn('[bootstrap] createPanel failed', e.message); }
  
  // Initialize boardManager after panel is created
  boardManager.init();
  
  // Initialize excel watcher after board manager so early odds push displays
  try {
    if(!global.__excelWatcher){
      const forward = (p)=>{
        forwardOdds(p);
        // Keep a global last Excel odds snapshot for stats panel late load replay
        try { global.__lastExcelOdds = p; } catch(_){ }
      };
      global.__excelWatcher = createExcelWatcher({ win: mainWindow, store, sendOdds: forward, statsManager, boardManager, extensionBridgeRef, verbose: false });
    }
  } catch(e){ console.warn('[excel][watcher] init failed', e.message); }
  // Initialize map selection IPC (needs boardManager, statsManager, mainWindow references)
  initMapIpc({ ipcMain, store, views, mainWindow, boardManager, statsManager, extensionBridgeRef });
  // Initialize broker refresh settings IPC (must be before mapAutoRefresh so it can listen to settings changes)
  try {
    const { initBrokerRefreshIpc } = require('./modules/ipc/brokerRefresh');
    initBrokerRefreshIpc({ ipcMain, store });
  } catch(e){ console.warn('initBrokerRefreshIpc failed', e.message); }
  // Initialize periodic map re-broadcast (odds refresh auto loop)
  try {
    const { initMapAutoRefreshIpc } = require('./modules/ipc/mapAutoRefresh');
  initMapAutoRefreshIpc({ ipcMain, store, mainWindow, boardManager, statsManager, views, latestOddsRef, activeBrokerIdsRef });
  } catch(e){ console.warn('initMapAutoRefreshIpc failed', e.message); }
  // Lightweight IPC to fetch last excel odds (used by stats panel / board after load to avoid needing map reselect)
  try {
    ipcMain.handle('excel-last-odds', ()=>{ return global.__lastExcelOdds || null; });
  } catch(_){ }
  // Board IPC wiring now modular
  const { initBoardIpc } = require('./modules/ipc/board');
  initBoardIpc({ ipcMain, boardManager, statsManager });
  // Now that boardManager & statsManager are finalized, initialize IPC modules that depend on them
  try { initTeamNamesIpc({ ipcMain, store, boardManager, mainWindow, statsManager, lolTeamNamesRef }); } catch(e){ console.warn('initTeamNamesIpc failed', e); }
  try { initSwapIpc({ ipcMain, store, boardManager, mainWindow, statsManager }); } catch(e){ console.warn('initSwapIpc failed', e); }
  try { initAutoRefreshIpc({ ipcMain, store, mainWindow, autoRefreshEnabledRef }); } catch(e){ console.warn('initAutoRefreshIpc failed', e); }
  try { initStatsIpc({ ipcMain, statsManager, views, stageBoundsRef, mainWindow, boardManager, toggleStatsEmbedded, refs:{ statsState, lastStatsToggleTs }, store }); } catch(e){ console.warn('initStatsIpc (deferred) failed', e); }
  // -------- Excel extractor (Python + AHK) process control --------
  // Thin wiring: controller owns process lifecycle & status broadcasting.
  excelExtractorController = createExcelExtractorController({
    app,
    store,
    dialog,
    getMainWindow: () => mainWindow,
    getBoardWebContents: () => getBoardWebContents(getBroadcastCtx()),
    getStatsWebContentsList: () => getStatsWebContentsList(getBroadcastCtx())
  });
  initExcelExtractorIpc({ ipcMain, controller: excelExtractorController });
  // Expose mutable refs for diagnostic / future module hot-swap
  try { Object.defineProperty(global, '__oddsMoniSync', { value:{ autoRefreshEnabledRef, lolTeamNamesRef }, enumerable:false }); } catch(_){}
  staleMonitor = createStaleMonitor({ intervalMs: HEALTH_CHECK_INTERVAL, brokerHealth, views, store, onReload:(id)=>{ try { views[id].webContents.reloadIgnoringCache(); } catch(e){} } });
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
  // Auto-focus board webContents after initial load so hotkeys work immediately
  setTimeout(()=>{
    try {
      const bwc = boardManager && boardManager.getWebContents ? boardManager.getWebContents() : null;
      if(bwc && !bwc.isDestroyed()){ bwc.focus(); }
    } catch(_){ }
  }, 800);
  // --- Extension Bridge (upTime Edge extension) ---
  try {
    extensionInstaller = createExtensionInstaller({ store, app });
    extensionBridge = createExtensionBridge({
      store,
      port: 9876,
      onOddsUpdate: (payload) => {
        // Forward DS odds like any other broker
        forwardOdds(payload);
        // Broadcast to main window as well
        try { if(mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('odds-update', payload); } catch(_){ }
      },
      onConnect: ({ version, updateAvailable }) => {
        console.log('[extensionBridge] Extension connected, version:', version, 'updateAvailable:', updateAvailable);
        extensionInstaller.markExtensionConnected();
        // Send current map and Excel odds to extension
        const currentMap = store.get('lastMap') || 1;
        extensionBridge.sendCurrentMap(currentMap);
        // Send last Excel odds if available
        if(global.__lastExcelOdds){
          extensionBridge.sendExcelOdds(global.__lastExcelOdds.odds, global.__lastExcelOdds.map);
        }
        // Broadcast DS connected status to all renderer windows
        broadcastToAll(getBroadcastCtx(), 'ds-connected-changed', true);
      },
      onDisconnect: () => {
        console.log('[extensionBridge] Extension disconnected');
        broadcastToAll(getBroadcastCtx(), 'ds-connected-changed', false);
      }
    });
    extensionBridge.start();
    extensionBridgeRef.value = extensionBridge; // expose via ref for IPC modules
    initExtensionBridgeIpc({ extensionBridge, extensionInstaller, mainWindow, store });
    console.log('[extensionBridge] WebSocket server started on port 9876');
  } catch(e){ console.warn('[extensionBridge] init failed', e.message); }
  // --- Auto-Update Manager ---
  try {
    updateManager = createUpdateManager({ app, store, dialog, mainWindow });
    initUpdaterIpc({ ipcMain, updateManager });
    // Auto-check for updates on startup (with short delay to not block UI)
    setTimeout(() => {
      try { updateManager.init(); } catch(e){ console.warn('[updater] init failed', e.message); }
    }, 3000);
  } catch(e){ console.warn('[updater] createUpdateManager failed', e.message); }
  // --- Addon Manager ---
  try {
    addonManager = createAddonManager({ store, mainWindow });
    registerAddonIpc({ addonManager });
    registerModuleDetachIpc({ 
      mainWindow, 
      store, 
      getStatsWebContentsList: () => getStatsWebContentsList(getBroadcastCtx()) 
    });
    console.log('[addons] AddonManager initialized');
  } catch(e){ console.warn('[addons] createAddonManager failed', e.message); }
  
  // --- Splash Warm-up Tasks ---
  splashManager.updateProgress(60, 'Warming up UI...');

  /** Wait for webContents to finish loading, then delay. maxMs caps wait for external sites. */
  function waitForLoad(wc, delayMs, maxMs) {
    return new Promise(resolve => {
      if (!wc || !wc.isLoading()) return setTimeout(resolve, delayMs || 0);
      let done = false;
      const finish = () => { if(done) return; done = true; setTimeout(resolve, delayMs || 0); };
      wc.once('did-finish-load', finish);
      if(maxMs > 0) setTimeout(finish, maxMs);
    });
  }

  splashManager.registerTask('Loading main window...', () => waitForLoad(mainWindow.webContents));

  splashManager.registerTask('Preparing settings...', () => {
    try { if(settingsOverlay?.warmup) settingsOverlay.warmup(); } catch(e){ console.warn('[warmup] settings warmup failed', e.message); }
    const sv = settingsOverlay?.getView?.();
    if(sv?.webContents) return waitForLoad(sv.webContents, 100);
    return new Promise(resolve => setTimeout(resolve, 300));
  });

  const panelView = statsManager?.getPanelView?.();
  splashManager.registerTask('Initializing stats panel...', () => waitForLoad(panelView?.webContents, 200));

  splashManager.registerTask('Warming up theme transitions...', () => {
    // Collect ALL loaded webContents to warm up CSS transitions in each view
    const targets = [];
    try { if(mainWindow?.webContents && !mainWindow.webContents.isDestroyed()) targets.push(mainWindow.webContents); } catch(_){}
    try { const pv = statsManager?.getPanelView?.(); if(pv?.webContents && !pv.webContents.isDestroyed()) targets.push(pv.webContents); } catch(_){}
    try { const sv = settingsOverlay?.getView?.(); if(sv?.webContents && !sv.webContents.isDestroyed()) targets.push(sv.webContents); } catch(_){}
    try { ['A','B'].forEach(k=>{ const v = statsManager?.views?.[k]; if(v?.webContents && !v.webContents.isDestroyed()) targets.push(v.webContents); }); } catch(_){}
    // Collect slot views
    try { Object.entries(views).forEach(([id, v])=>{ if(id.startsWith('slot-') && v?.webContents && !v.webContents.isDestroyed()) targets.push(v.webContents); }); } catch(_){}

    if(!targets.length) return new Promise(r => setTimeout(r, 100));

    // JS snippet: toggle theme with opacity:0 so user doesn't see the flash, wait for transition, toggle back
    const warmupJS = `(function(){
      var root = document.documentElement, body = document.body;
      var cur = root.getAttribute('data-theme') || 'dark';
      var opp = cur === 'dark' ? 'light' : 'dark';
      body.style.opacity = '0'; body.style.pointerEvents = 'none';
      root.classList.add('theme-transitioning');
      root.setAttribute('data-theme', opp);
      void root.offsetHeight;
      return new Promise(function(resolve){
        setTimeout(function(){
          root.setAttribute('data-theme', cur);
          root.classList.remove('theme-transitioning');
          void root.offsetHeight;
          setTimeout(function(){
            body.style.opacity = ''; body.style.pointerEvents = '';
            resolve();
          }, 400);
        }, 400);
      });
    })()`;

    // Execute on all targets in parallel, then wait
    const promises = targets.map(wc => wc.executeJavaScript(warmupJS).catch(() => {}));
    return Promise.all(promises).then(() => new Promise(r => setTimeout(r, 50)));
  });

  splashManager.registerTask('Pre-loading stats views...', () => {
    try { statsManager?.warmupViews?.(); } catch(e){ console.warn('[warmup] stats views failed', e.message); }
    // Wait for both A/B to finish loading (cap 4s for external sites)
    const vA = statsManager?.views?.A;
    const vB = statsManager?.views?.B;
    const loadA = vA?.webContents ? waitForLoad(vA.webContents, 0, 4000) : Promise.resolve();
    const loadB = vB?.webContents ? waitForLoad(vB.webContents, 0, 4000) : Promise.resolve();
    return Promise.all([loadA, loadB]).then(() => new Promise(r => setTimeout(r, 100)));
  });
  
  // Run all tasks and show main window when done
  splashManager.runTasks().catch(e => {
    console.warn('[splash] runTasks error:', e.message);
    splashManager.forceClose();
  });
  
  // Safety timeout - if warm-up takes too long (>8 sec), force show
  setTimeout(() => {
    if (!splashManager.isReady) {
      console.warn('[splash] Force closing due to timeout');
      splashManager.forceClose();
    }
  }, 8000);
  
  // Menu intentionally suppressed (user prefers F12 only)
  // Removed broker-id partition probing to avoid creating unused persistent profiles
}

// buildAppMenu removed per user request (F12 hotkey only)

function toggleStatsEmbedded(){
  if(!mainWindow || mainWindow.isDestroyed()) return;
  
  // With unified panel architecture, stats toggle now shows/hides A/B views
  // Panel is always visible, only stats views (A/B) are toggled
  const isStatsActive = statsManager && statsManager.isStatsActive && statsManager.isStatsActive();
  
  if(!isStatsActive){
    // Show stats views (A/B)
    const offsetY = stageBoundsRef && stageBoundsRef.value ? Number(stageBoundsRef.value.y) : 0;
    console.log('[stats][toggle] createStatsViews with offsetY', offsetY);
    statsManager.createStatsViews(offsetY);
    statsState.mode = 'embedded';
  } else {
    // Hide stats views (A/B), panel remains visible
    statsManager.hideStatsViews();
    statsState.mode = 'hidden';
  }
  
  try {
    mainWindow.webContents.send('stats-state-updated', statsState);
  } catch(_){ }
}
// (duplicate early IPC init block removed; handled in bootstrap())

app.whenReady().then(()=>{
  bootstrap();
  initDevCssWatcher({ app, mainWindow, statsManager, baseDir: __dirname });
  // Auto-press IPC (extracted to modules/ipc/autoPress.js)
  try {
    const { initAutoPressIpc } = require('./modules/ipc/autoPress');
    initAutoPressIpc({ ipcMain, app, broadcastToAll, getBroadcastCtx, __autoLast, __sendInputScriptPath, broadcastAutoToggleAll });
  } catch(e){ console.warn('[ipc][send-auto-press] register failed', e); }
  // Global Numpad5 toggle for auto modes (board + embedded stats) even when app not focused
  try {
    // Try several accelerator variants to improve cross-OS/keyboard reliability
    const candidates = ['Num5','Numpad5','num5'];
      const handler = () => {
        try {
          broadcastAutoToggleAll();
          console.log('[hotkey][global][Num5] broadcast auto-toggle-all');
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
    } catch(e){ console.warn('[shortcut][Num5] registration error', e); }
});

app.on('will-quit', ()=>{ try { globalShortcut.unregisterAll(); } catch(_){} });
// Hotkey throttle state (prevents duplicate triggers)
let __lastHotkeyTs = { tab:0, f1:0, f2:0, f3:0 };
app.on('browser-window-created', (_e, win)=>{
  try {
    win.webContents.on('before-input-event', (_event, input)=>{
      if(input.type==='keyDown' && !input.isAutoRepeat){
        // Skip if modifier keys pressed (allow normal shortcuts)
        const hasModifier = input.alt || input.control || input.meta;
        // Tab -> toggle stats embedded (same as Space but more reliable without modifier guard)
        if(!hasModifier && input.key==='Tab'){
          const now=Date.now();
          if(now - __lastHotkeyTs.tab < 300) return;
          __lastHotkeyTs.tab = now;
          try { toggleStatsEmbedded(); } catch(_){ }
          return;
        }
        // F1 handled by hotkeys manager (modules/hotkeys/index.js) - no duplicate here
        // F3 -> start/stop excel extractor script
        if(!hasModifier && input.key==='F3'){
          const now=Date.now();
          if(now - __lastHotkeyTs.f3 < 500) return;
          __lastHotkeyTs.f3 = now;
          try { if(excelExtractorController && excelExtractorController.toggle) excelExtractorController.toggle(); } catch(_){ }
          return;
        }
        // Numpad5 handled by globalShortcut.register - no fallback needed (causes double toggle)
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
        // Alt+C -> disable all auto modes (board + embedded stats)
        if(input.alt && (input.key==='C' || input.key==='c')){
          try {
            broadcastToAll(getBroadcastCtx(), 'auto-disable-all');
            console.log('[hotkey][Alt+C] broadcast auto-disable-all');
          } catch(e){ console.warn('[hotkey][Alt+C] failed', e); }
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
            console.log('[auto-press][hotkey] attempt side', side, 'key', input.key, 'ts', ts);
            let sent=false;
            // Send only F23/F24 (do not resend bracket)
            try {
              const injVk = side===1 ? 0x87 : 0x86;
              if(typeof __sendInputScriptPath !== 'undefined' && __sendInputScriptPath){
                const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -File \"${__sendInputScriptPath}\" ${injVk}`;
                exec(cmd, (err)=>{
                  if(err){ console.warn('[auto-press][hotkey][si] FAIL', err.message); }
                  else { console.log('[auto-press][hotkey][si] SENT injVk', injVk); }
                });
                sent=true;
              }
            } catch(e){ console.warn('[auto-press][hotkey][si] unavailable', e.message); }
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
app.on('before-quit', ()=>{ 
  quittingRef.value=true; 
  try { closeAllDetachedWindows(); } catch(e){}
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

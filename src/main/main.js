const { app, BrowserWindow, BrowserView, ipcMain, screen, Menu, globalShortcut, dialog } = require('electron');

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
  process.on('unhandledRejection', (reason, p)=>{ try { console.warn('[unhandledRejection]', reason); } catch(_){} });
  process.on('uncaughtException', (err)=>{ try { console.error('[uncaughtException]', err); } catch(_){} });
} catch(_){}

// --- Handle --apply-update argument (run update script before app starts) ---
try {
  const updateArgIdx = process.argv.indexOf('--apply-update');
  if (updateArgIdx !== -1 && process.argv[updateArgIdx + 1]) {
    const updateScript = process.argv[updateArgIdx + 1];
    const { exec } = require('child_process');
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
  } catch(err){ try { console.warn('broadcastPlaceholderOdds failed', err); } catch(_){} }
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

// Toggle auto state - just broadcast toggle command, let renderer decide
function toggleAutoState(){
  console.log('[main] toggleAutoState - broadcasting toggle command');
  // Don't track state here - renderer is source of truth
  // Just send toggle command
  broadcastToAll(getBroadcastCtx(), 'auto-toggle-all', {});
}

// Set auto state explicitly (from renderer callback)
function setAutoState(active){
  __autoLast.active = !!active;
  console.log('[main] setAutoState ->', __autoLast.active);
  // Don't broadcast - this is just to sync main's cache
}

// Unified broadcast for auto-toggle-all (triggers toggle in renderer)
function broadcastAutoToggleAll(){
  console.log('[main] broadcastAutoToggleAll called');
  toggleAutoState();
}
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
let statsState = { mode: 'hidden', panelHidden: !!store.get('statsPanelHidden', false) }; // 'hidden' | 'embedded', plus panelHidden
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
    webPreferences: { preload: path.join(__dirname, 'preloads', 'main.js') }
  });
  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'pages', 'index.html'));
  // Determine if we should maximize (but don't do it yet - splash will handle it)
  let shouldMaximize = false;
  try {
    if (!saved) {
      shouldMaximize = true;
    } else {
      // If saved size is significantly smaller than available work area (>85% rule), still respect user size; else maximize.
      const primary = screen.getPrimaryDisplay().workArea;
      if (saved.width < primary.width * 0.55 || saved.height < primary.height * 0.55) {
        // Probably user used a small window intentionally; do nothing.
        shouldMaximize = false;
      } else if (saved.width >= primary.width * 0.90 && saved.height >= primary.height * 0.90) {
        // Saved bounds already near full screen; just maximize to remove borders.
        shouldMaximize = true;
      }
    }
  } catch(_) {}
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
    try { statsState.panelHidden = !!statsManager.getPanelHidden?.(); } catch(_){ }
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
  initThemeIpc({ store });
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
        try { if(boardManager && boardManager.sendOdds) boardManager.sendOdds(payload); } catch(_){ }
        try {
          if(statsManager && statsManager.views && statsManager.views.panel && statsManager.views.panel.webContents && !statsManager.views.panel.webContents.isDestroyed()){
            statsManager.views.panel.webContents.send('odds-update', payload);
          }
        } catch(_){ }
        try { if(latestOddsRef && latestOddsRef.value) latestOddsRef.value[payload.broker] = payload; } catch(_){ }
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
        // Update dialog removed - user can manually update extension from Settings
      },
      onDisconnect: () => {
        console.log('[extensionBridge] Extension disconnected');
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
  // Register warm-up tasks and run them before showing main window
  splashManager.updateProgress(60, 'Warming up UI...');
  
  // Task 1: Wait for main window to finish loading
  splashManager.registerTask('Loading main window...', () => {
    return new Promise(resolve => {
      if (mainWindow.webContents.isLoading()) {
        mainWindow.webContents.once('did-finish-load', resolve);
      } else {
        resolve();
      }
    });
  });
  
  // Task 2: Pre-create settings overlay
  splashManager.registerTask('Preparing settings...', () => {
    return new Promise(resolve => {
      try { 
        if(settingsOverlay && settingsOverlay.warmup) settingsOverlay.warmup(); 
      } catch(e){ console.warn('[warmup] settings warmup failed', e.message); }
      // Give it time to load
      setTimeout(resolve, 300);
    });
  });
  
  // Task 3: Wait for stats panel to be ready
  splashManager.registerTask('Initializing stats panel...', () => {
    return new Promise(resolve => {
      const panelView = statsManager && statsManager.getPanelView && statsManager.getPanelView();
      if (panelView && panelView.webContents) {
        if (panelView.webContents.isLoading()) {
          panelView.webContents.once('did-finish-load', () => setTimeout(resolve, 200));
        } else {
          setTimeout(resolve, 200);
        }
      } else {
        resolve();
      }
    });
  });
  
  // Task 4: Warm-up theme toggle in stats panel (with actual transition)
  splashManager.registerTask('Warming up animations...', () => {
    return new Promise(resolve => {
      try {
        const panelView = statsManager && statsManager.getPanelView && statsManager.getPanelView();
        if (panelView && panelView.webContents && !panelView.webContents.isDestroyed()) {
          // Trigger warmup in stats panel - includes theme transition
          panelView.webContents.executeJavaScript('if(window.__warmup) window.__warmup();').catch(() => {});
        }
      } catch(_){}
      // Wait for theme transition warmup to complete (opacity hidden during this)
      setTimeout(resolve, 300);
    });
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
    try { console.log('[stats][toggle] createStatsViews with offsetY', offsetY); } catch(_){ }
    statsManager.createStatsViews(offsetY);
    statsState.mode = 'embedded';
  } else {
    // Hide stats views (A/B), panel remains visible
    statsManager.hideStatsViews();
    statsState.mode = 'hidden';
  }
  
  try {
    statsState.panelHidden = false; // Panel is always visible now
    mainWindow.webContents.send('stats-state-updated', statsState);
  } catch(_){ }
}
// (duplicate early IPC init block removed; handled in bootstrap())

app.whenReady().then(()=>{
  bootstrap();
  initDevCssWatcher({ app, mainWindow, statsManager, baseDir: __dirname });
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
      // De-duplication for F23/F24 directional keys - now with single engine this is just safety net
      // Use very short window (25ms) to catch only true duplicates but allow intentional burst pulses (~50ms apart)
      let __lastDirKeySentAt = 0;
      let __lastDirKeySig = '';
      const DIR_KEY_DEDUP_MS = 25;
      ipcMain.handle('send-auto-press', (_e, payload)=>{
        let side = 0;
        let vk = null;
        let keyLabel = null;
        let direction = null;
        let diffPct = null;
        let noConfirm = false;
        let isRetry = false;
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
        // De-duplication for F23/F24/F22 directional/confirm keys
        if(keyLabel === 'F23' || keyLabel === 'F24' || keyLabel === 'F22'){
          const nowTs = Date.now();
          const sig = keyLabel + '|' + side + '|' + direction;
          if(sig === __lastDirKeySig && (nowTs - __lastDirKeySentAt) < DIR_KEY_DEDUP_MS){
            return true;
          }
          __lastDirKeySig = sig;
          __lastDirKeySentAt = nowTs;
        }
        // Broadcast to all views (board, main, stats)
        try { broadcastToAll(getBroadcastCtx(), 'auto-press', { side, key:keyLabel, direction }); } catch(err){ try { console.warn('[auto-press][ipc] send fail', err); } catch(_){ } }
        let sent=false;
  // Always write a file signal so AHK can react even if virtual key injection is blocked
  try { fs.writeFileSync(path.join(__dirname,'auto_press_signal.json'), JSON.stringify({ side, key:keyLabel, direction, ts })); } catch(_){ }
        // Only SendInput via helper script using F22/F23/F24 virtual keys (0x85/0x86/0x87) so AHK v2 can hook them.
        try {
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
      ipcMain.on('auto-mode-changed', (_e, payload)=>{
        try { console.log('[autoSim][mode]', payload); } catch(_){ }
        try { broadcastToAll(getBroadcastCtx(), 'auto-set-all', { on: !!(payload && payload.active) }); } catch(_){ }
      });
      ipcMain.on('auto-fire-attempt', (_e, payload)=>{ try { console.log('[autoSim][fireAttempt]', payload); } catch(_){ } });
      // Store last auto states to serve late-loaded windows
      ipcMain.on('auto-active-set', (_e, p)=>{
        try { __autoLast.active = !!(p&&p.on); } catch(_){ }
        try { broadcastToAll(getBroadcastCtx(), 'auto-active-set', p); } catch(_){ }
      });
      ipcMain.handle('auto-state-get', ()=> { return ({ active: __autoLast.active }); });
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
  // Global Numpad5 toggle for auto modes (board + embedded stats) even when app not focused
  try {
    // Try several accelerator variants to improve cross-OS/keyboard reliability
    const candidates = ['Num5','Numpad5','num5'];
      const handler = () => {
        try {
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
    } catch(e){ console.warn('[shortcut][Num5] registration error', e); }
});

app.on('will-quit', ()=>{ try { globalShortcut.unregisterAll(); } catch(_){} });
// Hotkey throttle state (prevents duplicate triggers)
let __lastHotkeyTs = { tab:0, f1:0, f2:0, f3:0 };
// Global space hotkey (throttled) to toggle stats embedded view
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
        // Space hotkey REMOVED - now handled by addons (e.g. Power Towers game)
        // Numpad5 handled by globalShortcut.register - no fallback needed (causes double toggle)
        // Ctrl+F12 -> open Board (odds) BrowserView DevTools
        if(input.key==='F12' && input.control){
          try {
            const bwc = getBoardWebContents(getBroadcastCtx());
            if(bwc) bwc.openDevTools({ mode:'detach' });
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
            try { console.log('[auto-press][hotkey] attempt side', side, 'key', input.key, 'ts', ts); } catch(_){ }
            let sent=false;
            // Send only F23/F24 (do not resend bracket)
            try {
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
app.on('before-quit', ()=>{ 
  quittingRef.value=true; 
  try { closeAllDetachedWindows(); } catch(e){}
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

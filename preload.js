const { contextBridge, ipcRenderer } = require('electron');

// Small helper to register an event and return an unsubscribe for convenience.
function withUnsub(channel, wrap){
  const handler = (_, payload) => wrap(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

contextBridge.exposeInMainWorld('desktopAPI', {
  listBrokers: () => ipcRenderer.invoke('list-brokers'),
  refresh: (id) => ipcRenderer.send('refresh-broker', id),
  onOdds: (cb) => withUnsub('odds-update', cb),
  onMap: (cb) => withUnsub('set-map', cb),
  onBrokerClosed: (cb) => withUnsub('broker-closed', (p)=> cb(p.id)),
  onBrokersSync: (cb) => withUnsub('brokers-sync', (p)=> cb(p.ids || [])),
  getLayout: () => ipcRenderer.invoke('get-layout'),
  setBounds: (id, bounds) => ipcRenderer.send('set-view-bounds', { id, bounds }),
  setStageBounds: (b) => ipcRenderer.send('set-stage-bounds', b),
  // openBoard removed (legacy separate window replaced by docking)
  // Stats embedding API
  statsToggle: () => ipcRenderer.send('stats-toggle'),
  // statsDetach/statsAttach removed (no separate stats window)
  getStatsState: () => ipcRenderer.invoke('get-stats-state'),
  onStatsState: (cb) => withUnsub('stats-state-updated', cb),
    // Stats panel visibility
    statsPanelToggle: () => ipcRenderer.send('stats-panel-toggle'),
    statsPanelSetHidden: (hidden) => ipcRenderer.send('stats-panel-set-hidden', { hidden: !!hidden }),
  refreshAll: () => ipcRenderer.send('refresh-all'),
  setMap: (id, map) => ipcRenderer.send('set-map', { id, map }),
  // resetBrokerUrls & reflowAll removed (legacy maintenance controls)
  applyLayoutPreset: (id) => ipcRenderer.send('apply-layout-preset', id),
  getLayoutPreset: () => ipcRenderer.invoke('get-layout-preset'),
  getLastMap: () => ipcRenderer.invoke('get-last-map')
  ,getIsLast: () => ipcRenderer.invoke('get-is-last')
  ,setIsLast: (v) => ipcRenderer.send('set-is-last', !!v)
  ,onIsLast: (cb) => withUnsub('set-is-last', cb)
  ,requestAddBroker: () => ipcRenderer.send('global-open-broker-picker')
  ,getAutoRefreshEnabled: () => ipcRenderer.invoke('get-auto-refresh-enabled')
  ,setAutoRefreshEnabled: (v) => ipcRenderer.send('set-auto-refresh-enabled', !!v)
  ,onAutoRefreshUpdated: (cb) => withUnsub('auto-refresh-updated', cb)
  ,openSettings: () => ipcRenderer.send('open-settings')
  ,getSetting: (key) => ipcRenderer.invoke('get-setting', key)
  ,setSetting: (k,v) => ipcRenderer.send('set-setting', { key:k, value:v })
  // contrast events removed (stubs kept for backward compatibility)
  ,onContrastPreview: () => ()=>{}
  ,onContrastSaved: () => ()=>{}
  ,onUIBlurOn: (cb) => withUnsub('ui-blur-on', cb)
  ,onUIBlurOff: (cb) => withUnsub('ui-blur-off', cb)
  ,onOpenSettings: (cb) => withUnsub('ui-open-settings', cb)
  ,onCloseSettings: (cb) => withUnsub('ui-close-settings', cb)
  ,previewContrast: (_v) => {}
  ,saveContrast: (_v) => {}
  ,closeSettings: () => ipcRenderer.send('close-settings')
  // Board docking API
  ,getBoardState: () => ipcRenderer.invoke('get-board-state')
  ,onBoardUpdated: (cb) => withUnsub('board-updated', cb)
  ,boardSetSide: (side) => ipcRenderer.send('board-set-side', { side })
  ,boardSetWidth: (width) => ipcRenderer.send('board-set-width', { width })
  // Dev: live CSS reload subscription
  ,onDevCssChanged: (cb) => withUnsub('dev-css-changed', cb)
  // LoL team names sync
  ,onTeamNames: (cb) => withUnsub('lol-team-names-update', cb)
  ,getTeamNames: () => ipcRenderer.invoke('lol-team-names-get')
  ,setTeamNames: (t1,t2) => ipcRenderer.send('lol-team-names-set', { team1:t1, team2:t2 })
  // Broker picker API
  ,getBrokersForPicker: () => ipcRenderer.invoke('picker-list-brokers')
  ,addBroker: (id) => ipcRenderer.send('add-broker-selected', { id })
  // (Removed: dataservices URL prompt API)
  // Generic low-level channels (scoped to internal dev usage). Avoid arbitrary user input.
  ,invoke: (channel, ...args) => { try { return ipcRenderer.invoke(channel, ...args); } catch(_) { return Promise.reject(new Error('invoke failed')); } }
  ,send: (channel, payload) => { try { ipcRenderer.send(channel, payload); } catch(_) { } }
  // Convenience wrappers for auto simulation
  ,autoSendPress: (side) => { try { return ipcRenderer.invoke('send-auto-press', side); } catch(_) { return Promise.resolve(false); } }
  // Excel extractor process control
  ,excelScriptToggle: () => { try { ipcRenderer.send('excel-extractor-toggle'); } catch(_){ } }
  ,excelScriptGetStatus: () => ipcRenderer.invoke('excel-extractor-status-get')
  ,onExcelScriptStatus: (cb) => withUnsub('excel-extractor-status', cb)
  // Aliases for legacy/new naming used in various renderers (board uses *Extractor* names)
  ,getExcelExtractorStatus: () => ipcRenderer.invoke('excel-extractor-status-get')
  ,onExcelExtractorStatus: (cb) => withUnsub('excel-extractor-status', cb)
  ,excelScriptSetPath: (p) => { try { ipcRenderer.send('excel-extractor-set-path', p); } catch(_){ } }
  ,excelScriptInstallDeps: () => { try { ipcRenderer.send('excel-extractor-install-deps'); } catch(_){ } }
  ,openDevTools: () => { try { ipcRenderer.send('open-devtools'); } catch(_){ } }
  ,onExcelLog: (cb) => withUnsub('excel-extractor-log', cb)
  // Map auto refresh (odds rebroadcast) controls
  ,toggleMapAutoRefresh: () => { try { ipcRenderer.send('toggle-map-auto-refresh'); } catch(_){ } }
  ,getMapAutoRefreshStatus: () => ipcRenderer.invoke('get-map-auto-refresh-status')
  ,onMapAutoRefreshStatus: (cb) => withUnsub('map-auto-refresh-status', cb)
  // Auto mode broadcast subscriptions (for views without direct ipcRenderer)
  ,onAutoToggleAll: (cb) => withUnsub('auto-toggle-all', cb)
  ,onAutoSetAll: (cb) => withUnsub('auto-set-all', cb)
  ,onAutoDisableAll: (cb) => withUnsub('auto-disable-all', cb)
  // AutoHub state sync (board view relies on these because it has no window.require)
  ,onAutoResumeSet: (cb) => withUnsub('auto-resume-set', cb)
  ,onAutoActiveSet: (cb) => withUnsub('auto-active-set', cb)

  // Per-broker swap (team orientation)
  ,getSwappedBrokers: () => ipcRenderer.invoke('swapped-brokers-get')
  ,setBrokerSwap: (broker, swapped) => { try { ipcRenderer.send('swapped-broker-set', { broker, swapped: !!swapped }); } catch(_){ } }
  ,toggleBrokerSwap: (broker) => { try { ipcRenderer.send('swapped-broker-toggle', { broker }); } catch(_){ } }
  ,onSwappedBrokersUpdated: (cb) => withUnsub('swapped-brokers-updated', cb)
});

// ---------- Console forwarding (selective) ----------
// Некоторые BrowserView (board.html) трудно открыть DevTools пользователю, поэтому
// мы дублируем важные диагностические строки в main процесс, чтобы увидеть их в терминале.
try {
  if(!window.__consoleForwardPatched){
    window.__consoleForwardPatched = true;
    const LEVELS = ['log','warn','error'];
    const orig = {};
    LEVELS.forEach(l=> orig[l] = console[l].bind(console));
    const shouldForward = (args)=>{
      try {
        const joined = args.map(a=> (typeof a==='string'? a : (a && a.message) || '')).join(' ');
        // Фильтруем только то, что относится к авто-симу или авто-нажатиям
        return /\[autoSim]|\[auto-press]|Aligning|Aligned/.test(joined);
      } catch(_){ return false; }
    };
    LEVELS.forEach(level=>{
      console[level] = (...args)=>{
        try { orig[level](...args); } catch(_){ }
        try {
          if(shouldForward(args)){
            ipcRenderer.send('renderer-log-forward', { level, args: args.map(a=>{
              if(a instanceof Error){ return a.stack || a.message; }
              if(typeof a==='object'){ try { return JSON.stringify(a); } catch(_){ return String(a); } }
              return String(a);
            }) });
          }
        } catch(_){ }
      };
    });
  }
} catch(_){ }

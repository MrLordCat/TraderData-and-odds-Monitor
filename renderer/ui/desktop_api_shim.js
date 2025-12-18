// Shared desktopAPI polyfill for views without full preload.js
// Use: require('./ui/desktop_api_shim').ensureDesktopAPI()
// This creates a minimal window.desktopAPI bridge when nodeIntegration is enabled.

(function(global){
  if(global.__desktopAPIShimLoaded) return;
  global.__desktopAPIShimLoaded = true;

  function ensureDesktopAPI(){
    if(global.desktopAPI) return global.desktopAPI; // Already exists (from preload.js)

    let ipcRenderer = null;
    try {
      // nodeIntegration must be enabled for this to work
      const electron = require('electron');
      ipcRenderer = electron.ipcRenderer;
    } catch(e){
      console.warn('[desktopAPI-shim] Cannot access ipcRenderer - nodeIntegration may be disabled');
      return null;
    }

    if(!ipcRenderer) return null;

    // Helper to create event subscription with cleanup
    function withUnsub(channel, wrap){
      const handler = (_, payload) => { try { wrap(payload); } catch(_){} };
      ipcRenderer.on(channel, handler);
      return () => ipcRenderer.removeListener(channel, handler);
    }

    // Create minimal shim matching preload.js API surface
    const api = {
      // Core IPC
      invoke: (...args) => { try { return ipcRenderer.invoke(...args); } catch(e){ return Promise.reject(e); } },
      send: (ch, payload) => { try { ipcRenderer.send(ch, payload); } catch(_){} },

      // Odds
      onOdds: (cb) => withUnsub('odds-update', cb),
      onMap: (cb) => withUnsub('set-map', cb),
      onBrokerClosed: (cb) => withUnsub('broker-closed', (p)=> cb(p?.id)),
      onBrokersSync: (cb) => withUnsub('brokers-sync', (p)=> cb(p?.ids || [])),
      setMap: (id, map) => { try { ipcRenderer.send('set-map', { id, map }); } catch(_){} },
      getLastMap: () => ipcRenderer.invoke('get-last-map'),

      // Last map (bet365)
      getIsLast: () => ipcRenderer.invoke('get-is-last').catch(()=>false),
      setIsLast: (v) => { try { ipcRenderer.send('set-is-last', !!v); } catch(_){} },
      onIsLast: (cb) => withUnsub('set-is-last', cb),

      // Auto trader
      autoSendPress: (side) => { try { return ipcRenderer.invoke('send-auto-press', side); } catch(_){ return Promise.resolve(false); } },
      onAutoToggleAll: (cb) => withUnsub('auto-toggle-all', cb),
      onAutoSetAll: (cb) => withUnsub('auto-set-all', cb),
      onAutoDisableAll: (cb) => withUnsub('auto-disable-all', cb),
      onAutoResumeSet: (cb) => withUnsub('auto-resume-set', cb),
      onAutoActiveSet: (cb) => withUnsub('auto-active-set', cb),
      onAutoToleranceUpdated: (cb) => withUnsub('auto-tolerance-updated', cb),
      onAutoIntervalUpdated: (cb) => withUnsub('auto-interval-updated', cb),
      onAutoAdaptiveUpdated: (cb) => withUnsub('auto-adaptive-updated', cb),
      onAutoBurstLevelsUpdated: (cb) => withUnsub('auto-burst-levels-updated', cb),

      // Excel extractor
      excelScriptToggle: () => { try { ipcRenderer.send('excel-extractor-toggle'); } catch(_){} },
      excelScriptGetStatus: () => ipcRenderer.invoke('excel-extractor-status-get'),
      onExcelScriptStatus: (cb) => withUnsub('excel-extractor-status', cb),
      getExcelExtractorStatus: () => ipcRenderer.invoke('excel-extractor-status-get'),
      onExcelExtractorStatus: (cb) => withUnsub('excel-extractor-status', cb),
      onExcelLog: (cb) => withUnsub('excel-extractor-log', cb),

      // Settings
      openSettings: () => { try { ipcRenderer.send('open-settings'); } catch(_){} },
      closeSettings: () => { try { ipcRenderer.send('close-settings'); } catch(_){} },
      getSetting: (key) => ipcRenderer.invoke('get-setting', key),
      setSetting: (k,v) => { try { ipcRenderer.send('set-setting', { key:k, value:v }); } catch(_){} },
      onOpenSettings: (cb) => withUnsub('ui-open-settings', cb),
      onCloseSettings: (cb) => withUnsub('ui-close-settings', cb),

      // Stats
      statsToggle: () => { try { ipcRenderer.send('stats-toggle'); } catch(_){} },
      getStatsState: () => ipcRenderer.invoke('get-stats-state'),
      onStatsState: (cb) => withUnsub('stats-state-updated', cb),

      // Board
      getBoardState: () => ipcRenderer.invoke('get-board-state'),
      onBoardUpdated: (cb) => withUnsub('board-updated', cb),
      boardSetSide: (side) => { try { ipcRenderer.send('board-set-side', { side }); } catch(_){} },
      boardSetWidth: (width) => { try { ipcRenderer.send('board-set-width', { width }); } catch(_){} },

      // Team names
      onTeamNames: (cb) => withUnsub('lol-team-names-update', cb),
      getTeamNames: () => ipcRenderer.invoke('lol-team-names-get'),
      setTeamNames: (t1,t2) => { try { ipcRenderer.send('lol-team-names-set', { team1:t1, team2:t2 }); } catch(_){} },

      // Swap
      getSwappedBrokers: () => ipcRenderer.invoke('swapped-brokers-get'),
      setBrokerSwap: (broker, swapped) => { try { ipcRenderer.send('swapped-broker-set', { broker, swapped: !!swapped }); } catch(_){} },
      toggleBrokerSwap: (broker) => { try { ipcRenderer.send('swapped-broker-toggle', { broker }); } catch(_){} },
      onSwappedBrokersUpdated: (cb) => withUnsub('swapped-brokers-updated', cb),

      // UI blur
      onUIBlurOn: (cb) => withUnsub('ui-blur-on', cb),
      onUIBlurOff: (cb) => withUnsub('ui-blur-off', cb),

      // Map auto-refresh
      toggleMapAutoRefresh: () => { try { ipcRenderer.send('toggle-map-auto-refresh'); } catch(_){} },
      getMapAutoRefreshStatus: () => ipcRenderer.invoke('get-map-auto-refresh-status'),
      onMapAutoRefreshStatus: (cb) => withUnsub('map-auto-refresh-status', cb),

      // Auto refresh
      getAutoRefreshEnabled: () => ipcRenderer.invoke('get-auto-refresh-enabled'),
      setAutoRefreshEnabled: (v) => { try { ipcRenderer.send('set-auto-refresh-enabled', !!v); } catch(_){} },
      onAutoRefreshUpdated: (cb) => withUnsub('auto-refresh-updated', cb),

      // Dev
      openDevTools: () => { try { ipcRenderer.send('open-devtools'); } catch(_){} },
      onDevCssChanged: (cb) => withUnsub('dev-css-changed', cb),
    };

    global.desktopAPI = api;
    try { console.log('[desktopAPI-shim] Installed minimal API bridge'); } catch(_){}
    return api;
  }

  // Auto-init on load
  ensureDesktopAPI();

  // Export for CommonJS require
  if(typeof module !== 'undefined' && module.exports){
    module.exports = { ensureDesktopAPI };
  }
})(typeof window !== 'undefined' ? window : global);

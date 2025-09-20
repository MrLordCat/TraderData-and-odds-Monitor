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
  statsDetach: () => ipcRenderer.send('stats-detach'),
  statsAttach: () => ipcRenderer.send('stats-attach'),
  getStatsState: () => ipcRenderer.invoke('get-stats-state'),
  onStatsState: (cb) => withUnsub('stats-state-updated', cb),
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
  ,boardToggle: () => ipcRenderer.send('board-toggle')
  ,boardDetach: () => ipcRenderer.send('board-detach')
  ,boardAttach: () => ipcRenderer.send('board-attach')
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
  ,getLastDataservicesUrl: () => ipcRenderer.invoke('get-setting', 'lastDataservicesUrl')
  ,openDataservicesPrompt: () => ipcRenderer.send('open-dataservices-url-prompt')
  ,dataservicesPromptSubmit: (url) => ipcRenderer.send('dataservices-url-submit', { url })
  ,dataservicesPromptCancel: () => ipcRenderer.send('dataservices-url-cancel')
});

// Shared desktopAPI definition — single source of truth for preloads/main.js and desktop_api_shim.js.
// Returns a full API object given ipcRenderer and withUnsub helper.

function buildDesktopAPI(ipcRenderer, withUnsub) {
  const api = {};

  // ── invoke() — no arguments ──
  [
    'listBrokers list-brokers', 'getLayout get-layout', 'getStatsState get-stats-state',
    'getLastMap get-last-map', 'getIsLast get-is-last', 'getMapConfig get-map-config',
    'getAutoRefreshEnabled get-auto-refresh-enabled', 'getBoardState get-board-state',
    'getTeamNames lol-team-names-get', 'getBrokersForPicker picker-list-brokers',
    'getLayoutPreset get-layout-preset', 'excelScriptGetStatus excel-extractor-status-get',
    'getExcelExtractorStatus excel-extractor-status-get',
    'getMapAutoRefreshStatus get-map-auto-refresh-status',
    'getSwappedBrokers swapped-brokers-get', 'updaterGetStatus updater-get-status',
    'updaterCheck updater-check', 'updaterDownload updater-download',
    'updaterRestart updater-restart', 'updaterGetVersion updater-get-version',
    'addonsGetInfo addons-get-info', 'addonsFetchAvailable addons-fetch-available',
    'addonsGetEnabledPaths addons-get-enabled-paths', 'addonsGetDir addons-get-dir',
    'addonsCheckUpdates addons-check-updates', 'addonsGetChannel addons-get-channel',
    'dsAutoModeGet ds-auto-mode-get', 'dsConnectionStatus ds-connection-status',
    'dsGetLastOdds ds-get-last-odds', 'themeGet theme-get', 'themeToggle theme-toggle',
  ].forEach(e => { const [n, c] = e.split(' '); api[n] = () => ipcRenderer.invoke(c); });

  // ── invoke() — single arg passthrough ──
  [
    'getSetting get-setting', 'updaterSetChannel updater-set-channel',
    'updaterSetAutoCheck updater-set-auto-check', 'themeSet theme-set',
    'dsAutoModeSet ds-auto-mode-set',
  ].forEach(e => { const [n, c] = e.split(' '); api[n] = (v) => ipcRenderer.invoke(c, v); });

  // ── send() — no arguments ──
  [
    'statsToggle stats-toggle', 'refreshAll refresh-all', 'openSettings open-settings',
    'closeSettings close-settings', 'openDevTools open-devtools',
    'toggleMapAutoRefresh toggle-map-auto-refresh', 'excelScriptToggle excel-extractor-toggle',
    'requestAddBroker global-open-broker-picker',
  ].forEach(e => { const [n, c] = e.split(' '); api[n] = () => { try { ipcRenderer.send(c); } catch (_) {} }; });

  // ── send() — single arg passthrough ──
  [
    'refresh refresh-broker', 'applyLayoutPreset apply-layout-preset',
    'setMapConfig set-map-config', 'excelScriptSetPath excel-extractor-set-path',
  ].forEach(e => { const [n, c] = e.split(' '); api[n] = (v) => { try { ipcRenderer.send(c, v); } catch (_) {} }; });

  // ── subscribe — simple passthrough ──
  [
    'onOdds odds-update', 'onBoardUpdated board-updated', 'onDevCssChanged dev-css-changed',
    'onTeamNames lol-team-names-update', 'onExcelTeamNames excel-team-names',
    'onExcelScriptStatus excel-extractor-status', 'onExcelExtractorStatus excel-extractor-status',
    'onAutoStateSet auto-state-set', 'onAutoToggleAll auto-toggle-all',
    'onAutoSetAll auto-set-all', 'onAutoDisableAll auto-disable-all',
    'onAutoActiveSet auto-active-set', 'onAutoToleranceUpdated auto-tolerance-updated',
    'onAutoAdaptiveUpdated auto-adaptive-updated',
    'onAutoBurstLevelsUpdated auto-burst-levels-updated',
    'onSwappedBrokersUpdated swapped-brokers-updated',
    'onUIBlurOn ui-blur-on', 'onUIBlurOff ui-blur-off',
    'onOpenSettings ui-open-settings', 'onCloseSettings ui-close-settings',
    'onMapAutoRefreshStatus map-auto-refresh-status', 'onAutoRefreshUpdated auto-refresh-updated',
    'onUpdaterAvailable updater-update-available', 'onUpdaterNotAvailable updater-update-not-available',
    'onUpdaterDownloading updater-downloading', 'onUpdaterExtracting updater-extracting',
    'onUpdaterReady updater-update-ready', 'onUpdaterError updater-update-error',
    'onAddonInstallStatus addon-install-status', 'onAddonDownloadProgress addon-download-progress',
    'onAddonUninstalled addon-uninstalled', 'onAddonEnabledChanged addon-enabled-changed',
    'onAddonUpdated addon-updated', 'onDsAutoModeUpdated ds-auto-mode-updated',
    'onLolSoundEvent lol-sound-event', 'onThemeChanged theme-changed',
    'onStatsState stats-state-updated', 'onMapConfig set-map-config',
    'onExcelLog excel-extractor-log',
  ].forEach(e => { const [n, c] = e.split(' '); api[n] = (cb) => withUnsub(c, cb); });

  // ── subscribe — with transform ──
  api.onMap = (cb) => withUnsub('set-map-config', (cfg) => cb(cfg?.map));
  api.onBrokerClosed = (cb) => withUnsub('broker-closed', (p) => cb(p.id));
  api.onBrokersSync = (cb) => withUnsub('brokers-sync', (p) => cb(p.ids || []));
  api.onIsLast = (cb) => withUnsub('set-map-config', (cfg) => cb(cfg?.isLast));

  // ── send — with constructed payload ──
  api.setBounds = (id, bounds) => ipcRenderer.send('set-view-bounds', { id, bounds });
  api.setStageBounds = (b) => ipcRenderer.send('set-stage-bounds', b);
  api.setMap = (id, map) => ipcRenderer.send('set-map', { id, map });
  api.setIsLast = (v) => ipcRenderer.send('set-is-last', !!v);
  api.setAutoRefreshEnabled = (v) => ipcRenderer.send('set-auto-refresh-enabled', !!v);
  api.setSetting = (k, v) => ipcRenderer.send('set-setting', { key: k, value: v });
  api.boardSetSide = (side) => ipcRenderer.send('board-set-side', { side });
  api.boardSetWidth = (width) => ipcRenderer.send('board-set-width', { width });
  api.setTeamNames = (t1, t2) => ipcRenderer.send('lol-team-names-set', { team1: t1, team2: t2 });
  api.addBroker = (id) => ipcRenderer.send('add-broker-selected', { id });
  api.setBrokerSwap = (broker, swapped) => { try { ipcRenderer.send('swapped-broker-set', { broker, swapped: !!swapped }); } catch (_) {} };
  api.toggleBrokerSwap = (broker) => { try { ipcRenderer.send('swapped-broker-toggle', { broker }); } catch (_) {} };

  // ── invoke — with custom args ──
  api.invoke = (channel, ...args) => { try { return ipcRenderer.invoke(channel, ...args); } catch (_) { return Promise.reject(new Error('invoke failed')); } };
  api.send = (channel, payload) => { try { ipcRenderer.send(channel, payload); } catch (_) {} };
  api.autoSendPress = (side) => { try { return ipcRenderer.invoke('send-auto-press', side); } catch (_) { return Promise.resolve(false); } };
  api.addonsInstall = (addonId, downloadUrl) => ipcRenderer.invoke('addons-install', { addonId, downloadUrl });
  api.addonsUninstall = (addonId) => ipcRenderer.invoke('addons-uninstall', { addonId });
  api.addonsSetEnabled = (addonId, enabled) => ipcRenderer.invoke('addons-set-enabled', { addonId, enabled });
  api.addonsUpdate = (addonId) => ipcRenderer.invoke('addons-update', { addonId });
  api.addonsSetChannel = (channel) => ipcRenderer.invoke('addons-set-channel', { channel });
  api.dsAutoCommand = (command, opts) => ipcRenderer.invoke('ds-auto-command', command, opts);

  return api;
}

module.exports = buildDesktopAPI;

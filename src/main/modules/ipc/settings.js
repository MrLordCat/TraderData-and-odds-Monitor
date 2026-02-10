// Settings & theme IPC extracted from main.js
// initSettingsIpc({ ipcMain, store, settingsOverlay, statsManager })

const { broadcastGlobal } = require('../utils/broadcast');

/**
 * Factory: register a get/set IPC pair with broadcast.
 * @param {object} ipcMain
 * @param {object} store
 * @param {string} storeKey        - electron-store key
 * @param {string} channel         - base channel name (e.g. 'auto-tolerance')
 * @param {object} opts
 * @param {Function} opts.clamp    - (v) => clamped value (for numbers)
 * @param {*}      opts.default    - default fallback
 * @param {'number'|'boolean'} opts.type - value type
 * @param {string} opts.payloadKey - key inside payload object (default: from type)
 */
function createSettingIpc(ipcMain, store, storeKey, channel, opts = {}) {
  const { clamp, type = 'number' } = opts;
  const defaultVal = opts.default ?? null;

  ipcMain.handle(`${channel}-get`, () => {
    try {
      const v = store.get(storeKey);
      if (type === 'boolean' && typeof v === 'boolean') return v;
      if (type === 'number' && typeof v === 'number' && !isNaN(v)) return clamp ? clamp(v) : v;
    } catch (_) { }
    return defaultVal;
  });

  ipcMain.on(`${channel}-set`, (_e, payload) => {
    try {
      let v = null;
      if (type === 'boolean') {
        const key = opts.payloadKey || 'enabled';
        v = payload && typeof payload[key] === 'boolean' ? payload[key] : null;
      } else {
        const key = opts.payloadKey || Object.keys(payload || {}).find(k => k !== 'type') || 'value';
        const raw = payload && payload[key];
        v = typeof raw === 'number' ? (clamp ? clamp(raw) : raw) : null;
      }
      if (v !== null) {
        store.set(storeKey, v);
        broadcastGlobal(`${channel}-updated`, v);
      }
    } catch (_) { }
  });
}

function initSettingsIpc(ctx){
  const { ipcMain, store, settingsOverlay, statsManager } = ctx;
  ipcMain.on('open-settings', ()=> settingsOverlay.open());
  ipcMain.on('close-settings', ()=> settingsOverlay.close());
  
  // Broadcast settings-updated to all windows when settings are saved
  ipcMain.on('settings-saved', () => { broadcastGlobal('settings-updated'); });
  
  function forwardHeatBar(cfg){
    try { if(statsManager && statsManager.views && statsManager.views.panel){ statsManager.views.panel.webContents.send('gs-heatbar-apply', cfg); } } catch(_){ }
  }
  ipcMain.on('gs-heatbar-preview', (_e, cfg)=>{ forwardHeatBar(cfg); });
  ipcMain.on('gs-heatbar-save', (_e, cfg)=>{ try { store.set('gsHeatBar', cfg); } catch(_){} forwardHeatBar(cfg); });
  ipcMain.handle('get-setting', (e,key)=> store.get(key));
  ipcMain.on('set-setting', (e,{key,value})=>{ store.set(key,value); });

  // ===== Global Game selection (affects extractors & UI consumers) =====
  const VALID_GAMES = new Set(['lol','cs2','dota2']);
  function sanitizeGame(v){ return VALID_GAMES.has(v)? v: 'lol'; }
  ipcMain.handle('game-get', ()=>{
    try { return sanitizeGame(store.get('selectedGame') || 'lol'); } catch(_){ return 'lol'; }
  });
  ipcMain.on('game-set', (_e, payload)=>{
    try {
      const game = sanitizeGame(payload && payload.game);
      store.set('selectedGame', game);
      broadcastGlobal('game-changed', game);
    } catch(_){ }
  });

  // === Auto burst levels (array of 3 { thresholdPct, pulses }) ===
  // Store key: 'autoBurstLevels'. Semantics: sorted descending by thresholdPct. First match (diffPct >= thresholdPct) wins. Default fallback -> pulses=1.
  function sanitizeBurstLevels(levels){
    try {
      if(!Array.isArray(levels)) return null;
      const cleaned = levels.map(l=>({
        thresholdPct: Math.max(1, Math.min(50, Number(l.thresholdPct)||0)),
        pulses: Math.max(1, Math.min(5, Math.round(Number(l.pulses)||0)))
      })).filter(l=> l.thresholdPct>0 && l.pulses>=1);
      if(cleaned.length===0) return null;
      // Sort descending by threshold
      cleaned.sort((a,b)=> b.thresholdPct - a.thresholdPct);
      // Deduplicate identical thresholds (keep first/higher pulses order)
      const uniq=[]; const seen=new Set();
      for(const l of cleaned){ if(!seen.has(l.thresholdPct)){ uniq.push(l); seen.add(l.thresholdPct); } }
      return uniq.slice(0,3); // cap to 3 (UI uses 3)
    } catch(_){ return null; }
  }
  ipcMain.handle('auto-burst-levels-get', ()=>{
    try {
      const v = store.get('autoBurstLevels');
      const s = sanitizeBurstLevels(v);
      return (s && s.length)? s : null;
    } catch(_){ return null; }
  });
  ipcMain.on('auto-burst-levels-set', (_e, payload)=>{
    try {
      const levels = payload && payload.levels;
      const s = sanitizeBurstLevels(levels);
      if(s){
        store.set('autoBurstLevels', s);
        broadcastGlobal('auto-burst-levels-updated', s);
      }
    } catch(_){ }
  });

  // === All numeric/boolean auto settings via factory ===
  createSettingIpc(ipcMain, store, 'autoTolerancePct', 'auto-tolerance', {
    clamp: v => Math.max(0.5, Math.min(10, v)), default: 1.5, payloadKey: 'tolerancePct'
  });
  createSettingIpc(ipcMain, store, 'autoIntervalMs', 'auto-interval', {
    clamp: v => Math.max(120, Math.min(10000, Math.floor(v))), default: null, payloadKey: 'intervalMs'
  });
  createSettingIpc(ipcMain, store, 'autoAdaptiveEnabled', 'auto-adaptive', {
    type: 'boolean', default: null, payloadKey: 'enabled'
  });
  createSettingIpc(ipcMain, store, 'autoSuspendThresholdPct', 'auto-suspend-threshold', {
    clamp: v => Math.max(15, Math.min(80, Math.round(v))), default: 40, payloadKey: 'pct'
  });
  createSettingIpc(ipcMain, store, 'autoShockThresholdPct', 'auto-shock-threshold', {
    clamp: v => Math.max(40, Math.min(120, Math.round(v))), default: 80, payloadKey: 'pct'
  });
  createSettingIpc(ipcMain, store, 'autoFireCooldownMs', 'auto-fire-cooldown', {
    clamp: v => Math.max(100, Math.min(5000, Math.floor(v))), default: 900, payloadKey: 'ms'
  });
  createSettingIpc(ipcMain, store, 'autoMaxExcelWaitMs', 'auto-max-excel-wait', {
    clamp: v => Math.max(500, Math.min(5000, Math.floor(v))), default: 1600, payloadKey: 'ms'
  });
  createSettingIpc(ipcMain, store, 'autoPulseGapMs', 'auto-pulse-gap', {
    clamp: v => Math.max(100, Math.min(1000, Math.floor(v))), default: 500, payloadKey: 'ms'
  });
  createSettingIpc(ipcMain, store, 'autoBurst3Enabled', 'auto-burst3-enabled', {
    type: 'boolean', default: true, payloadKey: 'enabled'
  });
  createSettingIpc(ipcMain, store, 'autoPulseStepPct', 'auto-pulse-step', {
    clamp: v => Math.max(8, Math.min(15, Math.round(v))), default: 10, payloadKey: 'pct'
  });
  createSettingIpc(ipcMain, store, 'autoStopOnNoMid', 'auto-stop-no-mid', {
    type: 'boolean', default: true, payloadKey: 'enabled'
  });
  createSettingIpc(ipcMain, store, 'autoResumeOnMid', 'auto-resume-on-mid', {
    type: 'boolean', default: true, payloadKey: 'enabled'
  });
  createSettingIpc(ipcMain, store, 'autoSuspendRetryDelayMs', 'auto-suspend-retry-delay', {
    clamp: v => Math.max(100, Math.min(700, Math.floor(v))), default: 500, payloadKey: 'ms'
  });
}

module.exports = { initSettingsIpc };
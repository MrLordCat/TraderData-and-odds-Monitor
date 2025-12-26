// Settings & theme IPC extracted from main.js
// initSettingsIpc({ ipcMain, store, settingsOverlay, statsManager })

function initSettingsIpc(ctx){
  const { ipcMain, store, settingsOverlay, statsManager } = ctx;
  ipcMain.on('open-settings', ()=> settingsOverlay.open());
  ipcMain.on('close-settings', ()=> settingsOverlay.close());
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
      // Broadcast to all BrowserWindows and their BrowserViews
      const { BrowserWindow } = require('electron');
      BrowserWindow.getAllWindows().forEach(w=>{
        try { w.webContents.send('game-changed', game); } catch(_){ }
        try { if(typeof w.getBrowserViews==='function'){ w.getBrowserViews().forEach(vw=>{ try { vw.webContents.send('game-changed', game); } catch(_){ } }); } } catch(_){ }
      });
    } catch(_){ }
  });

  // Auto odds tolerance (percent). Persist under key 'autoTolerancePct'.
  function clampTol(v){ return Math.max(0.5, Math.min(10, v)); }
  ipcMain.handle('auto-tolerance-get', ()=>{
    try {
      const v = store.get('autoTolerancePct');
      if(typeof v === 'number' && !isNaN(v)) return clampTol(v);
    } catch(_){ }
    return null; // no default on first run
  });
  ipcMain.on('auto-tolerance-set', (_e, payload)=>{
    try {
      const v = payload && typeof payload.tolerancePct==='number'? clampTol(payload.tolerancePct): null;
      if(v){
        store.set('autoTolerancePct', v);
        // Broadcast to all BrowserWindows AND their BrowserViews (board & embedded stats are BrowserViews when docked)
        try {
          const { BrowserWindow } = require('electron');
          const bw = BrowserWindow.getAllWindows();
            bw.forEach(w=>{
              try { w.webContents.send('auto-tolerance-updated', v); } catch(_){ }
              try {
                if(typeof w.getBrowserViews === 'function'){
                  w.getBrowserViews().forEach(vw=>{ try { vw.webContents.send('auto-tolerance-updated', v); } catch(_){ } });
                }
              } catch(_){ }
            });
        } catch(_){ }
      }
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
  function defaultBurstLevels(){ return null; }
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
        // Broadcast update
        try {
          const { BrowserWindow } = require('electron');
          BrowserWindow.getAllWindows().forEach(w=>{
            try { w.webContents.send('auto-burst-levels-updated', s); } catch(_){ }
            try { if(typeof w.getBrowserViews==='function'){ w.getBrowserViews().forEach(vw=>{ try { vw.webContents.send('auto-burst-levels-updated', s); } catch(_){ } }); } } catch(_){ }
          });
        } catch(_){ }
      }
    } catch(_){ }
  });

  // === Auto interval (ms) ===
  function clampInterval(v){ return Math.max(120, Math.min(10000, Math.floor(v))); }
  ipcMain.handle('auto-interval-get', ()=>{
    try {
      const v = store.get('autoIntervalMs');
      if(typeof v==='number' && !isNaN(v)) return clampInterval(v);
    } catch(_){ }
    return null; // no default on first run
  });
  ipcMain.on('auto-interval-set', (_e, payload)=>{
    try {
      const v = payload && typeof payload.intervalMs==='number'? clampInterval(payload.intervalMs): null;
      if(v){
        store.set('autoIntervalMs', v);
        try {
          const { BrowserWindow } = require('electron');
          BrowserWindow.getAllWindows().forEach(w=>{
            try { w.webContents.send('auto-interval-updated', v); } catch(_){ }
            try { if(typeof w.getBrowserViews==='function'){ w.getBrowserViews().forEach(vw=>{ try { vw.webContents.send('auto-interval-updated', v); } catch(_){ } }); } } catch(_){ }
          });
        } catch(_){ }
      }
    } catch(_){ }
  });

  // === Auto adaptive mode (bool) ===
  ipcMain.handle('auto-adaptive-get', ()=>{
    try {
      const v = store.get('autoAdaptiveEnabled');
      if(typeof v==='boolean') return v;
    } catch(_){ }
    return null; // no default on first run
  });
  ipcMain.on('auto-adaptive-set', (_e, payload)=>{
    try {
      const v = payload && typeof payload.enabled==='boolean'? payload.enabled: null;
      if(v!==null){
        store.set('autoAdaptiveEnabled', v);
        try {
          const { BrowserWindow } = require('electron');
          BrowserWindow.getAllWindows().forEach(w=>{
            try { w.webContents.send('auto-adaptive-updated', v); } catch(_){ }
            try { if(typeof w.getBrowserViews==='function'){ w.getBrowserViews().forEach(vw=>{ try { vw.webContents.send('auto-adaptive-updated', v); } catch(_){ } }); } } catch(_){ }
          });
        } catch(_){ }
      }
    } catch(_){ }
  });

  // === Auto Suspend threshold (%) - suspend when diff >= threshold, resume when < threshold/2 ===
  function clampAutoSuspend(v){ return Math.max(15, Math.min(80, Math.round(v))); }
  ipcMain.handle('auto-suspend-threshold-get', ()=>{
    try {
      const v = store.get('autoSuspendThresholdPct');
      if(typeof v==='number' && !isNaN(v)) return clampAutoSuspend(v);
    } catch(_){ }
    return 40; // default
  });
  ipcMain.on('auto-suspend-threshold-set', (_e, payload)=>{
    try {
      const v = payload && typeof payload.pct==='number' ? clampAutoSuspend(payload.pct) : null;
      if(v!=null){
        store.set('autoSuspendThresholdPct', v);
        try {
          const { BrowserWindow } = require('electron');
          BrowserWindow.getAllWindows().forEach(w=>{
            try { w.webContents.send('auto-suspend-threshold-updated', v); } catch(_){ }
            try { if(typeof w.getBrowserViews==='function'){ w.getBrowserViews().forEach(vw=>{ try { vw.webContents.send('auto-suspend-threshold-updated', v); } catch(_){ } }); } } catch(_){ }
          });
        } catch(_){ }
      }
    } catch(_){ }
  });
}

module.exports = { initSettingsIpc };
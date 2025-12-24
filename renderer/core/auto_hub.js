// Centralized Auto Hub: manages AutoCore engines per view, reads data from OddsCore hub
// Responsibilities:
//  - Subscribe to OddsCore hub state and compute derived + excel record
//  - Create per-view AutoCore engines with providers that read from shared state (no DOM parsing)
//  - Apply Excel suspend/resume and market guards centrally (with F21 + 500ms retry once)
//  - Handle global auto broadcasts (toggle/set/disable) across attached views
//  - Expose thin API for views: attachView(id,{ onActiveChanged, flash, status, storageNs }) -> { state, setActive, step, schedule }
(function(global){
  if(global.AutoHub) return;

  function now(){ return Date.now(); }

  function createAutoHub(){
    const oddsHub = (global.OddsCore && global.OddsCore.createOddsHub) ? global.OddsCore.createOddsHub() : null;
    const state = { records:{}, derived:{ hasMid:false, arbProfitPct:null, mid:null } };
    const views = new Map(); // id -> { engine, ui, ns }
    let lastF21At = 0;

    // Excel extractor (python) процесс: Auto нельзя включать если скрипт не запущен.
    // Также: если скрипт остановился — принудительно выключаем Auto (если был включен).
    let excelProcRunning = null; // null=unknown yet, boolean after first status
    let excelProcStarting = false;
    let excelProcInstalling = false;
    let excelProcError = null;

    function getAutoEnableInfo(){
      const info = {
        canEnable: false,
        reasonCode: null,
        excel: {
          running: excelProcRunning,
          starting: excelProcStarting,
          installing: excelProcInstalling,
          error: excelProcError,
        },
        scriptMap: scriptMap,
        boardMap: boardMap,
      };
      // Block when status unknown (startup) OR when not running OR when starting/installing.
      if(excelProcRunning !== true){
        info.reasonCode = (excelProcRunning === null) ? 'excel-unknown' : 'excel-off';
        return info;
      }
      if(excelProcInstalling){ info.reasonCode = 'excel-installing'; return info; }
      if(excelProcStarting){ info.reasonCode = 'excel-starting'; return info; }
      // Block on map mismatch
      if(isMapMismatch()){ info.reasonCode = 'map-mismatch'; return info; }
      info.canEnable = true;
      return info;
    }

    function markAllDisableReason(reasonCode){
      if(!reasonCode) return;
      if(sharedEngine && sharedEngine.state){
        sharedEngine.state.lastDisableReason = reasonCode;
      }
    }

    function broadcastAutoActiveOff(){
      try {
        if(global.desktopAPI && global.desktopAPI.send){ global.desktopAPI.send('auto-active-set', { on:false }); }
        else if(global.require){ const { ipcRenderer } = global.require('electron'); if(ipcRenderer && ipcRenderer.send){ ipcRenderer.send('auto-active-set', { on:false }); } }
      } catch(_){ }
    }

    function disableAllAutoDueToExcelStop(){
      try {
        const info = getAutoEnableInfo();
        if(info && info.reasonCode){ markAllDisableReason(info.reasonCode); }
      } catch(_){ }
      let anyWasActive = false;
      if(sharedEngine && sharedEngine.state && sharedEngine.state.active){
        anyWasActive = true;
        sharedEngine.setActive(false);
        notifyAllUIs('onActiveChanged', false, sharedEngine.state);
      }
      if(anyWasActive){
        // Ensure other windows (late loads) sync to OFF.
        broadcastAutoActiveOff();
      }
    }

    function statusAll(msg){
      try { viewUIs.forEach((ui)=>{ try { ui && ui.status && ui.status(msg); } catch(_){ } }); } catch(_){ }
    }

    // Script map vs board map tracking for mismatch blocking
    let scriptMap = null; // from Python hotkey controller
    let boardMap = null;  // from board map selector
    
    function setScriptMap(m){
      scriptMap = (typeof m === 'number' && m >= 1 && m <= 5) ? m : null;
    }
    function setBoardMap(m){
      boardMap = (typeof m === 'number' && m >= 0 && m <= 5) ? m : null;
    }
    function isMapMismatch(){
      // If either is unknown, don't block
      if(scriptMap === null || boardMap === null) return false;
      // Map 0 means "Match" - don't compare
      if(boardMap === 0) return false;
      return scriptMap !== boardMap;
    }

    function canEnableAuto(){
      // Block when status unknown (startup) OR when not running OR when starting/installing.
      if(excelProcRunning !== true) return false;
      if(excelProcStarting) return false;
      if(excelProcInstalling) return false;
      // Block on map mismatch
      if(isMapMismatch()) return false;
      return true;
    }

    function applyExcelProcStatus(s){
      try {
        const prevRunning = excelProcRunning;
        excelProcRunning = !!(s && s.running);
        excelProcStarting = !!(s && s.starting);
        excelProcInstalling = !!(s && s.installing);
        excelProcError = (s && s.error) ? String(s.error) : null;
        
        // Debug log for status tracking
        try { console.log('[autoHub] excelProcStatus updated:', { running: excelProcRunning, starting: excelProcStarting, installing: excelProcInstalling, prevRunning }); } catch(_){ }

        // If python stopped (or not running) and auto is on — force off.
        if(excelProcRunning !== true){
          // If this is a transition from running -> not running, force-disable.
          // If initial state is already not running, still force-disable to be safe.
          if(prevRunning === true || prevRunning === null){
            disableAllAutoDueToExcelStop();
          }
        }
      } catch(_){ }
    }

    function attachExcelProcStatus(){
      try {
        if(attachExcelProcStatus.__bound) return;
        attachExcelProcStatus.__bound = true;

        // Prefer desktopAPI bridge (works even when ipcRenderer/require is not available)
        try {
          if(global.desktopAPI && typeof global.desktopAPI.onExcelExtractorStatus==='function'){
            global.desktopAPI.onExcelExtractorStatus((s)=>{
              applyExcelProcStatus(s);
            });
            if(typeof global.desktopAPI.getExcelExtractorStatus==='function'){
              global.desktopAPI.getExcelExtractorStatus().then(s=> applyExcelProcStatus(s)).catch(()=>{
                applyExcelProcStatus({ running:false, starting:false, installing:false });
              });
            }
            return;
          }
        } catch(_){ }

        // Fallback to raw ipcRenderer
        if(!global.require) return;
        const { ipcRenderer } = global.require('electron');
        if(!ipcRenderer) return;
        ipcRenderer.on('excel-extractor-status', (_e, s)=>{
          applyExcelProcStatus(s);
        });
        try {
          ipcRenderer.invoke('excel-extractor-status-get')
            .then(s=> applyExcelProcStatus(s))
            .catch(()=>{ applyExcelProcStatus({ running:false, starting:false, installing:false }); });
        } catch(_){ }
      } catch(_){ }
    }

    function sendAutoPressF21(opts){
      try {
        const elapsed = now()-lastF21At; if(elapsed < 250) return; // debounce
        lastF21At = now();
        const base = { key:'F21', noConfirm:true };
        // Map reason into 'direction' to surface in main log
        if(opts && typeof opts.reason==='string') base.direction = opts.reason;
        else if(opts && opts.resume) base.direction = 'resume';
        else if(opts && opts.retry) base.direction = 'retry';
        if(opts && typeof opts.diffPct==='number' && !isNaN(opts.diffPct)) base.diffPct = Number(opts.diffPct);
        if(global.desktopAPI && global.desktopAPI.invoke){ global.desktopAPI.invoke('send-auto-press', base); }
        else if(global.require){ const { ipcRenderer } = global.require('electron'); if(ipcRenderer && ipcRenderer.invoke){ ipcRenderer.invoke('send-auto-press', base); } }
      } catch(_){ }
    }

  function getExcelRecord(){ return state.records['excel'] || null; }
  // Auto Suspend based on diff% (replaces old shock detection)
  let autoSuspendThresholdPct = 40; // default, user-configurable (15-80%)
  let autoSuspendActive = false; // currently suspended due to high diff
    function getMid(){ const d=state.derived; return (d && d.hasMid && Array.isArray(d.mid) && d.mid.length===2)? d.mid : null; }

    function computeDerived(){ try { state.derived = (global.OddsCore && global.OddsCore.computeDerivedFrom) ? global.OddsCore.computeDerivedFrom(state.records) : { hasMid:false, arbProfitPct:null, mid:null }; } catch(_){ state.derived={ hasMid:false, arbProfitPct:null, mid:null }; } }

    function attachSwapSync(){
      try {
        const apply = (list)=>{
          try {
            if(!global.__swappedBrokers) global.__swappedBrokers = new Set();
            global.__swappedBrokers.clear();
            (list||[]).forEach(b=>{ try { const v=String(b||'').trim(); if(v) global.__swappedBrokers.add(v); } catch(_){ } });
            computeDerived();
            applyExcelGuard();
            applyMarketGuard();
            // If engine is active, step so it uses new mid immediately.
            if(sharedEngine && sharedEngine.state && sharedEngine.state.active){ try { sharedEngine.step(); } catch(_){ } }
          } catch(_){ }
        };
        if(global.desktopAPI && global.desktopAPI.onSwappedBrokersUpdated){
          global.desktopAPI.onSwappedBrokersUpdated(apply);
          if(global.desktopAPI.getSwappedBrokers){ global.desktopAPI.getSwappedBrokers().then(apply).catch(()=>{}); }
          return;
        }
        if(global.require){
          const { ipcRenderer } = global.require('electron');
          if(ipcRenderer && ipcRenderer.on){
            ipcRenderer.on('swapped-brokers-updated', (_e, list)=> apply(list));
            try { ipcRenderer.invoke('swapped-brokers-get').then(apply).catch(()=>{}); } catch(_){ }
          }
        }
      } catch(_){ }
    }

    function invokeSetting(channel){
      try {
        if(global.desktopAPI && typeof global.desktopAPI.invoke==='function'){
          return global.desktopAPI.invoke(channel);
        }
      } catch(_){ }
      try {
        if(global.require){
          const { ipcRenderer } = global.require('electron');
          if(ipcRenderer && typeof ipcRenderer.invoke==='function') return ipcRenderer.invoke(channel);
        }
      } catch(_){ }
      return Promise.reject(new Error('invoke unavailable'));
    }

    function applyExcelGuard(){
      const ex = getExcelRecord(); if(!ex) return;
      if(!sharedEngine || !sharedEngine.state) return;
      const eng = sharedEngine;
      const st = eng.state;
      let anyDisabled=false, anyEnabled=false;
      // Suspend
      if(ex.frozen && st.active){
        st.lastDisableReason='excel-suspended';
        eng.setActive(false);
        anyDisabled=true;
        notifyAllUIs('onActiveChanged', false, st, { excelSuspended:true });
        statusAll('Suspended: excel');
      }
      // Resume
      else if(!ex.frozen && !st.active && st.userWanted && st.lastDisableReason==='excel-suspended'){
        eng.setActive(true);
        anyEnabled=true;
        st.lastDisableReason='excel-resumed';
        notifyAllUIs('onActiveChanged', true, st, { excelResumed:true });
        statusAll('Resumed: excel');
        try { eng.step(); } catch(_){ }
      }
      // Broadcast state change across windows so late-loaded views sync
      try {
        if(anyDisabled){ if(global.desktopAPI && global.desktopAPI.send){ global.desktopAPI.send('auto-active-set', { on:false }); } else if(global.require){ const { ipcRenderer } = global.require('electron'); if(ipcRenderer && ipcRenderer.send){ ipcRenderer.send('auto-active-set', { on:false }); } } }
        else if(anyEnabled){ if(global.desktopAPI && global.desktopAPI.send){ global.desktopAPI.send('auto-active-set', { on:true }); } else if(global.require){ const { ipcRenderer } = global.require('electron'); if(ipcRenderer && ipcRenderer.send){ ipcRenderer.send('auto-active-set', { on:true }); } } }
      } catch(_){ }
    }

    const ARB_SUSPEND_PCT = 5.0;
    function applyMarketGuard(){
      const d=state.derived; if(!d) return;
      if(!sharedEngine || !sharedEngine.state) return;
      const eng = sharedEngine;
      const st = eng.state;
      const shouldSuspend = (!d.hasMid) || (typeof d.arbProfitPct==='number' && d.arbProfitPct >= ARB_SUSPEND_PCT);
      if(shouldSuspend){
        let anyDisabled=false;
        if(st.active){
          anyDisabled=true;
          st.lastDisableReason = (!d.hasMid)?'no-mid':'arb-spike';
          eng.setActive(false);
          notifyAllUIs('onActiveChanged', false, st, { marketSuspended:true });
        }
        if(anyDisabled){
          try { console.log('[autoHub][marketGuard] suspend', { noMid: !d.hasMid, arbProfitPct: d.arbProfitPct }); } catch(_){ }
          const reason = !d.hasMid ? 'market:no-mid' : ('market:arb-'+(typeof d.arbProfitPct==='number'? Number(d.arbProfitPct).toFixed(1): 'n/a'));
          statusAll(!d.hasMid? 'Suspended: no mid' : ('Suspended: arb spike '+Number(d.arbProfitPct).toFixed(1)+'%'));
          sendAutoPressF21({ reason });
          // Broadcast OFF so other windows reflect true state
          try { if(global.desktopAPI && global.desktopAPI.send){ global.desktopAPI.send('auto-active-set', { on:false }); } else if(global.require){ const { ipcRenderer } = global.require('electron'); if(ipcRenderer && ipcRenderer.send){ ipcRenderer.send('auto-active-set', { on:false }); } } } catch(_){ }
          // Retry after 500ms if Excel still trading
          setTimeout(()=>{ try { const ex=getExcelRecord(); const stillTrading = !ex || !ex.frozen; if(stillTrading){ sendAutoPressF21({ reason: reason+':retry', retry:true }); } } catch(_){ } }, 500);
        }
      } else {
        // Resume if previously disabled due to market and userWanted=true
        if(!st.active && st.userWanted && (st.lastDisableReason==='no-mid' || st.lastDisableReason==='arb-spike')){
          eng.setActive(true);
          st.lastDisableReason='market-resumed';
          notifyAllUIs('onActiveChanged', true, st, { marketResumed:true });
          // Broadcast ON so other windows reflect true state
          try { if(global.desktopAPI && global.desktopAPI.send){ global.desktopAPI.send('auto-active-set', { on:true }); } else if(global.require){ const { ipcRenderer } = global.require('electron'); if(ipcRenderer && ipcRenderer.send){ ipcRenderer.send('auto-active-set', { on:true }); } } } catch(_){ }
          statusAll('Resumed: market OK');
          sendAutoPressF21({ reason:'market:resume', resume:true });
          setTimeout(()=>{ try { const d2=state.derived; const ok = d2 && d2.hasMid && (!d2.arbProfitPct || d2.arbProfitPct < ARB_SUSPEND_PCT); if(ok && eng.state.active){ sendAutoPressF21({ reason:'market:resume:retry', resume:true, retry:true }); } } catch(_){ } }, 500);
          try { eng.step(); } catch(_){ }
        }
      }
    }

    // Auto Suspend based on diff% between Excel and Mid
    // Suspend when diff >= autoSuspendThresholdPct
    // Resume when diff < autoSuspendThresholdPct / 2
    function maybeAutoSuspendByDiff(){
      try {
        if(!(typeof autoSuspendThresholdPct==='number' && !isNaN(autoSuspendThresholdPct) && autoSuspendThresholdPct > 0)) return;
        const ex = getExcelRecord();
        const mid = getMid();
        if(!ex || !Array.isArray(ex.odds) || ex.odds.length!==2 || !mid) return;
        
        const n1=parseFloat(ex.odds[0]); const n2=parseFloat(ex.odds[1]);
        if(isNaN(n1)||isNaN(n2)) return;
        
        // Calculate diff for min side (same logic as auto_core)
        const sideToCheck = (mid[0] <= mid[1]) ? 0 : 1;
        const exVal = sideToCheck === 0 ? n1 : n2;
        const midVal = mid[sideToCheck];
        if(!(midVal > 0)) return;
        
        const diffPct = Math.abs(exVal - midVal) / midVal * 100;
        
        const resumeThreshold = autoSuspendThresholdPct / 2;
        
        // Suspend: diff >= threshold and not already suspended
        if(diffPct >= autoSuspendThresholdPct && !autoSuspendActive){
          if(!sharedEngine || !sharedEngine.state) return;
          const eng = sharedEngine;
          const st = eng.state;
          if(st.active){
            autoSuspendActive = true;
            eng.setActive(false);
            st.lastDisableReason = 'diff-suspend';
            notifyAllUIs('onActiveChanged', false, st, { diffSuspend: true, diffPct });
            statusAll('Suspended: diff '+diffPct.toFixed(1)+'% >= '+autoSuspendThresholdPct+'%');
            try { console.log('[autoHub][diffGuard] suspend', { diffPct: diffPct.toFixed(2), threshold: autoSuspendThresholdPct }); } catch(_){ }
            sendAutoPressF21({ reason: 'diff-suspend:'+diffPct.toFixed(1)+'%', diffPct });
            try { if(global.desktopAPI && global.desktopAPI.send){ global.desktopAPI.send('auto-active-set', { on:false }); } else if(global.require){ const { ipcRenderer } = global.require('electron'); if(ipcRenderer && ipcRenderer.send){ ipcRenderer.send('auto-active-set', { on:false }); } } } catch(_){ }
          }
        }
        // Resume: diff < resumeThreshold and was suspended due to diff
        else if(autoSuspendActive && diffPct < resumeThreshold){
          if(!sharedEngine || !sharedEngine.state) return;
          const eng = sharedEngine;
          const st = eng.state;
          if(!st.active && st.userWanted && st.lastDisableReason === 'diff-suspend'){
            autoSuspendActive = false;
            eng.setActive(true);
            st.lastDisableReason = 'diff-resumed';
            notifyAllUIs('onActiveChanged', true, st, { diffResumed: true, diffPct });
            statusAll('Resumed: diff '+diffPct.toFixed(1)+'% < '+resumeThreshold.toFixed(0)+'%');
            try { console.log('[autoHub][diffGuard] resume', { diffPct: diffPct.toFixed(2), resumeThreshold }); } catch(_){ }
            try { if(global.desktopAPI && global.desktopAPI.send){ global.desktopAPI.send('auto-active-set', { on:true }); } else if(global.require){ const { ipcRenderer } = global.require('electron'); if(ipcRenderer && ipcRenderer.send){ ipcRenderer.send('auto-active-set', { on:true }); } } } catch(_){ }
            try { eng.step(); } catch(_){ }
          }
        }
        // Clear suspend flag if user manually re-enabled
        else if(autoSuspendActive && sharedEngine && sharedEngine.state && sharedEngine.state.active){
          autoSuspendActive = false;
        }
      } catch(_){ }
    }

    function onHubUpdate(st){ try { state.records = Object.assign({}, st.records||{}); computeDerived(); applyExcelGuard(); applyMarketGuard(); maybeAutoSuspendByDiff(); } catch(_){ } }

    function attachOdds(){ if(!oddsHub) return; oddsHub.subscribe(onHubUpdate); oddsHub.start(); }

    // Swap sync impacts derived (mid/arb) used by auto.
    attachSwapSync();

  function addBroadcastListeners(){
      try {
        // Use shared engine directly instead of iterating views
        const applyConfigAll = (cfg)=>{ if(!cfg || !sharedEngine) return; try { sharedEngine.setConfig(cfg); } catch(_){ } };
        
        // Handle state set from main process (main process owns toggle logic)
        const handleStateSet = (p)=>{
          const want = !!(p && p.active);
          console.log('[autoHub] handleStateSet, want:', want, 'canEnable:', canEnableAuto());
          
          if(want && !canEnableAuto()){
            try {
              const info = getAutoEnableInfo();
              if(info && info.reasonCode) markAllDisableReason(info.reasonCode);
              statusAll(info && info.reasonCode ? ('Auto blocked: '+info.reasonCode) : 'Start Excel script');
            } catch(_){ statusAll('Start Excel script'); }
            // Tell main to turn off
            try {
              if(global.desktopAPI && global.desktopAPI.send){ global.desktopAPI.send('auto-active-set', { on: false }); }
              else if(global.require){ const { ipcRenderer } = global.require('electron'); if(ipcRenderer && ipcRenderer.send){ ipcRenderer.send('auto-active-set', { on: false }); } }
            } catch(_){ }
            return;
          }
          
          if(sharedEngine){
            if(!want){ try { sharedEngine.state.lastDisableReason = 'manual'; } catch(_){ } }
            if(want !== sharedEngine.state.active){ 
              sharedEngine.setActive(want); 
              notifyAllUIs('onActiveChanged', want, sharedEngine.state);
            }
          }
        };
        
        // Legacy toggle handler - now just syncs to what main decided
        const handleToggle = ()=>{
          // Main process handles toggle now, this is for legacy compatibility
          console.log('[autoHub] handleToggle (legacy) - ignored, main handles state');
        };
        const handleSet = (p)=>{
          const want=!!(p&&p.on);
          if(want && !canEnableAuto()){
            try {
              const info = getAutoEnableInfo();
              if(info && info.reasonCode) markAllDisableReason(info.reasonCode);
              statusAll(info && info.reasonCode ? ('Auto blocked: '+info.reasonCode) : 'Start Excel script');
            } catch(_){ statusAll('Start Excel script'); }
            disableAllAutoDueToExcelStop();
            // Broadcast OFF so other windows converge.
            broadcastAutoActiveOff();
            return;
          }
          if(sharedEngine){
            if(!want){ try { sharedEngine.state.lastDisableReason = 'manual'; } catch(_){ } }
            if(want!==sharedEngine.state.active){ sharedEngine.setActive(want); }
            notifyAllUIs('onActiveChanged', want, sharedEngine.state);
          }
        };
        const handleDisable = ()=>{
          let changed=false;
          if(sharedEngine && sharedEngine.state.active){
            try { sharedEngine.state.lastDisableReason = 'manual'; } catch(_){ }
            sharedEngine.setActive(false);
            changed=true;
            notifyAllUIs('onActiveChanged', false, sharedEngine.state);
          }
          // Notify others only if we actually disabled something
          try {
            if(changed){
              if(global.desktopAPI && global.desktopAPI.send){ global.desktopAPI.send('auto-active-set', { on:false }); }
              else if(global.require){ const { ipcRenderer } = global.require('electron'); if(ipcRenderer && ipcRenderer.send){ ipcRenderer.send('auto-active-set', { on:false }); } }
            }
          } catch(_){ }
        };
        const handleActiveSet = (p)=>{
          try {
            const want=!!(p&&p.on);
            if(want && !canEnableAuto()){
              try {
                const info = getAutoEnableInfo();
                if(info && info.reasonCode) markAllDisableReason(info.reasonCode);
                statusAll(info && info.reasonCode ? ('Auto blocked: '+info.reasonCode) : 'Start Excel script');
              } catch(_){ statusAll('Start Excel script'); }
              disableAllAutoDueToExcelStop();
              broadcastAutoActiveOff();
              return;
            }
            if(sharedEngine){
              if(!want){ try { sharedEngine.state.lastDisableReason = 'manual'; } catch(_){ } }
              if(want!==sharedEngine.state.active){ sharedEngine.setActive(want); notifyAllUIs('onActiveChanged', want, sharedEngine.state); }
            }
          } catch(_){ }
        };
        console.log('[autoHub] addBroadcastListeners: global.desktopAPI=', !!global.desktopAPI, 'global.require=', !!global.require);
        if(global.desktopAPI){
          console.log('[autoHub] subscribing via desktopAPI');
          // Main process state set (new primary method)
          if(global.desktopAPI.onAutoStateSet) global.desktopAPI.onAutoStateSet(handleStateSet);
          // Legacy handlers for backward compatibility
          if(global.desktopAPI.onAutoToggleAll) global.desktopAPI.onAutoToggleAll(handleToggle);
          if(global.desktopAPI.onAutoSetAll) global.desktopAPI.onAutoSetAll(handleSet);
          if(global.desktopAPI.onAutoDisableAll) global.desktopAPI.onAutoDisableAll(handleDisable);
          if(global.desktopAPI.onAutoActiveSet) global.desktopAPI.onAutoActiveSet(handleActiveSet);

          // Settings live updates via bridge
          try {
            if(global.desktopAPI.onAutoToleranceUpdated){ global.desktopAPI.onAutoToleranceUpdated((v)=>{ if(typeof v==='number' && !isNaN(v)) applyConfigAll({ tolerancePct:v }); }); }
            if(global.desktopAPI.onAutoIntervalUpdated){ global.desktopAPI.onAutoIntervalUpdated((v)=>{ if(typeof v==='number' && !isNaN(v)) applyConfigAll({ stepMs:v }); }); }
            if(global.desktopAPI.onAutoAdaptiveUpdated){ global.desktopAPI.onAutoAdaptiveUpdated((v)=>{ if(typeof v==='boolean') applyConfigAll({ adaptive:v }); }); }
            if(global.desktopAPI.onAutoBurstLevelsUpdated){ global.desktopAPI.onAutoBurstLevelsUpdated((levels)=>{ if(Array.isArray(levels)) applyConfigAll({ burstLevels:levels }); }); }
          } catch(_){ }
        } else if(global.require){
          const { ipcRenderer } = global.require('electron');
          if(ipcRenderer){
            // Main process state set (primary)
            ipcRenderer.on('auto-state-set', (_e,p)=> handleStateSet(p));
            // Legacy handlers
            ipcRenderer.on('auto-toggle-all', handleToggle);
            ipcRenderer.on('auto-set-all', (_e,p)=> handleSet(p));
            ipcRenderer.on('auto-disable-all', handleDisable);
            ipcRenderer.on('auto-active-set', (_e,p)=> handleActiveSet(p));
            // Apply settings updates to all engines centrally
            ipcRenderer.on('auto-tolerance-updated', (_e, v)=>{ if(typeof v==='number' && !isNaN(v)) applyConfigAll({ tolerancePct:v }); });
            ipcRenderer.on('auto-interval-updated', (_e, v)=>{ if(typeof v==='number' && !isNaN(v)) applyConfigAll({ stepMs:v }); });
            ipcRenderer.on('auto-adaptive-updated', (_e, v)=>{ if(typeof v==='boolean') applyConfigAll({ adaptive:v }); });
            ipcRenderer.on('auto-burst-levels-updated', (_e, levels)=>{ if(Array.isArray(levels)) applyConfigAll({ burstLevels:levels }); });
            // Auto Suspend threshold live update
            ipcRenderer.on('auto-suspend-threshold-updated', (_e,v)=>{ if(typeof v==='number' && !isNaN(v)) autoSuspendThresholdPct=v; });
            // Initial fetch
            ipcRenderer.invoke('auto-suspend-threshold-get').then(v=>{ if(typeof v==='number' && !isNaN(v)) autoSuspendThresholdPct=v; }).catch(()=>{});
          }
        }
      } catch(_){ }
    }

  // Single shared engine - only one engine exists, multiple views share it
  let sharedEngine = null;
  const viewUIs = new Map(); // id -> ui callbacks only

  function notifyAllUIs(method, ...args){
    viewUIs.forEach((ui, id)=>{
      try { if(ui && typeof ui[method]==='function') ui[method](...args); } catch(_){ }
    });
  }

  function attachView(id, ui){
      if(!global.AutoCore || !global.AutoCore.createAutoEngine){ throw new Error('AutoCore missing'); }
      const ns = String(id||'view');
      
      // Store UI callbacks for this view
      viewUIs.set(ns, ui);
      
      // Create engine only once (first attachView call)
      if(!sharedEngine){
        sharedEngine = global.AutoCore.createAutoEngine({
          parseMid: ()=> getMid(),
          parseExcel: ()=>{ const ex=getExcelRecord(); if(ex && Array.isArray(ex.odds) && ex.odds.length===2){ const n1=parseFloat(ex.odds[0]), n2=parseFloat(ex.odds[1]); if(!isNaN(n1)&&!isNaN(n2)) return [n1,n2]; } return null; },
          flash: (idx)=>{ notifyAllUIs('flash', idx); },
          status: (msg)=>{ notifyAllUIs('status', msg); },
          onActiveChanged: (active, st, meta)=>{
            notifyAllUIs('onActiveChanged', active, st, meta);
            // Handle excel-no-change suspend: send F21 and broadcast OFF
            if(!active && st && st.lastDisableReason === 'excel-no-change'){
              try {
                console.log('[autoHub][excelNoChangeGuard] suspend after', st.excelNoChangeCount, 'failed attempts');
                sendAutoPressF21({ reason: 'excel-no-change:x'+st.excelNoChangeCount });
                // Broadcast OFF to all windows
                if(global.desktopAPI && global.desktopAPI.send){ global.desktopAPI.send('auto-active-set', { on:false }); }
                else if(global.require){ const { ipcRenderer } = global.require('electron'); if(ipcRenderer && ipcRenderer.send){ ipcRenderer.send('auto-active-set', { on:false }); } }
              } catch(_){ }
            }
          },
          storageKeys: { userWantedKey: 'shared:autoUserWanted' },
        });
        
        // Initialize engine config from persisted global settings
        try {
          Promise.all([
            invokeSetting('auto-tolerance-get').catch(()=>null),
            invokeSetting('auto-interval-get').catch(()=>null),
            invokeSetting('auto-adaptive-get').catch(()=>null),
            invokeSetting('auto-burst-levels-get').catch(()=>null),
          ]).then(([tol, interval, adaptive, levels])=>{
            const cfg = {};
            const missing = [];
            if(typeof tol==='number' && !isNaN(tol)) cfg.tolerancePct = tol; else missing.push('Tolerance');
            cfg.stepMs = (typeof interval==='number' && !isNaN(interval)) ? interval : 500;
            cfg.adaptive = (typeof adaptive==='boolean') ? adaptive : false;
            cfg.burstLevels = (Array.isArray(levels) && levels.length) ? levels : [
              { thresholdPct:25, pulses:4 },
              { thresholdPct:15, pulses:3 },
              { thresholdPct:10, pulses:2 }
            ];
            try { sharedEngine.setConfig(cfg); } catch(_){ }
            try { if(sharedEngine && sharedEngine.state && sharedEngine.state.active){ sharedEngine.step(); } } catch(_){ }
            if(missing.length){
              notifyAllUIs('status', 'Set in Settings: '+missing.join(', '));
              try { sharedEngine.setActive(false); } catch(_){ }
            }
          }).catch(()=>{});
        } catch(_){ }
        
        // Late-loaded window: request last known global state from main
        try {
          if(global.require){
            const { ipcRenderer } = global.require('electron');
            if(ipcRenderer && ipcRenderer.invoke){
              try { console.log('[autoHub][attachView] requesting auto-state-get ...'); } catch(_){ }
              ipcRenderer.invoke('auto-state-get').then(s=>{ try {
                try { console.log('[autoHub][attachView] got auto-state', s); } catch(_){ }
                if(s && typeof s==='object'){
                  if(typeof s.active==='boolean' && s.active){ try { sharedEngine.setActive(true); } catch(_){ } }
                }
              } catch(_){ } }).catch(()=>{});
            }
          }
        } catch(_){ }
      }
      
      // For compatibility: also add to views map with shared engine
      views.set(ns, { engine: sharedEngine, ui, ns });
      
      return {
        get state(){ return sharedEngine.state; },
        setConfig: (p)=>{ try { sharedEngine.setConfig(p||{}); } catch(_){ } },
        setActive: (on)=>{
          const val = !!on;
          if(val && !canEnableAuto()){
            try {
              const info = getAutoEnableInfo();
              if(info && info.reasonCode){
                try { sharedEngine.state.lastDisableReason = info.reasonCode; } catch(_){ }
                notifyAllUIs('status', 'Auto blocked: '+info.reasonCode);
              } else {
                notifyAllUIs('status', 'Start Excel script');
              }
            } catch(_){ notifyAllUIs('status', 'Start Excel script'); }
            disableAllAutoDueToExcelStop();
            broadcastAutoActiveOff();
            return;
          }
          // Single engine - just set it once
          const was = !!sharedEngine.state.active;
          if(!val){ try { sharedEngine.state.lastDisableReason = 'manual'; } catch(_){ } }
          if(was !== val){ sharedEngine.setActive(val); }
          // Notify all UI views
          notifyAllUIs('onActiveChanged', val, sharedEngine.state);
          // Broadcast across windows to sync late/other views
          try {
            if(global.desktopAPI && global.desktopAPI.send){ global.desktopAPI.send('auto-active-set', { on: val }); }
            else if(global.require){ const { ipcRenderer } = global.require('electron'); if(ipcRenderer && ipcRenderer.send){ ipcRenderer.send('auto-active-set', { on: val }); } }
          } catch(_){ }
        },
        step: ()=> sharedEngine.step(),
        schedule: (d)=> sharedEngine.schedule(d),
      };
    }

    // bootstrap
    attachOdds();
    attachExcelProcStatus();
    addBroadcastListeners();

    return {
      attachView,
      getState:()=> ({ records:state.records, derived:state.derived }),
      getAutoEnableInfo,
      setScriptMap,
      setBoardMap,
    };
  }

  global.AutoHub = createAutoHub();
})(window);

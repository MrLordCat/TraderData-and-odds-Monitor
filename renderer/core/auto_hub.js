// Centralized Auto Hub: manages AutoCore engines per view, reads data from OddsCore hub
// Responsibilities:
//  - Subscribe to OddsCore hub state and compute derived + excel record
//  - Create per-view AutoCore engines with providers that read from shared state (no DOM parsing)
//  - Apply Excel suspend/resume and market guards centrally (with F21 + 500ms retry once)
//  - Handle global auto broadcasts (toggle/set/disable) across attached views
//  - Expose thin API for views: attachView(id,{ onActiveChanged, flash, status, storageNs }) -> { state, setActive, setAutoResume, step, schedule }
(function(global){
  if(global.AutoHub) return;

  function now(){ return Date.now(); }

  function createAutoHub(){
    const oddsHub = (global.OddsCore && global.OddsCore.createOddsHub) ? global.OddsCore.createOddsHub() : null;
    const state = { records:{}, derived:{ hasMid:false, arbProfitPct:null, mid:null } };
    const views = new Map(); // id -> { engine, ui, ns }
    let lastF21At = 0;
  let suppressResumeBroadcast = false;

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
        }
      };
      // Block when status unknown (startup) OR when not running OR when starting/installing.
      if(excelProcRunning !== true){
        info.reasonCode = (excelProcRunning === null) ? 'excel-unknown' : 'excel-off';
        return info;
      }
      if(excelProcInstalling){ info.reasonCode = 'excel-installing'; return info; }
      if(excelProcStarting){ info.reasonCode = 'excel-starting'; return info; }
      info.canEnable = true;
      return info;
    }

    function markAllDisableReason(reasonCode){
      if(!reasonCode) return;
      views.forEach(v=>{
        try {
          if(v && v.engine && v.engine.state){ v.engine.state.lastDisableReason = reasonCode; }
        } catch(_){ }
      });
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
      views.forEach(v=>{
        try {
          if(v && v.engine && v.engine.state && v.engine.state.active){
            anyWasActive = true;
            v.engine.setActive(false);
          }
        } catch(_){ }
      });
      if(anyWasActive){
        // Ensure other windows (late loads) sync to OFF.
        broadcastAutoActiveOff();
      }
    }

    function statusAll(msg){
      try { views.forEach(v=>{ try { v.ui && v.ui.status && v.ui.status(msg); } catch(_){ } }); } catch(_){ }
    }

    function canEnableAuto(){
      // Block when status unknown (startup) OR when not running OR when starting/installing.
      if(excelProcRunning !== true) return false;
      if(excelProcStarting) return false;
      if(excelProcInstalling) return false;
      return true;
    }

    function applyExcelProcStatus(s){
      try {
        const prevRunning = excelProcRunning;
        excelProcRunning = !!(s && s.running);
        excelProcStarting = !!(s && s.starting);
        excelProcInstalling = !!(s && s.installing);
        excelProcError = (s && s.error) ? String(s.error) : null;

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
  let shockThresholdPct = null; // user-configurable
  let lastExcelForShock = null;
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
            // If any engine is active, step so it uses new mid immediately.
            views.forEach(v=>{ try { if(v && v.engine && v.engine.state && v.engine.state.active){ v.engine.step(); } } catch(_){ } });
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
      let anyDisabled=false, anyEnabled=false;
      views.forEach(v=>{
        const eng=v.engine, ui=v.ui; if(!eng||!eng.state) return;
        const st=eng.state;
        // Suspend
        if(ex.frozen && st.active){ st.lastDisableReason='excel-suspended'; eng.setActive(false); anyDisabled=true; try { ui.onActiveChanged && ui.onActiveChanged(false, st, { excelSuspended:true }); } catch(_){ } try { ui && ui.status && ui.status('Suspended: excel'); } catch(_){ } }
        // Resume
        else if(!ex.frozen && !st.active && st.userWanted && st.lastDisableReason==='excel-suspended'){
          if(st.autoResume){ eng.setActive(true); anyEnabled=true; st.lastDisableReason='excel-resumed'; try { ui.onActiveChanged && ui.onActiveChanged(true, st, { excelResumed:true }); } catch(_){ } try { ui && ui.status && ui.status('Resumed: excel'); } catch(_){ } try { eng.step(); } catch(_){ } }
        }
      });
      // Broadcast state change across windows so late-loaded views sync
      try {
        if(anyDisabled){ if(global.desktopAPI && global.desktopAPI.send){ global.desktopAPI.send('auto-active-set', { on:false }); } else if(global.require){ const { ipcRenderer } = global.require('electron'); if(ipcRenderer && ipcRenderer.send){ ipcRenderer.send('auto-active-set', { on:false }); } } }
        else if(anyEnabled){ if(global.desktopAPI && global.desktopAPI.send){ global.desktopAPI.send('auto-active-set', { on:true }); } else if(global.require){ const { ipcRenderer } = global.require('electron'); if(ipcRenderer && ipcRenderer.send){ ipcRenderer.send('auto-active-set', { on:true }); } } }
      } catch(_){ }
    }

    const ARB_SUSPEND_PCT = 5.0;
    function applyMarketGuard(){
      const d=state.derived; if(!d) return;
      const shouldSuspend = (!d.hasMid) || (typeof d.arbProfitPct==='number' && d.arbProfitPct >= ARB_SUSPEND_PCT);
      if(shouldSuspend){
        let anyDisabled=false;
        views.forEach(v=>{
          const eng=v.engine, ui=v.ui; if(!eng||!eng.state) return; const st=eng.state; if(!st.autoResume) return; if(st.active){ anyDisabled=true; st.lastDisableReason = (!d.hasMid)?'no-mid':'arb-spike'; eng.setActive(false); try { ui.onActiveChanged && ui.onActiveChanged(false, st, { marketSuspended:true }); } catch(_){ } }
        });
        if(anyDisabled){
          try { console.log('[autoHub][marketGuard] suspend', { noMid: !d.hasMid, arbProfitPct: d.arbProfitPct }); } catch(_){ }
          const reason = !d.hasMid ? 'market:no-mid' : ('market:arb-'+(typeof d.arbProfitPct==='number'? Number(d.arbProfitPct).toFixed(1): 'n/a'));
          try { views.forEach(v=>{ try { v.ui && v.ui.status && v.ui.status(!d.hasMid? 'Suspended: no mid' : ('Suspended: arb spike '+Number(d.arbProfitPct).toFixed(1)+'%')); } catch(_){ } }); } catch(_){ }
          sendAutoPressF21({ reason });
          // Broadcast OFF so other windows reflect true state
          try { if(global.desktopAPI && global.desktopAPI.send){ global.desktopAPI.send('auto-active-set', { on:false }); } else if(global.require){ const { ipcRenderer } = global.require('electron'); if(ipcRenderer && ipcRenderer.send){ ipcRenderer.send('auto-active-set', { on:false }); } } } catch(_){ }
          // Retry after 500ms if Excel still trading
          setTimeout(()=>{ try { const ex=getExcelRecord(); const stillTrading = !ex || !ex.frozen; if(stillTrading){ sendAutoPressF21({ reason: reason+':retry', retry:true }); } } catch(_){ } }, 500);
        }
      } else {
        // Resume if previously disabled due to market and userWanted=true
        views.forEach(v=>{
          const eng=v.engine, ui=v.ui; if(!eng||!eng.state) return; const st=eng.state; if(!st.autoResume) return;
          if(!st.active && st.userWanted && (st.lastDisableReason==='no-mid' || st.lastDisableReason==='arb-spike')){
            eng.setActive(true); st.lastDisableReason='market-resumed'; try { ui.onActiveChanged && ui.onActiveChanged(true, st, { marketResumed:true }); } catch(_){ }
            // Broadcast ON so other windows reflect true state
            try { if(global.desktopAPI && global.desktopAPI.send){ global.desktopAPI.send('auto-active-set', { on:true }); } else if(global.require){ const { ipcRenderer } = global.require('electron'); if(ipcRenderer && ipcRenderer.send){ ipcRenderer.send('auto-active-set', { on:true }); } } } catch(_){ }
            try { views.forEach(x=>{ try { x.ui && x.ui.status && x.ui.status('Resumed: market OK'); } catch(_){ } }); } catch(_){ }
            sendAutoPressF21({ reason:'market:resume', resume:true }); setTimeout(()=>{ try { const d2=state.derived; const ok = d2 && d2.hasMid && (!d2.arbProfitPct || d2.arbProfitPct < ARB_SUSPEND_PCT); if(ok && eng.state.active){ sendAutoPressF21({ reason:'market:resume:retry', resume:true, retry:true }); } } catch(_){ } }, 500);
            try { eng.step(); } catch(_){ }
          }
        });
      }
    }

    function maybeShockSuspend(){
      try {
        if(!(typeof shockThresholdPct==='number' && !isNaN(shockThresholdPct))) return;
        const ex = getExcelRecord(); if(!ex || !Array.isArray(ex.odds) || ex.odds.length!==2) return;
        const n1=parseFloat(ex.odds[0]); const n2=parseFloat(ex.odds[1]); if(isNaN(n1)||isNaN(n2)) return;
        const cur=[n1,n2];
        if(lastExcelForShock && Array.isArray(lastExcelForShock) && lastExcelForShock.length===2){
          const p1 = lastExcelForShock[0]; const p2 = lastExcelForShock[1];
          // Per-side jumps (для справки в логах)
          const j1 = p1>0 ? Math.abs((cur[0]-p1)/p1)*100 : NaN;
          const j2 = p2>0 ? Math.abs((cur[1]-p2)/p2)*100 : NaN;
          // Реакция только на минимальный оддс: сравниваем jump у минимума
          const prevMinIdx = (p1<=p2 ? 0 : 1);
          const curMinIdx = (cur[0]<=cur[1] ? 0 : 1);
          const prevMinVal = prevMinIdx===0 ? p1 : p2;
          const curMinVal = curMinIdx===0 ? cur[0] : cur[1];
          if(!(prevMinVal>0)) { lastExcelForShock = cur; return; }
          const jumpMin = Math.abs((curMinVal - prevMinVal) / prevMinVal) * 100;
          if(jumpMin >= shockThresholdPct){
            // Suspend all active engines
            let anyDisabled=false;
            views.forEach(v=>{ try {
              const eng=v.engine; if(!eng||!eng.state) return; const st=eng.state;
              if(st.active){ eng.setActive(false); st.lastDisableReason='shock'; anyDisabled=true; try { v.ui.onActiveChanged && v.ui.onActiveChanged(false, st, { shock:true, jump: jumpMin }); } catch(_){ } try { v.ui && v.ui.status && v.ui.status('Suspended: shock '+jumpMin.toFixed(1)+'%'); } catch(_){ } }
            } catch(_){ } });
            if(anyDisabled){
              // Detailed diagnostics с упором на минимальный оддс
              const details = {
                prevOdds: [Number(p1), Number(p2)],
                curOdds: [Number(cur[0]), Number(cur[1])],
                perSideJumpsPct: { side0: isNaN(j1)? null : Number(j1.toFixed(2)), side1: isNaN(j2)? null : Number(j2.toFixed(2)) },
                minLine: {
                  prev: { idx: prevMinIdx, value: Number(prevMinVal) },
                  curr: { idx: curMinIdx, value: Number(curMinVal) },
                  switched: prevMinIdx !== curMinIdx,
                  jumpPct: Number(jumpMin.toFixed(2))
                },
                thresholdPct: Number(shockThresholdPct)
              };
              try {
                console.log('[autoHub][shockGuard] suspend', details);
                // Also forward to main so it appears in main console
                if(global.require){
                  const { ipcRenderer } = global.require('electron');
                  if(ipcRenderer && ipcRenderer.send){ ipcRenderer.send('renderer-log-forward', { level:'log', args: ['[autoHub][shockGuard] details', JSON.stringify(details)] }); }
                }
              } catch(_){ }
              sendAutoPressF21({ reason: 'shock:'+jumpMin.toFixed(1)+'%', diffPct: jumpMin });
              try { if(global.desktopAPI && global.desktopAPI.send){ global.desktopAPI.send('auto-active-set', { on:false }); } else if(global.require){ const { ipcRenderer } = global.require('electron'); if(ipcRenderer && ipcRenderer.send){ ipcRenderer.send('auto-active-set', { on:false }); } } } catch(_){ }
            }
          }
        }
        lastExcelForShock = cur;
      } catch(_){ }
    }

    function onHubUpdate(st){ try { state.records = Object.assign({}, st.records||{}); computeDerived(); applyExcelGuard(); applyMarketGuard(); maybeShockSuspend(); } catch(_){ } }

    function attachOdds(){ if(!oddsHub) return; oddsHub.subscribe(onHubUpdate); oddsHub.start(); }

    // Swap sync impacts derived (mid/arb) used by auto.
    attachSwapSync();

  function addBroadcastListeners(){
      try {
        const applyConfigAll = (cfg)=>{ if(!cfg) return; views.forEach(v=>{ try { if(v.engine && v.engine.setConfig) v.engine.setConfig(cfg); } catch(_){ } }); };
        const handleToggle = ()=>{
          let after = null;
          // If toggling ON while python script is OFF — block and keep OFF.
          if(!canEnableAuto()){
            try {
              const info = getAutoEnableInfo();
              if(info && info.reasonCode) markAllDisableReason(info.reasonCode);
              statusAll(info && info.reasonCode ? ('Auto blocked: '+info.reasonCode) : 'Start Excel script');
            } catch(_){ statusAll('Start Excel script'); }
            disableAllAutoDueToExcelStop();
            after = false;
          } else {
            views.forEach(v=>{ try { const eng=v.engine; if(eng){ const next = !eng.state.active; eng.setActive(next); after = next; } } catch(_){ } });
          }
          // Inform other windows about resulting state so late loads sync (and main updates __autoLast)
          try {
            if(after!==null){
              if(global.desktopAPI && global.desktopAPI.send){ global.desktopAPI.send('auto-active-set', { on: after }); }
              else if(global.require){ const { ipcRenderer } = global.require('electron'); if(ipcRenderer && ipcRenderer.send){ ipcRenderer.send('auto-active-set', { on: after }); } }
            }
          } catch(_){ }
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
          views.forEach(v=>{ try {
            const eng=v.engine; if(!eng) return;
            if(!want){ try { eng.state.lastDisableReason = 'manual'; } catch(_){ } }
            if(want!==eng.state.active){ eng.setActive(want); }
          } catch(_){ } });
        };
        const handleDisable = ()=>{ let changed=false; views.forEach(v=>{ try { const eng=v.engine; if(eng && eng.state.active){ try { eng.state.lastDisableReason = 'manual'; } catch(_){ } eng.setActive(false); changed=true; } } catch(_){ } });
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
            views.forEach(v=>{ try {
              const eng=v.engine; if(!eng) return;
              if(!want){ try { eng.state.lastDisableReason = 'manual'; } catch(_){ } }
              if(eng && want!==eng.state.active){ eng.setActive(want); if(v.ui && typeof v.ui.onActiveChanged==='function'){ v.ui.onActiveChanged(want, eng.state); } }
            } catch(_){ } });
          } catch(_){ }
        };
        const handleResumeSet = (p)=>{ try {
          const val = !!(p && p.on);
          suppressResumeBroadcast = true;
          views.forEach(v=>{ try {
            v.engine.setAutoResume(val);
            if(v.ui && typeof v.ui.onAutoResumeChanged==='function'){ v.ui.onAutoResumeChanged(val, v.engine.state); }
          } catch(_){ } });
        } finally { suppressResumeBroadcast = false; } };
        if(global.desktopAPI){
          if(global.desktopAPI.onAutoToggleAll) global.desktopAPI.onAutoToggleAll(handleToggle);
          if(global.desktopAPI.onAutoSetAll) global.desktopAPI.onAutoSetAll(handleSet);
          if(global.desktopAPI.onAutoDisableAll) global.desktopAPI.onAutoDisableAll(handleDisable);
          if(global.desktopAPI.onAutoResumeSet) global.desktopAPI.onAutoResumeSet(handleResumeSet);
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
            ipcRenderer.on('auto-toggle-all', handleToggle);
            ipcRenderer.on('auto-set-all', (_e,p)=> handleSet(p));
            ipcRenderer.on('auto-disable-all', handleDisable);
            ipcRenderer.on('auto-resume-set', (_e,p)=> handleResumeSet(p));
            ipcRenderer.on('auto-active-set', (_e,p)=> handleActiveSet(p));
            // Apply settings updates to all engines centrally
            ipcRenderer.on('auto-tolerance-updated', (_e, v)=>{ if(typeof v==='number' && !isNaN(v)) applyConfigAll({ tolerancePct:v }); });
            ipcRenderer.on('auto-interval-updated', (_e, v)=>{ if(typeof v==='number' && !isNaN(v)) applyConfigAll({ stepMs:v }); });
            ipcRenderer.on('auto-adaptive-updated', (_e, v)=>{ if(typeof v==='boolean') applyConfigAll({ adaptive:v }); });
            ipcRenderer.on('auto-burst-levels-updated', (_e, levels)=>{ if(Array.isArray(levels)) applyConfigAll({ burstLevels:levels }); });
            // Shock threshold live update
            ipcRenderer.on('auto-shock-threshold-updated', (_e,v)=>{ if(typeof v==='number' && !isNaN(v)) shockThresholdPct=v; });
            // Initial fetch
            ipcRenderer.invoke('auto-shock-threshold-get').then(v=>{ if(typeof v==='number' && !isNaN(v)) shockThresholdPct=v; }).catch(()=>{});
          }
        }
      } catch(_){ }
    }

  function attachView(id, ui){
      if(!global.AutoCore || !global.AutoCore.createAutoEngine){ throw new Error('AutoCore missing'); }
      const ns = String(id||'view');
      const engine = global.AutoCore.createAutoEngine({
        parseMid: ()=> getMid(),
        parseExcel: ()=>{ const ex=getExcelRecord(); if(ex && Array.isArray(ex.odds) && ex.odds.length===2){ const n1=parseFloat(ex.odds[0]), n2=parseFloat(ex.odds[1]); if(!isNaN(n1)&&!isNaN(n2)) return [n1,n2]; } return null; },
        flash: (idx)=>{ try { ui.flash && ui.flash(idx); } catch(_){ } },
        status: (msg)=>{ try { ui.status && ui.status(msg); } catch(_){ } },
        onActiveChanged: (active, st)=>{ try { ui.onActiveChanged && ui.onActiveChanged(active, st); } catch(_){ } },
        storageKeys: { autoResumeKey: ns+':autoResumeEnabled', userWantedKey: ns+':autoUserWanted' },
      });
      // Initialize engine config from persisted global settings (tolerance, interval, adaptive, burstLevels)
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
          // Provide safe defaults for missing params so auto can run once Tolerance is set
          cfg.stepMs = (typeof interval==='number' && !isNaN(interval)) ? interval : 500;
          cfg.adaptive = (typeof adaptive==='boolean') ? adaptive : false;
          cfg.burstLevels = (Array.isArray(levels) && levels.length) ? levels : [
            { thresholdPct:20, pulses:4 },
            { thresholdPct:12, pulses:3 },
            { thresholdPct:6, pulses:2 }
          ];
          try { engine.setConfig(cfg); } catch(_){ }
          try { if(engine && engine.state && engine.state.active){ engine.step(); } } catch(_){ }
          // If no tolerance configured at all, inform UI and keep auto off
          if(missing.length){
            try { ui && ui.status && ui.status('Set in Settings: '+missing.join(', ')); } catch(_){ }
            try { engine.setActive(false); } catch(_){ }
          }
        }).catch(()=>{});
      } catch(_){ }
      // If other views already exist, align this engine to their canonical state (first found)
      const first = views.values().next();
      if(first && first.value && first.value.engine && first.value.engine.state){
        const base = first.value.engine.state;
        try { engine.setAutoResume(!!base.autoResume); } catch(_){ }
        try { if(base.active){ engine.setActive(true); } } catch(_){ }
        try { if(ui && typeof ui.onAutoResumeChanged==='function'){ ui.onAutoResumeChanged(!!base.autoResume, engine.state); } } catch(_){ }
      } else {
        // Late-loaded window: request last known global state from main
        try {
          if(global.require){
            const { ipcRenderer } = global.require('electron');
            if(ipcRenderer && ipcRenderer.invoke){
              try { console.log('[autoHub][attachView]['+ns+'] requesting auto-state-get ...'); } catch(_){ }
              ipcRenderer.invoke('auto-state-get').then(s=>{ try {
                try { console.log('[autoHub][attachView]['+ns+'] got auto-state', s); } catch(_){ }
                if(s && typeof s==='object'){
                  if(typeof s.resume==='boolean'){ try { engine.setAutoResume(s.resume); } catch(_){ } try { ui && ui.onAutoResumeChanged && ui.onAutoResumeChanged(!!s.resume, engine.state); } catch(_){ } }
                  if(typeof s.active==='boolean' && s.active){ try { engine.setActive(true); } catch(_){ } }
                }
              } catch(_){ } }).catch(()=>{});
            }
          }
        } catch(_){ }
      }
      views.set(ns, { engine, ui, ns });
      return {
        get state(){ return engine.state; },
        setConfig: (p)=>{ try { engine.setConfig(p||{}); } catch(_){ } },
        setActive: (on)=>{
          const val = !!on;
          if(val && !canEnableAuto()){
            try {
              const info = getAutoEnableInfo();
              if(info && info.reasonCode){
                try { engine.state.lastDisableReason = info.reasonCode; } catch(_){ }
                try { ui && ui.status && ui.status('Auto blocked: '+info.reasonCode); } catch(_){ }
              } else {
                try { ui && ui.status && ui.status('Start Excel script'); } catch(_){ }
              }
            } catch(_){ try { ui && ui.status && ui.status('Start Excel script'); } catch(_){ } }
            disableAllAutoDueToExcelStop();
            broadcastAutoActiveOff();
            return;
          }
          // Apply to all views uniformly
          views.forEach(v=>{ try {
            const was = !!v.engine.state.active;
            if(!val){ try { v.engine.state.lastDisableReason = 'manual'; } catch(_){ } }
            if(was !== val){ v.engine.setActive(val); }
            if(v.ui && typeof v.ui.onActiveChanged==='function'){ v.ui.onActiveChanged(val, v.engine.state); }
          } catch(_){ } });
          // Broadcast across windows to sync late/other views
          try {
            if(global.desktopAPI && global.desktopAPI.send){ global.desktopAPI.send('auto-active-set', { on: val }); }
            else if(global.require){ const { ipcRenderer } = global.require('electron'); if(ipcRenderer && ipcRenderer.send){ ipcRenderer.send('auto-active-set', { on: val }); } }
          } catch(_){ }
        },
        setAutoResume: (on)=>{
          const val = !!on;
          engine.setAutoResume(val);
          // Propagate to all other views
          views.forEach(v=>{ try {
            if(v.engine!==engine){ v.engine.setAutoResume(val); if(v.ui && typeof v.ui.onAutoResumeChanged==='function'){ v.ui.onAutoResumeChanged(val, v.engine.state); } }
          } catch(_){ } });
          // Notify this view as well
          try { if(ui && typeof ui.onAutoResumeChanged==='function'){ ui.onAutoResumeChanged(val, engine.state); } } catch(_){ }
          // Broadcast across windows unless suppressed (to avoid loops)
          try {
            if(!suppressResumeBroadcast){
              if(global.desktopAPI && global.desktopAPI.send){ global.desktopAPI.send('auto-resume-set', { on: val }); }
              else if(global.require){ const { ipcRenderer } = global.require('electron'); if(ipcRenderer && ipcRenderer.send){ ipcRenderer.send('auto-resume-set', { on: val }); } }
            }
          } catch(_){ }
        },
        step: ()=> engine.step(),
        schedule: (d)=> engine.schedule(d),
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
    };
  }

  global.AutoHub = createAutoHub();
})(window);

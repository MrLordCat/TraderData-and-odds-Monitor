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

    function sendAutoPressF21(opts){
      try {
        const elapsed = now()-lastF21At; if(elapsed < 250) return; // debounce
        lastF21At = now();
        if(global.desktopAPI && global.desktopAPI.invoke){ global.desktopAPI.invoke('send-auto-press', Object.assign({ key:'F21', noConfirm:true }, opts||{})); }
        else if(global.require){ const { ipcRenderer } = global.require('electron'); if(ipcRenderer && ipcRenderer.invoke){ ipcRenderer.invoke('send-auto-press', Object.assign({ key:'F21', noConfirm:true }, opts||{})); } }
      } catch(_){ }
    }

    function getExcelRecord(){ return state.records['excel'] || state.records['dataservices'] || null; }
    function getMid(){ const d=state.derived; return (d && d.hasMid && Array.isArray(d.mid) && d.mid.length===2)? d.mid : null; }

    function computeDerived(){ try { state.derived = (global.OddsCore && global.OddsCore.computeDerivedFrom) ? global.OddsCore.computeDerivedFrom(state.records) : { hasMid:false, arbProfitPct:null, mid:null }; } catch(_){ state.derived={ hasMid:false, arbProfitPct:null, mid:null }; } }

    function applyExcelGuard(){
      const ex = getExcelRecord(); if(!ex) return;
      let anyDisabled=false, anyEnabled=false;
      views.forEach(v=>{
        const eng=v.engine, ui=v.ui; if(!eng||!eng.state) return;
        const st=eng.state;
        // Suspend
        if(ex.frozen && st.active){ st.lastDisableReason='excel-suspended'; eng.setActive(false); anyDisabled=true; try { ui.onActiveChanged && ui.onActiveChanged(false, st, { excelSuspended:true }); } catch(_){ } }
        // Resume
        else if(!ex.frozen && !st.active && st.userWanted && st.lastDisableReason==='excel-suspended'){
          if(st.autoResume){ eng.setActive(true); anyEnabled=true; st.lastDisableReason='excel-resumed'; try { ui.onActiveChanged && ui.onActiveChanged(true, st, { excelResumed:true }); } catch(_){ } try { eng.step(); } catch(_){ } }
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
          sendAutoPressF21({});
          // Broadcast OFF so other windows reflect true state
          try { if(global.desktopAPI && global.desktopAPI.send){ global.desktopAPI.send('auto-active-set', { on:false }); } else if(global.require){ const { ipcRenderer } = global.require('electron'); if(ipcRenderer && ipcRenderer.send){ ipcRenderer.send('auto-active-set', { on:false }); } } } catch(_){ }
          // Retry after 500ms if Excel still trading
          setTimeout(()=>{ try { const ex=getExcelRecord(); const stillTrading = !ex || !ex.frozen; if(stillTrading){ sendAutoPressF21({ retry:true }); } } catch(_){ } }, 500);
        }
      } else {
        // Resume if previously disabled due to market and userWanted=true
        views.forEach(v=>{
          const eng=v.engine, ui=v.ui; if(!eng||!eng.state) return; const st=eng.state; if(!st.autoResume) return;
          if(!st.active && st.userWanted && (st.lastDisableReason==='no-mid' || st.lastDisableReason==='arb-spike')){
            eng.setActive(true); st.lastDisableReason='market-resumed'; try { ui.onActiveChanged && ui.onActiveChanged(true, st, { marketResumed:true }); } catch(_){ }
            // Broadcast ON so other windows reflect true state
            try { if(global.desktopAPI && global.desktopAPI.send){ global.desktopAPI.send('auto-active-set', { on:true }); } else if(global.require){ const { ipcRenderer } = global.require('electron'); if(ipcRenderer && ipcRenderer.send){ ipcRenderer.send('auto-active-set', { on:true }); } } } catch(_){ }
            sendAutoPressF21({ resume:true }); setTimeout(()=>{ try { const d2=state.derived; const ok = d2 && d2.hasMid && (!d2.arbProfitPct || d2.arbProfitPct < ARB_SUSPEND_PCT); if(ok && eng.state.active){ sendAutoPressF21({ resume:true, retry:true }); } } catch(_){ } }, 500);
            try { eng.step(); } catch(_){ }
          }
        });
      }
    }

    function onHubUpdate(st){ try { state.records = Object.assign({}, st.records||{}); computeDerived(); applyExcelGuard(); applyMarketGuard(); } catch(_){ } }

    function attachOdds(){ if(!oddsHub) return; oddsHub.subscribe(onHubUpdate); oddsHub.start(); }

    function addBroadcastListeners(){
      try {
        const applyConfigAll = (cfg)=>{ if(!cfg) return; views.forEach(v=>{ try { if(v.engine && v.engine.setConfig) v.engine.setConfig(cfg); } catch(_){ } }); };
        const handleToggle = ()=>{
          let after = null;
          views.forEach(v=>{ try { const eng=v.engine; if(eng){ const next = !eng.state.active; eng.setActive(next); after = next; } } catch(_){ } });
          // Inform other windows about resulting state so late loads sync (and main updates __autoLast)
          try {
            if(after!==null){
              if(global.desktopAPI && global.desktopAPI.send){ global.desktopAPI.send('auto-active-set', { on: after }); }
              else if(global.require){ const { ipcRenderer } = global.require('electron'); if(ipcRenderer && ipcRenderer.send){ ipcRenderer.send('auto-active-set', { on: after }); } }
            }
          } catch(_){ }
        };
        const handleSet = (p)=>{ const want=!!(p&&p.on); views.forEach(v=>{ try { const eng=v.engine; if(eng && want!==eng.state.active){ eng.setActive(want); } } catch(_){ } }); };
        const handleDisable = ()=>{ let changed=false; views.forEach(v=>{ try { const eng=v.engine; if(eng && eng.state.active){ eng.setActive(false); changed=true; } } catch(_){ } });
          // Notify others only if we actually disabled something
          try {
            if(changed){
              if(global.desktopAPI && global.desktopAPI.send){ global.desktopAPI.send('auto-active-set', { on:false }); }
              else if(global.require){ const { ipcRenderer } = global.require('electron'); if(ipcRenderer && ipcRenderer.send){ ipcRenderer.send('auto-active-set', { on:false }); } }
            }
          } catch(_){ }
        };
        const handleActiveSet = (p)=>{ try { const want=!!(p&&p.on); views.forEach(v=>{ try { const eng=v.engine; if(eng && want!==eng.state.active){ eng.setActive(want); if(v.ui && typeof v.ui.onActiveChanged==='function'){ v.ui.onActiveChanged(want, eng.state); } } } catch(_){ } }); } catch(_){ } };
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
        if(global.require){
          const { ipcRenderer } = global.require('electron');
          if(ipcRenderer && typeof ipcRenderer.invoke==='function'){
            Promise.all([
              ipcRenderer.invoke('auto-tolerance-get').catch(()=>null),
              ipcRenderer.invoke('auto-interval-get').catch(()=>null),
              ipcRenderer.invoke('auto-adaptive-get').catch(()=>null),
              ipcRenderer.invoke('auto-burst-levels-get').catch(()=>null),
            ]).then(([tol, interval, adaptive, levels])=>{
              const cfg = {};
              const missing = [];
              if(typeof tol==='number' && !isNaN(tol)) cfg.tolerancePct = tol; else missing.push('Tolerance');
              // Provide safe defaults for missing params so auto can run once Tolerance is set
              cfg.stepMs = (typeof interval==='number' && !isNaN(interval)) ? interval : 500;
              cfg.adaptive = (typeof adaptive==='boolean') ? adaptive : false;
              cfg.burstLevels = (Array.isArray(levels) && levels.length) ? levels : [
                { thresholdPct:15, pulses:4 },
                { thresholdPct:7, pulses:3 },
                { thresholdPct:5, pulses:2 }
              ];
              try { engine.setConfig(cfg); } catch(_){ }
              // If no tolerance configured at all, inform UI and keep auto off
              if(missing.length){
                try { ui && ui.status && ui.status('Set in Settings: '+missing.join(', ')); } catch(_){ }
                try { engine.setActive(false); } catch(_){ }
              }
            }).catch(()=>{});
          }
        }
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
          // Apply to all views uniformly
          views.forEach(v=>{ try {
            const was = !!v.engine.state.active;
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
    addBroadcastListeners();

    return { attachView, getState:()=> ({ records:state.records, derived:state.derived }) };
  }

  global.AutoHub = createAutoHub();
})(window);

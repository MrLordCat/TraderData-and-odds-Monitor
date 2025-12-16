(function(global){
  function defaultPress(payload){
    try {
      if(global.desktopAPI && typeof global.desktopAPI.invoke==='function'){
        return global.desktopAPI.invoke('send-auto-press', payload);
      }
      const { ipcRenderer } = global.require? global.require('electron') : {};
      if(ipcRenderer && ipcRenderer.invoke){ return ipcRenderer.invoke('send-auto-press', payload); }
    } catch(_){ }
  }

  function createAutoEngine(opts){
    const cfg = Object.assign({
      pulseGap: 55,
      confirmBase: 100,
      fireCooldownMs: 900,
      maxAdaptiveWaitMs: 1600,
      // No defaults: will be provided by settings via AutoHub
      initial: { tolerancePct: NaN, stepMs: NaN, adaptive: null, burstLevels: [] },
    }, opts||{});

    const press = cfg.press || defaultPress;
    const parseMid = cfg.parseMid;
    const parseExcel = cfg.parseExcel;
    const flash = cfg.flash || function(){};
    const status = cfg.status || function(){};
    const onActiveChanged = cfg.onActiveChanged || function(){};
    const storage = cfg.storageKeys || {};

    const state = {
      active:false,
      timer:null,
  stepMs: cfg.initial.stepMs,
  tolerancePct: cfg.initial.tolerancePct,
  adaptive: cfg.initial.adaptive,
  burstLevels: Array.isArray(cfg.initial.burstLevels)? cfg.initial.burstLevels.slice(): [],
      lastMidKey:null,
      fireCooldownMs: cfg.fireCooldownMs,
      lastFireTs:0,
      lastFireSide:null,
      lastFireKey:null,
      waitingForExcel:false,
      waitToken:0,
      excelSnapshotKey:null,
      maxAdaptiveWaitMs: cfg.maxAdaptiveWaitMs,
      userWanted:false,
      lastDisableReason:null,
      autoResume:true,
    };

    // Restore persisted flags if keys provided
    try { if(storage.autoResumeKey){ const v = localStorage.getItem(storage.autoResumeKey); if(v==='0') state.autoResume=false; } } catch(_){ }
    try { if(storage.userWantedKey){ const v = localStorage.getItem(storage.userWantedKey); if(v==='1'){ state.userWanted=true; } } } catch(_){ }

    function schedule(delay){ if(!state.active) return; clearTimeout(state.timer); state.timer = setTimeout(step, typeof delay==='number'? delay: state.stepMs); }

    function burstAndConfirm(sideToAdjust, direction, diffPct){
      // Determine key per side/direction
      const keyLabel = (sideToAdjust===0) ? (direction==='raise' ? 'F24' : 'F23') : (direction==='raise' ? 'F23' : 'F24');
      // Cooldown check
      const now = Date.now();
      if(now - state.lastFireTs < state.fireCooldownMs && state.lastFireSide===sideToAdjust && state.lastFireKey===keyLabel){ return; }
      state.lastFireTs = now; state.lastFireSide = sideToAdjust; state.lastFireKey = keyLabel;
      // Pulses based on thresholds
      let pulses = 1;
      try { if(Array.isArray(state.burstLevels)){ for(const lvl of state.burstLevels){ if(diffPct >= lvl.thresholdPct){ pulses = lvl.pulses; break; } } } } catch(_){ }
      // Directional
      for(let i=0;i<pulses;i++){
        const delay = i===0? 0 : cfg.pulseGap*i;
        setTimeout(()=>{ try { press({ side: sideToAdjust, key: keyLabel, direction, diffPct, noConfirm:true }); } catch(_){ } }, delay);
      }
      // Confirm F22
      const confirmDelay = cfg.pulseGap*(pulses-1) + cfg.confirmBase;
      setTimeout(()=>{ try { press({ side: sideToAdjust, key: 'F22', direction, diffPct, noConfirm:true }); } catch(_){ } }, confirmDelay);
    }

    function step(){
      if(!state.active) return;
      const mid = parseMid && parseMid();
      const ex = parseExcel && parseExcel();
      // Require config before operating
      if(!(typeof state.tolerancePct==='number' && !isNaN(state.tolerancePct)) || !(typeof state.stepMs==='number' && !isNaN(state.stepMs)) || typeof state.adaptive!=='boolean' || !Array.isArray(state.burstLevels) || state.burstLevels.length===0){
        status('Set Auto config in Settings');
        return schedule();
      }
      if(!mid || !ex){ status('Нет данных'); return schedule(); }
      const key = mid.join('|');
      if(state.lastMidKey && state.lastMidKey!==key){ status('Mid changed'); }
      state.lastMidKey = key;
      // Min-only alignment
      const sideToAdjust = (mid[0] <= mid[1]) ? 0 : 1;
      const diffPct = Math.abs(ex[sideToAdjust] - mid[sideToAdjust]) / mid[sideToAdjust] * 100;
      if(diffPct <= state.tolerancePct){ status('Aligned (min side)'); return schedule(); }
      const direction = (ex[sideToAdjust] < mid[sideToAdjust]) ? 'raise' : 'lower';
      try { flash(sideToAdjust); } catch(_){ }
      status(`Align ${direction} S${sideToAdjust+1} ${diffPct.toFixed(2)}% (min)`);
      try { burstAndConfirm(sideToAdjust, direction, diffPct); } catch(_){ }
      if(state.adaptive){
        state.waitingForExcel = true;
        state.excelSnapshotKey = (ex[0]+'|'+ex[1]);
        const myToken = ++state.waitToken; const startTs = Date.now();
        const check = ()=>{
          if(!state.active || !state.waitingForExcel || myToken!==state.waitToken) return;
          const cur = parseExcel && parseExcel();
          if(cur){ const kk = cur[0]+'|'+cur[1]; if(kk !== state.excelSnapshotKey){ state.waitingForExcel=false; return schedule(50); } }
          if(Date.now()-startTs >= state.maxAdaptiveWaitMs){ state.waitingForExcel=false; return schedule(); }
          setTimeout(check, 120);
        };
        setTimeout(check, 150);
      } else {
        schedule();
      }
    }

    function setActive(on){
      if(!!on === !!state.active) return;
      state.active = !!on;
      try { onActiveChanged(state.active, state); } catch(_){ }
      try {
        if(storage.userWantedKey){ localStorage.setItem(storage.userWantedKey, state.active? '1':'0'); }
        // Preserve externally supplied disable reasons (e.g., guards from AutoHub).
        // Only mark as manual if no other reason is already set.
        if(!state.active){
          if(!state.lastDisableReason || state.lastDisableReason === 'manual') state.lastDisableReason = 'manual';
        }
      } catch(_){ }
      if(state.active){ step(); } else { clearTimeout(state.timer); state.timer=null; }
    }

    function toggle(){ setActive(!state.active); }

    function setConfig(p){
      if(!p || typeof p!=='object') return;
      if(typeof p.tolerancePct==='number' && !isNaN(p.tolerancePct)) state.tolerancePct = p.tolerancePct;
      if(typeof p.stepMs==='number' && !isNaN(p.stepMs)) state.stepMs = p.stepMs;
      if(typeof p.adaptive==='boolean') state.adaptive = p.adaptive;
      if(Array.isArray(p.burstLevels)) state.burstLevels = p.burstLevels;
    }

    function setAutoResume(on){
      state.autoResume = !!on;
      try { if(storage.autoResumeKey){ localStorage.setItem(storage.autoResumeKey, state.autoResume? '1':'0'); } } catch(_){ }
    }

    return {
      state,
      toggle,
      setActive,
      schedule,
      step,
      setConfig,
      setAutoResume,
    };
  }

  global.AutoCore = { createAutoEngine };
})(window);

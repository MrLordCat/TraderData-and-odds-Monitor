// Unified Auto Trader (board + embedded)
// Replaces auto_trader_board.js and auto_trader_embedded.js.
// AutoHub/AutoCore own the logic; this file wires UI buttons, indicators, and reason tooltips.
(function(){
  if(window.__autoTraderUnifiedLoaded) return;
  window.__autoTraderUnifiedLoaded = true;

  // Toast utility loaded via script tag before this file
  const MiniToast = window.MiniToast;

  function byId(id){ try { return document.getElementById(id); } catch(_){ return null; } }

  const isBoard = !!byId('autoBtn');
  const isEmbedded = !isBoard && !!byId('embeddedAutoBtn');
  if(!isBoard && !isEmbedded) return;

  const mode = isBoard ? 'board' : 'embedded';
  const ids = isBoard ? {
    viewId: 'board',
    autoBtn: 'autoBtn',
    indicatorsRow: 'excelAutoRow',
    statusText: 'autoStatusText',
    dot1Sel: '#excelAutoRow .autoDot.side1',
    dot2Sel: '#excelAutoRow .autoDot.side2',
    autoReason: 'autoReasonBadge',
  } : {
    viewId: 'embedded',
    autoBtn: 'embeddedAutoBtn',
    indicatorsRow: 'embeddedExcelAutoIndicatorsRow',
    statusText: null,
    dot1Sel: '#embeddedExcelAutoIndicatorsRow .autoDot.side1',
    dot2Sel: '#embeddedExcelAutoIndicatorsRow .autoDot.side2',
    autoReason: 'embeddedAutoReason',
  };

  // Heartbeat until first enable (kept; harmless)
  try {
    if(!window.__autoSimHeartbeat){
      window.__autoSimHeartbeat = true;
      let beats = 0;
      const hb = ()=>{ if((window.__autoSim && window.__autoSim.active) || (window.__embeddedAutoSim && window.__embeddedAutoSim.active)) return; if(beats < 6) setTimeout(hb, 4000); ++beats; };
      setTimeout(hb, 3000);
    }
  } catch(_){ }

  let pauseToastTs = 0;
  let pauseSig = '';

  // Use shared toast or inline fallback
  const showMiniToastNear = MiniToast ? MiniToast.showMiniToastNear : function(el, lines, kind){
    try {
      if(!el) return;
      const r = el.getBoundingClientRect();
      const toast = document.createElement('div');
      toast.className = 'miniToast ' + (kind||'');
      (lines||[]).forEach(t=>{
        const line = document.createElement('span');
        line.className = 'line';
        line.textContent = String(t);
        toast.appendChild(line);
      });
      document.body.appendChild(toast);
      const gap = 8;
      const left = Math.min(Math.max(8, r.left), window.innerWidth - 300);
      const top = Math.min(Math.max(8, r.bottom + gap), window.innerHeight - 80);
      toast.style.left = left + 'px';
      toast.style.top = top + 'px';
      requestAnimationFrame(()=> toast.classList.add('show'));
      const ttl = (kind==='err') ? 4200 : 2400;
      setTimeout(()=>{ try { toast.classList.remove('show'); } catch(_){ } }, ttl);
      setTimeout(()=>{ try { if(toast && toast.parentNode) toast.parentNode.removeChild(toast); } catch(_){ } }, ttl + 260);
    } catch(_){ }
  };

  function computeWhyLines(engineState){
    const st = engineState;
    const info = (window.AutoHub && typeof window.AutoHub.getAutoEnableInfo==='function') ? window.AutoHub.getAutoEnableInfo() : null;
    const hubState = (window.AutoHub && typeof window.AutoHub.getState==='function') ? window.AutoHub.getState() : null;
    const derived = hubState && hubState.derived;
    const ex = hubState && hubState.records ? hubState.records['excel'] : null;

    // If auto is currently active and running, skip canEnable check (it's already running)
    const autoIsActive = st && st.active;

    // Global hard blocks (python extractor) - only block if auto is NOT already active
    if(!autoIsActive && info && info.canEnable === false){
      const code = info.reasonCode || 'blocked';
      const err = info.excel && info.excel.error ? String(info.excel.error) : '';
      if(code==='excel-unknown') return { kind:'err', lines:[ 'Auto: BLOCKED', 'Reason: no Excel Extractor status yet', 'Wait 1–2 seconds' ] };
      if(code==='excel-starting') return { kind:'err', lines:[ 'Auto: BLOCKED', 'Reason: Python is starting…', 'Please wait' ] };
      if(code==='excel-installing') return { kind:'err', lines:[ 'Auto: BLOCKED', 'Reason: installing dependencies…', 'Please wait' ] };
      if(code==='excel-off') return { kind:'err', lines:[ 'Auto: BLOCKED', 'Reason: Python Extractor is OFF'+(err?(' ('+err+')'):'') , 'Click S to start' ] };
      if(code==='map-mismatch') return { kind:'err', lines:[ 'Auto: BLOCKED', 'Reason: Map mismatch!', 'Script: '+(info.scriptMap||'?')+' vs Board: '+(info.boardMap||'?') ] };
      return { kind:'err', lines:[ 'Auto: BLOCKED', 'Reason: '+code, 'Click S to start' ] };
    }

    // Paused by guards
    const reason = st && st.lastDisableReason ? String(st.lastDisableReason) : '';
    if(reason && reason !== 'manual'){
      if(reason==='excel-suspended' && ex && ex.frozen){
        return { kind:'err', lines:[ 'Auto: PAUSED', 'Reason: Excel is SUSPENDED (frozen)', 'Unsuspend in Excel' ] };
      }
      if(reason==='no-mid'){
        return { kind:'err', lines:[ 'Auto: PAUSED', 'Reason: no MID', 'Need live broker odds' ] };
      }
      if(reason==='arb-spike'){
        const pct = (derived && typeof derived.arbProfitPct==='number') ? derived.arbProfitPct.toFixed(1)+'%' : '';
        return { kind:'err', lines:[ 'Auto: PAUSED', 'Reason: ARB spike '+pct, 'Guard: waiting' ] };
      }
      if(reason==='shock'){
        return { kind:'err', lines:[ 'Auto: PAUSED', 'Reason: shock (odds jump)', 'Guard: please wait' ] };
      }
      if(reason==='excel-no-change'){
        const attempts = st && st.excelNoChangeCount ? st.excelNoChangeCount : 2;
        return { kind:'err', lines:[ 'Auto: SUSPENDED', 'Reason: Excel odds did not change', 'Failed attempts: '+attempts ] };
      }
      if(/^excel-/.test(reason)){
        return { kind:'err', lines:[ 'Auto: BLOCKED', 'Reason: '+reason, 'Click S to start' ] };
      }
      return { kind:'err', lines:[ 'Auto: PAUSED', 'Reason: '+reason ] };
    }

    // Config missing: auto can turn ON but will not act
    const tolOk = st && (typeof st.tolerancePct==='number') && !isNaN(st.tolerancePct);
    if(!tolOk){
      return { kind:'err', lines:[ 'Auto: NOT CONFIGURED', 'Reason: Tolerance is not set', 'Settings → Auto → Tolerance' ] };
    }

    return { kind:'ok', lines:[ st && st.active ? 'Auto: ON' : 'Auto: OFF' ] };
  }

  function reasonCodeToShortLabel(code){
    if(!code || code === 'manual') return '';
    const map = {
      'excel-unknown': 'WAIT',
      'excel-off': 'SCRIPT',
      'excel-starting': 'START',
      'excel-installing': 'DEPS',
      'excel-suspended': 'SUSP',
      'no-mid': 'MID',
      'arb-spike': 'ARB',
      'shock': 'SHOCK',
      'excel-no-change': 'STUCK',
      'map-mismatch': 'MAP',
      'suspend': 'SUSP',
      'diff': 'DIFF',
    };
    return map[code] || code.replace(/^excel-/,'').toUpperCase().slice(0,6);
  }

  function updateAutoReasonBadge(st, active){
    const reasonBadge = byId(ids.autoReason);
    if(!reasonBadge) return;
    
    if(active){
      // Auto is running - hide reason
      reasonBadge.classList.remove('visible');
      reasonBadge.textContent = '';
      return;
    }
    
    // Auto is off - show last reason if exists
    const reason = st && st.lastDisableReason ? String(st.lastDisableReason) : '';
    if(reason && reason !== 'manual'){
      const label = reasonCodeToShortLabel(reason);
      reasonBadge.textContent = label;
      reasonBadge.title = 'Last stop: ' + reason;
      reasonBadge.classList.add('visible');
    } else {
      reasonBadge.classList.remove('visible');
      reasonBadge.textContent = '';
    }
  }

  // Attach to AutoHub
  if(!window.AutoHub || !window.AutoHub.attachView){ return; }

  const view = window.AutoHub.attachView(ids.viewId, {
    onActiveChanged(active, st){
      try {
        const btn = byId(ids.autoBtn); if(btn) btn.classList.toggle('on', !!active);
        const row = byId(ids.indicatorsRow); if(row) row.style.display = active ? '' : 'none';
        if(ids.statusText && active){ const el = byId(ids.statusText); if(el) el.textContent = ''; }
        if(isBoard){ try { window.refreshAutoButtonsVisual && window.refreshAutoButtonsVisual(); } catch(_){ } }
        
        // Update reason badge
        try { updateAutoReasonBadge(st, active); } catch(_){ }

        // If Auto was requested but got paused by guards, show reason near the button.
        try {
          if(!active && st && st.userWanted && st.lastDisableReason && st.lastDisableReason !== 'manual'){
            const now = Date.now();
            const sig = String(st.lastDisableReason||'');
            if(sig && (sig !== pauseSig) && (now - pauseToastTs) > 1200){
              const aBtn = byId(ids.autoBtn);
              if(aBtn){
                const info = computeWhyLines(st);
                showMiniToastNear(aBtn, info.lines, info.kind);
              }
              pauseSig = sig;
              pauseToastTs = now;
            }
          }
        } catch(_){ }
      } catch(_){ }
    },
    flash(idx){
      try {
        const dot = document.querySelector(idx===0 ? ids.dot1Sel : ids.dot2Sel);
        const ms = (view && view.state && view.state.stepMs) ? view.state.stepMs : 500;
        if(dot){ dot.classList.add('active'); setTimeout(()=>dot.classList.remove('active'), ms - 80); }
      } catch(_){ }
    },
    status(msg){
      try {
        if(!ids.statusText) return;
        const el = byId(ids.statusText);
        if(el) el.textContent = msg || '';
      } catch(_){ }
    },
  });

  const engine = {
    get state(){ return view.state; },
    setActive: view.setActive,
    step: view.step,
    schedule: view.schedule,
  };

  // Expose state globals expected by other scripts
  if(isBoard){
    window.__autoSim = engine.state;
  } else {
    Object.defineProperty(window, 'embeddedAutoSim', { get(){ return engine && engine.state; } });
    Object.defineProperty(window, '__embeddedAutoSim', { get(){ return engine && engine.state; } });
  }

  function toggleAuto(){ try { engine.setActive(!engine.state.active); } catch(_){ } }

  // Click handlers
  document.addEventListener('click', (e)=>{
    try {
      if(e.target && e.target.id === ids.autoBtn){
        const btn = e.target;
        const stBefore = engine && engine.state;
        const wantOn = stBefore ? !stBefore.active : true;
        toggleAuto();
        if(wantOn){
          setTimeout(()=>{
            try {
              const stAfter = engine && engine.state;
              if(stAfter && !stAfter.active){
                const info = computeWhyLines(stAfter);
                showMiniToastNear(btn, info.lines, info.kind);
              }
            } catch(_){ }
          }, 30);
        }
      }
    } catch(_){ }
  });

  // Hover tooltip
  try {
    const btn = byId(ids.autoBtn);
    if(btn && !btn.dataset.autoWhyBound){
      btn.dataset.autoWhyBound = '1';
      btn.addEventListener('mouseenter', ()=>{
        try {
          const st = engine && engine.state;
          // Always show status on hover (not just when inactive)
          const info = computeWhyLines(st);
          if(info && info.lines && info.lines.length) showMiniToastNear(btn, info.lines, info.kind);
        } catch(_){ }
      });
      btn.addEventListener('mouseleave', ()=>{
        try {
          document.querySelectorAll('.miniToast').forEach(t=>t.remove());
        } catch(_){ }
      });
    }
  } catch(_){ }

  // DOM ready sync
  window.addEventListener('DOMContentLoaded', ()=>{
    try {
      if(isBoard){ try { window.refreshAutoButtonsVisual && window.refreshAutoButtonsVisual(); } catch(_){ } }
    } catch(_){ }
  });

  // Export minimal helpers expected by existing code
  if(isBoard){
    window.toggleAuto = toggleAuto;
    window.autoStep = ()=>{ try { engine.step(); } catch(_){ } };
    window.scheduleAuto = (d)=>{ try { engine.schedule(d); } catch(_){ } };
  } else {
    window.embeddedStep = ()=>{ try { engine.step(); } catch(_){ } };
    window.embeddedToggleAuto = toggleAuto;
    window.embeddedSchedule = (d)=>{ try { engine.schedule(d); } catch(_){ } };
  }
})();

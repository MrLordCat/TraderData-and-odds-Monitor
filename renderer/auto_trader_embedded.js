// Extracted Auto Trader (embedded odds panel) – separated from stats_embedded.js for maintainability
// Exposes globals:
//  - embeddedAutoSim (also as window.__embeddedAutoSim)
//  - embeddedStep(), embeddedToggleAuto(), embeddedSchedule()
//  - Parses Mid/Excel from embedded table cells

// minimal startup log removed in production

// Lazy init: attach to AutoHub when available (stats panel loads later)
let __embEngine = null;
let __embAutoPauseToastTs = 0;
let __embAutoPauseSig = '';
function applyEmbeddedUIFromState(){ try {
  const st = __embEngine && __embEngine.state; if(!st) return;
  const autoBtn=document.getElementById('embeddedAutoBtn'); if(autoBtn) autoBtn.classList.toggle('on', !!st.active);
  const indRow=document.getElementById('embeddedExcelAutoIndicatorsRow'); if(indRow) indRow.style.display = st.active? '' : 'none';
  const r=document.getElementById('embeddedAutoResumeBtn'); if(r) r.classList.toggle('on', !!st.autoResume);
} catch(_){ } }
function ensureEmbeddedEngine(){
  if(__embEngine) return __embEngine;
  if(!(window.AutoHub && window.AutoCore)) return null;
  // attach to AutoHub
  const view = window.AutoHub.attachView('embedded',{
    onActiveChanged(active, st){
      const btn=document.getElementById('embeddedAutoBtn'); if(btn) btn.classList.toggle('on', !!active);
      const indRow=document.getElementById('embeddedExcelAutoIndicatorsRow'); if(indRow) indRow.style.display=active? '' : 'none';
      // If Auto was requested but got paused by guards, show reason near the button.
      try {
        if(!active && st && st.userWanted && st.lastDisableReason && st.lastDisableReason!=='manual'){
          const now = Date.now();
          const sig = String(st.lastDisableReason||'');
          if(sig && (sig !== __embAutoPauseSig) && (now - __embAutoPauseToastTs) > 1200){
            const aBtn = document.getElementById('embeddedAutoBtn');
            if(aBtn){
              const info = __embAutoWhyLines();
              __embShowMiniToastNear(aBtn, info.lines, info.kind);
            }
            __embAutoPauseSig = sig;
            __embAutoPauseToastTs = now;
          }
        }
      } catch(_){ }
    },
    flash(idx){ const dot=document.querySelector('#embeddedExcelAutoIndicatorsRow .autoDot.'+(idx===0?'side1':'side2')); if(dot){ const ms = (view?.state?.stepMs)||500; dot.classList.add('active'); setTimeout(()=>dot.classList.remove('active'), ms-80); } },
    status(_msg){ /* silent */ },
  onAutoResumeChanged(on){ try { const r=document.getElementById('embeddedAutoResumeBtn'); if(r) r.classList.toggle('on', !!on); } catch(_){ } },
  });
  __embEngine = {
    state: view.state,
    setConfig: view.setConfig,
    setActive: view.setActive,
    setAutoResume: view.setAutoResume,
    step: view.step,
    schedule: view.schedule,
  };
  // Immediately sync UI to current state (including propagation from other views)
  applyEmbeddedUIFromState();
  // silent
  return __embEngine;
}

// Expose engine state (dynamic getter via property to reflect late init)
Object.defineProperty(window, 'embeddedAutoSim', { get(){ return __embEngine && __embEngine.state; } });
Object.defineProperty(window, '__embeddedAutoSim', { get(){ return __embEngine && __embEngine.state; } });

// legacy parse helpers removed (data comes from AutoHub)
function embeddedStatus(_msg){ /* status text removed (only dots retained) */ }
function embeddedFlash(idx){ const dot=document.querySelector('#embeddedExcelAutoIndicatorsRow .autoDot.'+(idx===0?'side1':'side2')); if(dot){ const ms = (__embEngine?.state?.stepMs)||500; dot.classList.add('active'); setTimeout(()=>dot.classList.remove('active'), ms-80); } }
function embeddedSchedule(delay){ const eng=ensureEmbeddedEngine(); eng && eng.schedule(delay); }
function embeddedStep(){ const eng=ensureEmbeddedEngine(); eng && eng.step(); }
function embeddedToggleAuto(){ const eng=ensureEmbeddedEngine(); if(!eng) return; eng.setActive(!eng.state.active); }

// Mini tooltip near embedded Auto button (reason why auto can't start / is paused)
let __embAutoWhyToastEl = null;
function __embShowMiniToastNear(el, lines, kind){
  try { if(__embAutoWhyToastEl && __embAutoWhyToastEl.parentNode) __embAutoWhyToastEl.parentNode.removeChild(__embAutoWhyToastEl); } catch(_){ }
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
    __embAutoWhyToastEl = toast;
    const ttl = (kind==='err') ? 4200 : 2400;
    setTimeout(()=>{ try { toast.classList.remove('show'); } catch(_){ } }, ttl);
    setTimeout(()=>{ try { if(toast && toast.parentNode) toast.parentNode.removeChild(toast); } catch(_){ } }, ttl + 260);
  } catch(_){ }
}

function __embAutoWhyLines(){
  const st = __embEngine && __embEngine.state;
  const info = (window.AutoHub && typeof window.AutoHub.getAutoEnableInfo==='function') ? window.AutoHub.getAutoEnableInfo() : null;
  const hubState = (window.AutoHub && typeof window.AutoHub.getState==='function') ? window.AutoHub.getState() : null;
  const derived = hubState && hubState.derived;
  const ex = hubState && hubState.records ? hubState.records['excel'] : null;

  if(info && info.canEnable === false){
    const code = info.reasonCode || 'blocked';
    const err = info.excel && info.excel.error ? String(info.excel.error) : '';
    if(code==='excel-unknown') return { kind:'err', lines:[ 'Auto: BLOCKED', 'Reason: no Excel Extractor status yet', 'Wait 1–2 seconds' ] };
    if(code==='excel-starting') return { kind:'err', lines:[ 'Auto: BLOCKED', 'Reason: Python is starting…', 'Please wait' ] };
    if(code==='excel-installing') return { kind:'err', lines:[ 'Auto: BLOCKED', 'Reason: installing dependencies…', 'Please wait' ] };
    if(code==='excel-off') return { kind:'err', lines:[ 'Auto: BLOCKED', 'Reason: Python Extractor is OFF'+(err?(' ('+err+')'):'') , 'Click S to start' ] };
    return { kind:'err', lines:[ 'Auto: BLOCKED', 'Reason: '+code, 'Click S to start' ] };
  }

  const reason = st && st.lastDisableReason ? String(st.lastDisableReason) : '';
  if(reason && reason !== 'manual'){
    if(reason==='excel-suspended' && ex && ex.frozen){
      return { kind:'err', lines:[ 'Auto: PAUSED', 'Reason: Excel is SUSPENDED (frozen)', 'Unsuspend in Excel' ] };
    }
    if(reason==='no-mid') return { kind:'err', lines:[ 'Auto: PAUSED', 'Reason: no MID', 'Need broker odds' ] };
    if(reason==='arb-spike'){
      const pct = (derived && typeof derived.arbProfitPct==='number') ? derived.arbProfitPct.toFixed(1)+'%' : '';
      return { kind:'err', lines:[ 'Auto: PAUSED', 'Reason: ARB spike '+pct, 'Guard: waiting' ] };
    }
    if(reason==='shock') return { kind:'err', lines:[ 'Auto: PAUSED', 'Reason: shock (odds jump)', 'Guard: please wait' ] };
    if(/^excel-/.test(reason)) return { kind:'err', lines:[ 'Auto: BLOCKED', 'Reason: '+reason, 'Click S to start' ] };
    return { kind:'err', lines:[ 'Auto: PAUSED', 'Reason: '+reason ] };
  }

  const tolOk = st && (typeof st.tolerancePct==='number') && !isNaN(st.tolerancePct);
  if(!tolOk) return { kind:'err', lines:[ 'Auto: NOT CONFIGURED', 'Reason: Tolerance is not set', 'Settings → Auto → Tolerance' ] };

  return { kind:'ok', lines:[ st && st.active ? 'Auto: ON' : 'Auto: OFF' ] };
}

// Click handlers
document.addEventListener('click', e=>{ if(e.target && e.target.id==='embeddedAutoBtn'){
  const btn = e.target;
  const stBefore = __embEngine && __embEngine.state;
  const wantOn = stBefore ? !stBefore.active : true;
  embeddedToggleAuto();
  if(wantOn){
    setTimeout(()=>{
      try {
        const stAfter = __embEngine && __embEngine.state;
        if(stAfter && !stAfter.active){
          const info = __embAutoWhyLines();
          __embShowMiniToastNear(btn, info.lines, info.kind);
        }
      } catch(_){ }
    }, 30);
  }
}});
document.addEventListener('click', e=>{ if(e.target && e.target.id==='embeddedAutoResumeBtn'){ try {
  const eng=ensureEmbeddedEngine(); const want = !(eng?.state?.autoResume);
  if(eng){ eng.setAutoResume(want); }
  // visual state will be synced via onAutoResumeChanged; keep toggle for immediate feedback
  e.target.classList.toggle('on', !!want);
  // visual state reflected via onAutoResumeChanged
} catch(_){ } }});
window.addEventListener('DOMContentLoaded', ()=>{ try { ensureEmbeddedEngine(); applyEmbeddedUIFromState(); } catch(_){ } });

// Hover tooltip: show current reason near embedded Auto button
try {
  const btn = document.getElementById('embeddedAutoBtn');
  if(btn && !btn.dataset.autoWhyBound){
    btn.dataset.autoWhyBound = '1';
    btn.addEventListener('mouseenter', ()=>{
      try {
        const st = __embEngine && __embEngine.state;
        if(!st || st.active) return;
        const info = __embAutoWhyLines();
        if(info && info.lines && info.lines.length){ __embShowMiniToastNear(btn, info.lines, info.kind); }
      } catch(_){ }
    });
  }
} catch(_){ }

// Live update tolerance / interval / adaptive / burst levels, and Auto Resume sync
try {
  const { ipcRenderer } = window.require? window.require('electron'): {};
  if(ipcRenderer && !window.__embeddedAutoCfgBound){
    window.__embeddedAutoCfgBound = true;
    ipcRenderer.on('auto-resume-set', (_e,p)=>{ try { const want=!!(p&&p.on); const r=document.getElementById('embeddedAutoResumeBtn'); if(r) r.classList.toggle('on', want); } catch(_){ } });
    ipcRenderer.on('auto-active-set', (_e,p)=>{ try {
      const want = !!(p && p.on);
      const btn=document.getElementById('embeddedAutoBtn'); if(btn) btn.classList.toggle('on', want);
      const indRow=document.getElementById('embeddedExcelAutoIndicatorsRow'); if(indRow) indRow.style.display = want? '' : 'none';
      // silent
    } catch(_){ } });
    // Flash indicators on actual auto press events (manual or engine-driven)
    ipcRenderer.on('auto-press', (_e, payload)=>{ try {
      if(!payload || typeof payload.side==='undefined') return;
      const side = payload.side===1?1:0;
      embeddedFlash(side);
      // silent
    } catch(_){ } });
  ipcRenderer.on('auto-tolerance-updated', (_e,v)=>{ if(typeof v==='number' && !isNaN(v)){ __embEngine && __embEngine.setConfig({ tolerancePct:v }); const st=window.__embeddedAutoSim; if(st && st.active){ embeddedStatus(`Tol ${st.tolerancePct.toFixed(2)}%`); } } });
  ipcRenderer.on('auto-interval-updated', (_e,v)=>{ if(typeof v==='number' && !isNaN(v)){ __embEngine && __embEngine.setConfig({ stepMs:v }); } });
  ipcRenderer.on('auto-adaptive-updated', (_e,v)=>{ if(typeof v==='boolean'){ __embEngine && __embEngine.setConfig({ adaptive:v }); } });
  ipcRenderer.on('auto-burst-levels-updated', (_e,levels)=>{ if(Array.isArray(levels)){ __embEngine && __embEngine.setConfig({ burstLevels:levels }); } });
  }
} catch(_){ }

// Export
// Note: embeddedAutoSim is exposed via getters above; no direct assignment to avoid ReferenceError before init
window.embeddedStep = embeddedStep;
window.embeddedToggleAuto = embeddedToggleAuto;
window.embeddedSchedule = embeddedSchedule;

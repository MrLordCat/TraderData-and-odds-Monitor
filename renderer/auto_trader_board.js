// Extracted Auto Trader (board) – separated from board.js for maintainability
// This file defines autoSim, autoStep, scheduleAuto, toggleAuto and related handlers.
// It expects the following to exist (provided by board.js):
// - window.desktopAPI (or electron ipcRenderer fallback)
// - refreshAutoButtonsVisual() for updating Auto/R UI
// - DOM elements: autoBtn, autoResumeBtn, excelAutoRow, dots
// - Utility: console is available; localStorage is available

// startup log removed

// Heartbeat до первого включения, чтобы убедиться что лог трансляции работает
try {
  if(!window.__autoSimHeartbeat){
    window.__autoSimHeartbeat = true;
    let beats=0;
  const hb = ()=>{ if(window.__autoSim && window.__autoSim.active) return; if(beats<6) setTimeout(hb, 4000); ++beats; };
    setTimeout(hb, 3000);
  }
} catch(_){ }

// Connect to centralized AutoHub
let __autoPauseToastTs = 0;
let __autoPauseSig = '';
const __autoEngine = (function(){
  if(!window.AutoHub) return null;
  const view = window.AutoHub.attachView('board',{
    onActiveChanged(active, st){
      const btn=document.getElementById('autoBtn'); if(btn) btn.classList.toggle('on', !!active);
      const row=document.getElementById('excelAutoRow'); if(row) row.style.display=active? '' : 'none';
      // Clear stale status text on toggle; next step will write fresh status
      try { const el=document.getElementById('autoStatusText'); if(el && active){ el.textContent=''; } } catch(_){ }
      try { refreshAutoButtonsVisual && refreshAutoButtonsVisual(); } catch(_){ }

      // If Auto was requested but got paused by guards, show reason near the button.
      try {
        if(!active && st && st.userWanted && st.lastDisableReason && st.lastDisableReason!=='manual'){
          const now = Date.now();
          const sig = String(st.lastDisableReason||'');
          if(sig && (sig !== __autoPauseSig) && (now - __autoPauseToastTs) > 1200){
            const aBtn = document.getElementById('autoBtn');
            if(aBtn){
              const info = __autoWhyLines();
              __showMiniToastNear(aBtn, info.lines, info.kind);
            }
            __autoPauseSig = sig;
            __autoPauseToastTs = now;
          }
        }
      } catch(_){ }
    },
    flash(idx){ const dot=document.querySelector('.autoDot.'+(idx===0?'side1':'side2')); if(dot){ const ms = (view?.state?.stepMs)||500; dot.classList.add('active'); setTimeout(()=>dot.classList.remove('active'), ms-80); } },
    status(msg){ try { const el=document.getElementById('autoStatusText'); if(el){ el.textContent = msg||''; } } catch(_){ } },
    onAutoResumeChanged(on){ try { const r=document.getElementById('autoResumeBtn'); if(r) r.classList.toggle('on', !!on); } catch(_){ } },
  });
  return {
    state: view.state,
    setConfig: view.setConfig,
    setActive: view.setActive,
    setAutoResume: view.setAutoResume,
    step: view.step,
    schedule: view.schedule,
  };
})();

function parsePairRow(id){
  const row=document.getElementById(id); if(!row) return null;
  const cell=row.children[1]; if(!cell) return null; const txt=(cell.textContent||'').trim();
  if(!/\d/.test(txt)) return null; const parts=txt.split('/').map(s=>parseFloat(s.trim())).filter(n=>!isNaN(n));
  return parts.length===2?parts:null;
}
function parseMid(){ return parsePairRow('midRow'); }
function parseExcel(){ return parsePairRow('excelRow'); }
function setExcelOdds(_n1,_n2){ /* retained for future real integration but unused by auto simulation */ }
function autoStatus(_msg){ /* status text removed (only indicator dots shown) */ }

function toggleAuto(){ if(!__autoEngine) return; __autoEngine.setActive(!__autoEngine.state.active); }

// Mini tooltip near Auto button (reason why auto can't start / is paused)
let __autoWhyToastEl = null;
function __showMiniToastNear(el, lines, kind){
  try { if(__autoWhyToastEl && __autoWhyToastEl.parentNode) __autoWhyToastEl.parentNode.removeChild(__autoWhyToastEl); } catch(_){ }
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
    __autoWhyToastEl = toast;
    const ttl = (kind==='err') ? 4200 : 2400;
    setTimeout(()=>{ try { toast.classList.remove('show'); } catch(_){ } }, ttl);
    setTimeout(()=>{ try { if(toast && toast.parentNode) toast.parentNode.removeChild(toast); } catch(_){ } }, ttl + 260);
  } catch(_){ }
}

function __autoWhyLines(){
  const st = __autoEngine && __autoEngine.state;
  const info = (window.AutoHub && typeof window.AutoHub.getAutoEnableInfo==='function') ? window.AutoHub.getAutoEnableInfo() : null;
  const hubState = (window.AutoHub && typeof window.AutoHub.getState==='function') ? window.AutoHub.getState() : null;
  const derived = hubState && hubState.derived;
  const ex = hubState && hubState.records ? hubState.records['excel'] : null;

  // Global hard blocks (python extractor)
  if(info && info.canEnable === false){
    const code = info.reasonCode || 'blocked';
    const err = info.excel && info.excel.error ? String(info.excel.error) : '';
    if(code==='excel-unknown') return { kind:'err', lines:[ 'Auto: BLOCKED', 'Reason: no Excel Extractor status yet', 'Wait 1–2 seconds' ] };
    if(code==='excel-starting') return { kind:'err', lines:[ 'Auto: BLOCKED', 'Reason: Python is starting…', 'Please wait' ] };
    if(code==='excel-installing') return { kind:'err', lines:[ 'Auto: BLOCKED', 'Reason: installing dependencies…', 'Please wait' ] };
    if(code==='excel-off') return { kind:'err', lines:[ 'Auto: BLOCKED', 'Reason: Python Extractor is OFF'+(err?(' ('+err+')'):'') , 'Click S to start' ] };
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
      return { kind:'err', lines:[ 'Auto: PAUSED', 'Reason: ARB spike '+pct, 'Guard: waiting to normalize' ] };
    }
    if(reason==='shock'){
      return { kind:'err', lines:[ 'Auto: PAUSED', 'Reason: shock (odds jump)', 'Guard: please wait' ] };
    }
    if(/^excel-/.test(reason)){
      return { kind:'err', lines:[ 'Auto: BLOCKED', 'Reason: '+reason, 'Click S to start' ] };
    }
    return { kind:'err', lines:[ 'Auto: PAUSED', 'Reason: '+reason ] };
  }

  // Config missing: auto can turn ON but will not act (useful explanation)
  const tolOk = st && (typeof st.tolerancePct==='number') && !isNaN(st.tolerancePct);
  if(!tolOk){
    return { kind:'err', lines:[ 'Auto: NOT CONFIGURED', 'Reason: Tolerance is not set', 'Settings → Auto → Tolerance' ] };
  }

  // Fallback
  return { kind:'ok', lines:[ st && st.active ? 'Auto: ON' : 'Auto: OFF' ] };
}

// Click handlers for Auto / Resume / Script
document.addEventListener('click', e=>{
  if(e.target && e.target.id==='autoBtn'){
    const btn = e.target;
    const stBefore = __autoEngine && __autoEngine.state;
    const wantOn = stBefore ? !stBefore.active : true;
    toggleAuto();
    if(wantOn){
      setTimeout(()=>{
        try {
          const stAfter = __autoEngine && __autoEngine.state;
          if(stAfter && !stAfter.active){
            const info = __autoWhyLines();
            __showMiniToastNear(btn, info.lines, info.kind);
          }
        } catch(_){ }
      }, 30);
    }
  }
  if(e.target && e.target.id==='autoResumeBtn'){
    const want = !(__autoEngine?.state?.autoResume);
    if(__autoEngine){ __autoEngine.setAutoResume(want); }
    e.target.classList.toggle('on', !!want);
  // visual sync via onAutoResumeChanged
    try { refreshAutoButtonsVisual && refreshAutoButtonsVisual(); } catch(_){ }
  }
});

// Hover tooltip: show current reason near Auto button
try {
  const btn = document.getElementById('autoBtn');
  if(btn && !btn.dataset.autoWhyBound){
    btn.dataset.autoWhyBound = '1';
    btn.addEventListener('mouseenter', ()=>{
      try {
        const st = __autoEngine && __autoEngine.state;
        if(!st || st.active) return;
        const info = __autoWhyLines();
        if(info && info.lines && info.lines.length){ __showMiniToastNear(btn, info.lines, info.kind); }
      } catch(_){ }
    });
  }
} catch(_){ }

window.addEventListener('DOMContentLoaded', ()=>{ try { const b=document.getElementById('autoResumeBtn'); if(b) b.classList.toggle('on', (__autoEngine?.state?.autoResume)); } catch(_){ } });
window.addEventListener('DOMContentLoaded', ()=>{ try { refreshAutoButtonsVisual(); } catch(_){ } });

window.__autoSim = __autoEngine ? __autoEngine.state : null;

// Global broadcasts handled centrally by AutoHub; no adapter-level listeners to avoid double toggles

// Live update tolerance / interval / adaptive / burst levels
try {
  const subscribe = ()=>{
    if(window.desktopAPI && window.desktopAPI.send){ /* marker that bridge exists */ }
    try {
      const { ipcRenderer } = require ? require('electron') : {};
      if(ipcRenderer && !subscribe.__attached){
        subscribe.__attached=true;
        ipcRenderer.on('auto-tolerance-updated', (_e, v)=>{ if(typeof v==='number' && !isNaN(v)){ if(__autoEngine){ __autoEngine.setConfig({ tolerancePct:v }); if(__autoEngine.state.active){ __autoEngine.step(); } } } });
        ipcRenderer.on('auto-interval-updated', (_e, v)=>{ if(typeof v==='number' && !isNaN(v)){ if(__autoEngine){ __autoEngine.setConfig({ stepMs:v }); if(__autoEngine.state.active){ __autoEngine.step(); } } } });
        ipcRenderer.on('auto-adaptive-updated', (_e, v)=>{ if(typeof v==='boolean'){ if(__autoEngine){ __autoEngine.setConfig({ adaptive:v }); if(__autoEngine.state.active){ __autoEngine.step(); } } } });
        ipcRenderer.on('auto-burst-levels-updated', (_e, levels)=>{ if(Array.isArray(levels)){ if(__autoEngine){ __autoEngine.setConfig({ burstLevels:levels }); if(__autoEngine.state.active){ __autoEngine.step(); } } } });
      }
    } catch(_){ }
  };
  subscribe();
} catch(_){ }

// Adapter deliberately avoids listening to disable broadcasts: AutoHub applies them to the engine
// But we mirror cross-window Auto Resume (R) to keep the button in sync when toggled from other views
try {
  const { ipcRenderer } = window.require? window.require('electron'): {};
  if(ipcRenderer && !window.__boardAutoResumeBound){
    window.__boardAutoResumeBound = true;
    ipcRenderer.on('auto-resume-set', (_e, p)=>{ try {
      const want = !!(p && p.on);
      const btn=document.getElementById('autoResumeBtn'); if(btn) btn.classList.toggle('on', want);
    } catch(_){ } });
    ipcRenderer.on('auto-active-set', (_e, p)=>{ try {
      const want = !!(p && p.on);
      const btn=document.getElementById('autoBtn'); if(btn) btn.classList.toggle('on', want);
      const row=document.getElementById('excelAutoRow'); if(row) row.style.display = want? '' : 'none';
    } catch(_){ } });
  }
} catch(_){ }

// Local keydown fallback removed to prevent conflicts; main hotkeys broadcast via AutoHub

// External manual auto press (gamepad/AHK) – flash dot only
try {
  const { ipcRenderer } = window.require? window.require('electron'): {};
  if(ipcRenderer){
    ipcRenderer.on('auto-press', (_e, payload)=>{
      try {
        if(!payload || typeof payload.side==='undefined') return;
        const side = payload.side===1?1:0;
        flashDot(side);
        if(!(__autoEngine && __autoEngine.state.active)){ autoStatus('Manual '+ (side===0?'S1':'S2')); }
      } catch(_){ }
    });
  }
} catch(_){ }

// Export minimal helpers to global (board.js expects these names)
window.toggleAuto = toggleAuto;
window.autoStep = ()=>{ __autoEngine && __autoEngine.step(); };
window.scheduleAuto = (d)=>{ __autoEngine && __autoEngine.schedule(d); };

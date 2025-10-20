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
const __autoEngine = (function(){
  if(!window.AutoHub) return null;
  const view = window.AutoHub.attachView('board',{
    onActiveChanged(active, st){
      const btn=document.getElementById('autoBtn'); if(btn) btn.classList.toggle('on', !!active);
      const row=document.getElementById('excelAutoRow'); if(row) row.style.display=active? '' : 'none';
      // Clear stale status text on toggle; next step will write fresh status
      try { const el=document.getElementById('autoStatusText'); if(el && active){ el.textContent=''; } } catch(_){ }
      try { refreshAutoButtonsVisual && refreshAutoButtonsVisual(); } catch(_){ }
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

// Click handlers for Auto / Resume / Script
document.addEventListener('click', e=>{
  if(e.target && e.target.id==='autoBtn'){ toggleAuto(); }
  if(e.target && e.target.id==='autoResumeBtn'){
    const want = !(__autoEngine?.state?.autoResume);
    if(__autoEngine){ __autoEngine.setAutoResume(want); }
    e.target.classList.toggle('on', !!want);
  // visual sync via onAutoResumeChanged
    try { refreshAutoButtonsVisual && refreshAutoButtonsVisual(); } catch(_){ }
  }
});

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

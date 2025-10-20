// Extracted Auto Trader (embedded odds panel) – separated from stats_embedded.js for maintainability
// Exposes globals:
//  - embeddedAutoSim (also as window.__embeddedAutoSim)
//  - embeddedStep(), embeddedToggleAuto(), embeddedSchedule()
//  - Parses Mid/Excel from embedded table cells

// minimal startup log removed in production

// Lazy init: attach to AutoHub when available (stats panel loads later)
let __embEngine = null;
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
  // silent
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

// Click handlers
document.addEventListener('click', e=>{ if(e.target && e.target.id==='embeddedAutoBtn'){ embeddedToggleAuto(); }});
document.addEventListener('click', e=>{ if(e.target && e.target.id==='embeddedAutoResumeBtn'){ try {
  const eng=ensureEmbeddedEngine(); const want = !(eng?.state?.autoResume);
  if(eng){ eng.setAutoResume(want); }
  // visual state will be synced via onAutoResumeChanged; keep toggle for immediate feedback
  e.target.classList.toggle('on', !!want);
  // visual state reflected via onAutoResumeChanged
} catch(_){ } }});
window.addEventListener('DOMContentLoaded', ()=>{ try { ensureEmbeddedEngine(); applyEmbeddedUIFromState(); } catch(_){ } });

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

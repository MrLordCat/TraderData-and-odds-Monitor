// Modular activity heat bar for LoL stats panel
// Exports: init(), onMetricUpdate(teamIndex), recalc(), configure(opts)
// 
// Decay uses quadratic ease-out: bars decay faster when full, much slower near zero
// At level=1.0: 100% decay speed, level=0.5: 36%, level→0: 15% (85% max slowdown)
// This makes small activity bumps significantly more visible

const ACTIVITY_NS = '__statsActivity';

const state = {
  enabled: true,
  levels: [0,0], // team1, team2
  lastTs: performance.now(),
  decayPerSec: 0.18,   // fraction per second removed
  bumpAmount: 0.22,    // added per triggering event
  minVisible: 0.01,
  rafId: null,
  els: [],
  layer: null,
  table: null,
  wrap: null,
  pendingRecalc: false,
  attachObserver: null,
  initialized: false
};

function configure(opts={}){
  if(opts.enabled!=null) state.enabled = !!opts.enabled;
  if(typeof opts.decayPerSec === 'number' && opts.decayPerSec>0) state.decayPerSec = opts.decayPerSec;
  if(typeof opts.bumpAmount === 'number' && opts.bumpAmount>0) state.bumpAmount = opts.bumpAmount;
  
  // Log heat bar settings for debugging
  const fadeTimeSec = state.decayPerSec > 0 ? (1 / state.decayPerSec).toFixed(1) : 'Infinity';
  console.log(`[heat-bar] configure: decayPerSec=${state.decayPerSec.toFixed(3)}, fadeTime=${fadeTimeSec}s (UI setting), bumpAmount=${state.bumpAmount}, enabled=${state.enabled}`);
  
  // If decay speed changed, reset timestamp so effect is immediate & no big jump
  state.lastTs = performance.now();
  // If disabled -> stop loop & clear bars
  if(!state.enabled){
    try { if(state.rafId){ cancelAnimationFrame(state.rafId); state.rafId=null; } } catch(_){ }
    for(let i=0;i<2;i++){ state.levels[i]=0; const el=state.els[i]; if(el){ el.style.transform='translateZ(0) scaleY(0)'; el.style.opacity='0'; el.classList.remove('boostGlow','fadingLow'); } }
  } else {
    // If still enabled ensure loop running so new decay applies instantly
    if(!state.rafId && (state.levels[0]>0 || state.levels[1]>0)) startLoop();
  }
}

function ensureDom(){
  if(state.layer) return;
  state.wrap = document.querySelector('.lolTableWrap');
  state.table = document.getElementById('lolTable');
  if(!state.wrap || !state.table) return;
  const layer = document.createElement('div');
  layer.className = 'teamActivityLayer';
  const a1 = document.createElement('div'); a1.className='teamActivity team1';
  const a2 = document.createElement('div'); a2.className='teamActivity team2';
  layer.appendChild(a1); layer.appendChild(a2);
  state.wrap.appendChild(layer);
  state.layer = layer; state.els=[a1,a2];
  recalc();
  // Fallback delayed recalc (sometimes initial layout shifts after fonts load)
  setTimeout(()=> recalc(), 120);
  setTimeout(()=> recalc(), 500);
  try {
    state.attachObserver = new MutationObserver(()=> scheduleRecalc());
    state.attachObserver.observe(state.table.tBodies[0], { childList:true });
  } catch(_){ }
  window.addEventListener('resize', ()=> scheduleRecalc());
  try { state.wrap.addEventListener('scroll', ()=> scheduleRecalc(), { passive:true }); } catch(_){ }
  // Observe structural/size changes to re-anchor precisely
  try {
    const ro = new ResizeObserver(()=> scheduleRecalc());
    ro.observe(state.table);
    const th1=document.getElementById('lt-team1'); const th2=document.getElementById('lt-team2');
    if(th1) ro.observe(th1); if(th2) ro.observe(th2);
    state.resizeObserver = ro;
  } catch(_){ }
  // Listen for external layout change notifications (e.g., after collapse expand)
  window.addEventListener('lol-table-layout-changed', ()=> scheduleRecalc());
}

function scheduleRecalc(){
  if(state.pendingRecalc) return; state.pendingRecalc = true; setTimeout(()=>{ state.pendingRecalc=false; recalc(); }, 35);
}

function recalc(){
  if(!state.layer || !state.table) return;
  try {
    const th1 = document.getElementById('lt-team1');
    const th2 = document.getElementById('lt-team2');
    if(!th1 || !th2) return;
    const tableRect = state.table.getBoundingClientRect();
    const r1 = th1.getBoundingClientRect();
    const r2 = th2.getBoundingClientRect();
    const scrollX = state.wrap ? state.wrap.scrollLeft : 0;
    const pad = 0.5;
    const height = (state.wrap ? state.wrap.clientHeight : tableRect.height) - 2;
    const left1 = (r1.left - tableRect.left) + scrollX + pad;
    const left2 = (r2.left - tableRect.left) + scrollX + pad;
    const e1=state.els[0]; const e2=state.els[1];
    if(e1){ e1.style.left=left1+'px'; e1.style.width=(r1.width-pad*2)+'px'; e1.style.height=height+'px'; }
    if(e2){ e2.style.left=left2+'px'; e2.style.width=(r2.width-pad*2)+'px'; e2.style.height=height+'px'; }
  } catch(err){ }
}
// Track horizontal scroll to keep bars aligned if table scrolls (listener added after ensureDom)

function bump(teamIdx){
  if(!state.enabled) return;
  const i = teamIdx-1; if(i<0||i>1) return;
  ensureDom();
  if(!state.layer){ console.warn('[activity] bump before layer; retry soon'); setTimeout(()=>{ ensureDom(); if(state.layer) bump(teamIdx); }, 80); return; }
  state.levels[i] = Math.min(1, state.levels[i] + state.bumpAmount);
  const el = state.els[i];
  if(el){
    if(state.levels[i] > 0.75) el.classList.add('boostGlow'); else el.classList.remove('boostGlow');
  }
  startLoop();
}

function loop(){
  const now = performance.now();
  const dt = (now - state.lastTs)/1000;
  state.lastTs = now;
  let any = false;
  for(let i=0;i<2;i++){
    const prev = state.levels[i];
    if(prev>0){
      // Ease-out decay with quadratic curve: much slower as level approaches 0
      // At level=1.0: 100% speed, at level=0.5: 36%, at level→0: 15% (85% slower)
      const easeMultiplier = 0.15 + 0.85 * prev * prev;
      const decayed = prev - state.decayPerSec * easeMultiplier * dt;
      // Debug log every ~1 second
      if(Math.random() < 0.02) console.log(`[heat-bar] level=${prev.toFixed(2)}, ease=${easeMultiplier.toFixed(2)}, decay=${(state.decayPerSec * easeMultiplier).toFixed(3)}/s`);
      state.levels[i] = decayed>state.minVisible? decayed : 0;
      if(state.levels[i]>0) any = true;
      const el = state.els[i];
      if(el){
        const lvl = state.levels[i];
        el.style.transform = `translateZ(0) scaleY(${lvl.toFixed(4)})`;
  // Opacity base curve scaled by global heatbar alpha variable (default 1 if missing)
  const alphaVar = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gs-heatbar-alpha'));
  const alphaMul = isFinite(alphaVar)? alphaVar : 1;
  el.style.opacity = Math.min(1, (0.35 + 0.65*lvl) * alphaMul).toFixed(3);
        if(lvl < 0.2) el.classList.add('fadingLow'); else el.classList.remove('fadingLow');
      }
    }
  }
  if(any){
    state.rafId = requestAnimationFrame(loop);
  } else {
    for(let i=0;i<2;i++){
      const el = state.els[i]; if(el && state.levels[i]===0){ el.style.transform='translateZ(0) scaleY(0)'; el.classList.remove('boostGlow'); }
    }
    state.rafId = null;
  }
}

function startLoop(){ if(!state.rafId) { state.lastTs = performance.now(); state.rafId = requestAnimationFrame(loop); } }

function onMetricUpdate(teamIndex){ bump(teamIndex); }

function init(){ if(state.initialized) return; state.initialized=true; ensureDom(); setTimeout(()=> recalc(), 120); setTimeout(()=> recalc(), 600); }

module.exports = { init, onMetricUpdate, recalc, configure };
try { window[ACTIVITY_NS] = module.exports; } catch(_){ }

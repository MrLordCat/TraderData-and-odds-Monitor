function computeStage(){
  const bar=document.getElementById('toolbar');
  if(!bar) return;
  const rect=bar.getBoundingClientRect();
  const top=rect.bottom;
  const h=window.innerHeight-top;
  const outline=document.getElementById('stageOutline');
  if(outline){ outline.style.top=top+'px'; outline.style.height=h+'px'; }
  window.desktopAPI.setStageBounds({x:0,y:Math.round(top),width:window.innerWidth,height:Math.round(h)});
}
// Debounced resize to avoid flooding IPC
let __stageRaf=null; let __lastStageReq=0; const __STAGE_INTERVAL=60; // ms
function queueStage(){
  const now=Date.now();
  if(now-__lastStageReq<__STAGE_INTERVAL){
    if(!__stageRaf){ __stageRaf=requestAnimationFrame(()=>{ __stageRaf=null; computeStage(); }); }
    return;
  }
  __lastStageReq=now; computeStage();
}
window.addEventListener('resize', queueStage);
window.addEventListener('load', computeStage);

window.addEventListener('DOMContentLoaded', async () => {
  try {
    const preset = await window.desktopAPI.getLayoutPreset();
    if (preset) {
      const lp = document.getElementById('layoutPreset');
      if (lp) lp.value = preset;
      setTimeout(()=> window.desktopAPI.applyLayoutPreset(preset), 50);
    }
  } catch(e) {}
  try {
    const stored = await window.desktopAPI.getSetting('uiContrast');
    if(stored!=null){ applyContrast(+stored); }
  } catch(_){ }
});

// Dev live CSS reload: if watcher signals change, bust cache on matching <link href>.
try {
  window.desktopAPI.onDevCssChanged?.(files => {
    if(!Array.isArray(files) || !files.length) return;
    const ts = Date.now();
    const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
    links.forEach(l => {
      const href = l.getAttribute('href'); if(!href) return;
      const base = href.split('?')[0];
      const basename = base.split('/').pop();
      // Watcher currently sends just filename (not path). Compare to basename.
      if(files.some(f => f === basename || f.endsWith('/'+basename))){
        l.setAttribute('href', base + '?v=' + ts);
      }
    });
  });
} catch(_){ }

document.getElementById('refreshAll').onclick = () => window.desktopAPI.refreshAll();
// Simplified board: always docked. Support side + width adjustments only.
const btnSide=document.getElementById('boardSide');
const splitter=document.getElementById('boardSplitter');
let boardState=null; let resizing=false; let startX=0; let startWidth=0;
function applyBoardState(st){
  boardState=st; if(!st) return;
  document.body.classList.toggle('board-docked-left', st.side==='left');
  document.body.classList.toggle('board-docked-right', st.side!=='left');
  splitter.style.display='block';
  if(btnSide){ btnSide.style.display='inline-block'; }
  computeStage();
}
if(btnSide){ btnSide.onclick=()=>{ if(!boardState) return; const next= boardState.side==='left'?'right':'left'; window.desktopAPI.boardSetSide(next); }; }
window.desktopAPI.onBoardUpdated(applyBoardState);
window.desktopAPI.getBoardState().then(applyBoardState);
splitter.addEventListener('mousedown', e=>{ if(!boardState) return; resizing=true; startX=e.clientX; startWidth=boardState.width; splitter.classList.add('dragging'); document.body.style.userSelect='none'; });
window.addEventListener('mousemove', e=>{ if(!resizing) return; const dx=e.clientX-startX; let newW=startWidth; if(boardState.side==='left'){ newW = startWidth + dx; } else { newW = startWidth - dx; } newW=Math.max(240, Math.min(800, newW)); window.desktopAPI.boardSetWidth(newW); });
window.addEventListener('mouseup', ()=>{ if(resizing){ resizing=false; splitter.classList.remove('dragging'); document.body.style.userSelect=''; } });

const statsToggleBtn = document.getElementById('statsToggle');
// Stats: only embedded/hidden now.
function applyStatsState(st){
  if(!st) return;
  const wasEmbedded = document.body.classList.contains('stats-embedded');
  if(st.mode==='hidden'){
    statsToggleBtn.textContent='Stats';
    document.body.classList.remove('stats-embedded');
  } else if(st.mode==='embedded'){
    statsToggleBtn.textContent='Back';
    document.body.classList.add('stats-embedded');
  }
  if(wasEmbedded !== document.body.classList.contains('stats-embedded')){
    setTimeout(computeStage, 0);
  }
}
statsToggleBtn.onclick=()=> window.desktopAPI.statsToggle();
window.desktopAPI.getStatsState().then(applyStatsState);
window.desktopAPI.onStatsState(applyStatsState);

// DevTools button
try {
  const devBtn = document.getElementById('openDevTools');
  if(devBtn){ devBtn.onclick = () => { try { window.desktopAPI.openDevTools(); } catch(_){} }; }
} catch(_){ }

// Add broker via select dropdown mirroring layout behavior
let __populatingAddSelect = false;
async function populateAddBrokerSelect(force=false){
  if(__populatingAddSelect) return; // debounce concurrent triggers
  const sel = document.getElementById('addBrokerSelect'); if(!sel) return;
  // If not forced and we already have more than placeholder+1 Excel option, assume list already built
  if(!force){
    const existingOpts = sel.querySelectorAll('option');
    if(existingOpts.length > 2) return; // already populated
  }
  __populatingAddSelect = true;
  try {
    const placeholder = Object.assign(document.createElement('option'),{value:'',textContent:'＋ Broker'});
    sel.innerHTML=''; sel.appendChild(placeholder);
    const { brokers=[], active=[] } = await window.desktopAPI.getBrokersForPicker();
    const activeSet = new Set(active);
  // Excel feed now internal; no special dataservices pseudo-broker option.
    for(const b of brokers){
      // Skip pseudo-broker duplication just in case
      if(b.id === 'dataservices') continue;
      const opt=document.createElement('option');
      opt.value=b.id; opt.textContent = activeSet.has(b.id) ? `${b.id} (added)` : b.id;
      if(b.inactive){ opt.disabled=true; opt.textContent = `${b.id} (inactive)`; }
      else if(activeSet.has(b.id)){ opt.disabled=true; }
      sel.appendChild(opt);
    }
  } catch(_){ } finally { __populatingAddSelect = false; }
}
const addSelect = document.getElementById('addBrokerSelect');
if(addSelect){
  addSelect.addEventListener('focus', ()=> populateAddBrokerSelect());
  addSelect.addEventListener('change', async ()=>{
    const v=addSelect.value; if(!v) return;
    window.desktopAPI.addBroker(v);
    setTimeout(()=> populateAddBrokerSelect(true), 150);
    addSelect.value='';
  });
  // Refresh the dropdown whenever active broker list changes (e.g., after closing one)
  try { window.desktopAPI.onBrokersSync?.(()=> populateAddBrokerSelect(true)); } catch(_){ }
}
document.getElementById('layoutPreset').onchange = (e) => { if(e.target.value) window.desktopAPI.applyLayoutPreset(e.target.value); };
const autoReloadCb = document.getElementById('autoReloadToggle');
window.desktopAPI.getAutoRefreshEnabled().then(v=>{ autoReloadCb.checked = !!v; });
autoReloadCb.addEventListener('change', ()=> window.desktopAPI.setAutoRefreshEnabled(autoReloadCb.checked));
window.desktopAPI.onAutoRefreshUpdated?.(p=>{ autoReloadCb.checked = !!(p && p.enabled); });
function applyContrast(v){ v=Math.min(130,Math.max(70,v||100)); document.documentElement.style.setProperty('--ui-contrast', v/100); }
window.applyContrast = applyContrast;

document.getElementById('openSettings').onclick = () => window.desktopAPI.openSettings();
window.desktopAPI.onContrastPreview?.(v=> applyContrast(+v));
window.desktopAPI.onContrastSaved?.(v=> applyContrast(+v));
window.desktopAPI.onUIBlurOn?.(()=> document.body.classList.add('overlay-blur'));
window.desktopAPI.onUIBlurOff?.(()=> document.body.classList.remove('overlay-blur'));

// (Excel URL modal logic moved to dedicated BrowserView overlay)

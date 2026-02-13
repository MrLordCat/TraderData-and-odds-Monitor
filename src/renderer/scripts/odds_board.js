// Odds Board - embedded odds table in stats panel
// Handles: odds display, map selection, broker swap, DS/Excel modes, Auto trading UI, section reorder
// Note: stats panel BrowserView does NOT use the main preload (no window.desktopAPI)
// desktop_api_shim.js is loaded via script tag in stats_panel.html before this file

// ES module imports
import OddsCore from '../core/odds_core.js';
import OddsBoardShared from '../ui/odds_board_shared.js';
import ExcelStatusUI from '../ui/excel_status.js';

let currentMap = undefined; // shared map number propagated from main / board
function updateEmbeddedMapTag(){
  try {
    const el=document.getElementById('embeddedMapTag');
    if(!el) return;
    if(currentMap==null || currentMap===0 || currentMap==='') el.textContent='Map -';
    else el.textContent='Map '+currentMap;
  } catch(_){ }
}
function applyMapValue(m){ currentMap=m; window.__embeddedCurrentMap=currentMap; updateEmbeddedMapTag(); syncEmbeddedMapSelect(); forceMapSelectValue(); }
function applyIsLast(cfg){ const b=document.getElementById('embeddedIsLast'); if(b && typeof cfg?.isLast!=='undefined') b.classList.toggle('active', !!cfg.isLast); }
function initEmbeddedMapSync(){
  // desktopAPI always available via shim (loaded before this file)
  window.desktopAPI.onMapConfig(cfg=>{ 
    if(cfg && typeof cfg.map !== 'undefined') applyMapValue(cfg.map);
    applyIsLast(cfg);
  });
  // Initial fetch
  window.desktopAPI.getMapConfig().then(cfg=>{ 
    if(cfg && typeof cfg.map!=='undefined') applyMapValue(cfg.map);
    applyIsLast(cfg);
  }).catch(()=>{});
  
  bindEmbeddedMapSelect();
  
  // Bind 'Last' toggle button in Odds Board header
  const lastBtn = document.getElementById('embeddedIsLast');
  if(lastBtn && !lastBtn.dataset.bound){
    lastBtn.dataset.bound='1';
    let isLast = lastBtn.classList.contains('active');
    lastBtn.addEventListener('click', ()=>{
      isLast = !isLast;
      lastBtn.classList.toggle('active', isLast);
      window.desktopAPI.setIsLast(isLast);
    });
  }
}
function syncEmbeddedMapSelect(){
  const sel=document.getElementById('embeddedMapSelect');
  if(!sel) return; const v = (currentMap==null?'' : String(currentMap));
  if(v !== '' && sel.value!==v){ sel.value=v; }
}
function forceMapSelectValue(){
  const desired = (currentMap==null?'' : String(currentMap));
  if(desired==='') return;
  [0,60,150,320,650].forEach(ms=> setTimeout(()=>{
    const sel=document.getElementById('embeddedMapSelect'); if(sel && sel.value!==desired) sel.value=desired;
  }, ms));
}
/** Compare two odds records numerically. Returns true if both valid and equal. */
function oddsMatch(a, b){
  if(!a || !b || !Array.isArray(a.odds) || !Array.isArray(b.odds)) return false;
  if(a.odds[0]==='-' || b.odds[0]==='-') return false;
  return parseFloat(a.odds[0])===parseFloat(b.odds[0]) && parseFloat(a.odds[1])===parseFloat(b.odds[1]);
}
function bindEmbeddedMapSelect(){
  const sel=document.getElementById('embeddedMapSelect');
  if(!sel || sel.dataset.bound) return; sel.dataset.bound='1';
  sel.addEventListener('change', e=>{
    const v=e.target.value;
    window.desktopAPI.setMap('*', v);
    currentMap = v; window.__embeddedCurrentMap=currentMap; updateEmbeddedMapTag();
  });
  // Refresh button handler (rebroadcast current map without changing selection)
  const btn=document.getElementById('embeddedMapRefreshBtn');
  if(btn && !btn.dataset.bound){
    btn.dataset.bound='1';
    btn.addEventListener('click', ()=>{
      const v = sel.value;
      window.desktopAPI.setMap('*', v);
    });
    // Right-click toggles shared auto mode
    btn.addEventListener('contextmenu', (e)=>{
      e.preventDefault(); window.desktopAPI.toggleMapAutoRefresh();
    });
  }
}
const embeddedOddsData = {}; let embeddedBest1=NaN, embeddedBest2=NaN;
// DS mismatch tracking
let lastEmbeddedExcelOdds = null;
let embeddedDsMismatchTimer = null;
// Auto map rebroadcast status visual sync (shim guarantees desktopAPI)
function applyEmbeddedMapAutoRefreshVisual(p){
  const btn=document.getElementById('embeddedMapRefreshBtn'); if(!btn) return;
  const enabled = !!(p && p.enabled);
  btn.style.opacity = enabled ? '1' : '';
  btn.style.background = enabled ? '#2f4b6a' : '';
  btn.style.border = enabled ? '1px solid #3f6c90' : '';
  btn.title = enabled ? 'Auto odds refresh: ON (right-click to disable)' : 'Re-broadcast current map (refresh odds) (right-click to enable auto)';
}
window.desktopAPI.onMapAutoRefreshStatus(applyEmbeddedMapAutoRefreshVisual);
window.desktopAPI.getMapAutoRefreshStatus().then(p=>applyEmbeddedMapAutoRefreshVisual(p)).catch(()=>{});
// Per-broker side swap (exclude excel). Centralized via IPC and synced across views.
if(!window.__swappedBrokers) window.__swappedBrokers = new Set();

async function initEmbeddedSwapSync(){
  const apply = (list)=>{
    if(!window.__swappedBrokers) window.__swappedBrokers = new Set();
    window.__swappedBrokers.clear();
    (list||[]).forEach(b=>{ const v=String(b||'').trim(); if(v) window.__swappedBrokers.add(v); });
    renderEmbeddedOdds();
  };
  try { const list = await window.desktopAPI.getSwappedBrokers(); apply(list); } catch(_){ }
  window.desktopAPI.onSwappedBrokersUpdated(apply);
}
try { initEmbeddedSwapSync(); } catch(_){ }
function renderEmbeddedOdds(){
  const rowsEl=document.getElementById('embeddedOddsRows'); if(!rowsEl) return;
  const excelRec = embeddedOddsData['excel'];
  // Filter out excel and ds from broker list (ds shows in Excel row brackets)
  const vals=Object.values(embeddedOddsData).filter(r=>r.broker!=='excel' && r.broker!=='ds');
  let liveNums1 = [];
  let liveNums2 = [];
  // Use smart incremental update instead of full rebuild
  if(OddsBoardShared && OddsBoardShared.updateOddsTable){
    const out = OddsBoardShared.updateOddsTable(rowsEl, vals, { variant:'embedded', isSwapped: (b)=> !!(window.__swappedBrokers && window.__swappedBrokers.has(b)) });
    embeddedBest1 = out.best1;
    embeddedBest2 = out.best2;
    liveNums1 = out.liveNums1 || [];
    liveNums2 = out.liveNums2 || [];
  }
  // Excel row update
  const excelCell=document.getElementById('embeddedExcelCell');
  const excelRow=document.getElementById('embeddedExcelRow');
  const hasExcelOdds = excelRec && Array.isArray(excelRec.odds) && excelRec.odds[0] !== '-';
  
  if(excelCell && excelRow){
    excelCell.textContent = hasExcelOdds ? `${excelRec.odds[0]} / ${excelRec.odds[1]}` : '- / -';
    excelRow.classList.toggle('frozen', !!(excelRec && excelRec.frozen));
  }
  
  // Track Excel odds changes for DS mismatch detection (compare as numbers to avoid 1.4 vs 1.40 mismatch)
  const excelNum1 = hasExcelOdds ? parseFloat(excelRec.odds[0]) : NaN;
  const excelNum2 = hasExcelOdds ? parseFloat(excelRec.odds[1]) : NaN;
  const excelOddsKey = hasExcelOdds ? `${excelNum1}|${excelNum2}` : null;
  if(excelOddsKey && excelOddsKey !== lastEmbeddedExcelOdds){
    lastEmbeddedExcelOdds = excelOddsKey;
    if(embeddedDsMismatchTimer){ clearTimeout(embeddedDsMismatchTimer); embeddedDsMismatchTimer = null; }
    const dsRow = document.getElementById('embeddedDsRow');
    if(dsRow) dsRow.classList.remove('ds-mismatch');
    embeddedDsMismatchTimer = setTimeout(()=>{
      const dsRow = document.getElementById('embeddedDsRow');
      if(dsRow && !oddsMatch(embeddedOddsData['ds'], embeddedOddsData['excel'])){
        dsRow.classList.add('ds-mismatch');
      }
    }, 5000);
  }
  
  // DS row update
  const dsCell=document.getElementById('embeddedDsCell');
  const dsRow=document.getElementById('embeddedDsRow');
  const dsRec = embeddedOddsData['ds'];
  const hasDsOdds = dsRec && Array.isArray(dsRec.odds) && dsRec.odds[0] !== '-';
  
  if(dsCell && dsRow){
    if(hasDsOdds){
      dsCell.textContent = `${dsRec.odds[0]} / ${dsRec.odds[1]}`;
      dsRow.classList.toggle('frozen', !!dsRec.frozen);
      dsRow.classList.remove('no-data');
      if(oddsMatch(dsRec, excelRec)){
        dsRow.classList.remove('ds-mismatch');
        if(embeddedDsMismatchTimer){ clearTimeout(embeddedDsMismatchTimer); embeddedDsMismatchTimer = null; }
      }
    } else {
      dsCell.textContent = '— / —';
      dsRow.classList.remove('frozen', 'ds-mismatch');
      dsRow.classList.add('no-data');
    }
  }

  // DS game phase badge
  const phaseBadge = document.getElementById('dsGamePhaseBadge');
  if(phaseBadge){
    const phase = dsRec?.gamePhase || '';
    if(phase){
      const short = phase === 'In-Play' ? 'LIVE' : phase === 'Pre-Game' ? 'PRE' : phase === 'Post-Game' ? 'POST' : phase === 'Break In Play' ? 'BRK' : phase.substring(0,4).toUpperCase();
      phaseBadge.textContent = short;
      phaseBadge.className = 'dsGamePhaseBadge';
      if(phase === 'In-Play') phaseBadge.classList.add('phase-live');
      else if(phase === 'Pre-Game') phaseBadge.classList.add('phase-pre');
      else if(phase === 'Post-Game') phaseBadge.classList.add('phase-post');
      else phaseBadge.classList.add('phase-other');
      phaseBadge.style.display = '';
      phaseBadge.title = 'DS: ' + phase;
    } else {
      phaseBadge.style.display = 'none';
      phaseBadge.textContent = '';
    }
  }

  const midCell=document.getElementById('embeddedMidCell');
  if(midCell){
    const mid = (OddsBoardShared && OddsBoardShared.calcMidFromLiveNums)
      ? OddsBoardShared.calcMidFromLiveNums(liveNums1, liveNums2)
      : (liveNums1.length && liveNums2.length ? { mid1:(Math.min(...liveNums1)+Math.max(...liveNums1))/2, mid2:(Math.min(...liveNums2)+Math.max(...liveNums2))/2 } : null);
    if(!mid){ midCell.textContent='-'; }
    else { midCell.textContent=`${mid.mid1.toFixed(2)} / ${mid.mid2.toFixed(2)}`; }
  }
  
  // Arb calculation
  const arbCell = document.getElementById('embeddedArbCell');
  const arbRow = document.getElementById('embeddedArbRow');
  if(arbCell && arbRow){
    if(!isNaN(embeddedBest1) && !isNaN(embeddedBest2) && embeddedBest1 > 0 && embeddedBest2 > 0){
      const margin = (1/embeddedBest1 + 1/embeddedBest2) * 100;
      if(margin < 100){
        arbCell.textContent = `+${(100-margin).toFixed(2)}% (${embeddedBest1.toFixed(2)} / ${embeddedBest2.toFixed(2)})`;
        arbCell.classList.add('arb-positive');
        arbRow.style.display = '';
      } else {
        arbRow.style.display = 'none';
      }
    } else {
      arbRow.style.display = 'none';
    }
  }
  
  const h1=document.querySelector('#lt-team1 .teamNameWrap')?.textContent || 'Side 1';
  const h2=document.querySelector('#lt-team2 .teamNameWrap')?.textContent || 'Side 2';
  const eo1=document.getElementById('eo-side1'); const eo2=document.getElementById('eo-side2');
  if(eo1) eo1.textContent=h1; if(eo2) eo2.textContent=h2;

  // Embedded auto indicators visibility
  const indRow=document.getElementById('embeddedExcelAutoIndicatorsRow');
  const sim = window.__embeddedAutoSim;
  if(indRow) indRow.style.display = (sim && sim.active) ? '' : 'none';
}
function handleEmbeddedOdds(p){
  if(!p||!p.broker) return;
  if(p.removed){ if(embeddedOddsData[p.broker]){ delete embeddedOddsData[p.broker]; renderEmbeddedOdds(); } return; }
  if((currentMap===undefined || currentMap===null) && (p.map!==undefined && p.map!==null)){
    currentMap = p.map; window.__embeddedCurrentMap=currentMap; updateEmbeddedMapTag(); syncEmbeddedMapSelect(); forceMapSelectValue();
  }
  embeddedOddsData[p.broker]=p; renderEmbeddedOdds();
}

// ======= Embedded derived + auto guard =======
// Derived + market guards handled by AutoHub now
function initEmbeddedOdds(){ const root=document.getElementById('embeddedOddsSection'); if(!root) return; // collapse handled globally
  // Prefer shared OddsCore hub if available; fallback to direct onOdds (legacy)
  try {
    if(OddsCore && !window.__embeddedOddsHub){
      const hub = OddsCore.createOddsHub(); window.__embeddedOddsHub = hub;
      hub.subscribe(st=>{ try {
        Object.assign(embeddedOddsData, st.records||{}); renderEmbeddedOdds();
      } catch(_){ } });
      hub.start();
    } else {
      if(window.desktopAPI?.onOdds) window.desktopAPI.onOdds(p=>{ handleEmbeddedOdds(p); });
    }
  } catch(_){ }
  window.desktopAPI.onTeamNames(()=> renderEmbeddedOdds());
  window.desktopAPI.getTeamNames().then(()=>renderEmbeddedOdds()).catch(()=>{});
  // Remove broker rows when a broker is closed (mirror board behavior)
  window.desktopAPI.onBrokerClosed(id=>{ if(id && embeddedOddsData[id]){ delete embeddedOddsData[id]; renderEmbeddedOdds(); } });
  // Sync with full active brokers list (drop any stale entries not present anymore)
  // Don't remove 'excel' or 'ds' - they come from different sources
  window.desktopAPI.onBrokersSync(ids=>{ const set=new Set(ids||[]); let changed=false; Object.keys(embeddedOddsData).forEach(k=>{ if(k==='excel' || k==='ds') return; if(!set.has(k)){ delete embeddedOddsData[k]; changed=true; } }); if(changed) renderEmbeddedOdds(); });
  // One-time attempt to fetch last Excel odds (if loaded after they were emitted) so user doesn't need to re-select map
  try {
    const ipc = (window.require? window.require('electron').ipcRenderer: null);
    if(ipc && ipc.invoke){ ipc.invoke('excel-last-odds').then(p=>{ if(p && p.broker==='excel'){ handleEmbeddedOdds(p); } }).catch(()=>{}); }
  } catch(_){ }
  // Excel extractor toggle + status (embedded panel)
  try {
    const { ipcRenderer } = require('electron');
    const btn = document.getElementById('embeddedExcelScriptBtn');
    const statusCell = document.getElementById('embeddedExcelStatusCell');
    const scriptMapBadge = document.getElementById('embeddedScriptMapBadge');
    
    function getEmbeddedBoardMap(){
      const sel = document.getElementById('embeddedMapSelect');
      return sel ? parseInt(sel.value, 10) : null;
    }
    
    if(ExcelStatusUI && btn){
      const { applyStatus, refreshBadgeMatch } = ExcelStatusUI.bindExcelStatusButton({
        btn: btn,
        statusEl: statusCell,
        scriptMapBadge: scriptMapBadge,
        getBoardMap: getEmbeddedBoardMap,
        toggle: ()=> ipcRenderer.send('excel-extractor-toggle')
      });
      
      ipcRenderer.on('excel-extractor-status', (_e, s)=> applyStatus(s));
      try { ipcRenderer.invoke('excel-extractor-status-get').then(applyStatus).catch(()=>{}); } catch(_){ }
      
      // Refresh badge when map changes
      const mapSel = document.getElementById('embeddedMapSelect');
      if(mapSel && refreshBadgeMatch){
        mapSel.addEventListener('change', ()=> refreshBadgeMatch());
      }
    }
  } catch(_){ }
}
function initSectionReorder(){
  const ORDER_KEY='statsPanelSectionOrder';
  const container=document.body; if(!container) return;
  const ipc = (window.require? window.require('electron').ipcRenderer: (window.ipcRenderer||null));
  const blocks=collectBlocks();
  // Attempt async restore via IPC first; fallback to localStorage legacy
  let restored=false; let appliedOrder=null; let pendingStoreOrder=null;
  function debug(){ }
  // Apply order with id validation only once unless forced
  function applyIfValid(order, source){ if(!Array.isArray(order) || !order.length) return; const ids=collectBlocks().map(b=>b.id); const filtered=order.filter(id=>ids.includes(id)); if(!filtered.length) return; appliedOrder=filtered; applyOrder(filtered); restored=true; debug('applied from '+source, filtered); }
  // Request from store
  if(ipc && ipc.invoke){
    try { ipc.invoke('stats-section-order-get').then(order=>{ pendingStoreOrder=order; if(!restored) applyIfValid(order,'store'); }); } catch(_){ /* ignore */ }
  }
  // Legacy localStorage immediate attempt
  try { if(!restored){ const legacy = readLegacy(ORDER_KEY); applyIfValid(legacy,'localStorage-initial'); } } catch(_){ }
  // Fallback timer if store slower
  setTimeout(()=>{ if(!restored){ if(pendingStoreOrder) applyIfValid(pendingStoreOrder,'store-timeout'); else { const legacy=readLegacy(ORDER_KEY); applyIfValid(legacy,'localStorage-timeout'); } } }, 400);
  // Re-apply on window load (after all other scripts) to defeat late DOM mods
  window.addEventListener('load', ()=>{ if(appliedOrder){ applyOrder(appliedOrder); debug('re-applied on load'); } });
  blocks.forEach(b=> ensureHandle(b));
  let dragging=null; let placeholder=null; let startY=0;
  function ensureHandle(block){ if(block.dataset.handleReady) return; block.dataset.handleReady='1'; let handle=block.querySelector('.dragHandleSec'); if(!handle){ handle=document.createElement('button'); handle.className='dragHandleSec'; handle.type='button'; handle.textContent='≡'; handle.title='Move section'; if(block.id==='stats'){ const hdr=block.querySelector('.sectionHeader'); if(hdr) hdr.prepend(handle); else block.prepend(handle); } else if(block.matches('fieldset')){ const lg=block.querySelector('legend'); if(lg) lg.prepend(handle); else block.prepend(handle); } else { block.prepend(handle); } }
    handle.addEventListener('pointerdown', e=>{
      e.preventDefault();
      dragging=block; startY=e.clientY;
      // Visual styles: ghost fade + strong outline highlight
      block.classList.add('reorderGhost','reorderDragging');
      // Use a slim line indicator instead of full-height placeholder to avoid large blank gap
      placeholder=document.createElement('div');
      placeholder.className='dropLine';
      // Place initial indicator just after the dragged block
      block.parentNode.insertBefore(placeholder, block.nextSibling);
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp, { once:true });
    }); }
  function collectBlocks(){
    // Dynamic order: querySelectorAll returns in DOM order, so we reflect user drag result
    const nodes = document.querySelectorAll('#sourcesSection,#devtoolsSection,#stats,#embeddedOddsSection');
    return Array.from(nodes);
  }
  function onMove(e){ if(!dragging || !placeholder) return; const dy=e.clientY-startY; dragging.style.transform=`translateY(${dy}px)`; const blocksNow=collectBlocks().filter(b=>b!==dragging); const mid=e.clientY; let inserted=false; for(const blk of blocksNow){ const r=blk.getBoundingClientRect(); const midLine=r.top + r.height/2; if(mid < midLine){ blk.parentNode.insertBefore(placeholder, blk); inserted=true; break; } } if(!inserted){ const last=blocksNow[blocksNow.length-1]; if(last) last.parentNode.appendChild(placeholder); } }
  function onUp(){ if(!dragging) return; dragging.style.transform=''; dragging.classList.remove('reorderGhost','reorderDragging'); if(placeholder){ placeholder.parentNode.insertBefore(dragging, placeholder); placeholder.remove(); placeholder=null; } saveOrder(); dragging=null; }
  function saveOrder(){ const order=collectBlocks().map(b=>b.id); appliedOrder=order;
    try { if(ipc){ ipc.send('stats-section-order-set', order); } } catch(_){ }
    try { localStorage.setItem(ORDER_KEY, JSON.stringify(order)); } catch(_){ }
    debug('saved', order);
  }
  function applyOrder(order){ const parent=document.body; const idToEl={}; collectBlocks().forEach(b=> idToEl[b.id]=b); order.forEach(id=>{ const el=idToEl[id]; if(el){ parent.appendChild(el); } }); }
  function readLegacy(key){ try { const raw=localStorage.getItem(key); if(!raw) return []; const order=JSON.parse(raw); return Array.isArray(order)? order: []; } catch(_){ return []; } }
}
window.initEmbeddedOdds = initEmbeddedOdds;
window.initSectionReorder = initSectionReorder;
initEmbeddedMapSync();
updateEmbeddedMapTag();
// Fallback: after full DOM ready, re-sync in case elements mounted after initial code ran
window.addEventListener('DOMContentLoaded', ()=>{ syncEmbeddedMapSelect(); updateEmbeddedMapTag(); forceMapSelectValue(); });
// Centralized tolerance badge (embedded header)
{
  const { ipcRenderer } = require('electron');
  let lastIpcTol = null;
  function getEngTol(){ const st = window.__embeddedAutoSim; return (st && typeof st.tolerancePct==='number' && !isNaN(st.tolerancePct)) ? st.tolerancePct : null; }
  function setEmbTolBadge(v){
    const el=document.getElementById('embeddedTolBadge'); if(!el) return;
    if (typeof v === 'number' && !isNaN(v)) lastIpcTol = v;
    const val = lastIpcTol ?? getEngTol();
    el.textContent = (val!=null) ? `${val.toFixed(1)}%` : '—%';
  }
  ipcRenderer.invoke('auto-tolerance-get').then(v=> setEmbTolBadge(v)).catch(()=> setEmbTolBadge(null));
  ipcRenderer.on('auto-tolerance-updated', (_e,v)=> setTimeout(()=> setEmbTolBadge(v), 0));
  ipcRenderer.on('auto-active-set', ()=> setTimeout(()=> setEmbTolBadge(null), 0));
}
// Delegate click for swap buttons
document.addEventListener('click', e=>{
  const btn = e.target.closest && e.target.closest('.eo-swapBtn');
  if(!btn) return;
  const broker = btn.getAttribute('data-broker');
  if(!broker || broker==='excel') return;
  const set = window.__swappedBrokers || (window.__swappedBrokers = new Set());
  const next = !set.has(broker);
  if(next) set.add(broker); else set.delete(broker);
  window.desktopAPI.setBrokerSwap(broker, next);
  renderEmbeddedOdds();
});

// ======= Unified panel toolbar bindings =======
function initEmbeddedToolbar(){
  const addBtn = document.getElementById('embeddedAddBroker');
  const layoutSel = document.getElementById('embeddedLayoutPreset');
  const refreshBtn = document.getElementById('embeddedRefreshAll');
  
  if(addBtn){
    let pickerEl = null;
    let pickerOpen = false;
    
    function closePicker(){ pickerOpen = false; if(pickerEl) pickerEl.classList.add('hidden'); }
    
    async function openPicker(){
      if(!pickerEl){
        pickerEl = document.createElement('div');
        pickerEl.id = 'embeddedBrokerPicker';
        pickerEl.className = 'brokerPicker panel-base hidden';
        pickerEl.innerHTML = '<div class="brokerPickerTitle">Add broker</div><div class="brokerPickerList" role="menu"></div>';
        document.body.appendChild(pickerEl);
      }
      
      const list = pickerEl.querySelector('.brokerPickerList');
      if(list) list.innerHTML = '<div class="brokerPickerEmpty muted">Loading…</div>';
      
      const r = addBtn.getBoundingClientRect();
      pickerEl.style.position = 'fixed';
      pickerEl.style.left = Math.max(6, Math.min(window.innerWidth - 240, r.left)) + 'px';
      pickerEl.style.top = (r.bottom + 6) + 'px';
      pickerEl.classList.remove('hidden');
      pickerOpen = true;
      
      try {
        const data = await (window.desktopAPI?.getBrokersForPicker ? window.desktopAPI.getBrokersForPicker() : Promise.resolve({ brokers:[], active:[] }));
        const brokers = Array.isArray(data?.brokers) ? data.brokers : [];
        const active = Array.isArray(data?.active) ? data.active : [];
        const inactive = brokers.filter(b => b?.id && !active.includes(b.id));
        
        if(!list) return;
        if(!inactive.length){
          list.innerHTML = '<div class="brokerPickerEmpty muted">No available brokers</div>';
          return;
        }
        
        list.innerHTML = '';
        inactive.forEach(b => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'brokerPickBtn';
          btn.setAttribute('role', 'menuitem');
          btn.textContent = b.title || b.name || b.id;
          btn.title = b.id;
          btn.addEventListener('click', ()=>{
            window.desktopAPI?.addBroker(b.id);
            if(window.desktopAPI?.getStatsState){
              window.desktopAPI.getStatsState().then(st => {
                if(st && st.mode === 'embedded') window.desktopAPI.statsToggle();
              }).catch(()=>{});
            }
            closePicker();
          });
          list.appendChild(btn);
        });
      } catch(_){ }
    }
    
    addBtn.addEventListener('click', ()=>{ if(pickerOpen) closePicker(); else openPicker(); });
    document.addEventListener('click', e=>{ if(pickerOpen && pickerEl && !pickerEl.contains(e.target) && e.target !== addBtn) closePicker(); });
    window.addEventListener('keydown', e=>{ if(pickerOpen && e.key === 'Escape') closePicker(); });
  }
  
  if(layoutSel){
    window.desktopAPI?.getLayoutPreset?.().then(p=>{ if(p) layoutSel.value = p; }).catch(()=>{});
    layoutSel.addEventListener('change', ()=>{ if(layoutSel.value) window.desktopAPI?.applyLayoutPreset(layoutSel.value); });
  }
  
  if(refreshBtn){
    refreshBtn.addEventListener('click', ()=>{ window.desktopAPI?.refreshAll?.(); });
  }
}

window.addEventListener('DOMContentLoaded', initEmbeddedToolbar);



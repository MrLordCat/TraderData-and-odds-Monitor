// Embedded odds board + section reorder extracted
// Polyfill: stats panel BrowserView does NOT use the main preload (no window.desktopAPI)
// so we use the shared shim to create a minimal bridge.
try { require('./ui/desktop_api_shim'); } catch(_){ }

let currentMap = undefined; // shared map number propagated from main / board
function updateEmbeddedMapTag(){
  try {
    const el=document.getElementById('embeddedMapTag');
    if(!el) return;
    if(currentMap==null || currentMap===0 || currentMap==='') el.textContent='Map -';
    else el.textContent='Map '+currentMap;
  } catch(_){ }
}
function initEmbeddedMapSync(){
  try {
    if(window.desktopAPI && window.desktopAPI.onMap){
  window.desktopAPI.onMap(mapVal=>{ try { currentMap = mapVal; window.__embeddedCurrentMap = currentMap; updateEmbeddedMapTag(); syncEmbeddedMapSelect(); forceMapSelectValue(); } catch(_){} });
    } else {
      const { ipcRenderer } = require('electron');
  ipcRenderer.on('set-map', (_e, mapVal)=>{ try { currentMap = mapVal; window.__embeddedCurrentMap = currentMap; updateEmbeddedMapTag(); syncEmbeddedMapSelect(); forceMapSelectValue(); } catch(_){} });
    }
    // Initial fetch
    if(window.desktopAPI && window.desktopAPI.getLastMap){
  window.desktopAPI.getLastMap().then(v=>{ if(typeof v!=='undefined'){ currentMap=v; window.__embeddedCurrentMap=currentMap; updateEmbeddedMapTag(); syncEmbeddedMapSelect(); forceMapSelectValue(); } }).catch(()=>{});
    }
    bindEmbeddedMapSelect();
    // Bind 'Last' toggle button in Odds Board header
    try {
      const lastBtn = document.getElementById('embeddedIsLast');
      if(lastBtn && !lastBtn.dataset.bound){
        lastBtn.dataset.bound='1';
        let isLast = false;
        lastBtn.addEventListener('click', ()=>{
          try {
            isLast = !isLast;
            lastBtn.classList.toggle('active', isLast);
            if(window.desktopAPI && window.desktopAPI.setIsLast){ window.desktopAPI.setIsLast(isLast); }
          } catch(_){ }
        });
        if(window.desktopAPI && window.desktopAPI.getIsLast){
          window.desktopAPI.getIsLast().then(v=>{ try { isLast = !!v; lastBtn.classList.toggle('active', isLast); } catch(_){ } }).catch(()=>{});
        }
        if(window.desktopAPI && window.desktopAPI.onIsLast){
          window.desktopAPI.onIsLast(v=>{ try { isLast = !!v; lastBtn.classList.toggle('active', isLast); } catch(_){ } });
        }
      }
    } catch(_){ }
  } catch(_){ }
}
function syncEmbeddedMapSelect(){
  try {
    const sel=document.getElementById('embeddedMapSelect');
    if(!sel) return; const v = (currentMap==null?'' : String(currentMap));
    if(v !== '' && sel.value!==v){ sel.value=v; }
  } catch(_){ }
}
function forceMapSelectValue(){
  // Multi-attempt retry if race with late DOM or late persisted load
  const attempts = [0,60,150,320,650];
  const desired = (currentMap==null?'' : String(currentMap));
  if(desired==='') return; // nothing to force
  attempts.forEach(ms=> setTimeout(()=>{
    try {
      const sel=document.getElementById('embeddedMapSelect');
      if(!sel) return; if(sel.value!==desired){ sel.value=desired; /* console.debug('[embeddedOdds] force map select', desired, 'at', ms);*/ }
    } catch(_){ }
  }, ms));
}
function bindEmbeddedMapSelect(){
  try {
    const sel=document.getElementById('embeddedMapSelect');
    if(!sel || sel.dataset.bound) return; sel.dataset.bound='1';
    sel.addEventListener('change', e=>{
      try {
        const v=e.target.value;
        try { console.debug('[embeddedOdds] map change via stats select ->', v); } catch(_){ }
        if(window.desktopAPI && window.desktopAPI.setMap){ window.desktopAPI.setMap('*', v); }
        else {
          try { const { ipcRenderer } = require('electron'); ipcRenderer.send('set-map', { id:'*', map:v }); } catch(_){ }
        }
  // update locally immediately
        currentMap = v; window.__embeddedCurrentMap=currentMap; updateEmbeddedMapTag();
      } catch(_){ }
    });
    // Refresh button handler (rebroadcast current map without changing selection)
    try {
      const btn=document.getElementById('embeddedMapRefreshBtn');
      if(btn && !btn.dataset.bound){
        btn.dataset.bound='1';
        btn.addEventListener('click', ()=>{
          try {
            const v = sel.value;
            if(window.desktopAPI && window.desktopAPI.setMap){ window.desktopAPI.setMap('*', v); }
            else { try { const { ipcRenderer } = require('electron'); ipcRenderer.send('set-map', { id:'*', map:v }); } catch(_){ } }
            try { console.debug('[embeddedOdds] manual map refresh ->', v); } catch(_){ }
          } catch(_){ }
        });
        // Right-click toggles shared auto mode
        btn.addEventListener('contextmenu', (e)=>{
          try { e.preventDefault(); if(window.desktopAPI && window.desktopAPI.toggleMapAutoRefresh){ window.desktopAPI.toggleMapAutoRefresh(); } else { const { ipcRenderer } = require('electron'); ipcRenderer.send('toggle-map-auto-refresh'); } } catch(_){ }
        });
      }
    } catch(_){ }
  } catch(_){ }
}
const embeddedOddsData = {}; let embeddedBest1=NaN, embeddedBest2=NaN;
let OddsBoardShared = null;
try { OddsBoardShared = require('./ui/odds_board_shared'); } catch(_){ }
// Auto map rebroadcast status visual sync (shim guarantees desktopAPI)
try {
  function applyEmbeddedMapAutoRefreshVisual(p){
    try {
      const btn=document.getElementById('embeddedMapRefreshBtn'); if(!btn) return;
      const enabled = !!(p && p.enabled);
      btn.style.opacity = enabled ? '1' : '';
      btn.style.background = enabled ? '#2f4b6a' : '';
      btn.style.border = enabled ? '1px solid #3f6c90' : '';
      btn.title = enabled ? 'Auto odds refresh: ON (right-click to disable)' : 'Re-broadcast current map (refresh odds) (right-click to enable auto)';
    } catch(_){ }
  }
  if(window.desktopAPI?.onMapAutoRefreshStatus) window.desktopAPI.onMapAutoRefreshStatus(applyEmbeddedMapAutoRefreshVisual);
  if(window.desktopAPI?.getMapAutoRefreshStatus) window.desktopAPI.getMapAutoRefreshStatus().then(p=>applyEmbeddedMapAutoRefreshVisual(p)).catch(()=>{});
} catch(_){ }
// Per-broker side swap (exclude excel). Centralized via IPC and synced across views.
try {
  if(!window.__swappedBrokers) window.__swappedBrokers = new Set();
} catch(_){ }

async function initEmbeddedSwapSync(){
  try {
    const apply = (list)=>{
      try {
        if(!window.__swappedBrokers) window.__swappedBrokers = new Set();
        window.__swappedBrokers.clear();
        (list||[]).forEach(b=>{ try { const v=String(b||'').trim(); if(v) window.__swappedBrokers.add(v); } catch(_){ } });
        renderEmbeddedOdds();
      } catch(_){ }
    };
    // Use shim-provided desktopAPI (guaranteed by stats_panel.html script order)
    if(window.desktopAPI?.getSwappedBrokers){
      try { const list = await window.desktopAPI.getSwappedBrokers(); apply(list); } catch(_){ }
      if(window.desktopAPI.onSwappedBrokersUpdated) window.desktopAPI.onSwappedBrokersUpdated(apply);
      return;
    }

    // Fallback localStorage (won't sync across file:// origins)
    try {
      const list = (JSON.parse(localStorage.getItem('swappedBrokers')||'[]')||[]);
      apply(list);
    } catch(_){ }
  } catch(_){ }
}
try { initEmbeddedSwapSync(); } catch(_){ }
function renderEmbeddedOdds(){
  const rowsEl=document.getElementById('embeddedOddsRows'); if(!rowsEl) return;
  const excelRec = embeddedOddsData['excel'];
  const vals=Object.values(embeddedOddsData).filter(r=>r.broker!=='excel');
  let liveNums1 = [];
  let liveNums2 = [];
  if(OddsBoardShared && OddsBoardShared.buildRowsHtml){
    const out = OddsBoardShared.buildRowsHtml(vals, { variant:'embedded', isSwapped: (b)=> !!(window.__swappedBrokers && window.__swappedBrokers.has(b)) });
    rowsEl.innerHTML = out.html;
    embeddedBest1 = out.best1;
    embeddedBest2 = out.best2;
    liveNums1 = out.liveNums1 || [];
    liveNums2 = out.liveNums2 || [];
  } else {
    const liveVals = vals.filter(r=>!r.frozen);
    const p1=liveVals.map(r=>parseFloat(r.odds[0])).filter(n=>!isNaN(n));
    const p2=liveVals.map(r=>parseFloat(r.odds[1])).filter(n=>!isNaN(n));
    liveNums1 = p1; liveNums2 = p2;
    embeddedBest1=p1.length?Math.max(...p1):NaN; embeddedBest2=p2.length?Math.max(...p2):NaN;
    rowsEl.innerHTML = vals.map(r=>{
      const o1=parseFloat(r.odds[0]); const o2=parseFloat(r.odds[1]);
      const frozenCls = r.frozen ? 'frozen' : '';
      const suspTag = r.frozen ? ' eo-broker-label' : ' eo-broker-label';
      const bestCls1 = (!r.frozen && o1===embeddedBest1)?'best':'';
      const bestCls2 = (!r.frozen && o2===embeddedBest2)?'best':'';
      const isSwapped = window.__embeddedSwapped && window.__embeddedSwapped.has(r.broker);
      const swapBtn = `<button class=\"eo-swapBtn ${isSwapped?'on':''}\" data-broker=\"${r.broker}\" title=\"Swap sides\">⇄</button>`;
      return `<tr class="${frozenCls}">`+
        `<td class="eo-broker"><span class="${suspTag}" title="${r.frozen?'Suspended / stale':''}">${r.broker}</span></td>`+
        `<td class="${bestCls1} ${frozenCls}">${r.odds[0]}</td>`+
        `<td class="eo-swap-cell">${swapBtn}</td>`+
        `<td class="${bestCls2} ${frozenCls}">${r.odds[1]}</td>`+
        `</tr>`;
    }).join('');
  }
  // Excel row update
  try {
    const excelCell=document.getElementById('embeddedExcelCell');
    const excelRow=document.getElementById('embeddedExcelRow');
    if(excelCell && excelRow){
      if(excelRec && Array.isArray(excelRec.odds)){
        excelCell.textContent = `${excelRec.odds[0]} / ${excelRec.odds[1]}`;
        excelRow.classList.toggle('frozen', !!excelRec.frozen);
      } else {
        excelCell.textContent='-';
        excelRow.classList.remove('frozen');
      }
    }
  } catch(_){ }
  const midCell=document.getElementById('embeddedMidCell');
  if(midCell){
    const mid = (OddsBoardShared && OddsBoardShared.calcMidFromLiveNums)
      ? OddsBoardShared.calcMidFromLiveNums(liveNums1, liveNums2)
      : (liveNums1.length && liveNums2.length ? { mid1:(Math.min(...liveNums1)+Math.max(...liveNums1))/2, mid2:(Math.min(...liveNums2)+Math.max(...liveNums2))/2 } : null);
    if(!mid){ midCell.textContent='-'; }
    else { midCell.textContent=`${mid.mid1.toFixed(2)} / ${mid.mid2.toFixed(2)}`; }
  }
  
  // Arb calculation: margin = (1/best1 + 1/best2) * 100
  // Only show if margin < 100% (real arbitrage opportunity)
  try {
    const arbCell = document.getElementById('embeddedArbCell');
    const arbRow = document.getElementById('embeddedArbRow');
    if(arbCell && arbRow){
      if(!isNaN(embeddedBest1) && !isNaN(embeddedBest2) && embeddedBest1 > 0 && embeddedBest2 > 0){
        const margin = (1/embeddedBest1 + 1/embeddedBest2) * 100;
        const hasArb = margin < 100;
        if(hasArb){
          const arbPct = 100 - margin;
          arbCell.textContent = `+${arbPct.toFixed(2)}% (${embeddedBest1.toFixed(2)} / ${embeddedBest2.toFixed(2)})`;
          arbCell.classList.add('arb-positive');
          arbRow.style.display = '';
        } else {
          arbRow.style.display = 'none';
        }
      } else {
        arbRow.style.display = 'none';
      }
    }
  } catch(_){ }
  
  try {
    const h1=document.querySelector('#lt-team1 .teamNameWrap')?.textContent || 'Side 1';
    const h2=document.querySelector('#lt-team2 .teamNameWrap')?.textContent || 'Side 2';
    const eo1=document.getElementById('eo-side1'); const eo2=document.getElementById('eo-side2');
    if(eo1) eo1.textContent=h1; if(eo2) eo2.textContent=h2;
  } catch(_){ }

  // Embedded auto rows (only indicators now) visibility update
  try {
    const indRow=document.getElementById('embeddedExcelAutoIndicatorsRow');
    const sim = window.__embeddedAutoSim;
    const vis = (sim && sim.active) ? '' : 'none';
    if(indRow) indRow.style.display = vis;
  } catch(_){ }
  // Auto guards moved to centralized AutoHub
}
// Prepare for game-specific tweaks (just log for now)
try {
  const { ipcRenderer } = require('electron');
  ipcRenderer.invoke('game-get').then(g=>{ try { console.log('[embeddedOdds] game initial', g); } catch(_){ } }).catch(()=>{});
  ipcRenderer.on('game-changed', (_e,g)=>{ try { console.log('[embeddedOdds] game changed ->', g); } catch(_){ } });
} catch(_){ }
function handleEmbeddedOdds(p){ try {
  if(!p||!p.broker) return;
  if(p.removed){ if(embeddedOddsData[p.broker]){ delete embeddedOddsData[p.broker]; renderEmbeddedOdds(); } return; }
  // If map not initialized yet and payload carries map, adopt it
  if((currentMap===undefined || currentMap===null) && (p.map!==undefined && p.map!==null)){
    currentMap = p.map; window.__embeddedCurrentMap=currentMap; updateEmbeddedMapTag(); syncEmbeddedMapSelect(); forceMapSelectValue();
  }
  embeddedOddsData[p.broker]=p; renderEmbeddedOdds();
} catch(_){ } }

// ======= Embedded derived + auto guard =======
// Derived + market guards handled by AutoHub now
function initEmbeddedOdds(){ const root=document.getElementById('embeddedOddsSection'); if(!root) return; // collapse handled globally
  // Prefer shared OddsCore hub if available; fallback to direct onOdds (legacy)
  try {
    if(window.OddsCore && !window.__embeddedOddsHub){
      const hub = window.OddsCore.createOddsHub(); window.__embeddedOddsHub = hub;
      try { console.log('[embeddedOdds][init] Using shared OddsCore hub'); } catch(_){ }
      let firstLogged=false;
      hub.subscribe(st=>{ try {
        if(!firstLogged){
          firstLogged=true;
          const cnt = Object.keys(st.records||{}).length;
          try { console.log('[embeddedOdds][hub][first] records:', cnt, 'derived.hasMid:', !!(st && st.derived && st.derived.hasMid)); } catch(_){ }
        }
          let lastStatusSig = '';
          let lastAutoToastTs = 0;
        Object.assign(embeddedOddsData, st.records||{}); renderEmbeddedOdds();
      } catch(_){ } });
      hub.start();
    } else {
      try { console.log('[embeddedOdds][init] Fallback odds wiring (desktopAPI)'); } catch(_){ }
      if(window.desktopAPI?.onOdds) window.desktopAPI.onOdds(p=>{ try { console.debug('[embeddedOdds] odds-update', p && p.broker); } catch(_){ } handleEmbeddedOdds(p); });
    }
  } catch(_){ }
  try { if(window.desktopAPI?.onTeamNames) window.desktopAPI.onTeamNames(()=> renderEmbeddedOdds()); } catch(_){ }
  try { if(window.desktopAPI?.getTeamNames) window.desktopAPI.getTeamNames().then(()=>renderEmbeddedOdds()).catch(()=>{}); } catch(_){ }
  // Remove broker rows when a broker is closed (mirror board behavior)
  try {
    if(window.desktopAPI?.onBrokerClosed){
      window.desktopAPI.onBrokerClosed(id=>{ try { if(id && embeddedOddsData[id]){ delete embeddedOddsData[id]; renderEmbeddedOdds(); } } catch(_){ } });
    }
  } catch(_){ }
  // Sync with full active brokers list (drop any stale entries not present anymore)
  try {
    if(window.desktopAPI?.onBrokersSync){
      window.desktopAPI.onBrokersSync(ids=>{ try { const set=new Set(ids||[]); let changed=false; Object.keys(embeddedOddsData).forEach(k=>{ if(k==='excel') return; if(!set.has(k)){ delete embeddedOddsData[k]; changed=true; } }); if(changed) renderEmbeddedOdds(); } catch(_){ } });
    }
  } catch(_){ }
  // One-time attempt to fetch last Excel odds (if loaded after they were emitted) so user doesn't need to re-select map
  try {
    const ipc = (window.require? window.require('electron').ipcRenderer: null);
    if(ipc && ipc.invoke){ ipc.invoke('excel-last-odds').then(p=>{ try { console.log('[embeddedOdds][excel-last-odds]', p? 'received':'none'); } catch(_){ } if(p && p.broker==='excel'){ handleEmbeddedOdds(p); } }).catch(()=>{}); }
  } catch(_){ }
  // Excel extractor toggle + status (embedded panel)
  try {
    const { ipcRenderer } = require('electron');
    const btn = document.getElementById('embeddedExcelScriptBtn');
    const statusCell = document.getElementById('embeddedExcelStatusCell');
    const scriptMapBadge = document.getElementById('embeddedScriptMapBadge');

    // Use shared Excel status module
    let ExcelStatusUI = null;
    try { ExcelStatusUI = require('./ui/excel_status'); } catch(_){ }
    if(!ExcelStatusUI && window.ExcelStatusUI) ExcelStatusUI = window.ExcelStatusUI;
    
    // Get board map from embedded map selector
    function getEmbeddedBoardMap(){
      try {
        const sel = document.getElementById('embeddedMapSelect');
        if(sel) return parseInt(sel.value, 10);
      } catch(_){ }
      return null;
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
  function debug(msg, extra){ try { console.debug('[stats-reorder]', msg, extra||''); } catch(_){ } }
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
    const nodes = document.querySelectorAll('#sourcesSection,#devtoolsSection,#stats,#mapSection,#embeddedOddsSection');
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
window.addEventListener('DOMContentLoaded', ()=>{ try { syncEmbeddedMapSelect(); updateEmbeddedMapTag(); forceMapSelectValue(); } catch(_){ } });
// Centralized tolerance badge (embedded header) – prefer engine state, fallback to settings
try {
  const { ipcRenderer } = require('electron');
  function getEngTol(){ try { const st = window.__embeddedAutoSim; if(st && typeof st.tolerancePct==='number' && !isNaN(st.tolerancePct)) return st.tolerancePct; } catch(_){ } return null; }
  function setEmbTolBadge(v){
    try {
      const el=document.getElementById('embeddedTolBadge'); if(!el) return;
      const eff = getEngTol(); const val = (typeof eff==='number' && !isNaN(eff)) ? eff : ((typeof v==='number' && !isNaN(v)) ? v : null);
      el.textContent = (val!=null) ? `Tol: ${val.toFixed(2)}%` : 'Tol: —';
    } catch(_){ }
  }
  if(ipcRenderer){
    try { ipcRenderer.invoke('auto-tolerance-get').then(v=> setEmbTolBadge(v)).catch(()=> setEmbTolBadge(null)); } catch(_){ }
    ipcRenderer.on('auto-tolerance-updated', (_e,v)=> setTimeout(()=> setEmbTolBadge(v), 0));
    ipcRenderer.on('auto-active-set', ()=> setTimeout(()=> setEmbTolBadge(getEngTol()), 0));
  }
} catch(_){ }
// Delegate click for swap buttons
document.addEventListener('click', e=>{
  const btn = e.target.closest && e.target.closest('.eo-swapBtn');
  if(!btn) return;
  const broker = btn.getAttribute('data-broker');
  if(!broker || broker==='excel') return;
  try {
    const set = window.__swappedBrokers || (window.__swappedBrokers = new Set());
    const next = !set.has(broker);
    if(next) set.add(broker); else set.delete(broker);
    if(window.desktopAPI?.setBrokerSwap){
      window.desktopAPI.setBrokerSwap(broker, next);
    } else {
      // Fallback localStorage (won't sync)
      try { localStorage.setItem('swappedBrokers', JSON.stringify(Array.from(set))); } catch(_){ }
    }
    renderEmbeddedOdds();
  } catch(_){ }
});

// ======= Unified panel toolbar bindings =======
function initEmbeddedToolbar(){
  try {
    const addBtn = document.getElementById('embeddedAddBroker');
    const layoutSel = document.getElementById('embeddedLayoutPreset');
    const refreshBtn = document.getElementById('embeddedRefreshAll');
    const autoChk = document.getElementById('embeddedAutoRefresh');
    
    // Add broker
    if(addBtn){
      let pickerEl = null;
      let pickerOpen = false;
      
      function closePicker(){ pickerOpen = false; try { if(pickerEl) pickerEl.classList.add('hidden'); } catch(_){ } }
      
      async function openPicker(){
        try {
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
              try { window.desktopAPI?.addBroker(b.id); } catch(_){ }
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
    
    // Layout preset
    if(layoutSel){
      window.desktopAPI?.getLayoutPreset?.().then(p=>{ try { if(p) layoutSel.value = p; } catch(_){ } }).catch(()=>{});
      layoutSel.addEventListener('change', ()=>{ try { if(layoutSel.value) window.desktopAPI?.applyLayoutPreset(layoutSel.value); } catch(_){ } });
    }
    
    // Refresh all
    if(refreshBtn){
      refreshBtn.addEventListener('click', ()=>{ try { window.desktopAPI?.refreshAll?.(); } catch(_){ } });
    }
    
    // Auto refresh toggle button
    if(autoChk){
      let autoEnabled = false;
      window.desktopAPI?.getAutoRefreshEnabled?.().then(v=>{ try { autoEnabled = !!v; autoChk.classList.toggle('active', autoEnabled); } catch(_){ } }).catch(()=>{});
      autoChk.addEventListener('click', ()=>{ 
        try { 
          autoEnabled = !autoEnabled;
          autoChk.classList.toggle('active', autoEnabled);
          window.desktopAPI?.setAutoRefreshEnabled?.(autoEnabled); 
        } catch(_){ } 
      });
      window.desktopAPI?.onAutoRefreshUpdated?.(p=>{ try { autoEnabled = !!(p?.enabled); autoChk.classList.toggle('active', autoEnabled); } catch(_){ } });
    }
  } catch(e){ console.warn('[embeddedToolbar] init error', e); }
}

// Initialize toolbar on DOMContentLoaded
window.addEventListener('DOMContentLoaded', ()=>{
  try { initEmbeddedToolbar(); } catch(_){ }
});

// (Legacy embedded auto code removed – unified Auto Core is used via auto_trader.js)

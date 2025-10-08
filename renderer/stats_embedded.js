// Embedded odds board + section reorder extracted
// Polyfill: stats panel BrowserView does NOT use the main preload (no window.desktopAPI)
// so we expose a minimal bridge to keep existing code paths working.
try {
  if(!window.desktopAPI){
    const { ipcRenderer } = require('electron');
    if(ipcRenderer){
      window.desktopAPI = {
        invoke: (...args)=>{ try { return ipcRenderer.invoke(...args); } catch(e){ console.error('[embeddedOdds][polyfill][invokeErr]', e); throw e; } },
        send: (...args)=>{ try { return ipcRenderer.send(...args); } catch(e){ console.error('[embeddedOdds][polyfill][sendErr]', e); } },
        autoSendPress: (side)=>{ try { ipcRenderer.invoke('send-auto-press', side); } catch(e){ console.error('[embeddedOdds][polyfill][autoSendPressErr]', e); } },
        // Added Last map helpers to mirror main preload API
        getIsLast: ()=>{ try { return ipcRenderer.invoke('get-is-last'); } catch(e){ console.error('[embeddedOdds][polyfill][getIsLastErr]', e); return Promise.resolve(false); } },
        setIsLast: (v)=>{ try { ipcRenderer.send('set-is-last', !!v); } catch(e){ console.error('[embeddedOdds][polyfill][setIsLastErr]', e); } },
        onIsLast: (cb)=>{ try { const h=(_e,val)=>{ try { cb(val); } catch(_){ } }; ipcRenderer.on('set-is-last', h); return ()=> ipcRenderer.removeListener('set-is-last', h); } catch(e){ console.error('[embeddedOdds][polyfill][onIsLastErr]', e); return ()=>{}; } }
      };
      try { console.log('[embeddedOdds][polyfill] desktopAPI shim installed'); } catch(_){ }
    }
  }
} catch(_){ }
// If preload desktopAPI already existed (unlikely here) but lacked Last helpers, patch them in.
try {
  const { ipcRenderer } = require('electron');
  if(window.desktopAPI && ipcRenderer){
    if(!window.desktopAPI.getIsLast) window.desktopAPI.getIsLast = ()=> ipcRenderer.invoke('get-is-last').catch(()=>false);
    if(!window.desktopAPI.setIsLast) window.desktopAPI.setIsLast = (v)=>{ try { ipcRenderer.send('set-is-last', !!v); } catch(_){ } };
    if(!window.desktopAPI.onIsLast) window.desktopAPI.onIsLast = (cb)=>{ const h=(_e,val)=>{ try { cb(val);}catch(_){ } }; ipcRenderer.on('set-is-last', h); return ()=> ipcRenderer.removeListener('set-is-last', h); };
  }
} catch(_){ }
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
    // Bind existing 'Last' checkbox placed in Odds Board header
    try {
      const chk = document.getElementById('embeddedIsLast');
      if(chk && !chk.dataset.bound){
        chk.dataset.bound='1';
        chk.addEventListener('change', e=>{
          try {
            const v=!!e.target.checked;
            if(window.desktopAPI && window.desktopAPI.setIsLast){ window.desktopAPI.setIsLast(v); }
          } catch(_){ }
        });
        if(window.desktopAPI && window.desktopAPI.getIsLast){
          window.desktopAPI.getIsLast().then(v=>{ try { chk.checked=!!v; } catch(_){ } }).catch(()=>{});
        }
        if(window.desktopAPI && window.desktopAPI.onIsLast){
          window.desktopAPI.onIsLast(v=>{ try { chk.checked=!!v; } catch(_){ } });
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
const { ipcRenderer: ipcRendererEmbedded } = require('electron');
const embeddedOddsData = {}; let embeddedBest1=NaN, embeddedBest2=NaN;
// Auto map rebroadcast status visual sync
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
  if(window.desktopAPI && window.desktopAPI.onMapAutoRefreshStatus){ window.desktopAPI.onMapAutoRefreshStatus(applyEmbeddedMapAutoRefreshVisual); }
  else { ipcRendererEmbedded.on('map-auto-refresh-status', (_e,p)=> applyEmbeddedMapAutoRefreshVisual(p)); }
  if(window.desktopAPI && window.desktopAPI.getMapAutoRefreshStatus){ window.desktopAPI.getMapAutoRefreshStatus().then(p=>applyEmbeddedMapAutoRefreshVisual(p)).catch(()=>{}); }
} catch(_){ }
// Per-broker side swap (exclude excel). Persist in localStorage under embeddedSwappedBrokers
try {
  if(!window.__embeddedSwapped){
    const set = new Set();
    try { (JSON.parse(localStorage.getItem('embeddedSwappedBrokers')||'[]')||[]).forEach(b=> set.add(b)); } catch(_){ }
    window.__embeddedSwapped = set;
  }
} catch(_){ }
function renderEmbeddedOdds(){
  const rowsEl=document.getElementById('embeddedOddsRows'); if(!rowsEl) return;
  const excelRec = embeddedOddsData['excel'] || embeddedOddsData['dataservices'];
  const vals=Object.values(embeddedOddsData).filter(r=>r.broker!=='excel' && r.broker!=='dataservices');
  const liveVals = vals.filter(r=>!r.frozen);
  const p1=liveVals.map(r=>parseFloat(r.odds[0])).filter(n=>!isNaN(n));
  const p2=liveVals.map(r=>parseFloat(r.odds[1])).filter(n=>!isNaN(n));
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
    if(!p1.length||!p2.length){ midCell.textContent='-'; }
    else {
      const mid1=(Math.min(...p1)+Math.max(...p1))/2; const mid2=(Math.min(...p2)+Math.max(...p2))/2;
      midCell.textContent=`${mid1.toFixed(2)} / ${mid2.toFixed(2)}`;
  // Removed header Mid meta display (previously updated #embeddedOddsMeta)
    }
  }
  try {
    const h1=document.querySelector('#lt-team1 .teamNameWrap')?.textContent || 'Side 1';
    const h2=document.querySelector('#lt-team2 .teamNameWrap')?.textContent || 'Side 2';
    const eo1=document.getElementById('eo-side1'); const eo2=document.getElementById('eo-side2');
    if(eo1) eo1.textContent=h1; if(eo2) eo2.textContent=h2;
  } catch(_){ }

  // Embedded auto rows (only indicators now) visibility update
  try {
    const indRow=document.getElementById('embeddedExcelAutoIndicatorsRow');
    const vis = embeddedAutoSim.active ? '' : 'none';
    if(indRow) indRow.style.display = vis;
  } catch(_){ }
}
function handleEmbeddedOdds(p){ try {
  if(!p||!p.broker) return;
  if(p.removed){ if(embeddedOddsData[p.broker]){ delete embeddedOddsData[p.broker]; renderEmbeddedOdds(); } return; }
  // Apply swap if flagged (only for non-excel brokers)
  try { if(p.broker!=='excel' && window.__embeddedSwapped && window.__embeddedSwapped.has(p.broker) && Array.isArray(p.odds) && p.odds.length===2){ p={ ...p, odds:[p.odds[1], p.odds[0]] }; } } catch(_){ }
  // If map not initialized yet and payload carries map, adopt it
  if((currentMap===undefined || currentMap===null) && (p.map!==undefined && p.map!==null)){
    currentMap = p.map; window.__embeddedCurrentMap=currentMap; updateEmbeddedMapTag(); syncEmbeddedMapSelect(); forceMapSelectValue();
  }
  embeddedOddsData[p.broker]=p; renderEmbeddedOdds();
  // Auto disable/resume on dataservices suspension honoring autoResume flag
  try {
  if(p.broker==='excel' || p.broker==='dataservices'){
      if(p.frozen && window.__embeddedAutoSim && window.__embeddedAutoSim.active){
        window.__embeddedAutoSim.active=false; clearTimeout(window.__embeddedAutoSim.timer); window.__embeddedAutoSim.timer=null;
        const btn=document.getElementById('embeddedAutoBtn'); if(btn) btn.classList.remove('on');
        embeddedAutoSim.lastDisableReason='excel-suspended';
        embeddedStatus('Auto OFF (excel suspended)');
        try { console.log('[autoSim][embedded][autoDisable] excel suspended -> auto OFF (intent', embeddedAutoSim.userWanted? 'kept':'cleared', ') resumeAllowed', embeddedAutoSim.autoResume); } catch(_){ }
        try { if(window.desktopAPI && window.desktopAPI.send){ window.desktopAPI.send('auto-mode-changed', { embedded:true, active:false, reason:'excel-suspended' }); } } catch(_){ }
      } else if(!p.frozen && window.__embeddedAutoSim && !window.__embeddedAutoSim.active && embeddedAutoSim.userWanted && embeddedAutoSim.lastDisableReason==='excel-suspended'){
        if(embeddedAutoSim.autoResume){
          window.__embeddedAutoSim.active=true; embeddedAutoSim.lastDisableReason='excel-resumed';
          const btn=document.getElementById('embeddedAutoBtn'); if(btn) btn.classList.add('on');
          embeddedStatus(`Resume (tol ${embeddedAutoSim.tolerancePct.toFixed(2)}%)`);
          try { console.log('[autoSim][embedded][autoResume] excel resumed -> auto ON (autoResume=true)'); } catch(_){ }
          try { if(window.desktopAPI && window.desktopAPI.send){ window.desktopAPI.send('auto-mode-changed', { embedded:true, active:true, reason:'excel-resumed', tolerance: embeddedAutoSim.tolerancePct }); } } catch(_){ }
          embeddedStep();
        } else {
          try { console.log('[autoSim][embedded][resume-blocked] excel resumed but autoResume=false'); } catch(_){ }
          embeddedStatus('Resume blocked (R off)');
        }
      }
    }
  } catch(_){ }
} catch(_){ } }
function initEmbeddedOdds(){ const root=document.getElementById('embeddedOddsSection'); if(!root) return; // collapse handled globally
  try { if(window.desktopAPI && window.desktopAPI.onOdds){ window.desktopAPI.onOdds(p=>{ try { console.debug('[embeddedOdds] odds-update via desktopAPI', p && p.broker); } catch(_){ } handleEmbeddedOdds(p); }); } else { ipcRendererEmbedded.on('odds-update', (_e,p)=>{ try { console.debug('[embeddedOdds] odds-update via ipcRenderer', p && p.broker); } catch(_){ } handleEmbeddedOdds(p); }); } } catch(_){ }
  try { if(window.desktopAPI && window.desktopAPI.onTeamNames){ window.desktopAPI.onTeamNames(()=> renderEmbeddedOdds()); } else { ipcRendererEmbedded.on('lol-team-names-update', ()=> renderEmbeddedOdds()); } } catch(_){ }
  try { if(window.desktopAPI && window.desktopAPI.getTeamNames){ window.desktopAPI.getTeamNames().then(()=>renderEmbeddedOdds()).catch(()=>{}); } } catch(_){ }
  // Remove broker rows when a broker is closed (mirror board behavior)
  try {
    if(window.desktopAPI && window.desktopAPI.onBrokerClosed){
      window.desktopAPI.onBrokerClosed(id=>{ try { if(id && embeddedOddsData[id]){ delete embeddedOddsData[id]; renderEmbeddedOdds(); } } catch(_){ } });
    } else if(ipcRendererEmbedded){
      ipcRendererEmbedded.on('broker-closed', (_e,p)=>{ try { const id=p&&p.id; if(id && embeddedOddsData[id]){ delete embeddedOddsData[id]; renderEmbeddedOdds(); } } catch(_){ } });
    }
  } catch(_){ }
  // Sync with full active brokers list (drop any stale entries not present anymore)
  try {
    if(window.desktopAPI && window.desktopAPI.onBrokersSync){
      window.desktopAPI.onBrokersSync(ids=>{ try { const set=new Set(ids||[]); let changed=false; Object.keys(embeddedOddsData).forEach(k=>{ if(k==='excel'||k==='dataservices') return; if(!set.has(k)){ delete embeddedOddsData[k]; changed=true; } }); if(changed) renderEmbeddedOdds(); } catch(_){ } });
    } else if(ipcRendererEmbedded){
      ipcRendererEmbedded.on('brokers-sync', (_e,p)=>{ try { const ids=(p&&p.ids)||[]; const set=new Set(ids); let changed=false; Object.keys(embeddedOddsData).forEach(k=>{ if(k==='excel'||k==='dataservices') return; if(!set.has(k)){ delete embeddedOddsData[k]; changed=true; } }); if(changed) renderEmbeddedOdds(); } catch(_){ } });
    }
  } catch(_){ }
  // One-time attempt to fetch last Excel odds (if loaded after they were emitted) so user doesn't need to re-select map
  try {
    const ipc = (window.require? window.require('electron').ipcRenderer: null);
    if(ipc && ipc.invoke){ ipc.invoke('excel-last-odds').then(p=>{ if(p && p.broker==='excel'){ handleEmbeddedOdds(p); } }).catch(()=>{}); }
  } catch(_){ }
  // Excel extractor toggle + status (embedded panel)
  try {
    const { ipcRenderer } = require('electron');
    const btn = document.getElementById('embeddedExcelScriptBtn');
    if(btn && !btn.dataset.bound){
      btn.dataset.bound='1';
      btn.addEventListener('click', ()=>{ try { ipcRenderer.send('excel-extractor-toggle'); } catch(_){ } });
    }
    const statusCell = document.getElementById('embeddedExcelStatusCell');
    ipcRenderer.on('excel-extractor-status', (_e, s)=>{
      try {
        if(statusCell){
          if(s.installing) statusCell.textContent='installing...';
          else if(s.starting) statusCell.textContent='starting';
          else if(s.running) statusCell.textContent='running';
          else if(s.error) statusCell.textContent='error';
          else statusCell.textContent='idle';
        }
        if(btn) btn.classList.toggle('on', !!s.running);
      } catch(_){ }
    });
    // Initial status fetch
    try { ipcRenderer.invoke('excel-extractor-status-get').then(s=>{ ipcRenderer.emit('excel-extractor-status', null, s); }).catch(()=>{}); } catch(_){ }
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
// Delegate click for swap buttons
document.addEventListener('click', e=>{
  const btn = e.target.closest && e.target.closest('.eo-swapBtn');
  if(!btn) return;
  const broker = btn.getAttribute('data-broker');
  if(!broker || broker==='excel') return;
  try {
    const set = window.__embeddedSwapped;
    if(set.has(broker)) set.delete(broker); else set.add(broker);
    localStorage.setItem('embeddedSwappedBrokers', JSON.stringify(Array.from(set)));
    // If we already have odds for this broker – swap in-place and re-render
    const rec = embeddedOddsData[broker];
    if(rec && Array.isArray(rec.odds) && rec.odds.length===2){ rec.odds = [rec.odds[1], rec.odds[0]]; }
    renderEmbeddedOdds();
  } catch(_){ }
});

// ================= Embedded Auto alignment helper (simulate only, no virtual odds) =================
const embeddedAutoSim = { active:false, timer:null, stepMs:500, tolerancePct:0.15, lastMidKey:null, fireCooldownMs:900, lastFireTs:0, lastFireSide:null, lastFireKey:null, adaptive:true, waitingForExcel:false, waitToken:0, excelSnapshotKey:null, maxAdaptiveWaitMs:1600, userWanted:false, lastDisableReason:null, autoResume:true, burstLevels:[ { thresholdPct:15, pulses:4 }, { thresholdPct:7, pulses:3 }, { thresholdPct:5, pulses:2 } ] };
try { const ar = localStorage.getItem('embeddedAutoResumeEnabled'); if(ar==='0') embeddedAutoSim.autoResume=false; } catch(_){ }
try { const uw = localStorage.getItem('embeddedAutoUserWanted'); if(uw==='1'){ embeddedAutoSim.userWanted=true; } } catch(_){ }
try { console.log('[autoSim][embedded][startup] stats_embedded.js loaded'); } catch(_){ }
// Lightweight heartbeat to verify forwarding if main board view hidden
try { if(!window.__embeddedAutoHb){ window.__embeddedAutoHb=true; let ticks=0; const loop=()=>{ if(embeddedAutoSim.active) return; try { console.log('[autoSim][embedded][hb]', ++ticks); } catch(_){ } if(ticks<5) setTimeout(loop, 5000); }; setTimeout(loop, 4000);} } catch(_){ }
// Load stored tolerance + interval + adaptive (shared with board)
try {
  const ipc = (window.require? window.require('electron').ipcRenderer: (window.ipcRenderer||null));
  if(ipc && ipc.invoke){
  ipc.invoke('auto-tolerance-get').then(v=>{ if(typeof v==='number' && !isNaN(v)) embeddedAutoSim.tolerancePct = v; try { console.log('[autoSim][embedded] tolerance loaded', embeddedAutoSim.tolerancePct); } catch(_){ } }).catch(()=>{});
    ipc.invoke('auto-interval-get').then(v=>{ if(typeof v==='number' && !isNaN(v)){ embeddedAutoSim.stepMs=v; try { console.log('[autoSim][embedded] interval loaded', v); } catch(_){ } } }).catch(()=>{});
    ipc.invoke('auto-adaptive-get').then(v=>{ if(typeof v==='boolean'){ embeddedAutoSim.adaptive=v; try { console.log('[autoSim][embedded] adaptive loaded', v); } catch(_){ } } }).catch(()=>{});
  ipc.invoke('auto-burst-levels-get').then(v=>{ if(Array.isArray(v)){ embeddedAutoSim.burstLevels=v; try { console.log('[autoSim][embedded] burst levels loaded', v); } catch(_){ } } }).catch(()=>{});
  }
} catch(_){ }
function embeddedParsePair(cellId){
  const el=document.getElementById(cellId); if(!el) return null; const txt=(el.textContent||'').trim(); if(!/\d/.test(txt)) return null;
  const parts=txt.split('/').map(s=>parseFloat(s.trim())).filter(n=>!isNaN(n)); return parts.length===2?parts:null;
}
function embeddedParseMid(){ return embeddedParsePair('embeddedMidCell'); }
function embeddedParseExcel(){ return embeddedParsePair('embeddedExcelCell'); }
function embeddedSetExcel(){ /* placeholder for future real integration; not used in simulation */ }
function embeddedStatus(_msg){ /* status text removed (only dots retained) */ }
function embeddedFlash(idx){ const dot=document.querySelector('#embeddedExcelAutoIndicatorsRow .autoDot.'+(idx===0?'side1':'side2')); if(dot){ dot.classList.add('active'); setTimeout(()=>dot.classList.remove('active'), embeddedAutoSim.stepMs-80); } }
function embeddedSchedule(delay){ if(!embeddedAutoSim.active) return; clearTimeout(embeddedAutoSim.timer); embeddedAutoSim.timer=setTimeout(embeddedStep, typeof delay==='number'? delay: embeddedAutoSim.stepMs); }
function embeddedStep(){
  if(!embeddedAutoSim.active) return;
  const mid=embeddedParseMid(); const ex=embeddedParseExcel();
  if(!mid || !ex){ embeddedStatus('Нет данных'); return embeddedSchedule(); }
  const key=mid.join('|'); if(embeddedAutoSim.lastMidKey && embeddedAutoSim.lastMidKey!==key){ embeddedStatus('Mid changed'); }
  embeddedAutoSim.lastMidKey=key;
  // Min-only alignment: choose side whose MID component is minimal and align only it
  const sideToAdjust = (mid[0] <= mid[1]) ? 0 : 1;
  const diffPct = Math.abs(ex[sideToAdjust] - mid[sideToAdjust]) / mid[sideToAdjust] * 100;
  if(diffPct <= embeddedAutoSim.tolerancePct){
    embeddedStatus('Aligned (min side)');
    try { console.log('[autoSim][embedded][step][min-only] aligned side', sideToAdjust, 'diff', diffPct.toFixed(3)); } catch(_){ }
    return embeddedSchedule();
  }
  const needRaise = ex[sideToAdjust] < mid[sideToAdjust];
  let keyLabel;
  if(sideToAdjust===0){ keyLabel = needRaise ? 'F24' : 'F23'; } else { keyLabel = needRaise ? 'F23' : 'F24'; }
  const direction = needRaise ? 'raise' : 'lower';
  embeddedFlash(sideToAdjust);
  embeddedStatus(`Align ${direction} S${sideToAdjust+1} ${diffPct.toFixed(2)}% (min)`);
  try { console.log('[autoSim][embedded][step][min-only] fireCandidate side', sideToAdjust, direction, 'diff%', diffPct.toFixed(3), 'key', keyLabel); } catch(_){ }
  // Burst logic (embedded): configurable levels
  let pulses=1; try { if(Array.isArray(embeddedAutoSim.burstLevels)){ for(const lvl of embeddedAutoSim.burstLevels){ if(diffPct >= lvl.thresholdPct){ pulses=lvl.pulses; break; } } } } catch(_){ }
  try { console.log('[autoSim][embedded][burst] diff', diffPct.toFixed(3), 'pulses', pulses, '[levels]', embeddedAutoSim.burstLevels); } catch(_){ }
  try {
    const now = Date.now();
    if(now - embeddedAutoSim.lastFireTs < embeddedAutoSim.fireCooldownMs && embeddedAutoSim.lastFireSide===sideToAdjust && embeddedAutoSim.lastFireKey===keyLabel){
      return embeddedSchedule();
    }
    embeddedAutoSim.lastFireTs = now; embeddedAutoSim.lastFireSide=sideToAdjust; embeddedAutoSim.lastFireKey=keyLabel;
    const invokeDirectional = (i)=>{
      let pathUsed='none', invoked=false, invokeErr=null;
      try {
        if(window.desktopAPI && typeof window.desktopAPI.invoke==='function'){
          pathUsed='invoke'; window.desktopAPI.invoke('send-auto-press', { side: sideToAdjust, key: keyLabel, direction, diffPct, noConfirm:true }); invoked=true;
        } else if(window.desktopAPI && window.desktopAPI.autoSendPress){
          pathUsed='autoSendPress'; window.desktopAPI.autoSendPress({ side: sideToAdjust, key: keyLabel, direction, diffPct, noConfirm:true }); invoked=true;
        } else {
          const { ipcRenderer } = require('electron'); if(ipcRenderer && ipcRenderer.invoke){ pathUsed='ipcDirect'; ipcRenderer.invoke('send-auto-press', { side: sideToAdjust, key: keyLabel, direction, diffPct, noConfirm:true }); invoked=true; }
        }
      } catch(err){ invokeErr=err; }
      try { console.log('[autoSim][embedded][burst] directional', i+1,'/',pulses,keyLabel,'invoked',invoked,'path',pathUsed, invokeErr? (''+invokeErr):''); } catch(_){ }
    };
    for(let i=0;i<pulses;i++){
      const delay = i===0? 0 : 55*i;
      setTimeout(()=>invokeDirectional(i), delay);
    }
    const confirmDelay = 55*(pulses-1)+100;
    setTimeout(()=>{
      try {
        if(window.desktopAPI && typeof window.desktopAPI.invoke==='function'){
          window.desktopAPI.invoke('send-auto-press', { side: sideToAdjust, key: 'F22', direction, diffPct, noConfirm:true });
        } else if(window.desktopAPI && window.desktopAPI.autoSendPress){
          window.desktopAPI.autoSendPress({ side: sideToAdjust, key: 'F22', direction, diffPct, noConfirm:true });
        } else {
          const { ipcRenderer } = require('electron'); const ip=ipcRenderer; if(ip && ip.invoke){ ip.invoke('send-auto-press', { side: sideToAdjust, key: 'F22', direction, diffPct, noConfirm:true }); }
        }
        try { console.log('[autoSim][embedded][burst] confirm F22 after', confirmDelay,'ms'); } catch(_){ }
      } catch(_){ }
    }, confirmDelay);
  } catch(_){ }
  if(embeddedAutoSim.adaptive){
    embeddedAutoSim.waitingForExcel=true; embeddedAutoSim.excelSnapshotKey = (ex[0]+'|'+ex[1]);
    const myToken=++embeddedAutoSim.waitToken; const startTs=Date.now();
    const check=()=>{
      if(!embeddedAutoSim.active || !embeddedAutoSim.waitingForExcel || myToken!==embeddedAutoSim.waitToken) return;
      const cur=embeddedParseExcel();
      if(cur){
        const kk=cur[0]+'|'+cur[1];
        if(kk!==embeddedAutoSim.excelSnapshotKey){
          embeddedAutoSim.waitingForExcel=false;
            try { console.log('[autoSim][embedded][adaptive][resume] excelChanged', kk); } catch(_){ }
          return embeddedSchedule(50);
        }
      }
      if(Date.now()-startTs >= embeddedAutoSim.maxAdaptiveWaitMs){
        embeddedAutoSim.waitingForExcel=false;
        try { console.log('[autoSim][embedded][adaptive][timeout] resume'); } catch(_){ }
        return embeddedSchedule();
      }
      setTimeout(check, 120);
    };
    setTimeout(check, 150);
  } else {
    embeddedSchedule();
  }
}
function embeddedToggleAuto(){
  const newState = !embeddedAutoSim.active;
  embeddedAutoSim.active=newState;
  const btn=document.getElementById('embeddedAutoBtn'); if(btn) btn.classList.toggle('on', embeddedAutoSim.active);
  const indRow=document.getElementById('embeddedExcelAutoIndicatorsRow'); if(indRow) indRow.style.display=embeddedAutoSim.active? '' : 'none';
  // status row removed
  embeddedStatus(embeddedAutoSim.active? `Start (tol ${embeddedAutoSim.tolerancePct.toFixed(2)}%)` : 'Stopped');
  try { console.log('[autoSim][embedded][toggle]', embeddedAutoSim.active? 'ON':'OFF', 'tol', embeddedAutoSim.tolerancePct); } catch(_){ }
  try { if(embeddedAutoSim.active){ embeddedAutoSim.userWanted=true; embeddedAutoSim.lastDisableReason=null; localStorage.setItem('embeddedAutoUserWanted','1'); } else { embeddedAutoSim.userWanted=false; embeddedAutoSim.lastDisableReason='manual'; localStorage.setItem('embeddedAutoUserWanted','0'); } } catch(_){ }
  // Forward to main (board forwarding filter in preload only catches [autoSim], so tags preserved)
  try { if(window.desktopAPI && window.desktopAPI.send){ window.desktopAPI.send('auto-mode-changed', { embedded:true, active: embeddedAutoSim.active, tolerance: embeddedAutoSim.tolerancePct }); } } catch(_){ }
  if(embeddedAutoSim.active){ embeddedStep(); } else { clearTimeout(embeddedAutoSim.timer); embeddedAutoSim.timer=null; }
}
document.addEventListener('click', e=>{ if(e.target && e.target.id==='embeddedAutoBtn'){ embeddedToggleAuto(); }});
// Auto-resume (R) button toggle
document.addEventListener('click', e=>{ if(e.target && e.target.id==='embeddedAutoResumeBtn'){ try {
  embeddedAutoSim.autoResume = !embeddedAutoSim.autoResume;
  try { localStorage.setItem('embeddedAutoResumeEnabled', embeddedAutoSim.autoResume? '1':'0'); } catch(_){ }
  e.target.classList.toggle('on', embeddedAutoSim.autoResume);
  try { console.log('[autoSim][embedded][autoResumeFlag]', embeddedAutoSim.autoResume? 'ON':'OFF'); } catch(_){ }
} catch(_){ } }});
// Initialize resume button visual state after DOM ready
window.addEventListener('DOMContentLoaded', ()=>{ try { const rbtn=document.getElementById('embeddedAutoResumeBtn'); if(rbtn) rbtn.classList.toggle('on', embeddedAutoSim.autoResume); } catch(_){ } });
window.__embeddedAutoSim = embeddedAutoSim;

// Hotkey broadcast: toggle embedded auto (from main Numpad5)
try {
  const { ipcRenderer } = window.require? window.require('electron'): {};
  if(ipcRenderer){
    ipcRenderer.on('auto-toggle-all', ()=>{ try { embeddedToggleAuto(); } catch(_){ } });
  }
} catch(_){ }

// Live tolerance update
try {
  const ipc = (window.require? window.require('electron').ipcRenderer: (window.ipcRenderer||null));
  if(ipc){
    ipc.on('auto-tolerance-updated', (_e,v)=>{
      if(typeof v==='number' && !isNaN(v)){
        embeddedAutoSim.tolerancePct = v;
        try { console.log('[autoSim][embedded] tolerance updated ->', v); } catch(_){ }
        if(embeddedAutoSim.active){ embeddedStatus(`Tol ${embeddedAutoSim.tolerancePct.toFixed(2)}%`); }
      }
    });
    ipc.on('auto-interval-updated', (_e,v)=>{ if(typeof v==='number' && !isNaN(v)){ embeddedAutoSim.stepMs=v; try { console.log('[autoSim][embedded] interval updated ->', v); } catch(_){ } } });
  ipc.on('auto-adaptive-updated', (_e,v)=>{ if(typeof v==='boolean'){ embeddedAutoSim.adaptive=v; try { console.log('[autoSim][embedded] adaptive updated ->', v); } catch(_){ } } });
  ipc.on('auto-burst-levels-updated', (_e,levels)=>{ if(Array.isArray(levels)){ embeddedAutoSim.burstLevels=levels; try { console.log('[autoSim][embedded] burst levels updated', levels); } catch(_){ } } });
  }
} catch(_){ }

// Global disable hotkey signal listener
try {
  const { ipcRenderer } = require('electron');
  if(ipcRenderer){
    ipcRenderer.on('auto-disable-all', ()=>{
      try {
        if(embeddedAutoSim.active){
          embeddedAutoSim.active=false; clearTimeout(embeddedAutoSim.timer); embeddedAutoSim.timer=null;
          const btn=document.getElementById('embeddedAutoBtn'); if(btn) btn.classList.remove('on');
          embeddedStatus('Auto OFF (Alt+C)');
          embeddedAutoSim.userWanted=false; embeddedAutoSim.lastDisableReason='manual-global';
          try { localStorage.setItem('embeddedAutoUserWanted','0'); } catch(_){ }
          try { console.log('[autoSim][embedded][autoDisable] Alt+C global -> OFF (intent cleared)'); } catch(_){ }
        }
      } catch(_){ }
    });
  }
} catch(_){ }

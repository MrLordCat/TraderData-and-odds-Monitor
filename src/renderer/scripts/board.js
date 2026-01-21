// ================= Side-panel toolbar wiring (icons) =================
// UI helpers (MiniToast, ApiHelpers) loaded via script tags in board.html - use window.* directly

let __boardDockState = null;
function updateBoardSideIcon(state){
  try {
    const btn = document.getElementById('tbBoardSide');
    if(!btn || !state) return;
    btn.dataset.side = state.side === 'left' ? 'left' : 'right';
  } catch(_){ }
}

function bindTopbar(){
  if(!window.desktopAPI) return;

  // Inline broker picker (dropdown) – opened by + button in the topbar
  let __pickerEl = null;
  let __pickerOpen = false;
  function closePicker(){
    __pickerOpen = false;
    if(__pickerEl) __pickerEl.classList.add('hidden');
  }
  function positionPicker(anchor){
    if(!__pickerEl || !anchor) return;
    const r = anchor.getBoundingClientRect();
    __pickerEl.style.left = Math.max(6, Math.min(window.innerWidth - 240, r.left)) + 'px';
    __pickerEl.style.top = (r.bottom + 6) + 'px';
  }
  async function openPicker(anchor){
    try {
      if(!__pickerEl){
        __pickerEl = document.createElement('div');
        __pickerEl.id = 'brokerPicker';
        __pickerEl.className = 'brokerPicker panel-base hidden';
        __pickerEl.innerHTML = '<div class="brokerPickerTitle">Add broker</div><div class="brokerPickerList" role="menu"></div>';
        document.body.appendChild(__pickerEl);
      }

      const list = __pickerEl.querySelector('.brokerPickerList');
      if(list) list.innerHTML = '<div class="brokerPickerEmpty muted">Loading…</div>';
      positionPicker(anchor);
      __pickerEl.classList.remove('hidden');
      __pickerOpen = true;

      const data = await (window.desktopAPI.getBrokersForPicker ? window.desktopAPI.getBrokersForPicker() : Promise.resolve({ brokers:[], active:[] }));
      const brokers = Array.isArray(data && data.brokers) ? data.brokers : [];
      const active = Array.isArray(data && data.active) ? data.active : [];
      const inactive = brokers.filter(b => b && b.id && !active.includes(b.id));

      if(!list) return;
      if(!inactive.length){
        list.innerHTML = '<div class="brokerPickerEmpty muted">Нет доступных брокеров</div>';
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
          window.desktopAPI.addBroker?.(b.id);
          closePicker();
        });
        list.appendChild(btn);
      });
    } catch(_){ }
  }
  function togglePicker(anchor){
    if(__pickerOpen) closePicker();
    else openPicker(anchor);
  }

  // + Add broker (opens slot picker)
  const addBtn = document.getElementById('tbAddBroker');
  if(addBtn){
    addBtn.addEventListener('click', (e)=>{ e.stopPropagation(); togglePicker(addBtn); });
  }

  // Close picker on outside click / resize / Esc
  document.addEventListener('click', (e)=>{
    if(!__pickerOpen) return;
    if(__pickerEl?.contains(e.target)) return;
    closePicker();
  });
  window.addEventListener('resize', ()=>{ if(__pickerOpen) positionPicker(addBtn); });
  window.addEventListener('keydown', (e)=>{ if(__pickerOpen && e.key==='Escape') closePicker(); });

  // Layout preset
  window.ApiHelpers.bindSelectToApi('tbLayoutPreset', 'getLayoutPreset', 'applyLayoutPreset');

  // Refresh all
  window.ApiHelpers.bindBtnToApi('tbRefreshAll', 'refreshAll');

  // Auto refresh checkbox
  window.ApiHelpers.bindCheckboxToApi('tbAutoReload', 'getAutoRefreshEnabled', 'setAutoRefreshEnabled', 'onAutoRefreshUpdated');

  // Board side arrow
  const sideBtn = document.getElementById('tbBoardSide');
  if(sideBtn){
    sideBtn.addEventListener('click', ()=>{
      const cur = __boardDockState?.side || sideBtn.dataset.side || 'right';
      const next = cur === 'left' ? 'right' : 'left';
      window.desktopAPI.boardSetSide?.(next);
    });
    window.desktopAPI.getBoardState?.().then(st=>{ __boardDockState = st; updateBoardSideIcon(st); }).catch(()=>{});
    window.desktopAPI.onBoardUpdated?.(st=>{ __boardDockState = st; updateBoardSideIcon(st); });
  }

  // Stats
  window.ApiHelpers.bindBtnToApi('tbStats', 'statsToggle');

  // Settings
  window.ApiHelpers.bindBtnToApi('tbSettings', 'openSettings');
}

// ===== Board collapse (title click) =====
(function(){
  try {
    const title = document.querySelector('.boardTitle');
    if(!title) return;
    const KEY = 'boardCollapsed';
    try {
      const v = localStorage.getItem(KEY);
      if(v === '1') document.body.classList.add('boardCollapsed');
    } catch(_){ }
    title.addEventListener('click', ()=>{
      try {
        document.body.classList.toggle('boardCollapsed');
        try { localStorage.setItem(KEY, document.body.classList.contains('boardCollapsed') ? '1' : '0'); } catch(_){ }
      } catch(_){ }
    });
  } catch(_){ }
})();

try { window.addEventListener('DOMContentLoaded', bindTopbar); } catch(_){ }

const boardData = {};
const swapped = new Set();
// Track Excel odds changes for DS mismatch highlight
let lastExcelOdds = null;
let dsMismatchTimer = null;
// Centralized swap (team orientation) is synced via IPC; fallback to localStorage only if IPC unavailable.
try { window.__swappedBrokers = swapped; } catch(_){ }

async function initSwapSync(){
  try {
    const apply = (list)=>{
      try {
        swapped.clear();
        (list||[]).forEach(b=>{ try { const v=String(b||'').trim(); if(v) swapped.add(v); } catch(_){ } });
        try { window.__swappedBrokers = swapped; } catch(_){ }
        renderBoard();
      } catch(_){ }
    };

    if(window.desktopAPI && window.desktopAPI.getSwappedBrokers){
      try { const list = await window.desktopAPI.getSwappedBrokers(); apply(list); } catch(_){ }
      try { if(window.desktopAPI.onSwappedBrokersUpdated){ window.desktopAPI.onSwappedBrokersUpdated(apply); } } catch(_){ }
      return;
    }

    // Fallback: per-view localStorage (may not sync across file:// origins)
    try { (JSON.parse(localStorage.getItem('swappedBrokers')||'[]')||[]).forEach(b=>swapped.add(b)); } catch(_){ }
  } catch(_){ }
}
try { initSwapSync(); } catch(_){ }

// OddsBoardShared and OddsCore loaded via script tags in board.html (use window.* directly)

function computeDerived(){
  const midRow = document.getElementById('midRow');
  const arbRow = document.getElementById('arbRow');
  if(!midRow || !arbRow) return;
  const midCell = midRow.children[1];
  const arbCell = arbRow.children[1];
  
  // Use shared OddsCore.computeDerivedFrom if available
  const derived = (window.OddsCore && window.OddsCore.computeDerivedFrom) 
    ? window.OddsCore.computeDerivedFrom(boardData) 
    : null;
  
  if(!derived || !derived.hasMid){
    midCell.textContent = '-'; 
    arbCell.textContent = '-';
    try { window.__boardDerived = { hasMid: false, arbProfitPct: null }; } catch(_){ }
    return;
  }
  
  const [mid1, mid2] = derived.mid || [0, 0];
  midCell.textContent = `${mid1.toFixed(2)} / ${mid2.toFixed(2)}`;
  arbCell.classList.remove('arb-positive', 'arb-negative');
  
  if(derived.arbProfitPct > 0){
    arbCell.textContent = derived.arbProfitPct.toFixed(2) + '%';
    arbCell.classList.add('arb-positive');
  } else {
    arbCell.textContent = '—';
  }
  try { window.__boardDerived = { hasMid: true, arbProfitPct: derived.arbProfitPct || 0 }; } catch(_){ }
}


// Helper: get odds key for comparison (returns null if invalid)
function getOddsKey(record){
  return record && Array.isArray(record.odds) && record.odds[0] !== '-' 
    ? record.odds.join('|') : null;
}

function renderBoard(){
  const tb = document.getElementById('rows');
  if(!tb) return;
  
  const excelRecord = boardData['excel'];
  const dsRecord = boardData['ds'];
  const dsRow = document.getElementById('dsRow');
  
  // Render broker rows (excluding excel and ds)
  const vals = Object.values(boardData)
    .filter(r => r.broker !== 'excel' && r.broker !== 'ds')
    .sort((a, b) => a.broker.localeCompare(b.broker));
  
  if(window.OddsBoardShared?.buildRowsHtml){
    tb.innerHTML = window.OddsBoardShared.buildRowsHtml(vals, { 
      variant: 'board', 
      isSwapped: b => swapped.has(b) 
    }).html;
  }
  
  // Update Excel row
  const excelRow = document.getElementById('excelRow');
  if(excelRow){
    const valSpan = document.getElementById('excelOddsVal');
    const excelOddsKey = getOddsKey(excelRecord);
    const displayHtml = excelOddsKey ? `${excelRecord.odds[0]} / ${excelRecord.odds[1]}` : '- / -';
    
    if(valSpan) valSpan.innerHTML = displayHtml; 
    else excelRow.children[1].innerHTML = displayHtml;
    
    const oddsCell = excelRow.querySelector('td');
    if(oddsCell) oddsCell.classList.toggle('frozen', !!excelRecord?.frozen);
    
    const statusSpan = document.getElementById('excelStatusCell');
    if(statusSpan?.dataset.last === 'idle') statusSpan.style.display = 'none';
    
    // Track Excel odds changes for DS mismatch detection
    if(excelOddsKey && excelOddsKey !== lastExcelOdds){
      lastExcelOdds = excelOddsKey;
      if(dsMismatchTimer) clearTimeout(dsMismatchTimer);
      if(dsRow) dsRow.classList.remove('ds-mismatch');
      
      dsMismatchTimer = setTimeout(() => {
        const dsRec = boardData['ds'];
        const exRec = boardData['excel'];
        const dsKey = getOddsKey(dsRec);
        const exKey = getOddsKey(exRec);
        const row = document.getElementById('dsRow');
        if(row && dsKey && exKey && dsKey !== exKey){
          row.classList.add('ds-mismatch');
        }
      }, 5000);
    }
  }
  
  // Update DS row
  const dsCell = document.getElementById('dsOddsVal');
  const dsOddsKey = getOddsKey(dsRecord);
  
  if(dsRow && dsCell){
    if(dsOddsKey){
      dsCell.textContent = `${dsRecord.odds[0]} / ${dsRecord.odds[1]}`;
      dsRow.style.display = '';
      dsRow.classList.toggle('frozen', !!dsRecord.frozen);
      
      // If DS odds match Excel, clear mismatch
      const excelOddsKey = getOddsKey(excelRecord);
      if(excelOddsKey && dsOddsKey === excelOddsKey){
        dsRow.classList.remove('ds-mismatch');
        if(dsMismatchTimer){ clearTimeout(dsMismatchTimer); dsMismatchTimer = null; }
      }
    } else {
      dsRow.style.display = 'none';
      dsRow.classList.remove('ds-mismatch');
    }
  }
  
  computeDerived();
}

// Attach to shared OddsCore if available to avoid duplicating collection
try {
  if(window.OddsCore && !window.__boardOddsHub){
    const hub = window.OddsCore.createOddsHub();
    window.__boardOddsHub = hub;
    hub.subscribe(st=>{
      try {
        // update boardData with new records and render
        Object.assign(boardData, st.records||{});
        renderBoard();
      } catch(_){ }
    });
    hub.start();
  }
} catch(_){ }

// Helper: sync boardData with active broker list
function syncBoardDataWithBrokers(ids){
  const set = new Set(ids);
  Object.keys(boardData).forEach(k => {
    if(k === 'excel' || k === 'ds') return; // keep special sources
    if(!set.has(k)) delete boardData[k];
  });
  renderBoard();
}

if(window.desktopAPI){
  // Excel extractor log bridging
  window.desktopAPI.onExcelLog?.(payload => {
    if(payload?.msg) console.log('[excel-extractor][bridge]', payload.msg);
  });
  
  // Mirror auto ON/OFF from other views to update visuals promptly
  window.desktopAPI.onAutoSetAll?.(() => refreshAutoButtonsVisual?.());
  window.desktopAPI.onAutoToggleAll?.(() => refreshAutoButtonsVisual?.());
  window.desktopAPI.onAutoActiveSet?.(() => refreshAutoButtonsVisual?.());
  
  // Broker lifecycle events
  window.desktopAPI.onBrokerClosed?.(id => {
    if(boardData[id]){ delete boardData[id]; renderBoard(); }
  });
  window.desktopAPI.onBrokersSync?.(syncBoardDataWithBrokers);
  
  // Fallback to raw IPC if desktopAPI does not provide broker events
  try {
    const { ipcRenderer } = require('electron');
    if(ipcRenderer){
      if(!window.desktopAPI.onBrokerClosed){
        ipcRenderer.on('broker-closed', (_e, p) => {
          if(p?.id && boardData[p.id]){ delete boardData[p.id]; renderBoard(); }
        });
      }
      if(!window.desktopAPI.onBrokersSync){
        ipcRenderer.on('brokers-sync', (_e, p) => syncBoardDataWithBrokers(p?.ids || []));
      }
    }
  } catch(_){ }
  
  // Excel extractor status updates - using shared module
  const ExcelStatusUI = window.ExcelStatusUI;
  const sBtn = document.getElementById('excelScriptBtn');
  
  if(ExcelStatusUI && sBtn){
    const getBoardMap = () => {
      const sel = document.getElementById('mapSelect');
      return sel ? parseInt(sel.value, 10) : null;
    };
    
    const { applyStatus, refreshBadgeMatch } = ExcelStatusUI.bindExcelStatusButton({
      btn: sBtn,
      statusEl: document.getElementById('excelStatusCell'),
      scriptMapBadge: document.getElementById('scriptMapBadge'),
      getBoardMap,
      toggle: () => window.desktopAPI.excelScriptToggle?.()
    });
    
    // Store refreshBadgeMatch for use in map change handler
    window._boardExcelStatusRefresh = refreshBadgeMatch;
    
    window.desktopAPI.onExcelExtractorStatus?.(applyStatus);
    window.desktopAPI.getExcelExtractorStatus?.().then(applyStatus).catch(() => {});
  }
}

document.addEventListener('click', e=>{
  const btn = e.target.closest('.swapBtn');
  if(!btn) return;
  const broker = btn.getAttribute('data-broker');
  if(!broker) return;
  const next = !swapped.has(broker);
  if(next) swapped.add(broker); else swapped.delete(broker);
  try {
    if(window.desktopAPI && window.desktopAPI.setBrokerSwap){
      window.desktopAPI.setBrokerSwap(broker, next);
    } else {
      // Fallback localStorage only
      try { localStorage.setItem('swappedBrokers', JSON.stringify(Array.from(swapped))); } catch(_){ }
    }
  } catch(_){ }
  renderBoard();
});

// Persisted headers function removed — team names are now synced via IPC API

let currentMapBoard = undefined;
let mapForceToken = 0; // increments each external update to cancel older retries
function forceBoardMapSelect(value){
  const myToken = ++mapForceToken;
  const attempts=[0,50,140,300,600];
  attempts.forEach(ms=> setTimeout(()=>{
    try {
      if(myToken !== mapForceToken) return; // a newer map arrived; discard this attempt
      const sel=document.getElementById('mapSelect'); if(!sel) return;
      if(sel.value!==value){ sel.value=value; /* console.debug('[board] force map select', value, ms);*/ }
    } catch(_){ }
  }, ms));
}
async function restoreMapAndBroadcast(){
  try {
    if(!window.desktopAPI) return;
    const last = await window.desktopAPI.getLastMap();
    if (typeof last !== 'undefined' && last !== null) {
      const sel = document.getElementById('mapSelect');
      if(sel){
        const val = String(last);
        currentMapBoard = val;
        if (sel.value !== val) { sel.value = val; }
        forceBoardMapSelect(val);
        // Single global broadcast (main will rebroadcast to every target)
        window.desktopAPI.setMap('*', val);
        // Update AutoHub with initial board map via shared module
        if(window._boardExcelStatusRefresh){
          window._boardExcelStatusRefresh();
        }
      }
    }
  } catch(e) {}
}

document.getElementById('isLastChk')?.addEventListener('change', e=>{
  const v = !!e.target.checked;
  window.desktopAPI?.setIsLast?.(v);
});
window.desktopAPI?.onIsLast?.(v => {
  const chk = document.getElementById('isLastChk');
  if(chk) chk.checked = !!v;
});

document.getElementById('mapSelect')?.addEventListener('change', e=>{
  if(!window.desktopAPI) return;
  const map=e.target.value;
  window.desktopAPI.setMap('*', map);
  // Update script map badge match/mismatch styling using shared module
  if(window._boardExcelStatusRefresh){
    window._boardExcelStatusRefresh();
  }
});

// Map refresh button: re-broadcast current selection (forces odds collectors to re-run with the same map)
document.getElementById('mapRefreshBtn')?.addEventListener('click', ()=>{
  try {
    if(!window.desktopAPI) return;
    const sel=document.getElementById('mapSelect'); if(!sel) return;
    const val=sel.value;
    // Emit again; main process will persist and broadcast identically
    window.desktopAPI.setMap('*', val);
    try { console.debug('[board] manual map refresh ->', val); } catch(_){ }
  } catch(_){ }
});
// Right click toggles 30s auto-rebroadcast mode (shared between board & embedded stats)
document.getElementById('mapRefreshBtn')?.addEventListener('contextmenu', (e)=>{
  try { e.preventDefault(); if(window.desktopAPI && window.desktopAPI.toggleMapAutoRefresh){ window.desktopAPI.toggleMapAutoRefresh(); } else { const { ipcRenderer } = require('electron'); ipcRenderer.send('toggle-map-auto-refresh'); } } catch(_){ }
});

// Status listener to style button when auto enabled
function bindMapAutoRefreshStatus(){
  try {
    const btn=document.getElementById('mapRefreshBtn'); if(!btn) return;
    if(window.desktopAPI && window.desktopAPI.getMapAutoRefreshStatus){
      window.desktopAPI.getMapAutoRefreshStatus().then(p=>applyMapAutoRefreshVisual(p)).catch(()=>{});
    }
  } catch(_){ }
}
function applyMapAutoRefreshVisual(p){
  try {
    const btn=document.getElementById('mapRefreshBtn'); if(!btn) return;
    const enabled = !!(p && p.enabled);
    btn.style.opacity = enabled ? '1' : '';
    btn.style.background = enabled ? '#2f4b6a' : '';
    btn.style.border = enabled ? '1px solid #3f6c90' : '';
    btn.title = enabled ? 'Auto odds refresh: ON (right-click to disable)' : 'Re-broadcast current map (refresh odds) (right-click to enable auto)';
  } catch(_){ }
}
try {
  if(window.desktopAPI && window.desktopAPI.onMapAutoRefreshStatus){ window.desktopAPI.onMapAutoRefreshStatus(applyMapAutoRefreshVisual); }
  // fallback raw ipc
  else { const { ipcRenderer } = require('electron'); ipcRenderer.on('map-auto-refresh-status', (_e,p)=> applyMapAutoRefreshVisual(p)); }
} catch(_){ }
bindMapAutoRefreshStatus();

// Keep mapSelect updated if board opens after another source changed the map
if(window.desktopAPI && window.desktopAPI.onMap){
  window.desktopAPI.onMap(mapVal=>{
    try {
      const v=String(mapVal);
      if(currentMapBoard === v) return; // no change
      currentMapBoard = v;
      const sel=document.getElementById('mapSelect');
      if(sel && sel.value!==v){ sel.value=v; }
      forceBoardMapSelect(v);
    } catch(_){ }
  });
}

// Track source of team names - Excel has priority
let teamNamesSource = 'grid'; // 'grid' or 'excel'

// Truncate long team names to prevent layout breaking
function truncateName(name, maxLen = 12){
  if(!name || typeof name !== 'string') return name;
  const trimmed = name.trim();
  if(trimmed.length <= maxLen) return trimmed;
  return trimmed.substring(0, maxLen - 1) + '…';
}

// Unified team names updater (used by both initial fetch and live updates)
function updateTeamHeaders(names, source = 'grid'){
  try {
    if(!names) return;
    // Excel has priority over grid
    if(source === 'grid' && teamNamesSource === 'excel'){
      console.log('[board] Ignoring grid team names (Excel has priority):', names);
      return;
    }
    if(source === 'excel') teamNamesSource = 'excel';
    
    console.log('[board] Applying team names from', source, ':', names.team1, '/', names.team2);
    
    const s1=document.getElementById('side1Header');
    const s2=document.getElementById('side2Header');
    if(s1 && names.team1) s1.textContent = truncateName(names.team1);
    if(s2 && names.team2) s2.textContent = truncateName(names.team2);
  } catch(_){ }
}

window.addEventListener('DOMContentLoaded', ()=>{
  // Initial sync from main for team names (new API)
  if(window.desktopAPI && window.desktopAPI.getTeamNames){
    window.desktopAPI.getTeamNames().then(n => updateTeamHeaders(n, 'grid')).catch(()=>{});
  }
  restoreMapAndBroadcast();
  // If external map arrived before DOM ready, enforce it now
  try { if(currentMapBoard!=null){ forceBoardMapSelect(currentMapBoard); } } catch(_){ }
  // Observe global game changes (prep)
  try {
    const { ipcRenderer } = require('electron');
    ipcRenderer.invoke('game-get').then(g=>{ try { console.log('[board] game initial', g); } catch(_){ } }).catch(()=>{});
    ipcRenderer.on('game-changed', (_e,g)=>{ try { console.log('[board] game changed ->', g); } catch(_){ } });
  } catch(_){ }
});

// Listen for team name updates pushed from main via dedicated API (grid source)
if(window.desktopAPI && window.desktopAPI.onTeamNames){
  window.desktopAPI.onTeamNames(n => updateTeamHeaders(n, 'grid'));
}

// Listen for Excel team names (priority source)
if(window.desktopAPI && window.desktopAPI.onExcelTeamNames){
  window.desktopAPI.onExcelTeamNames(n => updateTeamHeaders(n, 'excel'));
}

// Visual state helpers for Auto buttons (kept for board UI)
function refreshAutoButtonsVisual(){
  const autoBtn = document.getElementById('autoBtn');
  const sim = window.__autoSim;
  if(autoBtn && sim){
    // Remove all state classes first
    autoBtn.classList.remove('on', 'waiting');
    
    if(sim.active){
      // Auto is actively running
      autoBtn.classList.add('on');
    } else if(sim.userWanted && sim.lastDisableReason !== 'manual'){
      // Auto is paused by system but may auto-resume
      const resumableReasons = ['no-mid', 'arb-spike', 'diff-suspend', 'excel-suspended', 'market-suspended'];
      if(sim.lastDisableReason && resumableReasons.includes(sim.lastDisableReason)){
        // Yellow "waiting" state - will auto-resume when conditions are met
        autoBtn.classList.add('waiting');
      }
    }
    // If none of the above, button stays in default (off) state
  }
}
// Export for auto_trader.js
window.refreshAutoButtonsVisual = refreshAutoButtonsVisual;

// Centralized tolerance badge (from core Settings)
(function bindToleranceBadge(){
  let lastTol = null;
  function currentEngTol(){ try { const st = window.__autoSim; if(st && typeof st.tolerancePct==='number' && !isNaN(st.tolerancePct)) return st.tolerancePct; } catch(_){ } return null; }
  function setBadge(v){
    const eff = currentEngTol();
    lastTol = (typeof eff==='number' && !isNaN(eff)) ? eff : ((typeof v==='number' && !isNaN(v)) ? v : null);
    try {
      const el = document.getElementById('tolBadge'); if(!el) return;
      if(lastTol!=null) el.textContent = `Tol: ${lastTol.toFixed(2)}%`;
      else el.textContent = 'Tol: —';
    } catch(_){ }
  }
  function fetchInitial(){
    try {
      if(window.desktopAPI && typeof window.desktopAPI.invoke==='function'){
        window.desktopAPI.invoke('auto-tolerance-get').then(v=> setBadge(v)).catch(()=> setBadge(null));
        return;
      }
    } catch(_){ }
    try {
      const { ipcRenderer } = require ? require('electron') : {};
      if(ipcRenderer){
        ipcRenderer.invoke('auto-tolerance-get').then(v=> setBadge(v)).catch(()=> setBadge(null));
        ipcRenderer.on('auto-tolerance-updated', (_e, v)=> setTimeout(()=> setBadge(v), 0));
        // Also resync when auto state toggles (engine may have just attached/initialized)
        ipcRenderer.on('auto-active-set', ()=> setTimeout(()=> setBadge(currentEngTol()), 0));
      }
    } catch(_){ }
  }
  // Subscribe to live updates (both bridges)
  try {
    if(window.desktopAPI && typeof window.desktopAPI.on==='function'){
      // If a generic .on isn't available, rely on raw ipcRenderer subscription above
    }
  } catch(_){ }
  // Ensure badge updates after DOM is ready too
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', ()=> setBadge(lastTol), { once:true });
  } else {
    setBadge(lastTol);
  }
  fetchInitial();
})();

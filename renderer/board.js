// ================= Side-panel toolbar wiring (icons) =================
// Load shared UI helpers
let MiniToast = null;
let ApiHelpers = null;
try { MiniToast = require('./ui/toast'); } catch(_){ }
try { ApiHelpers = require('./ui/api_helpers'); } catch(_){ }

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
    try { if(__pickerEl) __pickerEl.classList.add('hidden'); } catch(_){ }
  }
  function positionPicker(anchor){
    try {
      if(!__pickerEl || !anchor) return;
      const r = anchor.getBoundingClientRect();
      // Use fixed positioning inside the BrowserView
      __pickerEl.style.left = Math.max(6, Math.min(window.innerWidth - 240, r.left)) + 'px';
      __pickerEl.style.top = (r.bottom + 6) + 'px';
    } catch(_){ }
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
          try { window.desktopAPI.addBroker && window.desktopAPI.addBroker(b.id); } catch(_){ }
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
  try {
    const addBtn = document.getElementById('tbAddBroker');
    if(addBtn){
      addBtn.addEventListener('click', (e)=>{ try { e && e.stopPropagation && e.stopPropagation(); } catch(_){ } togglePicker(addBtn); });
    }
  } catch(_){ }

  // Close picker on outside click / resize / Esc
  try {
    document.addEventListener('click', (e)=>{
      if(!__pickerOpen) return;
      const t = e && e.target;
      if(__pickerEl && (t===__pickerEl || (__pickerEl.contains && __pickerEl.contains(t)))) return;
      closePicker();
    });
    window.addEventListener('resize', ()=>{ try { if(__pickerOpen){ const a=document.getElementById('tbAddBroker'); positionPicker(a); } } catch(_){ } });
    window.addEventListener('keydown', (e)=>{ try { if(__pickerOpen && e && e.key==='Escape'){ closePicker(); } } catch(_){ } });
  } catch(_){ }

  // Layout preset
  try {
    if(ApiHelpers){ ApiHelpers.bindSelectToApi('tbLayoutPreset', 'getLayoutPreset', 'applyLayoutPreset'); }
    else {
      const sel = document.getElementById('tbLayoutPreset');
      if(sel){
        window.desktopAPI.getLayoutPreset?.().then(p=>{ try { if(p) sel.value = p; } catch(_){ } }).catch(()=>{});
        sel.addEventListener('change', ()=>{ try { if(sel.value) window.desktopAPI.applyLayoutPreset(sel.value); } catch(_){ } });
      }
    }
  } catch(_){ }

  // Refresh all
  if(ApiHelpers){ ApiHelpers.bindBtnToApi('tbRefreshAll', 'refreshAll'); }
  else { try { document.getElementById('tbRefreshAll')?.addEventListener('click', ()=>{ window.desktopAPI.refreshAll?.(); }); } catch(_){ } }

  // Auto refresh checkbox
  if(ApiHelpers){ ApiHelpers.bindCheckboxToApi('tbAutoReload', 'getAutoRefreshEnabled', 'setAutoRefreshEnabled', 'onAutoRefreshUpdated'); }
  else {
    try {
      const cb = document.getElementById('tbAutoReload');
      if(cb){
        window.desktopAPI.getAutoRefreshEnabled?.().then(v=>{ try { cb.checked = !!v; } catch(_){ } }).catch(()=>{});
        cb.addEventListener('change', ()=>{ try { window.desktopAPI.setAutoRefreshEnabled && window.desktopAPI.setAutoRefreshEnabled(!!cb.checked); } catch(_){ } });
        window.desktopAPI.onAutoRefreshUpdated?.(p=>{ try { cb.checked = !!(p && p.enabled); } catch(_){ } });
      }
    } catch(_){ }
  }

  // Board side arrow
  try {
    const sideBtn = document.getElementById('tbBoardSide');
    if(sideBtn){
      sideBtn.addEventListener('click', ()=>{
        try {
          const cur = (__boardDockState && __boardDockState.side) ? __boardDockState.side : (sideBtn.dataset.side || 'right');
          const next = (cur === 'left') ? 'right' : 'left';
          window.desktopAPI.boardSetSide && window.desktopAPI.boardSetSide(next);
        } catch(_){ }
      });
      window.desktopAPI.getBoardState?.().then(st=>{ __boardDockState = st; updateBoardSideIcon(st); }).catch(()=>{});
      window.desktopAPI.onBoardUpdated?.(st=>{ __boardDockState = st; updateBoardSideIcon(st); });
    }
  } catch(_){ }

  // Stats
  if(ApiHelpers){ ApiHelpers.bindBtnToApi('tbStats', 'statsToggle'); }
  else { try { document.getElementById('tbStats')?.addEventListener('click', ()=>{ window.desktopAPI.statsToggle?.(); }); } catch(_){ } }

  // Settings
  if(ApiHelpers){ ApiHelpers.bindBtnToApi('tbSettings', 'openSettings'); }
  else { try { document.getElementById('tbSettings')?.addEventListener('click', ()=>{ window.desktopAPI.openSettings?.(); }); } catch(_){ } }
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

let OddsBoardShared = null;
try { OddsBoardShared = require('./ui/odds_board_shared'); } catch(_){ }


function computeDerived(){
  const midRow = document.getElementById('midRow');
  const arbRow = document.getElementById('arbRow');
  if(!midRow || !arbRow) return;
  const midCell=midRow.children[1];
  const arbCell=arbRow.children[1];
  // Exclude only excel from aggregated mid/arb calculations
  const active = Object.values(boardData).filter(r=> r.broker!=='excel' && !r.frozen && Array.isArray(r.odds) && r.odds.length===2 && r.odds.every(o=>!isNaN(parseFloat(o))));
  if (!active.length){
    midCell.textContent='-'; arbCell.textContent='-';
    try { window.__boardDerived = { hasMid:false, arbProfitPct:null }; } catch(_){ }
    return;
  }
  const s1=active.map(r=>{
    const isS = swapped.has(r.broker);
    return parseFloat(isS ? r.odds[1] : r.odds[0]);
  });
  const s2=active.map(r=>{
    const isS = swapped.has(r.broker);
    return parseFloat(isS ? r.odds[0] : r.odds[1]);
  });
  // IMPORTANT: Mid is defined as the midpoint between the lowest and highest odds only
  // (NOT the average of all books). This matches product requirement #1.
  const mid1=(Math.min(...s1)+Math.max(...s1))/2; const mid2=(Math.min(...s2)+Math.max(...s2))/2;
  const over=1/Math.max(...s1)+1/Math.max(...s2);
  midCell.textContent=`${mid1.toFixed(2)} / ${mid2.toFixed(2)}`;
  arbCell.classList.remove('arb-positive','arb-negative');
  if (over < 1) {
    const profitPct = (1 - over) * 100;
    arbCell.textContent = profitPct.toFixed(2) + '%';
    arbCell.classList.add('arb-positive');
    try { window.__boardDerived = { hasMid:true, arbProfitPct: profitPct }; } catch(_){ }
  } else {
    arbCell.textContent = '—';
    try { window.__boardDerived = { hasMid:true, arbProfitPct: 0 }; } catch(_){ }
  }
}


function renderBoard(){
  const tb = document.getElementById('rows');
  if(!tb) return;
  const excelRow = document.getElementById('excelRow');
  const excelRecord = boardData['excel'];
  const vals=Object.values(boardData).filter(r=>r.broker!=='excel').sort((a,b)=> a.broker.localeCompare(b.broker));
  if(OddsBoardShared && OddsBoardShared.buildRowsHtml){
    const out = OddsBoardShared.buildRowsHtml(vals, { variant:'board', isSwapped: (b)=> swapped.has(b) });
    tb.innerHTML = out.html;
  } else {
    // Fallback (legacy inline renderer)
    const liveVals = vals.filter(r=>!r.frozen && Array.isArray(r.odds) && r.odds.length===2);
    const parsed1=liveVals.map(r=>parseFloat(swapped.has(r.broker) ? r.odds[1] : r.odds[0])).filter(n=>!isNaN(n));
    const parsed2=liveVals.map(r=>parseFloat(swapped.has(r.broker) ? r.odds[0] : r.odds[1])).filter(n=>!isNaN(n));
    const best1=parsed1.length?Math.max(...parsed1):NaN;
    const best2=parsed2.length?Math.max(...parsed2):NaN;
    tb.innerHTML = vals.map(r=>{
      const isSwapped = swapped.has(r.broker);
      const d1 = isSwapped ? r.odds?.[1] : r.odds?.[0];
      const d2 = isSwapped ? r.odds?.[0] : r.odds?.[1];
      const o1=parseFloat(d1);
      const o2=parseFloat(d2);
      const bestCls1 = (!r.frozen && o1===best1)?'best':'';
      const bestCls2 = (!r.frozen && o2===best2)?'best':'';
      const frozenCls = r.frozen ? 'frozen' : '';
      return `<tr><td><div class="brokerCell"><span class="bName" title="${r.broker}">${r.broker}</span><button class="swapBtn ${isSwapped?'on':''}" data-broker="${r.broker}" title="Swap sides">⇄</button></div></td>`+
            `<td class="${bestCls1} ${frozenCls}">${d1}</td>`+
            `<td class="${bestCls2} ${frozenCls}">${d2}</td></tr>`;
    }).join('');
  }
  // Update Excel row
  if(excelRow){
    const valSpan = document.getElementById('excelOddsVal');
    const statusSpan = document.getElementById('excelStatusCell');
    if(excelRecord && Array.isArray(excelRecord.odds)){
      const o1=excelRecord.odds[0];
      const o2=excelRecord.odds[1];
      if(valSpan) valSpan.textContent = `${o1} / ${o2}`; else excelRow.children[1].textContent = `${o1} / ${o2}`;
      // Show suspension only on odds cell, not the whole Excel row
      try {
        const oddsCell = excelRow.querySelector('td');
        if(oddsCell){ oddsCell.classList.toggle('frozen', !!excelRecord.frozen); }
      } catch(_){ }
    } else {
      if(valSpan) valSpan.textContent='-'; else excelRow.children[1].textContent='-';
      try { const oddsCell = excelRow.querySelector('td'); if(oddsCell){ oddsCell.classList.remove('frozen'); } } catch(_){ }
    }
    if(statusSpan && statusSpan.dataset.last==='idle'){ statusSpan.style.display='none'; }
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

if(window.desktopAPI){
  // Excel extractor log bridging
  try { window.desktopAPI.onExcelLog && window.desktopAPI.onExcelLog(payload=>{ try { if(payload && payload.msg) console.log('[excel-extractor][bridge]', payload.msg); } catch(_){ } }); } catch(_){ }
  // Mirror auto ON/OFF from other views to update visuals promptly
  try {
    if(window.desktopAPI && window.desktopAPI.onAutoSetAll){ window.desktopAPI.onAutoSetAll(()=>{ try { refreshAutoButtonsVisual && refreshAutoButtonsVisual(); } catch(_){ } }); }
    if(window.desktopAPI && window.desktopAPI.onAutoToggleAll){ window.desktopAPI.onAutoToggleAll(()=>{ try { refreshAutoButtonsVisual && refreshAutoButtonsVisual(); } catch(_){ } }); }
    if(window.desktopAPI && window.desktopAPI.onAutoActiveSet){ window.desktopAPI.onAutoActiveSet(()=>{ try { refreshAutoButtonsVisual && refreshAutoButtonsVisual(); } catch(_){ } }); }
    if(window.desktopAPI && window.desktopAPI.onAutoResumeSet){ window.desktopAPI.onAutoResumeSet(()=>{ try { refreshAutoButtonsVisual && refreshAutoButtonsVisual(); } catch(_){ } }); }
  } catch(_){ }
  window.desktopAPI.onBrokerClosed && window.desktopAPI.onBrokerClosed((id)=>{ if (boardData[id]) { delete boardData[id]; renderBoard(); }});
  window.desktopAPI.onBrokersSync && window.desktopAPI.onBrokersSync((ids)=>{
    const set = new Set(ids);
    Object.keys(boardData).forEach(k=>{ if(!set.has(k)) delete boardData[k]; });
    renderBoard();
  });
  // Fallback to raw IPC if desktopAPI does not provide broker events
  try {
    const { ipcRenderer } = require('electron');
    if(ipcRenderer){
      if(!window.desktopAPI.onBrokerClosed){
        ipcRenderer.on('broker-closed', (_e,p)=>{ try { const id=p&&p.id; if(id && boardData[id]){ delete boardData[id]; renderBoard(); } } catch(_){ } });
      }
      if(!window.desktopAPI.onBrokersSync){
        ipcRenderer.on('brokers-sync', (_e,p)=>{ try { const ids=(p&&p.ids)||[]; const set=new Set(ids); Object.keys(boardData).forEach(k=>{ if(!set.has(k)) delete boardData[k]; }); renderBoard(); } catch(_){ } });
      }
    }
  } catch(_){ }
  // Excel extractor status updates (mirror embedded panel UI)
  try {
    // Small ephemeral toast near the S button
    let excelTogglePendingTs = 0;
    let lastStatusSig = '';
    let lastAutoToastTs = 0;
    let lastHoverLines = null;
    let lastHoverKind = 'ok';
    
    // Use shared toast utility
    const showToast = MiniToast ? MiniToast.showMiniToastNear : function(el, lines, kind){
      // Minimal inline fallback if module not loaded
      try {
        const toast = document.createElement('div');
        toast.className = 'miniToast ' + (kind||'');
        (lines||[]).forEach(t=>{ const s=document.createElement('span'); s.className='line'; s.textContent=t; toast.appendChild(s); });
        document.body.appendChild(toast);
        const r = el.getBoundingClientRect();
        toast.style.left = Math.min(Math.max(8, r.left), window.innerWidth - 300) + 'px';
        toast.style.top = (r.bottom + 8) + 'px';
        requestAnimationFrame(()=> toast.classList.add('show'));
        const ttl = kind==='err' ? 3800 : 2200;
        setTimeout(()=>{ try { toast.remove(); } catch(_){} }, ttl + 260);
      } catch(_){ }
    };

    // Bind S button click to toggle the Python extractor
    try {
      const sBtn = document.getElementById('excelScriptBtn');
      if(sBtn && !sBtn.dataset.bound){
        sBtn.dataset.bound = '1';
        sBtn.addEventListener('click', ()=>{
          excelTogglePendingTs = Date.now();
          try { window.desktopAPI.excelScriptToggle && window.desktopAPI.excelScriptToggle(); } catch(_){ }
        });
        // Hover tooltip: show current status near the button
        sBtn.addEventListener('mouseenter', ()=>{
          try {
            if(lastHoverLines && lastHoverLines.length){
              showToast(sBtn, lastHoverLines, lastHoverKind);
            }
          } catch(_){ }
        });
      }
    } catch(_){ }
    if(window.desktopAPI.onExcelExtractorStatus){
      window.desktopAPI.onExcelExtractorStatus(s=>{
        try {
          const statusEl=document.getElementById('excelStatusCell');
          const btn=document.getElementById('excelScriptBtn');
          if(btn) btn.classList.toggle('on', !!s.running);
          if(statusEl){
            let text='';
            if(s.installing) text='installing...';
            else if(s.starting) text='starting';
            else if(s.running) text='running';
            else if(s.error) text='error';
            else text='idle';
            statusEl.dataset.last=text;
            if(text==='idle'){ statusEl.style.display='none'; statusEl.textContent='idle'; }
            else { statusEl.style.display='inline'; statusEl.textContent=text; }
          }

          const pyOn = !!s.running;
          const ahkOn = !!(s.ahk && s.ahk.running);
          const pyErr = s.error ? String(s.error) : '';
          const ahkErr = (s.ahk && s.ahk.error) ? String(s.ahk.error) : '';
          const lines = [
            'Python: ' + (pyOn ? 'ON' : 'OFF') + (pyErr ? ' ('+pyErr+')' : ''),
            'AHK: ' + (ahkOn ? 'ON' : 'OFF') + (ahkErr ? ' ('+ahkErr+')' : '')
          ];
          const kind = (pyErr || ahkErr) ? 'err' : 'ok';
          lastHoverLines = lines;
          lastHoverKind = kind;
          // Intentionally no native tooltip (title). Status is shown via miniToast only.

          // If user just clicked the toggle, show a compact status popup near the button
          if(btn && excelTogglePendingTs && (Date.now() - excelTogglePendingTs) < 1800){
            showToast(btn, lines, kind);
            excelTogglePendingTs = 0;
          }

          // Also show the same toast when toggled via hotkeys (status transition), to match click UX.
          if(btn && !excelTogglePendingTs){
            const sig = [
              s.installing ? 'I' : '',
              s.starting ? 'S' : '',
              s.running ? 'R' : '',
              pyErr ? ('E:'+pyErr) : '',
              ahkOn ? 'A' : '',
              ahkErr ? ('AE:'+ahkErr) : ''
            ].join('|');
            const changed = !!lastStatusSig && sig !== lastStatusSig;
            const important = !!(s.starting || s.running || pyErr || ahkErr);
            const now = Date.now();
            if(changed && important && (now - lastAutoToastTs) > 1200){
              showToast(btn, lines, kind);
              lastAutoToastTs = now;
            }
            lastStatusSig = sig;
          }
        } catch(_){ }
      });
      // Initial fetch if API supports
      if(window.desktopAPI.getExcelExtractorStatus){
        window.desktopAPI.getExcelExtractorStatus().then(s=>{
          try {
            const statusEl=document.getElementById('excelStatusCell');
            const btn=document.getElementById('excelScriptBtn');
            if(btn) btn.classList.toggle('on', !!(s && s.running));
            if(statusEl && s){
              let text='';
              if(s.installing) text='installing...';
              else if(s.starting) text='starting';
              else if(s.running) text='running';
              else if(s.error) text='error';
              else text='idle';
              statusEl.dataset.last=text;
              if(text==='idle'){ statusEl.style.display='none'; statusEl.textContent='idle'; }
              else { statusEl.style.display='inline'; statusEl.textContent=text; }
            }

            // Intentionally no native tooltip (title). Status is shown via miniToast only.
          } catch(_){ }
        }).catch(()=>{});
      }
    }
  } catch(_){ }
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
      }
    }
  } catch(e) {}
}

// --- isLast flag support ---
let isLastFlag = false;
async function restoreIsLast(){
  try {
    if(!window.desktopAPI || !window.desktopAPI.getIsLast) return;
    const val = await window.desktopAPI.getIsLast();
    isLastFlag = !!val;
    const chk=document.getElementById('isLastChk');
    if(chk) chk.checked = isLastFlag;
  } catch(_){}
}
document.getElementById('isLastChk')?.addEventListener('change', e=>{
  try {
    const v=!!e.target.checked; isLastFlag=v;
    if(window.desktopAPI && window.desktopAPI.setIsLast){ window.desktopAPI.setIsLast(v); }
  } catch(_){ }
});
if(window.desktopAPI && window.desktopAPI.onIsLast){
  window.desktopAPI.onIsLast(v=>{ try { isLastFlag=!!v; const chk=document.getElementById('isLastChk'); if(chk) chk.checked=isLastFlag; } catch(_){ } });
}

document.getElementById('mapSelect')?.addEventListener('change', e=>{
  if(!window.desktopAPI) return;
  const map=e.target.value;
  window.desktopAPI.setMap('*', map);
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

// Unified team names updater (used by both initial fetch and live updates)
function updateTeamHeaders(names){
  try {
    if(!names) return;
    const s1=document.getElementById('side1Header');
    const s2=document.getElementById('side2Header');
    if(s1 && names.team1) s1.textContent = names.team1;
    if(s2 && names.team2) s2.textContent = names.team2;
  } catch(_){ }
}

window.addEventListener('DOMContentLoaded', ()=>{
  // Initial sync from main for team names (new API)
  if(window.desktopAPI && window.desktopAPI.getTeamNames){
    window.desktopAPI.getTeamNames().then(updateTeamHeaders).catch(()=>{});
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

// Listen for team name updates pushed from main via dedicated API
if(window.desktopAPI && window.desktopAPI.onTeamNames){
  window.desktopAPI.onTeamNames(updateTeamHeaders);
}

// Visual state helpers for Auto/R buttons (kept for board UI)
function refreshAutoButtonsVisual(){
  try {
    const autoBtn = document.getElementById('autoBtn');
    const rBtn = document.getElementById('autoResumeBtn');
    const sim = window.__autoSim;
    if(autoBtn && sim){
      autoBtn.classList.toggle('on', !!sim.active);
      const paused = !sim.active && !!sim.userWanted && (sim.lastDisableReason && !/^manual/.test(sim.lastDisableReason));
      autoBtn.classList.toggle('paused', paused);
      autoBtn.classList.toggle('susp', !!sim.lastDisableReason && sim.lastDisableReason==='excel-suspended');
      autoBtn.title = paused ? `Auto paused (${sim.lastDisableReason||''})` : (sim.active? 'Auto: ON' : 'Auto: OFF');
    }
    if(rBtn && sim){ rBtn.classList.toggle('on', !!sim.autoResume); }
  } catch(_){ }
}
function flashDot(idx){
  const dot=document.querySelector('.autoDot.'+(idx===0?'side1':'side2'));
  const stepMs = (window.__autoSim && window.__autoSim.stepMs) ? window.__autoSim.stepMs : 500;
  if(dot){ dot.classList.add('active'); setTimeout(()=>dot.classList.remove('active'), stepMs-80); }
}

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

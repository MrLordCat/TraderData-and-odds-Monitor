// Extracted from inline script in board.html
(function(){
  function applyContrast(v){
    const c = Math.min(130, Math.max(70, Number(v)||100)) / 100;
    document.documentElement.style.setProperty('--contrast-mult', c);
  }
  if(window.desktopAPI){
    window.desktopAPI.onContrastPreview && window.desktopAPI.onContrastPreview(applyContrast);
    window.desktopAPI.onContrastSaved && window.desktopAPI.onContrastSaved(applyContrast);
    window.desktopAPI.getSetting && window.desktopAPI.getSetting('uiContrast').then(v=>{ if(v!=null) applyContrast(v); });
  }
})();

const boardData = {};
const swapped = new Set();
try { (JSON.parse(localStorage.getItem('swappedBrokers')||'[]')||[]).forEach(b=>swapped.add(b)); } catch(e) {}


function computeDerived(){
  const midRow = document.getElementById('midRow');
  const arbRow = document.getElementById('arbRow');
  if(!midRow || !arbRow) return;
  const midCell=midRow.children[1];
  const arbCell=arbRow.children[1];
  // Exclude dataservices from aggregated mid/arb calculations per requirement
  const active = Object.values(boardData).filter(r=> r.broker!=='dataservices' && !r.frozen && r.odds.every(o=>!isNaN(parseFloat(o))));
  if (!active.length){ midCell.textContent='-'; arbCell.textContent='-'; return; }
  const s1=active.map(r=>parseFloat(r.odds[0]));
  const s2=active.map(r=>parseFloat(r.odds[1]));
  const mid1=(Math.min(...s1)+Math.max(...s1))/2; const mid2=(Math.min(...s2)+Math.max(...s2))/2;
  const over=1/Math.max(...s1)+1/Math.max(...s2);
  midCell.textContent=`${mid1.toFixed(2)} / ${mid2.toFixed(2)}`;
  arbCell.classList.remove('arb-positive','arb-negative');
  if (over < 1) {
    const profitPct = (1 - over) * 100;
    arbCell.textContent = profitPct.toFixed(2) + '%';
    arbCell.classList.add('arb-positive');
  } else {
    arbCell.textContent = '—';
  }
}

function renderBoard(){
  const tb = document.getElementById('rows');
  if(!tb) return;
  const excelRow = document.getElementById('excelRow');
  const excelRecord = boardData['dataservices'];
  // Filter out dataservices from main list
  const vals=Object.values(boardData).filter(r=>r.broker!=='dataservices').sort((a,b)=> a.broker.localeCompare(b.broker));
  // Best values consider only non-frozen brokers
  const liveVals = vals.filter(r=>!r.frozen);
  const parsed1=liveVals.map(r=>parseFloat(r.odds[0])).filter(n=>!isNaN(n));
  const parsed2=liveVals.map(r=>parseFloat(r.odds[1])).filter(n=>!isNaN(n));
  const best1=parsed1.length?Math.max(...parsed1):NaN;
  const best2=parsed2.length?Math.max(...parsed2):NaN;
  tb.innerHTML = vals.map(r=>{
    const o1=parseFloat(r.odds[0]);
    const o2=parseFloat(r.odds[1]);
    const isSwapped = swapped.has(r.broker);
    const bestCls1 = (!r.frozen && o1===best1)?'best':'';
    const bestCls2 = (!r.frozen && o2===best2)?'best':'';
    return `<tr class="${r.frozen?'frozen':''}"><td><div class="brokerCell"><span class="bName" title="${r.broker}">${r.broker}</span><button class="swapBtn ${isSwapped?'on':''}" data-broker="${r.broker}" title="Swap sides">⇄</button></div></td><td class="${bestCls1}">${r.odds[0]}</td><td class="${bestCls2}">${r.odds[1]}</td></tr>`;
  }).join('');
  // Update Excel row
  if(excelRow){
    if(excelRecord && Array.isArray(excelRecord.odds)){
      const o1=excelRecord.odds[0];
      const o2=excelRecord.odds[1];
      excelRow.children[1].textContent = `${o1} / ${o2}`;
      excelRow.classList.toggle('frozen', !!excelRecord.frozen);
    } else {
      excelRow.children[1].textContent='-';
      excelRow.classList.remove('frozen');
    }
  }
  computeDerived();
}

if(window.desktopAPI){
  window.desktopAPI.onOdds && window.desktopAPI.onOdds(p=>{ 
    if(swapped.has(p.broker) && Array.isArray(p.odds) && p.odds.length===2){ p = { ...p, odds:[p.odds[1], p.odds[0]] }; }
    boardData[p.broker]=p; 
    renderBoard(); 
  // Auto disable / resume for suspension (dataservices freeze) with autoResume flag
    try {
      if(p.broker==='dataservices'){
        if(p.frozen && window.__autoSim && window.__autoSim.active){
          window.__autoSim.active=false; clearTimeout(window.__autoSim.timer); window.__autoSim.timer=null;
          const btn=document.getElementById('autoBtn'); if(btn) btn.classList.remove('on');
          autoSim.lastDisableReason='excel-suspended';
          autoStatus('Auto OFF (excel suspended)');
          try { console.log('[autoSim][board][autoDisable] excel suspended -> auto OFF (intent', autoSim.userWanted? 'kept':'cleared', ') resumeAllowed', autoSim.autoResume); } catch(_){ }
          try { if(window.desktopAPI && window.desktopAPI.send){ window.desktopAPI.send('auto-mode-changed', { active:false, reason:'excel-suspended' }); } } catch(_){ }
        } else if(!p.frozen && window.__autoSim && !window.__autoSim.active && autoSim.userWanted && autoSim.lastDisableReason==='excel-suspended'){
          if(autoSim.autoResume){
            window.__autoSim.active=true; autoSim.lastDisableReason='excel-resumed';
            const btn=document.getElementById('autoBtn'); if(btn) btn.classList.add('on');
            autoStatus(`Resume (tol ${autoSim.tolerancePct.toFixed(2)}%)`);
            try { console.log('[autoSim][board][autoResume] excel resumed -> auto ON (autoResume=true)'); } catch(_){ }
            try { if(window.desktopAPI && window.desktopAPI.send){ window.desktopAPI.send('auto-mode-changed', { active:true, reason:'excel-resumed', tolerance:autoSim.tolerancePct }); } } catch(_){ }
            autoStep();
          } else {
            try { console.log('[autoSim][board][resume-blocked] excel resumed but autoResume=false'); } catch(_){ }
            autoStatus('Resume blocked (R off)');
          }
        }
      }
    } catch(_){ }
  });
  window.desktopAPI.onBrokerClosed && window.desktopAPI.onBrokerClosed((id)=>{ if (boardData[id]) { delete boardData[id]; renderBoard(); }});
  window.desktopAPI.onBrokersSync && window.desktopAPI.onBrokersSync((ids)=>{
    const set = new Set(ids);
    Object.keys(boardData).forEach(k=>{ if(!set.has(k)) delete boardData[k]; });
    ids.forEach(id=>{ if(!boardData[id]) boardData[id]={ broker:id, odds:['-','-'], frozen:true, ts:Date.now() }; });
    renderBoard();
  });
}

document.addEventListener('click', e=>{
  const btn = e.target.closest('.swapBtn');
  if(!btn) return;
  const broker = btn.getAttribute('data-broker');
  if(!broker) return;
  if(swapped.has(broker)) swapped.delete(broker); else swapped.add(broker);
  try { localStorage.setItem('swappedBrokers', JSON.stringify(Array.from(swapped))); } catch(e) {}
  const rec = boardData[broker];
  if(rec && Array.isArray(rec.odds) && rec.odds.length===2){ rec.odds = [rec.odds[1], rec.odds[0]]; }
  renderBoard();
});

function applyPersistedHeaders(){
  try {
    const s1 = localStorage.getItem('teamLabel1');
    const s2 = localStorage.getItem('teamLabel2');
    if (s1) document.getElementById('side1Header').textContent = s1;
    if (s2) document.getElementById('side2Header').textContent = s2;
  } catch(e) {}
}

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
      try { console.debug('[board] onMap received', v); } catch(_){ }
    } catch(_){ }
  });
}

window.addEventListener('DOMContentLoaded', ()=>{
  // Initial sync from main for team names (new API)
  if(window.desktopAPI && window.desktopAPI.getTeamNames){
    window.desktopAPI.getTeamNames().then(names=>{
      try {
        if(names){
          const s1=document.getElementById('side1Header');
          const s2=document.getElementById('side2Header');
          if(s1 && names.team1) s1.textContent = names.team1;
          if(s2 && names.team2) s2.textContent = names.team2;
        }
      } catch(_){ }
    }).catch(()=>{});
  }
  restoreMapAndBroadcast();
  // If external map arrived before DOM ready, enforce it now
  try { if(currentMapBoard!=null){ forceBoardMapSelect(currentMapBoard); } } catch(_){ }
});

// Remove manual editable headers; rely on synced names from stats panel.
// Listen for updates pushed from main via dedicated API.
if(window.desktopAPI && window.desktopAPI.onTeamNames){
  window.desktopAPI.onTeamNames((names)=>{
    try {
      if(!names) return;
      const s1=document.getElementById('side1Header');
      const s2=document.getElementById('side2Header');
      if(s1 && names.team1) s1.textContent = names.team1;
      if(s2 && names.team2) s2.textContent = names.team2;
    } catch(_){ }
  });
}

// Backward compatibility: if older localStorage labels exist, ignore them now.

// ================= Auto alignment helper (simulate button presses only – no virtual odds) =================
// We no longer create or apply any virtual Excel odds; we only observe current Excel values
// and indicate which side would be "pressed" toward the Mid reference until within tolerance.
try { console.log('[autoSim][startup] board.js loaded'); } catch(_){ }
// Heartbeat до первого включения, чтобы убедиться что лог трансляции работает
try {
  if(!window.__autoSimHeartbeat){
    window.__autoSimHeartbeat = true;
    let beats=0;
    const hb = ()=>{ if(window.__autoSim && window.__autoSim.active) return; try { console.log('[autoSim][hb] idle', ++beats); } catch(_){ } if(beats<6) setTimeout(hb, 4000); };
    setTimeout(hb, 3000);
  }
} catch(_){ }
const autoSim = { active:false, timer:null, stepMs:500, tolerancePct:0.15, lastMidKey:null, fireCooldownMs:900, lastFireTs:0, lastFireSide:null, lastFireKey:null, adaptive:true, waitingForExcel:false, waitToken:0, excelSnapshotKey:null, maxAdaptiveWaitMs:1600, userWanted:false, lastDisableReason:null, autoResume:true };
try { const ar = localStorage.getItem('autoResumeEnabled'); if(ar==='0') autoSim.autoResume=false; } catch(_){ }
try { const uw = localStorage.getItem('autoUserWanted'); if(uw==='1'){ autoSim.userWanted=true; } } catch(_){ }
// Load stored tolerance + interval + adaptive mode
try {
  if(window.desktopAPI && window.desktopAPI.invoke){
    window.desktopAPI.invoke('auto-tolerance-get').then(v=>{
      if(typeof v==='number' && !isNaN(v)) autoSim.tolerancePct = v;
      try { console.log('[autoSim][board] tolerance loaded', autoSim.tolerancePct); } catch(_){ }
    }).catch(()=>{});
    window.desktopAPI.invoke('auto-interval-get').then(v=>{ if(typeof v==='number' && !isNaN(v)){ autoSim.stepMs=v; try { console.log('[autoSim][board] interval loaded', v); } catch(_){ } } }).catch(()=>{});
    window.desktopAPI.invoke('auto-adaptive-get').then(v=>{ if(typeof v==='boolean'){ autoSim.adaptive=v; try { console.log('[autoSim][board] adaptive loaded', v); } catch(_){ } } }).catch(()=>{});
  } else if(window.ipcRenderer){
    window.ipcRenderer.invoke('auto-tolerance-get').then(v=>{ if(typeof v==='number') autoSim.tolerancePct=v; }).catch(()=>{});
  }
} catch(_){ }

function parsePairRow(id){
  const row=document.getElementById(id); if(!row) return null;
  const cell=row.children[1]; if(!cell) return null; const txt=(cell.textContent||'').trim();
  if(!/\d/.test(txt)) return null; const parts=txt.split('/').map(s=>parseFloat(s.trim())).filter(n=>!isNaN(n));
  return parts.length===2?parts:null;
}
function parseMid(){ return parsePairRow('midRow'); }
function parseExcel(){ return parsePairRow('excelRow'); }
// setExcelOdds previously mutated the visible Excel odds during simulation; removed from auto flow.
function setExcelOdds(n1,n2){ /* retained for future real integration but unused by auto simulation */ }
function autoStatus(msg){ const el=document.getElementById('autoStatus'); if(el) el.textContent=msg||''; }
function flashDot(idx){ const dot=document.querySelector('.autoDot.'+(idx===0?'side1':'side2')); if(dot){ dot.classList.add('active'); setTimeout(()=>dot.classList.remove('active'), autoSim.stepMs-80); } }
function scheduleAuto(delay){ if(!autoSim.active) return; clearTimeout(autoSim.timer); autoSim.timer=setTimeout(autoStep, typeof delay==='number'? delay: autoSim.stepMs); }
function autoStep(){
  if(!autoSim.active) return;
  const mid=parseMid(); const ex=parseExcel();
  if(!mid || !ex){ autoStatus('Нет данных'); return scheduleAuto(); }
  const key=mid.join('|'); if(autoSim.lastMidKey && autoSim.lastMidKey!==key){ autoStatus('Mid changed'); }
  autoSim.lastMidKey=key;
  // === Min-only alignment mode ===
  // Always align ONLY the side whose MID component is minimal.
  const sideToAdjust = (mid[0] <= mid[1]) ? 0 : 1;
  const diffPct = Math.abs(ex[sideToAdjust] - mid[sideToAdjust]) / mid[sideToAdjust] * 100;
  if(diffPct <= autoSim.tolerancePct){
    autoStatus('Aligned (min side)');
    try { console.log('[autoSim][step][min-only] aligned side', sideToAdjust, 'diff', diffPct.toFixed(3)); } catch(_){ }
    return scheduleAuto();
  }
  const needRaise = ex[sideToAdjust] < mid[sideToAdjust];
  // Mapping rule provided by user:
  // If working with first odds (side 0): raise -> F24, lower -> F23
  // If working with second odds (side 1): lower -> F24, raise -> F23
  let keyLabel;
  if(sideToAdjust===0){ keyLabel = needRaise ? 'F24' : 'F23'; }
  else { keyLabel = needRaise ? 'F23' : 'F24'; }
  const direction = needRaise ? 'raise' : 'lower';
  flashDot(sideToAdjust);
  autoStatus(`Align ${direction} S${sideToAdjust+1} ${diffPct.toFixed(2)}% (min)`);
  try { console.log('[autoSim][step][min-only] fireCandidate side', sideToAdjust, direction, 'diff%', diffPct.toFixed(3), 'key', keyLabel); } catch(_){ }
  // Emit IPC trace for main process logging
  try {
    if(window.desktopAPI && window.desktopAPI.send){ window.desktopAPI.send('auto-fire-attempt', { side: sideToAdjust, diffPct, direction, key: keyLabel }); }
  } catch(_){ }
  // Burst logic: number of directional pulses before single confirm (F22)
  // thresholds: >=15% -> 4, >=7% -> 3, >=5% -> 2, else 1
  let pulses = 1;
  if(diffPct >= 15) pulses = 4; else if(diffPct >= 7) pulses = 3; else if(diffPct >= 5) pulses = 2;
  try { console.log('[autoSim][burst] diff', diffPct.toFixed(3), 'pulses', pulses); } catch(_){ }
  // Cooldown gating applies to the start of a burst
  try {
    const now = Date.now();
    if(now - autoSim.lastFireTs < autoSim.fireCooldownMs && autoSim.lastFireSide === sideToAdjust && autoSim.lastFireKey === keyLabel){
      // still cooling down
      return scheduleAuto();
    }
    autoSim.lastFireTs = now;
    autoSim.lastFireSide = sideToAdjust;
    autoSim.lastFireKey = keyLabel;
    const sendDirectional = (i)=>{
      try {
        if(window.desktopAPI && typeof window.desktopAPI.invoke==='function'){
          window.desktopAPI.invoke('send-auto-press', { side: sideToAdjust, key: keyLabel, direction, diffPct, noConfirm:true });
        } else if(window.desktopAPI && window.desktopAPI.autoSendPress){
          window.desktopAPI.autoSendPress({ side: sideToAdjust, key: keyLabel, direction, diffPct, noConfirm:true });
        }
        try { console.log('[autoSim][burst] directional', i+1,'/',pulses,keyLabel); } catch(_){ }
      } catch(_){ }
    };
    for(let i=0;i<pulses;i++){
      const delay = i===0? 0 : 55*i; // 55ms spacing
      setTimeout(()=>sendDirectional(i), delay);
    }
    // Schedule confirm F22 after last directional (add 100ms slack)
    const confirmDelay = 55*(pulses-1) + 100;
    setTimeout(()=>{
      try {
        if(window.desktopAPI && typeof window.desktopAPI.invoke==='function'){
          window.desktopAPI.invoke('send-auto-press', { side: sideToAdjust, key: 'F22', direction, diffPct, noConfirm:true });
        } else if(window.desktopAPI && window.desktopAPI.autoSendPress){
          window.desktopAPI.autoSendPress({ side: sideToAdjust, key: 'F22', direction, diffPct, noConfirm:true });
        }
        try { console.log('[autoSim][burst] confirm F22 after', confirmDelay,'ms'); } catch(_){ }
      } catch(_){ }
    }, confirmDelay);
  } catch(_){ }
  // Adaptive mode: after a fire we pause until Excel odds change or timeout; if still misaligned we continue.
  if(autoSim.adaptive){
    autoSim.waitingForExcel=true; autoSim.excelSnapshotKey = (ex[0]+'|'+ex[1]);
    const myToken=++autoSim.waitToken;
    const startTs=Date.now();
    const checkLoop=()=>{
      if(!autoSim.active || !autoSim.waitingForExcel || myToken!==autoSim.waitToken) return;
      const cur = parseExcel();
      if(cur){
        const keyCur = cur[0]+'|'+cur[1];
        if(keyCur !== autoSim.excelSnapshotKey){
          autoSim.waitingForExcel=false;
          try { console.log('[autoSim][adaptive][resume] excelChanged', keyCur); } catch(_){ }
          return scheduleAuto(40); // quick re-eval soon after change
        }
      }
      if(Date.now()-startTs >= autoSim.maxAdaptiveWaitMs){
        autoSim.waitingForExcel=false;
        try { console.log('[autoSim][adaptive][timeout] resume after', Date.now()-startTs); } catch(_){ }
        return scheduleAuto();
      }
      setTimeout(checkLoop, 120);
    };
    setTimeout(checkLoop, 140);
  } else {
    scheduleAuto();
  }
}
function toggleAuto(){
  const newState = !autoSim.active;
  autoSim.active=newState;
  const btn=document.getElementById('autoBtn'); if(btn) btn.classList.toggle('on', autoSim.active);
  const row=document.getElementById('excelAutoRow'); if(row) row.style.display=autoSim.active? '' : 'none';
  autoStatus(autoSim.active? `Start (tol ${autoSim.tolerancePct.toFixed(2)}%)` : 'Stopped');
  try { console.log('[autoSim][toggle]', autoSim.active? 'ON':'OFF', 'tol', autoSim.tolerancePct); } catch(_){ }
  try {
    if(autoSim.active){ autoSim.userWanted=true; autoSim.lastDisableReason=null; localStorage.setItem('autoUserWanted','1'); }
    else { autoSim.userWanted=false; autoSim.lastDisableReason='manual'; localStorage.setItem('autoUserWanted','0'); }
  } catch(_){ }
  // Notify main for centralized logging
  try {
    if(window.desktopAPI && window.desktopAPI.send){ window.desktopAPI.send('auto-mode-changed', { active: autoSim.active, tolerance: autoSim.tolerancePct }); }
  } catch(_){ }
  if(autoSim.active){ autoStep(); } else { clearTimeout(autoSim.timer); autoSim.timer=null; }
}
document.addEventListener('click', e=>{
  if(e.target && e.target.id==='autoBtn'){ toggleAuto(); }
  if(e.target && e.target.id==='autoResumeBtn'){
    autoSim.autoResume = !autoSim.autoResume;
    try { localStorage.setItem('autoResumeEnabled', autoSim.autoResume? '1':'0'); } catch(_){ }
    e.target.classList.toggle('on', autoSim.autoResume);
    try { console.log('[autoSim][board][autoResumeFlag]', autoSim.autoResume); } catch(_){ }
    if(!autoSim.autoResume && autoSim.lastDisableReason==='excel-suspended'){
      autoStatus('Auto resume disabled');
    }
  }
});
window.addEventListener('DOMContentLoaded', ()=>{ try { const b=document.getElementById('autoResumeBtn'); if(b) b.classList.toggle('on', autoSim.autoResume); } catch(_){ } });
window.__autoSim = autoSim;

// Live update tolerance when settings saved
try {
  const subscribe = ()=>{
    if(window.desktopAPI && window.desktopAPI.send){ /* marker that bridge exists */ }
    try {
      // Use legacy window.require fallback only if available (shouldn't in production)
      if(window.desktopAPI && window.desktopAPI.send){
        // Attach once via ipcRenderer through hidden reference
        const { ipcRenderer } = require ? require('electron') : {};
        if(ipcRenderer && !subscribe.__attached){
          subscribe.__attached=true;
          ipcRenderer.on('auto-tolerance-updated', (_e, v)=>{
            if(typeof v==='number' && !isNaN(v)){
              autoSim.tolerancePct = v;
              try { console.log('[autoSim][board] tolerance updated ->', v); } catch(_){ }
              if(autoSim.active){ autoStatus(`Tol ${autoSim.tolerancePct.toFixed(2)}%`); }
            }
          });
          ipcRenderer.on('auto-interval-updated', (_e, v)=>{
            if(typeof v==='number' && !isNaN(v)){
              autoSim.stepMs=v;
              try { console.log('[autoSim][board] interval updated ->', v); } catch(_){ }
            }
          });
          ipcRenderer.on('auto-adaptive-updated', (_e, v)=>{
            if(typeof v==='boolean'){
              autoSim.adaptive=v;
              try { console.log('[autoSim][board] adaptive updated ->', v); } catch(_){ }
            }
          });
        }
      }
    } catch(_){ }
  };
  subscribe();
} catch(_){ }

// Listen for global auto disable broadcast
try {
  const { ipcRenderer } = window.require? window.require('electron'): {};
  if(ipcRenderer){
    ipcRenderer.on('auto-disable-all', ()=>{
      try {
        if(autoSim.active){
          autoSim.active=false; clearTimeout(autoSim.timer); autoSim.timer=null;
          const btn=document.getElementById('autoBtn'); if(btn) btn.classList.remove('on');
          autoStatus('Auto OFF (Alt+C)');
          autoSim.userWanted=false; autoSim.lastDisableReason='manual-global';
          try { localStorage.setItem('autoUserWanted','0'); } catch(_){ }
          try { console.log('[autoSim][board][autoDisable] Alt+C global -> OFF (intent cleared)'); } catch(_){ }
        }
      } catch(_){ }
    });
  }
} catch(_){ }

// Local keydown fallback (if focus inside board view)
try {
  window.addEventListener('keydown', e=>{
    try {
      if(e.code==='KeyC' && e.altKey){
        if(autoSim.active){
          autoSim.active=false; clearTimeout(autoSim.timer); autoSim.timer=null;
          const btn=document.getElementById('autoBtn'); if(btn) btn.classList.remove('on');
          autoStatus('Auto OFF (Alt+C local)');
          autoSim.userWanted=false; autoSim.lastDisableReason='manual-local';
          try { localStorage.setItem('autoUserWanted','0'); } catch(_){ }
          try { console.log('[autoSim][board][autoDisable] Alt+C local -> OFF (intent cleared)'); } catch(_){ }
        }
      }
    } catch(_){ }
  });
} catch(_){ }

// === External manual auto press (gamepad/AHK) ===
try {
  const { ipcRenderer } = window.require? window.require('electron'): {};
  if(ipcRenderer){
    ipcRenderer.on('auto-press', (_e, payload)=>{
      try {
        if(!payload || typeof payload.side==='undefined') return;
        const side = payload.side===1?1:0;
        flashDot(side);
        // Optional: if autoSim inactive we still show a transient status
        if(!autoSim.active){
          autoStatus('Manual '+ (side===0?'S1':'S2'));
        }
      } catch(_){ }
    });
  }
} catch(_){ }

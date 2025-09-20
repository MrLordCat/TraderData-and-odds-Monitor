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

// Core stats logic (theme & embedded odds handled in separate modules)
// Guard against double execution (e.g., accidental multiple script tags or hot reload) causing 'ipcRenderer already declared'
if(!window.__statsPanelBootstrapped){ window.__statsPanelBootstrapped = true; }
let ipcRenderer = window.ipcRenderer; // reuse if already present
if(!ipcRenderer){
  try { ipcRenderer = require('electron').ipcRenderer; window.ipcRenderer = ipcRenderer; } catch(e){ /* fallback placeholder */ }
}
try { console.log('[stats_panel] script start (boot=' + (window.__statsPanelBootstrapped) + ')'); } catch(_){ }
if(!ipcRenderer){
  // If preload/nodeIntegration unexpectedly off, attach minimal shim so later code won't crash
  window.ipcRenderer = ipcRenderer = { send: ()=>{}, on: ()=>{}, invoke: async()=>{} };
}
let activityModule = (window.__activityModule)||null; if(!activityModule){ try { activityModule = require('./stats_activity'); } catch(_){ } }
function send(ch,p){ ipcRenderer.send(ch,p); }

// (Removed) Capture Data prototype wiring – feature deprecated.

// (Theme logic moved to stats_theme.js)

// ================= Runtime State =================
let metricVisibility = {}; // runtime copy controlling row visibility
const BINARY_METRICS = ['firstKill','race5','race10','race15','race20','firstTower','firstInhibitor','firstBaron','quadra','penta','atakhan','winner'];
const COUNT_METRICS = ['killCount','towerCount','inhibitorCount','baronCount','dragonCount'];
let prevMatchUrls = { A: null, B: null };
let followLatestLiveGame = true;
let lastLiveGamesSig = '';
const customTeamNames = { 1:null, 2:null }; // custom display names (live)
let metricsOrder = ['netWorth','atakhan','firstKill','firstTower','firstBaron','firstInhibitor','race5','race10','race15','race20','killCount','towerCount','inhibitorCount','baronCount','dragonCount','dragonOrders','quadra','penta','winner'];
let metricsOrderMutable = [...metricsOrder];
const metricLabels = { firstKill:'First Blood', killCount:'Kills', race5:'Race 5', race10:'Race 10', race15:'Race 15', race20:'Race 20', firstTower:'First Tower', firstInhibitor:'First Inhib', firstBaron:'First Baron', towerCount:'Towers', inhibitorCount:'Inhibitors', baronCount:'Barons', dragonCount:'Dragons', dragonOrders:'Dragon Orders', netWorth:'Net Worth', quadra:'Quadra', penta:'Penta', atakhan:'Atakhan', winner:'Winner' };
let lastOrderSig = null;
let __prevValues = {}; // cell previous values
let lastGameRendered = null;
const firstEventFlags = {}; // legacy safety (used for initial value flags)
const animTimers = { delete: ()=>{}, get: ()=>null, set: ()=>{} }; // inert placeholder
let liveDataset = null, cachedLive = null, currentLiveGame = null, currentGame = null; // game selection
let swapTeams = false; // manual mode swap
// Manual mode data
let manualData = { team1Name:'Team 1', team2Name:'Team 2', gameStats: { '1': makeEmptyGame() } };

// ================= Team Header Utilities =================
function setTeamHeader(idx, rawText){
  const th = document.getElementById(idx===1? 'lt-team1':'lt-team2');
  if(!th) return;
  // Ensure wrapper exists (in case of dynamic rebuild)
  let wrap = th.querySelector('.teamNameWrap');
  if(!wrap){
    wrap=document.createElement('span');
    wrap.className='teamNameWrap';
    wrap.dataset.team=String(idx);
    th.textContent='';
    th.appendChild(wrap);
  }
  // Ensure unified rename handler is bound once on wrapper (works in both manual & live modes)
  if(!wrap.dataset.renameBound){
    wrap.dataset.renameBound='1';
    wrap.addEventListener('dblclick', ()=> handleTeamHeaderDblClick(idx));
  }
  const text = (rawText||'').trim() || ('Team '+idx);
  if(wrap.textContent === text) return; // no change
  wrap.textContent = text;
  wrap.title = text; // tooltip full name
  // Broadcast both team names to main so board can sync (debounced minimal overhead)
  try {
    const t1 = document.querySelector('#lt-team1 .teamNameWrap')?.textContent || 'Team 1';
    const t2 = document.querySelector('#lt-team2 .teamNameWrap')?.textContent || 'Team 2';
    ipcRenderer.send('lol-team-names-set', { team1: t1, team2: t2 });
  } catch(_){ }
}

function makeEmptyGame(){
  return { firstKill:null, firstKillAt:'', killCount:{}, race5:null,race5At:'', race10:null,race10At:'', race15:null,race15At:'', race20:null,race20At:'', firstTower:null, firstTowerAt:'', firstInhibitor:null, firstInhibitorAt:'', firstBaron:null, firstBaronAt:'', towerCount:{}, inhibitorCount:{}, baronCount:{}, dragonCount:{}, dragonOrders:{}, dragonOrderSequence:[], netWorth:{}, quadra:null, quadraAt:'', penta:null, pentaAt:'', atakhan:null, atakhanAt:'' };
}

function manualSnapshotCurrent(){
  const clone = JSON.parse(JSON.stringify(manualData));
  const base = clone.gameStats[currentGame || '1'] || makeEmptyGame();
  const gs = JSON.parse(JSON.stringify(base));
  const t1=[]; const t2=[];
  (gs.dragonOrderSequence||[]).forEach((team,i)=>{ const n=i+1; if(team===clone.team1Name) t1.push(n); else if(team===clone.team2Name) t2.push(n); });
  // Ensure dragonOrders bucket exists (live-derived snapshots may lack it)
  gs.dragonOrders = gs.dragonOrders || {};
  gs.dragonOrders[clone.team1Name]=t1; gs.dragonOrders[clone.team2Name]=t2;
  return { team1Name: clone.team1Name, team2Name: clone.team2Name, gameStats:{ [currentGame||'1']: gs } };
}

function renderManual(){ renderLol(manualSnapshotCurrent(), true); renderMap(); applyWinLose(); }

function renameTeam(idx){ const cur = idx===1? manualData.team1Name: manualData.team2Name; const v = prompt('Team name', cur)||cur; if(v===cur) return; renameTeamInternal(idx,v); }
function renameTeamInternal(idx,v){ const cur = idx===1? manualData.team1Name: manualData.team2Name; const old=cur; if(idx===1) manualData.team1Name=v; else manualData.team2Name=v; Object.values(manualData.gameStats).forEach(gs=>{ ['killCount','towerCount','inhibitorCount','baronCount','dragonCount','dragonTimes','netWorth'].forEach(f=>{ const bucket=gs[f]; if(!bucket) return; if(bucket[old]!=null){ bucket[v]=bucket[old]; delete bucket[old]; } }); if(gs.firstKill===old) gs.firstKill=v; ['race5','race10','race15','race20','firstTower','firstInhibitor','firstBaron','atakhan','quadra','penta','winner'].forEach(b=>{ if(gs[b]===old) gs[b]=v; }); }); renderManual(); }
// Unified header double‑click logic (manual inline edit vs live prompt override)
function handleTeamHeaderDblClick(idx){
  try {
    const manualOn = document.getElementById('lolManualMode').checked;
    // Inline rename in BOTH modes now
    startInlineRenameUnified(idx, manualOn);
  } catch(_){ }
}

// Unified inline rename for both live & manual modes
function startInlineRenameUnified(idx, manualOn){
  const th = document.getElementById(idx===1?'lt-team1':'lt-team2'); if(!th) return;
  // Determine current value
  let current;
  if(manualOn){
    current = (idx===1? manualData.team1Name : manualData.team2Name) || ('Team '+idx);
  } else {
    // live mode display (custom override if set else header span text)
    current = customTeamNames[idx] || (th.querySelector('.teamNameWrap')?.textContent || ('Team '+idx));
  }
  const input=document.createElement('input');
  input.type='text';
  input.value=current;
  input.style.cssText='width:100%;background:rgba(255,255,255,0.06);border:1px solid #345;padding:2px 4px;color:#fff;font:inherit;text-align:center;border-radius:4px;';
  th.innerHTML='';
  th.appendChild(input);
  input.focus();
  input.select();
  let finished=false; // guard to prevent duplicate commit
  const commit=()=>{
    if(finished) return; finished=true;
    const rawVal=input.value.trim();
    if(manualOn){
      const final = rawVal || current; // don't allow empty manual names
      renameTeamInternal(idx, final);
      // Immediate visual replacement (in case renderManual async / delayed)
      try { setTeamHeader(idx, final, false); } catch(_){ }
    } else {
      let finalDisplay;
      if(!rawVal){
        customTeamNames[idx]=null; // clear override
        finalDisplay = (th.querySelector('.teamNameWrap')?.textContent) || ('Team '+idx); // fallback to current live name
      } else {
        customTeamNames[idx]=rawVal;
        finalDisplay = rawVal;
      }
      // Immediate header update BEFORE any heavy re-render so input disappears instantly
  try { setTeamHeader(idx, finalDisplay, false); } catch(_){ }
      // Now trigger full render to ensure consistency with dataset
      try {
        if(liveDataset) renderLol(liveDataset); else setTeamHeader(idx, finalDisplay, false);
      } catch(_){ }
    }
    // Post commit verification (next tick)
    setTimeout(()=>{
      try {
        const still = !!th.querySelector('input');
        if(still){
          // Failsafe: force header again
            const fallback = customTeamNames[idx] || current || ('Team '+idx);
            setTeamHeader(idx, fallback, false);
        }
      } catch(_){ }
    },0);
  };
  const cancel=()=>{
    if(finished) return; finished=true;
    if(manualOn){
      renderManual();
    } else {
      if(liveDataset) renderLol(liveDataset); else setTeamHeader(idx, customTeamNames[idx] || current, false);
    }
  };
  input.addEventListener('keydown', e=>{
    if(e.key==='Enter') commit();
    else if(e.key==='Escape') cancel();
  });
  input.addEventListener('blur', ()=>{ commit(); });
}

function applyRaceFromKills(gs){ const bucket = gs.killCount||{}; [ ['race5',5], ['race10',10], ['race15',15], ['race20',20] ].forEach(([key,n])=>{ if(!gs[key]){ const t1=bucket[manualData.team1Name]||0; const t2=bucket[manualData.team2Name]||0; if(t1===n || t2===n) gs[key]= t1===n? manualData.team1Name: manualData.team2Name; } }); }

function handleManualClick(metric, side){
  const g = manualData.gameStats[currentGame]; if(!g) return;
  const team = side==='t1'? manualData.team1Name: manualData.team2Name;
  if(BINARY_METRICS.includes(metric)){
    if(!g[metric]) g[metric]=team; else if(g[metric]!==team) g[metric]=team;
  }
  else if(COUNT_METRICS.includes(metric)){
    const bucket=g[metric] ||= {};
    bucket[team]=(bucket[team]||0)+1;
    if(metric==='killCount') applyRaceFromKills(g);
  }
  else if(metric==='dragonCount'){
    // Increment team dragon count and append to order sequence (used to derive Dragon Orders row)
    const bucket=g.dragonCount ||= {};
    bucket[team]=(bucket[team]||0)+1;
    g.dragonOrderSequence.push(team);
    syncDragonCounts(g);
  }
  else if(metric==='netWorth'){
    const bucket=g.netWorth ||= {};
    const val=prompt('Net Worth for '+team, bucket[team]||0);
    if(val!=null) bucket[team]=Number(val)||0;
  }
  renderManual();
}

function handleManualRightClick(metric, side){
  const g=manualData.gameStats[currentGame]; if(!g) return;
  const team = side==='t1'? manualData.team1Name: manualData.team2Name;
  if(BINARY_METRICS.includes(metric)){
    if(g[metric]===team) g[metric]=null;
  }
  else if(COUNT_METRICS.includes(metric)){
    const bucket=g[metric]||{};
    if(bucket[team]>0) bucket[team]--;
  }
  else if(metric==='dragonCount'){
    const bucket=g.dragonCount ||= {};
    if(bucket[team]>0){
      bucket[team]--;
      // Remove the last occurrence of this team from order sequence (undo last dragon attribution)
      for(let i=g.dragonOrderSequence.length-1;i>=0;i--){
        if(g.dragonOrderSequence[i]===team){
          g.dragonOrderSequence.splice(i,1);
          break;
        }
      }
      syncDragonCounts(g);
    }
  }
  else if(metric==='netWorth'){
    const bucket=g.netWorth||{}; bucket[team]=0;
  }
  renderManual();
}

function syncDragonCounts(g){ const t1=manualData.team1Name, t2=manualData.team2Name; g.dragonCount[t1]=g.dragonOrderSequence.filter(t=>t===t1).length; g.dragonCount[t2]=g.dragonOrderSequence.filter(t=>t===t2).length; }


// ================= Helpers =================
function isLolMatchUrl(u){ try { const url=new URL(u); if(!/portal\.grid\.gg/.test(url.hostname)) return false; return /lol/.test(url.pathname); } catch(_){ return false; } }
// Animations disabled (can be reintroduced later if needed)
function animationsAllowed(){
  try {
    const cfg = window.__STATS_CONFIG__ && window.__STATS_CONFIG__.get();
    return !!(cfg && cfg.animationsEnabled);
  } catch(_){ return false; }
}
function cell(id, side){ return document.getElementById(`${id}-${side}`); }
function sendPersist(){ send('lol-stats-settings',{ manualMode: document.getElementById('lolManualMode').checked, metricVisibility, metricOrder: metricsOrderMutable }); }
// Persist animation settings (no-op)
function persistAnim(){}

// ================= Metrics UI =================
function buildMetricToggles(){ const wrap=document.getElementById('metricToggles'); if(!wrap) return; wrap.innerHTML=''; metricsOrder.forEach(id=>{ const label=document.createElement('label'); label.className='metricToggle'; const cb=document.createElement('input'); cb.type='checkbox'; cb.checked = metricVisibility[id] !== false; cb.onchange=()=>{ metricVisibility[id]=cb.checked; sendPersist(); applyVisibility(); }; label.appendChild(cb); label.appendChild(document.createTextNode(metricLabels[id]||id)); wrap.appendChild(label); }); }
function applyVisibility(){
  let hidden=0; let total=0;
  metricsOrder.forEach(id=>{
    const row = document.querySelector(`tr[data-metric="${id}"]`);
    if(!row) return; total++; const off = (metricVisibility[id] === false); if(off) hidden++; row.style.display = off?'none':'';
  });
  // Ensure any newly introduced metrics default to visible (e.g., 'winner')
  metricsOrder.forEach(id=>{ if(!(id in metricVisibility)) metricVisibility[id] = true; });
  if(total && hidden === total){
  // all hidden — restore defaults
    metricsOrder.forEach(id=> metricVisibility[id]=true);
    metricsOrder.forEach(id=>{ const row = document.querySelector(`tr[data-metric="${id}"]`); if(row) row.style.display=''; });
    sendPersist();
  } else {
  }
}
function ensureRows(){
  const body = document.getElementById('lt-body');
  if(!body){ return; }
  const sig = metricsOrderMutable.join('|');
  if(body.children.length && sig === lastOrderSig){ return; }
  body.innerHTML='';
  metricsOrderMutable.forEach(id=>{
    const tr=document.createElement('tr');
    tr.dataset.metric=id;
  if(BINARY_METRICS.includes(id) || ['dragonOrders','netWorth','quadra','penta','atakhan','winner'].includes(id)) tr.dataset.type='binary';
    else if(COUNT_METRICS.includes(id) || ['killCount','towerCount','inhibitorCount','baronCount','dragonCount'].includes(id)) tr.dataset.type='count';
    tr.draggable=true;
    // IMPORTANT: no escaped quotes here – previous refactor inserted backslashes so query selectors failed
  // Per‑game checkbox (default unchecked). State stored in window.__LOL_CHECK_STATE[game][metric]
  const cg = (window.__CURRENT_GAME_ID) || '1';
  window.__LOL_CHECK_STATE = window.__LOL_CHECK_STATE || {};
  const gameState = window.__LOL_CHECK_STATE[cg] || (window.__LOL_CHECK_STATE[cg] = {});
  const checked = !!gameState[id];
  tr.innerHTML=`<td class="metricLabel"><span class="dragHandle" title="Drag">≡</span><input type="checkbox" class="markMetric" data-metric="${id}" ${checked? 'checked':''}>${metricLabels[id]||id}</td><td id="${id}-t1" class="editable"></td><td id="${id}-t2" class="editable"></td>`;
    body.appendChild(tr);
  });
  lastOrderSig = sig;
  __prevValues = {};
  for(const k in firstEventFlags) delete firstEventFlags[k];
  attachManualHandlers();
  initDragAndDrop();
  try { activityModule && activityModule.recalc && activityModule.recalc(); } catch(_){ }
  scheduleAdjustCols();
}

// ================= Adaptive Column Width =================
let colWidthDebounce=null; let lastTeamWidth=null;
function adjustColumnWidths(){ /* no-op: fixed layout enforced via CSS */ }
function scheduleAdjustCols(){ if(colWidthDebounce) cancelAnimationFrame(colWidthDebounce); colWidthDebounce = requestAnimationFrame(adjustColumnWidths); }

// ================= Animations & Cell Updates =================
function setText(id, side, val){
  const key = id+':'+side;
  const newVal = (val===null||val===undefined)?'':String(val);
  const prevVal = __prevValues[key];
  if(prevVal === newVal) return;
  __prevValues[key] = newVal;
  const c = cell(id, side); if(!c) return;
  // Prepare jitter wrapper so we can animate inner content without affecting layout measurement resets
  let wrap = c.querySelector('.gs-jitter-wrap');
  if(!wrap){
    wrap = document.createElement('span');
    wrap.className = 'gs-jitter-wrap';
    // Move existing text if any
    while(c.firstChild) wrap.appendChild(c.firstChild);
    c.appendChild(wrap);
  }
  // Update value
  wrap.textContent = newVal;
  // Activity heat bar bump logic (exclude netWorth to reduce noise)
  // Suppress during reorder / team swap transitional updates
  const suppress = (window.__SUPPRESS_STATS_ANIM_UNTIL && performance.now() < window.__SUPPRESS_STATS_ANIM_UNTIL);
  if(!suppress && id !== 'netWorth' && activityModule && activityModule.onMetricUpdate){
    try {
      let shouldBump = false;
  if(newVal === '✓' && prevVal !== '✓') shouldBump = true; // binary acquisition (was 1/0 previously)
      else if(/^[0-9]+$/.test(newVal || '')){
        const nNew = parseInt(newVal,10);
        const nPrev = /^[0-9]+$/.test(prevVal||'') ? parseInt(prevVal,10) : -Infinity;
        if(nNew > nPrev) shouldBump = true;
      } else if(id==='quadra' || id==='penta' || id==='atakhan'){
        if(newVal && newVal !== prevVal) shouldBump = true;
      }
      if(shouldBump){ activityModule.onMetricUpdate(side==='t1'?1:2); }
    } catch(_){ }
  }
  // Cell pop animation (skip if suppressed or animations disabled)
  try {
    if(!suppress){
      const cfg = window.__STATS_CONFIG__ && window.__STATS_CONFIG__.get && window.__STATS_CONFIG__.get();
      if(cfg && cfg.animationsEnabled){
        // Restart animation: remove class if present to retrigger
        if(c.classList.contains('gs-animating')){
          c.classList.remove('gs-animating');
          // Force reflow for reliable restart
          void c.offsetWidth;
        }
        c.classList.add('gs-animating');
        const dur = (cfg.animationDurationMs||450);
        setTimeout(()=>{ try { c.classList.remove('gs-animating'); } catch(_){ } }, dur+80);
      }
    }
  } catch(_){ }
}

// ================= LoL Update Handling =================
ipcRenderer.on('lol-stats-update', (_, payload)=>{ if(document.getElementById('lolManualMode').checked) return; try {
  const firstRender = (lastGameRendered == null);
  if(firstRender){ try { window.__SUPPRESS_STATS_ANIM_UNTIL = performance.now() + 450; } catch(_){ } }
  liveDataset = payload; cachedLive = payload; const games=Object.keys(payload.gameStats||{}).map(Number).sort((a,b)=>a-b); const sig = games.join(','); if(followLatestLiveGame && games.length) currentLiveGame = games[games.length-1]; if(sig !== lastLiveGamesSig){ lastLiveGamesSig = sig; if(followLatestLiveGame && games.length) currentLiveGame = games[games.length-1]; }
  updateGameSelect(); renderLol(payload); renderMap(); } catch(e){} });

// ================= Reset & URL Change =================
function clearLol(){
  metricsOrder.forEach(id=>{
    const isCount = COUNT_METRICS.includes(id);
    const isBinary = BINARY_METRICS.includes(id) || ['quadra','penta','atakhan','dragonOrders','firstKill','firstTower','firstInhibitor','firstBaron','race5','race10','race15','race20'].includes(id);
    ['t1','t2'].forEach(side=>{
      const c=document.getElementById(`${id}-${side}`);
      if(!c) return;
      let val='';
      if(isCount) val='0';
      else if(isBinary){
        if(id==='dragonOrders' || id==='netWorth') val=''; else val='✗';
      }
      c.textContent = val;
      c.classList.remove('wl-win','wl-lose');
      const key=id+':'+side;
      delete __prevValues[key];
      delete firstEventFlags['fe:'+key];
      const row = c.parentElement;
      if(row && row.dataset) delete row.dataset.win;
    });
  });
}

ipcRenderer.on('stats-url-update', (_, { slot, url })=>{ try { const was = prevMatchUrls[slot]; const nowIs = isLolMatchUrl(url); if(nowIs){ if(was && was!==url){ liveDataset = null; cachedLive=null; currentLiveGame=null; followLatestLiveGame=true; lastLiveGamesSig=''; clearLol(); updateGameSelect(); const st=document.getElementById('lolStatus'); if(st) st.textContent='Waiting...'; ipcRenderer.send('lol-stats-reset'); } prevMatchUrls[slot]=url; } } catch(_){ } });

// ================= Credentials =================

function ensureOption(select, value){ if(![...select.options].some(o=>o.value===value)){ const opt=document.createElement('option'); opt.value=value; opt.textContent=value.replace(/^https?:\/\/(www\.)?/,'').slice(0,40); select.appendChild(opt); } }

// ================= Init From Main (stats-init) =================
ipcRenderer.on('stats-init', (_, cfg) => { try { const sa=document.getElementById('srcA'); const sb=document.getElementById('srcB'); ensureOption(sa, cfg.urls.A); ensureOption(sb, cfg.urls.B); sa.value = cfg.urls.A; sb.value = cfg.urls.B; document.getElementById('dbgLayout').textContent = cfg.mode; document.getElementById('dbgSide').textContent = cfg.side; document.getElementById('lolManualMode').checked = !!cfg.lolManualMode; metricVisibility = cfg.lolMetricVisibility || {}; if(Array.isArray(cfg.lolMetricOrder) && cfg.lolMetricOrder.length){ const defaults = [...metricsOrder]; const known = new Set(defaults); const filtered = cfg.lolMetricOrder.filter(m=> known.has(m)); if(filtered.length){ const missing = defaults.filter(m=> !filtered.includes(m)); metricsOrder = filtered.concat(missing); metricsOrderMutable = metricsOrder.slice(); } }
  if(cfg.lolManualData && typeof cfg.lolManualData==='object'){
    try { manualData = JSON.parse(JSON.stringify(cfg.lolManualData)); } catch(_){ }
  }
  if(cfg.lolMetricMarks && typeof cfg.lolMetricMarks==='object'){
    window.__LOL_CHECK_STATE = JSON.parse(JSON.stringify(cfg.lolMetricMarks));
  }
  buildMetricToggles(); ensureRows(); applyVisibility(); if(cfg.statsConfig && window.__STATS_CONFIG__){ window.__STATS_CONFIG__.set(cfg.statsConfig); }
  if(document.getElementById('lolManualMode').checked){ currentGame = Object.keys(manualData?.gameStats||{'1':1})[0] || '1'; updateGameSelect(); renderManual(); }
  try { ipcRenderer.send('lol-stats-settings',{ manualMode: document.getElementById('lolManualMode').checked, manualData, metricMarks: window.__LOL_CHECK_STATE }); } catch(_){ }
 } catch(e) {} });
ipcRenderer.on('stats-config-applied', (_e,cfg)=>{ try { if(cfg && window.__STATS_CONFIG__) window.__STATS_CONFIG__.set(cfg); applyWinLose(); } catch(_){ } });

function applyWinLose(){
  try {
    // Reset header classes
    try {
      const th1 = document.getElementById('lt-team1');
      const th2 = document.getElementById('lt-team2');
      if(th1) th1.classList.remove('wl-win','wl-lose');
      if(th2) th2.classList.remove('wl-win','wl-lose');
    } catch(_){ }
    let win1 = 0, win2 = 0;
    metricsOrder.forEach(id=>{
      const row = document.querySelector(`tr[data-metric="${id}"]`);
      if(!row) return;
      const c1 = document.getElementById(`${id}-t1`);
      const c2 = document.getElementById(`${id}-t2`);
      if(!c1 || !c2) return;
      c1.classList.remove('wl-win','wl-lose');
      c2.classList.remove('wl-win','wl-lose');
      row.removeAttribute('data-win');
      const t1 = (c1.textContent||'').trim();
      const t2 = (c2.textContent||'').trim();
      let n1=0, n2=0;
      if(BINARY_METRICS.includes(id) || ['firstKill','firstTower','firstBaron','firstInhibitor','race5','race10','race15','race20','quadra','penta','atakhan'].includes(id)){
        n1 = t1==='✓'?1:0; n2 = t2==='✓'?1:0;
      } else if(COUNT_METRICS.includes(id) || ['killCount','towerCount','inhibitorCount','baronCount','dragonCount'].includes(id)){
        n1 = parseInt(t1,10); n2 = parseInt(t2,10); if(isNaN(n1)) n1=0; if(isNaN(n2)) n2=0;
      } else if(id==='netWorth'){
        n1 = parseFloat(t1)||0; n2 = parseFloat(t2)||0;
      } else if(id==='dragonOrders'){
        n1 = t1? t1.split(/\s+/).filter(Boolean).length:0; n2 = t2? t2.split(/\s+/).filter(Boolean).length:0;
      } else {
        n1 = parseFloat(t1)||0; n2 = parseFloat(t2)||0;
      }
      if(window.__STATS_CONFIG__ && window.__STATS_CONFIG__.get && window.__STATS_CONFIG__.get().winLoseEnabled===false){ return; }
      if(n1===0 && n2===0) return; // nothing to highlight
      if(n1>n2){ c1.classList.add('wl-win'); if(n2>0) c2.classList.add('wl-lose'); row.dataset.win='1'; win1++; }
      else if(n2>n1){ c2.classList.add('wl-win'); if(n1>0) c1.classList.add('wl-lose'); row.dataset.win='2'; win2++; }
      else { row.dataset.win='tie'; }
    });
    // Apply header highlight ONLY if an explicit Winner row has ✓; otherwise, don't mark header at all.
    if(!(window.__STATS_CONFIG__ && window.__STATS_CONFIG__.get && window.__STATS_CONFIG__.get().winLoseEnabled===false)){
      try {
        const th1 = document.getElementById('lt-team1');
        const th2 = document.getElementById('lt-team2');
        const w1 = document.getElementById('winner-t1');
        const w2 = document.getElementById('winner-t2');
        const hasWinner = !!(w1 && w2 && ((w1.textContent||'').trim()==='✓' || (w2.textContent||'').trim()==='✓'));
        if(th1 && th2 && hasWinner){
          const t1won = (w1.textContent||'').trim()==='✓';
          const t2won = (w2.textContent||'').trim()==='✓';
          if(t1won){ th1.classList.add('wl-win'); th2.classList.add('wl-lose'); }
          else if(t2won){ th2.classList.add('wl-win'); th1.classList.add('wl-lose'); }
        }
      } catch(_){ }
    }
  } catch(_){ }
}
// (Heat bar listener lives in stats_theme.js)

// ================= UI Event Bindings =================
function bindBasic(){
  const byId = id => document.getElementById(id);
  const safe = (id, fn)=>{ const el=byId(id); if(el) fn(el); };
  safe('srcA', el=> el.onchange = e=> send('stats-set-url',{slot:'A',url:e.target.value}));
  safe('srcB', el=> el.onchange = e=> send('stats-set-url',{slot:'B',url:e.target.value}));
  safe('applyA', el=> el.onclick = ()=>{ const v=byId('customA').value.trim(); if(v) send('stats-set-url',{slot:'A',url:v}); });
  safe('applyB', el=> el.onclick = ()=>{ const v=byId('customB').value.trim(); if(v) send('stats-set-url',{slot:'B',url:v}); });
  safe('modeSplit', el=> el.onclick = ()=>{ send('stats-layout',{mode:'split'}); const dbg=byId('dbgLayout'); if(dbg) dbg.textContent='split'; });
  safe('modeVertical', el=> el.onclick = ()=>{ send('stats-layout',{mode:'vertical'}); const dbg=byId('dbgLayout'); if(dbg) dbg.textContent='vertical'; });
  safe('modeA', el=> el.onclick = ()=>{ send('stats-layout',{mode:'focusA'}); const dbg=byId('dbgLayout'); if(dbg) dbg.textContent='focusA'; });
  safe('modeB', el=> el.onclick = ()=>{ send('stats-layout',{mode:'focusB'}); const dbg=byId('dbgLayout'); if(dbg) dbg.textContent='focusB'; });
  safe('toggleSide', el=> el.onclick = ()=>{ send('stats-toggle-side'); const d=byId('dbgSide'); if(d) d.textContent = d.textContent==='left'?'right':'left'; });
}


function bindReset(){
  const btn = document.getElementById('lolReset');
  if(!btn) return;
  btn.onclick = () => {
    try {
      // Clear only LoL stats state; keep current URLs.
      clearLol();
      liveDataset = null; cachedLive=null; currentLiveGame=null; lastLiveGamesSig='';
      followLatestLiveGame = true;
      // Clear custom display overrides for live mode (reset requirement)
      customTeamNames[1]=null; customTeamNames[2]=null;
      setTeamHeader(1, 'Team 1', false); setTeamHeader(2, 'Team 2', false);
      // Additional manual dataset reset if in manual mode
      if(document.getElementById('lolManualMode').checked){
        manualData = { team1Name:'Team 1', team2Name:'Team 2', gameStats:{ '1': makeEmptyGame() } };
        currentGame='1';
        updateGameSelect();
        renderManual();
      }
      // Clear checkbox marks & persist
      window.__LOL_CHECK_STATE = {};
      try { ipcRenderer.send('lol-metric-marks-set', window.__LOL_CHECK_STATE); } catch(_){ }
      try { ipcRenderer.send('lol-manual-data-set', manualData); } catch(_){ }
      // Reset aggregator in main (does not navigate)
      ipcRenderer.send('lol-stats-reset');
      // Request a reload of slot A ONLY (keep exact same URL; no cache-bust param added)
      ipcRenderer.send('stats-reload-slot', { slot: 'A' });
      // Re‑signal injected scripts (in case they are already present) after a short delay
      setTimeout(()=>{
        try { window.postMessage({ type:'restart_data_collection', reason:'manual-reset' }, '*'); } catch(_){ }
        const st=document.getElementById('lolStatus'); if(st) st.textContent='Manual reset...';
      }, 150);
    } catch(e){ console.warn('lolReset failed', e); }
  };
}

function bindSettings(){
  const manualCb = document.getElementById('lolManualMode');
  function applyManualClass(){
    try { document.body.classList.toggle('manual-mode', !!manualCb.checked); } catch(_){ }
  }
  manualCb.addEventListener('change', ()=>{ sendPersist(); applyManualClass(); });
  applyManualClass(); // initial
}

// Placeholder functions for features referenced later (map & manual editing) to avoid ReferenceErrors before extraction completes.
function attachManualHandlers(){
  metricsOrder.forEach(id=>{
    ['t1','t2'].forEach(side=>{
      const el = cell(id, side);
      if(!el || el.dataset.bound) return;
      el.dataset.bound='1';
      el.addEventListener('click', ()=>{ if(!document.getElementById('lolManualMode').checked) return; handleManualClick(id, side); });
      el.addEventListener('contextmenu', e=>{ if(!document.getElementById('lolManualMode').checked) return; e.preventDefault(); handleManualRightClick(id, side); return false; });
      el.title='LMB: + / set, RMB: - / clear';
    });
  });
}
function initDragAndDrop(){ const body=document.getElementById('lt-body'); if(!body) return; body.querySelectorAll('tr').forEach(tr=>{ tr.addEventListener('dragstart', ev=>{ tr.classList.add('dragging'); ev.dataTransfer.effectAllowed='move'; }); tr.addEventListener('dragend', ()=>{ tr.classList.remove('dragging'); body.querySelectorAll('.drop-target').forEach(r=>r.classList.remove('drop-target')); }); }); body.addEventListener('dragover', ev=>{ ev.preventDefault(); const after=getAfterRow(body, ev.clientY); body.querySelectorAll('.drop-target').forEach(r=>r.classList.remove('drop-target')); if(after) after.classList.add('drop-target'); }); body.addEventListener('drop', ev=>{ ev.preventDefault(); const after=getAfterRow(body, ev.clientY); const dragging=body.querySelector('tr.dragging'); if(!dragging) return; if(after) body.insertBefore(dragging, after); else body.appendChild(dragging); metricsOrderMutable=[...body.querySelectorAll('tr')].map(r=>r.dataset.metric); metricsOrder=[...metricsOrderMutable]; lastOrderSig = null; // Suppress animations briefly while DOM reshuffles
  try { window.__SUPPRESS_STATS_ANIM_UNTIL = performance.now() + 450; } catch(_){ }
  ensureRows(); if(document.getElementById('lolManualMode').checked) renderManual(); else if(liveDataset) renderLol(liveDataset); sendPersist(); }); }
function getAfterRow(body,y){ const rows=[...body.querySelectorAll('tr:not(.dragging)')]; return rows.find(r=> y <= r.getBoundingClientRect().top + r.getBoundingClientRect().height/2); }
let addBtn; let gameSelect; let headerH1;
// Compute a simple winner for a given game's stats snapshot, mirroring applyWinLose comparisons
function computeGameWinnerSimple(snapshot, team1Name, team2Name){
  if(!snapshot) return null;
  let score1=0, score2=0;
  function cmpBinary(field){ const v=snapshot[field]; if(!v) return; if(v===team1Name) score1++; else if(v===team2Name) score2++; }
  function cmpCount(field){ const b=snapshot[field]||{}; const v1=b[team1Name]||0; const v2=b[team2Name]||0; if(v1>v2) score1++; else if(v2>v1) score2++; }
  // Binary metrics
  ['firstKill','firstTower','firstInhibitor','firstBaron','race5','race10','race15','race20','quadra','penta','atakhan'].forEach(cmpBinary);
  // Counts
  ['killCount','towerCount','inhibitorCount','baronCount','dragonCount'].forEach(cmpCount);
  // Dragon orders / times
  try {
    let o1=[], o2=[];
    if(snapshot.dragonOrders){ o1 = snapshot.dragonOrders[team1Name]||[]; o2 = snapshot.dragonOrders[team2Name]||[]; }
    else if(snapshot.dragonTimes){
      const parseTs=(raw)=>{ if(raw==null) return Infinity; if(typeof raw==='number'&&!isNaN(raw)) return raw>36000?Math.floor(raw/1000):raw; if(typeof raw==='string'){ const v=raw.trim(); if(/^\d+$/.test(v)) return Number(v); if(/^(\d{1,2}:){1,2}\d{1,2}$/.test(v)){ const parts=v.split(':').map(n=>Number(n)||0); if(parts.length===2){ const [m,s]=parts; return m*60+s; } if(parts.length===3){ const [h,m,s]=parts; return h*3600+m*60+s; } } } return Infinity; };
      const arr=[]; (snapshot.dragonTimes[team1Name]||[]).forEach(ts=> arr.push({ team: team1Name, ts: parseTs(ts) })); (snapshot.dragonTimes[team2Name]||[]).forEach(ts=> arr.push({ team: team2Name, ts: parseTs(ts) }));
      arr.sort((a,b)=> a.ts-b.ts); let idx=1; const map={}; arr.forEach(e=>{ if(!isFinite(e.ts)) return; (map[e.team]=map[e.team]||[]).push(idx++); }); o1 = map[team1Name]||[]; o2 = map[team2Name]||[];
    }
    if(o1.length>o2.length) score1++; else if(o2.length>o1.length) score2++;
  } catch(_){ }
  // Net worth
  try { const nw=snapshot.netWorth||{}; const n1 = Number(nw[team1Name]||0); const n2 = Number(nw[team2Name]||0); if(n1>n2) score1++; else if(n2>n1) score2++; } catch(_){ }
  if(score1===0 && score2===0) return null; // insufficient data
  if(score1>score2) return 1; if(score2>score1) return 2; return 'tie';
}
function updateGameSelect(){
  if(!gameSelect) return;
  const manualOn=document.getElementById('lolManualMode').checked;
  gameSelect.innerHTML='';
  const placeholder=document.createElement('option');
  placeholder.value=''; placeholder.disabled=true; placeholder.textContent='Game -';
  let any=false;
  // Helper: detect if a snapshot has any meaningful signals beyond empty defaults
  function hasAnySignal(snapshot, team1Name, team2Name){
    try {
      if(!snapshot || typeof snapshot!== 'object') return false;
      // Any binary set
      const binaries=['firstKill','firstTower','firstInhibitor','firstBaron','race5','race10','race15','race20','quadra','penta','atakhan'];
      if(binaries.some(k=> snapshot[k]===team1Name || snapshot[k]===team2Name)) return true;
      // Any counts > 0
      const counts=['killCount','towerCount','inhibitorCount','baronCount','dragonCount'];
      for(const k of counts){ const b=snapshot[k]||{}; if((b[team1Name]||0)>0 || (b[team2Name]||0)>0) return true; }
      // Dragon orders / times
      try {
        if(snapshot.dragonOrders){ const o1=snapshot.dragonOrders[team1Name]||[]; const o2=snapshot.dragonOrders[team2Name]||[]; if((o1.length||0)>0 || (o2.length||0)>0) return true; }
        if(snapshot.dragonTimes){ const t1=snapshot.dragonTimes[team1Name]||[]; const t2=snapshot.dragonTimes[team2Name]||[]; if((t1.length||0)>0 || (t2.length||0)>0) return true; }
      } catch(_){ }
      // Net worth present and non-zero
      try { const nw=snapshot.netWorth||{}; const n1=Number(nw[team1Name]||0); const n2=Number(nw[team2Name]||0); if(n1!==0 || n2!==0) return true; } catch(_){ }
    } catch(_){ }
    return false;
  }
  if(manualOn){
    const games=Object.keys(manualData.gameStats||{}).filter(k=>/^[0-9]+$/.test(k)).map(Number).sort((a,b)=>a-b);
    games.forEach(g=>{ const o=document.createElement('option'); o.value=String(g); const label='Game '+g; o.textContent=label; if(String(g)===String(currentGame||'1')) o.selected=true; gameSelect.appendChild(o); any=true; });
    if(addBtn){ addBtn.setAttribute('aria-disabled','false'); addBtn.disabled=false; }
  } else if(liveDataset){
    const games=Object.keys(liveDataset.gameStats||{}).map(Number).sort((a,b)=>a-b);
    if(games.length){
      if(typeof currentLiveGame!=='number' || !games.includes(currentLiveGame)) currentLiveGame = games[games.length-1];
  games.forEach(g=>{ const o=document.createElement('option'); o.value=String(g); const label='Game '+g; o.textContent=label; if(g===currentLiveGame) o.selected=true; gameSelect.appendChild(o); any=true; });
    }
    if(addBtn){ addBtn.setAttribute('aria-disabled','true'); addBtn.disabled=true; }
  }
  if(!any){ placeholder.selected=true; gameSelect.appendChild(placeholder); }
}
function startInlineRename(idx){ if(!document.getElementById('lolManualMode').checked) return; const th = document.getElementById(idx===1?'lt-team1':'lt-team2'); const cur = idx===1? manualData.team1Name: manualData.team2Name; const input=document.createElement('input'); input.type='text'; input.value=cur; input.style.cssText='width:100%;background:rgba(255,255,255,0.05);border:1px solid #345;padding:2px 4px;color:#fff;font:inherit;text-align:center;'; th.innerHTML=''; th.appendChild(input); input.focus(); input.select(); const commit=()=>{ const v=input.value.trim()||cur; renameTeamInternal(idx,v); }; const cancel=()=>{ renderManual(); }; input.addEventListener('keydown',e=>{ if(e.key==='Enter'){ commit(); } else if(e.key==='Escape'){ cancel(); } }); input.addEventListener('blur', commit); }
function renderLol(payload, manual=false){
  try {
    ensureRows();
    applyVisibility();
  if(!payload){ return; }
    const { team1Name, team2Name, gameStats } = payload;
  if(!gameStats || typeof gameStats!=='object'){ return; }
    const games = Object.keys(gameStats||{}).map(Number).sort((a,b)=>a-b);
  if(!games.length){ return; }
    if(!manual){
      if(typeof currentLiveGame!=='number' || !games.includes(currentLiveGame)) currentLiveGame = games[games.length-1];
    }
    const gN = manual ? (games.includes(Number(currentGame))? Number(currentGame): games[0]) : currentLiveGame;
    const switched = lastGameRendered !== gN;
  if(switched){ }
    lastGameRendered = gN;
    const s = (gameStats||{})[gN]||{};
  if(!s || Object.keys(s).length===0){ }
    const dispTeam1 = swapTeams ? team2Name : team1Name;
    const dispTeam2 = swapTeams ? team1Name : team2Name;
    const t1Key = dispTeam1;
    const t2Key = dispTeam2;
    const th1=document.getElementById('lt-team1'); const th2=document.getElementById('lt-team2');
    const headerDisp1 = (customTeamNames[1] && !manual) ? customTeamNames[1] : (dispTeam1||'Team 1');
    const headerDisp2 = (customTeamNames[2] && !manual) ? customTeamNames[2] : (dispTeam2||'Team 2');
  setTeamHeader(1, headerDisp1, true);
  setTeamHeader(2, headerDisp2, true);
    scheduleAdjustCols();
  function setBinary(field, filledSet){ const v=s[field]; if(!v) return; filledSet.add(field); const idx = v===t1Key?1:(v===t2Key?2:0); if(!idx) return; setText(field,'t1', idx===1 ? '✓' : '✗'); setText(field,'t2', idx===2 ? '✓' : '✗'); }
    const DEFAULT_ZERO_COUNT_FIELDS = ['killCount','towerCount','inhibitorCount','baronCount','dragonCount'];
    function setCount(field){ const bucket = s[field] || {}; const has1 = Object.prototype.hasOwnProperty.call(bucket, dispTeam1); const has2 = Object.prototype.hasOwnProperty.call(bucket, dispTeam2); if(!has1 && !has2){ if(DEFAULT_ZERO_COUNT_FIELDS.includes(field)){ ['t1','t2'].forEach(side=>{ const key=field+':'+side; if(!__prevValues[key]) __prevValues[key]='0'; firstEventFlags['fe:'+key]=true; setText(field, side, '0'); }); } else { setText(field,'t1',''); setText(field,'t2',''); } return; } let v1 = has1 ? bucket[dispTeam1] : 0; let v2 = has2 ? bucket[dispTeam2] : 0; if(v1 === undefined || v1 === null || isNaN(v1)) v1 = 0; if(v2 === undefined || v2 === null || isNaN(v2)) v2 = 0; setText(field,'t1', v1 === 0 ? '0' : v1); setText(field,'t2', v2 === 0 ? '0' : v2); }
  // winner header highlight omitted
    const filledBinary = new Set();
    setBinary('firstKill', filledBinary);
    setCount('killCount');
    ['race5','race10','race15','race20'].forEach(r=> setBinary(r, filledBinary));
    setBinary('firstTower', filledBinary);
    setBinary('firstInhibitor', filledBinary);
    setBinary('firstBaron', filledBinary);
    setCount('towerCount');
    setCount('inhibitorCount');
    setCount('baronCount');
  setCount('dragonCount');
  // Winner (live only). Manual mode can also toggle if user wants.
  if(s.winner){ setBinary('winner', filledBinary); }
    // Dragon orders
    (function(){ function parseTs(raw){ if(raw==null) return Infinity; if(typeof raw==='number' && !isNaN(raw)) return raw; if(typeof raw==='string'){ const val=raw.trim(); if(/^\d+$/.test(val)){ const num=Number(val); if(num>3600*10) return Math.floor(num/1000); return num; } if(/^(\d{1,2}:){1,2}\d{1,2}$/.test(val)){ const parts=val.split(':').map(n=>Number(n)||0); if(parts.length===2){ const [m,s]=parts; return m*60+s; } if(parts.length===3){ const [h,m,s]=parts; return h*3600+m*60+s; } } } return Infinity; } let orders1=[], orders2=[]; if(s.dragonOrders){ orders1 = s.dragonOrders[dispTeam1]||[]; orders2 = s.dragonOrders[dispTeam2]||[]; } else if(s.dragonTimes){ const arr=[]; (s.dragonTimes[team1Name]||[]).forEach(ts=> arr.push({ team: team1Name, ts: parseTs(ts) })); (s.dragonTimes[team2Name]||[]).forEach(ts=> arr.push({ team: team2Name, ts: parseTs(ts) })); arr.sort((a,b)=> a.ts-b.ts); let idx=1; const map={}; arr.forEach(e=>{ if(!isFinite(e.ts)) return; (map[e.team]=map[e.team]||[]).push(idx++); }); orders1 = map[dispTeam1]||[]; orders2 = map[dispTeam2]||[]; } setText('dragonOrders','t1', orders1.join(' ')); setText('dragonOrders','t2', orders2.join(' ')); })();
    // Net worth
  const nw = s.netWorth || {}; const hasNw1 = Object.prototype.hasOwnProperty.call(nw, t1Key); const hasNw2 = Object.prototype.hasOwnProperty.call(nw, t2Key); const nw1 = hasNw1 ? nw[t1Key] : ''; const nw2 = hasNw2 ? nw[t2Key] : ''; setText('netWorth','t1', nw1); setText('netWorth','t2', nw2);
    if(s.quadra) setBinary('quadra', filledBinary); if(s.penta) setBinary('penta', filledBinary); if(s.atakhan) setBinary('atakhan', filledBinary);
  ['firstKill','race5','race10','race15','race20','firstTower','firstInhibitor','firstBaron','quadra','penta','atakhan','winner'].forEach(m=>{ if(!filledBinary.has(m)){ setText(m,'t1','✗'); setText(m,'t2','✗'); } });
    const statusEl=document.getElementById('lolStatus'); if(statusEl) statusEl.textContent = `Games: ${games.join(', ')}`;
    // After all cell values are updated compute win/lose highlighting
    applyWinLose();
  } catch(e) { /* swallow */ }
}
// (Map logic handled in stats_map.js)

// ================= Startup =================
(function init(){
  try { console.log('[stats_panel] init()'); } catch(_){}
  bindBasic();
  bindReset();
  bindSettings();
  buildMetricToggles();
  ensureRows();
  try { console.log('[stats_panel] after ensureRows count=', document.querySelectorAll('#lt-body tr').length); } catch(_){}
  try { activityModule && activityModule.init && activityModule.init(); } catch(_){ }
  applyVisibility();
  scheduleAdjustCols();
  // Setup game controls
  headerH1 = document.querySelector('#stats h1');
  // Prefer static elements if present (added to HTML for stability)
  gameSelect = document.getElementById('lolGameSelect') || gameSelect;
  addBtn = document.getElementById('lolAddGameBtn') || addBtn;
  // Fallback (older HTML) dynamic creation
  if(!gameSelect){ gameSelect=document.createElement('select'); gameSelect.style='padding:4px;font-size:11px;min-width:70px;'; headerH1 && headerH1.appendChild(gameSelect); }
  if(!addBtn){ addBtn=document.createElement('button'); addBtn.textContent='Add Game'; addBtn.style='padding:4px 10px;font-size:11px;'; headerH1 && headerH1.appendChild(addBtn); }
  currentGame='1';
  addBtn.onclick=()=>{
    if(addBtn.getAttribute('aria-disabled')==='true') return;
    try {
      try { window.__SUPPRESS_STATS_ANIM_UNTIL = performance.now() + 450; } catch(_){ }
      const rawKeys = Object.keys(manualData.gameStats||{});
      const keys = rawKeys.filter(k=>/^\d+$/.test(k));
      let maxN = 0; keys.forEach(k=>{ const n=Number(k); if(Number.isFinite(n) && n>maxN) maxN=n; });
      const nextNum = maxN + 1;
      const next = String(nextNum);
      manualData.gameStats[next] = makeEmptyGame();
      currentGame = next;
      updateGameSelect();
      renderManual();
      try { ipcRenderer.send('lol-manual-data-set', manualData); } catch(_){ }
  } catch(err){ }
  };
  if(gameSelect){
    gameSelect.onchange=()=>{ const manualOn=document.getElementById('lolManualMode').checked; const val=gameSelect.value; if(!val) return; try { window.__SUPPRESS_STATS_ANIM_UNTIL = performance.now() + 450; } catch(_){ }
      if(manualOn){ currentGame=val; renderManual(); } else { currentLiveGame=Number(val); const games=Object.keys(liveDataset?.gameStats||{}).map(Number).sort((a,b)=>a-b); const last=games[games.length-1]; followLatestLiveGame = (currentLiveGame===last); if(liveDataset) renderLol(liveDataset); }
      try { activityModule && activityModule.recalc && activityModule.recalc(); } catch(_){ } };
  }
  document.addEventListener('mousedown', e=>{ const td=e.target.closest && e.target.closest('td.editable'); if(td) td.classList.add('pressing'); });
  document.addEventListener('mouseup', ()=>{ document.querySelectorAll('td.pressing').forEach(td=> td.classList.remove('pressing')); });
  // (per-section collapse handlers consolidated in stats_collapse.js)
  // Swap teams
  document.getElementById('swapTeamsBtn').onclick=()=>{ 
    swapTeams=!swapTeams; 
    document.getElementById('swapTeamsBtn').classList.toggle('active', swapTeams); 
    // Suppress heatbar/cell bump animations briefly while values visually reshuffle
    try { window.__SUPPRESS_STATS_ANIM_UNTIL = performance.now() + 450; } catch(_){ }
    if(document.getElementById('lolManualMode').checked) { 
      renderManual(); 
    } else { 
      const snap = liveDataset || cachedLive; 
      if(snap) renderLol(snap); 
    } 
    scheduleAdjustCols(); 
    try { 
      const t1 = document.querySelector('#lt-team1 .teamNameWrap')?.textContent || 'Team 1';
      const t2 = document.querySelector('#lt-team2 .teamNameWrap')?.textContent || 'Team 2';
      ipcRenderer.send('lol-team-names-set', { team1: t1, team2: t2 });
    } catch(_){ }
    applyWinLose();
  };
  window.addEventListener('resize', ()=> scheduleAdjustCols());
  document.getElementById('swapTeamsBtn').title='Swap display order of teams';
  // Local Detach button (stats window separation)
  // detach button not present
  // Live & Manual mode rename handled uniformly by wrapper dblclick (see handleTeamHeaderDblClick)
  // Manual toggle logic extension
  document.getElementById('lolManualMode').addEventListener('change', ()=>{ const on=document.getElementById('lolManualMode').checked; if(on){ if(cachedLive){ manualData.team1Name=cachedLive.team1Name||manualData.team1Name; manualData.team2Name=cachedLive.team2Name||manualData.team2Name; manualData.gameStats = JSON.parse(JSON.stringify(cachedLive.gameStats||manualData.gameStats)); } ensureRows(); attachManualHandlers(); updateGameSelect(); renderManual(); } else { updateGameSelect(); if(liveDataset) renderLol(liveDataset); } try { activityModule && activityModule.recalc && activityModule.recalc(); } catch(_){ } });
  document.getElementById('lolManualMode').addEventListener('change', ()=>{
    const on = document.getElementById('lolManualMode').checked;
    if(on){
      if(cachedLive){
        manualData.team1Name = cachedLive.team1Name || manualData.team1Name;
        manualData.team2Name = cachedLive.team2Name || manualData.team2Name;
        manualData.gameStats = JSON.parse(JSON.stringify(cachedLive.gameStats || manualData.gameStats));
      }
      // Sanitize keys and guarantee at least game 1
      const cleaned = {}; let any=false; Object.keys(manualData.gameStats||{}).forEach(k=>{ if(/^[\d]+$/.test(k)){ cleaned[k]=manualData.gameStats[k]; any=true; } });
      if(!any){ cleaned['1']=makeEmptyGame(); currentGame='1'; }
      manualData.gameStats = cleaned;
      ensureRows(); attachManualHandlers(); updateGameSelect(); renderManual();
    } else {
      updateGameSelect(); if(liveDataset) renderLol(liveDataset);
    }
    try { activityModule && activityModule.recalc && activityModule.recalc(); } catch(_){ }
  });
  // (map init lives in stats_map.js - see initLolMap)
  updateGameSelect(); if(addBtn){ addBtn.setAttribute('aria-disabled','true'); addBtn.disabled=true; }
  // Lightweight self-test sample (only if no data after short delay)
  // Removed mock Alpha/Beta injection sample.
  // Ensure headers initialized & dblclick bound immediately (before first data payload)
  try { setTeamHeader(1, 'Team 1', false); setTeamHeader(2, 'Team 2', false); } catch(_){ }
  // (embedded odds + reordering initialized by stats_boot.js)
})();
// (embedded odds board & section reordering in stats_embedded.js)

// ================= Added: Per‑Game Checkbox Persistence =================
// Checkboxes are not tied to metric visibility; they represent custom user flags per game.
// Requirements: default unchecked, persist per game, cleared by reset.
(function(){
  window.__LOL_CHECK_STATE = window.__LOL_CHECK_STATE || {}; // { gameId: { metricId: true } }
  function currentGameId(){
    try {
      if(document.getElementById('lolManualMode').checked){
        return String(currentGame||'1');
      }
      // live mode: use lastGameRendered or detected live game
      return String(lastGameRendered || currentLiveGame || '1');
    } catch(_){ return '1'; }
  }
  window.__CURRENT_GAME_ID = currentGameId();
  function syncFromState(){
    const gid=currentGameId();
    window.__CURRENT_GAME_ID = gid;
    const st = window.__LOL_CHECK_STATE[gid] || {};
    document.querySelectorAll('input.markMetric').forEach(cb=>{
      const m = cb.getAttribute('data-metric');
      cb.checked = !!st[m];
    });
  }
  function persistMetric(metric, value){
    const gid=currentGameId();
    const bucket = window.__LOL_CHECK_STATE[gid] || (window.__LOL_CHECK_STATE[gid]={});
    if(value) bucket[metric]=true; else delete bucket[metric];
  }
  document.addEventListener('change', e=>{
    const cb = e.target.closest && e.target.closest('input.markMetric');
    if(!cb) return;
    const metric = cb.getAttribute('data-metric');
    persistMetric(metric, cb.checked);
    try { ipcRenderer.send('lol-metric-marks-set', window.__LOL_CHECK_STATE); } catch(_){ }
  });
  // Hook into game select changes & manual/live toggle to refresh checkbox states
  const obs = new MutationObserver(()=> syncFromState());
  const body = document.getElementById('lt-body'); if(body) obs.observe(body, { childList:true, subtree:true });
  // Refresh when game changes (override existing handler by wrapping)
  const origUpdateGameSelect = updateGameSelect;
  updateGameSelect = function(){ origUpdateGameSelect.apply(this, arguments); setTimeout(syncFromState, 0); };
  // Integrate with reset button: clear all states when reset fires
  const resetBtn = document.getElementById('lolReset');
  if(resetBtn){
    const prev = resetBtn.onclick;
    resetBtn.onclick = function(ev){
      if(prev) prev.call(this, ev);
      window.__LOL_CHECK_STATE = {}; // clear all
      setTimeout(syncFromState, 0);
    };
  }
  // Initial sync (after initial rows)
  setTimeout(syncFromState, 0);
})();

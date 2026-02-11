// Core stats logic (theme & embedded odds handled in separate modules)
let ipcRenderer = window.ipcRenderer; // reuse if already present
if(!ipcRenderer){
  try { ipcRenderer = require('electron').ipcRenderer; window.ipcRenderer = ipcRenderer; } catch(e){ /* fallback placeholder */ }
}
if(!ipcRenderer){
  // If preload/nodeIntegration unexpectedly off, attach minimal shim so later code won't crash
  window.ipcRenderer = ipcRenderer = { send: ()=>{}, on: ()=>{}, invoke: async()=>{} };
}
let activityModule = (window.__activityModule)||null; if(!activityModule){ try { activityModule = require('../scripts/stats_activity'); } catch(_){ } }
function send(ch,p){ ipcRenderer.send(ch,p); }

// ================= Compact Topbar (icons) =================
let __statsPanelSide = 'right';
function __setPanelSideUi(side){
  try {
    __statsPanelSide = (side === 'left') ? 'left' : 'right';
    const btn = document.getElementById('spPanelSide');
    if(btn) btn.dataset.side = __statsPanelSide;
  } catch(_){ }
}

function bindStatsTopbar(){
  const byId = (id)=> document.getElementById(id);

  const sideBtn = byId('spPanelSide');
  if(sideBtn){
    sideBtn.addEventListener('click', ()=>{
      ipcRenderer.send('stats-toggle-side');
      __setPanelSideUi(__statsPanelSide === 'left' ? 'right' : 'left');
    });
  }

  byId('spBack')?.addEventListener('click', ()=> ipcRenderer.send('stats-toggle'));
  byId('spSettings')?.addEventListener('click', ()=> ipcRenderer.send('open-settings'));

  // Update badge: show when update available
  const updateBadge = byId('spUpdateBadge');
  if(updateBadge){
    const showBadge = () => { updateBadge.hidden = false; };
    const hideBadge = () => { updateBadge.hidden = true; };
    ipcRenderer.invoke('updater-get-status').then(st => {
      if(st && st.availableUpdate) showBadge();
    }).catch(()=>{});
    ipcRenderer.on('updater-update-available', showBadge);
    ipcRenderer.on('updater-update-not-available', hideBadge);
  }
}

if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindStatsTopbar);
else bindStatsTopbar();

// (Stats mode: broker controls are intentionally hidden in topbar)

// Sync side changes coming from main (e.g., toggled in board view)
ipcRenderer.on('stats-side-updated', (_e, p)=>{
  const side = p && p.side;
  __setPanelSideUi(side);
});

// Listen for settings updates to reload sound preferences
ipcRenderer.on('settings-updated', ()=>{
  try {
    if(window.__STATS_SOUNDS__ && typeof window.__STATS_SOUNDS__.loadSettings === 'function'){
      window.__STATS_SOUNDS__.loadSettings();
    }
  } catch(e){ console.warn('[stats_panel] Failed to reload sound settings:', e); }
});

// ================= Runtime State =================
let metricVisibility = {}; // runtime copy controlling row visibility
const BINARY_METRICS = ['firstKill','race5','race10','race15','race20','firstTower','firstInhibitor','firstBaron','quadra','penta'];
const COUNT_METRICS = ['killCount','towerCount','inhibitorCount','baronCount','dragonCount'];
function parseTs(raw){ if(raw==null) return Infinity; if(typeof raw==='number'&&!isNaN(raw)) return raw>36000?Math.floor(raw/1000):raw; if(typeof raw==='string'){ const v=raw.trim(); if(/^\d+$/.test(v)){ const n=Number(v); return n>36000?Math.floor(n/1000):n; } if(/^(\d{1,2}:){1,2}\d{1,2}$/.test(v)){ const p=v.split(':').map(n=>Number(n)||0); if(p.length===2) return p[0]*60+p[1]; if(p.length===3) return p[0]*3600+p[1]*60+p[2]; } } return Infinity; }
let prevMatchUrls = { A: null, B: null };
let followLatestLiveGame = true;
let lastLiveGamesSig = '';
let teamNamesSource = 'grid'; // 'grid' or 'excel' - Excel has priority
let _animSuppressFirstData = true; // extend suppression +2s on first data after reset/load
let metricsOrder = ['firstKill','firstTower','firstBaron','firstInhibitor','race5','race10','race15','race20','killCount','towerCount','inhibitorCount','baronCount','dragonCount','dragonOrders','quadra','penta'];
let metricsOrderMutable = [...metricsOrder];
const metricLabels = { firstKill:'First Blood', killCount:'Kills', race5:'Race 5', race10:'Race 10', race15:'Race 15', race20:'Race 20', firstTower:'First Tower', firstInhibitor:'First Inhib', firstBaron:'First Baron', towerCount:'Towers', inhibitorCount:'Inhibitors', baronCount:'Barons', dragonCount:'Dragons', dragonOrders:'Dragon Orders', quadra:'Quadra', penta:'Penta' };
let lastOrderSig = null;
let __prevValues = {}; // cell previous values
let lastGameRendered = null;

let liveDataset = null, cachedLive = null, currentLiveGame = null, currentGame = null; // game selection
let swapTeams = false; // manual mode swap
let __currentLayoutMode = 'split'; // tracks layout mode for single-window disable logic
// Manual mode data
let manualData = { team1Name:'Team 1', team2Name:'Team 2', gameStats: { '1': makeEmptyGame() } };

// ================= Team Header Utilities =================
function setTeamHeader(idx, rawText, opts = {}){
  const source = opts.fromExcel ? 'excel' : 'grid';
  // Excel имена имеют приоритет - не перезаписываем если уже есть Excel
  if(source === 'grid' && teamNamesSource === 'excel'){
    return; // skip grid updates once Excel names are set
  }
  if(source === 'excel') teamNamesSource = 'excel';
  
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
  // Team names are now read-only (sourced from Excel K4/N4) - no dblclick edit
  const text = (rawText||'').trim() || ('Team '+idx);
  if(wrap.textContent === text) return; // no change
  wrap.textContent = text;
  wrap.title = text; // tooltip full name
  // Broadcast both team names to main so board can sync (debounced minimal overhead)
  // Skip if this update came from Excel (Excel broadcasts directly to board)
  if(!opts.fromExcel){
    try {
      const t1 = document.querySelector('#lt-team1 .teamNameWrap')?.textContent || 'Team 1';
      const t2 = document.querySelector('#lt-team2 .teamNameWrap')?.textContent || 'Team 2';
      ipcRenderer.send('lol-team-names-set', { team1: t1, team2: t2 });
    } catch(_){ }
  }
}

function makeEmptyGame(){
  return { firstKill:null, firstKillAt:'', killCount:{}, race5:null,race5At:'', race10:null,race10At:'', race15:null,race15At:'', race20:null,race20At:'', firstTower:null, firstTowerAt:'', firstInhibitor:null, firstInhibitorAt:'', firstBaron:null, firstBaronAt:'', towerCount:{}, inhibitorCount:{}, baronCount:{}, dragonCount:{}, dragonOrders:{}, dragonOrderSequence:[], quadra:null, quadraAt:'', penta:null, pentaAt:'' };
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

function renderManual(){ renderLol(manualSnapshotCurrent(), true); applyWinLose(); }

// Team names are now read-only from Excel (K4/N4)
// Manual mode team renaming functions preserved for internal bucket renaming only
function renameTeamInternal(idx,v){ const cur = idx===1? manualData.team1Name: manualData.team2Name; const old=cur; if(idx===1) manualData.team1Name=v; else manualData.team2Name=v; Object.values(manualData.gameStats).forEach(gs=>{ ['killCount','towerCount','inhibitorCount','baronCount','dragonCount','dragonTimes'].forEach(f=>{ const bucket=gs[f]; if(!bucket) return; if(bucket[old]!=null){ bucket[v]=bucket[old]; delete bucket[old]; } }); if(gs.firstKill===old) gs.firstKill=v; ['race5','race10','race15','race20','firstTower','firstInhibitor','firstBaron','quadra','penta','winner'].forEach(b=>{ if(gs[b]===old) gs[b]=v; }); }); renderManual(); }

function applyRaceFromKills(gs){ const bucket = gs.killCount||{}; [ ['race5',5], ['race10',10], ['race15',15], ['race20',20] ].forEach(([key,n])=>{ if(!gs[key]){ const t1=bucket[manualData.team1Name]||0; const t2=bucket[manualData.team2Name]||0; if(t1===n || t2===n) gs[key]= t1===n? manualData.team1Name: manualData.team2Name; } }); }

function handleManualAction(metric, side, isRemove){
  const g = manualData.gameStats[currentGame]; if(!g) return;
  const team = side==='t1'? manualData.team1Name: manualData.team2Name;
  if(BINARY_METRICS.includes(metric)){
    if(isRemove){ if(g[metric]===team) g[metric]=null; } else { g[metric]=team; }
  } else if(metric==='dragonCount'){
    const bucket=g.dragonCount ||= {}; const seq = g.dragonOrderSequence ||= [];
    if(isRemove){ if(bucket[team]>0){ bucket[team]--; for(let i=seq.length-1;i>=0;i--){ if(seq[i]===team){ seq.splice(i,1); break; } } syncDragonCounts(g); } }
    else { bucket[team]=(bucket[team]||0)+1; seq.push(team); syncDragonCounts(g); }
  } else if(COUNT_METRICS.includes(metric)){
    const bucket=g[metric] ||= {};
    if(isRemove){ if(bucket[team]>0) bucket[team]--; }
    else { bucket[team]=(bucket[team]||0)+1; if(metric==='killCount') applyRaceFromKills(g); }
  }
  renderManual();
}
function handleManualClick(metric, side){ handleManualAction(metric, side, false); }
function handleManualRightClick(metric, side){ handleManualAction(metric, side, true); }

function syncDragonCounts(g){ const t1=manualData.team1Name, t2=manualData.team2Name; g.dragonCount[t1]=g.dragonOrderSequence.filter(t=>t===t1).length; g.dragonCount[t2]=g.dragonOrderSequence.filter(t=>t===t2).length; }


// ================= Helpers =================
function isLolMatchUrl(u){ try { const url=new URL(u); if(!/portal\.grid\.gg/.test(url.hostname)) return false; return /lol/.test(url.pathname); } catch(_){ return false; } }
function isGridMatchUrl(u){ try { const url=new URL(u); return /portal\.grid\.gg/.test(url.hostname) && /\/(lol|cs2|dota2)\//.test(url.pathname); } catch(_){ return false; } }
function detectGameFromUrl(u){ try { const m = new URL(u).pathname.match(/\/(lol|cs2|dota2)\//); return m ? m[1] : null; } catch(_){ return null; } }

// ================= Game-Aware Metrics =================
let currentGridGame = null; // 'lol' | 'cs2' | 'dota2' | null
const GAME_LABELS = { lol: 'LoL', cs2: 'CS2', dota2: 'Dota 2' };
const GAME_METRICS = {
  lol: null, // null = all metrics (default full set)
  cs2: ['killCount'],
  dota2: null, // null = all metrics (same as LoL for now)
};
function updateGameBadge(game){
  const el = document.getElementById('gameBadge');
  if(!el) return;
  const label = game ? (GAME_LABELS[game] || game.toUpperCase()) : '—';
  el.textContent = label;
  el.dataset.game = game || '';
}
function applyGameMetrics(game){
  const allowed = game ? GAME_METRICS[game] : null;
  if(!allowed){
    // Show all (use current metricVisibility / template)
    applyVisibility();
    return;
  }
  // Hide metrics not in allowed list, show those that are
  metricsOrder.forEach(id=>{
    const row = document.querySelector(`tr[data-metric="${id}"]`);
    if(!row) return;
    if(allowed.includes(id)){
      row.style.display = metricVisibility[id] === false ? 'none' : '';
    } else {
      row.style.display = 'none';
    }
  });
}
function setGridGame(game){
  if(currentGridGame === game) return;
  currentGridGame = game;
  updateGameBadge(game);
  applyGameMetrics(game);
}
function cell(id, side){ return document.getElementById(`${id}-${side}`); }
// Helper: Manual mode is now a toggle button with data-active attribute
function isManualOn(){ const el=document.getElementById('lolManualMode'); return el && el.getAttribute('data-active')==='true'; }
function setManualOn(v){ const el=document.getElementById('lolManualMode'); if(el){ el.setAttribute('data-active', v?'true':'false'); el.classList.toggle('active', !!v); } document.body.classList.toggle('manual-mode', !!v); }
function sendPersist(){ send('lol-stats-settings',{ manualMode: isManualOn(), metricVisibility, metricOrder: metricsOrderMutable, template: currentTemplate }); }

// ================= Template Presets =================
const TEMPLATE_MINI_HIDE = ['firstKill','firstTower','firstBaron','firstInhibitor','race5','race10','race15','race20','towerCount','dragonOrders'];
let currentTemplate = 'all';
function applyTemplate(name){
  currentTemplate = name;
  if(name === 'mini'){
    metricsOrder.forEach(id=>{ metricVisibility[id] = !TEMPLATE_MINI_HIDE.includes(id); });
  } else {
    metricsOrder.forEach(id=>{ metricVisibility[id] = true; });
  }
  applyVisibility();
  sendPersist();
  // Update button label
  const btn=document.getElementById('gsTemplateBtn'); if(btn) btn.textContent='☰ '+name.charAt(0).toUpperCase()+name.slice(1);
}

// ================= Metrics UI =================
function buildMetricToggles(){ const wrap=document.getElementById('metricToggles'); if(!wrap) return; wrap.innerHTML=''; metricsOrder.forEach(id=>{ const label=document.createElement('label'); label.className='metricToggle'; const cb=document.createElement('input'); cb.type='checkbox'; cb.checked = metricVisibility[id] !== false; cb.onchange=()=>{ metricVisibility[id]=cb.checked; sendPersist(); applyVisibility(); }; label.appendChild(cb); label.appendChild(document.createTextNode(metricLabels[id]||id)); wrap.appendChild(label); }); }
function applyVisibility(){
  let hidden=0; let total=0;
  metricsOrder.forEach(id=>{
    const row = document.querySelector(`tr[data-metric="${id}"]`);
    if(!row) return; total++; const off = (metricVisibility[id] === false); if(off) hidden++; row.style.display = off?'none':'';
  });
  // Ensure any newly introduced metrics default to visible
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
  if(BINARY_METRICS.includes(id) || id==='dragonOrders') tr.dataset.type='binary';
    else if(COUNT_METRICS.includes(id)) tr.dataset.type='count';
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
  attachManualHandlers();
  initDragAndDrop();
  if(activityModule && activityModule.recalc) activityModule.recalc();
}

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
  // Activity heat bar bump logic
  // Suppress during reorder / team swap transitional updates
  const suppress = (window.__SUPPRESS_STATS_ANIM_UNTIL && performance.now() < window.__SUPPRESS_STATS_ANIM_UNTIL);
  if(!suppress && activityModule && activityModule.onMetricUpdate){
    try {
      let shouldBump = false;
  if(newVal === '✓' && prevVal !== '✓') shouldBump = true; // binary acquisition (was 1/0 previously)
      else if(/^[0-9]+$/.test(newVal || '')){
        const nNew = parseInt(newVal,10);
        const nPrev = /^[0-9]+$/.test(prevVal||'') ? parseInt(prevVal,10) : -Infinity;
        if(nNew > nPrev) shouldBump = true;
      } else if(id==='quadra' || id==='penta'){
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
        setTimeout(()=>{ c.classList.remove('gs-animating'); }, dur+80);
      }
    }
  } catch(_){ }
}

// ================= LoL Update Handling =================
ipcRenderer.on('lol-stats-update', (_, payload)=>{ if(isManualOn()) return; try {
  const firstRender = (lastGameRendered == null);
  if(firstRender){ window.__SUPPRESS_STATS_ANIM_UNTIL = Math.max(window.__SUPPRESS_STATS_ANIM_UNTIL||0, performance.now() + 5000); }
  // Extend suppression +2s AFTER first data arrives (chains on top of existing deadline)
  if(_animSuppressFirstData){
    _animSuppressFirstData = false;
    const base = Math.max(window.__SUPPRESS_STATS_ANIM_UNTIL||0, performance.now());
    window.__SUPPRESS_STATS_ANIM_UNTIL = base + 2000;
  }
  liveDataset = payload; cachedLive = payload; const games=Object.keys(payload.gameStats||{}).map(Number).sort((a,b)=>a-b); const sig = games.join(','); if(followLatestLiveGame && games.length) currentLiveGame = games[games.length-1]; if(sig !== lastLiveGamesSig){ lastLiveGamesSig = sig; if(followLatestLiveGame && games.length) currentLiveGame = games[games.length-1]; }
  updateGameSelect(); renderLol(payload); } catch(e){} });

// ================= Reset & URL Change =================
function clearLol(){
  metricsOrder.forEach(id=>{
    const isCount = COUNT_METRICS.includes(id);
    const isBinary = BINARY_METRICS.includes(id) || id==='dragonOrders';
    ['t1','t2'].forEach(side=>{
      const c=document.getElementById(`${id}-${side}`);
      if(!c) return;
      let val='';
      if(isCount) val='0';
      else if(isBinary){
        if(id==='dragonOrders') val=''; else val='✗';
      }
      c.textContent = val;
      c.classList.remove('wl-win','wl-lose');
      const key=id+':'+side;
      delete __prevValues[key];
      const row = c.parentElement;
      if(row && row.dataset) delete row.dataset.win;
    });
  });
}

ipcRenderer.on('stats-url-update', (_, { slot, url })=>{ try {
  // Detect game type from Grid URL
  const detectedGame = detectGameFromUrl(url);
  if(detectedGame) setGridGame(detectedGame);
  const was = prevMatchUrls[slot]; const nowIs = isGridMatchUrl(url) || isLolMatchUrl(url); if(nowIs){ if(was && was!==url){ liveDataset = null; cachedLive=null; currentLiveGame=null; lastGameRendered=null; followLatestLiveGame=true; lastLiveGamesSig=''; teamNamesSource = 'grid'; clearLol(); updateGameSelect(); _animSuppressFirstData = true; window.__SUPPRESS_STATS_ANIM_UNTIL = performance.now() + 5000; ipcRenderer.send('lol-stats-reset'); } prevMatchUrls[slot]=url; } } catch(_){ } });

// ================= Credentials =================

function ensureOption(select, value){ if(![...select.options].some(o=>o.value===value)){ const opt=document.createElement('option'); opt.value=value; opt.textContent=value.replace(/^https?:\/\/(www\.)?/,'').slice(0,40); select.appendChild(opt); } }

// ================= Init From Main (stats-init) =================
ipcRenderer.on('stats-init', (_, cfg) => { try { const sa=document.getElementById('srcA'); const sb=document.getElementById('srcB'); if(sa){ ensureOption(sa, cfg.urls.A); sa.value = cfg.urls.A; } if(sb){ ensureOption(sb, cfg.urls.B); sb.value = cfg.urls.B; } if(cfg.mode) __currentLayoutMode = cfg.mode; setManualOn(!!cfg.lolManualMode); const sw=!!cfg.singleWindow; const swEl=document.getElementById('singleWindowMode'); if(swEl){ swEl.checked=sw; if(typeof window.__applySingleWindowUi==='function') window.__applySingleWindowUi(sw); } metricVisibility = cfg.lolMetricVisibility || {}; if(Array.isArray(cfg.lolMetricOrder) && cfg.lolMetricOrder.length){ const defaults = [...metricsOrder]; const known = new Set(defaults); const filtered = cfg.lolMetricOrder.filter(m=> known.has(m)); if(filtered.length){ const missing = defaults.filter(m=> !filtered.includes(m)); metricsOrder = filtered.concat(missing); metricsOrderMutable = metricsOrder.slice(); } }
  if(cfg.lolManualData && typeof cfg.lolManualData==='object'){
    try { manualData = JSON.parse(JSON.stringify(cfg.lolManualData)); } catch(_){ }
  }
  if(cfg.lolMetricMarks && typeof cfg.lolMetricMarks==='object'){
    window.__LOL_CHECK_STATE = JSON.parse(JSON.stringify(cfg.lolMetricMarks));
  }
  if(cfg.lolTemplate && cfg.lolTemplate !== currentTemplate){ applyTemplate(cfg.lolTemplate); }
  buildMetricToggles(); ensureRows(); applyVisibility(); if(cfg.statsConfig && window.__STATS_CONFIG__){ window.__STATS_CONFIG__.set(cfg.statsConfig); }
  if(isManualOn()){ currentGame = Object.keys(manualData?.gameStats||{'1':1})[0] || '1'; updateGameSelect(); renderManual(); }
  ipcRenderer.send('lol-stats-settings',{ manualMode: isManualOn(), manualData, metricMarks: window.__LOL_CHECK_STATE });
  __setPanelSideUi(cfg && cfg.side);
 } catch(e) {} });
ipcRenderer.on('stats-config-applied', (_e,cfg)=>{ if(cfg && window.__STATS_CONFIG__) window.__STATS_CONFIG__.set(cfg); applyWinLose(); });

// Team names from Excel K4/N4 (read-only, updates headers)
ipcRenderer.on('excel-team-names', (_e, { team1, team2 })=>{
  try {
    const t1 = (team1 || '').trim() || 'Team 1';
    const t2 = (team2 || '').trim() || 'Team 2';
    // fromExcel: true prevents re-broadcasting via lol-team-names-set (Excel already broadcasts to board)
    setTeamHeader(1, t1, { fromExcel: true });
    setTeamHeader(2, t2, { fromExcel: true });
    // Also update manual mode data for consistency
    if(manualData.team1Name !== t1 || manualData.team2Name !== t2){
      renameTeamInternal(1, t1);
      renameTeamInternal(2, t2);
    }
  } catch(e){ /* swallow */ }
});

function applyWinLose(){
  const wlCfg = window.__STATS_CONFIG__ && window.__STATS_CONFIG__.get && window.__STATS_CONFIG__.get();
  const wlDisabled = wlCfg && wlCfg.winLoseEnabled === false;
  // Reset header classes
  const th1 = document.getElementById('lt-team1');
  const th2 = document.getElementById('lt-team2');
  if(th1) th1.classList.remove('wl-win','wl-lose');
  if(th2) th2.classList.remove('wl-win','wl-lose');
  metricsOrder.forEach(id=>{
    const row = document.querySelector(`tr[data-metric="${id}"]`);
    if(!row) return;
    const c1 = document.getElementById(`${id}-t1`);
    const c2 = document.getElementById(`${id}-t2`);
    if(!c1 || !c2) return;
    c1.classList.remove('wl-win','wl-lose');
    c2.classList.remove('wl-win','wl-lose');
    row.removeAttribute('data-win');
    if(wlDisabled) return;
    const t1 = (c1.textContent||'').trim();
    const t2 = (c2.textContent||'').trim();
    let n1=0, n2=0;
    if(BINARY_METRICS.includes(id)){
      n1 = t1==='✓'?1:0; n2 = t2==='✓'?1:0;
    } else if(COUNT_METRICS.includes(id)){
      n1 = parseInt(t1,10); n2 = parseInt(t2,10); if(isNaN(n1)) n1=0; if(isNaN(n2)) n2=0;
    } else if(id==='dragonOrders'){
      n1 = t1? t1.split(/\s+/).filter(Boolean).length:0; n2 = t2? t2.split(/\s+/).filter(Boolean).length:0;
    } else {
      n1 = parseFloat(t1)||0; n2 = parseFloat(t2)||0;
    }
    if(n1===0 && n2===0) return;
    if(n1>n2){ c1.classList.add('wl-win'); if(n2>0) c2.classList.add('wl-lose'); row.dataset.win='1'; }
    else if(n2>n1){ c2.classList.add('wl-win'); if(n1>0) c1.classList.add('wl-lose'); row.dataset.win='2'; }
    else { row.dataset.win='tie'; }
  });
  // Apply header highlight based on game data winner
  if(!wlDisabled && th1 && th2){
    const winner = window.__CURRENT_GAME_WINNER;
    const teams = window.__CURRENT_GAME_TEAMS;
    if(winner && teams){
      if(winner === teams.t1){ th1.classList.add('wl-win'); th2.classList.add('wl-lose'); }
      else if(winner === teams.t2){ th2.classList.add('wl-win'); th1.classList.add('wl-lose'); }
    }
  }
}
// (Heat bar listener lives in stats_theme.js)

// ================= UI Event Bindings =================
function bindBasic(){
  const byId = id => document.getElementById(id);
  const safe = (id, fn)=>{ const el=byId(id); if(el) fn(el); };
  safe('srcA', el=> el.onchange = e=> send('stats-set-url',{slot:'A',url:e.target.value}));
  safe('srcB', el=> el.onchange = e=> send('stats-set-url',{slot:'B',url:e.target.value}));
  // Single-window mode: when ON, only one slot (A or B) is active; the other is stopped in main.
  (function(){
    const chk = byId('singleWindowMode'); if(!chk) return;
    const btnSplit = byId('modeSplit'); const btnVert = byId('modeVertical'); const btnA = byId('modeA'); const btnB = byId('modeB');
    const selA = byId('srcA'); const selB = byId('srcB');
    function applyUi(disable){
      if(btnSplit) btnSplit.disabled = !!disable;
      if(btnVert) btnVert.disabled = !!disable;
      if(btnA) btnA.disabled = !!disable;
      if(btnB) btnB.disabled = !!disable;
      if(selB) selB.disabled = !!disable && (__currentLayoutMode==='focusA');
      if(selA) selA.disabled = !!disable && (__currentLayoutMode==='focusB');
    }
    chk.addEventListener('change', ()=>{
      const enabled = !!chk.checked;
      applyUi(enabled);
      send('stats-single-window',{ enabled });
    });
    // Expose for initial apply from stats-init
    window.__applySingleWindowUi = applyUi;
  })();
  [['modeSplit','split'],['modeVertical','vertical'],['modeA','focusA'],['modeB','focusB']].forEach(([id,mode])=>{
    safe(id, el=> el.onclick = ()=>{ send('stats-layout',{mode}); __currentLayoutMode = mode; });
  });
  safe('toggleSide', el=> el.onclick = ()=>{ send('stats-toggle-side'); });
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
      teamNamesSource = 'grid'; // reset source priority
      setTeamHeader(1, 'Team 1', false); setTeamHeader(2, 'Team 2', false);
      // Additional manual dataset reset if in manual mode
      if(isManualOn()){
        manualData = { team1Name:'Team 1', team2Name:'Team 2', gameStats:{ '1': makeEmptyGame() } };
        currentGame='1';
        updateGameSelect();
        renderManual();
      }
      // Clear checkbox marks & persist
      window.__LOL_CHECK_STATE = {};
      ipcRenderer.send('lol-metric-marks-set', window.__LOL_CHECK_STATE);
      ipcRenderer.send('lol-manual-data-set', manualData);
      // Reset aggregator in main (does not navigate)
      ipcRenderer.send('lol-stats-reset');
      // Request a reload of slot A ONLY (keep exact same URL; no cache-bust param added)
      ipcRenderer.send('stats-reload-slot', { slot: 'A' });
      // Re‑signal injected scripts (in case they are already present) after a short delay
      setTimeout(()=>{
        try { window.postMessage({ type:'restart_data_collection', reason:'manual-reset' }, '*'); } catch(_){ }
      }, 150);
    } catch(e){ console.warn('lolReset failed', e); }
  };
}

function bindSettings(){
  // Manual mode is now a button — click handler is in init()
  // Template dropdown
  const tplBtn = document.getElementById('gsTemplateBtn');
  const tplMenu = document.getElementById('gsTemplateMenu');
  if(tplBtn && tplMenu){
    tplBtn.addEventListener('click', (e)=>{ e.stopPropagation(); tplMenu.style.display = tplMenu.style.display==='none'?'block':'none'; });
    tplMenu.querySelectorAll('.gsTemplateItem').forEach(item=>{
      item.addEventListener('click', (e)=>{ e.stopPropagation(); applyTemplate(item.dataset.template); tplMenu.style.display='none'; });
    });
    document.addEventListener('click', ()=>{ tplMenu.style.display='none'; });
  }
}

// Placeholder functions for features referenced later (map & manual editing) to avoid ReferenceErrors before extraction completes.
function attachManualHandlers(){
  metricsOrder.forEach(id=>{
    ['t1','t2'].forEach(side=>{
      const el = cell(id, side);
      if(!el || el.dataset.bound) return;
      el.dataset.bound='1';
      el.addEventListener('click', ()=>{ if(!isManualOn()) return; handleManualClick(id, side); });
      el.addEventListener('contextmenu', e=>{ if(!isManualOn()) return; e.preventDefault(); handleManualRightClick(id, side); return false; });
      el.title='LMB: + / set, RMB: - / clear';
    });
  });
}
function initDragAndDrop(){ const body=document.getElementById('lt-body'); if(!body) return; body.querySelectorAll('tr').forEach(tr=>{ tr.addEventListener('dragstart', ev=>{ tr.classList.add('dragging'); ev.dataTransfer.effectAllowed='move'; }); tr.addEventListener('dragend', ()=>{ tr.classList.remove('dragging'); body.querySelectorAll('.drop-target').forEach(r=>r.classList.remove('drop-target')); }); }); body.addEventListener('dragover', ev=>{ ev.preventDefault(); const after=getAfterRow(body, ev.clientY); body.querySelectorAll('.drop-target').forEach(r=>r.classList.remove('drop-target')); if(after) after.classList.add('drop-target'); }); body.addEventListener('drop', ev=>{ ev.preventDefault(); const after=getAfterRow(body, ev.clientY); const dragging=body.querySelector('tr.dragging'); if(!dragging) return; if(after) body.insertBefore(dragging, after); else body.appendChild(dragging); metricsOrderMutable=[...body.querySelectorAll('tr')].map(r=>r.dataset.metric); metricsOrder=[...metricsOrderMutable]; lastOrderSig = null; // Suppress animations briefly while DOM reshuffles
  window.__SUPPRESS_STATS_ANIM_UNTIL = performance.now() + 450;
  ensureRows(); if(isManualOn()) renderManual(); else if(liveDataset) renderLol(liveDataset); sendPersist(); }); }
function getAfterRow(body,y){ const rows=[...body.querySelectorAll('tr:not(.dragging)')]; return rows.find(r=> y <= r.getBoundingClientRect().top + r.getBoundingClientRect().height/2); }
let addBtn; let gameSelect; let headerH1;
/** Convert dragonTimes to ordered indices per team */
function dragonTimesToOrders(dragonTimes, t1, t2){
  const arr=[]; (dragonTimes[t1]||[]).forEach(ts=> arr.push({ team: t1, ts: parseTs(ts) })); (dragonTimes[t2]||[]).forEach(ts=> arr.push({ team: t2, ts: parseTs(ts) }));
  arr.sort((a,b)=> a.ts-b.ts); let idx=1; const map={}; arr.forEach(e=>{ if(!isFinite(e.ts)) return; (map[e.team]=map[e.team]||[]).push(idx++); }); return map;
}
function updateGameSelect(){
  if(!gameSelect) return;
  const manualOn=isManualOn();
  gameSelect.innerHTML='';
  const placeholder=document.createElement('option');
  placeholder.value=''; placeholder.disabled=true; placeholder.textContent='Game -';
  let any=false;
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
function renderLol(payload, manual=false){
  try {
    ensureRows();
    applyVisibility();
    applyGameMetrics(currentGridGame);
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
    const headerDisp1 = dispTeam1 || 'Team 1';
    const headerDisp2 = dispTeam2 || 'Team 2';
  setTeamHeader(1, headerDisp1, true);
  setTeamHeader(2, headerDisp2, true);
  function setBinary(field, filledSet){ const v=s[field]; if(!v) return; filledSet.add(field); const idx = v===t1Key?1:(v===t2Key?2:0); if(!idx) return; setText(field,'t1', idx===1 ? '✓' : '✗'); setText(field,'t2', idx===2 ? '✓' : '✗'); }
    const DEFAULT_ZERO_COUNT_FIELDS = ['killCount','towerCount','inhibitorCount','baronCount','dragonCount'];
    function setCount(field){ const bucket = s[field] || {}; const has1 = Object.prototype.hasOwnProperty.call(bucket, dispTeam1); const has2 = Object.prototype.hasOwnProperty.call(bucket, dispTeam2); if(!has1 && !has2){ if(DEFAULT_ZERO_COUNT_FIELDS.includes(field)){ ['t1','t2'].forEach(side=>{ const key=field+':'+side; if(!__prevValues[key]) __prevValues[key]='0'; setText(field, side, '0'); }); } else { setText(field,'t1',''); setText(field,'t2',''); } return; } let v1 = has1 ? bucket[dispTeam1] : 0; let v2 = has2 ? bucket[dispTeam2] : 0; if(v1 === undefined || v1 === null || isNaN(v1)) v1 = 0; if(v2 === undefined || v2 === null || isNaN(v2)) v2 = 0; setText(field,'t1', v1 === 0 ? '0' : v1); setText(field,'t2', v2 === 0 ? '0' : v2); }
  // winner header highlight omitted
    const filledBinary = new Set();
    ['firstKill','race5','race10','race15','race20','firstTower','firstInhibitor','firstBaron'].forEach(f=> setBinary(f, filledBinary));
    COUNT_METRICS.forEach(setCount);
    // Dragon orders
    (function(){ let orders1=[], orders2=[]; if(s.dragonOrders){ orders1 = s.dragonOrders[dispTeam1]||[]; orders2 = s.dragonOrders[dispTeam2]||[]; } else if(s.dragonTimes){ const map = dragonTimesToOrders(s.dragonTimes, team1Name, team2Name); orders1 = map[dispTeam1]||[]; orders2 = map[dispTeam2]||[]; } setText('dragonOrders','t1', orders1.join(' ')); setText('dragonOrders','t2', orders2.join(' ')); })();
    if(s.quadra) setBinary('quadra', filledBinary); if(s.penta) setBinary('penta', filledBinary);
  ['firstKill','race5','race10','race15','race20','firstTower','firstInhibitor','firstBaron','quadra','penta'].forEach(m=>{ if(!filledBinary.has(m)){ setText(m,'t1','✗'); setText(m,'t2','✗'); } });
    // Store winner info from game data for header coloring
    window.__CURRENT_GAME_WINNER = s.winner || null;
    window.__CURRENT_GAME_TEAMS = { t1: dispTeam1, t2: dispTeam2 };
    // After all cell values are updated compute win/lose highlighting
    applyWinLose();
  } catch(e) { /* swallow */ }
}

// ================= Startup =================
(function init(){
  // Suppress animations for 5s on panel startup (protects against backlog replay)
  window.__SUPPRESS_STATS_ANIM_UNTIL = performance.now() + 5000;
  bindBasic();
  bindReset();
  bindSettings();
  buildMetricToggles();
  ensureRows();
  if(activityModule && activityModule.init) activityModule.init();
  // Apply any pending heat bar config that arrived before DOM was ready
  if(window.__applyPendingHeatBar) window.__applyPendingHeatBar();
  applyVisibility();
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
      window.__SUPPRESS_STATS_ANIM_UNTIL = performance.now() + 450;
      const rawKeys = Object.keys(manualData.gameStats||{});
      const keys = rawKeys.filter(k=>/^\d+$/.test(k));
      let maxN = 0; keys.forEach(k=>{ const n=Number(k); if(Number.isFinite(n) && n>maxN) maxN=n; });
      const nextNum = maxN + 1;
      const next = String(nextNum);
      manualData.gameStats[next] = makeEmptyGame();
      currentGame = next;
      updateGameSelect();
      renderManual();
      ipcRenderer.send('lol-manual-data-set', manualData);
  } catch(err){ }
  };
  if(gameSelect){
    gameSelect.onchange=()=>{ const manualOn=isManualOn(); const val=gameSelect.value; if(!val) return; window.__SUPPRESS_STATS_ANIM_UNTIL = performance.now() + 450;
      if(manualOn){ currentGame=val; renderManual(); } else { currentLiveGame=Number(val); const games=Object.keys(liveDataset?.gameStats||{}).map(Number).sort((a,b)=>a-b); const last=games[games.length-1]; followLatestLiveGame = (currentLiveGame===last); if(liveDataset) renderLol(liveDataset); }
      if(activityModule && activityModule.recalc) activityModule.recalc(); };
  }
  document.addEventListener('mousedown', e=>{ const td=e.target.closest && e.target.closest('td.editable'); if(td) td.classList.add('pressing'); });
  document.addEventListener('mouseup', ()=>{ document.querySelectorAll('td.pressing').forEach(td=> td.classList.remove('pressing')); });
  // (per-section collapse handlers consolidated in stats_collapse.js)
  // Swap teams
  document.getElementById('swapTeamsBtn').onclick=()=>{ 
    swapTeams=!swapTeams; 
    document.getElementById('swapTeamsBtn').classList.toggle('active', swapTeams); 
    // Suppress heatbar/cell bump animations briefly while values visually reshuffle
    window.__SUPPRESS_STATS_ANIM_UNTIL = performance.now() + 450;
    if(isManualOn()) { 
      renderManual(); 
    } else { 
      const snap = liveDataset || cachedLive; 
      if(snap) renderLol(snap); 
    } 
    try { 
      const t1 = document.querySelector('#lt-team1 .teamNameWrap')?.textContent || 'Team 1';
      const t2 = document.querySelector('#lt-team2 .teamNameWrap')?.textContent || 'Team 2';
      ipcRenderer.send('lol-team-names-set', { team1: t1, team2: t2 });
    } catch(_){ }
    applyWinLose();
  };
  document.getElementById('swapTeamsBtn').title='Swap display order of teams';
  // Team names are read-only (from Excel K4/N4) - no dblclick editing
  // Manual toggle logic (button, not checkbox)
  document.getElementById('lolManualMode').addEventListener('click', ()=>{
    const on = !isManualOn();
    setManualOn(on);
    sendPersist();
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
    if(activityModule && activityModule.recalc) activityModule.recalc();
  });
  updateGameSelect(); if(addBtn){ addBtn.setAttribute('aria-disabled','true'); addBtn.disabled=true; }
  // Lightweight self-test sample (only if no data after short delay)
  // Removed mock Alpha/Beta injection sample.
  // Ensure headers initialized & dblclick bound immediately (before first data payload)
  setTeamHeader(1, 'Team 1', false); setTeamHeader(2, 'Team 2', false);
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
      if(isManualOn()){
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
    ipcRenderer.send('lol-metric-marks-set', window.__LOL_CHECK_STATE);
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

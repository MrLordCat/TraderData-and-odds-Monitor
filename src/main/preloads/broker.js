// Preload for each broker BrowserView (clean refactored version)
const { ipcRenderer } = require('electron');
// Initial desired map (generic)
let desiredMap = 1;
let isLast = false; // global flag from main indicating final map should use match market for certain brokers
let mapConfigInitialized = false; // tracks if we've received the first set-map-config from main
const HOST = location.host;
const { collectOdds: collectOddsExt, getBrokerId } = require('../../brokers/extractors/index');
const { triggerMapChange } = require('../../brokers/mapNav');
// Allow main process to inject a forced broker id before DOM load
let BROKER_ID = (window.__FORCED_BROKER_ID || '').trim();
if(!BROKER_ID) BROKER_ID = getBrokerId(HOST);
// (No special bootstrap)
function safe(fn){ try { return fn(); } catch(e){} }
const safeSend = (channel, payload) => safe(()=> ipcRenderer.send(channel, payload));

// Zoom wheel fallback
window.addEventListener('wheel', (e)=>{ try { if(e.ctrlKey){ e.preventDefault(); safeSend('bv-zoom-wheel',{deltaY:e.deltaY}); } } catch(_){ } }, { passive:false });

// Zoom indicator
ipcRenderer.on('zoom-indicator', (_evt, factor)=>{
  try {
    let badge=document.getElementById('__zoom_indicator');
    if(!badge){
      badge=document.createElement('div');
      badge.id='__zoom_indicator';
      badge.style.cssText='position:fixed;top:22px;right:12px;z-index:999999;background:rgba(20,20,20,.75);color:#fff;padding:4px 10px;font:12px system-ui;border-radius:6px;backdrop-filter:blur(2px);box-shadow:0 2px 6px #0008;transition:opacity .25s;';
      document.documentElement.appendChild(badge);
    }
    badge.textContent=Math.round(factor*100)+'%';
    badge.style.opacity='1';
    clearTimeout(badge.__t);
    badge.__t=setTimeout(()=>{ badge.style.opacity='0'; },1200);
  } catch(_){ }
});

// Odds collection wrapper
function effectiveMap(){
  // For brokers that represent final map as match market -> if isLast enabled and desiredMap>0 use 0
  // Currently: bet365, rivalry
  if(isLast && desiredMap>0){
    if(BROKER_ID==='bet365' || BROKER_ID==='rivalry') return 0;
  }
  return desiredMap;
}
// Current selected game (global). Default 'lol'.
let __selectedGame = 'lol';
try { ipcRenderer.invoke('game-get').then(v=>{ if(v) __selectedGame=v; }).catch(()=>{}); } catch(_){ }
ipcRenderer.on('game-changed', (_e, game)=>{ try { if(typeof game==='string') __selectedGame=game; } catch(_){ } });

// Odds deduplication signature
let __lastOddsSig = '';

function getCurrentOdds(){
  const data = collectOddsExt(HOST, effectiveMap(), __selectedGame, { isLast });
  try { if(BROKER_ID && data && typeof data==='object') data.broker = BROKER_ID; } catch(_){ }
  return data;
}
// Force collect (always sends, updates signature)
ipcRenderer.on('collect-now', ()=> safe(()=>{
  const odds = getCurrentOdds();
  __lastOddsSig = odds?.odds ? JSON.stringify(odds.odds) : '';
  safeSend('bv-odds-update', odds);
}));

// Atomic map config listener - receives both map and isLast together to avoid race conditions
ipcRenderer.on('set-map-config', (_e, config)=>{
  try {
    const newMap = parseInt(config?.map, 10);
    const newIsLast = !!config?.isLast;
    const forceReselect = !!config?.force; // Force flag for periodic reselect
    const mapChanged = !Number.isNaN(newMap) && newMap !== desiredMap;
    const isLastChanged = newIsLast !== isLast;
    
    // Update state
    if(!Number.isNaN(newMap)) desiredMap = newMap;
    isLast = newIsLast;
    
    // Trigger navigation on: first init, value change, OR force reselect
    const shouldTrigger = !mapConfigInitialized || mapChanged || isLastChanged || forceReselect;
    mapConfigInitialized = true;
    
    if(shouldTrigger){
      __lastOddsSig = ''; // Reset to ensure new odds are sent
      triggerMapChange(HOST, desiredMap, { isLast });
    }
  } catch(_){ /* silent */ }
});

// Periodic odds loop with deduplication (only send if changed)
function sendOddsIfChanged(){
  try {
    const odds = getCurrentOdds();
    // Create signature from odds array only (skip broker/map metadata)
    const sig = odds?.odds ? JSON.stringify(odds.odds) : '';
    if(sig && sig !== __lastOddsSig){
      __lastOddsSig = sig;
      safeSend('bv-odds-update', odds);
    }
  } catch(_){ }
}
setInterval(sendOddsIfChanged, 1500);

// SPA URL watcher -> reassert map
let lastHref=location.href;
try {
  new MutationObserver(()=>{
    const href=location.href; if(href!==lastHref){ lastHref=href; [400,1200].forEach(d=> setTimeout(()=> safe(()=> triggerMapChange(HOST, desiredMap, { isLast })), d)); }
  }).observe(document, { subtree:true, childList:true });
} catch(_){ }

// Minimal close button (drag removed per requirement)
function injectCloseButton(){
  if(document.getElementById('__broker_close_btn')) return;
  const btn=document.createElement('button');
  btn.id='__broker_close_btn';
  btn.textContent='✕';
  btn.title='Close broker';
  btn.style.cssText='position:fixed;top:4px;right:6px;z-index:999999;background:rgba(20,20,25,.65);color:#cfd6e0;border:1px solid #334150;padding:2px 6px;font:11px system-ui;border-radius:6px;cursor:pointer;backdrop-filter:blur(3px);line-height:1;';
  btn.addEventListener('click', (e)=>{ e.stopPropagation(); safeSend('close-broker', BROKER_ID); });
  document.documentElement.appendChild(btn);
}
document.addEventListener('DOMContentLoaded', injectCloseButton);

// Reload helper button support
document.addEventListener('DOMContentLoaded', ()=>{
  const btn=document.getElementById('__reload_btn'); if(btn){ btn.addEventListener('click', ()=>{ try { location.reload(); } catch(_){} }); }
});

// Light ping so main can replay last map/placeholder odds promptly
window.addEventListener('DOMContentLoaded', ()=>{ try { ipcRenderer.send('bv-odds-update', { broker:'_ping' }); } catch(_){} });

// ================= Credential Auto-Fill & Capture =================
const { createCredentialFiller, hookCredentialCapture } = require('./credentials');
const credFiller = createCredentialFiller({ ipcRenderer, logPrefix: '[cred][broker]', maxAttempts: 75 });
ipcRenderer.on('apply-credentials', (_e, creds) => credFiller.onApplyCredentials(creds));
credFiller.createMutationObserver();
window.addEventListener('DOMContentLoaded', () => {
  try { hookCredentialCapture({ ipcRenderer, meta: { broker: BROKER_ID, hostname: location.hostname } }); } catch(_){ }
});

// --- Resize handles injection (edges & corners) ---
// (Resize handles removed: layout managed centrally; kept out to reduce preload surface)

// Fallback error page reload support: if current document has __reload_btn and data-bid on body
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('__reload_btn');
  if (btn) {
    btn.addEventListener('click', () => { try { location.reload(); } catch(e) {} });
  }
  // Error page: Close helper button support (contextIsolation-safe)
  try {
    const closeBtn = document.getElementById('__close_btn') || document.getElementById('close');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => { try { e.stopPropagation(); e.preventDefault(); safeSend('close-broker', BROKER_ID); } catch(_){} });
    }
  } catch(_){}
});

// Ensure map selection restored after reload if main already stored one
window.addEventListener('DOMContentLoaded', () => {
  try {
    // Ask main for lastMap value (using existing get-last-map via sending a ping back through renderer not available here)
    // Simpler: rely on periodic re-send triggered from main (already added). As a fallback we trigger a lightweight marker so main can re-send.
    require('electron').ipcRenderer.send('bv-odds-update', { broker:'_ping' });
  } catch(e) {}
});

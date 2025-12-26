// Preload for each broker BrowserView (clean refactored version)
const { ipcRenderer } = require('electron');
// Initial desired map (generic)
let desiredMap = 1;
let isLast = false; // global flag from main indicating final map should use match market for certain brokers
const HOST = location.host;
const { collectOdds: collectOddsExt, getBrokerId } = require('../../brokers/extractors');
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
  const data = collectOddsExt(HOST, effectiveMap(), __selectedGame);
  try { if(BROKER_ID && data && typeof data==='object') data.broker = BROKER_ID; } catch(_){ }
  return data;
}
// Force collect (always sends, updates signature)
ipcRenderer.on('collect-now', ()=> safe(()=>{
  const odds = getCurrentOdds();
  __lastOddsSig = odds?.odds ? JSON.stringify(odds.odds) : '';
  safeSend('bv-odds-update', odds);
}));

// Map change listener (reset signature to force fresh send)
ipcRenderer.on('set-map', (_e, mapVal)=>{
  const n=parseInt(mapVal,10); desiredMap=Number.isNaN(n)?1:n;
  __lastOddsSig = ''; // Reset to ensure new odds are sent
  triggerMapChange(HOST, desiredMap);
  [600,1500,3000].forEach(d=> setTimeout(()=> safe(()=> triggerMapChange(HOST, desiredMap)), d));
});
ipcRenderer.on('set-is-last', (_e, flag)=>{
  try { isLast = !!flag; } catch(_){ }
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
    const href=location.href; if(href!==lastHref){ lastHref=href; [400,1200].forEach(d=> setTimeout(()=> safe(()=> triggerMapChange(HOST, desiredMap)), d)); }
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

// (No special fallback logic)

// (Removed legacy BrowserView drag bar injection)

// ================= Credential Auto-Fill & Capture (Added) =================
let __lastCreds = null;
function __applyVal(el, val){
  if(!el) return;
  try { el.removeAttribute('readonly'); el.readOnly=false; el.disabled=false; } catch(_){ }
  try { el.focus(); } catch(_){ }
  try {
    const d=Object.getOwnPropertyDescriptor(el.__proto__,'value');
    if(d&&d.set) d.set.call(el,val); else el.value=val;
  } catch(_){ el.value=val; }
  try { el.dispatchEvent(new Event('input',{bubbles:true})); } catch(_){ }
  try { el.dispatchEvent(new Event('change',{bubbles:true})); } catch(_){ }
}
function __findUserInput(doc){
  const cands = Array.from(doc.querySelectorAll('input,textarea')).filter(el=>{
    try {
      const type=(el.getAttribute('type')||'text').toLowerCase();
      if(['hidden','submit','button','checkbox','radio','file','range','color','date','time'].includes(type)) return false;
      const nm=(el.getAttribute('name')||'')+ ' ' + (el.id||'') + ' ' + (el.getAttribute('placeholder')||'') + ' ' + (el.getAttribute('aria-label')||'');
      const s=nm.toLowerCase();
      if(type==='email') return true;
      if(/user|login|email|mail|username|e-mail/.test(s)) return true;
      return false;
    } catch(_){ return false; }
  });
  return cands[0] || doc.querySelector('input[type=email]') || null;
}
function __findPassInput(doc){
  const byType = doc.querySelector('input[type=password]'); if(byType) return byType;
  const auto = doc.querySelector('input[autocomplete=password],input[autocomplete="current-password"],input[autocomplete="new-password"]');
  return auto || null;
}
function __captureAndSave(doc){
  try {
    const u=__findUserInput(doc); const p=__findPassInput(doc);
    const username=u&&u.value&&u.value.length<90? u.value.trim():null;
    const password=p&&p.value&&p.value.length<256? p.value:null;
    if(username && password){ ipcRenderer.send('capture-credentials',{ broker:BROKER_ID, hostname:location.hostname, username, password }); }
  } catch(_){ }
}
ipcRenderer.on('apply-credentials', (_e, creds)=>{
  __lastCreds = creds;
  let attempts=0; const MAX=75; // ~15s @200ms
  const tryFill=()=>{
    attempts++;
    try {
      if(!__lastCreds) return;
      const doc = window.document;
      const user = __findUserInput(doc);
      const pass = __findPassInput(doc);
      let ok=false;
      if(user && __lastCreds.username){ __applyVal(user, __lastCreds.username); ok=true; }
      if(pass && __lastCreds.password){ __applyVal(pass, __lastCreds.password); ok=true; }
      if(ok){ try { console.log('[cred][brokerPreload] filled attempt', attempts, 'host=', location.hostname); } catch(_){ } return; }
    } catch(err){ }
    if(attempts<MAX) setTimeout(tryFill,200);
  };
  tryFill();
});
// Re-play if late inputs appear
const credMO = new MutationObserver(()=>{
  if(__lastCreds){
    const pass=__findPassInput(document);
    if(pass && !pass.value){ try { ipcRenderer.emit('apply-credentials', {}, __lastCreds); } catch(_){ } }
  }
});
try { credMO.observe(document.documentElement,{subtree:true,childList:true}); } catch(_){ }
// Capture on submit and on typical login button clicks and Enter key
window.addEventListener('DOMContentLoaded', ()=>{
  try {
    const hookForm=(f)=>{ if(f.__credHooked) return; f.__credHooked=true; f.addEventListener('submit', ()=> __captureAndSave(f), { capture:true }); };
    Array.from(document.querySelectorAll('form')).slice(0,50).forEach(hookForm);
    const hookButtons=()=>{
      const btns = Array.from(document.querySelectorAll('button,input[type=submit]')).slice(0,100);
      btns.forEach(b=>{
        if(b.__credHooked) return; b.__credHooked=true;
        const label=((b.innerText||'')+' '+(b.value||'')).toLowerCase();
        if(/sign\s*in|log\s*in|войти|login|submit|sign\s*on/.test(label) || (b.getAttribute('type')||'').toLowerCase()==='submit'){
          b.addEventListener('click', ()=> __captureAndSave(document), { capture:true });
        }
      });
    };
    hookButtons();
    document.addEventListener('keydown', (e)=>{ try { if(e.key==='Enter'){ __captureAndSave(document); } } catch(_){ } }, { capture:true });
    // Re-scan for forms/buttons as SPA mounts components
    const btnObs=new MutationObserver(()=>{ try { Array.from(document.querySelectorAll('form')).forEach(f=>{ if(!f.__credHooked){ f.__credHooked=true; f.addEventListener('submit', ()=> __captureAndSave(f), { capture:true }); } }); hookButtons(); } catch(_){ } });
    btnObs.observe(document.documentElement,{subtree:true,childList:true});
  } catch(_){ }
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

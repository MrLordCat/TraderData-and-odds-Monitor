// Preload for each broker BrowserView (clean refactored version)
const { ipcRenderer } = require('electron');
let desiredMap = 1; // user selected map number (raw)
let isLast = false; // global flag from main indicating final map should use match market for certain brokers
const HOST = location.host;
const { collectOdds: collectOddsExt, getBrokerId } = require('./brokers/extractors');
const { triggerMapChange } = require('./brokers/mapNav');
// Allow main process to inject a forced broker id (e.g. dataservices) before DOM load
let BROKER_ID = (window.__FORCED_BROKER_ID || '').trim();
if(!BROKER_ID) BROKER_ID = getBrokerId(HOST);
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
  // For brokers that represent final map as match market (currently only bet365) -> if isLast enabled and desiredMap>0 use 0
  if(isLast && BROKER_ID==='bet365' && desiredMap>0) return 0;
  return desiredMap;
}
function getCurrentOdds(){
  const data = collectOddsExt(HOST, effectiveMap());
  try { if(BROKER_ID && data && typeof data==='object') data.broker = BROKER_ID; } catch(_){ }
  return data;
}
ipcRenderer.on('collect-now', ()=> safe(()=> safeSend('bv-odds-update', getCurrentOdds())));

// Map change listener
ipcRenderer.on('set-map', (_e, mapVal)=>{
  const n=parseInt(mapVal,10); desiredMap=Number.isNaN(n)?1:n;
  try { if(BROKER_ID==='dataservices') console.log('[map][recv] set-map ->', desiredMap); } catch(_){ }
  triggerMapChange(HOST, desiredMap);
  [600,1500,3000].forEach(d=> setTimeout(()=> safe(()=> triggerMapChange(HOST, desiredMap)), d));
  // Extra late assertion specifically for dataservices (occasionally loads/reacts slowly)
  if(BROKER_ID==='dataservices') [4200,6000].forEach(d=> setTimeout(()=> safe(()=> triggerMapChange(HOST, desiredMap)), d));
});
ipcRenderer.on('set-is-last', (_e, flag)=>{
  try { isLast = !!flag; } catch(_){ }
});

// Periodic odds loop
setInterval(()=> safe(()=> safeSend('bv-odds-update', getCurrentOdds())), 1500);

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

// Dataservices specific: actively pull last map & enforce if initial broadcast missed
window.addEventListener('DOMContentLoaded', ()=>{
  if(BROKER_ID!=='dataservices') return;
  try {
    // Ask main for last map via a synthetic request path: send a one-off eval back through mainWindow by piggy-backing odds ping cycle.
    // Simpler: just emit a lightweight marker; main already replays, but we also schedule self-retries reading injected global if provided later.
    const attemptApply=(delay)=> setTimeout(()=>{
      try {
        // We cannot invoke ipcRenderer.invoke here (contextIsolation true) unless exposed; reuse ping to encourage resend.
        ipcRenderer.send('bv-odds-update', { broker:'_ping_ds' });
        // If we already received desiredMap via earlier set-map, reassert once.
        triggerMapChange(HOST, desiredMap);
        try { console.log('[map][ds][fallback] reassert at', delay,'ms map=', desiredMap); } catch(_){ }
      } catch(_){ }
    }, delay);
    [800, 2000, 4000, 7000].forEach(attemptApply);
  } catch(_){ }
});

// (Removed legacy BrowserView drag bar injection)

// ================= Credential Auto-Fill & Capture (Added) =================
let __lastCreds = null;
function __applyVal(el, val){
  if(!el) return; try { const d=Object.getOwnPropertyDescriptor(el.__proto__,'value'); if(d&&d.set) d.set.call(el,val); else el.value=val; } catch(_){ el.value=val; }
  try { el.dispatchEvent(new Event('input',{bubbles:true})); } catch(_){ }
  try { el.dispatchEvent(new Event('change',{bubbles:true})); } catch(_){ }
}
ipcRenderer.on('apply-credentials', (_e, creds)=>{
  __lastCreds = creds;
  let attempts=0; const MAX=40; // ~8s @200ms
  const tryFill=()=>{
    attempts++;
    try {
      if(!__lastCreds) return;
      const doc = window.document;
      const user = doc.querySelector('input[type=email],input[type=text][name*=user],input[type=text][name*=login],input[name*=username],input[name*=email]') || doc.querySelector('form input[type=text], form input:not([type])');
      const pass = doc.querySelector('input[type=password]');
      let ok=false;
      if(user && __lastCreds.username){ __applyVal(user, __lastCreds.username); ok=true; }
      if(pass && __lastCreds.password){ __applyVal(pass, __lastCreds.password); ok=true; }
      if(ok){ try { console.log('[cred][brokerPreload] filled credentials attempt', attempts, 'host=', location.hostname); } catch(_){ } return; }
    } catch(err){ }
    if(attempts<MAX) setTimeout(tryFill,200);
  };
  tryFill();
});
// Re-play if late inputs appear
const credMO = new MutationObserver(()=>{ if(__lastCreds){ const pass=document.querySelector('input[type=password]'); if(pass && !pass.value){ try { ipcRenderer.emit('apply-credentials', {}, __lastCreds); } catch(_){ } } } });
try { credMO.observe(document.documentElement,{subtree:true,childList:true}); } catch(_){ }
// Capture on submit
window.addEventListener('DOMContentLoaded', ()=>{
  try {
    const forms=[...document.querySelectorAll('form')].slice(0,25);
    forms.forEach(f=>{ if(f.__credHooked) return; f.__credHooked=true; f.addEventListener('submit', ()=>{ try { const user=f.querySelector('input[type=email],input[type=text][name*=user],input[type=text][name*=login],input[name*=username],input[name*=email]'); const pass=f.querySelector('input[type=password]'); const username=user&&user.value&&user.value.length<90? user.value.trim():null; const password=pass&&pass.value&&pass.value.length<256? pass.value:null; if(username && password){ ipcRenderer.send('capture-credentials',{ broker:BROKER_ID, hostname:location.hostname, username, password }); } } catch(_){ } }, { capture:true }); });
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
});

// Ensure map selection restored after reload if main already stored one
window.addEventListener('DOMContentLoaded', () => {
  try {
    // Ask main for lastMap value (using existing get-last-map via sending a ping back through renderer not available here)
    // Simpler: rely on periodic re-send triggered from main (already added). As a fallback we trigger a lightweight marker so main can re-send.
    require('electron').ipcRenderer.send('bv-odds-update', { broker:'_ping' });
  } catch(e) {}
});

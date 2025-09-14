// Preload for each broker BrowserView (clean refactored version)
const { ipcRenderer } = require('electron');
let desiredMap = 1;
const HOST = location.host;
const { collectOdds: collectOddsExt, getBrokerId } = require('./brokers/extractors');
const { triggerMapChange } = require('./brokers/mapNav');
const BROKER_ID = getBrokerId(HOST);
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
function getCurrentOdds(){ return collectOddsExt(HOST, desiredMap); }
ipcRenderer.on('collect-now', ()=> safe(()=> safeSend('bv-odds-update', getCurrentOdds())));

// Map change listener
ipcRenderer.on('set-map', (_e, mapVal)=>{
  const n=parseInt(mapVal,10); desiredMap=Number.isNaN(n)?1:n;
  triggerMapChange(HOST, desiredMap);
  [600,1500,3000].forEach(d=> setTimeout(()=> safe(()=> triggerMapChange(HOST, desiredMap)), d));
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

// Drag bar injection
function injectDragBar(){
  if(document.getElementById('__broker_drag_bar')) return;
  const bar=document.createElement('div');
  bar.id='__broker_drag_bar';
  bar.style.cssText='position:fixed;top:0;left:0;right:0;height:18px;background:rgba(20,20,20,.55);z-index:999999;cursor:move;font:10px sans-serif;color:#ccc;display:flex;align-items:center;padding:0 6px;user-select:none;-webkit-user-select:none;backdrop-filter:blur(2px);';
  bar.textContent=' drag '+BROKER_ID+' ';
  const closeBtn=document.createElement('span'); closeBtn.textContent='✕'; closeBtn.style.cssText='margin-left:auto;padding:0 6px;cursor:pointer;color:#aaa;font-weight:bold;';
  closeBtn.addEventListener('click', (e)=>{ e.stopPropagation(); safeSend('close-broker', BROKER_ID); });
  bar.appendChild(closeBtn);
  document.documentElement.appendChild(bar);
  let dragging=false,lx=0,ly=0;
  bar.addEventListener('mousedown', e=>{dragging=true;lx=e.screenX;ly=e.screenY;safeSend('bv-drag-start',{id:BROKER_ID});});
  window.addEventListener('mousemove', e=>{ if(!dragging) return; const dx=e.screenX-lx; const dy=e.screenY-ly; lx=e.screenX; ly=e.screenY; safeSend('bv-drag-delta',{dx,dy,id:BROKER_ID}); });
  window.addEventListener('mouseup', ()=>{ if(dragging){ dragging=false; safeSend('bv-drag-end',{id:BROKER_ID}); }});
}
document.addEventListener('DOMContentLoaded', injectDragBar);

// Reload helper button support
document.addEventListener('DOMContentLoaded', ()=>{
  const btn=document.getElementById('__reload_btn'); if(btn){ btn.addEventListener('click', ()=>{ try { location.reload(); } catch(_){} }); }
});

// Light ping so main can replay last map/placeholder odds promptly
window.addEventListener('DOMContentLoaded', ()=>{ try { ipcRenderer.send('bv-odds-update', { broker:'_ping' }); } catch(_){} });

// --- Drag handle injection for moving BrowserView ---
function injectDragBar(){
  if (document.getElementById('__broker_drag_bar')) return;
  const bar = document.createElement('div');
  bar.id='__broker_drag_bar';
  bar.style.cssText='position:fixed;top:0;left:0;right:0;height:18px;background:rgba(20,20,20,0.55);z-index:999999;cursor:move;font:10px sans-serif;color:#ccc;display:flex;align-items:center;padding:0 6px;user-select:none;-webkit-user-select:none;backdrop-filter:blur(2px);';
  bar.textContent=' drag '+BROKER_ID+' ';
  const closeBtn=document.createElement('span');
  closeBtn.textContent='✕';
  closeBtn.style.cssText='margin-left:auto;padding:0 6px;cursor:pointer;color:#aaa;font-weight:bold;';
  closeBtn.addEventListener('click', (e)=>{ e.stopPropagation(); safeSend('close-broker', BROKER_ID); });
  bar.appendChild(closeBtn);
  document.documentElement.appendChild(bar);
  let dragging=false, lx=0, ly=0;
  bar.addEventListener('mousedown', e=>{dragging=true;lx=e.screenX;ly=e.screenY;safeSend('bv-drag-start',{id:BROKER_ID});});
  window.addEventListener('mousemove', e=>{if(!dragging) return; const dx=e.screenX-lx; const dy=e.screenY-ly; lx=e.screenX; ly=e.screenY; safeSend('bv-drag-delta',{dx,dy,id:BROKER_ID});});
  window.addEventListener('mouseup', ()=>{ if(dragging){ dragging=false; safeSend('bv-drag-end',{id:BROKER_ID}); }});
}
document.addEventListener('DOMContentLoaded', injectDragBar);

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

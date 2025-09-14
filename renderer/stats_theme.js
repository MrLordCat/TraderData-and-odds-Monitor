// Theme & heat bar logic extracted from original stats_panel.js (guarded to avoid redeclaration conflicts)
(function(){
  let ipcRenderer = (window && window.ipcRenderer) || null;
  if(!ipcRenderer){ try { ipcRenderer = require('electron').ipcRenderer; window.ipcRenderer = ipcRenderer; } catch(_){ /* no ipc */ } }
  let activityModule = null; try { activityModule = require('./stats_activity'); } catch(_){ }
  const styleId='gs-theme-style';
  function ensureStyle(){ let el=document.getElementById(styleId); if(!el){ el=document.createElement('style'); el.id=styleId; document.head.appendChild(el);} return el; }
  function applyTheme(t){ if(!t) return; const intensity=Math.min(100,Math.max(0,parseInt(t.intensity||0,10))); function mix(aHex,bHex,p){ function hexToRgb(h){ h=h.replace('#',''); if(h.length===3) h=h.split('').map(c=>c+c).join(''); const n=parseInt(h,16); return { r:(n>>16)&255,g:(n>>8)&255,b:n&255 }; } function rgbToHex(r,g,b){ return '#'+[r,g,b].map(v=>{ const s=v.toString(16); return s.length===1?'0'+s:s; }).join(''); } const a=hexToRgb(aHex), b=hexToRgb(bHex); const r=Math.round(a.r+(b.r-a.r)*p); const g=Math.round(a.g+(b.g-a.g)*p); const bl=Math.round(a.b+(b.b-a.b)*p); return rgbToHex(r,g,bl);} const blendP=intensity/100; const winBase=t.win||'#286650'; const loseBase=t.lose||'#8a4646'; const bg=t.bg||'#181f27'; const winMix=mix(bg,winBase,blendP); const loseMix=mix(bg,loseBase,blendP); const head=t.head||'#1d252f'; const border=t.border||'#27313d'; const animColor=t.animColor||'#d4b14a'; const animIntensityPct=Math.max(50,Math.min(400,parseInt(t.animIntensity||130,10))); const animDurSec=Math.max(.5,Math.min(10,Number(t.animDurSec||3))); const css=`:root{ --gs-bg:${bg};--gs-border:${border};--gs-head:${head};--gs-win:${winMix};--gs-lose:${loseMix};--gs-gold:${animColor};--gs-animDur:${animDurSec}s;--gs-animIntensity:${animIntensityPct}%;}`; ensureStyle().textContent=css; const tbl=document.getElementById('lolTable'); if(tbl){ tbl.style.background='var(--gs-bg)'; tbl.style.borderColor='var(--gs-border)'; const thead=tbl.querySelector('thead'); if(thead) thead.style.background='var(--gs-head)'; } document.querySelectorAll('#lolTable td.win').forEach(td=> td.style.background='var(--gs-win)'); document.querySelectorAll('#lolTable td.lose').forEach(td=> td.style.background='var(--gs-lose)'); try { const root=document.getElementById('stats'); root&&root.style.setProperty('--gs-animDur',(animDurSec*1000)+'ms'); const mult=Math.max(0.5,Math.min(4.0,animIntensityPct/100)); document.documentElement.style.setProperty('--intensity',String(mult)); document.documentElement.style.setProperty('--gs-gold',animColor);} catch(_){ }}
  if(ipcRenderer){ ipcRenderer.on('gs-theme-apply', (_e,theme)=> applyTheme(theme)); }
  // Heat bar configuration listener
  if(ipcRenderer) ipcRenderer.on('gs-heatbar-apply', (_e, hb)=>{
  try {
    if(!hb || !activityModule || !activityModule.configure) return;
    activityModule.configure({ enabled: hb.enabled!==false, decayPerSec: hb.decayPerSec, bumpAmount: hb.bumpAmount });
    const layer=document.querySelector('.teamActivityLayer');
    if(layer){
      const els=layer.querySelectorAll('.teamActivity');
      const c1=hb.color1||'#3c78ff'; const c2=hb.color2||'#ff4646';
      function multiStops(hex){ if(!/^#([0-9a-fA-F]{6})$/.test(hex)) return `linear-gradient(to top, ${hex}CC 0%, ${hex}BB 46%, ${hex}66 78%, ${hex}00 100%)`; const base=hex; return `linear-gradient(to top, ${base}E6 0%, ${base}D2 46%, ${base}66 78%, ${base}00 100%)`; }
      if(els[0]){ els[0].style.background=multiStops(c1); els[0].style.boxShadow='inset 0 0 4px rgba(255,255,255,.18),0 0 6px -2px '+c1+'AA'; }
      if(els[1]){ els[1].style.background=multiStops(c2); els[1].style.boxShadow='inset 0 0 4px rgba(255,255,255,.16),0 0 6px -2px '+c2+'AA'; }
      try { activityModule && activityModule.recalc && activityModule.recalc(); } catch(_){ }
    }
  } catch(_){ }
  });
  window.__activityModule = activityModule;
})();

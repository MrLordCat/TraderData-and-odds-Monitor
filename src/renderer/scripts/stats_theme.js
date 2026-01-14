// Theme & heat bar logic extracted from original stats_panel.js (guarded to avoid redeclaration conflicts)
(function(){
  let ipcRenderer = (window && window.ipcRenderer) || null;
  if(!ipcRenderer){ try { ipcRenderer = require('electron').ipcRenderer; window.ipcRenderer = ipcRenderer; } catch(_){ /* no ipc */ } }
  let activityModule = null; try { activityModule = require('./stats_activity'); } catch(_){ }
  
  // Use shared DOM helper
  let byId = null;
  try { const DomHelpers = require('../ui/dom_helpers'); byId = DomHelpers.byId; } catch(_){ }
  if(!byId && window.DomHelpers) byId = window.DomHelpers.byId;
  if(!byId) byId = (id) => { try { return document.getElementById(id); } catch(_){ return null; } };

  const styleId='gs-theme-style';
  function ensureStyle(){ let el=byId(styleId); if(!el){ el=document.createElement('style'); el.id=styleId; document.head.appendChild(el);} return el; }
  function applyTheme(t){
    // Ultra-minimal theme: only base structural colors
    if(!t) return;
    const bg=t.bg||'#181f27';
    const border=t.border||'#27313d';
    const head=t.head||'#1d252f';
    // Merge global config (if loaded) for animation + heat bar vars
    const cfg = (window.__STATS_CONFIG__ && window.__STATS_CONFIG__.get()) || {};
    const css=`:root{ --gs-bg:${bg};--gs-border:${border};--gs-head:${head};`+
      (cfg.animationDurationMs?`--gs-anim-dur:${cfg.animationDurationMs}ms;`:'')+
      (cfg.animationScale!=null?`--gs-anim-scale:${cfg.animationScale};`:'')+
      (cfg.animationPrimaryColor?`--gs-anim-color1:${cfg.animationPrimaryColor};`:'')+
      (cfg.animationSecondaryColor?`--gs-anim-color2:${cfg.animationSecondaryColor};`:'')+
      (cfg.heatBarOpacity!=null?`--gs-heatbar-alpha:${cfg.heatBarOpacity};`:'')+
      (cfg.animationsEnabled===false?`--gs-anim-enabled:0;`:`--gs-anim-enabled:1;`)+` }`;
    ensureStyle().textContent=css;
  }
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

// Theme & heat bar logic extracted from original stats_panel.js
// ES module with backward compatibility
// v0.2.5-dev build

let ipcRenderer = null;
try {
  if (typeof window !== 'undefined' && window.ipcRenderer) {
    ipcRenderer = window.ipcRenderer;
  } else {
    ipcRenderer = require('electron').ipcRenderer;
    if (typeof window !== 'undefined') window.ipcRenderer = ipcRenderer;
  }
} catch (_) { /* no ipc */ }

let activityModule = null;
try { activityModule = require('./stats_activity'); } catch (_) { }

const styleId = 'gs-theme-style';

function ensureStyle() {
  let el = document.getElementById(styleId);
  if (!el) {
    el = document.createElement('style');
    el.id = styleId;
    document.head.appendChild(el);
  }
  return el;
}

export function applyTheme(t) {
  if (!t) return;
  const bg = t.bg || '#181f27';
  const border = t.border || '#27313d';
  const head = t.head || '#1d252f';
  
  // Merge global config (if loaded) for animation + heat bar vars
  const cfg = (typeof window !== 'undefined' && window.__STATS_CONFIG__?.get?.()) || {};
  const css = `:root{ --gs-bg:${bg};--gs-border:${border};--gs-head:${head};` +
    (cfg.animationDurationMs ? `--gs-anim-dur:${cfg.animationDurationMs}ms;` : '') +
    (cfg.animationScale != null ? `--gs-anim-scale:${cfg.animationScale};` : '') +
    (cfg.animationPrimaryColor ? `--gs-anim-color1:${cfg.animationPrimaryColor};` : '') +
    (cfg.animationSecondaryColor ? `--gs-anim-color2:${cfg.animationSecondaryColor};` : '') +
    (cfg.heatBarOpacity != null ? `--gs-heatbar-alpha:${cfg.heatBarOpacity};` : '') +
    (cfg.animationsEnabled === false ? `--gs-anim-enabled:0;` : `--gs-anim-enabled:1;`) + ` }`;
  ensureStyle().textContent = css;
}

export function applyHeatBarConfig(hb) {
  if (!hb || !activityModule) return;
  
  // Log incoming config for debugging
  const fadeTimeSec = hb.decayPerSec > 0 ? (1 / hb.decayPerSec).toFixed(1) : 'Infinity';
  console.log(`[heat-bar] applyHeatBarConfig: decayPerSec=${hb.decayPerSec}, fadeTime=${fadeTimeSec}s (UI setting), bumpAmount=${hb.bumpAmount}, enabled=${hb.enabled}`);
  
  // Ensure DOM is created before configuring
  if (activityModule.init) activityModule.init();
  if (activityModule.configure) activityModule.configure({ 
    enabled: hb.enabled !== false, 
    decayPerSec: hb.decayPerSec, 
    bumpAmount: hb.bumpAmount 
  });
  
  const layer = document.querySelector('.teamActivityLayer');
  if (layer) {
    const els = layer.querySelectorAll('.teamActivity');
    const c1 = hb.color1 || '#3c78ff';
    const c2 = hb.color2 || '#ff4646';
    
    function multiStops(hex) {
      if (!/^#([0-9a-fA-F]{6})$/.test(hex)) {
        return `linear-gradient(to top, ${hex}CC 0%, ${hex}BB 46%, ${hex}66 78%, ${hex}00 100%)`;
      }
      return `linear-gradient(to top, ${hex}E6 0%, ${hex}D2 46%, ${hex}66 78%, ${hex}00 100%)`;
    }
    
    if (els[0]) {
      els[0].style.background = multiStops(c1);
      els[0].style.boxShadow = 'inset 0 0 4px rgba(255,255,255,.18),0 0 6px -2px ' + c1 + 'AA';
    }
    if (els[1]) {
      els[1].style.background = multiStops(c2);
      els[1].style.boxShadow = 'inset 0 0 4px rgba(255,255,255,.16),0 0 6px -2px ' + c2 + 'AA';
    }
    try { activityModule?.recalc?.(); } catch (_) { }
  }
}

// IPC listeners
if (ipcRenderer) {
  ipcRenderer.on('gs-theme-apply', (_e, theme) => applyTheme(theme));
  console.log('[stats_theme] IPC listener gs-theme-apply registered');
}

let pendingHeatBar = null;

if (ipcRenderer) {
  ipcRenderer.on('gs-heatbar-apply', (_e, hb) => {
    console.log('[heat-bar] IPC gs-heatbar-apply received:', hb);
    try {
      pendingHeatBar = hb;
      applyHeatBarConfig(hb);
      // Retry after DOM is likely ready
      setTimeout(() => applyHeatBarConfig(hb), 150);
      setTimeout(() => applyHeatBarConfig(hb), 400);
    } catch (_) { }
  });
  console.log('[stats_theme] IPC listener gs-heatbar-apply registered');
} else {
  console.warn('[stats_theme] ipcRenderer not available, IPC listeners not registered');
}

export function applyPendingHeatBar() {
  if (pendingHeatBar) applyHeatBarConfig(pendingHeatBar);
}

export { activityModule };

const StatsTheme = { applyTheme, applyHeatBarConfig, applyPendingHeatBar, activityModule };
export default StatsTheme;

// Backward compatibility
if (typeof window !== 'undefined') {
  window.__activityModule = activityModule;
  window.__applyPendingHeatBar = applyPendingHeatBar;
}

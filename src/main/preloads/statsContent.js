// Preload for stats content views (A,B) to capture injected LoL extension messages
// and forward them to main via ipc.
const { contextBridge, ipcRenderer } = require('electron');


// Allow injected scripts to send structured payloads
contextBridge.exposeInMainWorld('__oddsMoniLolEmit', (slot, data) => {
  try { ipcRenderer.send('lol-stats-raw', { slot, data }); } catch(e) {}
});

// Expose desktopAPI for theme support in stats_panel
contextBridge.exposeInMainWorld('desktopAPI', {
  themeGet: () => ipcRenderer.invoke('theme-get'),
  themeSet: (theme) => ipcRenderer.invoke('theme-set', theme),
  themeToggle: () => ipcRenderer.invoke('theme-toggle'),
  onThemeChanged: (cb) => {
    ipcRenderer.on('theme-changed', (_, theme) => cb(theme));
  }
});

// ================= Grid Theme Injection =================
// Grid (portal.grid.gg) uses obfuscated CSS class names and hardcoded RGB colors.
// Light theme via CSS filter inversion with aggressive softening:
//   contrast(0.7)    — white text → dark gray #2c (not black), prevents eye strain
//   brightness(1.15) — pushes backgrounds back to light range (#ddd-#eee)
//   saturate(1.2)    — compensates color saturation loss from inversion
// Media elements get inverse compensation to display correctly.
const GRID_LIGHT_CSS = `
  html.oddsmoni-light {
    filter: invert(1) hue-rotate(180deg) contrast(0.7) brightness(1.15) saturate(1.2) !important;
    background: #fff !important;
  }
  html.oddsmoni-light img,
  html.oddsmoni-light video,
  html.oddsmoni-light canvas,
  html.oddsmoni-light svg image,
  html.oddsmoni-light [style*="background-image"] {
    filter: invert(1) hue-rotate(180deg) contrast(1.43) brightness(0.87) saturate(0.833) !important;
  }

  /* Scoreboard: re-invert to preserve original team colors & round SVG icons */
  html.oddsmoni-light [data-testid="widget-series-scoreboard"] {
    filter: invert(1) hue-rotate(180deg) contrast(1.43) brightness(0.87) saturate(0.833) !important;
  }
  /* Images inside re-inverted scoreboard: skip double re-inversion */
  html.oddsmoni-light [data-testid="widget-series-scoreboard"] img {
    filter: none !important;
  }

  /* Small item icons (weapons/equipment 16px): keep inverted = dark on light bg */
  html.oddsmoni-light img[height="16px"] {
    filter: none !important;
  }

  /* Scrollbar colors for light theme */
  html.oddsmoni-light body {
    scrollbar-color: #b0b4b8 #eef0f2 !important;
  }
  html.oddsmoni-light ::-webkit-scrollbar-thumb {
    background: #b0b4b8 !important;
  }
  html.oddsmoni-light ::-webkit-scrollbar-track {
    background: #eef0f2 !important;
  }
`;

function isGridPage() {
  try { return /grid\.gg$/i.test(location.hostname); } catch(_){ return false; }
}

function injectGridTheme(theme) {
  if (!isGridPage()) return;
  try {
    let style = document.getElementById('oddsmoni-grid-theme');
    if (!style) {
      style = document.createElement('style');
      style.id = 'oddsmoni-grid-theme';
      (document.head || document.documentElement).appendChild(style);
    }
    style.textContent = theme === 'light' ? GRID_LIGHT_CSS : '';
    const html = document.documentElement;
    if (theme === 'light') {
      html.classList.add('oddsmoni-light');
    } else {
      html.classList.remove('oddsmoni-light');
    }
  } catch(_) {}
}

// Apply initial theme on DOMContentLoaded, listen for changes
if (isGridPage()) {
  ipcRenderer.invoke('theme-get').then(theme => {
    // Pre-DOM: set class immediately if possible
    try {
      if (theme === 'light' && document.documentElement) {
        document.documentElement.classList.add('oddsmoni-light');
      }
    } catch(_) {}
    const onReady = () => injectGridTheme(theme);
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', onReady, { once: true });
    } else {
      onReady();
    }
  }).catch(_=>{});
  
  ipcRenderer.on('theme-changed', (_, theme) => injectGridTheme(theme));
}

// Also passive listener: if extension uses window.postMessage with source markers
// we trap them here and forward automatically (slot supplied later via identify message).
let __slot = null;
ipcRenderer.on('identify-slot', (_, slot) => { __slot = slot; });

// Lightweight console tap for slot views to feed stats-debug (only once)
try {
  if(!window.__slotConsoleTapped){
    window.__slotConsoleTapped = true;
    const origLog = console.log, origWarn = console.warn, origErr = console.error;
    function wrap(kind, fn){
      return function(){
        try {
          const args = Array.from(arguments).map(a=> typeof a==='object'? JSON.stringify(a): String(a));
          ipcRenderer.send('stats-debug', { tap: kind, slot: __slot, msg: args.join(' ') });
        } catch(_){}
        try { return fn.apply(this, arguments); } catch(_2){}
      };
    }
    console.log = wrap('log', origLog);
    console.warn = wrap('warn', origWarn);
    console.error = wrap('err', origErr);
  }
} catch(_){ }

window.addEventListener('message', (e) => {
  if(!__slot) return;
  const d = e.data;
  if(!d || typeof d !== 'object') return;
  if(d.source === 'lol-live-stats' || d.source === 'lol-multikill' || d.source==='lol-debug' || d.source==='lol-reset-trigger') {
    ipcRenderer.send('lol-stats-raw', { slot: __slot, data: d });
  }
  // Forward sound events to main process for stats_panel
  if(d.source === 'lol-sound-event') {
    ipcRenderer.send('lol-sound-event', { type: d.type, timestamp: d.timestamp });
  }
});

// ================= Credential Auto-Fill & Capture =================
const { createCredentialFiller, captureCredentials, findUserInput, findPassInput } = require('./credentials');
const credFiller = createCredentialFiller({ ipcRenderer, logPrefix: '[cred][statsContent]', maxAttempts: 40 });
ipcRenderer.on('apply-credentials', (_, creds) => credFiller.onApplyCredentials(creds));
credFiller.createMutationObserver();

// Capture credentials on form submit for stats content views
window.addEventListener('DOMContentLoaded', () => {
  try {
    const forms = Array.from(document.querySelectorAll('form')).slice(0, 25);
    forms.forEach(f => {
      if(f.__credHooked) return;
      f.__credHooked = true;
      f.addEventListener('submit', () => {
        try {
          const user = findUserInput(f);
          const pass = findPassInput(f);
          const username = user && user.value && user.value.length < 90 ? user.value.trim() : null;
          const password = pass && pass.value && pass.value.length < 256 ? pass.value : null;
          if(__slot && username && password){
            ipcRenderer.send('stats-save-credentials', { slot: __slot, username, password });
          }
          if(username){
            console.log('[cred][statsContent] submit slot=' + __slot, 'host=' + location.hostname, 'user=' + username);
          }
        } catch(_){ }
      }, { capture: true });
    });
  } catch(_){ }
});


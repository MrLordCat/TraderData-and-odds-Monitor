const { contextBridge, ipcRenderer } = require('electron');
const buildDesktopAPI = require('../modules/utils/apiDef');

// Small helper to register an event and return an unsubscribe for convenience.
function withUnsub(channel, wrap){
  const handler = (_, payload) => wrap(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

contextBridge.exposeInMainWorld('desktopAPI', buildDesktopAPI(ipcRenderer, withUnsub));

// ---------- Console forwarding (selective) ----------
// Некоторые BrowserView (board.html) трудно открыть DevTools пользователю, поэтому
// мы дублируем важные диагностические строки в main процесс, чтобы увидеть их в терминале.
try {
  if(!window.__consoleForwardPatched){
    window.__consoleForwardPatched = true;
    const LEVELS = ['log','warn','error'];
    const orig = {};
    LEVELS.forEach(l=> orig[l] = console[l].bind(console));
    const shouldForward = (args)=>{
      try {
        const joined = args.map(a=> (typeof a==='string'? a : (a && a.message) || '')).join(' ');
        // Фильтруем только то, что относится к авто-симу или авто-нажатиям
        return /\[autoSim]|\[auto-press]|Aligning|Aligned/.test(joined);
      } catch(_){ return false; }
    };
    LEVELS.forEach(level=>{
      console[level] = (...args)=>{
        try { orig[level](...args); } catch(_){ }
        try {
          if(shouldForward(args)){
            ipcRenderer.send('renderer-log-forward', { level, args: args.map(a=>{
              if(a instanceof Error){ return a.stack || a.message; }
              if(typeof a==='object'){ try { return JSON.stringify(a); } catch(_){ return String(a); } }
              return String(a);
            }) });
          }
        } catch(_){ }
      };
    });
  }
} catch(_){ }

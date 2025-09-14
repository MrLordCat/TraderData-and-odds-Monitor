// Preload for stats content views (A,B) to capture injected LoL extension messages
// and forward them to main via ipc.
const { contextBridge, ipcRenderer } = require('electron');


// Allow injected scripts to send structured payloads
contextBridge.exposeInMainWorld('__oddsMoniLolEmit', (slot, data) => {
  try { ipcRenderer.send('lol-stats-raw', { slot, data }); } catch(e) {}
});

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
  if(d.source === 'lol-live-stats' || d.source === 'lol-multikill' || d.source==='lol-netWorth' || d.source==='lol-debug' || d.source==='lol-reset-trigger') {
    ipcRenderer.send('lol-stats-raw', { slot: __slot, data: d });
  }
});

// Credential autofill listener
function __applyValue(el, val){
  if(!el) return;
  try {
    const proto = Object.getOwnPropertyDescriptor(el.__proto__, 'value');
    if(proto && proto.set) proto.set.call(el, val); else el.value = val;
  } catch(_) { el.value = val; }
  try { el.dispatchEvent(new Event('input', { bubbles:true, cancelable:true })); } catch(_){}
  try { el.dispatchEvent(new Event('change', { bubbles:true, cancelable:true })); } catch(_){}
}

let __lastCreds = null;
ipcRenderer.on('apply-credentials', (_, creds) => {
  __lastCreds = creds;
  let attempts = 0;
  const MAX_ATTEMPTS = 40; // ~8s at 200ms
  const tryFill = () => {
    attempts++;
    try {
      if(!__lastCreds) return;
      const doc = window.document;
      const userInput = doc.querySelector('input[type=email], input[type=text][name*=user], input[type=text][name*=login], input[name*=username], input[name*=email]') || doc.querySelector('form input[type=text], form input:not([type])');
      const passInput = doc.querySelector('input[type=password]');
      let ok = false;
      if(userInput && __lastCreds.username){ __applyValue(userInput, __lastCreds.username); ok = true; }
      if(passInput && __lastCreds.password){ __applyValue(passInput, __lastCreds.password); ok = true; }
      if(ok){
        try { console.log('[cred][statsContentPreload] filled credentials (attempt '+attempts+') for', __lastCreds.hostname); } catch(_){}
        return; // stop
      }
    } catch(err){ /* swallow */ }
    if(attempts < MAX_ATTEMPTS) setTimeout(tryFill, 200);
  };
  tryFill();
});

// Mutation observer fallback: if creds set earlier but elements appear later
const mo = new MutationObserver(()=>{
  if(__lastCreds){
    const passInput = document.querySelector('input[type=password]');
    if(passInput && (!passInput.value || passInput.value.length===0)){
      try { ipcRenderer.emit('apply-credentials', {}, __lastCreds); } catch(_){}
    }
  }
});
try { mo.observe(document.documentElement, { childList:true, subtree:true }); } catch(_){ }

// Capture credentials on form submit for stats content views
window.addEventListener('DOMContentLoaded', () => {
  try {
    const forms = Array.from(document.querySelectorAll('form')).slice(0,25);
    forms.forEach(f=>{
      if(f.__credHooked) return; f.__credHooked=true;
      f.addEventListener('submit', ()=>{
        try {
          const user = f.querySelector('input[type=email], input[type=text][name*=user], input[type=text][name*=login], input[name*=username], input[name*=email]');
          const pass = f.querySelector('input[type=password]');
          const username = user && user.value && user.value.length < 90 ? user.value.trim() : null;
          const password = pass && pass.value && pass.value.length < 256 ? pass.value : null;
          if(__slot && username && password){ ipcRenderer.send('stats-save-credentials', { slot: __slot, username, password }); }
          if(username){ try { console.log('[cred][statsContentPreload] submit slot='+__slot,'host='+location.hostname,'user='+username,'passLen='+(password?password.length:0)); } catch(_){} }
        } catch(_){}
      }, { capture:true });
    });
  } catch(_){ }
});


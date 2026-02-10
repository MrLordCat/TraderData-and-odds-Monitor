// Shared credential auto-fill & capture helpers for preload scripts
// Eliminates duplication between broker.js and statsContent.js

/**
 * Apply value to input element, triggering proper React/Vue events
 * @param {HTMLElement} el - Input element
 * @param {string} val - Value to set
 */
function applyValue(el, val){
  if(!el) return;
  try { el.removeAttribute('readonly'); el.readOnly=false; el.disabled=false; } catch(_){ }
  try { el.focus(); } catch(_){ }
  try {
    const d = Object.getOwnPropertyDescriptor(el.__proto__, 'value');
    if(d && d.set) d.set.call(el, val); else el.value = val;
  } catch(_){ el.value = val; }
  try { el.dispatchEvent(new Event('input', { bubbles:true, cancelable:true })); } catch(_){ }
  try { el.dispatchEvent(new Event('change', { bubbles:true, cancelable:true })); } catch(_){ }
}

/**
 * Find username/email input in document
 * @param {Document} doc - Document to search
 * @returns {HTMLElement|null}
 */
function findUserInput(doc){
  const cands = Array.from(doc.querySelectorAll('input,textarea')).filter(el=>{
    try {
      const type = (el.getAttribute('type')||'text').toLowerCase();
      if(['hidden','submit','button','checkbox','radio','file','range','color','date','time'].includes(type)) return false;
      const nm = (el.getAttribute('name')||'') + ' ' + (el.id||'') + ' ' + (el.getAttribute('placeholder')||'') + ' ' + (el.getAttribute('aria-label')||'');
      const s = nm.toLowerCase();
      if(type === 'email') return true;
      if(/user|login|email|mail|username|e-mail/.test(s)) return true;
      return false;
    } catch(_){ return false; }
  });
  return cands[0] || doc.querySelector('input[type=email]') || null;
}

/**
 * Find password input in document
 * @param {Document} doc - Document to search
 * @returns {HTMLElement|null}
 */
function findPassInput(doc){
  const byType = doc.querySelector('input[type=password]');
  if(byType) return byType;
  const auto = doc.querySelector('input[autocomplete=password],input[autocomplete="current-password"],input[autocomplete="new-password"]');
  return auto || null;
}

/**
 * Create credential auto-fill handler
 * @param {object} opts - Options
 * @param {Function} opts.ipcRenderer - Electron ipcRenderer
 * @param {string} [opts.logPrefix] - Log prefix for debugging
 * @param {number} [opts.maxAttempts=60] - Max retry attempts
 * @returns {object} - { lastCreds, onApplyCredentials, createMutationObserver }
 */
function createCredentialFiller(opts){
  const { ipcRenderer, logPrefix = '[cred]', maxAttempts = 60 } = opts;
  let lastCreds = null;

  function onApplyCredentials(creds){
    lastCreds = creds;
    let attempts = 0;
    const tryFill = ()=>{
      attempts++;
      try {
        if(!lastCreds) return;
        const doc = window.document;
        const user = findUserInput(doc);
        const pass = findPassInput(doc);
        let ok = false;
        if(user && lastCreds.username){ applyValue(user, lastCreds.username); ok = true; }
        if(pass && lastCreds.password){ applyValue(pass, lastCreds.password); ok = true; }
        if(ok){
          console.log(logPrefix, 'filled attempt', attempts, 'host=', location.hostname);
          return;
        }
      } catch(_){ }
      if(attempts < maxAttempts) setTimeout(tryFill, 200);
    };
    tryFill();
  }

  function createMutationObserver(){
    const mo = new MutationObserver(()=>{
      if(lastCreds){
        const pass = findPassInput(document);
        if(pass && !pass.value){
          try { ipcRenderer.emit('apply-credentials', {}, lastCreds); } catch(_){ }
        }
      }
    });
    try { mo.observe(document.documentElement, { subtree:true, childList:true }); } catch(_){ }
    return mo;
  }

  return {
    get lastCreds(){ return lastCreds; },
    set lastCreds(v){ lastCreds = v; },
    onApplyCredentials,
    createMutationObserver
  };
}

/**
 * Capture and save credentials from document
 * @param {Document} doc - Document to capture from
 * @param {Function} ipcRenderer - Electron ipcRenderer
 * @param {object} meta - Metadata { broker, hostname } or { slot }
 * @param {string} [channel='capture-credentials'] - IPC channel
 */
function captureCredentials(doc, ipcRenderer, meta, channel = 'capture-credentials'){
  try {
    const u = findUserInput(doc);
    const p = findPassInput(doc);
    const username = u && u.value && u.value.length < 90 ? u.value.trim() : null;
    const password = p && p.value && p.value.length < 256 ? p.value : null;
    if(username && password){
      ipcRenderer.send(channel, { ...meta, username, password });
    }
  } catch(_){ }
}

/**
 * Hook forms and buttons for credential capture
 * @param {object} opts - Options
 * @param {Function} opts.ipcRenderer - Electron ipcRenderer
 * @param {object} opts.meta - Metadata for capture
 * @param {string} [opts.channel] - IPC channel
 */
function hookCredentialCapture(opts){
  const { ipcRenderer, meta, channel } = opts;
  
  const hookForm = (f)=>{
    if(f.__credHooked) return;
    f.__credHooked = true;
    f.addEventListener('submit', ()=> captureCredentials(f, ipcRenderer, meta, channel), { capture:true });
  };

  const hookButtons = ()=>{
    const btns = Array.from(document.querySelectorAll('button,input[type=submit]')).slice(0, 100);
    btns.forEach(b=>{
      if(b.__credHooked) return;
      b.__credHooked = true;
      const label = ((b.innerText||'') + ' ' + (b.value||'')).toLowerCase();
      if(/sign\s*in|log\s*in|войти|login|submit|sign\s*on/.test(label) || (b.getAttribute('type')||'').toLowerCase() === 'submit'){
        b.addEventListener('click', ()=> captureCredentials(document, ipcRenderer, meta, channel), { capture:true });
      }
    });
  };

  // Initial hook
  Array.from(document.querySelectorAll('form')).slice(0, 50).forEach(hookForm);
  hookButtons();

  // Enter key capture
  document.addEventListener('keydown', (e)=>{
    try { if(e.key === 'Enter'){ captureCredentials(document, ipcRenderer, meta, channel); } } catch(_){ }
  }, { capture:true });

  // Re-scan for SPA-mounted forms/buttons
  const btnObs = new MutationObserver(()=>{
    try {
      Array.from(document.querySelectorAll('form')).forEach(f=>{
        if(!f.__credHooked){ hookForm(f); }
      });
      hookButtons();
    } catch(_){ }
  });
  btnObs.observe(document.documentElement, { subtree:true, childList:true });

  return btnObs;
}

module.exports = {
  applyValue,
  findUserInput,
  findPassInput,
  createCredentialFiller,
  captureCredentials,
  hookCredentialCapture
};

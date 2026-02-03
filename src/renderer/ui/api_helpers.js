// Shared API helpers for renderer scripts
// Reduces boilerplate for desktopAPI / ipcRenderer fallback patterns

/**
 * Safe invoke with desktopAPI fallback to ipcRenderer
 * @param {string} channel - IPC channel name
 * @param {*} [payload] - Optional payload
 * @returns {Promise<*>}
 */
function invoke(channel, payload){
  try {
    if(window.desktopAPI && typeof window.desktopAPI.invoke === 'function'){
      return window.desktopAPI.invoke(channel, payload);
    }
  } catch(_){ }
  try {
    const { ipcRenderer } = require('electron');
    if(ipcRenderer && typeof ipcRenderer.invoke === 'function'){
      return ipcRenderer.invoke(channel, payload);
    }
  } catch(_){ }
  return Promise.reject(new Error('invoke unavailable'));
}

/**
 * Safe send (fire-and-forget) with desktopAPI fallback to ipcRenderer
 * @param {string} channel - IPC channel name  
 * @param {*} [payload] - Optional payload
 */
function send(channel, payload){
  try {
    if(window.desktopAPI && typeof window.desktopAPI.send === 'function'){
      window.desktopAPI.send(channel, payload);
      return;
    }
  } catch(_){ }
  try {
    const { ipcRenderer } = require('electron');
    if(ipcRenderer && typeof ipcRenderer.send === 'function'){
      ipcRenderer.send(channel, payload);
    }
  } catch(_){ }
}

/**
 * Subscribe to IPC channel with desktopAPI callback or ipcRenderer.on fallback
 * @param {string} channel - IPC channel name
 * @param {Function} handler - Callback function
 * @param {string} [apiMethod] - desktopAPI method name (e.g. 'onMap' for channel 'set-map')
 */
function on(channel, handler, apiMethod){
  // Try desktopAPI method first
  if(apiMethod){
    try {
      if(window.desktopAPI && typeof window.desktopAPI[apiMethod] === 'function'){
        window.desktopAPI[apiMethod](handler);
        return;
      }
    } catch(_){ }
  }
  // Fallback to raw ipcRenderer
  try {
    const { ipcRenderer } = require('electron');
    if(ipcRenderer && typeof ipcRenderer.on === 'function'){
      ipcRenderer.on(channel, (_e, ...args) => {
        try { handler(...args); } catch(_){ }
      });
    }
  } catch(_){ }
}

/**
 * Safe call to desktopAPI method with optional fallback
 * @param {string} method - desktopAPI method name
 * @param {*[]} [args] - Arguments to pass
 * @returns {*} Result or undefined
 */
function callApi(method, ...args){
  try {
    if(window.desktopAPI && typeof window.desktopAPI[method] === 'function'){
      return window.desktopAPI[method](...args);
    }
  } catch(_){ }
  return undefined;
}

/**
 * Bind a simple button click to an API call
 * @param {string} btnId - Button element ID
 * @param {string} apiMethod - desktopAPI method to call
 */
function bindBtnToApi(btnId, apiMethod){
  try {
    const btn = document.getElementById(btnId);
    if(btn && !btn.dataset.apiBound){
      btn.dataset.apiBound = '1';
      btn.addEventListener('click', () => { callApi(apiMethod); });
    }
  } catch(_){ }
}

/**
 * Bind checkbox to get/set API pair
 * @param {string} chkId - Checkbox element ID
 * @param {string} getMethod - desktopAPI getter method
 * @param {string} setMethod - desktopAPI setter method
 * @param {string} [onUpdateMethod] - desktopAPI subscription method for updates
 */
function bindCheckboxToApi(chkId, getMethod, setMethod, onUpdateMethod){
  try {
    const cb = document.getElementById(chkId);
    if(!cb) return;
    // Initial value
    if(window.desktopAPI && window.desktopAPI[getMethod]){
      window.desktopAPI[getMethod]().then(v => { cb.checked = !!v; }).catch(() => {});
    }
    // On change
    cb.addEventListener('change', () => { callApi(setMethod, cb.checked); });
    // Subscribe to updates
    if(onUpdateMethod && window.desktopAPI && window.desktopAPI[onUpdateMethod]){
      window.desktopAPI[onUpdateMethod](p => { cb.checked = !!(p && (p.enabled !== undefined ? p.enabled : p)); });
    }
  } catch(_){ }
}

/**
 * Bind select dropdown to get/set API pair
 * @param {string} selId - Select element ID
 * @param {string} getMethod - desktopAPI getter method
 * @param {string} setMethod - desktopAPI setter method
 */
function bindSelectToApi(selId, getMethod, setMethod){
  try {
    const sel = document.getElementById(selId);
    if(!sel) return;
    if(window.desktopAPI && window.desktopAPI[getMethod]){
      window.desktopAPI[getMethod]().then(v => { if(v) sel.value = v; }).catch(() => {});
    }
    sel.addEventListener('change', () => { callApi(setMethod, sel.value); });
  } catch(_){ }
}

// ES module exports
export { invoke, send, on, callApi, bindBtnToApi, bindCheckboxToApi, bindSelectToApi };

const ApiHelpers = { invoke, send, on, callApi, bindBtnToApi, bindCheckboxToApi, bindSelectToApi };
export default ApiHelpers;

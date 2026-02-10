// Shared desktopAPI polyfill for views without full preload.js
// Use: require('./ui/desktop_api_shim').ensureDesktopAPI()
// This creates a minimal window.desktopAPI bridge when nodeIntegration is enabled.

(function(global){
  if(global.__desktopAPIShimLoaded) return;
  global.__desktopAPIShimLoaded = true;

  function ensureDesktopAPI(){
    if(global.desktopAPI) return global.desktopAPI; // Already exists (from preload.js)

    let ipcRenderer = null;
    try {
      // nodeIntegration must be enabled for this to work
      const electron = require('electron');
      ipcRenderer = electron.ipcRenderer;
    } catch(e){
      console.warn('[desktopAPI-shim] Cannot access ipcRenderer - nodeIntegration may be disabled');
      return null;
    }

    if(!ipcRenderer) return null;

    // Helper to create event subscription with cleanup
    function withUnsub(channel, wrap){
      const handler = (_, payload) => { try { wrap(payload); } catch(_){} };
      ipcRenderer.on(channel, handler);
      return () => ipcRenderer.removeListener(channel, handler);
    }

    // Build API from shared definition
    const buildDesktopAPI = require('../../main/modules/utils/apiDef');
    const api = buildDesktopAPI(ipcRenderer, withUnsub);

    global.desktopAPI = api;
    console.log('[desktopAPI-shim] Installed minimal API bridge');
    return api;
  }

  // Auto-init on load
  ensureDesktopAPI();

  // Export for CommonJS require
  if(typeof module !== 'undefined' && module.exports){
    module.exports = { ensureDesktopAPI };
  }
})(typeof window !== 'undefined' ? window : global);

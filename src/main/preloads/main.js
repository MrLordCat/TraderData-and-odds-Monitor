const { contextBridge, ipcRenderer } = require('electron');
const buildDesktopAPI = require('../modules/utils/apiDef');

// Small helper to register an event and return an unsubscribe for convenience.
function withUnsub(channel, wrap){
  const handler = (_, payload) => wrap(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

contextBridge.exposeInMainWorld('desktopAPI', buildDesktopAPI(ipcRenderer, withUnsub));

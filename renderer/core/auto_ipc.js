export function sendAutoPress(payload){
  try {
    if(window.desktopAPI && typeof window.desktopAPI.invoke==='function'){
      return window.desktopAPI.invoke('send-auto-press', payload);
    }
  } catch(_){ }
  try {
    const { ipcRenderer } = window.require? window.require('electron') : {};
    if(ipcRenderer && typeof ipcRenderer.invoke==='function'){
      return ipcRenderer.invoke('send-auto-press', payload);
    }
  } catch(_){ }
  return Promise.resolve(false);
}

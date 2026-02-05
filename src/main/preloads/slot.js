// Slot placeholder: just shows outline + preset tag (no add button).
const { contextBridge, ipcRenderer } = require('electron');

// Expose theme API for slots
contextBridge.exposeInMainWorld('desktopAPI', {
  themeGet: () => ipcRenderer.invoke('theme-get'),
  onThemeChanged: (cb) => {
    ipcRenderer.on('theme-changed', (_, theme) => cb(theme));
  }
});

window.addEventListener('DOMContentLoaded', () => {
  try {
    const params = new URLSearchParams(location.search);
    const preset = params.get('preset') || '';
    const lbl = document.getElementById('presetId'); if (lbl) lbl.textContent = preset;
  } catch(_){ }
});

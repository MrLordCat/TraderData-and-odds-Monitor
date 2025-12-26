const { contextBridge, ipcRenderer } = require('electron');
const url = new URL(window.location.href);
const slotIndex = parseInt(url.searchParams.get('slot')||'0',10);
contextBridge.exposeInMainWorld('AddBrokerAPI', {
  getData: async () => {
    // We can't query main for BROKERS directly (not exposed); so we request via custom channel
    return new Promise(resolve => {
      ipcRenderer.once('add-broker-data', (_e, payload)=> resolve(payload));
      ipcRenderer.send('request-add-broker-data', { slotIndex });
    });
  },
  selectBroker: (id, slotIndex) => ipcRenderer.send('add-broker-selected', { id, slotIndex })
  ,onSync: (cb) => {
    const handler = (_e, payload)=>{ try { cb(payload && payload.ids ? payload.ids : []); } catch(_){} };
    ipcRenderer.on('brokers-sync', handler);
    return () => ipcRenderer.removeListener('brokers-sync', handler);
  }
});

// Per-broker proxy settings IPC
// Manages SOCKS5 proxy list and per-broker proxy assignment

const { session } = require('electron');

function initProxyIpc({ ipcMain, store }) {
  ipcMain.handle('proxy-get-list', () => {
    try { return store.get('proxyList') || []; } catch (_) { return []; }
  });

  ipcMain.on('proxy-set-list', (_e, list) => {
    try { store.set('proxyList', Array.isArray(list) ? list : []); } catch (_) {}
  });

  ipcMain.handle('proxy-import-foxyproxy', (_e, json) => {
    try {
      const parsed = typeof json === 'string' ? JSON.parse(json) : json;
      const data = parsed.data || parsed;
      if (!Array.isArray(data)) return { success: false, error: 'Invalid format' };
      const imported = data.filter(p => p.hostname && p.port).map(p => ({
        title: p.title || p.hostname + ':' + p.port,
        type: p.type || 'socks5',
        hostname: p.hostname,
        port: String(p.port),
        username: p.username || '',
        password: p.password || '',
        cc: p.cc || '',
        color: p.color || ''
      }));
      const existing = store.get('proxyList') || [];
      const existingKeys = new Set(existing.map(p => p.hostname + ':' + p.port));
      const newProxies = imported.filter(p => !existingKeys.has(p.hostname + ':' + p.port));
      const merged = [...existing, ...newProxies];
      store.set('proxyList', merged);
      return { success: true, added: newProxies.length, total: merged.length };
    } catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('proxy-get-broker-map', () => {
    try { return store.get('brokerProxyMap') || {}; } catch (_) { return {}; }
  });

  ipcMain.on('proxy-set-broker-map', (_e, map) => {
    try { store.set('brokerProxyMap', map || {}); } catch (_) {}
  });

  ipcMain.handle('proxy-remove', (_e, index) => {
    try {
      const list = store.get('proxyList') || [];
      if (index < 0 || index >= list.length) return { success: false };
      list.splice(index, 1);
      store.set('proxyList', list);
      const brokerMap = store.get('brokerProxyMap') || {};
      const newMap = {};
      for (const [bid, idx] of Object.entries(brokerMap)) {
        if (idx === index) continue;
        if (idx > index) newMap[bid] = idx - 1;
        else newMap[bid] = idx;
      }
      store.set('brokerProxyMap', newMap);
      return { success: true };
    } catch (e) { return { success: false, error: e.message }; }
  });
}

async function applyBrokerProxy(brokerId, store) {
  try {
    const brokerMap = store.get('brokerProxyMap') || {};
    const proxyIdx = brokerMap[brokerId];
    if (proxyIdx === undefined || proxyIdx === null) return false;
    const proxyList = store.get('proxyList') || [];
    const proxy = proxyList[proxyIdx];
    if (!proxy || !proxy.hostname || !proxy.port) return false;
    const ses = session.fromPartition('persist:' + brokerId);
    const proxyType = (proxy.type || 'socks5').toLowerCase();
    const proxyRule = proxyType + '://' + proxy.hostname + ':' + proxy.port;
    await ses.setProxy({ proxyRules: proxyRule });
    if (proxy.username) {
      ses.removeAllListeners('login');
      ses.on('login', (event, _details, authInfo, callback) => {
        if (authInfo.isProxy) { event.preventDefault(); callback(proxy.username, proxy.password || ''); }
      });
    }
    console.log('[proxy] Applied ' + proxyRule + ' to broker ' + brokerId + ' (' + (proxy.title || '') + ')');
    return true;
  } catch (e) { console.warn('[proxy] Failed for ' + brokerId + ':', e.message); return false; }
}

async function clearBrokerProxy(brokerId) {
  try {
    const ses = session.fromPartition('persist:' + brokerId);
    await ses.setProxy({ proxyRules: '' });
    ses.removeAllListeners('login');
  } catch (_) {}
}

module.exports = { initProxyIpc, applyBrokerProxy, clearBrokerProxy };

/**
 * Extension Bridge - WebSocket server for Edge upTime extension
 * Receives odds from DS (dataservices), sends Excel odds and current map back
 */

const WebSocket = require('ws');
const path = require('path');

// Version of bundled extension (update when shipping new version)
const BUNDLED_EXTENSION_VERSION = '1.1.0';

/**
 * Create extension bridge WebSocket server
 * @param {Object} opts - Options
 * @param {Object} opts.store - electron-store instance
 * @param {Function} opts.onOddsUpdate - callback when odds received from extension
 * @param {Function} opts.onConnect - callback when extension connects
 * @param {Function} opts.onDisconnect - callback when extension disconnects
 * @param {number} opts.port - WebSocket port (default 9876)
 */
function createExtensionBridge(opts = {}) {
  const {
    store,
    onOddsUpdate,
    onConnect,
    onDisconnect,
    port = 9876
  } = opts;

  let wss = null;
  let connectedClient = null;
  let extensionVersion = null;
  let currentMap = store?.get('lastMap') || 1;
  let isLast = store?.get('isLast') || false;
  let lastExcelOdds = null;

  // Start WebSocket server
  function start() {
    if (wss) return;

    try {
      wss = new WebSocket.Server({ port });
      console.log(`[extensionBridge] WebSocket server started on port ${port}`);

      wss.on('connection', handleConnection);
      wss.on('error', (err) => {
        console.warn('[extensionBridge] Server error:', err.message);
      });
    } catch (err) {
      console.error('[extensionBridge] Failed to start server:', err.message);
    }
  }

  // Handle new client connection
  function handleConnection(ws) {
    console.log('[extensionBridge] Extension connected');
    connectedClient = ws;

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
        handleMessage(ws, msg);
      } catch (err) {
        console.warn('[extensionBridge] Parse error:', err.message);
      }
    });

    ws.on('close', () => {
      console.log('[extensionBridge] Extension disconnected');
      if (connectedClient === ws) {
        connectedClient = null;
        extensionVersion = null;
      }
      onDisconnect?.();
    });

    ws.on('error', (err) => {
      console.warn('[extensionBridge] Client error:', err.message);
    });
  }

  // Handle incoming messages from extension
  function handleMessage(ws, msg) {
    switch (msg.type) {
      case 'handshake':
        extensionVersion = msg.version || '1.0.0';
        console.log(`[extensionBridge] Extension version: ${extensionVersion}`);
        
        // Check if update available
        const updateAvailable = isVersionNewer(BUNDLED_EXTENSION_VERSION, extensionVersion);
        
        // Send initial state to extension
        ws.send(JSON.stringify({
          type: 'init',
          currentMap,
          isLast,
          updateAvailable,
          latestVersion: BUNDLED_EXTENSION_VERSION
        }));

        onConnect?.({ version: extensionVersion, updateAvailable });
        break;

      case 'odds-update':
        // Odds received from DS page
        const payload = {
          broker: 'ds',
          map: msg.map || currentMap,
          odds: msg.odds || ['-', '-'],
          frozen: !!msg.frozen,
          ts: Date.now(),
          source: 'extension'
        };
        onOddsUpdate?.(payload);
        break;

      case 'ping':
        ws.send(JSON.stringify({ type: 'pong' }));
        break;

      default:
        console.log('[extensionBridge] Unknown message type:', msg.type);
    }
  }

  // Send current map to extension
  function sendCurrentMap(map, lastFlag) {
    currentMap = map;
    if (typeof lastFlag === 'boolean') isLast = lastFlag;
    if (connectedClient?.readyState === WebSocket.OPEN) {
      connectedClient.send(JSON.stringify({
        type: 'current-map',
        map,
        isLast
      }));
    }
  }

  // Send Excel odds to extension for comparison display
  function sendExcelOdds(odds, map) {
    lastExcelOdds = { odds, map };
    if (connectedClient?.readyState === WebSocket.OPEN) {
      connectedClient.send(JSON.stringify({
        type: 'excel-odds',
        odds,
        map
      }));
    }
  }

  // Notify extension about available update
  function sendUpdateNotification() {
    if (connectedClient?.readyState === WebSocket.OPEN) {
      connectedClient.send(JSON.stringify({
        type: 'update-available',
        latestVersion: BUNDLED_EXTENSION_VERSION
      }));
    }
  }

  // Check if extension is connected
  function isConnected() {
    return connectedClient?.readyState === WebSocket.OPEN;
  }

  // Get connected extension version
  function getExtensionVersion() {
    return extensionVersion;
  }

  // Stop server
  function stop() {
    if (wss) {
      wss.close();
      wss = null;
      connectedClient = null;
      extensionVersion = null;
      console.log('[extensionBridge] Server stopped');
    }
  }

  // Version comparison helper (returns true if v1 > v2)
  function isVersionNewer(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
      if ((parts1[i] || 0) > (parts2[i] || 0)) return true;
      if ((parts1[i] || 0) < (parts2[i] || 0)) return false;
    }
    return false;
  }

  return {
    start,
    stop,
    sendCurrentMap,
    sendExcelOdds,
    sendUpdateNotification,
    isConnected,
    getExtensionVersion,
    BUNDLED_EXTENSION_VERSION
  };
}

module.exports = { createExtensionBridge };

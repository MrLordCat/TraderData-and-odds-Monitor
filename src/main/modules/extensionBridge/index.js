/**
 * Extension Bridge - WebSocket server for Edge upTime extension
 * Receives odds from DS (dataservices), sends Excel odds and current map back
 */

const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const { isNewer } = require('../utils/version');
const { fetchJSON, fetchText } = require('../utils/fetch');

// Version of bundled extension (update when shipping new version)
const BUNDLED_EXTENSION_VERSION = '1.5.0';

// GitHub repo info for auto-update
const GITHUB_OWNER = 'MrLordCat';
const GITHUB_REPO = 'TraderData-and-odds-Monitor';
const EXTENSION_PATH = 'resources/extensions/uptime';

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
  let lastDsOdds = null; // Store latest DS odds for DS Auto mode

  // Start WebSocket server
  function start() {
    if (wss) return;

    try {
      wss = new WebSocket.Server({ port });

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
        
        // Check if update available
        const updateAvailable = isNewer(BUNDLED_EXTENSION_VERSION, extensionVersion);
        
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
        // Store latest DS odds for DS Auto mode
        lastDsOdds = { odds: payload.odds, frozen: payload.frozen, map: payload.map, ts: payload.ts };
        onOddsUpdate?.(payload);
        break;

      case 'ping':
        ws.send(JSON.stringify({ type: 'pong' }));
        break;

      case 'check-update':
        // Check GitHub for latest extension version and update if needed
        checkAndUpdateExtension(ws, msg.currentVersion);
        break;

      default:
        break;
    }
  }

  // Check GitHub for updates and download if available
  async function checkAndUpdateExtension(ws, currentVersion) {
    try {
      // Fetch manifest.json from GitHub main branch
      const manifestUrl = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/main/${EXTENSION_PATH}/manifest.json`;
      
      const manifest = await fetchJSON(manifestUrl);
      const latestVersion = manifest.version;
      
      console.log(`[extensionBridge] GitHub version: ${latestVersion}, current: ${currentVersion}`);
      
      if (!isNewer(latestVersion, currentVersion)) {
        ws.send(JSON.stringify({ 
          type: 'update-result', 
          upToDate: true, 
          version: currentVersion 
        }));
        return;
      }
      
      // Download and update extension files
      console.log('[extensionBridge] Downloading extension update...');
      
      // Get list of extension files to update
      const filesToUpdate = [
        'manifest.json',
        'content.js',
        'uptimeEngine.js',
        'displayManager.js',
        'popup.html',
        'popup.js',
        'styles.css'
      ];
      
      // Determine extension directory (in app resources for packaged, or source for dev)
      const isDev = !app.isPackaged;
      const extDir = isDev 
        ? path.join(__dirname, '..', '..', '..', '..', EXTENSION_PATH)
        : path.join(process.resourcesPath, 'extensions', 'uptime');
      
      // Download each file
      let updatedCount = 0;
      for (const file of filesToUpdate) {
        try {
          const fileUrl = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/main/${EXTENSION_PATH}/${file}`;
          const content = await fetchText(fileUrl);
          const filePath = path.join(extDir, file);
          
          // Ensure directory exists
          fs.mkdirSync(path.dirname(filePath), { recursive: true });
          fs.writeFileSync(filePath, content, 'utf8');
          updatedCount++;
          console.log(`[extensionBridge] Updated: ${file}`);
        } catch (err) {
          console.warn(`[extensionBridge] Failed to update ${file}:`, err.message);
        }
      }
      
      if (updatedCount > 0) {
        ws.send(JSON.stringify({ 
          type: 'update-result', 
          updated: true, 
          version: latestVersion,
          filesUpdated: updatedCount
        }));
        console.log(`[extensionBridge] Extension updated to v${latestVersion}`);
      } else {
        ws.send(JSON.stringify({ 
          type: 'update-result', 
          error: 'Failed to download files' 
        }));
      }
      
    } catch (err) {
      console.error('[extensionBridge] Update check failed:', err.message);
      ws.send(JSON.stringify({ 
        type: 'update-result', 
        error: err.message 
      }));
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
    }
  }

  /**
   * Send auto command to extension for DS page
   * Commands: 'suspend' (ESC), 'trade' (Shift+ESC), 'adjust-up', 'adjust-down'
   * @param {string} command - Command to execute
   * @param {Object} opts - Optional parameters (side, amount, etc.)
   */
  function sendAutoCommand(command, opts = {}) {
    if (connectedClient?.readyState === WebSocket.OPEN) {
      const msg = {
        type: 'auto-command',
        command,
        ...opts,
        ts: Date.now()
      };
      connectedClient.send(JSON.stringify(msg));
      return true;
    }
    console.warn('[extensionBridge] Cannot send auto command - not connected');
    return false;
  }

  /**
   * Get latest DS odds (for DS Auto mode reference)
   */
  function getLastDsOdds() {
    return lastDsOdds;
  }

  return {
    start,
    stop,
    sendCurrentMap,
    sendExcelOdds,
    sendAutoCommand,
    getLastDsOdds,
    isConnected,
    getExtensionVersion,
    BUNDLED_EXTENSION_VERSION
  };
}

module.exports = { createExtensionBridge };

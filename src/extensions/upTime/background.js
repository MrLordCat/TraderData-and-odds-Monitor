// upTime Extension - Background Service Worker
// Manages WebSocket connection to Electron app and message routing

let ws = null;
let reconnectTimer = null;
const RECONNECT_INTERVAL = 15000; // 15 seconds
const WS_URL = 'ws://localhost:9988'; // WebSocket server in Electron app

// Connection state
let connectionState = {
  connected: false,
  lastAttempt: null,
  lastSuccess: null
};

// Initialize connection on extension load
initConnection();

// Connect to Electron app via WebSocket
function initConnection() {
  if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
    console.log('[upTime] Already connecting/connected');
    return;
  }

  connectionState.lastAttempt = Date.now();
  console.log('[upTime] Attempting to connect to', WS_URL);

  try {
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      console.log('[upTime] Connected to Electron app');
      connectionState.connected = true;
      connectionState.lastSuccess = Date.now();
      
      // Send handshake
      ws.send(JSON.stringify({
        type: 'handshake',
        extension: 'upTime',
        version: '1.0.0'
      }));

      // Clear reconnect timer
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[upTime] Message from Electron:', data);
        
        // Handle commands from Electron app
        if (data.type === 'command') {
          handleCommand(data);
        }
      } catch (err) {
        console.error('[upTime] Failed to parse message:', err);
      }
    };

    ws.onerror = (error) => {
      console.error('[upTime] WebSocket error:', error);
      connectionState.connected = false;
    };

    ws.onclose = () => {
      console.log('[upTime] Disconnected from Electron app');
      connectionState.connected = false;
      ws = null;
      
      // Schedule reconnection
      scheduleReconnect();
    };
  } catch (err) {
    console.error('[upTime] Connection failed:', err);
    connectionState.connected = false;
    scheduleReconnect();
  }
}

// Schedule reconnection attempt
function scheduleReconnect() {
  if (reconnectTimer) return;
  
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    initConnection();
  }, RECONNECT_INTERVAL);
  
  console.log('[upTime] Reconnecting in', RECONNECT_INTERVAL / 1000, 'seconds');
}

// Handle commands from Electron app
function handleCommand(data) {
  switch (data.command) {
    case 'ping':
      sendToElectron({ type: 'pong', timestamp: Date.now() });
      break;
    case 'requestExtraction':
      // Request content script to extract odds
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { type: 'extractOdds' });
        }
      });
      break;
  }
}

// Send data to Electron app
function sendToElectron(data) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
    return true;
  }
  return false;
}

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'oddsExtracted') {
    console.log('[upTime] Odds extracted from', sender.tab?.url);
    
    // Forward to Electron app
    const success = sendToElectron({
      type: 'oddsUpdate',
      source: 'extension',
      brokerId: message.brokerId,
      odds: message.odds,
      frozen: message.frozen,
      timestamp: Date.now(),
      url: sender.tab?.url
    });
    
    sendResponse({ success });
  } else if (message.type === 'getConnectionState') {
    sendResponse(connectionState);
  }
  
  return true; // Keep channel open for async response
});

// Periodic connection check
setInterval(() => {
  if (!connectionState.connected && !reconnectTimer) {
    initConnection();
  }
}, RECONNECT_INTERVAL);

console.log('[upTime] Background service worker initialized');

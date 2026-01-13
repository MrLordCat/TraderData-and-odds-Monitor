// WebSocket Server for Extension Communication
// Receives real-time odds data from Chrome/Edge extension

const { WebSocketServer } = require('ws');

/**
 * Create WebSocket server for extension communication
 * @param {Object} options - Configuration options
 * @param {number} options.port - WebSocket server port (default: 9988)
 * @param {Function} options.onOddsUpdate - Callback for odds updates
 * @returns {Object} Server controller
 */
function createWsServer({ port = 9988, onOddsUpdate } = {}) {
  let wss = null;
  let clients = new Set();

  function start() {
    if (wss) {
      console.log('[wsServer] Already running');
      return;
    }

    try {
      wss = new WebSocketServer({ port });

      wss.on('listening', () => {
        console.log(`[wsServer] WebSocket server listening on port ${port}`);
        console.log('[wsServer] Extensions can connect at ws://localhost:' + port);
      });

      wss.on('connection', (ws, req) => {
        const clientId = `${req.socket.remoteAddress}:${req.socket.remotePort}`;
        console.log('[wsServer] Extension connected:', clientId);
        clients.add(ws);

        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            handleMessage(message, ws);
          } catch (err) {
            console.error('[wsServer] Failed to parse message:', err);
          }
        });

        ws.on('close', () => {
          console.log('[wsServer] Extension disconnected:', clientId);
          clients.delete(ws);
        });

        ws.on('error', (err) => {
          console.error('[wsServer] WebSocket error:', err);
          clients.delete(ws);
        });

        // Send welcome message
        try {
          ws.send(JSON.stringify({
            type: 'welcome',
            message: 'Connected to OddsMoni Electron app',
            timestamp: Date.now()
          }));
        } catch (err) {
          console.error('[wsServer] Failed to send welcome:', err);
        }
      });

      wss.on('error', (err) => {
        console.error('[wsServer] Server error:', err);
      });

    } catch (err) {
      console.error('[wsServer] Failed to start server:', err);
    }
  }

  function handleMessage(message, ws) {
    console.log('[wsServer] Message received:', message.type);

    switch (message.type) {
      case 'handshake':
        console.log('[wsServer] Handshake from extension:', message.extension, message.version);
        // Send acknowledgment
        try {
          ws.send(JSON.stringify({
            type: 'handshake_ack',
            timestamp: Date.now()
          }));
        } catch (err) {
          console.error('[wsServer] Failed to send handshake ack:', err);
        }
        break;

      case 'oddsUpdate':
        console.log('[wsServer] Odds update:', message.brokerId, message.odds);
        // Forward to odds processing pipeline
        if (onOddsUpdate) {
          try {
            onOddsUpdate({
              brokerId: message.brokerId,
              odds: message.odds,
              frozen: message.frozen || false,
              source: 'extension',
              timestamp: message.timestamp || Date.now(),
              url: message.url
            });
          } catch (err) {
            console.error('[wsServer] onOddsUpdate callback error:', err);
          }
        }
        break;

      case 'pong':
        console.log('[wsServer] Pong received');
        break;

      default:
        console.log('[wsServer] Unknown message type:', message.type);
    }
  }

  function stop() {
    if (!wss) return;

    console.log('[wsServer] Stopping server...');
    
    // Close all client connections
    clients.forEach(ws => {
      try {
        ws.close();
      } catch (err) {
        console.error('[wsServer] Error closing client:', err);
      }
    });
    clients.clear();

    // Close server
    try {
      wss.close(() => {
        console.log('[wsServer] Server closed');
      });
    } catch (err) {
      console.error('[wsServer] Error closing server:', err);
    }

    wss = null;
  }

  function broadcast(data) {
    if (!wss) return;

    const message = JSON.stringify(data);
    let sent = 0;

    clients.forEach(ws => {
      if (ws.readyState === 1) { // WebSocket.OPEN
        try {
          ws.send(message);
          sent++;
        } catch (err) {
          console.error('[wsServer] Failed to send to client:', err);
        }
      }
    });

    return sent;
  }

  function sendCommand(command, data = {}) {
    return broadcast({
      type: 'command',
      command,
      ...data,
      timestamp: Date.now()
    });
  }

  function getStatus() {
    return {
      running: !!wss,
      port,
      clients: clients.size
    };
  }

  return {
    start,
    stop,
    broadcast,
    sendCommand,
    getStatus
  };
}

module.exports = { createWsServer };

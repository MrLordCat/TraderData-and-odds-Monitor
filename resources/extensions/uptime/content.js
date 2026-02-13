// Main content script - coordinates uptime engine and display manager
let uptimeEngine = null;
let displayManager = null;
let tracker = null; // Legacy compatibility
let oddsBridge = null; // WebSocket bridge to OddsMoni

// Helper to safely call Chrome APIs (handles extension context invalidation)
function safeStorageSet(data) {
  try {
    if (chrome?.runtime?.id) {
      chrome.storage.local.set(data);
    }
  } catch (e) {
    // Extension context invalidated - ignore
  }
}

// ============================================
// OddsBridge - WebSocket client for OddsMoni
// ============================================
class OddsBridge {
  constructor() {
    this.ws = null;
    this.reconnectInterval = 15000; // 15 seconds fixed
    this.oddsInterval = null;
    this.currentMap = 1;
    this.isLast = false;  // Bo1 mode: use Match Up Winner for map 1
    this.connected = false;
    this.version = '1.5.0'; // Extension version (Numpad hotkeys, side-aware adjust)
    this.connect();
  }

  connect() {
    try {
      this.ws = new WebSocket('ws://localhost:9876');

      this.ws.onopen = () => {
        console.log('[upTime] Connected to OddsMoni');
        this.connected = true;
        this.sendHandshake();
        this.startOddsPolling();
        this.updateConnectionStatus(true);
      };

      this.ws.onclose = () => {
        console.log('[upTime] Disconnected from OddsMoni, retry in 15s');
        this.connected = false;
        this.stopOddsPolling();
        this.updateConnectionStatus(false);
        setTimeout(() => this.connect(), this.reconnectInterval);
      };

      this.ws.onerror = (err) => {
        // onerror is always followed by onclose
        console.log('[upTime] WebSocket error');
      };

      this.ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          this.handleMessage(msg);
        } catch (err) {
          console.warn('[upTime] Message parse error:', err);
        }
      };

    } catch (err) {
      console.log('[upTime] WebSocket connection failed, retry in 15s');
      setTimeout(() => this.connect(), this.reconnectInterval);
    }
  }

  sendHandshake() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'handshake',
        version: this.version
      }));
    }
  }

  handleMessage(msg) {
    switch (msg.type) {
      case 'init':
        // Initial state from OddsMoni
        this.currentMap = msg.currentMap || 1;
        this.isLast = !!msg.isLast;
        console.log('[upTime] Init received, map:', this.currentMap, 'isLast:', this.isLast);
        if (msg.updateAvailable) {
          console.log('[upTime] Update available:', msg.latestVersion);
          this.showUpdateNotification(msg.latestVersion);
        }
        break;

      case 'current-map':
        this.currentMap = msg.map || 1;
        this.isLast = !!msg.isLast;
        console.log('[upTime] Map changed to:', this.currentMap, 'isLast:', this.isLast);
        // Immediately send odds for new map
        this.sendOddsNow();
        break;

      case 'update-available':
        this.showUpdateNotification(msg.latestVersion);
        break;

      case 'update-result':
        // Response from OddsMoni after check-update request
        console.log('[upTime] Update result:', msg);
        if (msg.error) {
          safeStorageSet({ extensionUpdateStatus: { error: msg.error } });
        } else if (msg.updated) {
          safeStorageSet({ extensionUpdateStatus: { updated: true, version: msg.version } });
        } else if (msg.upToDate) {
          safeStorageSet({ extensionUpdateStatus: { upToDate: true, version: msg.version } });
        }
        break;

      case 'pong':
        // Heartbeat response
        break;

      case 'auto-command':
        // Auto trading command from OddsMoni
        this.executeAutoCommand(msg.command, msg);
        break;
    }
  }

  /**
   * Execute auto trading command by simulating DS hotkeys
   * Commands:
   *   'suspend' - Press ESC to suspend trading
   *   'trade' - Press Shift+ESC to resume trading
   *   'toggle-suspend' - Toggle: if Trading → suspend (ESC), if Suspended → trade (Shift+ESC)
   *   'adjust-up' - Press spinner up button for given side
   *   'adjust-down' - Press spinner down button for given side
   *   'commit' - Press commit button (Numpad0)
   */
  executeAutoCommand(command, opts = {}) {
    console.log('[upTime] Auto command received:', command, opts);
    let success = false;
    
    try {
      switch (command) {
        case 'suspend': {
          // Click S button to suspend
          const suspBtn = document.getElementById('trading-state-suspend-all-button');
          if (suspBtn) { suspBtn.click(); success = true; }
          break;
        }

        case 'trade': {
          // Click T button to resume trading
          const trBtn = document.getElementById('trading-state-trade-all-button');
          if (trBtn) { trBtn.click(); success = true; }
          break;
        }

        case 'toggle-suspend': {
          // Toggle: determine current state from CSS flags, then click S or T
          const market = document.querySelector('.multisport-market');
          const isSuspended = market?.classList.contains('flags-UserSuspensionStatus-Suspended');
          if (isSuspended) {
            const trBtnT = document.getElementById('trading-state-trade-all-button');
            if (trBtnT) { trBtnT.click(); success = true; }
          } else {
            const sBtnT = document.getElementById('trading-state-suspend-all-button');
            if (sBtnT) { sBtnT.click(); success = true; }
          }
          break;
        }

        case 'adjust-up': {
          // Click spinner up button for the target selection (side 0 or 1)
          const sideIdx = typeof opts.side === 'number' ? opts.side : 0;
          const selContainers = document.querySelectorAll('table.selections-container');
          const upContainer = selContainers[sideIdx] || selContainers[0];
          const upBtn = upContainer?.querySelector('button.spinner-up');
          if (upBtn) {
            upBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            upBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            upBtn.click();
            success = true;
          }
          break;
        }

        case 'adjust-down': {
          // Click spinner down button for the target selection (side 0 or 1)
          const sideIdxD = typeof opts.side === 'number' ? opts.side : 0;
          const selContainersD = document.querySelectorAll('table.selections-container');
          const downContainer = selContainersD[sideIdxD] || selContainersD[0];
          const downBtn = downContainer?.querySelector('button.spinner-down');
          if (downBtn) {
            downBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            downBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            downBtn.click();
            success = true;
          }
          break;
        }

        case 'commit': {
          // Click commit prices button (Numpad0)
          const commitBtn = document.querySelector('button#commit-prices');
          if (commitBtn && !commitBtn.disabled) {
            commitBtn.click();
            success = true;
          }
          break;
        }

        default:
          console.warn('[upTime] Unknown auto command:', command);
      }
    } catch (err) {
      console.error('[upTime] Auto command error:', err);
    }

    // Send acknowledgement back to OddsMoni
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'auto-command-ack',
        command,
        success,
        ts: Date.now()
      }));
    }
  }

  startOddsPolling() {
    // Clear any existing interval
    this.stopOddsPolling();
    
    // Poll every 500ms
    this.oddsInterval = setInterval(() => {
      this.sendOddsNow();
    }, 500);
  }

  stopOddsPolling() {
    if (this.oddsInterval) {
      clearInterval(this.oddsInterval);
      this.oddsInterval = null;
    }
  }

  sendOddsNow() {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    
    const data = window.extractMapOdds?.(this.currentMap, this.isLast);
    if (data) {
      this.ws.send(JSON.stringify({
        type: 'odds-update',
        map: data.map,
        odds: data.odds,
        frozen: data.frozen,
        teams: data.teams
      }));
    }
  }

  updateConnectionStatus(connected) {
    // Save to storage for popup
    safeStorageSet({ oddsMoniConnected: connected });
    
    // Update visual indicator
    let badge = document.getElementById('oddsmoni-connection-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'oddsmoni-connection-badge';
      badge.style.cssText = `
        position: fixed;
        bottom: 10px;
        right: 10px;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 11px;
        font-family: Arial, sans-serif;
        z-index: 99999;
        pointer-events: none;
        transition: all 0.3s ease;
      `;
      document.body.appendChild(badge);
    }
    
    if (connected) {
      badge.textContent = '🟢 OddsMoni';
      badge.style.background = 'rgba(0, 128, 0, 0.8)';
      badge.style.color = '#fff';
    } else {
      badge.textContent = '🔴 OddsMoni (reconnect 15s)';
      badge.style.background = 'rgba(128, 0, 0, 0.8)';
      badge.style.color = '#fff';
    }
  }

  showUpdateNotification(latestVersion) {
    // Simple notification
    let notif = document.getElementById('uptime-update-notif');
    if (!notif) {
      notif = document.createElement('div');
      notif.id = 'uptime-update-notif';
      notif.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        padding: 10px 15px;
        border-radius: 6px;
        font-size: 13px;
        font-family: Arial, sans-serif;
        z-index: 99999;
        background: rgba(255, 165, 0, 0.95);
        color: #000;
        cursor: pointer;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
      `;
      notif.innerHTML = `⚠️ Доступно обновление upTime v${latestVersion}<br><small>Нажмите для закрытия</small>`;
      notif.onclick = () => notif.remove();
      document.body.appendChild(notif);
      
      // Auto-hide after 30 seconds
      setTimeout(() => notif.remove(), 30000);
    }
  }
}

function initTracker() {
    if (uptimeEngine && displayManager) {
        return;
    }
    
    // Initialize uptime tracking engine
    uptimeEngine = new UptimeEngine();
    uptimeEngine.init();
    
    // Initialize display manager
    displayManager = new UptimeDisplayManager(uptimeEngine);
    displayManager.init();
    
    // Legacy compatibility
    tracker = {
        createUptimeDisplay: () => displayManager.createUptimeDisplay(),
        reset: () => displayManager.reset()
    };
    
    // Initialize OddsBridge for OddsMoni integration
    if (!oddsBridge) {
        oddsBridge = new OddsBridge();
    }
}

// Initialize when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTracker);
} else {
    initTracker();
}

// Re-create display if trading-state container changes
const pageObserver = new MutationObserver((mutations) => {
    const hasSignificantChange = mutations.some(mutation => 
        mutation.type === 'childList' && 
        Array.from(mutation.addedNodes).some(node => 
            node.nodeType === Node.ELEMENT_NODE && 
            node.classList?.contains('trading-state-container')
        )
    );
    
    if (hasSignificantChange && !document.querySelector('.uptime-tracker-container')) {
        setTimeout(() => displayManager?.createUptimeDisplay(), 1000);
    }
});

pageObserver.observe(document.body, { childList: true, subtree: true });

// Message handler for popup commands
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'reconnect') {
        console.log('[upTime] Reconnect requested from popup');
        if (oddsBridge) {
            oddsBridge.connect();
        }
        sendResponse({ success: true });
    } else if (message.action === 'resetUptime') {
        console.log('[upTime] Reset uptime requested from popup');
        if (uptimeEngine) {
            uptimeEngine.reset();
        }
        if (displayManager) {
            displayManager.reset();
        }
        sendResponse({ success: true });
    } else if (message.action === 'getStatus') {
        sendResponse({ 
            connected: oddsBridge?.ws?.readyState === WebSocket.OPEN,
            uptime: uptimeEngine?.uptime || 0,
            tracking: uptimeEngine?.isTracking || false
        });
    } else if (message.action === 'checkUpdate') {
        console.log('[upTime] Check update requested from popup');
        // Send update request to OddsMoni via WebSocket
        if (oddsBridge?.ws?.readyState === WebSocket.OPEN) {
            safeStorageSet({ extensionUpdateStatus: { checking: true, message: 'Checking GitHub...' } });
            oddsBridge.ws.send(JSON.stringify({ 
                type: 'check-update',
                currentVersion: chrome.runtime.getManifest().version
            }));
            sendResponse({ success: true });
        } else {
            safeStorageSet({ extensionUpdateStatus: { error: 'Not connected to OddsMoni' } });
            sendResponse({ success: false, error: 'Not connected' });
        }
    }
    return true; // Keep channel open for async response
});

// Hotkeys for spinner buttons (Numpad +/-), Commit (Numpad0), and Suspend/Trade toggle (Numpad1)
// Numpad -  : Decrease odd team 1 (spinner down)
// Numpad +  : Increase odd team 1 (spinner up)
// Numpad 0  : Commit prices
// Numpad 1  : Toggle suspend ↔ trade (ESC / Shift+ESC based on current state)
document.addEventListener('keydown', (e) => {
    // Numpad Subtract (-) -> Decrease odd team 1
    if (e.code === 'NumpadSubtract') {
        const downBtn = document.querySelector('button.spinner-down');
        if (downBtn) {
            downBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            downBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            downBtn.click();
            e.preventDefault();
        }
    }
    
    // Numpad Add (+) -> Increase odd team 1
    if (e.code === 'NumpadAdd') {
        const upBtn = document.querySelector('button.spinner-up');
        if (upBtn) {
            upBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            upBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            upBtn.click();
            e.preventDefault();
        }
    }
    
    // Numpad 0 -> Commit prices
    if (e.code === 'Numpad0') {
        const commitBtn = document.querySelector('button#commit-prices');
        if (commitBtn && !commitBtn.disabled) {
            commitBtn.click();
            e.preventDefault();
        }
    }

    // Numpad 1 -> Toggle suspend/trade (like F21 in Excel mode)
    // Clicks T/S buttons directly (keyboard dispatch unreliable with Angular)
    if (e.code === 'Numpad1') {
        const market = document.querySelector('.multisport-market');
        const isSuspended = market?.classList.contains('flags-UserSuspensionStatus-Suspended');
        if (isSuspended) {
            // Resume trading: click T button
            const tradeBtn = document.getElementById('trading-state-trade-all-button');
            if (tradeBtn) tradeBtn.click();
        } else {
            // Suspend: click S button
            const suspendBtn = document.getElementById('trading-state-suspend-all-button');
            if (suspendBtn) suspendBtn.click();
        }
        e.preventDefault();
    }
}, true);

// Popup script for uptime extension
document.addEventListener('DOMContentLoaded', async () => {
  const connStatus = document.getElementById('connStatus');
  const pageStatus = document.getElementById('pageStatus');
  const connectBtn = document.getElementById('connectBtn');
  const updateBtn = document.getElementById('updateBtn');
  const reloadBtn = document.getElementById('reloadBtn');
  const resetBtn = document.getElementById('resetBtn');
  const updateStatusEl = document.getElementById('updateStatus');
  const versionDisplay = document.getElementById('versionDisplay');
  
  // Get current version from manifest
  const manifest = chrome.runtime.getManifest();
  if (versionDisplay) versionDisplay.textContent = 'v' + manifest.version;

  // Check connection status from storage
  async function refreshStatus() {
    try {
      const data = await chrome.storage.local.get(['oddsMoniConnected', 'uptimeData']);
      
      if (data.oddsMoniConnected) {
        connStatus.textContent = 'Connected';
        connStatus.className = 'status-value connected';
        connectBtn.textContent = '🔌 Reconnect';
      } else {
        connStatus.textContent = 'Disconnected';
        connStatus.className = 'status-value disconnected';
        connectBtn.textContent = '🔌 Connect';
      }

      if (data.uptimeData) {
        const phase = data.uptimeData.currentPhase || '-';
        const status = data.uptimeData.currentTradingStatus || '';
        pageStatus.textContent = status ? `${phase} / ${status}` : phase;
      }
    } catch (err) {
      console.warn('Status check error:', err);
    }
  }

  // Connect button - send message to content script
  connectBtn.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url?.includes('dataservices.betgenius.com')) {
        chrome.tabs.sendMessage(tab.id, { action: 'reconnect' }, (response) => {
          if (chrome.runtime.lastError) {
            // Content script not loaded - need to refresh page
            connStatus.textContent = 'Refresh DS page';
            connStatus.className = 'status-value disconnected';
            return;
          }
          connStatus.textContent = 'Connecting...';
          setTimeout(refreshStatus, 2000);
        });
      } else {
        connStatus.textContent = 'Open DS page first';
        connStatus.className = 'status-value disconnected';
      }
    } catch (err) {
      console.warn('Connect error:', err);
      connStatus.textContent = 'Error';
    }
  });

  // Helper to show update status
  function showUpdateStatus(type, message) {
    updateStatusEl.style.display = 'block';
    updateStatusEl.className = 'update-status ' + type;
    updateStatusEl.textContent = message;
  }
  
  // Helper to reset update button
  function resetUpdateBtn() {
    updateBtn.innerHTML = '<span class="btn-icon">↓</span> Check Updates';
    updateBtn.disabled = false;
  }

  // Check for updates button - direct GitHub check (no DS page needed)
  updateBtn.addEventListener('click', async () => {
    try {
      updateBtn.innerHTML = '<span class="btn-icon">⏳</span> Checking...';
      updateBtn.disabled = true;
      
      const currentVersion = chrome.runtime.getManifest().version;
      
      // Fetch latest manifest from GitHub
      const response = await fetch(
        'https://raw.githubusercontent.com/MrLordCat/TraderData-and-odds-Monitor/main/resources/extensions/uptime/manifest.json',
        { cache: 'no-store' }
      );
      
      if (!response.ok) {
        throw new Error('GitHub request failed: ' + response.status);
      }
      
      const manifest = await response.json();
      const latestVersion = manifest.version;
      
      // Compare versions
      const isNewer = compareVersions(latestVersion, currentVersion) > 0;
      
      if (isNewer) {
        showUpdateStatus('success', '⬆ Update available: v' + latestVersion);
        // Show hint to update via OddsMoni settings
      } else {
        showUpdateStatus('info', '✓ Up to date (v' + currentVersion + ')');
      }
      
    } catch (err) {
      console.warn('Update check error:', err);
      showUpdateStatus('error', '✕ ' + (err.message || 'Check failed'));
    } finally {
      resetUpdateBtn();
    }
  });
  
  // Version comparison helper (returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal)
  function compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      if (p1 > p2) return 1;
      if (p1 < p2) return -1;
    }
    return 0;
  }
  
  // Listen for update status changes (from OddsMoni auto-update)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.extensionUpdateStatus) {
      const status = changes.extensionUpdateStatus.newValue;
      if (status) {
        resetUpdateBtn();
        
        if (status.error) {
          showUpdateStatus('error', '✕ ' + status.error);
        } else if (status.updated) {
          showUpdateStatus('success', '✓ Updated to v' + status.version + '! Click Reload.');
          reloadBtn.classList.remove('btn-secondary');
          reloadBtn.classList.add('btn-primary');
          reloadBtn.innerHTML = '<span class="btn-icon">↻</span> RELOAD NOW';
        } else if (status.upToDate) {
          showUpdateStatus('info', '✓ Up to date (v' + status.version + ')');
        } else if (status.checking) {
          showUpdateStatus('info', '⏳ ' + status.message);
        }
      }
    }
  });

  // Reload extension button
  reloadBtn.addEventListener('click', () => {
    chrome.runtime.reload();
  });

  // Reset uptime button
  resetBtn.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url?.includes('dataservices.betgenius.com')) {
        chrome.tabs.sendMessage(tab.id, { action: 'resetUptime' }, (response) => {
          if (chrome.runtime.lastError) {
            pageStatus.textContent = 'Refresh DS page';
            return;
          }
          pageStatus.textContent = 'Reset!';
          setTimeout(refreshStatus, 1000);
        });
      }
    } catch (err) {
      console.warn('Reset error:', err);
    }
  });

  // Initial status check
  refreshStatus();

  // Update status every 2 seconds while popup is open
  setInterval(refreshStatus, 2000);
});

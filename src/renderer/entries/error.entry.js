/**
 * Entry point for error.html
 * Displays broker load error with reload/close buttons
 */

(function () {
  const u = new URL(window.location.href);
  const bid = u.searchParams.get('bid') || 'broker';
  const code = u.searchParams.get('code') || '';
  const msg = u.searchParams.get('msg') || '';
  const target = u.searchParams.get('target') || '';

  document.getElementById('title').textContent = `${bid} failed to load`;
  document.getElementById('msg').innerHTML = `Could not load broker page.<br/>Error: <strong>${msg}</strong>`;
  document.getElementById('url').textContent = target;
  document.getElementById('code').textContent = 'Error code: ' + code;

  try {
    document.body.setAttribute('data-bid', bid);
  } catch (_) {}

  document.getElementById('reload').addEventListener('click', () => {
    window.location.reload();
  });

  const closeBtn = document.getElementById('close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      try {
        const { ipcRenderer } = require('electron');
        ipcRenderer.send('close-broker', bid);
      } catch (_) {}
    });
  }

  // ESC closes as well
  window.addEventListener('keydown', (e) => {
    try {
      if (e.key === 'Escape') {
        const { ipcRenderer } = require('electron');
        ipcRenderer.send('close-broker', bid);
      }
    } catch (_) {}
  });
})();

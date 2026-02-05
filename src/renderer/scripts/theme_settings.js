/**
 * Theme Sync for Settings Overlay
 * 
 * Settings uses nodeIntegration:true without preload,
 * so we access ipcRenderer directly.
 */

(function() {
  'use strict';
  
  const { ipcRenderer } = require('electron');
  
  /**
   * Apply theme to document
   */
  function applyTheme(theme) {
    const html = document.documentElement;
    if (html.dataset.theme === theme) return;
    html.dataset.theme = theme;
  }
  
  /**
   * Initialize theme sync
   */
  function initTheme() {
    // Listen for theme changes from main process (including initial load)
    ipcRenderer.on('theme-changed', (_, theme) => {
      applyTheme(theme);
    });
    
    // Also try to load immediately via invoke (backup)
    ipcRenderer.invoke('theme-get').then(savedTheme => {
      applyTheme(savedTheme || 'dark');
    }).catch(() => {
      // Will be set by theme-changed event from did-finish-load
    });
  }
  
  // Auto-init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTheme);
  } else {
    initTheme();
  }
})();

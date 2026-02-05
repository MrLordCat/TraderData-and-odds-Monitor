/**
 * Theme Toggle Module
 * 
 * v0.3.0 - Global light/dark theme switching
 * Handles theme initialization, toggling, and synchronization.
 */

(function() {
  'use strict';
  
  const ANIMATION_DURATION = 350;
  
  /**
   * Apply theme to document
   * @param {string} theme - 'dark' or 'light'
   * @param {boolean} animate - Whether to play transition animation
   */
  function applyTheme(theme, animate = true) {
    const html = document.documentElement;
    const currentTheme = html.dataset.theme || 'dark';
    
    if (currentTheme === theme) return;
    
    if (animate) {
      // Determine animation direction
      const isToLight = theme === 'light';
      const animClass = isToLight ? 'theme-transitioning' : 'theme-transitioning-reverse';
      
      html.classList.add(animClass);
      
      setTimeout(() => {
        html.classList.remove(animClass);
      }, ANIMATION_DURATION);
    }
    
    html.dataset.theme = theme;
    updateToggleButton(theme);
    
  }
  
  /**
   * Update toggle button icon based on current theme
   * @param {string} theme - 'dark' or 'light'
   */
  function updateToggleButton(theme) {
    const btn = document.getElementById('btnThemeToggle');
    if (!btn) return;
    
    const iconSun = btn.querySelector('.icon-sun');
    const iconMoon = btn.querySelector('.icon-moon');
    
    if (iconSun && iconMoon) {
      // In dark mode, show sun (to switch to light)
      // In light mode, show moon (to switch to dark)
      iconSun.style.display = theme === 'dark' ? 'inline' : 'none';
      iconMoon.style.display = theme === 'light' ? 'inline' : 'none';
    }
    
    btn.title = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
  }
  
  /**
   * Toggle theme via IPC
   */
  async function toggleTheme() {
    try {
      // Check desktopAPI first (preload-based pages)
      if (window.desktopAPI && window.desktopAPI.themeToggle) {
        const newTheme = await window.desktopAPI.themeToggle();
        applyTheme(newTheme, true);
        return;
      }
      
      // Fallback for nodeIntegration pages (stats_panel, settings)
      if (typeof require !== 'undefined') {
        try {
          const { ipcRenderer } = require('electron');
          const newTheme = await ipcRenderer.invoke('theme-toggle');
          applyTheme(newTheme, true);
          return;
        } catch (_) { }
      }
      
      // Last resort: visual only (no persist)
      const current = document.documentElement.dataset.theme || 'dark';
      const next = current === 'dark' ? 'light' : 'dark';
      applyTheme(next, true);
    } catch (e) {
      console.error('[theme] Toggle failed:', e);
    }
  }
  
  /**
   * Initialize theme system
   * - Load saved theme from store
   * - Set up IPC listener for cross-window sync
   * - Attach click handler to toggle button
   */
  async function initTheme() {
    const html = document.documentElement;
    
    // Prevent flash of wrong theme during load
    html.classList.add('no-transitions');
    
    // Get ipcRenderer reference for nodeIntegration pages
    let ipcRenderer = null;
    if (typeof require !== 'undefined') {
      try { ipcRenderer = require('electron').ipcRenderer; } catch(_) {}
    }
    
    // Load saved theme
    try {
      if (window.desktopAPI && window.desktopAPI.themeGet) {
        const savedTheme = await window.desktopAPI.themeGet();
        applyTheme(savedTheme, false);
      } else if (ipcRenderer) {
        const savedTheme = await ipcRenderer.invoke('theme-get');
        applyTheme(savedTheme || 'dark', false);
      }
    } catch (e) {
      console.warn('[theme] Failed to load saved theme:', e);
    }
    
    // Enable transitions after initial load
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        html.classList.remove('no-transitions');
      });
    });
    
    // Listen for theme changes from other windows
    if (window.desktopAPI && window.desktopAPI.onThemeChanged) {
      window.desktopAPI.onThemeChanged((theme) => {
        applyTheme(theme, true);
      });
    } else if (ipcRenderer) {
      ipcRenderer.on('theme-changed', (_, theme) => {
        applyTheme(theme, true);
      });
    }
    
    // Attach click handler to toggle button
    const btn = document.getElementById('btnThemeToggle');
    if (btn) {
      btn.addEventListener('click', toggleTheme);
      updateToggleButton(html.dataset.theme || 'dark');
    }
  }
  
  // Export for external use
  window.themeToggle = {
    init: initTheme,
    toggle: toggleTheme,
    apply: applyTheme
  };
  
  // Auto-init when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTheme);
  } else {
    initTheme();
  }
})();

/**
 * Entry point for settings.html
 * Orchestrates all settings modules
 */

// Use require for electron (available in Electron context)
const { ipcRenderer } = require('electron');

// Import all settings modules
import { init as initModule } from '../scripts/settings/init.js';
import { init as initAutoSettings, loadFromStore as loadAutoSettings, saveAll as saveAutoSettings } from '../scripts/settings/auto-settings.js';
import { init as initBrokerRefresh, saveAll as saveBrokerRefresh } from '../scripts/settings/broker-refresh.js';
import { init as initHeatbar, applyConfig as applyHeatbarConfig, reset as resetHeatbar, save as saveHeatbar } from '../scripts/settings/heatbar.js';
import { init as initUpdater } from '../scripts/settings/updater.js';
import { init as initExtension } from '../scripts/settings/extension.js';
import { init as initGameSelector } from '../scripts/settings/game-selector.js';
import { init as initAddons } from '../scripts/settings/addons.js';
import { initSounds, gatherSettings as gatherSoundsSettings, resetToDefaults as resetSounds } from '../scripts/settings/sounds.js';
import { init as initChangelog } from '../scripts/settings/changelog.js';

// Buffer for config that arrives before DOM ready
let pendingConfig = null;
let domReady = false;

/**
 * Tab switching logic
 */
function initTabs() {
  const tabBar = document.querySelector('.tab-bar');
  if (!tabBar) return;

  tabBar.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab');
    if (!btn || btn.classList.contains('active')) return;

    const tabId = btn.dataset.tab;

    // Deactivate all tab buttons
    tabBar.querySelectorAll('.tab').forEach(t => {
      t.classList.remove('active');
      t.setAttribute('aria-selected', 'false');
    });

    // Activate clicked tab button
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');

    // Switch content panels
    document.querySelectorAll('.tab-content').forEach(panel => {
      if (panel.dataset.tab === tabId) {
        panel.classList.add('active');
        panel.hidden = false;
      } else {
        panel.classList.remove('active');
        panel.hidden = true;
      }
    });
  });
}

/**
 * Initialize About tab version info
 */
function initAboutVersion() {
  try {
    const aboutVer = document.getElementById('about-version');
    if (!aboutVer) return;
    ipcRenderer.invoke('updater-get-version').then(info => {
      if (info && info.version) {
        let text = 'Version ' + info.version;
        if (info.buildInfo && info.buildInfo.channel === 'dev') text += ' (dev)';
        aboutVer.textContent = text;
      }
    }).catch(() => {});
  } catch (_) {}

  // GitHub link handler
  try {
    const link = document.querySelector('.aboutLink[data-url]');
    if (link) {
      link.addEventListener('click', () => {
        const url = link.dataset.url;
        if (url) require('electron').shell.openExternal(url);
      });
    }
  } catch (_) {}
}

function applyConfig(cfg) {
  // Apply heat bar / stats config
  applyHeatbarConfig(cfg);

  // Load auto settings from store
  loadAutoSettings();

  // Pre-apply game selector from payload if present
  try {
    const sel = document.getElementById('game-select');
    if (sel && cfg && cfg.selectedGame) {
      sel.value = cfg.selectedGame;
    }
  } catch (_) {}
}

function initAll() {
  if (domReady) return; // prevent double init
  domReady = true;

  // ===== Tab switching =====
  initTabs();

  // Initialize all modules (wrapped in try-catch to prevent one failure breaking everything)
  try { initModule(); } catch (e) { console.error('[settings] init module failed:', e); }
  try { initAutoSettings(); } catch (e) { console.error('[settings] autoSettings init failed:', e); }
  try { initBrokerRefresh(); } catch (e) { console.error('[settings] brokerRefresh init failed:', e); }
  try { initHeatbar(); } catch (e) { console.error('[settings] heatbar init failed:', e); }
  try { initUpdater(); } catch (e) { console.error('[settings] updater init failed:', e); }
  try { initExtension(); } catch (e) { console.error('[settings] extension init failed:', e); }
  try { initGameSelector(); } catch (e) { console.error('[settings] gameSelector init failed:', e); }
  try { initAddons(); } catch (e) { console.error('[settings] addons init failed:', e); }
  try { initSounds(); } catch (e) { console.error('[settings] sounds init failed:', e); }
  try { initChangelog(); } catch (e) { console.error('[settings] changelog init failed:', e); }
  try { initAboutVersion(); } catch (e) { console.error('[settings] about init failed:', e); }

  // ===== Main buttons =====
  const resetBtn = document.getElementById('reset');
  const saveBtn = document.getElementById('save');
  const closeBtn = document.getElementById('close');
  const backdrop = document.getElementById('backdrop');

  if (resetBtn) resetBtn.onclick = () => {
    resetHeatbar();
    resetSounds();
  };

  if (saveBtn) {
    saveBtn.onclick = async () => {
      saveHeatbar();
      saveAutoSettings();
      saveBrokerRefresh();
      
      // Save sounds settings
      const soundsSettings = gatherSoundsSettings();
      try {
        ipcRenderer.send('set-setting', { key: 'soundsEnabled', value: soundsSettings.soundsEnabled });
        ipcRenderer.send('set-setting', { key: 'soundsVolume', value: soundsSettings.soundsVolume });
      } catch (e) {
        console.error('[settings] save sounds failed:', e);
      }
      
      // Notify all windows to reload settings
      ipcRenderer.send('settings-saved');
      ipcRenderer.send('close-settings');
    };
  }

  if (closeBtn) closeBtn.onclick = () => ipcRenderer.send('close-settings');
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') ipcRenderer.send('close-settings');
  });
  if (backdrop) backdrop.onclick = () => ipcRenderer.send('close-settings');

  // Apply any config that arrived before init
  if (pendingConfig) {
    applyConfig(pendingConfig);
    pendingConfig = null;
  }
}

// Handle both cases: script loaded before or after DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAll);
} else {
  // DOM already ready (script at end of body)
  initAll();
}

// ===== Settings init from main process =====
ipcRenderer.on('settings-init', (_e, cfg) => {
  if (domReady) {
    applyConfig(cfg);
  } else {
    // Buffer config until DOM is ready
    pendingConfig = cfg;
  }
});

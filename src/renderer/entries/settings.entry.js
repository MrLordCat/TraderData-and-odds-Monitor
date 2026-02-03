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

// Buffer for config that arrives before DOM ready
let pendingConfig = null;
let domReady = false;

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

  // Initialize all modules (wrapped in try-catch to prevent one failure breaking everything)
  try { initModule(); } catch (e) { console.error('[settings] init module failed:', e); }
  try { initAutoSettings(); } catch (e) { console.error('[settings] autoSettings init failed:', e); }
  try { initBrokerRefresh(); } catch (e) { console.error('[settings] brokerRefresh init failed:', e); }
  try { initHeatbar(); } catch (e) { console.error('[settings] heatbar init failed:', e); }
  try { initUpdater(); } catch (e) { console.error('[settings] updater init failed:', e); }
  try { initExtension(); } catch (e) { console.error('[settings] extension init failed:', e); }
  try { initGameSelector(); } catch (e) { console.error('[settings] gameSelector init failed:', e); }
  try { initAddons(); } catch (e) { console.error('[settings] addons init failed:', e); }

  // ===== Main buttons =====
  const resetBtn = document.getElementById('reset');
  const saveBtn = document.getElementById('save');
  const closeBtn = document.getElementById('close');
  const backdrop = document.getElementById('backdrop');

  if (resetBtn) resetBtn.onclick = () => resetHeatbar();

  if (saveBtn) {
    saveBtn.onclick = () => {
      saveHeatbar();
      saveAutoSettings();
      saveBrokerRefresh();
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

// Settings - main entry point
// Modular structure: each section is a separate module
const { ipcRenderer } = require('electron');
const path = require('path');

// Resolve module paths relative to this script, not the HTML file
const baseDir = path.join(__dirname, '..', 'scripts', 'settings');

const initModule = require(path.join(baseDir, 'init'));
const autoSettings = require(path.join(baseDir, 'auto-settings'));
const heatbar = require(path.join(baseDir, 'heatbar'));
const updater = require(path.join(baseDir, 'updater'));
const extension = require(path.join(baseDir, 'extension'));
const gameSelector = require(path.join(baseDir, 'game-selector'));
const addons = require(path.join(baseDir, 'addons'));

// Buffer for config that arrives before DOM ready
let pendingConfig = null;
let domReady = false;

function applyConfig(cfg) {
	// Apply heat bar / stats config
	heatbar.applyConfig(cfg);

	// Load auto settings from store
	autoSettings.loadFromStore();

	// Pre-apply game selector from payload if present
	try {
		const sel = document.getElementById('game-select');
		if (sel && cfg && cfg.selectedGame) {
			sel.value = cfg.selectedGame;
		}
	} catch (_) { }
}

function initAll() {
	if (domReady) return; // prevent double init
	domReady = true;

	// Initialize all modules (wrapped in try-catch to prevent one failure breaking everything)
	try { initModule.init(); } catch (e) { console.error('[settings] init module failed:', e); }
	try { autoSettings.init(); } catch (e) { console.error('[settings] autoSettings init failed:', e); }
	try { heatbar.init(); } catch (e) { console.error('[settings] heatbar init failed:', e); }
	try { updater.init(); } catch (e) { console.error('[settings] updater init failed:', e); }
	try { extension.init(); } catch (e) { console.error('[settings] extension init failed:', e); }
	try { gameSelector.init(); } catch (e) { console.error('[settings] gameSelector init failed:', e); }
	try { addons.init(); } catch (e) { console.error('[settings] addons init failed:', e); }

	// ===== Main buttons =====
	const resetBtn = document.getElementById('reset');
	const saveBtn = document.getElementById('save');
	const closeBtn = document.getElementById('close');
	const backdrop = document.getElementById('backdrop');

	if (resetBtn) resetBtn.onclick = () => heatbar.reset();

	if (saveBtn) saveBtn.onclick = () => {
		heatbar.save();
		autoSettings.saveAll();
		ipcRenderer.send('close-settings');
	};

	if (closeBtn) closeBtn.onclick = () => ipcRenderer.send('close-settings');
	window.addEventListener('keydown', e => { if (e.key === 'Escape') ipcRenderer.send('close-settings'); });
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

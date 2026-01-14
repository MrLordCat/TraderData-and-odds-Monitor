// Settings - main entry point
// Modular structure: each section is a separate module
const { ipcRenderer } = require('electron');

const initModule = require('./init');
const autoSettings = require('./auto-settings');
const heatbar = require('./heatbar');
const updater = require('./updater');
const extension = require('./extension');
const gameSelector = require('./game-selector');
const addons = require('./addons');

// Initialize all modules
initModule.init();
autoSettings.init();
heatbar.init();
updater.init();
extension.init();
gameSelector.init();
addons.init();

// ===== Main buttons =====
document.getElementById('reset').onclick = () => {
	heatbar.reset();
};

document.getElementById('save').onclick = () => {
	heatbar.save();
	autoSettings.saveAll();
	ipcRenderer.send('close-settings');
};

document.getElementById('close').onclick = () => ipcRenderer.send('close-settings');
window.addEventListener('keydown', e => { if (e.key === 'Escape') ipcRenderer.send('close-settings'); });
document.getElementById('backdrop').onclick = () => ipcRenderer.send('close-settings');

// ===== Settings init from main process =====
ipcRenderer.on('settings-init', (_e, cfg) => {
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
});

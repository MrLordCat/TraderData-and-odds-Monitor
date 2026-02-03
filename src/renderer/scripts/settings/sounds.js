// Sound notifications settings module
const { ipcRenderer } = require('electron');

// ===== State =====
let soundsEnabled = true;
let soundsVolume = 70; // 0-100

// ===== Clamp helpers =====
function clampVolume(v) { return Math.max(0, Math.min(100, Math.round(v))); }

// ===== DOM elements cache =====
let elements = {};

function cacheElements() {
	elements = {
		soundsEnabledInput: document.getElementById('sounds-enabled'),
		soundsVolumeInput: document.getElementById('sounds-volume'),
		soundsVolumeVal: document.getElementById('sounds-volume-val'),
	};
}

// ===== Load settings =====
async function loadSounds() {
	try {
		// Load each setting individually using existing IPC handler
		const [enabled, volume] = await Promise.all([
			ipcRenderer.invoke('get-setting', 'soundsEnabled'),
			ipcRenderer.invoke('get-setting', 'soundsVolume')
		]);
		
		// Sounds enabled
		if (typeof enabled === 'boolean') {
			soundsEnabled = enabled;
		}
		
		// Sounds volume
		if (typeof volume === 'number') {
			soundsVolume = clampVolume(volume);
		}
	} catch (err) {
		console.warn('[sounds] load error:', err);
	}
}

// ===== Update UI from state =====
function updateUI() {
	if (!elements.soundsEnabledInput) return;
	
	elements.soundsEnabledInput.checked = soundsEnabled;
	elements.soundsVolumeInput.value = soundsVolume;
	elements.soundsVolumeVal.textContent = `${soundsVolume}%`;
}

// ===== Read UI into state =====
function readUI() {
	if (!elements.soundsEnabledInput) return;
	
	soundsEnabled = elements.soundsEnabledInput.checked;
	soundsVolume = clampVolume(parseFloat(elements.soundsVolumeInput.value) || 70);
}

// ===== Attach event listeners =====
function attachListeners() {
	if (!elements.soundsEnabledInput) return;
	
	// Enabled checkbox
	elements.soundsEnabledInput.addEventListener('change', () => {
		soundsEnabled = elements.soundsEnabledInput.checked;
	});
	
	// Volume slider
	elements.soundsVolumeInput.addEventListener('input', () => {
		soundsVolume = clampVolume(parseFloat(elements.soundsVolumeInput.value) || 70);
		elements.soundsVolumeVal.textContent = `${soundsVolume}%`;
	});
}

// ===== Gather settings to save =====
function gatherSettings() {
	readUI();
	return {
		soundsEnabled,
		soundsVolume,
	};
}

// ===== Reset to defaults =====
function resetToDefaults() {
	soundsEnabled = true;
	soundsVolume = 70;
	updateUI();
}

// ===== Init =====
async function initSounds() {
	cacheElements();
	await loadSounds();
	updateUI();
	attachListeners();
}

// ===== Exports =====
module.exports = {
	initSounds,
	gatherSettings,
	resetToDefaults,
};

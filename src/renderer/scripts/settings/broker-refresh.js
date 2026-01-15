// Broker Refresh settings module
const { ipcRenderer } = require('electron');

// ===== State =====
let mapReselectEnabled = true;
let mapReselectIntervalSec = 10;
let staleReloadEnabled = true;
let staleMissingTimeoutMin = 1;
let staleUnchangedTimeoutMin = 3;

// ===== Clamp helpers =====
function clampReselectInterval(v) { return Math.max(5, Math.min(60, Math.floor(v))); }
function clampMissingTimeout(v) { return Math.max(1, Math.min(10, Math.floor(v))); }
function clampUnchangedTimeout(v) { return Math.max(1, Math.min(10, Math.floor(v))); }

// ===== Load from store =====
async function loadFromStore() {
	try {
		const cfg = await ipcRenderer.invoke('get-broker-refresh-settings');
		if (cfg) {
			mapReselectEnabled = cfg.mapReselectEnabled !== false;
			mapReselectIntervalSec = clampReselectInterval(cfg.mapReselectIntervalSec || 10);
			staleReloadEnabled = cfg.staleReloadEnabled !== false;
			staleMissingTimeoutMin = clampMissingTimeout(cfg.staleMissingTimeoutMin || 1);
			staleUnchangedTimeoutMin = clampUnchangedTimeout(cfg.staleUnchangedTimeoutMin || 3);
		}
	} catch (_) { }
	updateUI();
}

// ===== Update UI =====
function updateUI() {
	const reselectEnabled = document.getElementById('br-reselect-enabled');
	const reselectInterval = document.getElementById('br-reselect-interval');
	const reselectIntervalVal = document.getElementById('br-reselect-interval-val');
	const reloadEnabled = document.getElementById('br-reload-enabled');
	const missingTimeout = document.getElementById('br-missing-timeout');
	const missingTimeoutVal = document.getElementById('br-missing-timeout-val');
	const unchangedTimeout = document.getElementById('br-unchanged-timeout');
	const unchangedTimeoutVal = document.getElementById('br-unchanged-timeout-val');

	if (reselectEnabled) reselectEnabled.checked = mapReselectEnabled;
	if (reselectInterval) {
		reselectInterval.value = mapReselectIntervalSec;
		reselectInterval.disabled = !mapReselectEnabled;
	}
	if (reselectIntervalVal) reselectIntervalVal.textContent = mapReselectIntervalSec + 's';

	if (reloadEnabled) reloadEnabled.checked = staleReloadEnabled;
	if (missingTimeout) {
		missingTimeout.value = staleMissingTimeoutMin;
		missingTimeout.disabled = !staleReloadEnabled;
	}
	if (missingTimeoutVal) missingTimeoutVal.textContent = staleMissingTimeoutMin + ' min';

	if (unchangedTimeout) {
		unchangedTimeout.value = staleUnchangedTimeoutMin;
		unchangedTimeout.disabled = !staleReloadEnabled;
	}
	if (unchangedTimeoutVal) unchangedTimeoutVal.textContent = staleUnchangedTimeoutMin + ' min';
}

// ===== Save all =====
function saveAll() {
	const settings = {
		mapReselectEnabled,
		mapReselectIntervalSec,
		staleReloadEnabled,
		staleMissingTimeoutMin,
		staleUnchangedTimeoutMin
	};
	try {
		ipcRenderer.send('set-broker-refresh-settings', settings);
	} catch (_) { }
}

// ===== Init =====
function init() {
	const reselectEnabled = document.getElementById('br-reselect-enabled');
	const reselectInterval = document.getElementById('br-reselect-interval');
	const reselectIntervalVal = document.getElementById('br-reselect-interval-val');
	const reloadEnabled = document.getElementById('br-reload-enabled');
	const missingTimeout = document.getElementById('br-missing-timeout');
	const missingTimeoutVal = document.getElementById('br-missing-timeout-val');
	const unchangedTimeout = document.getElementById('br-unchanged-timeout');
	const unchangedTimeoutVal = document.getElementById('br-unchanged-timeout-val');

	// Reselect enabled checkbox
	if (reselectEnabled) {
		reselectEnabled.addEventListener('change', () => {
			mapReselectEnabled = reselectEnabled.checked;
			if (reselectInterval) reselectInterval.disabled = !mapReselectEnabled;
		});
	}

	// Reselect interval slider
	if (reselectInterval) {
		reselectInterval.addEventListener('input', () => {
			mapReselectIntervalSec = clampReselectInterval(Number(reselectInterval.value));
			if (reselectIntervalVal) reselectIntervalVal.textContent = mapReselectIntervalSec + 's';
		});
	}

	// Reload enabled checkbox
	if (reloadEnabled) {
		reloadEnabled.addEventListener('change', () => {
			staleReloadEnabled = reloadEnabled.checked;
			if (missingTimeout) missingTimeout.disabled = !staleReloadEnabled;
			if (unchangedTimeout) unchangedTimeout.disabled = !staleReloadEnabled;
		});
	}

	// Missing timeout slider
	if (missingTimeout) {
		missingTimeout.addEventListener('input', () => {
			staleMissingTimeoutMin = clampMissingTimeout(Number(missingTimeout.value));
			if (missingTimeoutVal) missingTimeoutVal.textContent = staleMissingTimeoutMin + ' min';
		});
	}

	// Unchanged timeout slider
	if (unchangedTimeout) {
		unchangedTimeout.addEventListener('input', () => {
			staleUnchangedTimeoutMin = clampUnchangedTimeout(Number(unchangedTimeout.value));
			if (unchangedTimeoutVal) unchangedTimeoutVal.textContent = staleUnchangedTimeoutMin + ' min';
		});
	}

	// Load initial values
	loadFromStore();
}

module.exports = { init, loadFromStore, saveAll };

// Auto trading settings module
const { ipcRenderer } = require('electron');

// ===== State =====
let autoIntervalMs = 500;
let autoAdaptiveEnabled = true;
let shockThresholdPct = 80;
let stopOnNoMidEnabled = true;
let fireCooldownMs = 900;
let maxExcelWaitMs = 1600;
let pulseGapMs = 55;
let burst3Enabled = true;
let autoTolerancePct = 0.5;
let autoSuspendThresholdPct = 40.0;

// DS Auto Mode state
let dsAutoModeEnabled = false;
let dsConnectionStatus = false;
let dsStatusPollInterval = null;

// Burst levels (3 tiers)
let burstLevels = [
	{ thresholdPct: 25, pulses: 4 },
	{ thresholdPct: 15, pulses: 3 },
	{ thresholdPct: 10, pulses: 2 },
];

// UI mapping: L1 is lowest threshold, L3 is highest
const BURST_UI = [
	{ ui: 1, modelIndex: 2, thMin: 7, thMax: 15 },
	{ ui: 2, modelIndex: 1, thMin: 10, thMax: 20 },
	{ ui: 3, modelIndex: 0, thMin: 20, thMax: 40 },
];

// ===== Clamp helpers =====
function clampInterval(v) { return Math.max(120, Math.min(2000, Math.floor(v))); }
function clampShock(v) { return Math.max(40, Math.min(120, Math.round(v))); }
function clampCooldown(v) { return Math.max(100, Math.min(3000, Math.floor(v))); }
function clampMaxWait(v) { return Math.max(500, Math.min(5000, Math.floor(v))); }
function clampPulseGap(v) { return Math.max(20, Math.min(200, Math.floor(v))); }
function clampTol(v) { return Math.max(0.5, Math.min(10, Math.round(v * 10) / 10)); }
function clampAutoSuspend(v) { return Math.max(15, Math.min(80, Math.round(v))); }

function clampBurstThreshold(uiLevel, v) {
	const meta = BURST_UI.find(x => x.ui === uiLevel);
	const num = Number(v);
	if (!meta || isNaN(num)) return null;
	return Math.max(meta.thMin, Math.min(meta.thMax, Math.round(num)));
}

function clampBurstPulses(v) {
	const num = Math.round(Number(v));
	if (isNaN(num)) return null;
	return Math.max(1, Math.min(5, num));
}

function sanitizeBurst(list) {
	try {
		if (!Array.isArray(list)) list = burstLevels;
		const cleaned = list.map(l => ({
			thresholdPct: Math.max(1, Math.min(50, Number(l.thresholdPct) || 0)),
			pulses: Math.max(1, Math.min(5, Math.round(Number(l.pulses) || 0)))
		}))
			.filter(l => l.thresholdPct > 0 && l.pulses >= 1)
			.sort((a, b) => b.thresholdPct - a.thresholdPct)
			.slice(0, 3);
		return cleaned.length ? cleaned : [
			{ thresholdPct: 25, pulses: 4 },
			{ thresholdPct: 15, pulses: 3 },
			{ thresholdPct: 10, pulses: 2 },
		];
	} catch (_) {
		return [
			{ thresholdPct: 25, pulses: 4 },
			{ thresholdPct: 15, pulses: 3 },
			{ thresholdPct: 10, pulses: 2 },
		];
	}
}

// ===== DOM elements cache =====
let elements = {};

function cacheElements() {
	elements = {
		// Interval
		autoIntervalInput: document.getElementById('auto-interval'),
		autoIntervalVal: document.getElementById('auto-interval-val'),
		autoAdaptiveInput: document.getElementById('auto-adaptive'),
		// Shock
		autoShockInput: document.getElementById('auto-shock-threshold'),
		autoShockVal: document.getElementById('auto-shock-threshold-val'),
		// Stop on no MID
		autoStopNoMidInput: document.getElementById('auto-stop-no-mid'),
		// Fire cooldown
		autoFireCooldownInput: document.getElementById('auto-fire-cooldown'),
		autoFireCooldownVal: document.getElementById('auto-fire-cooldown-val'),
		// Max Excel wait
		autoMaxExcelWaitInput: document.getElementById('auto-max-excel-wait'),
		autoMaxExcelWaitVal: document.getElementById('auto-max-excel-wait-val'),
		// Pulse gap
		autoPulseGapInput: document.getElementById('auto-pulse-gap'),
		autoPulseGapVal: document.getElementById('auto-pulse-gap-val'),
		// Burst L3
		burst3EnabledInput: document.getElementById('burst3-enabled'),
		// Tolerance
		autoTolInput: document.getElementById('auto-tolerance'),
		autoTolVal: document.getElementById('auto-tolerance-val'),
		// Suspend threshold
		autoSuspendInput: document.getElementById('auto-suspend-threshold'),
		autoSuspendVal: document.getElementById('auto-suspend-threshold-val'),
		// Burst levels
		burstInputs: {
			th1: document.getElementById('burst1-th'), pulses1: document.getElementById('burst1-pulses'),
			th2: document.getElementById('burst2-th'), pulses2: document.getElementById('burst2-pulses'),
			th3: document.getElementById('burst3-th'), pulses3: document.getElementById('burst3-pulses'),
		},
		burstVals: {
			th1: document.getElementById('burst1-th-val'), pulses1: document.getElementById('burst1-pulses-val'),
			th2: document.getElementById('burst2-th-val'), pulses2: document.getElementById('burst2-pulses-val'),
			th3: document.getElementById('burst3-th-val'), pulses3: document.getElementById('burst3-pulses-val'),
		},
		// DS Auto Mode
		dsAutoModeInput: document.getElementById('ds-auto-mode'),
		dsConnectionStatusEl: document.getElementById('ds-connection-status'),
	};
}

// ===== Render functions =====
function renderInterval() {
	try {
		if (elements.autoIntervalInput) elements.autoIntervalInput.value = String(autoIntervalMs);
		if (elements.autoIntervalVal) elements.autoIntervalVal.textContent = autoIntervalMs + 'ms';
	} catch (_) { }
}

function renderShock() {
	try {
		if (elements.autoShockInput) elements.autoShockInput.value = String(shockThresholdPct);
		if (elements.autoShockVal) elements.autoShockVal.textContent = shockThresholdPct + '%';
	} catch (_) { }
}

function renderFireCooldown() {
	try {
		if (elements.autoFireCooldownInput) elements.autoFireCooldownInput.value = String(fireCooldownMs);
		if (elements.autoFireCooldownVal) elements.autoFireCooldownVal.textContent = fireCooldownMs + 'ms';
	} catch (_) { }
}

function renderMaxExcelWait() {
	try {
		if (elements.autoMaxExcelWaitInput) elements.autoMaxExcelWaitInput.value = String(maxExcelWaitMs);
		if (elements.autoMaxExcelWaitVal) elements.autoMaxExcelWaitVal.textContent = maxExcelWaitMs + 'ms';
	} catch (_) { }
}

function renderPulseGap() {
	try {
		if (elements.autoPulseGapInput) elements.autoPulseGapInput.value = String(pulseGapMs);
		if (elements.autoPulseGapVal) elements.autoPulseGapVal.textContent = pulseGapMs + 'ms';
	} catch (_) { }
}

function renderTol() {
	try {
		if (elements.autoTolInput) elements.autoTolInput.value = String(autoTolerancePct);
		if (elements.autoTolVal) elements.autoTolVal.textContent = autoTolerancePct.toFixed(1) + '%';
	} catch (_) { }
}

function renderAutoSuspend() {
	try {
		if (elements.autoSuspendInput) elements.autoSuspendInput.value = String(autoSuspendThresholdPct);
		if (elements.autoSuspendVal) elements.autoSuspendVal.textContent = autoSuspendThresholdPct.toFixed(0) + '%';
	} catch (_) { }
}

function applyBurstInputsFromModel() {
	burstLevels = sanitizeBurst(burstLevels);
	for (const meta of BURST_UI) {
		const l = burstLevels[meta.modelIndex];
		const thEl = elements.burstInputs['th' + meta.ui];
		const puEl = elements.burstInputs['pulses' + meta.ui];
		const thV = elements.burstVals['th' + meta.ui];
		const puV = elements.burstVals['pulses' + meta.ui];
		if (thEl) thEl.value = l ? String(Math.round(Number(l.thresholdPct))) : String(meta.thMin);
		if (puEl) puEl.value = l ? String(Math.round(Number(l.pulses))) : '1';
		if (thV) thV.textContent = (l ? String(Math.round(Number(l.thresholdPct))) : String(meta.thMin)) + '%';
		if (puV) puV.textContent = (l ? String(Math.round(Number(l.pulses))) : '1');
	}
}

function readBurstInputs() {
	const tmp = [null, null, null];
	for (const meta of BURST_UI) {
		const thRaw = elements.burstInputs['th' + meta.ui]?.value;
		const puRaw = elements.burstInputs['pulses' + meta.ui]?.value;
		const th = clampBurstThreshold(meta.ui, thRaw);
		const pu = clampBurstPulses(puRaw);
		if (th != null && pu != null) tmp[meta.modelIndex] = { thresholdPct: th, pulses: pu };
	}
	if (tmp.every(Boolean)) burstLevels = tmp;
	burstLevels = sanitizeBurst(burstLevels);
}

function renderBurstOne(uiLevel) {
	try {
		const thEl = elements.burstInputs['th' + uiLevel];
		const puEl = elements.burstInputs['pulses' + uiLevel];
		const thV = elements.burstVals['th' + uiLevel];
		const puV = elements.burstVals['pulses' + uiLevel];
		if (thEl && thV) thV.textContent = String(Math.round(Number(thEl.value))) + '%';
		if (puEl && puV) puV.textContent = String(Math.round(Number(puEl.value)));
	} catch (_) { }
}

// ===== Event bindings =====
function bindEvents() {
	const el = elements;

	// Interval
	if (el.autoIntervalInput) {
		el.autoIntervalInput.addEventListener('input', () => {
			const raw = parseInt(el.autoIntervalInput.value, 10);
			if (!isNaN(raw)) autoIntervalMs = clampInterval(raw);
			renderInterval();
		});
		el.autoIntervalInput.addEventListener('change', () => {
			const raw = parseInt(el.autoIntervalInput.value, 10);
			if (!isNaN(raw)) autoIntervalMs = clampInterval(raw);
			renderInterval();
			try { ipcRenderer.send('auto-interval-set', { intervalMs: autoIntervalMs }); } catch (_) { }
		});
	}

	// Adaptive
	if (el.autoAdaptiveInput) {
		el.autoAdaptiveInput.addEventListener('change', () => {
			autoAdaptiveEnabled = !!el.autoAdaptiveInput.checked;
			try { ipcRenderer.send('auto-adaptive-set', { enabled: autoAdaptiveEnabled }); } catch (_) { }
		});
	}

	// Shock
	if (el.autoShockInput) {
		el.autoShockInput.addEventListener('input', () => {
			const raw = parseInt(el.autoShockInput.value, 10);
			if (!isNaN(raw)) shockThresholdPct = clampShock(raw);
			renderShock();
		});
		el.autoShockInput.addEventListener('change', () => {
			const raw = parseInt(el.autoShockInput.value, 10);
			if (!isNaN(raw)) shockThresholdPct = clampShock(raw);
			renderShock();
			try { ipcRenderer.send('auto-shock-threshold-set', { pct: shockThresholdPct }); } catch (_) { }
		});
	}

	// Stop on no MID
	if (el.autoStopNoMidInput) {
		el.autoStopNoMidInput.addEventListener('change', () => {
			stopOnNoMidEnabled = !!el.autoStopNoMidInput.checked;
			try { ipcRenderer.send('auto-stop-no-mid-set', { enabled: stopOnNoMidEnabled }); } catch (_) { }
		});
	}

	// Fire cooldown
	if (el.autoFireCooldownInput) {
		el.autoFireCooldownInput.addEventListener('input', () => {
			const raw = parseInt(el.autoFireCooldownInput.value, 10);
			if (!isNaN(raw)) fireCooldownMs = clampCooldown(raw);
			renderFireCooldown();
		});
		el.autoFireCooldownInput.addEventListener('change', () => {
			const raw = parseInt(el.autoFireCooldownInput.value, 10);
			if (!isNaN(raw)) fireCooldownMs = clampCooldown(raw);
			renderFireCooldown();
			try { ipcRenderer.send('auto-fire-cooldown-set', { ms: fireCooldownMs }); } catch (_) { }
		});
	}

	// Max Excel wait
	if (el.autoMaxExcelWaitInput) {
		el.autoMaxExcelWaitInput.addEventListener('input', () => {
			const raw = parseInt(el.autoMaxExcelWaitInput.value, 10);
			if (!isNaN(raw)) maxExcelWaitMs = clampMaxWait(raw);
			renderMaxExcelWait();
		});
		el.autoMaxExcelWaitInput.addEventListener('change', () => {
			const raw = parseInt(el.autoMaxExcelWaitInput.value, 10);
			if (!isNaN(raw)) maxExcelWaitMs = clampMaxWait(raw);
			renderMaxExcelWait();
			try { ipcRenderer.send('auto-max-excel-wait-set', { ms: maxExcelWaitMs }); } catch (_) { }
		});
	}

	// Pulse gap
	if (el.autoPulseGapInput) {
		el.autoPulseGapInput.addEventListener('input', () => {
			const raw = parseInt(el.autoPulseGapInput.value, 10);
			if (!isNaN(raw)) pulseGapMs = clampPulseGap(raw);
			renderPulseGap();
		});
		el.autoPulseGapInput.addEventListener('change', () => {
			const raw = parseInt(el.autoPulseGapInput.value, 10);
			if (!isNaN(raw)) pulseGapMs = clampPulseGap(raw);
			renderPulseGap();
			try { ipcRenderer.send('auto-pulse-gap-set', { ms: pulseGapMs }); } catch (_) { }
		});
	}

	// Burst L3 enabled
	if (el.burst3EnabledInput) {
		el.burst3EnabledInput.addEventListener('change', () => {
			burst3Enabled = !!el.burst3EnabledInput.checked;
			try { ipcRenderer.send('auto-burst3-enabled-set', { enabled: burst3Enabled }); } catch (_) { }
		});
	}

	// Tolerance
	if (el.autoTolInput) {
		el.autoTolInput.addEventListener('input', () => {
			const raw = parseFloat(el.autoTolInput.value);
			if (!isNaN(raw)) autoTolerancePct = clampTol(raw);
			renderTol();
		});
		el.autoTolInput.addEventListener('change', () => {
			const raw = parseFloat(el.autoTolInput.value);
			if (!isNaN(raw)) autoTolerancePct = clampTol(raw);
			renderTol();
			try { ipcRenderer.send('auto-tolerance-set', { tolerancePct: autoTolerancePct }); } catch (_) { }
		});
	}

	// Suspend threshold
	if (el.autoSuspendInput) {
		el.autoSuspendInput.addEventListener('input', () => {
			const raw = parseFloat(el.autoSuspendInput.value);
			if (!isNaN(raw)) autoSuspendThresholdPct = clampAutoSuspend(raw);
			renderAutoSuspend();
		});
		el.autoSuspendInput.addEventListener('change', () => {
			const raw = parseFloat(el.autoSuspendInput.value);
			if (!isNaN(raw)) autoSuspendThresholdPct = clampAutoSuspend(raw);
			renderAutoSuspend();
			try { ipcRenderer.send('auto-suspend-threshold-set', { pct: autoSuspendThresholdPct }); } catch (_) { }
		});
	}

	// Burst levels
	for (let uiLevel = 1; uiLevel <= 3; uiLevel++) {
		const thEl = el.burstInputs['th' + uiLevel];
		const puEl = el.burstInputs['pulses' + uiLevel];
		if (thEl) {
			thEl.addEventListener('input', () => renderBurstOne(uiLevel));
			thEl.addEventListener('change', () => {
				renderBurstOne(uiLevel);
				readBurstInputs();
				applyBurstInputsFromModel();
				try { ipcRenderer.send('auto-burst-levels-set', { levels: burstLevels }); } catch (_) { }
			});
		}
		if (puEl) {
			puEl.addEventListener('input', () => renderBurstOne(uiLevel));
			puEl.addEventListener('change', () => {
				renderBurstOne(uiLevel);
				readBurstInputs();
				applyBurstInputsFromModel();
				try { ipcRenderer.send('auto-burst-levels-set', { levels: burstLevels }); } catch (_) { }
			});
		}
	}
}

// ===== Load from store =====
async function loadFromStore() {
	const el = elements;

	// Tolerance
	try {
		const v = await ipcRenderer.invoke('auto-tolerance-get');
		if (typeof v === 'number' && !isNaN(v)) autoTolerancePct = clampTol(v);
		renderTol();
	} catch (_) { renderTol(); }

	// Suspend threshold
	try {
		const v = await ipcRenderer.invoke('auto-suspend-threshold-get');
		if (typeof v === 'number' && !isNaN(v)) autoSuspendThresholdPct = clampAutoSuspend(v);
		renderAutoSuspend();
	} catch (_) { renderAutoSuspend(); }

	// Interval
	try {
		const v = await ipcRenderer.invoke('auto-interval-get');
		if (typeof v === 'number' && !isNaN(v)) autoIntervalMs = clampInterval(v);
		renderInterval();
		if (el.autoIntervalInput) el.autoIntervalInput.value = String(autoIntervalMs);
	} catch (_) { renderInterval(); }

	// Adaptive
	try {
		const v = await ipcRenderer.invoke('auto-adaptive-get');
		if (typeof v === 'boolean') autoAdaptiveEnabled = v;
		if (el.autoAdaptiveInput) el.autoAdaptiveInput.checked = autoAdaptiveEnabled;
	} catch (_) { }

	// Shock
	try {
		const v = await ipcRenderer.invoke('auto-shock-threshold-get');
		if (typeof v === 'number' && !isNaN(v)) shockThresholdPct = clampShock(v);
		renderShock();
	} catch (_) { renderShock(); }

	// Fire cooldown
	try {
		const v = await ipcRenderer.invoke('auto-fire-cooldown-get');
		if (typeof v === 'number' && !isNaN(v)) fireCooldownMs = clampCooldown(v);
		renderFireCooldown();
	} catch (_) { renderFireCooldown(); }

	// Max Excel wait
	try {
		const v = await ipcRenderer.invoke('auto-max-excel-wait-get');
		if (typeof v === 'number' && !isNaN(v)) maxExcelWaitMs = clampMaxWait(v);
		renderMaxExcelWait();
	} catch (_) { renderMaxExcelWait(); }

	// Pulse gap
	try {
		const v = await ipcRenderer.invoke('auto-pulse-gap-get');
		if (typeof v === 'number' && !isNaN(v)) pulseGapMs = clampPulseGap(v);
		renderPulseGap();
	} catch (_) { renderPulseGap(); }

	// Burst L3 enabled
	try {
		const v = await ipcRenderer.invoke('auto-burst3-enabled-get');
		if (typeof v === 'boolean') burst3Enabled = v;
		if (el.burst3EnabledInput) el.burst3EnabledInput.checked = burst3Enabled;
	} catch (_) { }

	// Stop on no MID
	try {
		const v = await ipcRenderer.invoke('auto-stop-no-mid-get');
		if (typeof v === 'boolean') stopOnNoMidEnabled = v;
		if (el.autoStopNoMidInput) el.autoStopNoMidInput.checked = stopOnNoMidEnabled;
	} catch (_) { }

	// Burst levels
	try {
		const v = await ipcRenderer.invoke('auto-burst-levels-get');
		if (Array.isArray(v)) burstLevels = v;
		applyBurstInputsFromModel();
	} catch (_) { applyBurstInputsFromModel(); }

	// DS Auto Mode
	try {
		const v = await ipcRenderer.invoke('ds-auto-mode-get');
		if (typeof v === 'boolean') dsAutoModeEnabled = v;
		renderDsAutoMode();
	} catch (_) { renderDsAutoMode(); }

	// Start DS connection status polling
	startDsStatusPolling();
}

// ===== DS Auto Mode =====
function renderDsAutoMode() {
	try {
		if (elements.dsAutoModeInput) elements.dsAutoModeInput.checked = dsAutoModeEnabled;
		renderDsConnectionStatus();
	} catch (_) { }
}

function renderDsConnectionStatus() {
	try {
		const el = elements.dsConnectionStatusEl;
		if (!el) return;
		if (dsConnectionStatus) {
			el.textContent = '🟢 DS Connected';
			el.classList.remove('disconnected');
			el.classList.add('connected');
		} else {
			el.textContent = '⚫ DS Disconnected';
			el.classList.remove('connected');
			el.classList.add('disconnected');
		}
	} catch (_) { }
}

async function updateDsConnectionStatus() {
	try {
		const status = await ipcRenderer.invoke('ds-connection-status');
		dsConnectionStatus = !!(status && status.connected);
		renderDsConnectionStatus();
	} catch (_) {
		dsConnectionStatus = false;
		renderDsConnectionStatus();
	}
}

function startDsStatusPolling() {
	// Poll DS connection status every 2 seconds
	if (dsStatusPollInterval) clearInterval(dsStatusPollInterval);
	updateDsConnectionStatus();
	dsStatusPollInterval = setInterval(updateDsConnectionStatus, 2000);
}

function bindDsAutoModeEvents() {
	const el = elements.dsAutoModeInput;
	if (!el) return;
	el.addEventListener('change', async () => {
		dsAutoModeEnabled = el.checked;
		try {
			await ipcRenderer.invoke('ds-auto-mode-set', dsAutoModeEnabled);
		} catch (_) { }
	});
}

// ===== Save all =====
function saveAll() {
	try { ipcRenderer.send('auto-tolerance-set', { tolerancePct: autoTolerancePct }); } catch (_) { }
	try { ipcRenderer.send('auto-interval-set', { intervalMs: autoIntervalMs }); } catch (_) { }
	try { ipcRenderer.send('auto-adaptive-set', { enabled: autoAdaptiveEnabled }); } catch (_) { }
	try { ipcRenderer.send('auto-suspend-threshold-set', { pct: autoSuspendThresholdPct }); } catch (_) { }
	try { ipcRenderer.send('auto-shock-threshold-set', { pct: shockThresholdPct }); } catch (_) { }
	try { ipcRenderer.send('auto-stop-no-mid-set', { enabled: stopOnNoMidEnabled }); } catch (_) { }
	try { ipcRenderer.send('auto-fire-cooldown-set', { ms: fireCooldownMs }); } catch (_) { }
	try { ipcRenderer.send('auto-max-excel-wait-set', { ms: maxExcelWaitMs }); } catch (_) { }
	try { ipcRenderer.send('auto-pulse-gap-set', { ms: pulseGapMs }); } catch (_) { }
	try { ipcRenderer.send('auto-burst3-enabled-set', { enabled: burst3Enabled }); } catch (_) { }
	try { readBurstInputs(); ipcRenderer.send('auto-burst-levels-set', { levels: burstLevels }); } catch (_) { }
}

// ===== Init =====
function init() {
	cacheElements();
	bindEvents();
	bindDsAutoModeEvents();
}

module.exports = { init, loadFromStore, saveAll };

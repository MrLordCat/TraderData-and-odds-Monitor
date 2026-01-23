// Auto trading settings module (refactored)
const { ipcRenderer } = require('electron');

// ===== State =====
let autoTolerancePct = 1.5;
let autoIntervalMs = 500;
let pulseStepPct = 10;
let autoSuspendThresholdPct = 40;
let shockThresholdPct = 80;
let stopOnNoMidEnabled = true;
let autoResumeOnMidEnabled = true;
let fireCooldownMs = 900;
let pulseGapMs = 500;

// ===== Clamp helpers =====
function clampTol(v) { return Math.max(0.5, Math.min(10, Math.round(v * 10) / 10)); }
function clampInterval(v) { return Math.max(120, Math.min(2000, Math.floor(v))); }
function clampPulseStep(v) { return Math.max(8, Math.min(15, Math.round(v))); }
function clampAutoSuspend(v) { return Math.max(15, Math.min(80, Math.round(v))); }
function clampShock(v) { return Math.max(40, Math.min(120, Math.round(v))); }
function clampCooldown(v) { return Math.max(100, Math.min(3000, Math.floor(v))); }
function clampPulseGap(v) { return Math.max(100, Math.min(1000, Math.floor(v))); }

// ===== DOM elements cache =====
let elements = {};

function cacheElements() {
	elements = {
		// Tolerance
		autoTolInput: document.getElementById('auto-tolerance'),
		autoTolVal: document.getElementById('auto-tolerance-val'),
		// Interval
		autoIntervalInput: document.getElementById('auto-interval'),
		autoIntervalVal: document.getElementById('auto-interval-val'),
		// Pulse step
		autoPulseStepInput: document.getElementById('auto-pulse-step'),
		autoPulseStepVal: document.getElementById('auto-pulse-step-val'),
		// Suspend threshold
		autoSuspendInput: document.getElementById('auto-suspend-threshold'),
		autoSuspendVal: document.getElementById('auto-suspend-threshold-val'),
		// Shock threshold
		autoShockInput: document.getElementById('auto-shock-threshold'),
		autoShockVal: document.getElementById('auto-shock-threshold-val'),
		// Stop on no MID
		autoStopNoMidInput: document.getElementById('auto-stop-no-mid'),
		// Resume on MID
		autoResumeOnMidInput: document.getElementById('auto-resume-on-mid'),
		// Fire cooldown
		autoFireCooldownInput: document.getElementById('auto-fire-cooldown'),
		autoFireCooldownVal: document.getElementById('auto-fire-cooldown-val'),
		// Pulse gap
		autoPulseGapInput: document.getElementById('auto-pulse-gap'),
		autoPulseGapVal: document.getElementById('auto-pulse-gap-val'),
	};
}

// ===== Render functions =====
function renderTol() {
	try {
		if (elements.autoTolInput) elements.autoTolInput.value = String(autoTolerancePct);
		if (elements.autoTolVal) elements.autoTolVal.textContent = autoTolerancePct.toFixed(1) + '%';
	} catch (_) { }
}

function renderInterval() {
	try {
		if (elements.autoIntervalInput) elements.autoIntervalInput.value = String(autoIntervalMs);
		if (elements.autoIntervalVal) elements.autoIntervalVal.textContent = autoIntervalMs + 'ms';
	} catch (_) { }
}

function renderPulseStep() {
	try {
		if (elements.autoPulseStepInput) elements.autoPulseStepInput.value = String(pulseStepPct);
		if (elements.autoPulseStepVal) elements.autoPulseStepVal.textContent = pulseStepPct + '%';
	} catch (_) { }
}

function renderAutoSuspend() {
	try {
		if (elements.autoSuspendInput) elements.autoSuspendInput.value = String(autoSuspendThresholdPct);
		if (elements.autoSuspendVal) elements.autoSuspendVal.textContent = autoSuspendThresholdPct + '%';
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

function renderPulseGap() {
	try {
		if (elements.autoPulseGapInput) elements.autoPulseGapInput.value = String(pulseGapMs);
		if (elements.autoPulseGapVal) elements.autoPulseGapVal.textContent = pulseGapMs + 'ms';
	} catch (_) { }
}

// ===== Event bindings =====
function bindEvents() {
	const el = elements;

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

	// Pulse step
	if (el.autoPulseStepInput) {
		el.autoPulseStepInput.addEventListener('input', () => {
			const raw = parseInt(el.autoPulseStepInput.value, 10);
			if (!isNaN(raw)) pulseStepPct = clampPulseStep(raw);
			renderPulseStep();
		});
		el.autoPulseStepInput.addEventListener('change', () => {
			const raw = parseInt(el.autoPulseStepInput.value, 10);
			if (!isNaN(raw)) pulseStepPct = clampPulseStep(raw);
			renderPulseStep();
			try { ipcRenderer.send('auto-pulse-step-set', { pct: pulseStepPct }); } catch (_) { }
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

	// Shock threshold
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

	// Resume on MID
	if (el.autoResumeOnMidInput) {
		el.autoResumeOnMidInput.addEventListener('change', () => {
			autoResumeOnMidEnabled = !!el.autoResumeOnMidInput.checked;
			try { ipcRenderer.send('auto-resume-on-mid-set', { enabled: autoResumeOnMidEnabled }); } catch (_) { }
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

	// Interval
	try {
		const v = await ipcRenderer.invoke('auto-interval-get');
		if (typeof v === 'number' && !isNaN(v)) autoIntervalMs = clampInterval(v);
		renderInterval();
	} catch (_) { renderInterval(); }

	// Pulse step
	try {
		const v = await ipcRenderer.invoke('auto-pulse-step-get');
		if (typeof v === 'number' && !isNaN(v)) pulseStepPct = clampPulseStep(v);
		renderPulseStep();
	} catch (_) { renderPulseStep(); }

	// Suspend threshold
	try {
		const v = await ipcRenderer.invoke('auto-suspend-threshold-get');
		if (typeof v === 'number' && !isNaN(v)) autoSuspendThresholdPct = clampAutoSuspend(v);
		renderAutoSuspend();
	} catch (_) { renderAutoSuspend(); }

	// Shock threshold
	try {
		const v = await ipcRenderer.invoke('auto-shock-threshold-get');
		if (typeof v === 'number' && !isNaN(v)) shockThresholdPct = clampShock(v);
		renderShock();
	} catch (_) { renderShock(); }

	// Stop on no MID
	try {
		const v = await ipcRenderer.invoke('auto-stop-no-mid-get');
		if (typeof v === 'boolean') stopOnNoMidEnabled = v;
		if (el.autoStopNoMidInput) el.autoStopNoMidInput.checked = stopOnNoMidEnabled;
	} catch (_) { }

	// Resume on MID
	try {
		const v = await ipcRenderer.invoke('auto-resume-on-mid-get');
		if (typeof v === 'boolean') autoResumeOnMidEnabled = v;
		if (el.autoResumeOnMidInput) el.autoResumeOnMidInput.checked = autoResumeOnMidEnabled;
	} catch (_) { }

	// Fire cooldown
	try {
		const v = await ipcRenderer.invoke('auto-fire-cooldown-get');
		if (typeof v === 'number' && !isNaN(v)) fireCooldownMs = clampCooldown(v);
		renderFireCooldown();
	} catch (_) { renderFireCooldown(); }

	// Pulse gap
	try {
		const v = await ipcRenderer.invoke('auto-pulse-gap-get');
		if (typeof v === 'number' && !isNaN(v)) pulseGapMs = clampPulseGap(v);
		renderPulseGap();
	} catch (_) { renderPulseGap(); }
}

// ===== Save all =====
function saveAll() {
	try { ipcRenderer.send('auto-tolerance-set', { tolerancePct: autoTolerancePct }); } catch (_) { }
	try { ipcRenderer.send('auto-interval-set', { intervalMs: autoIntervalMs }); } catch (_) { }
	try { ipcRenderer.send('auto-pulse-step-set', { pct: pulseStepPct }); } catch (_) { }
	try { ipcRenderer.send('auto-suspend-threshold-set', { pct: autoSuspendThresholdPct }); } catch (_) { }
	try { ipcRenderer.send('auto-shock-threshold-set', { pct: shockThresholdPct }); } catch (_) { }
	try { ipcRenderer.send('auto-stop-no-mid-set', { enabled: stopOnNoMidEnabled }); } catch (_) { }
	try { ipcRenderer.send('auto-resume-on-mid-set', { enabled: autoResumeOnMidEnabled }); } catch (_) { }
	try { ipcRenderer.send('auto-fire-cooldown-set', { ms: fireCooldownMs }); } catch (_) { }
	try { ipcRenderer.send('auto-pulse-gap-set', { ms: pulseGapMs }); } catch (_) { }
}

// ===== Init =====
function init() {
	cacheElements();
	bindEvents();
}

module.exports = { init, loadFromStore, saveAll };

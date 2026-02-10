// Heat bar and stats config settings
const { ipcRenderer } = require('electron');

// ===== State =====
// NOTE: decayPerSec is stored internally, but UI shows "fade time" in seconds (fadeSec = 1/decayPerSec)
let currentHeatBar = { enabled: true, decayPerSec: 0.18, bumpAmount: 0.22, color1: '#3c78ff', color2: '#ff4646' };
let currentStatsConfig = { winLoseEnabled: true, heatBarOpacity: 0.55 };

// ===== DOM elements cache =====
let hb = {};
let st = {};
let anim = {};

function cacheElements() {
	hb = {
		enabled: document.getElementById('hb-enabled'),
		decay: document.getElementById('hb-decay'),
		decayVal: document.getElementById('hb-decay-val'),
		bump: document.getElementById('hb-bump'),
		bumpVal: document.getElementById('hb-bump-val'),
		color1: document.getElementById('hb-color1'),
		color2: document.getElementById('hb-color2'),
		opacity: document.getElementById('hb-opacity')
	};
	st = {
		winlose: document.getElementById('st-winlose')
	};
	anim = {
		enabled: document.getElementById('anim-enabled'),
		duration: document.getElementById('anim-duration'),
		scale: document.getElementById('anim-scale'),
		color1: document.getElementById('anim-color1'),
		color2: document.getElementById('anim-color2')
	};
}

// ===== IPC =====
function emitHeatBar() {
	ipcRenderer.send('gs-heatbar-preview', currentHeatBar);
}

function queueStatsConfigSend() {
	if (!currentStatsConfig) return;
	// Merge animation inputs before send
	if (anim.enabled) currentStatsConfig.animationsEnabled = !!anim.enabled.checked;
	if (anim.duration) {
		let d = parseInt(anim.duration.value, 10);
		if (!isNaN(d)) currentStatsConfig.animationDurationMs = Math.min(5000, Math.max(50, d));
	}
	if (anim.scale) {
		let s = parseFloat(anim.scale.value);
		if (!isNaN(s)) currentStatsConfig.animationScale = Math.min(2, Math.max(0.25, s));
	}
	if (anim.color1 && anim.color1.value) currentStatsConfig.animationPrimaryColor = anim.color1.value;
	if (anim.color2 && anim.color2.value) currentStatsConfig.animationSecondaryColor = anim.color2.value;
	console.log('[settings][send stats-config-set]', currentStatsConfig);
	try { ipcRenderer.send('stats-config-set', currentStatsConfig); } catch (_) { }
}

function updateStatsConfigFromInputs(immediate) {
	let op = currentStatsConfig.heatBarOpacity;
	if (hb.opacity) {
		const raw = parseFloat(hb.opacity.value);
		if (!isNaN(raw)) op = Math.max(0, Math.min(1, raw));
	}
	currentStatsConfig.heatBarOpacity = op;
	if (st.winlose) currentStatsConfig.winLoseEnabled = !!st.winlose.checked;
	if (immediate) queueStatsConfigSend();
}

function applyHeatBarInputs() {
	// Decay slider: value is fade time in seconds (1-10)
	const fadeSec = hb.decay ? parseFloat(hb.decay.value) : 5;
	// Bump slider: value is percentage (10-50), convert to decimal (0.1-0.5)
	const bumpPct = hb.bump ? parseFloat(hb.bump.value) : 22;
	const bumpAmount = bumpPct / 100;
	
	// Clamp values
	const fadeSecClamped = Math.max(1, Math.min(10, isNaN(fadeSec) ? 5 : fadeSec));
	const bumpAmountClamped = Math.max(0.1, Math.min(0.5, isNaN(bumpAmount) ? 0.22 : bumpAmount));
	const decayPerSec = 1 / fadeSecClamped;
	
	// Update display values
	if (hb.decayVal) hb.decayVal.textContent = fadeSecClamped.toFixed(1) + 's';
	if (hb.bumpVal) hb.bumpVal.textContent = Math.round(bumpAmountClamped * 100) + '%';
	
	currentHeatBar = {
		enabled: hb.enabled ? !!hb.enabled.checked : currentHeatBar.enabled,
		decayPerSec: decayPerSec,
		bumpAmount: bumpAmountClamped,
		color1: (hb.color1 && hb.color1.value) || currentHeatBar.color1,
		color2: (hb.color2 && hb.color2.value) || currentHeatBar.color2
	};
	emitHeatBar();
	updateStatsConfigFromInputs(true);
}

// ===== Event bindings =====
function bindEvents() {
	// Win/lose toggle
	if (st.winlose) {
		st.winlose.addEventListener('input', () => updateStatsConfigFromInputs(true));
		st.winlose.addEventListener('change', () => updateStatsConfigFromInputs(true));
	}

	// Opacity
	if (hb.opacity) {
		hb.opacity.addEventListener('input', () => updateStatsConfigFromInputs(true));
		hb.opacity.addEventListener('change', () => updateStatsConfigFromInputs(true));
	}

	// Animation controls
	Object.values(anim).forEach(el => {
		if (el) {
			el.addEventListener('input', () => queueStatsConfigSend());
			el.addEventListener('change', () => queueStatsConfigSend());
		}
	});

	// Heat bar controls
	Object.values(hb).forEach(el => {
		if (el) {
			el.addEventListener('input', applyHeatBarInputs);
			el.addEventListener('change', applyHeatBarInputs);
		}
	});
}

// ===== Actions =====
function reset() {
	if (hb.enabled) hb.enabled.checked = true;
	if (hb.decay) hb.decay.value = '5';  // 5 sec fade time
	if (hb.decayVal) hb.decayVal.textContent = '5.0s';
	if (hb.bump) hb.bump.value = '22';   // 22% bump
	if (hb.bumpVal) hb.bumpVal.textContent = '22%';
	if (hb.color1) hb.color1.value = '#3c78ff';
	if (hb.color2) hb.color2.value = '#ff4646';
	if (hb.opacity) hb.opacity.value = '0.55';
	if (st.winlose) st.winlose.checked = true;
	applyHeatBarInputs();
}

function save() {
	applyHeatBarInputs();
	currentHeatBar.decayPerSec = +Number(currentHeatBar.decayPerSec).toFixed(3);
	currentHeatBar.bumpAmount = +Number(currentHeatBar.bumpAmount).toFixed(3);
	// Update slider display values
	const fadeSec = currentHeatBar.decayPerSec > 0 ? (1 / currentHeatBar.decayPerSec) : 5;
	if (hb.decay) hb.decay.value = String(fadeSec.toFixed(1));
	if (hb.decayVal) hb.decayVal.textContent = fadeSec.toFixed(1) + 's';
	if (hb.bump) hb.bump.value = String(Math.round(currentHeatBar.bumpAmount * 100));
	if (hb.bumpVal) hb.bumpVal.textContent = Math.round(currentHeatBar.bumpAmount * 100) + '%';
	ipcRenderer.send('gs-heatbar-save', currentHeatBar);
	updateStatsConfigFromInputs(false);
	queueStatsConfigSend();
}

// ===== Load from config =====
function applyConfig(cfg) {
	if (cfg && cfg.gsHeatBar) {
		currentHeatBar = { ...currentHeatBar, ...cfg.gsHeatBar };
	}
	if (hb.enabled) hb.enabled.checked = !!currentHeatBar.enabled;
	// Slider: fade time (sec) = 1/decayPerSec, clamp to 1-10
	const fadeSec = currentHeatBar.decayPerSec > 0 ? Math.min(10, Math.max(1, 1 / currentHeatBar.decayPerSec)) : 5;
	if (hb.decay) hb.decay.value = String(fadeSec.toFixed(1));
	if (hb.decayVal) hb.decayVal.textContent = fadeSec.toFixed(1) + 's';
	// Slider: bump as percentage (10-50)
	const bumpPct = Math.min(50, Math.max(10, Math.round(currentHeatBar.bumpAmount * 100)));
	if (hb.bump) hb.bump.value = String(bumpPct);
	if (hb.bumpVal) hb.bumpVal.textContent = bumpPct + '%';
	if (hb.color1) hb.color1.value = currentHeatBar.color1;
	if (hb.color2) hb.color2.value = currentHeatBar.color2;

	if (cfg && cfg.statsConfig) {
		currentStatsConfig = { ...currentStatsConfig, ...cfg.statsConfig };
	}
	if (st.winlose) st.winlose.checked = currentStatsConfig.winLoseEnabled !== false;
	if (hb.opacity) hb.opacity.value = String(currentStatsConfig.heatBarOpacity);

	// Animation fields
	if (anim.enabled) anim.enabled.checked = !!currentStatsConfig.animationsEnabled;
	if (anim.duration) anim.duration.value = currentStatsConfig.animationDurationMs;
	if (anim.scale) anim.scale.value = currentStatsConfig.animationScale;
	if (anim.color1) anim.color1.value = currentStatsConfig.animationPrimaryColor;
	if (anim.color2) anim.color2.value = currentStatsConfig.animationSecondaryColor;

	emitHeatBar();
	updateStatsConfigFromInputs(true);
}

// ===== Init =====
function init() {
	cacheElements();
	bindEvents();
}

export { init, applyConfig, reset, save };

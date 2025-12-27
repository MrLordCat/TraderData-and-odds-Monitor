const { ipcRenderer } = require('electron');

// Load and display current version dynamically
(function loadVersion(){
	try {
		const label = document.getElementById('version-label');
		if(!label) return;
		ipcRenderer.invoke('updater-get-version').then(info => {
			if(info && info.version){
				// Show version, add 'dev' suffix if dev channel
				let vText = 'v' + info.version;
				if(info.buildInfo && info.buildInfo.channel === 'dev'){
					vText += ' dev';
				}
				label.textContent = '(' + vText + ')';
			} else {
				label.textContent = '';
			}
		}).catch(() => { label.textContent = ''; });
	} catch(_){ }
})();

// DevTools button (moved from main toolbar)
try {
	const devBtn = document.getElementById('open-devtools');
	if(devBtn){ devBtn.addEventListener('click', ()=>{ try { ipcRenderer.send('open-devtools'); } catch(_){ } }); }
} catch(_){ }

// ===== CSS-only column layout (stable order, no JS shuffling) =====
// Previously used JS masonry which caused random order on each open.
// Now using pure CSS column-count - segments stay in DOM order.


// (Removed) Game Stats table theme controls (deprecated)
const fields = {}; // retain empty object to avoid ref errors if any leftover code executes
// Heat bar fields (with opacity integrated)
const hb = {
	enabled: document.getElementById('hb-enabled'),
	decay: document.getElementById('hb-decay'),
	bump: document.getElementById('hb-bump'),
	color1: document.getElementById('hb-color1'),
	color2: document.getElementById('hb-color2'),
	opacity: document.getElementById('hb-opacity')
};
// Deprecated theme removed – keep minimal stub for IPC compatibility (no-op values)
const defaultTheme = {};
let currentTheme = {};
let currentHeatBar = { enabled:true, decayPerSec:0.18, bumpAmount:0.22, color1:'#3c78ff', color2:'#ff4646' };
// Stats table config (subset we manage here)
let currentStatsConfig = { winLoseEnabled:true, heatBarOpacity:0.55 };
const st = { winlose: document.getElementById('st-winlose') };
// Animation controls
const anim = {
	enabled: document.getElementById('anim-enabled'),
	duration: document.getElementById('anim-duration'),
	scale: document.getElementById('anim-scale'),
	color1: document.getElementById('anim-color1'),
	color2: document.getElementById('anim-color2')
};

// Optional future inputs for auto interval/adaptive (not present in current UI but support live apply if added)
const autoIntervalInput = document.getElementById('auto-interval');
const autoIntervalVal = document.getElementById('auto-interval-val');
const autoAdaptiveInput = document.getElementById('auto-adaptive');
let autoIntervalMs = 500;
let autoAdaptiveEnabled = true;

function clampInterval(v){ return Math.max(120, Math.min(2000, Math.floor(v))); }
function renderInterval(){
	try {
		if(autoIntervalInput) autoIntervalInput.value = String(autoIntervalMs);
		if(autoIntervalVal) autoIntervalVal.textContent = autoIntervalMs + 'ms';
	} catch(_){ }
}
if(autoIntervalInput){
	autoIntervalInput.addEventListener('input', ()=>{
		const raw = parseInt(autoIntervalInput.value, 10);
		if(!isNaN(raw)) autoIntervalMs = clampInterval(raw);
		renderInterval();
	});
	autoIntervalInput.addEventListener('change', ()=>{
		const raw = parseInt(autoIntervalInput.value, 10);
		if(!isNaN(raw)) autoIntervalMs = clampInterval(raw);
		renderInterval();
		try { ipcRenderer.send('auto-interval-set', { intervalMs: autoIntervalMs }); } catch(_){ }
	});
}
if(autoAdaptiveInput){
	autoAdaptiveInput.addEventListener('change', ()=>{
		autoAdaptiveEnabled = !!autoAdaptiveInput.checked;
		try { ipcRenderer.send('auto-adaptive-set', { enabled: autoAdaptiveEnabled }); } catch(_){ }
	});
}

// Shock threshold (%)
const autoShockInput = document.getElementById('auto-shock-threshold');
const autoShockVal = document.getElementById('auto-shock-threshold-val');
let shockThresholdPct = 80;
function clampShock(v){ return Math.max(40, Math.min(120, Math.round(v))); }
function renderShock(){
	try {
		if(autoShockInput) autoShockInput.value = String(shockThresholdPct);
		if(autoShockVal) autoShockVal.textContent = shockThresholdPct + '%';
	} catch(_){ }
}
if(autoShockInput){
	autoShockInput.addEventListener('input', ()=>{
		const raw = parseInt(autoShockInput.value, 10);
		if(!isNaN(raw)) shockThresholdPct = clampShock(raw);
		renderShock();
	});
	autoShockInput.addEventListener('change', ()=>{
		const raw = parseInt(autoShockInput.value, 10);
		if(!isNaN(raw)) shockThresholdPct = clampShock(raw);
		renderShock();
		try { ipcRenderer.send('auto-shock-threshold-set', { pct: shockThresholdPct }); } catch(_){ }
	});
}

// Stop on no MID
const autoStopNoMidInput = document.getElementById('auto-stop-no-mid');
let stopOnNoMidEnabled = true;
if(autoStopNoMidInput){
	autoStopNoMidInput.addEventListener('change', ()=>{
		stopOnNoMidEnabled = !!autoStopNoMidInput.checked;
		try { ipcRenderer.send('auto-stop-no-mid-set', { enabled: stopOnNoMidEnabled }); } catch(_){ }
	});
}

// Fire cooldown (ms)
const autoFireCooldownInput = document.getElementById('auto-fire-cooldown');
const autoFireCooldownVal = document.getElementById('auto-fire-cooldown-val');
let fireCooldownMs = 900;
function clampCooldown(v){ return Math.max(100, Math.min(3000, Math.floor(v))); }
function renderFireCooldown(){
	try {
		if(autoFireCooldownInput) autoFireCooldownInput.value = String(fireCooldownMs);
		if(autoFireCooldownVal) autoFireCooldownVal.textContent = fireCooldownMs + 'ms';
	} catch(_){ }
}
if(autoFireCooldownInput){
	autoFireCooldownInput.addEventListener('input', ()=>{
		const raw = parseInt(autoFireCooldownInput.value, 10);
		if(!isNaN(raw)) fireCooldownMs = clampCooldown(raw);
		renderFireCooldown();
	});
	autoFireCooldownInput.addEventListener('change', ()=>{
		const raw = parseInt(autoFireCooldownInput.value, 10);
		if(!isNaN(raw)) fireCooldownMs = clampCooldown(raw);
		renderFireCooldown();
		try { ipcRenderer.send('auto-fire-cooldown-set', { ms: fireCooldownMs }); } catch(_){ }
	});
}

// Max Excel wait (ms)
const autoMaxExcelWaitInput = document.getElementById('auto-max-excel-wait');
const autoMaxExcelWaitVal = document.getElementById('auto-max-excel-wait-val');
let maxExcelWaitMs = 1600;
function clampMaxWait(v){ return Math.max(500, Math.min(5000, Math.floor(v))); }
function renderMaxExcelWait(){
	try {
		if(autoMaxExcelWaitInput) autoMaxExcelWaitInput.value = String(maxExcelWaitMs);
		if(autoMaxExcelWaitVal) autoMaxExcelWaitVal.textContent = maxExcelWaitMs + 'ms';
	} catch(_){ }
}
if(autoMaxExcelWaitInput){
	autoMaxExcelWaitInput.addEventListener('input', ()=>{
		const raw = parseInt(autoMaxExcelWaitInput.value, 10);
		if(!isNaN(raw)) maxExcelWaitMs = clampMaxWait(raw);
		renderMaxExcelWait();
	});
	autoMaxExcelWaitInput.addEventListener('change', ()=>{
		const raw = parseInt(autoMaxExcelWaitInput.value, 10);
		if(!isNaN(raw)) maxExcelWaitMs = clampMaxWait(raw);
		renderMaxExcelWait();
		try { ipcRenderer.send('auto-max-excel-wait-set', { ms: maxExcelWaitMs }); } catch(_){ }
	});
}

// Pulse gap (ms)
const autoPulseGapInput = document.getElementById('auto-pulse-gap');
const autoPulseGapVal = document.getElementById('auto-pulse-gap-val');
let pulseGapMs = 55;
function clampPulseGap(v){ return Math.max(20, Math.min(200, Math.floor(v))); }
function renderPulseGap(){
	try {
		if(autoPulseGapInput) autoPulseGapInput.value = String(pulseGapMs);
		if(autoPulseGapVal) autoPulseGapVal.textContent = pulseGapMs + 'ms';
	} catch(_){ }
}
if(autoPulseGapInput){
	autoPulseGapInput.addEventListener('input', ()=>{
		const raw = parseInt(autoPulseGapInput.value, 10);
		if(!isNaN(raw)) pulseGapMs = clampPulseGap(raw);
		renderPulseGap();
	});
	autoPulseGapInput.addEventListener('change', ()=>{
		const raw = parseInt(autoPulseGapInput.value, 10);
		if(!isNaN(raw)) pulseGapMs = clampPulseGap(raw);
		renderPulseGap();
		try { ipcRenderer.send('auto-pulse-gap-set', { ms: pulseGapMs }); } catch(_){ }
	});
}

// Burst L3 enabled
const burst3EnabledInput = document.getElementById('burst3-enabled');
let burst3Enabled = true;
if(burst3EnabledInput){
	burst3EnabledInput.addEventListener('change', ()=>{
		burst3Enabled = !!burst3EnabledInput.checked;
		try { ipcRenderer.send('auto-burst3-enabled-set', { enabled: burst3Enabled }); } catch(_){ }
	});
}

// Auto odds tolerance (percent difference threshold)
const autoTolInput = document.getElementById('auto-tolerance');
const autoTolVal = document.getElementById('auto-tolerance-val');
let autoTolerancePct = 0.5; // percent
function clampTol(v){ return Math.max(0.5, Math.min(10, Math.round(v*10)/10)); }
function renderTol(){
	try {
		if(autoTolInput) autoTolInput.value = String(autoTolerancePct);
		if(autoTolVal) autoTolVal.textContent = autoTolerancePct.toFixed(1) + '%';
	} catch(_){ }
}
if(autoTolInput){
	autoTolInput.addEventListener('input', ()=>{
		const raw = parseFloat(autoTolInput.value);
		if(!isNaN(raw)) autoTolerancePct = clampTol(raw);
		renderTol();
	});
	autoTolInput.addEventListener('change', ()=>{
		const raw = parseFloat(autoTolInput.value);
		if(!isNaN(raw)) autoTolerancePct = clampTol(raw);
		renderTol();
		// Apply immediately (live) so auto engines react without pressing Save
		try { ipcRenderer.send('auto-tolerance-set', { tolerancePct: autoTolerancePct }); } catch(_){ }
	});
}

// Auto Suspend threshold (%) – auto suspends when diff% >= this; resumes when diff < threshold/2
const autoSuspendInput = document.getElementById('auto-suspend-threshold');
const autoSuspendVal = document.getElementById('auto-suspend-threshold-val');
let autoSuspendThresholdPct = 40.0; // default UI suggestion
function clampAutoSuspend(v){ return Math.max(15, Math.min(80, Math.round(v))); }
function renderAutoSuspend(){
	try {
		if(autoSuspendInput) autoSuspendInput.value = String(autoSuspendThresholdPct);
		if(autoSuspendVal) autoSuspendVal.textContent = autoSuspendThresholdPct.toFixed(0) + '%';
	} catch(_){ }
}
if(autoSuspendInput){
	autoSuspendInput.addEventListener('input', ()=>{
		const raw=parseFloat(autoSuspendInput.value);
		if(!isNaN(raw)) autoSuspendThresholdPct=clampAutoSuspend(raw);
		renderAutoSuspend();
	});
	autoSuspendInput.addEventListener('change', ()=>{
		const raw=parseFloat(autoSuspendInput.value);
		if(!isNaN(raw)) autoSuspendThresholdPct=clampAutoSuspend(raw);
		renderAutoSuspend();
		try { ipcRenderer.send('auto-suspend-threshold-set', { pct: autoSuspendThresholdPct }); } catch(_){ }
	});
}

// Burst levels (3 tiers configurable)
const burstInputs = {
	th1: document.getElementById('burst1-th'), pulses1: document.getElementById('burst1-pulses'),
	th2: document.getElementById('burst2-th'), pulses2: document.getElementById('burst2-pulses'),
	th3: document.getElementById('burst3-th'), pulses3: document.getElementById('burst3-pulses'),
};
const burstVals = {
	th1: document.getElementById('burst1-th-val'), pulses1: document.getElementById('burst1-pulses-val'),
	th2: document.getElementById('burst2-th-val'), pulses2: document.getElementById('burst2-pulses-val'),
	th3: document.getElementById('burst3-th-val'), pulses3: document.getElementById('burst3-pulses-val'),
};

// NOTE: Burst levels are applied by threshold descending internally.
// UI now shows L1 as the LOWEST threshold and L3 as the HIGHEST (L1<->L3 rename).
// L1: 7%-15%, L2: 10%-20%, L3: 20%-40%
const BURST_UI = [
	{ ui: 1, modelIndex: 2, thMin: 7, thMax: 15 },
	{ ui: 2, modelIndex: 1, thMin: 10, thMax: 20 },
	{ ui: 3, modelIndex: 0, thMin: 20, thMax: 40 },
];

let burstLevels = [
	{ thresholdPct: 25, pulses: 4 },
	{ thresholdPct: 15, pulses: 3 },
	{ thresholdPct: 10, pulses: 2 },
];

function clampBurstThreshold(uiLevel, v){
	const meta = BURST_UI.find(x=>x.ui===uiLevel);
	const num = Number(v);
	if(!meta || isNaN(num)) return null;
	return Math.max(meta.thMin, Math.min(meta.thMax, Math.round(num)));
}
function clampBurstPulses(v){
	const num = Math.round(Number(v));
	if(isNaN(num)) return null;
	return Math.max(1, Math.min(5, num));
}

function sanitizeBurst(list){
	try {
		if(!Array.isArray(list)) list = burstLevels;
		const cleaned = list.map(l=>({ thresholdPct: Math.max(1, Math.min(50, Number(l.thresholdPct)||0)), pulses: Math.max(1, Math.min(5, Math.round(Number(l.pulses)||0))) }))
			.filter(l=> l.thresholdPct>0 && l.pulses>=1)
			.sort((a,b)=> b.thresholdPct - a.thresholdPct)
			.slice(0,3);
		return cleaned.length? cleaned : [
			{ thresholdPct: 25, pulses: 4 },
			{ thresholdPct: 15, pulses: 3 },
			{ thresholdPct: 10, pulses: 2 },
		];
	} catch(_){
		return [
			{ thresholdPct: 25, pulses: 4 },
			{ thresholdPct: 15, pulses: 3 },
			{ thresholdPct: 10, pulses: 2 },
		];
	}
}
function applyBurstInputsFromModel(){
	burstLevels = sanitizeBurst(burstLevels);
	for(const meta of BURST_UI){
		const l = burstLevels[meta.modelIndex];
		const thEl = burstInputs['th'+meta.ui];
		const puEl = burstInputs['pulses'+meta.ui];
		const thV = burstVals['th'+meta.ui];
		const puV = burstVals['pulses'+meta.ui];
		if(thEl) thEl.value = l ? String(Math.round(Number(l.thresholdPct))) : String(meta.thMin);
		if(puEl) puEl.value = l ? String(Math.round(Number(l.pulses))) : '1';
		if(thV) thV.textContent = (l ? String(Math.round(Number(l.thresholdPct))) : String(meta.thMin)) + '%';
		if(puV) puV.textContent = (l ? String(Math.round(Number(l.pulses))) : '1');
	}
}
function readBurstInputs(){
	const tmp = [null, null, null];
	for(const meta of BURST_UI){
		const thRaw = burstInputs['th'+meta.ui]?.value;
		const puRaw = burstInputs['pulses'+meta.ui]?.value;
		const th = clampBurstThreshold(meta.ui, thRaw);
		const pu = clampBurstPulses(puRaw);
		if(th!=null && pu!=null) tmp[meta.modelIndex] = { thresholdPct: th, pulses: pu };
	}
	if(tmp.every(Boolean)) burstLevels = tmp;
	burstLevels = sanitizeBurst(burstLevels);
}
function renderBurstOne(uiLevel){
	try {
		const thEl = burstInputs['th'+uiLevel];
		const puEl = burstInputs['pulses'+uiLevel];
		const thV = burstVals['th'+uiLevel];
		const puV = burstVals['pulses'+uiLevel];
		if(thEl && thV) thV.textContent = String(Math.round(Number(thEl.value))) + '%';
		if(puEl && puV) puV.textContent = String(Math.round(Number(puEl.value)));
	} catch(_){ }
}

for(let uiLevel=1; uiLevel<=3; uiLevel++){
	const thEl = burstInputs['th'+uiLevel];
	const puEl = burstInputs['pulses'+uiLevel];
	if(thEl){
		thEl.addEventListener('input', ()=> renderBurstOne(uiLevel));
		thEl.addEventListener('change', ()=>{
			renderBurstOne(uiLevel);
			readBurstInputs();
			applyBurstInputsFromModel();
			try { ipcRenderer.send('auto-burst-levels-set', { levels: burstLevels }); } catch(_){ }
		});
	}
	if(puEl){
		puEl.addEventListener('input', ()=> renderBurstOne(uiLevel));
		puEl.addEventListener('change', ()=>{
			renderBurstOne(uiLevel);
			readBurstInputs();
			applyBurstInputsFromModel();
			try { ipcRenderer.send('auto-burst-levels-set', { levels: burstLevels }); } catch(_){ }
		});
	}
}

function queueStatsConfigSend(){
	if(!currentStatsConfig) return;
	// Merge animation inputs before send
	if(anim.enabled) currentStatsConfig.animationsEnabled = !!anim.enabled.checked;
	if(anim.duration){ let d=parseInt(anim.duration.value,10); if(!isNaN(d)) currentStatsConfig.animationDurationMs = Math.min(5000, Math.max(50,d)); }
	if(anim.scale){ let s=parseFloat(anim.scale.value); if(!isNaN(s)) currentStatsConfig.animationScale = Math.min(2, Math.max(0.25,s)); }
	if(anim.color1 && anim.color1.value) currentStatsConfig.animationPrimaryColor = anim.color1.value;
	if(anim.color2 && anim.color2.value) currentStatsConfig.animationSecondaryColor = anim.color2.value;
	try { console.log('[settings][send stats-config-set]', currentStatsConfig); } catch(_){ }
	try { ipcRenderer.send('stats-config-set', currentStatsConfig); } catch(_){ }
}
function updateStatsConfigFromInputs(immediate){
	let op = currentStatsConfig.heatBarOpacity;
	if(hb.opacity){ const raw = parseFloat(hb.opacity.value); if(!isNaN(raw)) op = Math.max(0, Math.min(1, raw)); }
	currentStatsConfig.heatBarOpacity = op;
	if(st.winlose) currentStatsConfig.winLoseEnabled = !!st.winlose.checked;
	if(immediate) queueStatsConfigSend();
}
if(st.winlose){ st.winlose.addEventListener('input', ()=> updateStatsConfigFromInputs(true)); st.winlose.addEventListener('change', ()=> updateStatsConfigFromInputs(true)); }
if(hb.opacity){ hb.opacity.addEventListener('input', ()=> updateStatsConfigFromInputs(true)); hb.opacity.addEventListener('change', ()=> updateStatsConfigFromInputs(true)); }
Object.values(anim).forEach(el=>{ if(el){ el.addEventListener('input', ()=> queueStatsConfigSend()); el.addEventListener('change', ()=> queueStatsConfigSend()); } });

function emitTheme(){ /* no-op: theme system deprecated */ }
function emitHeatBar(){
	ipcRenderer.send('gs-heatbar-preview', currentHeatBar);
}
function applyInputsToTheme(){ /* deprecated */ }

function applyHeatBarInputs(){
	const decayRaw = hb.decay.value.trim();
	const bumpRaw = hb.bump.value.trim();
	const decayNum = Number(decayRaw);
	const bumpNum = Number(bumpRaw);
	currentHeatBar = {
		enabled: !!hb.enabled.checked,
		decayPerSec: Math.max(0.01, Math.min(2, !isNaN(decayNum)? decayNum : currentHeatBar.decayPerSec)),
		bumpAmount: Math.max(0.01, Math.min(1, !isNaN(bumpNum)? bumpNum : currentHeatBar.bumpAmount)),
		color1: hb.color1.value || currentHeatBar.color1,
		color2: hb.color2.value || currentHeatBar.color2
	};
	emitHeatBar();
  updateStatsConfigFromInputs(true); // ensure opacity changes propagate live
}
Object.values(hb).forEach(el=>{ if(el){ el.addEventListener('input', applyHeatBarInputs); el.addEventListener('change', applyHeatBarInputs); } });

document.getElementById('reset').onclick = ()=>{
	// Reset heat bar + opacity + win/lose
	hb.enabled.checked = true; hb.decay.value='0.18'; hb.bump.value='0.22'; hb.color1.value='#3c78ff'; hb.color2.value='#ff4646'; if(hb.opacity) hb.opacity.value='0.55';
	if(st.winlose) st.winlose.checked = true;
	applyHeatBarInputs();
};
document.getElementById('save').onclick = ()=>{
	applyHeatBarInputs();
	currentHeatBar.decayPerSec = +Number(currentHeatBar.decayPerSec).toFixed(3);
	currentHeatBar.bumpAmount = +Number(currentHeatBar.bumpAmount).toFixed(3);
	hb.decay.value = String(currentHeatBar.decayPerSec);
	hb.bump.value = String(currentHeatBar.bumpAmount);
	ipcRenderer.send('gs-heatbar-save', currentHeatBar);
	updateStatsConfigFromInputs(false);
	queueStatsConfigSend();
	// Persist all auto settings
	try { ipcRenderer.send('auto-tolerance-set', { tolerancePct: autoTolerancePct }); } catch(_){ }
	try { ipcRenderer.send('auto-interval-set', { intervalMs: autoIntervalMs }); } catch(_){ }
	try { ipcRenderer.send('auto-adaptive-set', { enabled: autoAdaptiveEnabled }); } catch(_){ }
	try { ipcRenderer.send('auto-suspend-threshold-set', { pct: autoSuspendThresholdPct }); } catch(_){ }
	try { ipcRenderer.send('auto-shock-threshold-set', { pct: shockThresholdPct }); } catch(_){ }
	try { ipcRenderer.send('auto-stop-no-mid-set', { enabled: stopOnNoMidEnabled }); } catch(_){ }
	try { ipcRenderer.send('auto-fire-cooldown-set', { ms: fireCooldownMs }); } catch(_){ }
	try { ipcRenderer.send('auto-max-excel-wait-set', { ms: maxExcelWaitMs }); } catch(_){ }
	try { ipcRenderer.send('auto-pulse-gap-set', { ms: pulseGapMs }); } catch(_){ }
	try { ipcRenderer.send('auto-burst3-enabled-set', { enabled: burst3Enabled }); } catch(_){ }
	// Persist burst levels
	try { readBurstInputs(); ipcRenderer.send('auto-burst-levels-set', { levels: burstLevels }); } catch(_){ }
	ipcRenderer.send('close-settings');
};
document.getElementById('close').onclick = ()=> ipcRenderer.send('close-settings');
window.addEventListener('keydown', e=>{ if(e.key==='Escape') ipcRenderer.send('close-settings'); });
document.getElementById('backdrop').onclick = ()=> ipcRenderer.send('close-settings');

	ipcRenderer.on('settings-init', (_e,cfg)=>{
	if(cfg && cfg.gsHeatBar){ currentHeatBar = { ...currentHeatBar, ...cfg.gsHeatBar }; }
	hb.enabled.checked = !!currentHeatBar.enabled;
	hb.decay.value = String(currentHeatBar.decayPerSec);
	hb.bump.value = String(currentHeatBar.bumpAmount);
	hb.color1.value = currentHeatBar.color1;
	hb.color2.value = currentHeatBar.color2;
	if(cfg && cfg.statsConfig){ currentStatsConfig = { ...currentStatsConfig, ...cfg.statsConfig }; }
	if(st.winlose) st.winlose.checked = currentStatsConfig.winLoseEnabled !== false;
	if(hb.opacity) hb.opacity.value = String(currentStatsConfig.heatBarOpacity);
	// Populate animation fields
	if(anim.enabled) anim.enabled.checked = !!currentStatsConfig.animationsEnabled;
	if(anim.duration) anim.duration.value = currentStatsConfig.animationDurationMs;
	if(anim.scale) anim.scale.value = currentStatsConfig.animationScale;
	if(anim.color1) anim.color1.value = currentStatsConfig.animationPrimaryColor;
	if(anim.color2) anim.color2.value = currentStatsConfig.animationSecondaryColor;
	emitHeatBar();
	updateStatsConfigFromInputs(true); // push current values on open
	// Request stored auto tolerance & burst levels after initial settings applied
	try { ipcRenderer.invoke('auto-tolerance-get').then(v=>{
		if(typeof v === 'number' && !isNaN(v)) autoTolerancePct = clampTol(v);
		renderTol();
	}).catch(()=>{ renderTol(); }); } catch(_){ renderTol(); }
	// Initialize auto suspend threshold from store
	try { ipcRenderer.invoke('auto-suspend-threshold-get').then(v=>{ if(typeof v==='number' && !isNaN(v)) autoSuspendThresholdPct=clampAutoSuspend(v); renderAutoSuspend(); }).catch(()=>{ renderAutoSuspend(); }); } catch(_){ renderAutoSuspend(); }
	// Initialize interval
	try { ipcRenderer.invoke('auto-interval-get').then(v=>{ 
		if(typeof v==='number' && !isNaN(v)) autoIntervalMs=clampInterval(v); 
		renderInterval(); 
		if(autoIntervalInput) autoIntervalInput.value = String(autoIntervalMs);
	}).catch(()=>{ renderInterval(); }); } catch(_){ renderInterval(); }
	// Initialize adaptive mode
	try { ipcRenderer.invoke('auto-adaptive-get').then(v=>{ 
		if(typeof v==='boolean') autoAdaptiveEnabled=v; 
		if(autoAdaptiveInput) autoAdaptiveInput.checked = autoAdaptiveEnabled;
	}).catch(()=>{ if(autoAdaptiveInput) autoAdaptiveInput.checked = autoAdaptiveEnabled; }); } catch(_){ }
	// Initialize shock threshold
	try { ipcRenderer.invoke('auto-shock-threshold-get').then(v=>{ 
		if(typeof v==='number' && !isNaN(v)) shockThresholdPct=clampShock(v); 
		renderShock();
	}).catch(()=>{ renderShock(); }); } catch(_){ renderShock(); }
	// Initialize fire cooldown
	try { ipcRenderer.invoke('auto-fire-cooldown-get').then(v=>{ 
		if(typeof v==='number' && !isNaN(v)) fireCooldownMs=clampCooldown(v); 
		renderFireCooldown();
	}).catch(()=>{ renderFireCooldown(); }); } catch(_){ renderFireCooldown(); }
	// Initialize max excel wait
	try { ipcRenderer.invoke('auto-max-excel-wait-get').then(v=>{ 
		if(typeof v==='number' && !isNaN(v)) maxExcelWaitMs=clampMaxWait(v); 
		renderMaxExcelWait();
	}).catch(()=>{ renderMaxExcelWait(); }); } catch(_){ renderMaxExcelWait(); }
	// Initialize pulse gap
	try { ipcRenderer.invoke('auto-pulse-gap-get').then(v=>{ 
		if(typeof v==='number' && !isNaN(v)) pulseGapMs=clampPulseGap(v); 
		renderPulseGap();
	}).catch(()=>{ renderPulseGap(); }); } catch(_){ renderPulseGap(); }
	// Initialize burst3 enabled
	try { ipcRenderer.invoke('auto-burst3-enabled-get').then(v=>{ 
		if(typeof v==='boolean') burst3Enabled=v; 
		if(burst3EnabledInput) burst3EnabledInput.checked = burst3Enabled;
	}).catch(()=>{ if(burst3EnabledInput) burst3EnabledInput.checked = burst3Enabled; }); } catch(_){ }
	// Initialize stop on no MID
	try { ipcRenderer.invoke('auto-stop-no-mid-get').then(v=>{ 
		if(typeof v==='boolean') stopOnNoMidEnabled=v; 
		if(autoStopNoMidInput) autoStopNoMidInput.checked = stopOnNoMidEnabled;
	}).catch(()=>{ if(autoStopNoMidInput) autoStopNoMidInput.checked = stopOnNoMidEnabled; }); } catch(_){ }
	try { ipcRenderer.invoke('auto-burst-levels-get').then(v=>{ if(Array.isArray(v)) { burstLevels = v; } applyBurstInputsFromModel(); }).catch(()=> applyBurstInputsFromModel()); } catch(_){ applyBurstInputsFromModel(); }
	// Pre-apply game selector from payload if present
	try {
		const sel = document.getElementById('game-select');
		if(sel && cfg && cfg.selectedGame){ sel.value = cfg.selectedGame; }
	} catch(_){ }
});

// ===== Game selector (global) =====
(function(){
	const sel = document.getElementById('game-select');
	if(!sel) return;
	const VALID = new Set(['lol','cs2','dota2']);
	function applyInitial(v){
		const game = VALID.has(v) ? v : 'lol';
		sel.value = game;
	}
	try {
		ipcRenderer.invoke('game-get').then(v=> applyInitial(v)).catch(()=> applyInitial('lol'));
	} catch(_){ applyInitial('lol'); }
	sel.addEventListener('change', ()=>{
		const game = sel.value;
		if(!VALID.has(game)) return;
		// Persist and broadcast globally
		try { ipcRenderer.send('game-set', { game }); } catch(_){ }
	});
})();

// ===== Updates section =====
(function(){
	const channelSel = document.getElementById('upd-channel');
	const autoChk = document.getElementById('upd-auto');
	const versionSpan = document.getElementById('upd-version');
	const statusSpan = document.getElementById('upd-status');
	const checkBtn = document.getElementById('upd-check');
	const downloadBtn = document.getElementById('upd-download');
	const progressDiv = document.getElementById('upd-progress');
	const progressBar = progressDiv ? progressDiv.querySelector('.bar') : null;

	if(!channelSel || !autoChk || !checkBtn || !downloadBtn) return;

	let pendingUpdate = null; // { version, url }
	let updateReady = false;  // true when update is downloaded and ready to install

	function setStatus(text){
		if(statusSpan) statusSpan.textContent = text || '—';
	}

	function showProgress(pct){
		if(!progressDiv || !progressBar) return;
		progressDiv.hidden = false;
		progressBar.style.width = Math.max(0, Math.min(100, pct)).toFixed(1) + '%';
	}
	function hideProgress(){
		if(progressDiv) progressDiv.hidden = true;
		if(progressBar) progressBar.style.width = '0%';
	}

	// Update button state based on updateReady flag
	function updateButtonState(){
		if(updateReady){
			downloadBtn.textContent = 'Restart';
			downloadBtn.disabled = false;
		} else if(pendingUpdate){
			downloadBtn.textContent = 'Download & Install';
			downloadBtn.disabled = false;
		} else {
			downloadBtn.textContent = 'Download & Install';
			downloadBtn.disabled = true;
		}
	}

	// Load initial state
	async function loadUpdaterState(){
		try {
			const status = await ipcRenderer.invoke('updater-get-status');
			if(status){
				channelSel.value = status.channel || 'stable';
				autoChk.checked = status.autoCheck !== false;
				if(versionSpan) versionSpan.textContent = status.currentVersion || '—';
				// Check if there's already an available update
				if(status.availableUpdate){
					pendingUpdate = { version: status.availableUpdate.version, url: status.availableUpdate.downloadUrl };
					setStatus(`Update available: ${status.availableUpdate.version}`);
				} else if(status.checking){
					setStatus('Checking...');
				} else if(status.downloading){
					setStatus(`Downloading... ${status.downloadProgress || 0}%`);
				} else if(status.lastCheck){
					// Check was done, no update found
					setStatus('Already up to date');
				} else {
					setStatus('—');
				}
				updateButtonState();
			}
		} catch(e){ console.warn('[settings][updater] loadState failed', e.message); }
	}
	loadUpdaterState();

	// Channel change
	channelSel.addEventListener('change', async ()=>{
		try {
			await ipcRenderer.invoke('updater-set-channel', channelSel.value);
			pendingUpdate = null;
			updateReady = false;
			updateButtonState();
			setStatus('Channel changed');
		} catch(e){ console.warn('[settings][updater] setChannel failed', e.message); }
	});

	// Auto check toggle
	autoChk.addEventListener('change', async ()=>{
		try {
			await ipcRenderer.invoke('updater-set-auto-check', autoChk.checked);
		} catch(e){ console.warn('[settings][updater] setAutoCheck failed', e.message); }
	});

	// Check for updates button
	checkBtn.addEventListener('click', async ()=>{
		checkBtn.disabled = true;
		setStatus('Checking...');
		try {
			const result = await ipcRenderer.invoke('updater-check');
			// result is the update object or null
			if(result && result.version){
				pendingUpdate = { version: result.version, url: result.downloadUrl };
				updateReady = false;
				setStatus(`Update available: ${result.version}`);
			} else if(result && result.error){
				setStatus('Check failed: ' + result.error);
			} else {
				pendingUpdate = null;
				updateReady = false;
				setStatus('Already up to date');
			}
			updateButtonState();
		} catch(e){
			setStatus('Check failed: ' + (e.message || e));
		} finally {
			checkBtn.disabled = false;
		}
	});

	// Download & Install / Restart button
	downloadBtn.addEventListener('click', async ()=>{
		if(updateReady){
			// Restart to apply update
			setStatus('Restarting...');
			try {
				await ipcRenderer.invoke('updater-restart');
			} catch(e){
				setStatus('Restart failed: ' + (e.message || e));
			}
			return;
		}
		
		if(!pendingUpdate) return;
		downloadBtn.disabled = true;
		checkBtn.disabled = true;
		setStatus('Downloading...');
		showProgress(0);
		try {
			const result = await ipcRenderer.invoke('updater-download');
			if(result && result.success){
				// Will receive updater-ready event
			} else {
				setStatus('Download failed: ' + (result?.error || 'unknown'));
				hideProgress();
				updateButtonState();
			}
		} catch(e){
			setStatus('Download failed: ' + (e.message || e));
			hideProgress();
			updateButtonState();
		} finally {
			checkBtn.disabled = false;
		}
	});

	// Listen for updater events
	ipcRenderer.on('updater-update-available', (_e, info)=>{
		pendingUpdate = { version: info.version, url: info.url };
		updateReady = false;
		setStatus(`Update available: ${info.version}`);
		updateButtonState();
	});
	ipcRenderer.on('updater-update-not-available', ()=>{
		pendingUpdate = null;
		updateReady = false;
		setStatus('Already up to date');
		updateButtonState();
	});
	ipcRenderer.on('updater-downloading', (_e, data)=>{
		const pct = data && typeof data.percent === 'number' ? data.percent : 0;
		showProgress(pct);
		setStatus(`Downloading... ${pct.toFixed(0)}%`);
	});
	ipcRenderer.on('updater-extracting', ()=>{
		showProgress(100);
		setStatus('Extracting...');
	});
	ipcRenderer.on('updater-update-ready', ()=>{
		updateReady = true;
		setStatus('Update ready - click Restart to apply');
		showProgress(100);
		updateButtonState();
		checkBtn.disabled = false;
	});
	ipcRenderer.on('updater-update-error', (_e, err)=>{
		setStatus('Error: ' + (err.message || err));
		hideProgress();
		checkBtn.disabled = false;
		updateButtonState();
	});
})();

// ===== Addons section =====
(function(){
	const listEl = document.getElementById('addons-list');
	const availableEl = document.getElementById('addons-available-list');
	const refreshBtn = document.getElementById('addons-refresh');
	const openFolderBtn = document.getElementById('addons-open-folder');
	
	if(!listEl) return;
	
	let installedAddons = [];
	let availableAddons = [];
	let needsRestart = false;
	
	// Render installed addons
	function renderInstalled(){
		if(installedAddons.length === 0){
			listEl.innerHTML = '<div class="addons-empty">No addons installed</div>';
			return;
		}
		
		listEl.innerHTML = installedAddons.map(addon => `
			<div class="addon-card ${addon.enabled ? '' : 'disabled'}" data-id="${addon.id}">
				<div class="addon-icon">${addon.icon || '📦'}</div>
				<div class="addon-info">
					<div>
						<span class="addon-name">${addon.name}</span>
						<span class="addon-version">v${addon.version}</span>
					</div>
					<div class="addon-desc">${addon.description || ''}</div>
				</div>
				<div class="addon-actions">
					<button class="addon-toggle ${addon.enabled ? 'on' : 'off'}" 
						data-action="toggle" data-id="${addon.id}" 
						title="${addon.enabled ? 'Disable' : 'Enable'}"></button>
					<button class="addon-btn danger" data-action="uninstall" data-id="${addon.id}">Uninstall</button>
				</div>
			</div>
		`).join('');
		
		// Show restart notice if needed
		if(needsRestart){
			const notice = document.createElement('div');
			notice.className = 'restart-notice';
			notice.innerHTML = `
				<span>⚠️ Restart required to apply changes</span>
				<button id="addon-restart-btn">Restart Now</button>
			`;
			listEl.appendChild(notice);
			
			const restartBtn = document.getElementById('addon-restart-btn');
			if(restartBtn){
				restartBtn.addEventListener('click', () => {
					try { ipcRenderer.invoke('updater-restart'); } catch(_){}
				});
			}
		}
	}
	
	// Render available addons
	function renderAvailable(){
		// Filter out already installed
		const installedIds = new Set(installedAddons.map(a => a.id));
		const toShow = availableAddons.filter(a => !installedIds.has(a.id));
		
		if(toShow.length === 0){
			availableEl.innerHTML = '<div class="addons-empty">No new addons available</div>';
			return;
		}
		
		availableEl.innerHTML = toShow.map(addon => `
			<div class="addon-card" data-id="${addon.id}">
				<div class="addon-icon">${addon.icon || '📦'}</div>
				<div class="addon-info">
					<div>
						<span class="addon-name">${addon.name}</span>
						<span class="addon-version">v${addon.version}</span>
					</div>
					<div class="addon-desc">${addon.description || ''}</div>
				</div>
				<div class="addon-actions">
					<button class="addon-btn primary" data-action="install" data-id="${addon.id}" data-url="${addon.downloadUrl}">Install</button>
				</div>
			</div>
		`).join('');
	}
	
	// Load addons info
	async function loadAddons(){
		listEl.innerHTML = '<div class="addons-loading">Loading addons...</div>';
		
		try {
			const info = await ipcRenderer.invoke('addons-get-info');
			installedAddons = info.installed || [];
			availableAddons = info.available || [];
			
			renderInstalled();
			renderAvailable();
			
			// Fetch remote addons in background
			fetchAvailable();
		} catch(e){
			listEl.innerHTML = '<div class="addons-empty">Failed to load addons</div>';
			console.error('[settings][addons] loadAddons failed:', e);
		}
	}
	
	// Fetch available addons from registry
	async function fetchAvailable(){
		try {
			const available = await ipcRenderer.invoke('addons-fetch-available');
			availableAddons = available || [];
			renderAvailable();
		} catch(e){
			console.warn('[settings][addons] fetchAvailable failed:', e);
		}
	}
	
	// Handle addon actions (click delegation)
	listEl.addEventListener('click', async (e) => {
		const btn = e.target.closest('[data-action]');
		if(!btn) return;
		
		const action = btn.dataset.action;
		const addonId = btn.dataset.id;
		
		if(action === 'toggle'){
			const addon = installedAddons.find(a => a.id === addonId);
			if(!addon) return;
			
			btn.disabled = true;
			try {
				await ipcRenderer.invoke('addons-set-enabled', { addonId, enabled: !addon.enabled });
				addon.enabled = !addon.enabled;
				needsRestart = true;
				renderInstalled();
			} catch(e){
				console.error('[settings][addons] toggle failed:', e);
			}
			btn.disabled = false;
		}
		
		if(action === 'uninstall'){
			if(!confirm(`Uninstall addon "${addonId}"?`)) return;
			
			btn.disabled = true;
			btn.textContent = 'Removing...';
			try {
				await ipcRenderer.invoke('addons-uninstall', { addonId });
				installedAddons = installedAddons.filter(a => a.id !== addonId);
				needsRestart = true;
				renderInstalled();
				renderAvailable();
			} catch(e){
				console.error('[settings][addons] uninstall failed:', e);
				btn.textContent = 'Uninstall';
			}
			btn.disabled = false;
		}
	});
	
	// Handle available addons install
	if(availableEl){
		availableEl.addEventListener('click', async (e) => {
			const btn = e.target.closest('[data-action="install"]');
			if(!btn) return;
			
			const addonId = btn.dataset.id;
			const downloadUrl = btn.dataset.url;
			
			btn.disabled = true;
			btn.textContent = 'Installing...';
			
			// Add progress bar
			const card = btn.closest('.addon-card');
			let progressEl = card.querySelector('.addon-progress');
			if(!progressEl){
				progressEl = document.createElement('div');
				progressEl.className = 'addon-progress';
				progressEl.innerHTML = '<div class="addon-progress-bar" style="width: 0%"></div>';
				card.appendChild(progressEl);
			}
			
			try {
				const result = await ipcRenderer.invoke('addons-install', { addonId, downloadUrl });
				
				if(result.success){
					needsRestart = true;
					// Reload list
					await loadAddons();
				} else {
					btn.textContent = 'Failed';
					setTimeout(() => { btn.textContent = 'Install'; btn.disabled = false; }, 2000);
				}
			} catch(e){
				console.error('[settings][addons] install failed:', e);
				btn.textContent = 'Install';
				btn.disabled = false;
			}
			
			if(progressEl) progressEl.remove();
		});
	}
	
	// Refresh button
	if(refreshBtn){
		refreshBtn.addEventListener('click', () => {
			loadAddons();
		});
	}
	
	// Open folder button
	if(openFolderBtn){
		openFolderBtn.addEventListener('click', async () => {
			try {
				const dir = await ipcRenderer.invoke('addons-get-dir');
				if(dir){
					// Use shell.openPath via IPC
					ipcRenderer.send('shell-open-path', dir);
				}
			} catch(e){
				console.error('[settings][addons] openFolder failed:', e);
			}
		});
	}
	
	// Listen for install progress
	ipcRenderer.on('addon-download-progress', (_e, data) => {
		const progressBars = document.querySelectorAll('.addon-progress-bar');
		progressBars.forEach(bar => {
			bar.style.width = (data.progress || 0) + '%';
		});
	});
	
	// Initial load
	loadAddons();
})();


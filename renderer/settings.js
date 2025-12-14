const { ipcRenderer } = require('electron');
// DevTools button (moved from main toolbar)
try {
	const devBtn = document.getElementById('open-devtools');
	if(devBtn){ devBtn.addEventListener('click', ()=>{ try { ipcRenderer.send('open-devtools'); } catch(_){ } }); }
} catch(_){ }

// ===== Masonry-like segments layout (no multi-column glitches) =====
let __layoutRaf = null;
function getDesiredCols(containerWidth){
	// Match CSS breakpoints: 3 cols default, 2 on medium, 1 on small
	if(containerWidth <= 720) return 1;
	if(containerWidth <= 980) return 2;
	return 3;
}
function layoutSegments(){
	try {
		const segments = document.querySelector('.segments');
		if(!segments) return;
		const allCards = Array.from(segments.querySelectorAll('.seg'));
		if(allCards.length === 0) return;
		const width = segments.clientWidth || segments.parentElement?.clientWidth || window.innerWidth;
		const cols = getDesiredCols(width);
		// Rebuild columns
		segments.textContent = '';
		const columns = [];
		for(let i=0;i<cols;i++){
			const col = document.createElement('div');
			col.className = 'segCol';
			segments.appendChild(col);
			columns.push(col);
		}
		// Place cards into the shortest column (compact, avoids large gaps)
		for(const card of allCards){
			let best = columns[0];
			let bestH = best.getBoundingClientRect().height;
			for(let i=1;i<columns.length;i++){
				const h = columns[i].getBoundingClientRect().height;
				if(h < bestH){ best = columns[i]; bestH = h; }
			}
			best.appendChild(card);
		}
	} catch(_){ }
}
function queueLayout(){
	if(__layoutRaf) return;
	__layoutRaf = requestAnimationFrame(()=>{ __layoutRaf = null; layoutSegments(); });
}
window.addEventListener('resize', queueLayout);


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
const autoAdaptiveInput = document.getElementById('auto-adaptive');
if(autoIntervalInput){ autoIntervalInput.addEventListener('change', ()=>{ const v=parseInt(autoIntervalInput.value,10); if(!isNaN(v)) try { ipcRenderer.send('auto-interval-set', { intervalMs: v }); } catch(_){ } }); }
if(autoAdaptiveInput){ autoAdaptiveInput.addEventListener('change', ()=>{ const en=!!autoAdaptiveInput.checked; try { ipcRenderer.send('auto-adaptive-set', { enabled: en }); } catch(_){ } }); }

// Auto odds tolerance (percent difference threshold)
const autoTolInput = document.getElementById('auto-tolerance');
let autoTolerancePct = 0.1; // default display precision: tenths
function clampTol(v){ return Math.max(0.01, Math.min(5, Math.round(v*10)/10)); }
if(autoTolInput){
	autoTolInput.addEventListener('input', ()=>{
		const raw = parseFloat(autoTolInput.value);
		if(!isNaN(raw)) autoTolerancePct = clampTol(raw);
	});
	autoTolInput.addEventListener('change', ()=>{
		const raw = parseFloat(autoTolInput.value);
		if(!isNaN(raw)) autoTolerancePct = clampTol(raw);
		autoTolInput.value = autoTolerancePct.toFixed(1);
		// Apply immediately (live) so auto engines react without pressing Save
		try { ipcRenderer.send('auto-tolerance-set', { tolerancePct: autoTolerancePct }); } catch(_){ }
	});
}

// Shock suspend threshold (%) – auto suspends when Excel odds jump by >= this percent
const shockInput = document.getElementById('auto-shock-threshold');
let shockThresholdPct = 40.0; // default UI suggestion
function clampShock(v){ return Math.max(1, Math.min(100, Math.round(v*10)/10)); }
if(shockInput){
	shockInput.addEventListener('input', ()=>{ const raw=parseFloat(shockInput.value); if(!isNaN(raw)) shockThresholdPct=clampShock(raw); });
	shockInput.addEventListener('change', ()=>{ const raw=parseFloat(shockInput.value); if(!isNaN(raw)) shockThresholdPct=clampShock(raw); shockInput.value = shockThresholdPct.toFixed(1); try { ipcRenderer.send('auto-shock-threshold-set', { pct: shockThresholdPct }); } catch(_){ } });
}

// Burst levels (3 tiers configurable)
const burstInputs = {
	th1: document.getElementById('burst1-th'), pulses1: document.getElementById('burst1-pulses'),
	th2: document.getElementById('burst2-th'), pulses2: document.getElementById('burst2-pulses'),
	th3: document.getElementById('burst3-th'), pulses3: document.getElementById('burst3-pulses'),
};
let burstLevels = [ { thresholdPct:15, pulses:4 }, { thresholdPct:7, pulses:3 }, { thresholdPct:5, pulses:2 } ];
function sanitizeBurst(list){
	try {
		if(!Array.isArray(list)) list = burstLevels;
		const cleaned = list.map(l=>({ thresholdPct: Math.max(0.01, Math.min(100, Number(l.thresholdPct)||0)), pulses: Math.max(1, Math.min(10, Math.round(Number(l.pulses)||0))) }))
			.filter(l=> l.thresholdPct>0 && l.pulses>=1)
			.sort((a,b)=> b.thresholdPct - a.thresholdPct)
			.slice(0,3);
		return cleaned.length? cleaned : [ { thresholdPct:15, pulses:4 }, { thresholdPct:7, pulses:3 }, { thresholdPct:5, pulses:2 } ];
	} catch(_){ return [ { thresholdPct:15, pulses:4 }, { thresholdPct:7, pulses:3 }, { thresholdPct:5, pulses:2 } ]; }
}
function applyBurstInputsFromModel(){
	burstLevels = sanitizeBurst(burstLevels);
	for(let i=0;i<3;i++){
		const l = burstLevels[i];
		const thEl = burstInputs['th'+(i+1)];
		const puEl = burstInputs['pulses'+(i+1)];
		if(thEl) thEl.value = l? Number(l.thresholdPct).toFixed(1) : '';
		if(puEl) puEl.value = l? l.pulses : '';
	}
}
function readBurstInputs(){
	const tmp=[];
	for(let i=1;i<=3;i++){
		const th = parseFloat(burstInputs['th'+i]?.value);
		const pu = parseInt(burstInputs['pulses'+i]?.value,10);
		if(!isNaN(th) && !isNaN(pu)) tmp.push({ thresholdPct: th, pulses: pu });
	}
	if(tmp.length) burstLevels = tmp;
	burstLevels = sanitizeBurst(burstLevels);
}
Object.values(burstInputs).forEach(el=>{ if(el){ el.addEventListener('change', ()=>{ readBurstInputs(); applyBurstInputsFromModel(); try { ipcRenderer.send('auto-burst-levels-set', { levels: burstLevels }); } catch(_){ } }); }});

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
	// Persist auto tolerance
	try { ipcRenderer.send('auto-tolerance-set', { tolerancePct: autoTolerancePct }); } catch(_){ }
	// Persist shock threshold
	try { ipcRenderer.send('auto-shock-threshold-set', { pct: shockThresholdPct }); } catch(_){ }
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
	queueLayout();
	// Request stored auto tolerance & burst levels after initial settings applied
	try { ipcRenderer.invoke('auto-tolerance-get').then(v=>{
		if(typeof v === 'number' && !isNaN(v)) autoTolerancePct = clampTol(v);
		if(autoTolInput) autoTolInput.value = autoTolerancePct.toFixed(1);
	}).catch(()=>{ if(autoTolInput) autoTolInput.value = autoTolerancePct.toFixed(1); }); } catch(_){ if(autoTolInput) autoTolInput.value = autoTolerancePct.toFixed(1); }
	// Initialize shock threshold from store
	try { ipcRenderer.invoke('auto-shock-threshold-get').then(v=>{ if(typeof v==='number' && !isNaN(v)) shockThresholdPct=clampShock(v); if(shockInput) shockInput.value = shockThresholdPct.toFixed(1); }).catch(()=>{ if(shockInput) shockInput.value = shockThresholdPct.toFixed(1); }); } catch(_){ if(shockInput) shockInput.value = shockThresholdPct.toFixed(1); }
	try { ipcRenderer.invoke('auto-burst-levels-get').then(v=>{ if(Array.isArray(v)) { burstLevels = v; } applyBurstInputsFromModel(); }).catch(()=> applyBurstInputsFromModel()); } catch(_){ applyBurstInputsFromModel(); }
	// Pre-apply game selector from payload if present
	try {
		const sel = document.getElementById('game-select');
		if(sel && cfg && cfg.selectedGame){ sel.value = cfg.selectedGame; }
	} catch(_){ }
	queueLayout();
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

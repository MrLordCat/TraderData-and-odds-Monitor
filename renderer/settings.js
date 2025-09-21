const { ipcRenderer } = require('electron');
// Contrast stub
const slider = document.getElementById('contrast');
const cVal = document.getElementById('cVal');
function updateContrast(){ cVal.textContent = slider.value + '%'; }
slider.addEventListener('input', updateContrast);

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
	ipcRenderer.send('close-settings');
};
document.getElementById('close').onclick = ()=> ipcRenderer.send('close-settings');
window.addEventListener('keydown', e=>{ if(e.key==='Escape') ipcRenderer.send('close-settings'); });
document.getElementById('backdrop').onclick = ()=> ipcRenderer.send('close-settings');

	ipcRenderer.on('settings-init', (_e,cfg)=>{
	if(cfg && typeof cfg.contrast!=='undefined'){ slider.value=cfg.contrast; } else { slider.value=100; }
	updateContrast();
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
});

const { ipcRenderer } = require('electron');
// Contrast stub
const slider = document.getElementById('contrast');
const cVal = document.getElementById('cVal');
function updateContrast(){ cVal.textContent = slider.value + '%'; }
slider.addEventListener('input', updateContrast);

// Game Stats theme controls
const fields = {
	bg: document.getElementById('gs-bg'),
	border: document.getElementById('gs-border'),
	head: document.getElementById('gs-head'),
	win: document.getElementById('gs-win'),
	lose: document.getElementById('gs-lose'),
	intensity: document.getElementById('gs-intensity'),
	animColor: document.getElementById('gs-animColor'),
	animIntensity: document.getElementById('gs-animIntensity'),
	animDurSec: document.getElementById('gs-animDurSec')
};
// Heat bar fields
const hb = {
	enabled: document.getElementById('hb-enabled'),
	decay: document.getElementById('hb-decay'),
	bump: document.getElementById('hb-bump'),
	color1: document.getElementById('hb-color1'),
	color2: document.getElementById('hb-color2')
};
const defaultTheme = {
	bg: '#181f27', border:'#27313d', head:'#1d252f', win:'#286650', lose:'#8a4646', intensity:40,
	animColor:'#d4b14a', animIntensity:130, animDurSec:3
};
let currentTheme = { ...defaultTheme };
let currentHeatBar = { enabled:true, decayPerSec:0.18, bumpAmount:0.22, color1:'#3c78ff', color2:'#ff4646' };

function emitTheme(){
	ipcRenderer.send('gs-theme-preview', currentTheme);
}
function emitHeatBar(){
	ipcRenderer.send('gs-heatbar-preview', currentHeatBar);
}
function applyInputsToTheme(){
	currentTheme = {
		bg: fields.bg.value || defaultTheme.bg,
		border: fields.border.value || defaultTheme.border,
		head: fields.head.value || defaultTheme.head,
		win: fields.win.value || defaultTheme.win,
		lose: fields.lose.value || defaultTheme.lose,
		intensity: parseInt(fields.intensity.value,10) || 0,
		animColor: fields.animColor.value || defaultTheme.animColor,
		animIntensity: parseInt(fields.animIntensity.value,10) || defaultTheme.animIntensity,
		animDurSec: Number(fields.animDurSec.value||defaultTheme.animDurSec)
	};
	emitTheme();
}
Object.values(fields).forEach(el=>{
	if(!el) return;
	el.addEventListener('input', applyInputsToTheme);
});

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
}
Object.values(hb).forEach(el=>{ if(el){ el.addEventListener('input', applyHeatBarInputs); el.addEventListener('change', applyHeatBarInputs); } });

document.getElementById('reset').onclick = ()=>{
	Object.entries(defaultTheme).forEach(([k,v])=>{ if(fields[k]) fields[k].value=v; });
	applyInputsToTheme();
	// Heat bar defaults
	hb.enabled.checked = true; hb.decay.value='0.18'; hb.bump.value='0.22'; hb.color1.value='#3c78ff'; hb.color2.value='#ff4646';
	applyHeatBarInputs();
};
document.getElementById('save').onclick = ()=>{
	applyInputsToTheme();
	applyHeatBarInputs();
	currentHeatBar.decayPerSec = +Number(currentHeatBar.decayPerSec).toFixed(3);
	currentHeatBar.bumpAmount = +Number(currentHeatBar.bumpAmount).toFixed(3);
	// Reflect normalized values back into inputs so the user immediately sees saved values
	hb.decay.value = String(currentHeatBar.decayPerSec);
	hb.bump.value = String(currentHeatBar.bumpAmount);
	ipcRenderer.send('gs-theme-save', currentTheme);
	ipcRenderer.send('gs-heatbar-save', currentHeatBar);
	ipcRenderer.send('close-settings');
};
document.getElementById('close').onclick = ()=> ipcRenderer.send('close-settings');
window.addEventListener('keydown', e=>{ if(e.key==='Escape') ipcRenderer.send('close-settings'); });
document.getElementById('backdrop').onclick = ()=> ipcRenderer.send('close-settings');

ipcRenderer.on('settings-init', (_e,cfg)=>{
	// Contrast stub
	if(cfg && typeof cfg.contrast!=='undefined'){ slider.value=cfg.contrast; } else { slider.value=100; }
	updateContrast();
	// Theme init
	const t = cfg && cfg.gsTheme ? { ...defaultTheme, ...cfg.gsTheme } : { ...defaultTheme };
	currentTheme = t;
	Object.entries(t).forEach(([k,v])=>{ if(fields[k]) fields[k].value = v; });
	emitTheme();
	// Heat bar init
	if(cfg && cfg.gsHeatBar){ currentHeatBar = { ...currentHeatBar, ...cfg.gsHeatBar }; }
	hb.enabled.checked = !!currentHeatBar.enabled;
	hb.decay.value = String(currentHeatBar.decayPerSec);
	hb.bump.value = String(currentHeatBar.bumpAmount);
	hb.color1.value = currentHeatBar.color1;
	hb.color2.value = currentHeatBar.color2;
	emitHeatBar();
});

// Stealth preload for bet365 with page-world injection + console bridge.
const { ipcRenderer } = require('electron');

window.addEventListener('message', (e)=>{
	const d = e.data; if(d && d.__stealthConsole) {
		try { ipcRenderer.send('stealth-console', d.payload); } catch(_) {}
	}
});

function inject(){
	const fn = () => { try {
		// Console bridge
			(function(){
				const lv=['log','warn','error','info','debug'];
				lv.forEach(L=>{ const o=console[L]; console[L]=function(){ try{ window.postMessage({__stealthConsole:true,payload:{level:L,args:[...arguments].slice(0,24).map(a=>{ try{ if(typeof a==='string') return a; if(a instanceof Error) return a.message; if(Array.isArray(a)) return '[Array len='+a.length+'] '+JSON.stringify(a.slice(0,20)); if(a && typeof a==='object') return '[Object keys='+Object.keys(a).length+'] '+JSON.stringify(Object.fromEntries(Object.entries(a).slice(0,20))); return JSON.stringify(a); }catch(_){ return String(a); } })}},'*'); }catch(_){ } return o.apply(this,arguments); }; });
				// console.table interception (needed for site scripts printing large matrices)
				try {
					const ot = console.table;
					console.table = function(data, columns){
						try {
							let snapshot;
							if (Array.isArray(data)) snapshot = { kind:'array', length:data.length, sample:data.slice(0,30) };
							else if (data && typeof data === 'object') snapshot = { kind:'object', keys:Object.keys(data).slice(0,60) };
							else snapshot = { kind:'primitive', value: String(data) };
							window.postMessage({ __stealthConsole:true, payload:{ level:'table', args:['[table]', JSON.stringify(snapshot)] } }, '*');
						} catch(_){ }
						try { return ot.apply(this, arguments); } catch(_){ return undefined; }
					};
				} catch(_) {}
			})();

		// webdriver
		try { Object.defineProperty(Navigator.prototype,'webdriver',{get:()=>undefined}); } catch(_){ }
		// languages
		try { Object.defineProperty(Navigator.prototype,'languages',{get:()=>['en-US','en']}); } catch(_){ }
		// platform / hardware
		try { Object.defineProperty(Navigator.prototype,'platform',{get:()=> 'Win32'}); } catch(_){ }
		try { Object.defineProperty(Navigator.prototype,'hardwareConcurrency',{get:()=> 8}); } catch(_){ }
		try { if(!('deviceMemory' in navigator)) Object.defineProperty(Navigator.prototype,'deviceMemory',{get:()=>8}); } catch(_){ }

		// userAgentData
		try { if(!navigator.userAgentData){ const brands=[{brand:'Chromium',version:'125'},{brand:'Google Chrome',version:'125'},{brand:'Not;A=Brand',version:'99'}]; const full='125.0.0.0'; const uaData={ brands:brands.slice(), mobile:false, platform:'Windows', getHighEntropyValues:(hs)=>Promise.resolve(hs.reduce((a,k)=>{ switch(k){ case 'architecture': a.architecture='x86'; break; case 'model': a.model=''; break; case 'platformVersion': a.platformVersion='15.0.0'; break; case 'uaFullVersion': a.uaFullVersion=full; break; case 'fullVersionList': a.fullVersionList=brands.map(b=>({brand:b.brand,version:full})); break; case 'bitness': a.bitness='64'; break; case 'wow64': a.wow64=false; break;} return a; },{})) }; Object.defineProperty(Navigator.prototype,'userAgentData',{get:()=>uaData}); } } catch(_){ }

		// chrome stub
		try { if(!window.chrome){ Object.defineProperty(window,'chrome',{ value:{ runtime:{ sendMessage:()=>{}, connect:()=>({postMessage:()=>{},onMessage:{addListener:()=>{}}}) }, app:{ isInstalled:false }, csi:()=>{}, loadTimes:()=>({}), webstore:{} }, configurable:false }); } } catch(_){ }

		// plugins & mimeTypes
		try { const pdf={type:'application/pdf',suffixes:'pdf',description:'Portable Document Format',enabledPlugin:null}; const nacl={type:'application/x-nacl',suffixes:'',description:'NaCl plug-in',enabledPlugin:null}; const pls=[{name:'Chrome PDF Plugin',filename:'internal-pdf-viewer',description:'Portable Document Format'},{name:'Chrome PDF Viewer',filename:'mhjfbmdgcfjbbpaeojofohoefgiehjai',description:''}]; function RO(o){return new Proxy(o,{set:()=>false});} const pList=RO({0:pls[0],1:pls[1],length:2,item:i=>pls[i]||null,namedItem:n=>pls.find(p=>p.name===n)||null}); const mList=RO({0:pdf,1:nacl,length:2,item:i=>[pdf,nacl][i]||null,namedItem:n=>({'application/pdf':pdf,'application/x-nacl':nacl}[n]||null)}); Object.defineProperty(Navigator.prototype,'plugins',{get:()=>pList}); Object.defineProperty(Navigator.prototype,'mimeTypes',{get:()=>mList}); } catch(_){ }

		// permissions
		try { const op = navigator.permissions && navigator.permissions.query; if(op){ navigator.permissions.query = function(q){ return op.call(this,q).catch(()=>({state:'prompt'})); }; } } catch(_){ }

		// WebGL spoof
		try { const gp = WebGLRenderingContext.prototype.getParameter; WebGLRenderingContext.prototype.getParameter=function(p){ const V=0x1F00,R=0x1F01; if(p===V) return 'Google Inc.'; if(p===R) return 'ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0)'; return gp.call(this,p); }; } catch(_){ }

		// Outer size
		try { if(window.outerWidth===0||window.outerHeight===0){ Object.defineProperty(window,'outerWidth',{get:()=>innerWidth+8}); Object.defineProperty(window,'outerHeight',{get:()=>innerHeight+86}); } } catch(_){ }

		// connection
		try { if(!('connection' in navigator)){ const conn={downlink:10,effectiveType:'4g',rtt:50,saveData:false,onchange:null}; Object.defineProperty(Navigator.prototype,'connection',{get:()=>conn}); } } catch(_){ }

		// Intl
		try { const or = Intl.DateTimeFormat.prototype.resolvedOptions; Intl.DateTimeFormat.prototype.resolvedOptions=function(){ const r=or.call(this); if(!r.timeZone) r.timeZone='Europe/London'; return r; }; } catch(_){ }

		// UA cleanup
		try { if(/Electron/i.test(navigator.userAgent)){ const clean=navigator.userAgent.replace(/Electron\/[^ ]+ /,''); Object.defineProperty(Navigator.prototype,'userAgent',{get:()=>clean}); } } catch(_){ }

		console.debug('[stealth] injection complete');
	} catch(e){ console.error('[stealth] failed', e); } };
	try { const s=document.createElement('script'); s.textContent='('+fn+')();'; (document.head||document.documentElement).appendChild(s); s.remove(); } catch(_){ }
}

if(document.readyState==='loading'){
	document.addEventListener('DOMContentLoaded', inject, { once:true });
} else { inject(); }

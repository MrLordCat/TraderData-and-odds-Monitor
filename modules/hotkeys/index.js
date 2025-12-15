// Unified hotkey manager (window-active hotkeys).
// Uses before-input-event on webContents (BrowserWindow + BrowserViews).
// Keeps key handling centralized to avoid duplicated listeners and drift.

function createHotkeyManager(ctx){
	const actions = ctx && ctx.actions ? ctx.actions : {};
	const state = ctx && ctx.state ? ctx.state : {};
	const attached = new WeakSet();
	let lastToggleTs = 0;

	function isEditableInPage(webContents){
		try {
			if(!webContents || typeof webContents.executeJavaScript !== 'function') return Promise.resolve(false);
			// Only makes sense for real pages; for file:// UI we treat as non-editable.
			const url = (typeof webContents.getURL === 'function') ? webContents.getURL() : '';
			if(!url || url.startsWith('file:') || url.startsWith('data:') || url.startsWith('about:')) return Promise.resolve(false);
			const probe = webContents.executeJavaScript(`(function(){
				const ae=document.activeElement; if(!ae) return false;
				const tag=ae.tagName; const editable=ae.isContentEditable;
				if(editable) return true;
				if(tag==='INPUT'){
					const tp=(ae.getAttribute('type')||'text').toLowerCase();
					if(['text','search','number','email','password','url','tel'].includes(tp)) return true;
				}
				if(tag==='TEXTAREA') return true;
				return false;
			})();`, true).then(v=>!!v).catch(()=>false);

			// Some heavy/SPAs can stall executeJavaScript; don't block hotkeys indefinitely.
			const timeoutMs = 80;
			const timeout = new Promise(resolve=> setTimeout(()=> resolve(false), timeoutMs));
			return Promise.race([probe, timeout]);
		} catch(_){
			return Promise.resolve(false);
		}
	}

	function handleHotkey(event, input, webContents){
		try {
			if(!input || input.type !== 'keyDown' || input.isAutoRepeat) return;
			// Only unmodified keys for these shortcuts.
			if(input.alt || input.control || input.meta) return;

			const key = String(input.key || '');
			if(key !== 'Tab' && key !== 'F1' && key !== 'F2' && key !== 'F3') return;

			const now = Date.now();
			const throttleMs = 250;
			if(key === 'Tab'){
				if(now - lastToggleTs < throttleMs) return;
				lastToggleTs = now;
			}

			const run = ()=>{
				try {
					if(key === 'Tab'){
						actions.toggleStats && actions.toggleStats();
					} else if(key === 'F1'){
						actions.toggleAuto && actions.toggleAuto();
					} else if(key === 'F2'){
						actions.toggleAutoResume && actions.toggleAutoResume();
					} else if(key === 'F3'){
						actions.startScript && actions.startScript();
					}
					try { event && event.preventDefault && event.preventDefault(); } catch(_){ }
				} catch(_){ }
			};

			// Avoid firing while user types in an input inside broker pages.
			isEditableInPage(webContents).then(isEditable=>{
				if(isEditable) return;
				run();
			}).catch(()=> run());
		} catch(_){ }
	}

	function attachToWebContents(webContents){
		try {
			if(!webContents || attached.has(webContents)) return;
			attached.add(webContents);
			webContents.on('before-input-event', (event, input)=> handleHotkey(event, input, webContents));
		} catch(_){ }
	}

	return { attachToWebContents };
}

module.exports = { createHotkeyManager };

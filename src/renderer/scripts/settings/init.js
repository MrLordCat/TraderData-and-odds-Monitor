// Settings init - version display, DevTools buttons
const { ipcRenderer } = require('electron');

function initVersion() {
	try {
		const label = document.getElementById('version-label');
		if (!label) return;
		ipcRenderer.invoke('updater-get-version').then(info => {
			if (info && info.version) {
				let vText = 'v' + info.version;
				if (info.buildInfo && info.buildInfo.channel === 'dev') {
					vText += ' dev';
				}
				label.textContent = '(' + vText + ')';
			} else {
				label.textContent = '';
			}
		}).catch(() => { label.textContent = ''; });
	} catch (_) { }
}

function initDevToolsButtons() {
	// DevTools button
	try {
		const devBtn = document.getElementById('open-devtools');
		if (devBtn) {
			devBtn.addEventListener('click', () => {
				try { ipcRenderer.send('open-devtools'); } catch (_) { }
			});
		}
	} catch (_) { }

	// Main Window DevTools button
	try {
		const mainDevBtn = document.getElementById('open-main-devtools');
		if (mainDevBtn) {
			mainDevBtn.addEventListener('click', () => {
				try { ipcRenderer.send('open-main-devtools'); } catch (_) { }
			});
		}
	} catch (_) { }

	// Open User Data folder button
	try {
		const userDataBtn = document.getElementById('open-userdata');
		if (userDataBtn) {
			userDataBtn.addEventListener('click', () => {
				try { ipcRenderer.send('open-userdata-folder'); } catch (_) { }
			});
		}
	} catch (_) { }
}

function init() {
	initVersion();
	initDevToolsButtons();
}

export { init };

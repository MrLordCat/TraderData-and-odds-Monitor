// Edge Extension section
const { ipcRenderer } = require('electron');

function init() {
	const statusSpan = document.getElementById('ext-status');
	const versionSpan = document.getElementById('ext-version');
	const openFolderBtn = document.getElementById('ext-open-folder');

	if (!openFolderBtn) return;

	async function loadExtensionStatus() {
		try {
			const status = await ipcRenderer.invoke('extension-bridge-status');
			if (statusSpan) {
				if (status && status.connected) {
					statusSpan.textContent = 'Connected';
					statusSpan.style.color = '#4caf50';
				} else {
					statusSpan.textContent = 'Not connected';
					statusSpan.style.color = '#888';
				}
			}
			if (versionSpan) {
				if (status && status.version) {
					versionSpan.textContent = status.version;
				} else if (status && status.bundledVersion) {
					versionSpan.textContent = status.bundledVersion + ' (bundled)';
				} else {
					versionSpan.textContent = '—';
				}
			}
		} catch (e) {
			console.warn('[settings][extension] loadStatus failed', e.message);
			if (statusSpan) statusSpan.textContent = 'Error';
		}
	}

	loadExtensionStatus();

	openFolderBtn.addEventListener('click', async () => {
		try {
			const extPath = await ipcRenderer.invoke('extension-get-path');
			if (extPath) {
				await ipcRenderer.invoke('shell-open-path', extPath);
			}
		} catch (e) {
			console.warn('[settings][extension] openFolder failed', e.message);
		}
	});
}

module.exports = { init };

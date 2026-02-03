// Updates section
const { ipcRenderer } = require('electron');

let pendingUpdate = null;
let updateReady = false;

// ===== DOM elements =====
let channelSel, autoChk, versionSpan, statusSpan, checkBtn, downloadBtn, progressDiv, progressBar;

function cacheElements() {
	channelSel = document.getElementById('upd-channel');
	autoChk = document.getElementById('upd-auto');
	versionSpan = document.getElementById('upd-version');
	statusSpan = document.getElementById('upd-status');
	checkBtn = document.getElementById('upd-check');
	downloadBtn = document.getElementById('upd-download');
	progressDiv = document.getElementById('upd-progress');
	progressBar = progressDiv ? progressDiv.querySelector('.bar') : null;
}

function setStatus(text) {
	if (statusSpan) statusSpan.textContent = text || '—';
}

function showProgress(pct) {
	if (!progressDiv || !progressBar) return;
	progressDiv.hidden = false;
	progressBar.style.width = Math.max(0, Math.min(100, pct)).toFixed(1) + '%';
}

function hideProgress() {
	if (progressDiv) progressDiv.hidden = true;
	if (progressBar) progressBar.style.width = '0%';
}

function updateButtonState() {
	if (!downloadBtn) return;
	if (updateReady) {
		downloadBtn.textContent = 'Restart';
		downloadBtn.disabled = false;
	} else if (pendingUpdate) {
		downloadBtn.textContent = 'Download & Install';
		downloadBtn.disabled = false;
	} else {
		downloadBtn.textContent = 'Download & Install';
		downloadBtn.disabled = true;
	}
}

async function loadUpdaterState() {
	try {
		const status = await ipcRenderer.invoke('updater-get-status');
		if (status) {
			if (channelSel) channelSel.value = status.channel || 'stable';
			if (autoChk) autoChk.checked = status.autoCheck !== false;
			if (versionSpan) versionSpan.textContent = status.currentVersion || '—';

			if (status.availableUpdate) {
				pendingUpdate = { version: status.availableUpdate.version, url: status.availableUpdate.downloadUrl };
				setStatus(`Update available: ${status.availableUpdate.version}`);
			} else if (status.checking) {
				setStatus('Checking...');
			} else if (status.downloading) {
				setStatus(`Downloading... ${status.downloadProgress || 0}%`);
			} else if (status.lastCheck) {
				setStatus('Already up to date');
			} else {
				setStatus('—');
			}
			updateButtonState();
		}
	} catch (e) {
		console.warn('[settings][updater] loadState failed', e.message);
	}
}

function bindEvents() {
	if (!channelSel || !autoChk || !checkBtn || !downloadBtn) return;

	// Channel change
	channelSel.addEventListener('change', async () => {
		try {
			await ipcRenderer.invoke('updater-set-channel', channelSel.value);
			pendingUpdate = null;
			updateReady = false;
			updateButtonState();
			setStatus('Channel changed');
		} catch (e) {
			console.warn('[settings][updater] setChannel failed', e.message);
		}
	});

	// Auto check toggle
	autoChk.addEventListener('change', async () => {
		try {
			await ipcRenderer.invoke('updater-set-auto-check', autoChk.checked);
		} catch (e) {
			console.warn('[settings][updater] setAutoCheck failed', e.message);
		}
	});

	// Check for updates button
	checkBtn.addEventListener('click', async () => {
		checkBtn.disabled = true;
		setStatus('Checking...');
		try {
			const result = await ipcRenderer.invoke('updater-check');
			if (result && result.version) {
				pendingUpdate = { version: result.version, url: result.downloadUrl };
				updateReady = false;
				setStatus(`Update available: ${result.version}`);
			} else if (result && result.error) {
				let errorMsg = result.error;
				if (result.error.includes('403') || result.error.includes('rate limit')) {
					errorMsg = 'Rate limit exceeded. Try again in ~1 hour.';
				} else if (result.error.includes('timeout')) {
					errorMsg = 'Request timeout. Check internet connection.';
				} else if (result.error.includes('network') || result.error.includes('ENOTFOUND')) {
					errorMsg = 'Network error. Check internet connection.';
				}
				setStatus('⚠️ ' + errorMsg);
			} else {
				pendingUpdate = null;
				updateReady = false;
				setStatus('Already up to date');
			}
			updateButtonState();
		} catch (e) {
			let errorMsg = e.message || String(e);
			if (errorMsg.includes('403') || errorMsg.includes('rate limit')) {
				errorMsg = 'Rate limit exceeded. Try again in ~1 hour.';
			}
			setStatus('⚠️ ' + errorMsg);
		} finally {
			checkBtn.disabled = false;
		}
	});

	// Download & Install / Restart button
	downloadBtn.addEventListener('click', async () => {
		if (updateReady) {
			setStatus('Restarting...');
			try {
				await ipcRenderer.invoke('updater-restart');
			} catch (e) {
				setStatus('Restart failed: ' + (e.message || e));
			}
			return;
		}

		if (!pendingUpdate) return;
		downloadBtn.disabled = true;
		checkBtn.disabled = true;
		setStatus('Downloading...');
		showProgress(0);
		try {
			const result = await ipcRenderer.invoke('updater-download');
			if (!result || !result.success) {
				setStatus('Download failed: ' + (result?.error || 'unknown'));
				hideProgress();
				updateButtonState();
			}
		} catch (e) {
			setStatus('Download failed: ' + (e.message || e));
			hideProgress();
			updateButtonState();
		} finally {
			checkBtn.disabled = false;
		}
	});
}

function bindIpcEvents() {
	ipcRenderer.on('updater-update-available', (_e, info) => {
		pendingUpdate = { version: info.version, url: info.url };
		updateReady = false;
		setStatus(`Update available: ${info.version}`);
		updateButtonState();
	});

	ipcRenderer.on('updater-update-not-available', () => {
		pendingUpdate = null;
		updateReady = false;
		setStatus('Already up to date');
		updateButtonState();
	});

	ipcRenderer.on('updater-downloading', (_e, data) => {
		const pct = data && typeof data.percent === 'number' ? data.percent : 0;
		showProgress(pct);
		setStatus(`Downloading... ${pct.toFixed(0)}%`);
	});

	ipcRenderer.on('updater-extracting', () => {
		showProgress(100);
		setStatus('Extracting...');
	});

	ipcRenderer.on('updater-update-ready', () => {
		updateReady = true;
		setStatus('Update ready - click Restart to apply');
		showProgress(100);
		updateButtonState();
		if (checkBtn) checkBtn.disabled = false;
	});

	ipcRenderer.on('updater-update-error', (_e, err) => {
		setStatus('Error: ' + (err.message || err));
		hideProgress();
		if (checkBtn) checkBtn.disabled = false;
		updateButtonState();
	});
}

function init() {
	cacheElements();
	if (!channelSel || !autoChk || !checkBtn || !downloadBtn) return;
	bindEvents();
	bindIpcEvents();
	loadUpdaterState();
}

export { init };

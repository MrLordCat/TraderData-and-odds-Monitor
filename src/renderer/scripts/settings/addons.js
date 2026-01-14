// Addons section
const { ipcRenderer } = require('electron');

let installedAddons = [];
let availableAddons = [];
let addonUpdates = [];
let needsRestart = false;
let currentChannel = 'dev';

// ===== DOM elements =====
let listEl, availableEl, refreshBtn, openFolderBtn, channelSelect;

function cacheElements() {
	listEl = document.getElementById('addons-list');
	availableEl = document.getElementById('addons-available-list');
	refreshBtn = document.getElementById('addons-refresh');
	openFolderBtn = document.getElementById('addons-open-folder');
	channelSelect = document.getElementById('addon-channel');
}

function getUpdateForAddon(addonId) {
	return addonUpdates.find(u => u.id === addonId);
}

function renderInstalled() {
	if (installedAddons.length === 0) {
		listEl.innerHTML = '<div class="addons-empty">No addons installed</div>';
		return;
	}

	listEl.innerHTML = installedAddons.map(addon => {
		const update = getUpdateForAddon(addon.id);
		const updateBtn = update
			? `<button class="addon-btn update" data-action="update" data-id="${addon.id}" title="Update to v${update.newVersion}">⬆️ Update</button>`
			: '';
		const versionClass = update ? 'addon-version outdated' : 'addon-version';
		const versionText = update
			? `v${addon.version} → v${update.newVersion}`
			: `v${addon.version}`;

		return `
			<div class="addon-card ${addon.enabled ? '' : 'disabled'}" data-id="${addon.id}">
				<div class="addon-icon">${addon.icon || '📦'}</div>
				<div class="addon-info">
					<div>
						<span class="addon-name">${addon.name}</span>
						<span class="${versionClass}">${versionText}</span>
					</div>
					<div class="addon-desc">${addon.description || ''}</div>
				</div>
				<div class="addon-actions">
					${updateBtn}
					<button class="addon-toggle ${addon.enabled ? 'on' : 'off'}" 
						data-action="toggle" data-id="${addon.id}" 
						title="${addon.enabled ? 'Disable' : 'Enable'}"></button>
					<button class="addon-btn danger" data-action="uninstall" data-id="${addon.id}">Uninstall</button>
				</div>
			</div>
		`;
	}).join('');

	if (needsRestart) {
		const notice = document.createElement('div');
		notice.className = 'restart-notice';
		notice.innerHTML = `
			<span>⚠️ Restart required to apply changes</span>
			<button id="addon-restart-btn">Restart Now</button>
		`;
		listEl.appendChild(notice);

		const restartBtn = document.getElementById('addon-restart-btn');
		if (restartBtn) {
			restartBtn.addEventListener('click', () => {
				try { ipcRenderer.invoke('updater-restart'); } catch (_) { }
			});
		}
	}
}

function renderAvailable() {
	const installedIds = new Set(installedAddons.map(a => a.id));
	const toShow = availableAddons.filter(a => !installedIds.has(a.id));

	if (toShow.length === 0) {
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

async function loadAddons() {
	listEl.innerHTML = '<div class="addons-loading">Loading addons...</div>';

	try {
		const info = await ipcRenderer.invoke('addons-get-info');
		installedAddons = info.installed || [];
		availableAddons = info.available || [];

		renderInstalled();
		renderAvailable();

		fetchAvailable();
		checkAddonUpdates();
	} catch (e) {
		listEl.innerHTML = '<div class="addons-empty">Failed to load addons</div>';
		console.error('[settings][addons] loadAddons failed:', e);
	}
}

async function fetchAvailable(forceRefresh = false) {
	try {
		const available = await ipcRenderer.invoke('addons-fetch-available', { forceRefresh });
		availableAddons = available || [];
		renderAvailable();
	} catch (e) {
		console.warn('[settings][addons] fetchAvailable failed:', e);
	}
}

async function checkAddonUpdates(forceRefresh = false) {
	try {
		const updates = await ipcRenderer.invoke('addons-check-updates', { forceRefresh });
		addonUpdates = updates || [];
		if (addonUpdates.length > 0) {
			console.log('[settings][addons] Updates available:', addonUpdates);
			renderInstalled();
		}
	} catch (e) {
		console.warn('[settings][addons] checkAddonUpdates failed:', e);
	}
}

async function initChannel() {
	try {
		currentChannel = await ipcRenderer.invoke('addons-get-channel');
		if (channelSelect) channelSelect.value = currentChannel;
	} catch (e) {
		console.warn('[settings][addons] Failed to get channel:', e);
	}
}

function bindEvents() {
	// Channel change
	if (channelSelect) {
		channelSelect.addEventListener('change', async () => {
			const newChannel = channelSelect.value;
			try {
				await ipcRenderer.invoke('addons-set-channel', { channel: newChannel });
				currentChannel = newChannel;
				await fetchAvailable(true);
				await checkAddonUpdates(true);
			} catch (e) {
				console.error('[settings][addons] Failed to set channel:', e);
				channelSelect.value = currentChannel;
			}
		});
	}

	// Installed addons actions
	listEl.addEventListener('click', async (e) => {
		const btn = e.target.closest('[data-action]');
		if (!btn) return;

		const action = btn.dataset.action;
		const addonId = btn.dataset.id;

		if (action === 'toggle') {
			const addon = installedAddons.find(a => a.id === addonId);
			if (!addon) return;

			btn.disabled = true;
			try {
				await ipcRenderer.invoke('addons-set-enabled', { addonId, enabled: !addon.enabled });
				addon.enabled = !addon.enabled;
				needsRestart = true;
				renderInstalled();
			} catch (e) {
				console.error('[settings][addons] toggle failed:', e);
			}
			btn.disabled = false;
		}

		if (action === 'uninstall') {
			if (!confirm(`Uninstall addon "${addonId}"?`)) return;

			btn.disabled = true;
			btn.textContent = 'Removing...';
			try {
				await ipcRenderer.invoke('addons-uninstall', { addonId });
				installedAddons = installedAddons.filter(a => a.id !== addonId);
				needsRestart = true;
				renderInstalled();
				renderAvailable();
			} catch (e) {
				console.error('[settings][addons] uninstall failed:', e);
				btn.textContent = 'Uninstall';
			}
			btn.disabled = false;
		}

		if (action === 'update') {
			const update = getUpdateForAddon(addonId);
			if (!update) return;

			btn.disabled = true;
			btn.textContent = 'Updating...';

			try {
				const result = await ipcRenderer.invoke('addons-update', { addonId });
				if (result.success) {
					addonUpdates = addonUpdates.filter(u => u.id !== addonId);
					needsRestart = true;
					const info = await ipcRenderer.invoke('addons-get-info');
					installedAddons = info.installed || [];
					renderInstalled();
					console.log('[settings][addons] Update complete, restart required');
				} else {
					alert(`Update failed: ${result.error || 'Unknown error'}`);
					btn.textContent = '⬆️ Update';
					btn.disabled = false;
				}
			} catch (e) {
				console.error('[settings][addons] update failed:', e);
				alert(`Update failed: ${e.message || e}`);
				btn.textContent = '⬆️ Update';
				btn.disabled = false;
			}
		}
	});

	// Available addons install
	if (availableEl) {
		availableEl.addEventListener('click', async (e) => {
			const btn = e.target.closest('[data-action="install"]');
			if (!btn) return;

			const addonId = btn.dataset.id;
			const downloadUrl = btn.dataset.url;

			btn.disabled = true;
			btn.textContent = 'Installing...';

			const card = btn.closest('.addon-card');
			let progressEl = card.querySelector('.addon-progress');
			if (!progressEl) {
				progressEl = document.createElement('div');
				progressEl.className = 'addon-progress';
				progressEl.innerHTML = '<div class="addon-progress-bar" style="width: 0%"></div>';
				card.appendChild(progressEl);
			}

			try {
				const result = await ipcRenderer.invoke('addons-install', { addonId, downloadUrl });

				if (result.success) {
					needsRestart = true;
					await loadAddons();
				} else {
					btn.textContent = 'Failed';
					setTimeout(() => { btn.textContent = 'Install'; btn.disabled = false; }, 2000);
				}
			} catch (e) {
				console.error('[settings][addons] install failed:', e);
				btn.textContent = 'Install';
				btn.disabled = false;
			}

			if (progressEl) progressEl.remove();
		});
	}

	// Refresh button
	if (refreshBtn) {
		refreshBtn.addEventListener('click', async () => {
			refreshBtn.disabled = true;
			refreshBtn.textContent = '⏳ Refreshing...';
			try {
				await fetchAvailable(true);
				await checkAddonUpdates(true);
				await loadAddons();
			} finally {
				refreshBtn.disabled = false;
				refreshBtn.textContent = '🔄 Refresh';
			}
		});
	}

	// Open folder button
	if (openFolderBtn) {
		openFolderBtn.addEventListener('click', async () => {
			try {
				const dir = await ipcRenderer.invoke('addons-get-dir');
				if (dir) {
					ipcRenderer.send('shell-open-path', dir);
				}
			} catch (e) {
				console.error('[settings][addons] openFolder failed:', e);
			}
		});
	}

	// Install progress
	ipcRenderer.on('addon-download-progress', (_e, data) => {
		const progressBars = document.querySelectorAll('.addon-progress-bar');
		progressBars.forEach(bar => {
			bar.style.width = (data.progress || 0) + '%';
		});
	});
}

function init() {
	cacheElements();
	if (!listEl) return;

	initChannel();
	bindEvents();
	loadAddons();
}

module.exports = { init };

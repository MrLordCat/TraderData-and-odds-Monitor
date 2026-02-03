// Game selector section
const { ipcRenderer } = require('electron');

function init() {
	const sel = document.getElementById('game-select');
	if (!sel) return;

	const VALID = new Set(['lol', 'cs2', 'dota2']);

	function applyInitial(v) {
		const game = VALID.has(v) ? v : 'lol';
		sel.value = game;
	}

	try {
		ipcRenderer.invoke('game-get').then(v => applyInitial(v)).catch(() => applyInitial('lol'));
	} catch (_) {
		applyInitial('lol');
	}

	sel.addEventListener('change', () => {
		const game = sel.value;
		if (!VALID.has(game)) return;
		try {
			ipcRenderer.send('game-set', { game });
		} catch (_) { }
	});
}

export { init };

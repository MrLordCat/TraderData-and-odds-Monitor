// Bootstrap for extracted modules
try { if(typeof initEmbeddedOdds==='function') initEmbeddedOdds(); } catch(_){ }
try { if(typeof initSectionReorder==='function') initSectionReorder(); } catch(_){ }

// Lightweight namespace to expose modules
window.gsStats = Object.assign({}, window.gsStats||{}, {
	version: '1.0-refactor-split',
	initEmbeddedOdds: typeof initEmbeddedOdds==='function'? initEmbeddedOdds: undefined,
	initSectionReorder: typeof initSectionReorder==='function'? initSectionReorder: undefined
});

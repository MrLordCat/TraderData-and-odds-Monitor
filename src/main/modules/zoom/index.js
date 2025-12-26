// Zoom management module extracting per-broker zoom logic from main.js
// Provides creation of a zoom manager that encapsulates zoom factors,
// persistence, indicator display, and input handlers.

module.exports.createZoomManager = function createZoomManager({ store, views }) {
  const zoomFactors = store.get('zoomFactors', {}); // id -> factor

  function persist() {
    try { store.set('zoomFactors', zoomFactors); } catch (e) {}
  }

  function apply(id) {
    const v = views[id]; if (!v) return;
    const z = zoomFactors[id] || 1;
    try { v.webContents.setZoomFactor(z); } catch (e) {}
  }

  function indicator(id) {
    const v = views[id]; if (!v) return;
    try { v.webContents.send('zoom-indicator', zoomFactors[id] || 1); } catch (e) {}
  }

  function adjust(id, delta) {
    const step = 0.1;
    let z = zoomFactors[id] || 1;
    if (delta < 0) z += step; else if (delta > 0) z -= step;
    z = Math.min(3, Math.max(0.5, parseFloat(z.toFixed(2))));
    zoomFactors[id] = z;
    apply(id);
    persist();
    indicator(id);
  }

  function reset(id) {
    zoomFactors[id] = 1;
    apply(id);
    persist();
    indicator(id);
  }

  function attachToView(view, id) {
    // Apply existing zoom factor when attaching
    apply(id);
    // Keyboard & wheel handlers
    view.webContents.on('before-input-event', (event, input) => {
      try {
        if ((input.control || input.meta)) {
          if (input.type === 'mouseWheel') {
            const dy = (input.deltaY ?? input.wheelTicksY ?? input.movementY ?? 0);
            if (dy !== 0) { event.preventDefault(); adjust(id, dy > 0 ? 1 : -1); }
          } else if (input.type === 'keyDown') {
            if (input.key === '=' || input.code === 'NumpadAdd' || input.key === '+') { event.preventDefault(); adjust(id, -1); }
            else if (input.key === '-' || input.code === 'NumpadSubtract') { event.preventDefault(); adjust(id, 1); }
            else if (input.key === '0') { event.preventDefault(); reset(id); }
          }
        }
      } catch (e) {}
    });
  }

  return { apply, adjust, reset, indicator, attachToView };
};

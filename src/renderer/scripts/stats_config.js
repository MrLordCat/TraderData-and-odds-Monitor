// Global stats configuration scaffold
// Central place for animation and heat bar tunables.
// Future: persist via IPC / store; for now runtime constants with simple setter API.

const DEFAULTS = {
  animationsEnabled: true,          // master switch (swap/reorder, future win/lose pulse, etc.)
  animationDurationMs: 450,         // base duration
  animationScale: 1.0,              // scale factor for size/intensity
  animationPrimaryColor: '#3b82f6', // primary accent color
  animationSecondaryColor: '#f59e0b', // secondary accent color
  heatBarOpacity: 0.55,             // opacity (0..1) applied to heat bar color overlay
  winLoseEnabled: true              // highlight winning values in stats table
};

const state = { ...DEFAULTS };
const listeners = new Set();

function emit() {
  listeners.forEach(fn => { try { fn(getPublic()); } catch (_) { } });
}

function set(part) {
  if (!part || typeof part !== 'object') return;
  let changed = false;
  Object.keys(part).forEach(k => {
    if (k in state && state[k] !== part[k]) {
      state[k] = part[k];
      changed = true;
    }
  });
  if (changed) {
    applyCssVars();
    emit();
  }
}

function getPublic() {
  return { ...state };
}

function applyCssVars() {
  try {
    const root = document.documentElement;
    root.style.setProperty('--gs-anim-enabled', state.animationsEnabled ? '1' : '0');
    root.style.setProperty('--gs-anim-dur', state.animationDurationMs + 'ms');
    root.style.setProperty('--gs-anim-scale', String(state.animationScale));
    root.style.setProperty('--gs-anim-color1', state.animationPrimaryColor);
    root.style.setProperty('--gs-anim-color2', state.animationSecondaryColor);
    root.style.setProperty('--gs-heatbar-alpha', String(state.heatBarOpacity));
    root.style.setProperty('--gs-winlose-enabled', state.winLoseEnabled ? '1' : '0');
  } catch (_) { }
}

// Initialize CSS vars
applyCssVars();

// Public API
export const StatsConfig = {
  get: getPublic,
  set,
  onChange(fn) {
    if (typeof fn === 'function') {
      listeners.add(fn);
      return () => listeners.delete(fn);
    }
    return () => {};
  },
  reset() {
    Object.assign(state, DEFAULTS);
    applyCssVars();
    emit();
  }
};

export default StatsConfig;

// Backward compatibility
if (typeof window !== 'undefined') {
  window.__STATS_CONFIG__ = StatsConfig;
}

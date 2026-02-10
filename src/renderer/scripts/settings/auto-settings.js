// Auto trading settings module (refactored)
const { ipcRenderer } = require('electron');

// ===== Slider config table =====
// Each entry: [stateKey, inputId, valueId, clampFn, suffix, parseType, ipcChannel, payloadKey]
const SLIDER_CONFIGS = [
  ['autoTolerancePct',        'auto-tolerance',        'auto-tolerance-val',        v => Math.max(0.5, Math.min(10, Math.round(v * 10) / 10)), '%',  'float', 'auto-tolerance-set',        'tolerancePct',  1.5,  v => v.toFixed(1) + '%'],
  ['autoIntervalMs',          'auto-interval',         'auto-interval-val',         v => Math.max(120, Math.min(2000, Math.floor(v))),          'ms', 'int',   'auto-interval-set',         'intervalMs',    500,  null],
  ['pulseStepPct',            'auto-pulse-step',       'auto-pulse-step-val',       v => Math.max(8, Math.min(15, Math.round(v))),              '%',  'int',   'auto-pulse-step-set',       'pct',           10,   null],
  ['autoSuspendThresholdPct', 'auto-suspend-threshold','auto-suspend-threshold-val',v => Math.max(15, Math.min(80, Math.round(v))),             '%',  'float', 'auto-suspend-threshold-set', 'pct',           40,   null],
  ['shockThresholdPct',       'auto-shock-threshold',  'auto-shock-threshold-val',  v => Math.max(40, Math.min(120, Math.round(v))),            '%',  'int',   'auto-shock-threshold-set',  'pct',           80,   null],
  ['fireCooldownMs',          'auto-fire-cooldown',    'auto-fire-cooldown-val',    v => Math.max(100, Math.min(3000, Math.floor(v))),          'ms', 'int',   'auto-fire-cooldown-set',    'ms',            900,  null],
  ['pulseGapMs',              'auto-pulse-gap',        'auto-pulse-gap-val',        v => Math.max(100, Math.min(1000, Math.floor(v))),          'ms', 'int',   'auto-pulse-gap-set',        'ms',            500,  null],
  ['suspendRetryDelayMs',     'auto-suspend-retry-delay','auto-suspend-retry-delay-val', v => Math.max(100, Math.min(700, Math.floor(v))),       'ms', 'int',   'auto-suspend-retry-delay-set','ms',          500,  null],
];

// Boolean toggle configs: [stateKey, inputId, ipcChannel, payloadKey, default]
const BOOL_CONFIGS = [
  ['stopOnNoMidEnabled',      'auto-stop-no-mid',   'auto-stop-no-mid-set',   'enabled', true],
  ['autoResumeOnMidEnabled',  'auto-resume-on-mid', 'auto-resume-on-mid-set', 'enabled', true],
];

// ===== State (dynamically populated) =====
const state = {};
SLIDER_CONFIGS.forEach(([key,,,,,,,,def]) => { state[key] = def; });
BOOL_CONFIGS.forEach(([key,,,,def]) => { state[key] = def; });

// ===== DOM elements cache =====
let elements = {};

function cacheElements() {
  elements = {};
  SLIDER_CONFIGS.forEach(([, inputId, valId]) => {
    elements[inputId] = document.getElementById(inputId);
    elements[valId] = document.getElementById(valId);
  });
  BOOL_CONFIGS.forEach(([, inputId]) => {
    elements[inputId] = document.getElementById(inputId);
  });
}

// ===== Render & bind via config =====
function renderSlider(cfg) {
  const [stateKey, inputId, valId, , suffix, , , , , customFmt] = cfg;
  try {
    const el = elements[inputId];
    const valEl = elements[valId];
    if (el) el.value = String(state[stateKey]);
    if (valEl) valEl.textContent = customFmt ? customFmt(state[stateKey]) : (state[stateKey] + suffix);
  } catch (_) { }
}

function bindEvents() {
  SLIDER_CONFIGS.forEach(cfg => {
    const [stateKey, inputId, , clamp, , parseType, ipcChannel, payloadKey] = cfg;
    const el = elements[inputId];
    if (!el) return;
    const parse = parseType === 'float' ? parseFloat : v => parseInt(v, 10);
    el.addEventListener('input', () => {
      const raw = parse(el.value);
      if (!isNaN(raw)) state[stateKey] = clamp(raw);
      renderSlider(cfg);
    });
    el.addEventListener('change', () => {
      const raw = parse(el.value);
      if (!isNaN(raw)) state[stateKey] = clamp(raw);
      renderSlider(cfg);
      try { ipcRenderer.send(ipcChannel, { [payloadKey]: state[stateKey] }); } catch (_) { }
    });
  });

  BOOL_CONFIGS.forEach(([stateKey, inputId, ipcChannel, payloadKey]) => {
    const el = elements[inputId];
    if (!el) return;
    el.addEventListener('change', () => {
      state[stateKey] = !!el.checked;
      try { ipcRenderer.send(ipcChannel, { [payloadKey]: state[stateKey] }); } catch (_) { }
    });
  });
}

// ===== Load from store =====
async function loadFromStore() {
  // Load sliders
  const sliderGetChannels = [
    'auto-tolerance-get', 'auto-interval-get', 'auto-pulse-step-get',
    'auto-suspend-threshold-get', 'auto-shock-threshold-get',
    'auto-fire-cooldown-get', 'auto-pulse-gap-get', 'auto-suspend-retry-delay-get'
  ];
  for (let i = 0; i < SLIDER_CONFIGS.length; i++) {
    const cfg = SLIDER_CONFIGS[i];
    const [stateKey, , , clamp] = cfg;
    try {
      const v = await ipcRenderer.invoke(sliderGetChannels[i]);
      if (typeof v === 'number' && !isNaN(v)) state[stateKey] = clamp(v);
    } catch (_) { }
    renderSlider(cfg);
  }

  // Load booleans
  const boolGetChannels = ['auto-stop-no-mid-get', 'auto-resume-on-mid-get'];
  for (let i = 0; i < BOOL_CONFIGS.length; i++) {
    const [stateKey, inputId, , , ] = BOOL_CONFIGS[i];
    try {
      const v = await ipcRenderer.invoke(boolGetChannels[i]);
      if (typeof v === 'boolean') state[stateKey] = v;
    } catch (_) { }
    const el = elements[inputId];
    if (el) el.checked = state[stateKey];
  }
}

// ===== Save all =====
function saveAll() {
  SLIDER_CONFIGS.forEach(([stateKey, , , , , , ipcChannel, payloadKey]) => {
    try { ipcRenderer.send(ipcChannel, { [payloadKey]: state[stateKey] }); } catch (_) { }
  });
  BOOL_CONFIGS.forEach(([stateKey, , ipcChannel, payloadKey]) => {
    try { ipcRenderer.send(ipcChannel, { [payloadKey]: state[stateKey] }); } catch (_) { }
  });
}

// ===== Init =====
function init() {
  cacheElements();
  bindEvents();
}

export { init, loadFromStore, saveAll };

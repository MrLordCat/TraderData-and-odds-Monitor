// Shared Odds Core
// ES module exporting OddsCore
// Provides:
//  - createOddsHub(): subscribe to odds-update and keep shared state
//  - computeDerivedFrom(records): compute hasMid/arb/mid from any records map
//  - When hub is started, updates window.__sharedDerived on each update (best-effort)

/**
 * Compute derived values (mid, arb) from odds records
 * @param {Object} records - Map of broker -> { broker, odds, frozen }
 * @returns {{ hasMid: boolean, arbProfitPct: number|null, mid: [number,number]|null }}
 */
export function computeDerivedFrom(records) {
  const global = typeof window !== 'undefined' ? window : {};
  const swapSet = global.__swappedBrokers;
  const isSwapped = (broker) => {
    try { return !!(swapSet && swapSet.has && swapSet.has(broker)); } catch (_) { return false; }
  };
  
  const vals = Object.values(records || {}).filter(r =>
    r && r.broker !== 'excel' && r.broker !== 'ds' && !r.frozen &&
    Array.isArray(r.odds) && r.odds.length === 2 &&
    r.odds.every(o => !isNaN(parseFloat(o)))
  );
  
  if (!vals.length) {
    return { hasMid: false, arbProfitPct: null, mid: null };
  }
  
  const s1 = vals.map(r => {
    const sw = isSwapped(r.broker);
    return parseFloat(sw ? r.odds[1] : r.odds[0]);
  });
  const s2 = vals.map(r => {
    const sw = isSwapped(r.broker);
    return parseFloat(sw ? r.odds[0] : r.odds[1]);
  });
  
  const mid1 = (Math.min(...s1) + Math.max(...s1)) / 2;
  const mid2 = (Math.min(...s2) + Math.max(...s2)) / 2;
  const over = 1 / Math.max(...s1) + 1 / Math.max(...s2);
  const arbProfitPct = (over < 1) ? (1 - over) * 100 : 0;
  
  return { hasMid: true, arbProfitPct, mid: [mid1, mid2] };
}

/**
 * Create an odds hub for subscribing to real-time odds updates
 * @returns {OddsHub}
 */
export function createOddsHub() {
  const global = typeof window !== 'undefined' ? window : {};
  
  const state = {
    records: {},
    swappedSets: new Set(),
    lastMap: null,
  };
  
  const subs = new Set();
  
  const notify = () => {
    subs.forEach(cb => { try { cb({ ...state }); } catch (_) { } });
    try { global.__sharedDerived = computeDerivedFrom(state.records); } catch (_) { }
  };
  
  function upsert(rec) {
    state.records[rec.broker] = rec;
    notify();
  }
  
  function remove(broker) {
    if (state.records[broker]) {
      delete state.records[broker];
      notify();
    }
  }
  
  function attach() {
    try {
      const handler = (p) => {
        try {
          if (!p || !p.broker) return;
          if (p.removed) { remove(p.broker); return; }
          let rec = p;
          if (!Array.isArray(rec.odds) || rec.odds.length < 2) {
            rec = { ...rec, odds: ['-', '-'], frozen: !!rec.frozen };
          }
          upsert(rec);
        } catch (_) { }
      };
      
      if (global.desktopAPI && global.desktopAPI.onOdds) {
        global.desktopAPI.onOdds(handler);
        // Broker close/sync via desktopAPI if present
        if (global.desktopAPI.onBrokerClosed) {
          global.desktopAPI.onBrokerClosed((id) => {
            try { if (id) { remove(id); } } catch (_) { }
          });
        }
        if (global.desktopAPI.onBrokersSync) {
          global.desktopAPI.onBrokersSync((ids) => {
            try {
              const set = new Set(ids || []);
              Object.keys(state.records).forEach(k => {
                if (k === 'excel' || k === 'ds') return;
                if (!set.has(k)) delete state.records[k];
              });
              notify();
            } catch (_) { }
          });
        }
      } else {
        const { ipcRenderer } = global.require ? global.require('electron') : {};
        if (ipcRenderer && ipcRenderer.on) {
          ipcRenderer.on('odds-update', (_e, p) => handler(p));
          ipcRenderer.on('broker-closed', (_e, p) => {
            try { const id = p && p.id; if (id) { remove(id); } } catch (_) { }
          });
          ipcRenderer.on('brokers-sync', (_e, p) => {
            try {
              const ids = (p && p.ids) || [];
              const set = new Set(ids);
              Object.keys(state.records).forEach(k => {
                if (k === 'excel' || k === 'ds') return;
                if (!set.has(k)) delete state.records[k];
              });
              notify();
            } catch (_) { }
          });
        }
      }
    } catch (_) { }
  }
  
  function start() { attach(); }
  
  return {
    start,
    subscribe(cb) {
      subs.add(cb);
      try { cb({ ...state }); } catch (_) { }
      return () => subs.delete(cb);
    },
    getState() { return { ...state }; },
    computeDerived: () => computeDerivedFrom(state.records),
  };
}

// Public API
const OddsCore = { createOddsHub, computeDerivedFrom };

// Default export for ES modules
export default OddsCore;

/**
 * OddsStore — reactive odds aggregator.
 * Subscribes to OddsCore hub, tracks all broker odds, derives MID/ARB.
 */

export function createOddsStore(OddsCore, global) {
  const subscribers = new Set();
  let state = {
    records: {},
    derived: { hasMid: false, mid: null, arbProfitPct: null },
  };
  let oddsHub = null;

  function init() {
    if (oddsHub) return;
    if (OddsCore && OddsCore.createOddsHub) {
      oddsHub = OddsCore.createOddsHub();
      oddsHub.subscribe(onOddsUpdate);
      oddsHub.start();
    }
    attachSwapSync();
  }

  function onOddsUpdate(hubState) {
    state.records = { ...hubState.records };
    computeDerived();
    notify();
  }

  function computeDerived() {
    if (OddsCore && OddsCore.computeDerivedFrom) {
      state.derived = OddsCore.computeDerivedFrom(state.records);
    } else {
      state.derived = { hasMid: false, mid: null, arbProfitPct: null };
    }
  }

  function attachSwapSync() {
    const apply = (list) => {
      if (!global.__swappedBrokers) global.__swappedBrokers = new Set();
      global.__swappedBrokers.clear();
      (list || []).forEach(b => {
        const v = String(b || '').trim();
        if (v) global.__swappedBrokers.add(v);
      });
      computeDerived();
      notify();
    };

    if (global.desktopAPI) {
      if (global.desktopAPI.onSwappedBrokersUpdated) {
        global.desktopAPI.onSwappedBrokersUpdated(apply);
      }
      if (global.desktopAPI.getSwappedBrokers) {
        global.desktopAPI.getSwappedBrokers().then(apply).catch(() => {});
      }
    } else if (global.require) {
      try {
        const { ipcRenderer } = global.require('electron');
        if (ipcRenderer) {
          ipcRenderer.on('swapped-brokers-updated', (_e, list) => apply(list));
          ipcRenderer.invoke('swapped-brokers-get').then(apply).catch(() => {});
        }
      } catch (_) {}
    }
  }

  function notify() {
    const snapshot = getSnapshot();
    subscribers.forEach(fn => { try { fn(snapshot); } catch (_) {} });
  }

  function getSnapshot() {
    return {
      records: state.records,
      derived: state.derived,
      excel: state.records['excel'] || null,
      ds: state.records['ds'] || null,
    };
  }

  function getMid() {
    const d = state.derived;
    if (d && d.hasMid && Array.isArray(d.mid) && d.mid.length === 2) {
      return d.mid;
    }
    return null;
  }

  function getExcelOdds() {
    const ex = state.records['excel'];
    if (ex && Array.isArray(ex.odds) && ex.odds.length === 2) {
      const n0 = parseFloat(ex.odds[0]);
      const n1 = parseFloat(ex.odds[1]);
      if (!isNaN(n0) && !isNaN(n1)) return [n0, n1];
    }
    return null;
  }

  function getDsOdds() {
    const ds = state.records['ds'];
    if (ds && Array.isArray(ds.odds) && ds.odds.length === 2) {
      const n0 = parseFloat(ds.odds[0]);
      const n1 = parseFloat(ds.odds[1]);
      if (!isNaN(n0) && !isNaN(n1)) return [n0, n1];
    }
    return null;
  }

  function isExcelFrozen() {
    const ex = state.records['excel'];
    return !!(ex && ex.frozen);
  }

  function subscribe(fn) {
    subscribers.add(fn);
    try { fn(getSnapshot()); } catch (_) {}
    return () => subscribers.delete(fn);
  }

  // Auto-init after OddsCore is ready
  setTimeout(init, 100);

  return {
    init,
    subscribe,
    getSnapshot,
    getMid,
    getExcelOdds,
    getDsOdds,
    isExcelFrozen,
  };
}

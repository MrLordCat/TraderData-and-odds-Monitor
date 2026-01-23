/**
 * Auto Mode Loader
 * 
 * Non-module entry point that loads all Auto Mode modules
 * and attaches them to window for use by existing code.
 * 
 * This file uses IIFE pattern (not ES modules) for compatibility
 * with existing script tag loading.
 */

(function(global) {
  'use strict';
  
  // ============ Constants ============
  
  const REASON = Object.freeze({
    MANUAL: 'manual',
    EXCEL_UNKNOWN: 'excel-unknown',
    EXCEL_OFF: 'excel-off',
    EXCEL_STARTING: 'excel-starting',
    EXCEL_INSTALLING: 'excel-installing',
    EXCEL_SUSPENDED: 'excel-suspended',
    EXCEL_NO_CHANGE: 'excel-no-change',
    NO_MID: 'no-mid',
    ARB_SPIKE: 'arb-spike',
    SHOCK: 'shock',
    DIFF_SUSPEND: 'diff-suspend',
    MAP_MISMATCH: 'map-mismatch',
    DS_NOT_CONNECTED: 'ds-not-connected',
    ALIGNING: 'aligning',
    ALIGN_FAILED: 'align-failed',
    EXCEL_RESUMED: 'excel-resumed',
    MARKET_RESUMED: 'market-resumed',
    DIFF_RESUMED: 'diff-resumed',
  });
  
  const STATE = Object.freeze({
    IDLE: 'idle',
    ALIGNING: 'aligning',
    TRADING: 'trading',
  });
  
  const MODE = Object.freeze({
    EXCEL: 'excel',
    DS: 'ds',
  });
  
  const DEFAULTS = Object.freeze({
    tolerancePct: 1.5,
    intervalMs: 500,
    pulseStepPct: 10,
    pulseGapMs: 500,
    maxPulses: 3,
    suspendThresholdPct: 40,
    shockThresholdPct: 80,
    arbSpikeThresholdPct: 80,
    alignmentThresholdPct: 15,
    fireCooldownMs: 900,
    confirmDelayMs: 100,
    alignmentTimeoutMs: 15000,
    alignmentCheckIntervalMs: 500,
    dsStepMs: 800,
    dsCooldownMs: 1200,
    dsCommitDelayMs: 200,
    confirmRetryDelayMs: 3000,
    f21RetryDelayMs: 1000,
  });
  
  const KEYS = Object.freeze({
    RAISE_SIDE0: 'F24',
    LOWER_SIDE0: 'F23',
    RAISE_SIDE1: 'F23',
    LOWER_SIDE1: 'F24',
    CONFIRM: 'F22',
    SIGNAL: 'F21',
  });
  
  const REASON_LABELS = Object.freeze({
    [REASON.MANUAL]: '',
    [REASON.EXCEL_UNKNOWN]: 'WAIT',
    [REASON.EXCEL_OFF]: 'SCRIPT',
    [REASON.EXCEL_STARTING]: 'START',
    [REASON.EXCEL_INSTALLING]: 'DEPS',
    [REASON.EXCEL_SUSPENDED]: 'SUSP',
    [REASON.EXCEL_NO_CHANGE]: 'STUCK',
    [REASON.NO_MID]: 'MID',
    [REASON.ARB_SPIKE]: 'ARB',
    [REASON.SHOCK]: 'SHOCK',
    [REASON.DIFF_SUSPEND]: 'DIFF',
    [REASON.MAP_MISMATCH]: 'MAP',
    [REASON.DS_NOT_CONNECTED]: 'DS',
    [REASON.ALIGNING]: 'ALIGN',
    [REASON.ALIGN_FAILED]: 'FAIL',
  });
  
  function getReasonLabel(reason) {
    if (!reason || reason === REASON.MANUAL) return '';
    return REASON_LABELS[reason] || reason.replace(/^excel-/, '').toUpperCase().slice(0, 6);
  }
  
  // ============ OddsStore ============
  
  const OddsStore = (function() {
    const subscribers = new Set();
    let state = {
      records: {},
      derived: { hasMid: false, mid: null, arbProfitPct: null },
    };
    let oddsHub = null;
    
    function init() {
      if (oddsHub) return;
      if (global.OddsCore && global.OddsCore.createOddsHub) {
        oddsHub = global.OddsCore.createOddsHub();
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
      if (global.OddsCore && global.OddsCore.computeDerivedFrom) {
        state.derived = global.OddsCore.computeDerivedFrom(state.records);
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
  })();
  
  // ============ GuardSystem ============
  
  const GuardSystem = (function() {
    let excelStatus = { running: null, starting: false, installing: false, error: null };
    let mapState = { scriptMap: null, boardMap: null };
    let dsState = { connected: false };
    let settings = {
      stopOnNoMid: true,
      shockThresholdPct: DEFAULTS.shockThresholdPct,
      suspendThresholdPct: DEFAULTS.suspendThresholdPct,
      tolerancePct: DEFAULTS.tolerancePct,
    };
    
    function checkGuards(oddsSnapshot, mode) {
      const result = { canTrade: true, reason: null, isHardBlock: false, isSoftSuspend: false, details: {} };
      
      // Excel process check (Excel mode only)
      if (mode === MODE.EXCEL) {
        if (excelStatus.running === null) {
          return { canTrade: false, reason: REASON.EXCEL_UNKNOWN, isHardBlock: true, isSoftSuspend: false, details: {} };
        }
        if (excelStatus.installing) {
          return { canTrade: false, reason: REASON.EXCEL_INSTALLING, isHardBlock: true, isSoftSuspend: false, details: {} };
        }
        if (excelStatus.starting) {
          return { canTrade: false, reason: REASON.EXCEL_STARTING, isHardBlock: true, isSoftSuspend: false, details: {} };
        }
        if (!excelStatus.running) {
          return { canTrade: false, reason: REASON.EXCEL_OFF, isHardBlock: true, isSoftSuspend: false, details: {} };
        }
      }
      
      // DS connection check (DS mode only)
      if (mode === MODE.DS && !dsState.connected) {
        return { canTrade: false, reason: REASON.DS_NOT_CONNECTED, isHardBlock: true, isSoftSuspend: false, details: {} };
      }
      
      // Map mismatch (Excel mode only)
      if (mode === MODE.EXCEL && mapState.scriptMap !== null && mapState.boardMap !== null) {
        const effectiveBoardMap = mapState.boardMap === 0 ? 1 : mapState.boardMap;
        if (mapState.scriptMap !== effectiveBoardMap) {
          return { canTrade: false, reason: REASON.MAP_MISMATCH, isHardBlock: true, isSoftSuspend: false, details: {} };
        }
      }
      
      // Excel frozen
      if (mode === MODE.EXCEL && oddsSnapshot.excel && oddsSnapshot.excel.frozen) {
        return { canTrade: false, reason: REASON.EXCEL_SUSPENDED, isHardBlock: false, isSoftSuspend: true, details: {} };
      }
      
      // No MID
      if (settings.stopOnNoMid && !oddsSnapshot.derived.hasMid) {
        return { canTrade: false, reason: REASON.NO_MID, isHardBlock: false, isSoftSuspend: true, details: {} };
      }
      
      // ARB spike
      const arbPct = oddsSnapshot.derived.arbProfitPct;
      if (typeof arbPct === 'number' && arbPct >= settings.shockThresholdPct) {
        return { canTrade: false, reason: REASON.ARB_SPIKE, isHardBlock: false, isSoftSuspend: true, details: { arbProfitPct: arbPct } };
      }
      
      return result;
    }
    
    function canResume(oddsSnapshot, mode, suspendReason) {
      switch (suspendReason) {
        case REASON.EXCEL_SUSPENDED:
          return mode === MODE.EXCEL ? !oddsSnapshot.excel?.frozen : !oddsSnapshot.ds?.frozen;
        case REASON.NO_MID:
          return oddsSnapshot.derived.hasMid;
        case REASON.ARB_SPIKE:
          const arbPct = oddsSnapshot.derived.arbProfitPct;
          return typeof arbPct !== 'number' || arbPct < DEFAULTS.alignmentThresholdPct;
        default:
          return false;
      }
    }
    
    function setExcelStatus(s) { excelStatus = { ...excelStatus, ...s }; }
    function setScriptMap(m) { mapState.scriptMap = (typeof m === 'number' && m >= 1 && m <= 5) ? m : null; }
    function setBoardMap(m) { mapState.boardMap = (typeof m === 'number' && m >= 0 && m <= 5) ? m : null; }
    function setDsConnected(c) { dsState.connected = !!c; }
    function setSettings(s) {
      if (typeof s.stopOnNoMid === 'boolean') settings.stopOnNoMid = s.stopOnNoMid;
      if (typeof s.shockThresholdPct === 'number') settings.shockThresholdPct = s.shockThresholdPct;
      if (typeof s.suspendThresholdPct === 'number') settings.suspendThresholdPct = s.suspendThresholdPct;
      if (typeof s.tolerancePct === 'number') settings.tolerancePct = s.tolerancePct;
    }
    function getExcelStatus() { return { ...excelStatus }; }
    
    return { checkGuards, canResume, setExcelStatus, setScriptMap, setBoardMap, setDsConnected, setSettings, getExcelStatus };
  })();
  
  // ============ AlignEngine ============
  
  function createAlignEngine(config) {
    const cfg = {
      tolerancePct: config?.tolerancePct ?? DEFAULTS.tolerancePct,
      pulseStepPct: config?.pulseStepPct ?? DEFAULTS.pulseStepPct,
      maxPulses: config?.maxPulses ?? DEFAULTS.maxPulses,
    };
    
    const state = { phase: STATE.IDLE, lastFireKey: null, lastFireSide: null, lastFireTs: 0 };
    
    function getKey(side, direction) {
      if (side === 0) return direction === 'raise' ? KEYS.RAISE_SIDE0 : KEYS.LOWER_SIDE0;
      return direction === 'raise' ? KEYS.RAISE_SIDE1 : KEYS.LOWER_SIDE1;
    }
    
    function computeAction(input) {
      if (!input.mid || !input.target) return { type: 'none' };
      
      const { mid, target } = input;
      const minSide = mid[0] <= mid[1] ? 0 : 1;
      const diffPct = Math.abs(target[minSide] - mid[minSide]) / mid[minSide] * 100;
      
      if (diffPct <= cfg.tolerancePct) return { type: 'none', aligned: true, diffPct };
      
      const direction = target[minSide] < mid[minSide] ? 'raise' : 'lower';
      const key = getKey(minSide, direction);
      const rawPulses = Math.floor(diffPct / cfg.pulseStepPct);
      const pulses = Math.max(1, Math.min(cfg.maxPulses, rawPulses));
      
      return { type: 'pulse', key, pulses, side: minSide, direction, diffPct };
    }
    
    function isOnCooldown(action, cooldownMs) {
      if (action.type !== 'pulse') return false;
      const elapsed = Date.now() - state.lastFireTs;
      if (state.lastFireSide === action.side && state.lastFireKey === action.key) {
        return elapsed < cooldownMs;
      }
      return false;
    }
    
    function recordFire(action) {
      if (action.type === 'pulse') {
        state.lastFireKey = action.key;
        state.lastFireSide = action.side;
        state.lastFireTs = Date.now();
      }
    }
    
    function setConfig(updates) {
      if (typeof updates.tolerancePct === 'number') cfg.tolerancePct = updates.tolerancePct;
      if (typeof updates.pulseStepPct === 'number') cfg.pulseStepPct = updates.pulseStepPct;
      if (typeof updates.maxPulses === 'number') cfg.maxPulses = updates.maxPulses;
    }
    
    function resetCooldown() {
      state.lastFireKey = null;
      state.lastFireSide = null;
      state.lastFireTs = 0;
    }
    
    function checkAlignment(input) {
      if (!input.mid || !input.target) return { aligned: false, diffPct: Infinity, side: 0 };
      const minSide = input.mid[0] <= input.mid[1] ? 0 : 1;
      const diffPct = Math.abs(input.target[minSide] - input.mid[minSide]) / input.mid[minSide] * 100;
      return { aligned: diffPct <= cfg.tolerancePct, diffPct, side: minSide };
    }
    
    return { computeAction, isOnCooldown, recordFire, setConfig, resetCooldown, checkAlignment, get state() { return { ...state }; }, getConfig: () => ({ ...cfg }) };
  }
  
  // ============ AutoCoordinator ============
  
  const AutoCoordinator = (function() {
    const state = { active: false, phase: STATE.IDLE, mode: MODE.EXCEL, reason: null, userWanted: false };
    const config = {
      tolerancePct: DEFAULTS.tolerancePct,
      intervalMs: DEFAULTS.intervalMs,
      pulseStepPct: DEFAULTS.pulseStepPct,
      pulseGapMs: DEFAULTS.pulseGapMs,
      fireCooldownMs: DEFAULTS.fireCooldownMs,
      confirmDelayMs: DEFAULTS.confirmDelayMs,
    };
    
    const engine = createAlignEngine({ tolerancePct: config.tolerancePct, pulseStepPct: config.pulseStepPct, maxPulses: DEFAULTS.maxPulses });
    const subscribers = new Set();
    let stepTimer = null;
    let alignmentTimer = null;
    let alignmentAttempts = 0;
    let lastStatus = '';
    
    function step() {
      if (!state.active) return;
      
      const odds = OddsStore.getSnapshot();
      const guardResult = GuardSystem.checkGuards(odds, state.mode);
      
      if (!guardResult.canTrade) {
        suspend(guardResult.reason, !guardResult.isHardBlock);
        return;
      }
      
      if (state.phase === STATE.IDLE && state.reason) {
        startAlignment();
        return;
      }
      
      const mid = OddsStore.getMid();
      const target = state.mode === MODE.EXCEL ? OddsStore.getExcelOdds() : OddsStore.getDsOdds();
      
      if (!mid || !target) {
        updateStatus('Нет данных');
        scheduleStep();
        return;
      }
      
      const action = engine.computeAction({ mid, target });
      
      if (action.type === 'none') {
        if (action.aligned) updateStatus('Aligned ✓');
        scheduleStep();
        return;
      }
      
      if (engine.isOnCooldown(action, config.fireCooldownMs)) {
        updateStatus('Cooldown...');
        scheduleStep();
        return;
      }
      
      if (action.type === 'pulse') {
        executeAction(action);
        updateStatus(`${action.direction} S${action.side + 1} ${action.diffPct.toFixed(1)}%`);
      }
      
      scheduleStep();
    }
    
    function scheduleStep(delayMs) {
      clearTimeout(stepTimer);
      if (!state.active) return;
      stepTimer = setTimeout(step, delayMs ?? config.intervalMs);
    }
    
    function executeAction(action) {
      if (action.type !== 'pulse') return;
      
      const { key, pulses, side, direction, diffPct } = action;
      
      for (let i = 0; i < pulses; i++) {
        const delay = i * config.pulseGapMs;
        setTimeout(() => sendKeyPress({ key, side, direction, diffPct, noConfirm: true }), delay);
      }
      
      const confirmDelay = (pulses - 1) * config.pulseGapMs + config.confirmDelayMs;
      setTimeout(() => sendKeyPress({ key: KEYS.CONFIRM, side, direction, diffPct, noConfirm: true }), confirmDelay);
      
      engine.recordFire(action);
    }
    
    function startAlignment() {
      state.phase = STATE.ALIGNING;
      state.reason = REASON.ALIGNING;
      alignmentAttempts = 0;
      updateStatus('Aligning...');
      notify();
      checkAlignmentProgress();
    }
    
    function checkAlignmentProgress() {
      if (state.phase !== STATE.ALIGNING) return;
      
      alignmentAttempts++;
      
      const mid = OddsStore.getMid();
      const target = state.mode === MODE.EXCEL ? OddsStore.getExcelOdds() : OddsStore.getDsOdds();
      
      if (!mid || !target) {
        if (alignmentAttempts < 30) {
          alignmentTimer = setTimeout(checkAlignmentProgress, DEFAULTS.alignmentCheckIntervalMs);
        } else {
          finishAlignment(false, 'timeout-nodata');
        }
        return;
      }
      
      const check = engine.checkAlignment({ mid, target });
      
      if (check.aligned) {
        finishAlignment(true, 'aligned');
      } else if (alignmentAttempts >= 30) {
        finishAlignment(true, 'timeout-forced');
      } else {
        step();
        alignmentTimer = setTimeout(checkAlignmentProgress, DEFAULTS.alignmentCheckIntervalMs);
      }
    }
    
    function finishAlignment(success, reason) {
      clearTimeout(alignmentTimer);
      
      if (success) {
        state.phase = STATE.TRADING;
        state.reason = null;
        updateStatus('Trading');
        sendSignal('market:resume');
        broadcastState(true);
      } else {
        state.phase = STATE.IDLE;
        state.reason = REASON.ALIGN_FAILED;
        updateStatus('Align failed: ' + reason);
      }
      
      notify();
    }
    
    function enable() {
      if (state.active) return true;
      
      const odds = OddsStore.getSnapshot();
      const guardResult = GuardSystem.checkGuards(odds, state.mode);
      
      if (guardResult.isHardBlock) {
        state.reason = guardResult.reason;
        updateStatus('Blocked: ' + guardResult.reason);
        notify();
        return false;
      }
      
      state.active = true;
      state.userWanted = true;
      state.reason = null;
      engine.resetCooldown();
      
      if (guardResult.canTrade) {
        state.phase = STATE.TRADING;
        updateStatus('Trading');
      } else {
        state.phase = STATE.IDLE;
      }
      
      notify();
      broadcastState(true);
      step();
      
      return true;
    }
    
    function disable() {
      if (!state.active && !state.userWanted) return;
      
      clearTimeout(stepTimer);
      clearTimeout(alignmentTimer);
      
      state.active = false;
      state.userWanted = false;
      state.phase = STATE.IDLE;
      state.reason = REASON.MANUAL;
      
      notify();
      broadcastState(false);
    }
    
    function toggle() {
      if (!state.active && state.userWanted) {
        disable();
        return;
      }
      
      if (state.active) disable();
      else enable();
    }
    
    function suspend(reason, canResumeFlag) {
      clearTimeout(stepTimer);
      clearTimeout(alignmentTimer);
      
      const wasActive = state.active;
      state.active = false;
      state.phase = STATE.IDLE;
      state.reason = reason;
      if (!canResumeFlag) state.userWanted = false;
      
      if (wasActive) {
        sendSignal(reason);
        broadcastState(false);
      }
      
      notify();
    }
    
    function setMode(mode) {
      if (mode !== MODE.EXCEL && mode !== MODE.DS) return;
      if (state.mode === mode) return;
      if (state.active) disable();
      state.mode = mode;
      notify();
    }
    
    function setConfig(updates) {
      if (typeof updates.tolerancePct === 'number') {
        config.tolerancePct = Math.max(1, Math.min(10, updates.tolerancePct));
        engine.setConfig({ tolerancePct: config.tolerancePct });
      }
      if (typeof updates.intervalMs === 'number') {
        config.intervalMs = Math.max(120, Math.min(10000, updates.intervalMs));
      }
      if (typeof updates.pulseStepPct === 'number') {
        config.pulseStepPct = Math.max(8, Math.min(15, updates.pulseStepPct));
        engine.setConfig({ pulseStepPct: config.pulseStepPct });
      }
      if (typeof updates.pulseGapMs === 'number') config.pulseGapMs = updates.pulseGapMs;
      if (typeof updates.fireCooldownMs === 'number') config.fireCooldownMs = updates.fireCooldownMs;
      if (typeof updates.stepMs === 'number') config.intervalMs = updates.stepMs;
      
      GuardSystem.setSettings({ tolerancePct: config.tolerancePct });
    }
    
    function sendKeyPress(payload) {
      try {
        if (global.desktopAPI && global.desktopAPI.invoke) {
          return global.desktopAPI.invoke('send-auto-press', payload);
        }
        if (global.require) {
          const { ipcRenderer } = global.require('electron');
          if (ipcRenderer && ipcRenderer.invoke) return ipcRenderer.invoke('send-auto-press', payload);
        }
      } catch (_) {}
    }
    
    function sendSignal(reason) {
      sendKeyPress({ key: KEYS.SIGNAL, direction: reason, noConfirm: true });
    }
    
    function broadcastState(active) {
      try {
        const payload = { on: active };
        if (global.desktopAPI && global.desktopAPI.send) {
          global.desktopAPI.send('auto-active-set', payload);
        } else if (global.require) {
          const { ipcRenderer } = global.require('electron');
          if (ipcRenderer && ipcRenderer.send) ipcRenderer.send('auto-active-set', payload);
        }
      } catch (_) {}
    }
    
    function updateStatus(msg) { lastStatus = msg; }
    
    function subscribe(fn) {
      subscribers.add(fn);
      try { fn(getState()); } catch (_) {}
      return () => subscribers.delete(fn);
    }
    
    function notify() {
      const snapshot = getState();
      subscribers.forEach(fn => { try { fn(snapshot); } catch (_) {} });
    }
    
    function getState() {
      return {
        active: state.active,
        phase: state.phase,
        mode: state.mode,
        reason: state.reason,
        userWanted: state.userWanted,
        status: lastStatus,
        config: { ...config },
        // Compatibility fields
        lastDisableReason: state.reason,
        tolerancePct: config.tolerancePct,
        stepMs: config.intervalMs,
      };
    }
    
    function attachExternalListeners() {
      // Excel extractor status
      if (global.desktopAPI) {
        if (global.desktopAPI.onExcelExtractorStatus) {
          global.desktopAPI.onExcelExtractorStatus(GuardSystem.setExcelStatus);
        }
        if (global.desktopAPI.getExcelExtractorStatus) {
          global.desktopAPI.getExcelExtractorStatus().then(GuardSystem.setExcelStatus).catch(() => {});
        }
      } else if (global.require) {
        try {
          const { ipcRenderer } = global.require('electron');
          if (ipcRenderer) {
            ipcRenderer.on('excel-extractor-status', (_e, s) => GuardSystem.setExcelStatus(s));
            ipcRenderer.invoke('excel-extractor-status-get').then(GuardSystem.setExcelStatus).catch(() => {});
          }
        } catch (_) {}
      }
      
      // Main process state commands
      if (global.desktopAPI) {
        if (global.desktopAPI.onAutoStateSet) {
          global.desktopAPI.onAutoStateSet(handleStateSet);
        }
        if (global.desktopAPI.onAutoToggleAll) {
          global.desktopAPI.onAutoToggleAll(() => toggle());
        }
        if (global.desktopAPI.onAutoActiveSet) {
          global.desktopAPI.onAutoActiveSet((p) => {
            const want = !!(p && p.on);
            if (want && !state.active) enable();
            else if (!want && state.active) suspend(REASON.MANUAL, false);
          });
        }
      } else if (global.require) {
        try {
          const { ipcRenderer } = global.require('electron');
          if (ipcRenderer) {
            ipcRenderer.on('auto-state-set', (_e, p) => handleStateSet(p));
            ipcRenderer.on('auto-toggle-all', () => toggle());
            ipcRenderer.on('auto-active-set', (_e, p) => {
              const want = !!(p && p.on);
              if (want && !state.active) enable();
              else if (!want && state.active) suspend(REASON.MANUAL, false);
            });
          }
        } catch (_) {}
      }
      
      // Settings updates
      attachSettingsListeners();
      
      // OddsStore reactive updates
      OddsStore.subscribe((odds) => {
        if (state.active || state.userWanted) {
          const guardResult = GuardSystem.checkGuards(odds, state.mode);
          
          if (state.active && !guardResult.canTrade) {
            suspend(guardResult.reason, !guardResult.isHardBlock);
          } else if (!state.active && state.userWanted && guardResult.canTrade) {
            if (GuardSystem.canResume(odds, state.mode, state.reason)) {
              startAlignment();
            }
          }
        }
      });
    }
    
    function handleStateSet(payload) {
      const want = !!(payload && payload.active);
      const isManual = !!(payload && payload.manual);
      
      if (isManual) {
        if (want) enable();
        else disable();
      } else {
        if (want && !state.active) enable();
        else if (!want && state.active) suspend(REASON.MANUAL, false);
      }
    }
    
    function attachSettingsListeners() {
      if (global.require) {
        try {
          const { ipcRenderer } = global.require('electron');
          if (!ipcRenderer) return;
          
          ipcRenderer.on('auto-tolerance-updated', (_e, v) => { if (typeof v === 'number') setConfig({ tolerancePct: v }); });
          ipcRenderer.on('auto-interval-updated', (_e, v) => { if (typeof v === 'number') setConfig({ intervalMs: v }); });
          ipcRenderer.on('auto-fire-cooldown-updated', (_e, v) => { if (typeof v === 'number') setConfig({ fireCooldownMs: v }); });
          ipcRenderer.on('auto-pulse-gap-updated', (_e, v) => { if (typeof v === 'number') setConfig({ pulseGapMs: v }); });
          ipcRenderer.on('auto-pulse-step-updated', (_e, v) => { if (typeof v === 'number') setConfig({ pulseStepPct: v }); });
          ipcRenderer.on('auto-stop-no-mid-updated', (_e, v) => { if (typeof v === 'boolean') GuardSystem.setSettings({ stopOnNoMid: v }); });
          ipcRenderer.on('auto-shock-threshold-updated', (_e, v) => { if (typeof v === 'number') GuardSystem.setSettings({ shockThresholdPct: v }); });
          ipcRenderer.on('auto-suspend-threshold-updated', (_e, v) => { if (typeof v === 'number') GuardSystem.setSettings({ suspendThresholdPct: v }); });
          
          // Initial fetch
          ipcRenderer.invoke('auto-tolerance-get').then(v => { if (typeof v === 'number') setConfig({ tolerancePct: v }); }).catch(() => {});
          ipcRenderer.invoke('auto-interval-get').then(v => { if (typeof v === 'number') setConfig({ intervalMs: v }); }).catch(() => {});
          ipcRenderer.invoke('auto-fire-cooldown-get').then(v => { if (typeof v === 'number') setConfig({ fireCooldownMs: v }); }).catch(() => {});
          ipcRenderer.invoke('auto-pulse-gap-get').then(v => { if (typeof v === 'number') setConfig({ pulseGapMs: v }); }).catch(() => {});
          ipcRenderer.invoke('auto-pulse-step-get').then(v => { if (typeof v === 'number') setConfig({ pulseStepPct: v }); }).catch(() => {});
          ipcRenderer.invoke('auto-stop-no-mid-get').then(v => { if (typeof v === 'boolean') GuardSystem.setSettings({ stopOnNoMid: v }); }).catch(() => {});
          ipcRenderer.invoke('auto-shock-threshold-get').then(v => { if (typeof v === 'number') GuardSystem.setSettings({ shockThresholdPct: v }); }).catch(() => {});
          ipcRenderer.invoke('auto-suspend-threshold-get').then(v => { if (typeof v === 'number') GuardSystem.setSettings({ suspendThresholdPct: v }); }).catch(() => {});
        } catch (_) {}
      }
    }
    
    // Initialize
    attachExternalListeners();
    
    return {
      getState,
      subscribe,
      enable,
      disable,
      toggle,
      setMode,
      getMode: () => state.mode,
      setConfig,
      getConfig: () => ({ ...config }),
      setScriptMap: GuardSystem.setScriptMap,
      setBoardMap: GuardSystem.setBoardMap,
      setDsConnected: GuardSystem.setDsConnected,
      setExcelStatus: GuardSystem.setExcelStatus,
      _engine: engine,
      _state: state,
    };
  })();
  
  // ============ Compatibility Layer (AutoHub / AutoCore shims) ============
  
  const AutoCore = {
    createAutoEngine: function(opts) {
      const callbacks = {
        flash: opts?.flash || function() {},
        status: opts?.status || function() {},
        onActiveChanged: opts?.onActiveChanged || function() {},
      };
      
      AutoCoordinator.subscribe((st) => {
        try { callbacks.onActiveChanged(st.active, st); } catch (_) {}
        try { if (st.status) callbacks.status(st.status); } catch (_) {}
      });
      
      return {
        get state() {
          const st = AutoCoordinator.getState();
          return {
            active: st.active,
            userWanted: st.userWanted,
            lastDisableReason: st.reason,
            tolerancePct: st.config.tolerancePct,
            stepMs: st.config.intervalMs,
            adaptive: true,
            burstLevels: [],
            burst3Enabled: true,
            excelNoChangeCount: 0,
          };
        },
        toggle: () => AutoCoordinator.toggle(),
        setActive: (on) => on ? AutoCoordinator.enable() : AutoCoordinator.disable(),
        schedule: () => {},
        step: () => {},
        setConfig: (cfg) => AutoCoordinator.setConfig(cfg),
      };
    }
  };
  
  const AutoHub = {
    attachView: function(id, ui) {
      AutoCoordinator.subscribe((st) => {
        try { if (ui.onActiveChanged) ui.onActiveChanged(st.active, st); } catch (_) {}
        try { if (ui.status && st.status) ui.status(st.status); } catch (_) {}
      });
      
      return {
        get state() {
          const st = AutoCoordinator.getState();
          return {
            active: st.active,
            userWanted: st.userWanted,
            lastDisableReason: st.reason,
            tolerancePct: st.config.tolerancePct,
            stepMs: st.config.intervalMs,
            adaptive: true,
            burstLevels: [],
          };
        },
        setConfig: (cfg) => AutoCoordinator.setConfig(cfg),
        setActive: (on) => on ? AutoCoordinator.enable() : AutoCoordinator.disable(),
        step: () => {},
        schedule: () => {},
      };
    },
    
    getState: () => OddsStore.getSnapshot(),
    
    getAutoEnableInfo: () => {
      const st = AutoCoordinator.getState();
      const excelStatus = GuardSystem.getExcelStatus();
      return {
        canEnable: !st.reason || st.reason === REASON.MANUAL,
        reasonCode: st.reason,
        excel: { running: excelStatus.running, starting: excelStatus.starting, installing: excelStatus.installing, error: excelStatus.error },
        ds: { enabled: st.mode === MODE.DS, connected: false },
        scriptMap: null,
        boardMap: null,
      };
    },
    
    setScriptMap: (m) => GuardSystem.setScriptMap(m),
    setBoardMap: (m) => GuardSystem.setBoardMap(m),
    setStopOnNoMid: (v) => GuardSystem.setSettings({ stopOnNoMid: v }),
    setAutoResumeOnMid: () => {},
    setDsAutoMode: (v) => AutoCoordinator.setMode(v ? MODE.DS : MODE.EXCEL),
    getDsAutoMode: () => AutoCoordinator.getMode() === MODE.DS,
    isDsConnected: () => false,
  };
  
  // ============ Attach to Window ============
  
  global.AutoConstants = { REASON, STATE, MODE, DEFAULTS, KEYS, REASON_LABELS, getReasonLabel };
  global.OddsStore = OddsStore;
  global.GuardSystem = GuardSystem;
  global.createAlignEngine = createAlignEngine;
  global.AutoCoordinator = AutoCoordinator;
  global.AutoCore = AutoCore;
  global.AutoHub = AutoHub;
  
  // ============ UI Initialization ============
  
  /**
   * Initialize Auto UI bindings for buttons and indicators.
   * Called automatically after DOM is ready.
   */
  function initAutoUI() {
    // Button ID patterns for board and embedded stats
    const uiConfigs = [
      { prefix: '', autoBtnId: 'autoBtn', excelModeId: 'excelModeBtn', dsModeId: 'dsModeBtn', reasonBadgeId: 'autoReasonBadge' },
      { prefix: 'embedded', autoBtnId: 'embeddedAutoBtn', excelModeId: 'embeddedExcelModeBtn', dsModeId: 'embeddedDsModeBtn', reasonBadgeId: 'embeddedAutoReason' },
    ];
    
    uiConfigs.forEach(cfg => {
      const autoBtn = document.getElementById(cfg.autoBtnId);
      const excelModeBtn = document.getElementById(cfg.excelModeId);
      const dsModeBtn = document.getElementById(cfg.dsModeId);
      const reasonBadge = document.getElementById(cfg.reasonBadgeId);
      
      // Auto button click handler
      if (autoBtn) {
        autoBtn.addEventListener('click', () => {
          AutoCoordinator.toggle();
        });
      }
      
      // Excel mode button click handler
      if (excelModeBtn) {
        excelModeBtn.addEventListener('click', () => {
          AutoCoordinator.setMode(MODE.EXCEL);
        });
      }
      
      // DS mode button click handler
      if (dsModeBtn) {
        dsModeBtn.addEventListener('click', () => {
          AutoCoordinator.setMode(MODE.DS);
        });
      }
    });
    
    // Subscribe to state changes and update all UI elements
    AutoCoordinator.subscribe((st) => {
      // Update window.__autoSim for backward compatibility with board.js
      global.__autoSim = {
        active: st.active,
        userWanted: st.userWanted,
        lastDisableReason: st.reason,
        tolerancePct: st.config.tolerancePct,
        stepMs: st.config.intervalMs,
      };
      
      // Update all Auto buttons
      ['autoBtn', 'embeddedAutoBtn'].forEach(id => {
        const btn = document.getElementById(id);
        if (!btn) return;
        
        btn.classList.remove('on', 'waiting');
        
        if (st.active) {
          btn.classList.add('on');
        } else if (st.userWanted && st.reason !== REASON.MANUAL) {
          const resumableReasons = [REASON.NO_MID, REASON.ARB_SPIKE, REASON.DIFF_SUSPEND, REASON.EXCEL_SUSPENDED, REASON.ALIGNING];
          if (resumableReasons.includes(st.reason)) {
            btn.classList.add('waiting');
          }
        }
      });
      
      // Update mode buttons
      const isExcelMode = st.mode === MODE.EXCEL;
      ['excelModeBtn', 'embeddedExcelModeBtn'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.classList.toggle('on', isExcelMode);
      });
      ['dsModeBtn', 'embeddedDsModeBtn'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.classList.toggle('on', !isExcelMode);
      });
      
      // Update reason badges
      ['autoReasonBadge', 'embeddedAutoReason'].forEach(id => {
        const badge = document.getElementById(id);
        if (!badge) return;
        
        const label = getReasonLabel(st.reason);
        badge.textContent = label;
        badge.title = st.reason || '';
        badge.style.display = label ? '' : 'none';
      });
      
      // Call legacy refresh function if exists
      if (typeof global.refreshAutoButtonsVisual === 'function') {
        try { global.refreshAutoButtonsVisual(); } catch (_) {}
      }
    });
    
    console.log('[auto_loader] UI initialized');
  }
  
  // Auto-init after DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAutoUI, { once: true });
  } else {
    setTimeout(initAutoUI, 0);
  }
  
  console.log('[auto_loader] Auto Mode loaded (new architecture)');
  
})(window);

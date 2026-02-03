/**
 * Auto Mode Loader
 * 
 * ES module that loads all Auto Mode modules.
 * 
 * This file is loaded as part of the bundle - imports OddsCore directly.
 */

import OddsCore from '../core/odds_core.js';

(function(global) {
  'use strict';
  
  // ============ Singleton Check ============
  // Only one instance of AutoCoordinator should send signals
  // Stats panel is the "master" that displays odds and sends signals
  // (Board is now virtual - embedded in stats_panel)
  const locationHref = (global.location && global.location.href) || '';
  const isStatsPanel = locationHref.includes('stats_panel.html') || locationHref.includes('stats_panel%2Ehtml');
  const isSettingsPage = locationHref.includes('settings.html') || locationHref.includes('settings%2Ehtml');
  // Stats panel is the signal sender (primary Auto controller)
  const isSignalSender = isStatsPanel;
  
  if (global.AutoCoordinator && global.AutoCoordinator._initialized) {
    return;
  }
  
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
    intervalMs: 1000,      // Step interval - should be >= fireCooldownMs to avoid wasted cycles
    pulseStepPct: 10,
    pulseGapMs: 500,
    maxPulses: 3,
    suspendThresholdPct: 40,
    shockThresholdPct: 80,
    arbSpikeThresholdPct: 80,
    alignmentThresholdPct: 15,
    fireCooldownMs: 900,   // Cooldown between pulses
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
  })();
  
  // ============ GuardSystem ============
  
  const GuardSystem = (function() {
    let excelStatus = { running: null, starting: false, installing: false, error: null };
    let mapState = { scriptMap: null, boardMap: null };
    let dsState = { connected: false };
    let settings = {
      stopOnNoMid: true,
      resumeOnMid: true,
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
      
      // Excel frozen - treated as USER-INITIATED suspend (user pressed ESC in Excel)
      // Auto should NOT auto-resume; user must manually re-enable Auto
      if (mode === MODE.EXCEL && oddsSnapshot.excel && oddsSnapshot.excel.frozen) {
        return { canTrade: false, reason: REASON.EXCEL_SUSPENDED, isHardBlock: false, isSoftSuspend: true, isUserSuspend: true, details: {} };
      }
      
      // No MID - blocks enable() but allows auto-resume when MID returns (if resumeOnMid enabled)
      // isHardBlock: true prevents enable() without MID
      // isSoftSuspend: true allows canResume() to work when MID returns
      if (settings.stopOnNoMid && !oddsSnapshot.derived.hasMid) {
        return { canTrade: false, reason: REASON.NO_MID, isHardBlock: true, isSoftSuspend: true, details: {} };
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
          // Only auto-resume if resumeOnMid setting is enabled
          return settings.resumeOnMid && oddsSnapshot.derived.hasMid;
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
      if (typeof s.resumeOnMid === 'boolean') settings.resumeOnMid = s.resumeOnMid;
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
      return elapsed < cooldownMs;
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
    
    function getLastFireTs() {
      return state.lastFireTs;
    }
    
    function checkAlignment(input) {
      if (!input.mid || !input.target) return { aligned: false, diffPct: Infinity, side: 0 };
      const minSide = input.mid[0] <= input.mid[1] ? 0 : 1;
      const diffPct = Math.abs(input.target[minSide] - input.mid[minSide]) / input.mid[minSide] * 100;
      return { aligned: diffPct <= cfg.tolerancePct, diffPct, side: minSide };
    }
    
    return { computeAction, isOnCooldown, recordFire, setConfig, resetCooldown, getLastFireTs, checkAlignment, get state() { return { ...state }; }, getConfig: () => ({ ...cfg }) };
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
    
    // Cooldown to prevent rapid suspend/resume cycling
    const SUSPEND_RESUME_COOLDOWN_MS = 3000;
    // Grace period after sending resume - ignore excel-suspended during this time
    const RESUME_GRACE_PERIOD_MS = 2000;
    let lastSuspendTs = 0;
    let lastResumeTs = 0;
    let lastResumeSentTs = 0; // When we sent market:resume signal
    // Track if user manually suspended (via UI/hotkey) - Auto should wait for user to resume
    let userSuspended = false;
    
    const engine = createAlignEngine({ tolerancePct: config.tolerancePct, pulseStepPct: config.pulseStepPct, maxPulses: DEFAULTS.maxPulses });
    const subscribers = new Set();
    let stepTimer = null;
    let alignmentTimer = null;
    let alignmentAttempts = 0;
    let lastStatus = '';
    // Guard against concurrent step() calls from multiple sources (timers, subscriptions)
    let isStepping = false;
    
    // === PULSE-WAIT MECHANISM ===
    // After sending a pulse, we wait for Excel odds to change before allowing next pulse
    // This prevents sending multiple pulses before Excel has time to react
    let waitingForExcelUpdate = false;
    let excelOddsBeforePulse = null;
    let waitStartTs = 0;
    const EXCEL_UPDATE_TIMEOUT_MS = 3000; // Max wait time for Excel to update
    const EXCEL_UPDATE_CHECK_INTERVAL_MS = 100; // How often to check for Excel update
    
    function startWaitingForExcelUpdate() {
      const currentExcel = OddsStore.getExcelOdds();
      excelOddsBeforePulse = currentExcel ? [...currentExcel] : null;
      waitingForExcelUpdate = true;
      waitStartTs = Date.now();
    }
    
    function checkExcelUpdated() {
      if (!waitingForExcelUpdate) return true;
      
      const elapsed = Date.now() - waitStartTs;
      if (elapsed > EXCEL_UPDATE_TIMEOUT_MS) {
        waitingForExcelUpdate = false;
        excelOddsBeforePulse = null;
        return true;
      }
      
      const currentExcel = OddsStore.getExcelOdds();
      if (!currentExcel || !excelOddsBeforePulse) {
        return false;
      }
      
      const changed = currentExcel[0] !== excelOddsBeforePulse[0] || currentExcel[1] !== excelOddsBeforePulse[1];
      if (changed) {
        waitingForExcelUpdate = false;
        excelOddsBeforePulse = null;
        return true;
      }
      
      return false;
    }

    function step() {
      if (!state.active) return;
      if (!isSignalSender) return;
      if (isStepping) return;
      isStepping = true;
      
      try {
      const odds = OddsStore.getSnapshot();
      
      // If aligning after NO_MID recovery:
      // - Allow step while Excel suspended (to align odds)
      // - BUT abort if MID disappears again
      // - Skip ALL other guard checks
      if (aligningAfterNoMid) {
        if (!odds.derived.hasMid) {
          aligningAfterNoMid = false;
          suspend(REASON.NO_MID, true, false);
          return;
        }
        // Continue step - skip guard checks entirely during NO_MID recovery alignment
      } else {
        const guardResult = GuardSystem.checkGuards(odds, state.mode);
        if (!guardResult.canTrade) {
          // Grace period after sending resume - ignore excel-suspended
          // This allows Excel time to process the resume signal
          const timeSinceResumeSent = Date.now() - lastResumeSentTs;
          if (guardResult.reason === REASON.EXCEL_SUSPENDED && timeSinceResumeSent < RESUME_GRACE_PERIOD_MS) {
            scheduleStep();
            return;
          }
          
          // Normal mode: check all guards
          // If guard indicates user-initiated suspend (e.g., Excel frozen from ESC),
          // treat it as user-initiated so Auto won't auto-resume
          const isUserSuspend = guardResult.isUserSuspend === true;
          // Pass canResume flag based on isSoftSuspend (true => can auto-resume)
          suspend(guardResult.reason, !!guardResult.isSoftSuspend, isUserSuspend);
          return;
        }
      }
      
      if (state.phase === STATE.IDLE && state.reason) {
        startAlignment();
        return;
      }
      
      const mid = OddsStore.getMid();
      const target = state.mode === MODE.EXCEL ? OddsStore.getExcelOdds() : OddsStore.getDsOdds();
      
      if (!mid || !target) {
        updateStatus('Нет данных');
        if (state.phase !== STATE.ALIGNING) scheduleStep();
        return;
      }
      
      const action = engine.computeAction({ mid, target });
      
      if (action.type === 'none') {
        if (action.aligned) updateStatus('Aligned ✓');
        if (state.phase !== STATE.ALIGNING) scheduleStep();
        return;
      }
      
      // === PULSE-WAIT: Check if we're still waiting for Excel to update from previous pulse ===
      if (!checkExcelUpdated()) {
        updateStatus('Waiting Excel...');
        if (state.phase !== STATE.ALIGNING) {
          scheduleStep(EXCEL_UPDATE_CHECK_INTERVAL_MS);
        }
        return;
      }
      
      if (engine.isOnCooldown(action, config.fireCooldownMs)) {
        updateStatus('Cooldown...');
        if (state.phase !== STATE.ALIGNING) scheduleStep();
        return;
      }
      
      if (action.type === 'pulse') {
        executeAction(action);
        startWaitingForExcelUpdate();
        updateStatus(`${action.direction} S${action.side + 1} ${action.diffPct.toFixed(1)}%`);
      }
      
      // During ALIGNING phase, checkAlignmentProgress manages the loop
      if (state.phase !== STATE.ALIGNING) scheduleStep();
      } finally {
        isStepping = false;
      }
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
        setTimeout(() => {
          sendKeyPress({ key, side, direction, diffPct, noConfirm: true });
        }, delay);
      }
      
      const confirmDelay = (pulses - 1) * config.pulseGapMs + config.confirmDelayMs;
      setTimeout(() => sendKeyPress({ key: KEYS.CONFIRM, side, direction, diffPct, noConfirm: true }), confirmDelay);
      
      engine.recordFire(action);
    }
    
    // Track if we should skip sending resume signal (user already did it)
    let pendingSkipResumeSignal = false;
    // Track if we're aligning after NO_MID recovery (allows alignment while Excel suspended)
    let aligningAfterNoMid = false;
    
    function startAlignment(skipResumeSignal = false, afterNoMid = false) {
      // Re-check guards before starting alignment
      const odds = OddsStore.getSnapshot();
      const guardResult = GuardSystem.checkGuards(odds, state.mode);
      
      // If recovering from NO_MID, we can align even if Excel is suspended
      // (we need to align odds before sending Resume)
      if (!guardResult.canTrade && !afterNoMid) {
        return;
      }
      
      // If afterNoMid but NO MID again, abort
      if (afterNoMid && !odds.derived.hasMid) {
        return;
      }
      
      pendingSkipResumeSignal = skipResumeSignal;
      aligningAfterNoMid = afterNoMid;
      state.active = true;
      state.phase = STATE.ALIGNING;
      state.reason = REASON.ALIGNING;
      alignmentAttempts = 0;
      
      // Reset cooldown to allow immediate alignment actions
      // This is critical for NO_MID recovery - old cooldown from before suspend
      // would otherwise block alignment progress
      engine.resetCooldown();
      
      updateStatus('Aligning...');
      notify();
      checkAlignmentProgress();
    }
    
    function checkAlignmentProgress() {
      if (state.phase !== STATE.ALIGNING) return;
      if (!state.active) {
        return;
      }
      
      // Re-check guards during alignment
      const odds = OddsStore.getSnapshot();
      const guardResult = GuardSystem.checkGuards(odds, state.mode);
      
      // If aligning after NO_MID recovery:
      // - Allow alignment while Excel suspended
      // - BUT abort if MID disappears again
      if (aligningAfterNoMid) {
        if (!odds.derived.hasMid) {
          aligningAfterNoMid = false;
          suspend(REASON.NO_MID, true, false);
          return;
        }
        // Continue alignment even if Excel suspended
      } else {
        // Normal alignment: check all guards
        if (!guardResult.canTrade) {
          const isUserSuspend = guardResult.isUserSuspend === true;
          suspend(guardResult.reason, !!guardResult.isSoftSuspend, isUserSuspend);
          return;
        }
      }
      
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
        // Use longer interval during alignment to respect cooldown
        // fireCooldownMs (900) + buffer ensures we don't spam step() during cooldown
        const alignInterval = Math.max(DEFAULTS.alignmentCheckIntervalMs, config.fireCooldownMs + 100);
        alignmentTimer = setTimeout(checkAlignmentProgress, alignInterval);
      }
    }
    
    function finishAlignment(success, reason) {
      clearTimeout(alignmentTimer);
      
      const wasAligningAfterNoMid = aligningAfterNoMid;
      aligningAfterNoMid = false;
      
      // Don't proceed if not active (was suspended during alignment)
      if (!state.active) {
        state.phase = STATE.IDLE;
        notify();
        return;
      }
      
      if (success) {
        state.phase = STATE.TRADING;
        state.reason = null;
        updateStatus('Trading');
        // Only send resume signal if not user-initiated resume
        if (!pendingSkipResumeSignal) {
          lastResumeSentTs = Date.now(); // Mark when we sent resume for grace period
          sendSignal('market:resume');
        } else {
        }
        pendingSkipResumeSignal = false;
        broadcastState(true);
        // Start the step loop!
        step();
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
      
      // Clear user-suspended flag when user explicitly enables
      userSuspended = false;
      lastResumeTs = Date.now();
      
      state.active = true;
      state.userWanted = true;
      state.reason = null;
      engine.resetCooldown();
      
      if (guardResult.canTrade) {
        state.phase = STATE.TRADING;
        updateStatus('Trading');
      } else {
        state.phase = STATE.IDLE;
        updateStatus('Waiting...');
      }
      
      notify();
      broadcastState(true);
      
      // Only start step loop if we can actually trade
      if (guardResult.canTrade) {
        step();
      }
      
      return true;
    }
    
    function disable() {
      if (!state.active && !state.userWanted && !userSuspended) return;
      
      clearTimeout(stepTimer);
      clearTimeout(alignmentTimer);
      
      state.active = false;
      state.userWanted = false;
      state.phase = STATE.IDLE;
      state.reason = REASON.MANUAL;
      userSuspended = false; // Clear suspend flag on full disable
      
      notify();
      broadcastState(false);
    }
    
    function toggle() {
      // If paused (not active but user wanted it), disable completely
      if (!state.active && state.userWanted) {
        disable();
        return;
      }
      
      // If paused due to userSuspended, also disable
      if (!state.active && userSuspended) {
        disable();
        return;
      }
      
      if (state.active) {
        disable();
      } else {
        enable();
      }
    }
    
    function suspend(reason, canResumeFlag, isUserInitiated = false) {
      // Already suspended - don't spam signals
      if (!state.active && state.reason === reason) {
        return;
      }
      
      // Prevent rapid cycling: don't suspend if we just resumed (unless user-initiated)
      const timeSinceResume = Date.now() - lastResumeTs;
      if (timeSinceResume < SUSPEND_RESUME_COOLDOWN_MS && !isUserInitiated && state.active) {
        return;
      }
      
      const wasActive = state.active;
      
      // Only proceed if we were actually active
      if (!wasActive) {
        // Just update reason if already suspended
        state.reason = reason;
        if (isUserInitiated) userSuspended = true;
        return;
      }
      
      clearTimeout(stepTimer);
      clearTimeout(alignmentTimer);
      
      state.active = false;
      state.phase = STATE.IDLE;
      state.reason = reason;
      
      // User-initiated suspend (e.g., pressed suspend hotkey/button)
      // Auto is PAUSED - waits for user to lift suspend (resume), then continues
      if (isUserInitiated) {
        userSuspended = true;
        // Keep userWanted = true! Auto will resume when user lifts suspend
        // DON'T send signal - user already did it themselves!
      } else {
        // Auto-initiated suspend (e.g., ARB spike, no MID)
        // Auto can self-resume when condition clears
        if (!canResumeFlag) {
          state.userWanted = false;
        } else {
        }
        // Send signal only for auto-initiated suspends
        sendSignal(reason);
      }
      
      lastSuspendTs = Date.now();
      
      broadcastState(false);
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
        // Update global compatibility object for tolerance badge
        if (global.__embeddedAutoSim) {
          global.__embeddedAutoSim.tolerancePct = config.tolerancePct;
        }
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
      if (!isSignalSender) return;
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
      // Only send signal once per reason change
      if (!isSignalSender) return;
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
    
    // Guard against re-entrant notify calls
    let isNotifying = false;
    function notify() {
      if (isNotifying) {
        console.warn('[AutoCoordinator] Re-entrant notify detected, skipping');
        return;
      }
      isNotifying = true;
      try {
        const snapshot = getState();
        subscribers.forEach(fn => { try { fn(snapshot); } catch (_) {} });
      } finally {
        isNotifying = false;
      }
    }
    
    function getState() {
      return {
        active: state.active,
        phase: state.phase,
        mode: state.mode,
        reason: state.reason,
        userWanted: state.userWanted,
        userSuspended, // For debugging: true if user manually suspended
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
            else if (!want && state.active) suspend(REASON.MANUAL, false, true); // User-initiated
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
              else if (!want && state.active) suspend(REASON.MANUAL, false, true); // User-initiated
            });
          }
        } catch (_) {}
      }
      
      // Settings updates
      attachSettingsListeners();
      
      // OddsStore reactive updates - ONLY for signal sender (board window)
      // Other windows only display state, they don't control Auto
      if (!isSignalSender) {
        return;
      }
      
      // OddsStore reactive updates with throttle to prevent spam
      let oddsThrottleTimer = null;
      const ODDS_THROTTLE_MS = 200;
      
      OddsStore.subscribe((odds) => {
        // Throttle the callback to prevent rapid-fire processing
        if (oddsThrottleTimer) return;
        oddsThrottleTimer = setTimeout(() => { oddsThrottleTimer = null; }, ODDS_THROTTLE_MS);
        
        if (!state.active && !state.userWanted) return;
        
        const guardResult = GuardSystem.checkGuards(odds, state.mode);
        
        if (state.active && !guardResult.canTrade) {
          // CRITICAL: Don't interrupt alignment after NO_MID recovery!
          // During this special alignment, Excel is still suspended (frozen),
          // but we need to complete alignment before sending Resume signal.
          if (aligningAfterNoMid) {
            // Only abort if MID disappears again
            if (!odds.derived.hasMid) {
              aligningAfterNoMid = false;
              suspend(REASON.NO_MID, true, false);
            }
            // Otherwise, let alignment continue - don't check other guards
            return;
          }
          
          // Grace period after sending resume - ignore excel-suspended
          const timeSinceResumeSent = Date.now() - lastResumeSentTs;
          if (guardResult.reason === REASON.EXCEL_SUSPENDED && timeSinceResumeSent < RESUME_GRACE_PERIOD_MS) {
            return;
          }
          
          // If guard indicates user-initiated suspend (e.g., Excel frozen from ESC),
          // treat it as user-initiated so Auto knows to wait for user to lift it
          const isUserSuspend = guardResult.isUserSuspend === true;
          suspend(guardResult.reason, !!guardResult.isSoftSuspend, isUserSuspend);
        } else if (!state.active && state.userWanted) {
          // Auto is paused but user wants it on - check if we can resume
          
          // SPECIAL CASE: Paused due to NO_MID and MID is back
          // We need to align odds WHILE Excel is suspended, then send Resume
          if (state.reason === REASON.NO_MID && odds.derived.hasMid) {
            const timeSinceSuspend = Date.now() - lastSuspendTs;
            
            if (timeSinceSuspend < SUSPEND_RESUME_COOLDOWN_MS) {
              return;
            }
            
            // Check resumeOnMid setting
            if (!GuardSystem.canResume(odds, state.mode, state.reason)) {
              return;
            }
            
            // Start alignment with afterNoMid=true - this allows alignment while Excel suspended
            // After alignment, Resume signal will be sent
            lastResumeTs = Date.now();
            startAlignment(false, true); // skipResumeSignal=false, afterNoMid=true
            return;
          }
          
          // Normal resume: guard conditions cleared
          if (guardResult.canTrade) {
            // Check cooldown first
            const timeSinceSuspend = Date.now() - lastSuspendTs;
            if (timeSinceSuspend < SUSPEND_RESUME_COOLDOWN_MS) {
              return;
            }
            
            // If user-suspended: user lifted the suspend (frozen → false), clear flag and resume
            // DON'T send market:resume signal - user already did it themselves!
            let skipResumeSignal = false;
            if (userSuspended) {
              userSuspended = false;
              skipResumeSignal = true; // User already sent resume
            }

            const canResumeNow = GuardSystem.canResume(odds, state.mode, state.reason);
            if (canResumeNow) {
              lastResumeTs = Date.now();
              startAlignment(skipResumeSignal);
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
        else if (!want && state.active) suspend(REASON.MANUAL, false, true); // User-initiated
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
          ipcRenderer.on('auto-resume-on-mid-updated', (_e, v) => { if (typeof v === 'boolean') GuardSystem.setSettings({ resumeOnMid: v }); });
          ipcRenderer.on('auto-shock-threshold-updated', (_e, v) => { if (typeof v === 'number') GuardSystem.setSettings({ shockThresholdPct: v }); });
          ipcRenderer.on('auto-suspend-threshold-updated', (_e, v) => { if (typeof v === 'number') GuardSystem.setSettings({ suspendThresholdPct: v }); });
          
          // Initial fetch
          ipcRenderer.invoke('auto-tolerance-get').then(v => { if (typeof v === 'number') setConfig({ tolerancePct: v }); }).catch(() => {});
          ipcRenderer.invoke('auto-interval-get').then(v => { if (typeof v === 'number') setConfig({ intervalMs: v }); }).catch(() => {});
          ipcRenderer.invoke('auto-fire-cooldown-get').then(v => { if (typeof v === 'number') setConfig({ fireCooldownMs: v }); }).catch(() => {});
          ipcRenderer.invoke('auto-pulse-gap-get').then(v => { if (typeof v === 'number') setConfig({ pulseGapMs: v }); }).catch(() => {});
          ipcRenderer.invoke('auto-pulse-step-get').then(v => { if (typeof v === 'number') setConfig({ pulseStepPct: v }); }).catch(() => {});
          ipcRenderer.invoke('auto-stop-no-mid-get').then(v => { if (typeof v === 'boolean') GuardSystem.setSettings({ stopOnNoMid: v }); }).catch(() => {});
          ipcRenderer.invoke('auto-resume-on-mid-get').then(v => { if (typeof v === 'boolean') GuardSystem.setSettings({ resumeOnMid: v }); }).catch(() => {});
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
    setAutoResumeOnMid: (v) => GuardSystem.setSettings({ resumeOnMid: v }),
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
  global.AutoCoordinator._initialized = true;
  global.AutoCore = AutoCore;
  global.AutoHub = AutoHub;
  
  // Compatibility: Create global object for tolerance badge (used by stats_embedded.js)
  // This object is kept in sync with AutoCoordinator state
  global.__embeddedAutoSim = { tolerancePct: DEFAULTS.tolerancePct };
  global.__autoSim = global.__embeddedAutoSim;
  
  // Update tolerance when config changes
  AutoCoordinator.subscribe((st) => {
    if (st.config && typeof st.config.tolerancePct === 'number') {
      global.__embeddedAutoSim.tolerancePct = st.config.tolerancePct;
    }
  });
  
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
    
  }
  
  // Auto-init after DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAutoUI, { once: true });
  } else {
    setTimeout(initAutoUI, 0);
  }
  
  
})(window);

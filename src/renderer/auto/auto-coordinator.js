/**
 * AutoCoordinator — state machine for Auto Trading.
 * States: idle → aligning → trading.
 */

import { REASON, STATE, MODE, DEFAULTS, KEYS } from './constants.js';
import { createAlignEngine } from './align-engine.js';

export function createAutoCoordinator({ OddsStore, GuardSystem, isSignalSender, global }) {
  const state = { active: false, phase: STATE.IDLE, mode: MODE.EXCEL, reason: null, userWanted: false };
  const config = {
    tolerancePct: DEFAULTS.tolerancePct,
    intervalMs: DEFAULTS.intervalMs,
    pulseStepPct: DEFAULTS.pulseStepPct,
    pulseGapMs: DEFAULTS.pulseGapMs,
    fireCooldownMs: DEFAULTS.fireCooldownMs,
    confirmDelayMs: DEFAULTS.confirmDelayMs,
  };

  const SUSPEND_RESUME_COOLDOWN_MS = 3000;
  const RESUME_GRACE_PERIOD_MS = 2000;
  let lastSuspendTs = 0;
  let lastResumeTs = 0;
  let lastResumeSentTs = 0;
  let userSuspended = false;

  const engine = createAlignEngine({ tolerancePct: config.tolerancePct, pulseStepPct: config.pulseStepPct, maxPulses: DEFAULTS.maxPulses });
  const subscribers = new Set();
  let stepTimer = null;
  let alignmentTimer = null;
  let alignmentAttempts = 0;
  let lastStatus = '';
  let isStepping = false;

  // === PULSE-WAIT MECHANISM ===
  let waitingForExcelUpdate = false;
  let excelOddsBeforePulse = null;
  let waitStartTs = 0;
  const EXCEL_UPDATE_TIMEOUT_MS = 3000;
  const EXCEL_UPDATE_CHECK_INTERVAL_MS = 100;

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
    if (!currentExcel || !excelOddsBeforePulse) return false;
    const changed = currentExcel[0] !== excelOddsBeforePulse[0] || currentExcel[1] !== excelOddsBeforePulse[1];
    if (changed) {
      waitingForExcelUpdate = false;
      excelOddsBeforePulse = null;
      return true;
    }
    return false;
  }

  // Track alignment after NO_MID recovery and skip-resume-signal flag
  let pendingSkipResumeSignal = false;
  let aligningAfterNoMid = false;

  function step() {
    if (!state.active) return;
    if (!isSignalSender) return;
    if (isStepping) return;
    isStepping = true;

    try {
      const odds = OddsStore.getSnapshot();

      if (aligningAfterNoMid) {
        if (!odds.derived.hasMid) {
          aligningAfterNoMid = false;
          suspend(REASON.NO_MID, true, false);
          return;
        }
      } else {
        const guardResult = GuardSystem.checkGuards(odds, state.mode);
        if (!guardResult.canTrade) {
          const timeSinceResumeSent = Date.now() - lastResumeSentTs;
          if (guardResult.reason === REASON.EXCEL_SUSPENDED && timeSinceResumeSent < RESUME_GRACE_PERIOD_MS) {
            scheduleStep();
            return;
          }
          const isUserSuspend = guardResult.isUserSuspend === true;
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

      if (!checkExcelUpdated()) {
        updateStatus('Waiting Excel...');
        if (state.phase !== STATE.ALIGNING) scheduleStep(EXCEL_UPDATE_CHECK_INTERVAL_MS);
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
      setTimeout(() => sendKeyPress({ key, side, direction, diffPct, noConfirm: true }), delay);
    }

    const confirmDelay = (pulses - 1) * config.pulseGapMs + config.confirmDelayMs;
    setTimeout(() => sendKeyPress({ key: KEYS.CONFIRM, side, direction, diffPct, noConfirm: true }), confirmDelay);

    engine.recordFire(action);
  }

  function startAlignment(skipResumeSignal = false, afterNoMid = false) {
    const odds = OddsStore.getSnapshot();
    const guardResult = GuardSystem.checkGuards(odds, state.mode);

    if (!guardResult.canTrade && !afterNoMid) return;
    if (afterNoMid && !odds.derived.hasMid) return;

    pendingSkipResumeSignal = skipResumeSignal;
    aligningAfterNoMid = afterNoMid;
    state.active = true;
    state.phase = STATE.ALIGNING;
    state.reason = REASON.ALIGNING;
    alignmentAttempts = 0;

    engine.resetCooldown();
    updateStatus('Aligning...');
    notify();
    checkAlignmentProgress();
  }

  function checkAlignmentProgress() {
    if (state.phase !== STATE.ALIGNING) return;
    if (!state.active) return;

    const odds = OddsStore.getSnapshot();
    const guardResult = GuardSystem.checkGuards(odds, state.mode);

    if (aligningAfterNoMid) {
      if (!odds.derived.hasMid) {
        aligningAfterNoMid = false;
        suspend(REASON.NO_MID, true, false);
        return;
      }
    } else {
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
      const alignInterval = Math.max(DEFAULTS.alignmentCheckIntervalMs, config.fireCooldownMs + 100);
      alignmentTimer = setTimeout(checkAlignmentProgress, alignInterval);
    }
  }

  function finishAlignment(success, reason) {
    clearTimeout(alignmentTimer);
    aligningAfterNoMid = false;

    if (!state.active) {
      state.phase = STATE.IDLE;
      notify();
      return;
    }

    if (success) {
      state.phase = STATE.TRADING;
      state.reason = null;
      updateStatus('Trading');
      if (!pendingSkipResumeSignal) {
        lastResumeSentTs = Date.now();
        sendSignal('market:resume');
      }
      pendingSkipResumeSignal = false;
      broadcastState(true);
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

    if (guardResult.canTrade) step();

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
    userSuspended = false;

    notify();
    broadcastState(false);
  }

  function toggle() {
    if (!state.active && state.userWanted) { disable(); return; }
    if (!state.active && userSuspended) { disable(); return; }
    if (state.active) disable(); else enable();
  }

  function suspend(reason, canResumeFlag, isUserInitiated = false) {
    if (!state.active && state.reason === reason) return;

    const timeSinceResume = Date.now() - lastResumeTs;
    if (timeSinceResume < SUSPEND_RESUME_COOLDOWN_MS && !isUserInitiated && state.active) return;

    const wasActive = state.active;

    if (!wasActive) {
      state.reason = reason;
      if (isUserInitiated) userSuspended = true;
      return;
    }

    clearTimeout(stepTimer);
    clearTimeout(alignmentTimer);

    state.active = false;
    state.phase = STATE.IDLE;
    state.reason = reason;

    if (isUserInitiated) {
      userSuspended = true;
    } else {
      if (!canResumeFlag) state.userWanted = false;
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
      if (global.__embeddedAutoSim) global.__embeddedAutoSim.tolerancePct = config.tolerancePct;
    }
    if (typeof updates.intervalMs === 'number') config.intervalMs = Math.max(120, Math.min(10000, updates.intervalMs));
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

  let isNotifying = false;
  function notify() {
    if (isNotifying) { console.warn('[AutoCoordinator] Re-entrant notify detected, skipping'); return; }
    isNotifying = true;
    try {
      const snapshot = getState();
      subscribers.forEach(fn => { try { fn(snapshot); } catch (_) {} });
    } finally { isNotifying = false; }
  }

  function getState() {
    return {
      active: state.active,
      phase: state.phase,
      mode: state.mode,
      reason: state.reason,
      userWanted: state.userWanted,
      userSuspended,
      status: lastStatus,
      config: { ...config },
      lastDisableReason: state.reason,
      tolerancePct: config.tolerancePct,
      stepMs: config.intervalMs,
    };
  }

  function handleStateSet(payload) {
    const want = !!(payload && payload.active);
    const isManual = !!(payload && payload.manual);
    if (isManual) { if (want) enable(); else disable(); }
    else { if (want && !state.active) enable(); else if (!want && state.active) suspend(REASON.MANUAL, false, true); }
  }

  // === External Listeners ===

  function attachExternalListeners() {
    // Excel extractor status
    if (global.desktopAPI) {
      if (global.desktopAPI.onExcelExtractorStatus) global.desktopAPI.onExcelExtractorStatus(GuardSystem.setExcelStatus);
      if (global.desktopAPI.getExcelExtractorStatus) global.desktopAPI.getExcelExtractorStatus().then(GuardSystem.setExcelStatus).catch(() => {});
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
      if (global.desktopAPI.onAutoStateSet) global.desktopAPI.onAutoStateSet(handleStateSet);
      if (global.desktopAPI.onAutoToggleAll) global.desktopAPI.onAutoToggleAll(() => toggle());
      if (global.desktopAPI.onAutoActiveSet) {
        global.desktopAPI.onAutoActiveSet((p) => {
          const want = !!(p && p.on);
          if (want && !state.active) enable();
          else if (!want && state.active) suspend(REASON.MANUAL, false, true);
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
            else if (!want && state.active) suspend(REASON.MANUAL, false, true);
          });
        }
      } catch (_) {}
    }

    // Settings
    attachSettingsListeners();

    // OddsStore reactive — only for signal sender
    if (!isSignalSender) return;

    let oddsThrottleTimer = null;
    const ODDS_THROTTLE_MS = 200;

    OddsStore.subscribe((odds) => {
      if (oddsThrottleTimer) return;
      oddsThrottleTimer = setTimeout(() => { oddsThrottleTimer = null; }, ODDS_THROTTLE_MS);

      if (!state.active && !state.userWanted) return;

      const guardResult = GuardSystem.checkGuards(odds, state.mode);

      if (state.active && !guardResult.canTrade) {
        if (aligningAfterNoMid) {
          if (!odds.derived.hasMid) {
            aligningAfterNoMid = false;
            suspend(REASON.NO_MID, true, false);
          }
          return;
        }

        const timeSinceResumeSent = Date.now() - lastResumeSentTs;
        if (guardResult.reason === REASON.EXCEL_SUSPENDED && timeSinceResumeSent < RESUME_GRACE_PERIOD_MS) return;

        const isUserSuspend = guardResult.isUserSuspend === true;
        suspend(guardResult.reason, !!guardResult.isSoftSuspend, isUserSuspend);
      } else if (!state.active && state.userWanted) {
        // NO_MID recovery with alignment
        if (state.reason === REASON.NO_MID && odds.derived.hasMid) {
          const timeSinceSuspend = Date.now() - lastSuspendTs;
          if (timeSinceSuspend < SUSPEND_RESUME_COOLDOWN_MS) return;
          if (!GuardSystem.canResume(odds, state.mode, state.reason)) return;
          lastResumeTs = Date.now();
          startAlignment(false, true);
          return;
        }

        // Normal resume
        if (guardResult.canTrade) {
          const timeSinceSuspend = Date.now() - lastSuspendTs;
          if (timeSinceSuspend < SUSPEND_RESUME_COOLDOWN_MS) return;

          let skipResumeSignal = false;
          if (userSuspended) {
            userSuspended = false;
            skipResumeSignal = true;
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

  function attachSettingsListeners() {
    if (!global.require) return;
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
}

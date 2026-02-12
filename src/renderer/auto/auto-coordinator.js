/**
 * AutoCoordinator — state machine for Auto Trading.
 * States: idle → aligning → trading.
 */

import { REASON, STATE, MODE, DEFAULTS, KEYS } from './constants.js';
import { createAlignEngine } from './align-engine.js';

/** Dual-path IPC: desktopAPI → fallback to require('electron') */
function ipcInvoke(g, ch, payload) {
  try {
    if (g.desktopAPI?.invoke) return g.desktopAPI.invoke(ch, payload);
    if (g.require) { const { ipcRenderer } = g.require('electron'); if (ipcRenderer?.invoke) return ipcRenderer.invoke(ch, payload); }
  } catch (_) {}
}
function ipcSend(g, ch, payload) {
  try {
    if (g.desktopAPI?.send) g.desktopAPI.send(ch, payload);
    else if (g.require) { const { ipcRenderer } = g.require('electron'); if (ipcRenderer?.send) ipcRenderer.send(ch, payload); }
  } catch (_) {}
}

export function createAutoCoordinator({ OddsStore, GuardSystem, isSignalSender, global }) {
  const state = { active: false, phase: STATE.IDLE, mode: MODE.EXCEL, reason: null, userWanted: false };
  const config = {
    tolerancePct: DEFAULTS.tolerancePct,
    pulseStepPct: DEFAULTS.pulseStepPct,
    confirmDelayMs: DEFAULTS.confirmDelayMs,
    suspendRetryDelayMs: DEFAULTS.suspendRetryDelayMs,
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
  let suspendRetryTimer = null;
  let alignmentAttempts = 0;
  let lastStatus = '';
  let isStepping = false;

  // === SMART PULSE-WAIT MECHANISM ===
  // Each pulse waits for Excel update (max 1s) before sending next pulse
  // This prevents overshoot by reacting to actual Excel speed

  function waitForExcelUpdate(timeoutMs) {
    return new Promise((resolve) => {
      const startOdds = OddsStore.getExcelOdds();
      const startSnapshot = startOdds ? [...startOdds] : null;
      const startTs = Date.now();
      
      const checkInterval = setInterval(() => {
        const elapsed = Date.now() - startTs;
        if (elapsed >= timeoutMs) {
          clearInterval(checkInterval);
          resolve(false);
          return;
        }
        
        const currentOdds = OddsStore.getExcelOdds();
        if (!currentOdds || !startSnapshot) {
          clearInterval(checkInterval);
          resolve(false);
          return;
        }
        
        const changed = currentOdds[0] !== startSnapshot[0] || currentOdds[1] !== startSnapshot[1];
        if (changed) {
          console.log('[AUTO] Excel ответил за', elapsed, 'ms');
          clearInterval(checkInterval);
          resolve(true);
        }
      }, 20);
    });
  }

  // Track alignment after NO_MID recovery and skip-resume-signal flag
  let pendingSkipResumeSignal = false;
  let aligningAfterNoMid = false;

  /** Shared guard check. Returns 'ok' | 'suspended' | 'grace' */
  function runGuardCheck(odds, opts) {
    if (aligningAfterNoMid && !odds.derived.hasMid) {
      aligningAfterNoMid = false;
      suspend(REASON.NO_MID, true, false);
      return 'suspended';
    }
    if (aligningAfterNoMid) return 'ok';
    const g = GuardSystem.checkGuards(odds, state.mode);
    if (!g.canTrade) {
      if (opts?.graceCheck && g.reason === REASON.EXCEL_SUSPENDED && (Date.now() - lastResumeSentTs) < RESUME_GRACE_PERIOD_MS) return 'grace';
      suspend(g.reason, !!g.isSoftSuspend, g.isUserSuspend === true);
      return 'suspended';
    }
    return 'ok';
  }

  async function step() {
    if (!state.active || !isSignalSender || isStepping) return;
    isStepping = true;

    try {
      const odds = OddsStore.getSnapshot();

      const gr = runGuardCheck(odds, { graceCheck: true });
      if (gr === 'suspended' || gr === 'grace') { if (gr === 'grace') scheduleStep(); return; }

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

      if (action.type === 'pulse') {
        updateStatus(`${action.direction} S${action.side + 1} ${action.diffPct.toFixed(1)}%`);
        await executeAction(action);
      }

      if (state.phase !== STATE.ALIGNING) scheduleStep();
    } finally {
      isStepping = false;
    }
  }

  function scheduleStep(delayMs) {
    clearTimeout(stepTimer);
    if (!state.active) return;
    stepTimer = setTimeout(step, delayMs ?? 0);
  }

  async function executeAction(action) {
    if (action.type !== 'pulse') return;
    const { key, pulses, side, direction, diffPct } = action;

    let sentPulses = 0;
    let lastPulseTs = 0;
    for (let i = 0; i < pulses; i++) {
      let attempts = 0;
      let excelUpdated = false;
      
      while (attempts < 3 && !excelUpdated) {
        attempts++;
        const nowTs = Date.now();
        if (lastPulseTs) console.log('[AUTO] Между пульсами:', nowTs - lastPulseTs, 'ms');
        lastPulseTs = nowTs;
        sendKeyPress({ key, side, direction, diffPct, noConfirm: true });
        sentPulses++;

        console.log('[AUTO] Pulse', sentPulses, '→ ждём Excel (попытка', attempts, '/3)...');
        excelUpdated = await waitForExcelUpdate(1000);

        if (!excelUpdated && attempts < 3) {
          console.log('[AUTO] Excel не ответил, повтор...');
        }
      }

      if (!excelUpdated) {
        autoLog('⚠️ Excel не отвечает после 3 попыток - отключение Auto');
        console.log('[AUTO] Excel не отвечает после 3 попыток — отключение');
        state.active = false;
        state.userWanted = false;
        setSuspendedByUser(false);
        setState(STATE.IDLE);
        broadcastState();
        return;
      }

      const mid = OddsStore.getMid();
      const target = state.mode === MODE.EXCEL ? OddsStore.getExcelOdds() : OddsStore.getDsOdds();
      if (mid && target) {
        const check = engine.checkAlignment({ mid, target });
        if (check.aligned) {
          autoLog(`✓ Aligned after ${sentPulses} pulse(s)`);
          break;
        }
      }
    }

    await new Promise(resolve => setTimeout(resolve, config.confirmDelayMs));
    sendKeyPress({ key: KEYS.CONFIRM, side, direction, diffPct, noConfirm: true });
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

    autoLog('⚙ ALIGNING' + (afterNoMid ? ' (after NO_MID)' : '') + (skipResumeSignal ? ' (skip resume signal)' : ''));
    updateStatus('Aligning...');
    notify();
    checkAlignmentProgress();
  }

  function checkAlignmentProgress() {
    if (state.phase !== STATE.ALIGNING) return;
    if (!state.active) return;

    const odds = OddsStore.getSnapshot();
    if (runGuardCheck(odds) === 'suspended') return;

    alignmentAttempts++;

    const mid = OddsStore.getMid();
    const target = state.mode === MODE.EXCEL ? OddsStore.getExcelOdds() : OddsStore.getDsOdds();

    if (!mid || !target) {
      if (alignmentAttempts < 30) {
        alignmentTimer = setTimeout(checkAlignmentProgress, 0);
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
      alignmentTimer = setTimeout(checkAlignmentProgress, 0);
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
      autoLog('✓ ALIGNED → TRADING (' + reason + ')');
      if (!pendingSkipResumeSignal) {
        lastResumeSentTs = Date.now();
        sendSignal('market:resume');
        // Backup: retry resume signal once if Excel stayed suspended
        scheduleSuspendRetry('resume', 'market:resume');
      }
      pendingSkipResumeSignal = false;
      broadcastState(true);
      step();
    } else {
      state.phase = STATE.IDLE;
      state.reason = REASON.ALIGN_FAILED;
      autoLog('✗ ALIGN FAILED (' + reason + ')');
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

    if (guardResult.canTrade) {
      state.phase = STATE.TRADING;
      updateStatus('Trading');
    } else {
      state.phase = STATE.IDLE;
      updateStatus('Waiting...');
    }

    autoLog('▶ ENABLE mode=' + state.mode + ' phase=' + state.phase);
    notify();
    broadcastState(true);

    if (guardResult.canTrade) step();

    return true;
  }

  function disable() {
    if (!state.active && !state.userWanted && !userSuspended) return;

    clearTimeout(stepTimer);
    clearTimeout(alignmentTimer);
    clearTimeout(suspendRetryTimer);

    state.active = false;
    state.userWanted = false;
    state.phase = STATE.IDLE;
    state.reason = REASON.MANUAL;
    userSuspended = false;

    autoLog('■ DISABLE manual');
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
      autoLog('⏸ SUSPEND user reason=' + reason);
    } else {
      if (!canResumeFlag) state.userWanted = false;
      autoLog('⏸ SUSPEND auto reason=' + reason);
      sendSignal(reason);
      // Backup: retry suspend signal once if Excel didn't react
      scheduleSuspendRetry('suspend', reason);
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
    if (typeof updates.pulseStepPct === 'number') {
      config.pulseStepPct = Math.max(8, Math.min(15, updates.pulseStepPct));
      engine.setConfig({ pulseStepPct: config.pulseStepPct });
    }
    if (typeof updates.suspendRetryDelayMs === 'number') config.suspendRetryDelayMs = Math.max(700, Math.min(1500, Math.floor(updates.suspendRetryDelayMs)));

    GuardSystem.setSettings({ tolerancePct: config.tolerancePct });
  }

  function sendKeyPress(payload) {
    if (!isSignalSender) return;
    return ipcInvoke(global, 'send-auto-press', payload);
  }

  function sendSignal(reason, isRetry = false) {
    if (!isSignalSender) return;
    autoLog('⌨ F21 signal=' + reason + (isRetry ? ' (RETRY)' : ''));
    sendKeyPress({ key: KEYS.SIGNAL, direction: reason, noConfirm: true, retry: isRetry });
  }

  /**
   * Backup retry: sends one repeat signal after delay if Excel didn't react.
   * @param {'suspend'|'resume'} type - suspend: expect excel.frozen=true; resume: expect frozen=false
   * @param {string} signalReason - direction string to resend
   */
  function scheduleSuspendRetry(type, signalReason) {
    clearTimeout(suspendRetryTimer);
    const delay = config.suspendRetryDelayMs ?? DEFAULTS.suspendRetryDelayMs;
    suspendRetryTimer = setTimeout(() => {
      try {
        const snap = OddsStore.getSnapshot();
        const frozen = !!snap?.excel?.frozen;
        if (type === 'suspend' && !frozen) {
          autoLog('⚠ backup retry: Excel NOT frozen → resend suspend');
          sendSignal(signalReason, true);
        } else if (type === 'resume' && frozen) {
          autoLog('⚠ backup retry: Excel STILL frozen → resend resume');
          sendSignal(signalReason, true);
        }
      } catch (_) { }
    }, delay);
  }

  function autoLog(msg) {
    try {
      const ts = new Date();
      const hms = String(ts.getHours()).padStart(2,'0') + ':' + String(ts.getMinutes()).padStart(2,'0') + ':' + String(ts.getSeconds()).padStart(2,'0');
      console.log('[Auto] ' + hms + ' ' + msg);
    } catch (_) { }
  }

  function broadcastState(active) {
    ipcSend(global, 'auto-active-set', { on: active });
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
    const handleActiveSet = (p) => {
      const want = !!(p && p.on);
      if (want && !state.active) enable();
      else if (!want && state.active) suspend(REASON.MANUAL, false, true);
    };

    if (global.desktopAPI) {
      if (global.desktopAPI.onExcelExtractorStatus) global.desktopAPI.onExcelExtractorStatus(GuardSystem.setExcelStatus);
      if (global.desktopAPI.getExcelExtractorStatus) global.desktopAPI.getExcelExtractorStatus().then(GuardSystem.setExcelStatus).catch(() => {});
      if (global.desktopAPI.onAutoStateSet) global.desktopAPI.onAutoStateSet(handleStateSet);
      if (global.desktopAPI.onAutoToggleAll) global.desktopAPI.onAutoToggleAll(() => toggle());
      if (global.desktopAPI.onAutoActiveSet) global.desktopAPI.onAutoActiveSet(handleActiveSet);
    } else if (global.require) {
      try {
        const { ipcRenderer } = global.require('electron');
        if (ipcRenderer) {
          ipcRenderer.on('excel-extractor-status', (_e, s) => GuardSystem.setExcelStatus(s));
          ipcRenderer.invoke('excel-extractor-status-get').then(GuardSystem.setExcelStatus).catch(() => {});
          ipcRenderer.on('auto-state-set', (_e, p) => handleStateSet(p));
          ipcRenderer.on('auto-toggle-all', () => toggle());
          ipcRenderer.on('auto-active-set', (_e, p) => handleActiveSet(p));
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
          autoLog('▷ RESUME attempt (NO_MID recovered, MID available)');
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
            autoLog('▷ RESUME attempt reason=' + (state.reason || 'none') + (skipResumeSignal ? ' (skip F21)' : ''));
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

      // Config settings: [updatedChannel, getChannel, type, handler]
      const configSettings = [
        ['auto-tolerance-updated',        'auto-tolerance-get',        'number',  v => setConfig({ tolerancePct: v })],
        ['auto-pulse-step-updated',       'auto-pulse-step-get',       'number',  v => setConfig({ pulseStepPct: v })],
        ['auto-stop-no-mid-updated',      'auto-stop-no-mid-get',      'boolean', v => GuardSystem.setSettings({ stopOnNoMid: v })],
        ['auto-resume-on-mid-updated',    'auto-resume-on-mid-get',    'boolean', v => GuardSystem.setSettings({ resumeOnMid: v })],
        ['auto-shock-threshold-updated',  'auto-shock-threshold-get',  'number',  v => GuardSystem.setSettings({ shockThresholdPct: v })],
        ['auto-suspend-threshold-updated','auto-suspend-threshold-get','number',  v => GuardSystem.setSettings({ suspendThresholdPct: v })],
        ['auto-suspend-retry-delay-updated','auto-suspend-retry-delay-get','number',  v => setConfig({ suspendRetryDelayMs: v })],
      ];
      configSettings.forEach(([updCh, getCh, type, handler]) => {
        ipcRenderer.on(updCh, (_e, v) => { if (typeof v === type) handler(v); });
        ipcRenderer.invoke(getCh).then(v => { if (typeof v === type) handler(v); }).catch(() => {});
      });
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

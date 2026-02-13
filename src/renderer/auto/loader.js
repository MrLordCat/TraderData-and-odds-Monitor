/**
 * Auto Mode Loader
 *
 * ES module entry point that wires together all Auto Mode sub-modules,
 * registers globals, sets up compat shims and UI hooks.
 */

import OddsCore from '../core/odds_core.js';
import { REASON, STATE, MODE, DEFAULTS, KEYS, REASON_LABELS, getReasonLabel } from './constants.js';
import { createOddsStore } from './odds-store.js';
import { createGuardSystem } from './guard-system.js';
import { createAlignEngine } from './align-engine.js';
import { createAutoCoordinator } from './auto-coordinator.js';

(function(global) {
  'use strict';

  // ============ Singleton Check ============
  const locationHref = (global.location && global.location.href) || '';
  const isStatsPanel = locationHref.includes('stats_panel.html') || locationHref.includes('stats_panel%2Ehtml');
  const isSignalSender = isStatsPanel;

  if (global.AutoCoordinator && global.AutoCoordinator._initialized) return;

  // ============ Instantiate Modules ============

  const OddsStore = createOddsStore(OddsCore, global);
  const GuardSystem = createGuardSystem();
  const AutoCoordinator = createAutoCoordinator({ OddsStore, GuardSystem, isSignalSender, global });

  // ============ Compatibility Layer (AutoHub shim) ============
  // AutoHub.setScriptMap / setBoardMap are used by excel_status.js

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
    isDsConnected: () => false, // actual state tracked by GuardSystem via ds-connected-changed IPC
  };

  // ============ Attach to Window ============

  global.AutoConstants = { REASON, STATE, MODE, DEFAULTS, KEYS, REASON_LABELS, getReasonLabel };
  global.OddsStore = OddsStore;
  global.GuardSystem = GuardSystem;
  global.createAlignEngine = createAlignEngine;
  global.AutoCoordinator = AutoCoordinator;
  global.AutoCoordinator._initialized = true;
  global.AutoHub = AutoHub;

  // Compatibility: tolerance badge (used by stats_embedded.js)
  global.__embeddedAutoSim = { tolerancePct: DEFAULTS.tolerancePct };
  global.__autoSim = global.__embeddedAutoSim;

  AutoCoordinator.subscribe((st) => {
    if (st.config && typeof st.config.tolerancePct === 'number') {
      global.__embeddedAutoSim.tolerancePct = st.config.tolerancePct;
    }
  });

  // ============ UI Initialization ============

  function initAutoUI() {
    const uiConfigs = [
      { autoBtnId: 'autoBtn', excelModeId: 'excelModeBtn', dsModeId: 'dsModeBtn', reasonBadgeId: 'autoReasonBadge' },
      { autoBtnId: 'embeddedAutoBtn', excelModeId: 'embeddedExcelModeBtn', dsModeId: 'embeddedDsModeBtn', reasonBadgeId: 'embeddedAutoReason' },
    ];

    uiConfigs.forEach(cfg => {
      const autoBtn = document.getElementById(cfg.autoBtnId);
      const excelModeBtn = document.getElementById(cfg.excelModeId);
      const dsModeBtn = document.getElementById(cfg.dsModeId);

      if (autoBtn) autoBtn.addEventListener('click', () => AutoCoordinator.toggle());
      if (excelModeBtn) excelModeBtn.addEventListener('click', () => AutoCoordinator.setMode(MODE.EXCEL));
      if (dsModeBtn) dsModeBtn.addEventListener('click', () => AutoCoordinator.setMode(MODE.DS));
    });

    AutoCoordinator.subscribe((st) => {
      global.__autoSim = {
        active: st.active,
        userWanted: st.userWanted,
        lastDisableReason: st.reason,
        tolerancePct: st.config.tolerancePct,
      };

      ['autoBtn', 'embeddedAutoBtn'].forEach(id => {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.classList.remove('on', 'waiting');
        if (st.active) {
          btn.classList.add('on');
        } else if (st.userWanted && st.reason !== REASON.MANUAL) {
          const resumableReasons = [REASON.NO_MID, REASON.ARB_SPIKE, REASON.DIFF_SUSPEND, REASON.EXCEL_SUSPENDED, REASON.ALIGNING];
          if (resumableReasons.includes(st.reason)) btn.classList.add('waiting');
        }
      });

      const isExcelMode = st.mode === MODE.EXCEL;
      ['excelModeBtn', 'embeddedExcelModeBtn'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.classList.toggle('on', isExcelMode);
      });
      ['dsModeBtn', 'embeddedDsModeBtn'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.classList.toggle('on', !isExcelMode);
      });

      ['autoReasonBadge', 'embeddedAutoReason'].forEach(id => {
        const badge = document.getElementById(id);
        if (!badge) return;
        const label = getReasonLabel(st.reason);
        badge.textContent = label;
        badge.title = st.reason || '';
        badge.style.display = label ? '' : 'none';
      });

      if (typeof global.refreshAutoButtonsVisual === 'function') {
        try { global.refreshAutoButtonsVisual(); } catch (_) {}
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAutoUI, { once: true });
  } else {
    setTimeout(initAutoUI, 0);
  }

})(window);

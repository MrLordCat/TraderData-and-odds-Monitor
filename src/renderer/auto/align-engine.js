/**
 * AlignEngine — computes alignment actions and manages cooldowns.
 */

import { STATE, KEYS, DEFAULTS } from './constants.js';

export function createAlignEngine(config) {
  const cfg = {
    tolerancePct: config?.tolerancePct ?? DEFAULTS.tolerancePct,
    pulseStepPct: config?.pulseStepPct ?? DEFAULTS.pulseStepPct,
    maxPulses: config?.maxPulses ?? DEFAULTS.maxPulses,
  };

  const state = { phase: STATE.IDLE, lastFireKey: null, lastFireSide: null, lastFireTs: 0, lastCooldownMs: DEFAULTS.fireCooldownMs };

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

    // Adaptive burst and cooldown based on diffPct to prevent overshoot (pendulum effect)
    // Large gap (>30%): 1 pulse, 2.5s cooldown — prevents Excel from overshooting when big diff
    // Medium gap (15-30%): 2 pulses, 1.5s cooldown
    // Small gap (<15%): use default maxPulses (3) and fireCooldownMs (900ms)
    let maxPulses = cfg.maxPulses;
    let cooldownMs = DEFAULTS.fireCooldownMs;

    if (diffPct > 30) {
      // Large gap: 1 pulse, long cooldown (2.5s)
      maxPulses = 1;
      cooldownMs = 2500;
    } else if (diffPct > 15) {
      // Medium gap: 2 pulses, medium cooldown (1.5s)
      maxPulses = 2;
      cooldownMs = 1500;
    }
    // else: small gap, use default maxPulses and cooldownMs from DEFAULTS

    const rawPulses = Math.floor(diffPct / cfg.pulseStepPct);
    const pulses = Math.max(1, Math.min(maxPulses, rawPulses));

    return { type: 'pulse', key, pulses, side: minSide, direction, diffPct, cooldownMs };
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
      if (action.cooldownMs) state.lastCooldownMs = action.cooldownMs;
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

  function getLastCooldownMs() {
    return state.lastCooldownMs;
  }

  function checkAlignment(input) {
    if (!input.mid || !input.target) return { aligned: false, diffPct: Infinity, side: 0 };
    const minSide = input.mid[0] <= input.mid[1] ? 0 : 1;
    const diffPct = Math.abs(input.target[minSide] - input.mid[minSide]) / input.mid[minSide] * 100;
    return { aligned: diffPct <= cfg.tolerancePct, diffPct, side: minSide };
  }

  return {
    computeAction,
    isOnCooldown,
    recordFire,
    setConfig,
    resetCooldown,
    getLastFireTs,
    getLastCooldownMs,
    checkAlignment,
    get state() { return { ...state }; },
    getConfig: () => ({ ...cfg }),
  };
}

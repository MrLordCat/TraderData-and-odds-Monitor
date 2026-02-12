/**
 * AlignEngine — computes alignment actions.
 */

import { STATE, KEYS, DEFAULTS } from './constants.js';

export function createAlignEngine(config) {
  const cfg = {
    tolerancePct: config?.tolerancePct ?? DEFAULTS.tolerancePct,
    pulseStepPct: config?.pulseStepPct ?? DEFAULTS.pulseStepPct,
    maxPulses: config?.maxPulses ?? DEFAULTS.maxPulses,
  };

  const state = { phase: STATE.IDLE };

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

  function setConfig(updates) {
    if (typeof updates.tolerancePct === 'number') cfg.tolerancePct = updates.tolerancePct;
    if (typeof updates.pulseStepPct === 'number') cfg.pulseStepPct = updates.pulseStepPct;
    if (typeof updates.maxPulses === 'number') cfg.maxPulses = updates.maxPulses;
  }

  function checkAlignment(input) {
    if (!input.mid || !input.target) return { aligned: false, diffPct: Infinity, side: 0 };
    const minSide = input.mid[0] <= input.mid[1] ? 0 : 1;
    const diffPct = Math.abs(input.target[minSide] - input.mid[minSide]) / input.mid[minSide] * 100;
    return { aligned: diffPct <= cfg.tolerancePct, diffPct, side: minSide };
  }

  return {
    computeAction,
    setConfig,
    checkAlignment,
    get state() { return { ...state }; },
    getConfig: () => ({ ...cfg }),
  };
}

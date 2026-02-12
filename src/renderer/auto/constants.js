/**
 * Auto Mode Constants
 * Shared constants for the Auto Trading system.
 */

export const REASON = Object.freeze({
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

export const STATE = Object.freeze({
  IDLE: 'idle',
  ALIGNING: 'aligning',
  TRADING: 'trading',
});

export const MODE = Object.freeze({
  EXCEL: 'excel',
  DS: 'ds',
});

export const DEFAULTS = Object.freeze({
  tolerancePct: 1.5,
  intervalMs: 200,
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
  alignmentCheckIntervalMs: 300,
  dsStepMs: 800,
  dsCooldownMs: 1200,
  dsCommitDelayMs: 200,
  confirmRetryDelayMs: 3000,
  f21RetryDelayMs: 1000,
  suspendRetryDelayMs: 800,
});

export const KEYS = Object.freeze({
  RAISE_SIDE0: 'F24',
  LOWER_SIDE0: 'F23',
  RAISE_SIDE1: 'F23',
  LOWER_SIDE1: 'F24',
  CONFIRM: 'F22',
  SIGNAL: 'F21',
});

export const REASON_LABELS = Object.freeze({
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

export function getReasonLabel(reason) {
  if (!reason || reason === REASON.MANUAL) return '';
  return REASON_LABELS[reason] || reason.replace(/^excel-/, '').toUpperCase().slice(0, 6);
}

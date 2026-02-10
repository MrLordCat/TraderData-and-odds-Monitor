/**
 * GuardSystem — unified guard logic for Auto Mode.
 * Priority: Excel > Market > Frozen > NoMID > ARB.
 */

import { REASON, MODE, DEFAULTS } from './constants.js';

export function createGuardSystem() {
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
    const hard = (reason) => ({ canTrade: false, reason, isHardBlock: true, isSoftSuspend: false, details: {} });
    const soft = (reason, extra) => ({ canTrade: false, reason, isHardBlock: false, isSoftSuspend: true, details: {}, ...extra });

    // Excel process check (Excel mode only)
    if (mode === MODE.EXCEL) {
      if (excelStatus.running === null) return hard(REASON.EXCEL_UNKNOWN);
      if (excelStatus.installing) return hard(REASON.EXCEL_INSTALLING);
      if (excelStatus.starting) return hard(REASON.EXCEL_STARTING);
      if (!excelStatus.running) return hard(REASON.EXCEL_OFF);
    }

    // DS connection check (DS mode only)
    if (mode === MODE.DS && !dsState.connected) return hard(REASON.DS_NOT_CONNECTED);

    // Map mismatch (Excel mode only)
    if (mode === MODE.EXCEL && mapState.scriptMap !== null && mapState.boardMap !== null) {
      const effectiveBoardMap = mapState.boardMap === 0 ? 1 : mapState.boardMap;
      if (mapState.scriptMap !== effectiveBoardMap) return hard(REASON.MAP_MISMATCH);
    }

    // Excel frozen - treated as USER-INITIATED suspend (user pressed ESC in Excel)
    if (mode === MODE.EXCEL && oddsSnapshot.excel && oddsSnapshot.excel.frozen) {
      return soft(REASON.EXCEL_SUSPENDED, { isUserSuspend: true });
    }

    // No MID
    if (settings.stopOnNoMid && !oddsSnapshot.derived.hasMid) return soft(REASON.NO_MID, { isHardBlock: true });

    // ARB spike
    const arbPct = oddsSnapshot.derived.arbProfitPct;
    if (typeof arbPct === 'number' && arbPct >= settings.shockThresholdPct) {
      return soft(REASON.ARB_SPIKE, { details: { arbProfitPct: arbPct } });
    }

    return { canTrade: true, reason: null, isHardBlock: false, isSoftSuspend: false, details: {} };
  }

  function canResume(oddsSnapshot, mode, suspendReason) {
    switch (suspendReason) {
      case REASON.EXCEL_SUSPENDED:
        return mode === MODE.EXCEL ? !oddsSnapshot.excel?.frozen : !oddsSnapshot.ds?.frozen;
      case REASON.NO_MID:
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
}

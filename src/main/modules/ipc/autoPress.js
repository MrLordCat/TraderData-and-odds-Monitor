// Auto-press IPC handlers extracted from main.js
// Handles send-auto-press, auto-mode-changed, auto-active-set, renderer-log-forward
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

function initAutoPressIpc({ ipcMain, app, broadcastToAll, getBroadcastCtx, __autoLast, __sendInputScriptPath, broadcastAutoToggleAll }) {
  if (!ipcMain) return;
  if (app.__autoPressHandlerRegistered) return;
  app.__autoPressHandlerRegistered = true;

  // Centralized de-duplication for F21 (suspend) presses across windows
  let __lastF21SentAt = 0;
  let __lastF21RetrySentAt = 0;
  // De-duplication for F23/F24 directional keys
  let __lastDirKeySentAt = 0;
  let __lastDirKeySig = '';
  const DIR_KEY_DEDUP_MS = 25;

  // Helper: write auto_press_signal.json for AHK
  const signalDir = path.resolve(__dirname, '..', '..');
  function writeAutoSignal(data) {
    try { fs.writeFileSync(path.join(signalDir, 'auto_press_signal.json'), JSON.stringify(data)); } catch (_) { }
  }

  ipcMain.handle('send-auto-press', (_e, payload) => {
    let side = 0;
    let vk = null;
    let keyLabel = null;
    let direction = null;
    let diffPct = null;
    let noConfirm = false;
    let isRetry = false;
    const ts = Date.now();

    if (typeof payload === 'number') {
      side = (payload === 1 ? 1 : 0);
    } else if (payload && typeof payload === 'object') {
      if (typeof payload.side === 'number') side = (payload.side === 1 ? 1 : 0);
      if (typeof payload.key === 'string') keyLabel = payload.key.toUpperCase();
      if (typeof payload.direction === 'string') direction = payload.direction;
      if (typeof payload.diffPct === 'number') diffPct = payload.diffPct;
      if (payload.noConfirm === true) noConfirm = true;
      if (payload.retry === true) isRetry = true;
    }

    // VK mapping: F21→0x84, F22→0x85, F23→0x86, F24→0x87
    if (keyLabel === 'F21') vk = 0x84;
    else if (keyLabel === 'F22') vk = 0x85;
    else if (keyLabel === 'F23') vk = 0x86;
    else if (keyLabel === 'F24') vk = 0x87;

    // Legacy side fallback when no explicit keyLabel
    if (vk == null && !keyLabel) {
      vk = side === 1 ? 0x87 : 0x86;
      keyLabel = side === 1 ? 'F24' : 'F23';
    }

    if (keyLabel === 'F22') { try { console.log('[auto-press][ipc] confirm request F22'); } catch (_) { } }

    // Normalize retry flag from direction suffix
    if (!isRetry && typeof direction === 'string' && direction.indexOf(':retry') !== -1) { isRetry = true; }

    // Global de-dup for F21 initial and retry
    if (keyLabel === 'F21') {
      const nowTs = Date.now();
      const initialWindowMs = 300;
      const retryWindowMs = 400;
      if (isRetry) {
        if (nowTs - __lastF21RetrySentAt < retryWindowMs) {
          try { console.log('[auto-press][ipc][dedupe] suppress F21 retry', { direction, ts: nowTs }); } catch (_) { }
          return true;
        }
        __lastF21RetrySentAt = nowTs;
      } else {
        if (nowTs - __lastF21SentAt < initialWindowMs) {
          try { console.log('[auto-press][ipc][dedupe] suppress F21 initial', { direction, ts: nowTs }); } catch (_) { }
          return true;
        }
        __lastF21SentAt = nowTs;
      }
    }

    // De-duplication for F23/F24/F22 directional/confirm keys
    if (keyLabel === 'F23' || keyLabel === 'F24' || keyLabel === 'F22') {
      const nowTs = Date.now();
      const sig = keyLabel + '|' + side + '|' + direction;
      if (sig === __lastDirKeySig && (nowTs - __lastDirKeySentAt) < DIR_KEY_DEDUP_MS) {
        return true;
      }
      __lastDirKeySig = sig;
      __lastDirKeySentAt = nowTs;
    }

    // Broadcast to all views
    try { broadcastToAll(getBroadcastCtx(), 'auto-press', { side, key: keyLabel, direction }); } catch (err) { try { console.warn('[auto-press][ipc] send fail', err); } catch (_) { } }

    // Always write file signal for AHK
    writeAutoSignal({ side, key: keyLabel, direction, ts });

    // SendInput via PowerShell helper script
    let sent = false;
    try {
      const injVk = vk;
      if (__sendInputScriptPath && injVk != null) {
        const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -File "${__sendInputScriptPath}" ${injVk}`;
        exec(cmd, (err) => {
          const dbg = { side, key: keyLabel, direction, diffPct, tsStart: ts, injVk, cmd, ok: !err, err: err ? err.message : null, tsDone: Date.now() };
          try { fs.writeFileSync(path.join(signalDir, 'auto_press_debug.json'), JSON.stringify(dbg)); } catch (_) { }
          if (err) { try { console.warn('[auto-press][ipc][si] FAIL', err.message); } catch (_) { } }
          else { try { console.log('[auto-press][ipc][si] SENT', keyLabel, 'injVk', injVk); } catch (_) { } }
        });
        sent = true;

        // AUTO CONFIRM: directional key (F23/F24) → schedule F22 after 100ms
        if (!noConfirm && (keyLabel === 'F23' || keyLabel === 'F24')) {
          const confirmDelayMs = 100;
          const confirmVk = 0x85; // F22
          setTimeout(() => {
            try {
              const confirmCmd = `powershell -NoProfile -ExecutionPolicy Bypass -File "${__sendInputScriptPath}" ${confirmVk}`;
              exec(confirmCmd, (cerr) => {
                const cdbg = { kind: 'confirm', parentKey: keyLabel, confirmKey: 'F22', confirmVk, confirmCmd, ok: !cerr, err: cerr ? cerr.message : null, tsParent: ts, tsDone: Date.now() };
                try { fs.writeFileSync(path.join(signalDir, 'auto_press_confirm_debug.json'), JSON.stringify(cdbg)); } catch (_) { }
                if (cerr) { try { console.warn('[auto-press][ipc][confirm] FAIL', cerr.message); } catch (_) { } }
                else { try { console.log('[auto-press][ipc][confirm] SENT F22 after', confirmDelayMs, 'ms'); } catch (_) { } }
              });
            } catch (e2) { try { console.warn('[auto-press][ipc][confirm] schedule error', e2.message); } catch (_) { } }
          }, confirmDelayMs);
        }
      }
    } catch (e) { try { console.warn('[auto-press][ipc][si] unavailable', e.message); } catch (_) { } }

    if (!sent) {
      writeAutoSignal({ side, key: keyLabel, direction, ts });
    }
    return true;
  });

  // Auto mode relay
  ipcMain.on('auto-mode-changed', (_e, payload) => {
    try { console.log('[autoSim][mode]', payload); } catch (_) { }
    try { broadcastToAll(getBroadcastCtx(), 'auto-set-all', { on: !!(payload && payload.active) }); } catch (_) { }
  });

  ipcMain.on('auto-fire-attempt', (_e, payload) => { try { console.log('[autoSim][fireAttempt]', payload); } catch (_) { } });

  // Store last auto states to serve late-loaded windows
  ipcMain.on('auto-active-set', (_e, p) => {
    try { __autoLast.active = !!(p && p.on); } catch (_) { }
    try { broadcastToAll(getBroadcastCtx(), 'auto-active-set', p); } catch (_) { }
  });

  ipcMain.handle('auto-state-get', () => ({ active: __autoLast.active }));

  // Forwarded renderer console lines (selective)
  ipcMain.on('renderer-log-forward', (_e, payload) => {
    try {
      if (!payload || !payload.level) return;
      const line = '[renderer][fwd][' + payload.level + '] ' + (payload.args ? payload.args.join(' ') : '');
      console[payload.level] ? console[payload.level](line) : console.log(line);
    } catch (err) { try { console.warn('[renderer-log-forward] fail', err.message); } catch (_) { } }
  });
}

module.exports = { initAutoPressIpc };

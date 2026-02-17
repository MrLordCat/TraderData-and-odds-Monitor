const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { shell } = require('electron');
const { broadcastGlobal } = require('./utils/broadcast');

function createExcelExtractorController({
  app,
  store,
  dialog,
  getMainWindow,
  getBoardWebContents,
  getStatsWebContentsList,
}) {
  const state = {
    excelProc: null,
    excelProcStarting: false,
    lastExcelStartTs: 0,
    excelProcError: null,
    excelDepsInstalling: false,

    // Hotkey controller process (excel_hotkey_controller.py)
    hotkeyProc: null,
    hotkeyProcError: null,

    // AHK is managed by the Python extractor. We only surface its status (from current_state.json).
    ahkStatus: { running: false, starting: false, error: null, pid: null, exe: 'python', script: null, cwd: null, lastStderr: null },
  };

  function short(s, max) {
    try {
      s = (s === undefined || s === null) ? '' : String(s);
      max = max || 220;
      if (s.length <= max) return s;
      return s.slice(0, max - 1) + '…';
    } catch (_) {
      return '';
    }
  }

  function broadcast(channel, payload) { broadcastGlobal(channel, payload); }

  // -------- Python executable auto-detection --------
  // Tries 'python', then 'py' (Windows Launcher), caches result.
  let _resolvedPythonExe = null;

  function resolvePythonExe() {
    // User override takes priority
    try {
      const pyOverride = store.get('excelPythonPath');
      if (pyOverride) return pyOverride;
    } catch (_) { }

    // Return cached result
    if (_resolvedPythonExe) return _resolvedPythonExe;

    for (const candidate of ['python', 'py']) {
      try {
        const result = spawnSync(candidate, ['--version'], { stdio: 'pipe', windowsHide: true, timeout: 5000 });
        if (result.status === 0 && !result.error) { _resolvedPythonExe = candidate; return candidate; }
      } catch (_) { }
    }

    // Nothing found, default to 'python' (will fail with descriptive error)
    _resolvedPythonExe = 'python';
    console.warn('[excel-extractor] Neither python nor py found, defaulting to python');
    return 'python';
  }

  function getAppRoot() {
    // This file lives under src/main/modules/, so three levels up is the app root.
    return path.resolve(__dirname, '..', '..', '..');
  }

  function getExcelExtractorDir() {
    return path.join(getAppRoot(), 'Excel Extractor');
  }

  function resolveScript(storeKey, candidates) {
    if (storeKey) {
      try { const c = store.get(storeKey); if (c && typeof c === 'string' && fs.existsSync(c.trim())) return c.trim(); } catch (_) { }
    }
    for (const p of candidates) { try { if (fs.existsSync(p)) return p; } catch (_) { } }
    return null;
  }

  function resolveExcelScriptPath() {
    const base = getExcelExtractorDir();
    return resolveScript('excelScriptPath', [
      path.join(base, 'excel_watcher.py'), path.join(base, 'excel-watcher.py'), path.join(base, 'excelWatcher.py'),
    ]);
  }

  function resolveHotkeyControllerPath() {
    const base = getExcelExtractorDir();
    return resolveScript(null, [
      path.join(base, 'excel_hotkey_controller.py'), path.join(base, 'excel-hotkey-controller.py'),
    ]);
  }

  // Проверка и установка pip зависимостей
  const REQUIRED_PACKAGES = ['pywin32', 'openpyxl', 'watchdog', 'keyboard'];
  let depsChecked = false;

  function checkAndInstallDeps(py, callback) {
    if (depsChecked) {
      callback(null);
      return;
    }

    state.excelDepsInstalling = true;
    broadcastExcelStatus();

    // Проверяем какие пакеты отсутствуют
    const checkScript = `
import sys
missing = []
try:
    import win32com.client
except ImportError:
    missing.append('pywin32')
try:
    import openpyxl
except ImportError:
    missing.append('openpyxl')
try:
    import watchdog
except ImportError:
    missing.append('watchdog')
try:
    import keyboard
except ImportError:
    missing.append('keyboard')
print('MISSING:' + ','.join(missing) if missing else 'OK')
`;

    const checkProc = spawn(py, ['-c', checkScript], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';

    checkProc.stdout.on('data', d => { stdout += d.toString(); });
    checkProc.stderr.on('data', d => { stderr += d.toString(); });

    checkProc.on('close', (code) => {
      const output = stdout.trim();
      
      if (output === 'OK') {
        depsChecked = true;
        state.excelDepsInstalling = false;
        broadcastExcelStatus();
        callback(null);
        return;
      }

      // Парсим отсутствующие пакеты
      const match = output.match(/MISSING:(.+)/);
      if (!match) {
        // Python не найден или ошибка
        console.warn('[excel-extractor] Failed to check dependencies:', stderr || output || 'unknown error');
        state.excelDepsInstalling = false;
        broadcastExcelStatus();
        callback(new Error('Failed to check Python dependencies'));
        return;
      }

      const missing = match[1].split(',').filter(p => p.trim());
      if (missing.length === 0) {
        depsChecked = true;
        state.excelDepsInstalling = false;
        broadcastExcelStatus();
        callback(null);
        return;
      }

      console.log('[excel-extractor] Installing missing packages:', missing.join(', '));

      // Устанавливаем отсутствующие пакеты
      const installArgs = ['-m', 'pip', 'install', '--upgrade', ...missing];
      const installProc = spawn(py, installArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
      
      let installOut = '';
      let installErr = '';
      installProc.stdout.on('data', d => { 
        installOut += d.toString();
      });
      installProc.stderr.on('data', d => { 
        installErr += d.toString();
      });

      installProc.on('close', (installCode) => {
        state.excelDepsInstalling = false;
        broadcastExcelStatus();

        if (installCode === 0) {
          console.log('[excel-extractor] Successfully installed:', missing.join(', '));
          depsChecked = true;
          callback(null);
        } else {
          const errMsg = installErr || installOut || 'pip install failed';
          console.warn('[excel-extractor] Failed to install packages:', errMsg);
          callback(new Error('pip install failed: ' + errMsg.slice(0, 200)));
        }
      });

      installProc.on('error', (err) => {
        state.excelDepsInstalling = false;
        broadcastExcelStatus();
        console.warn('[excel-extractor] pip spawn error:', err.message);
        callback(err);
      });
    });

    checkProc.on('error', (err) => {
      state.excelDepsInstalling = false;
      broadcastExcelStatus();
      console.warn('[excel-extractor] Python check spawn error:', err.message);
      callback(err);
    });
  }

  function readJsonSafe(filePath) {
    try { if (!fs.existsSync(filePath)) return null; return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch (_) { return null; }
  }

  function readAhkFromCurrentState() {
    try {
      let file;
      try { const custom = store.get('excelDumpPath'); file = (custom && typeof custom === 'string') ? custom : null; } catch (_) { }
      if (!file) file = path.join(getExcelExtractorDir(), 'current_state.json');
      const data = readJsonSafe(file);
      if (!data) return;
      const ahk = data.ahk;
      if (!ahk || typeof ahk !== 'object') return;
      state.ahkStatus = Object.assign({}, state.ahkStatus, {
        running: !!ahk.running, starting: false,
        error: ahk.error != null ? String(ahk.error) : null,
        pid: (ahk.pid != null && !isNaN(Number(ahk.pid))) ? Number(ahk.pid) : null,
        exe: 'python', script: ahk.script != null ? String(ahk.script) : null,
        managed: !!ahk.managed, cwd: null, lastStderr: null,
      });
    } catch (_) { }
  }

  const ahkPoll = setInterval(() => { try { readAhkFromCurrentState(); broadcastExcelStatus(); } catch (_) { } }, 1200);

  function readHotkeyStatus() {
    const data = readJsonSafe(path.join(getExcelExtractorDir(), 'hotkey_status.json'));
    if (!data) return null;
    return {
      currentMap: typeof data.currentMap === 'number' ? data.currentMap : null,
      maxMaps: typeof data.maxMaps === 'number' ? data.maxMaps : null,
      connected: !!data.connected, ts: data.ts || null,
    };
  }

  function buildStatusPayload(truncateStderr) {
    try { readAhkFromCurrentState(); } catch (_) { }
    const hs = readHotkeyStatus();
    return {
      running: !!state.excelProc, starting: !!state.excelProcStarting,
      error: state.excelProcError, installing: !!state.excelDepsInstalling,
      ahk: Object.assign({}, state.ahkStatus, truncateStderr ? { lastStderr: short(state.ahkStatus.lastStderr, 220) } : {}),
      hotkey: { running: !!state.hotkeyProc, error: state.hotkeyProcError },
      scriptMap: hs ? hs.currentMap : null, scriptMaxMaps: hs ? hs.maxMaps : null,
      scriptConnected: hs ? hs.connected : false,
    };
  }

  function broadcastExcelStatus() { broadcast('excel-extractor-status', buildStatusPayload(true)); }

  const PYTHON_ENV = { PYTHONUNBUFFERED: '1', PYTHONIOENCODING: 'utf-8' };
  function pySpawnEnv() { return Object.assign({}, process.env, PYTHON_ENV); }
  function abortStart(msg) { state.excelProcError = msg; state.excelProcStarting = false; broadcastExcelStatus(); }

  // Exit codes from excel_watcher.py for structured error handling
  const PY_EXIT_EXCEL_NOT_RUNNING = 2;
  const PY_EXIT_WORKBOOK_NOT_FOUND = 3;

  function startExcelExtractor() {
    if (state.excelProc || state.excelProcStarting || state.excelDepsInstalling) return;

    const now = Date.now();
    if (now - state.lastExcelStartTs < 1500) return;
    state.lastExcelStartTs = now;

    state.excelProcStarting = true;
    state.excelProcError = null;
    broadcastExcelStatus();

    try {
      const scriptPath = resolveExcelScriptPath();
      if (!scriptPath) {
        abortStart('excel_watcher.py not found in "Excel Extractor"');
        return;
      }

      const py = resolvePythonExe();

      // Сначала проверяем и устанавливаем зависимости
      checkAndInstallDeps(py, (depsErr) => {
        if (depsErr) {
          abortStart('Deps install failed: ' + depsErr.message);
          return;
        }

        // Продолжаем запуск после установки зависимостей
        startExcelExtractorAfterDeps(py, scriptPath);
      });

    } catch (err) {
      abortStart('Startup error: ' + (err && err.message ? err.message : String(err)));
    }
  }

  function startExcelExtractorAfterDeps(py, scriptPath) {
    try {
      // Resolve workbook path (persisted). If missing/invalid, ask user once.
      let workbookPath = null;
      try {
        const saved = store.get('excelWorkbookPath');
        if (saved && typeof saved === 'string') workbookPath = saved.trim();
      } catch (_) { }

      try {
        if (!workbookPath || !fs.existsSync(workbookPath)) {
          const mainWindow = getMainWindow && getMainWindow();
          const picked = dialog && dialog.showOpenDialogSync
            ? dialog.showOpenDialogSync(mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined, {
              title: 'Select Excel workbook for extractor',
              properties: ['openFile'],
              filters: [
                { name: 'Excel', extensions: ['xlsm', 'xlsx', 'xls'] },
                { name: 'All Files', extensions: ['*'] },
              ],
            })
            : null;

          if (!picked || !picked.length) {
            abortStart('Excel file not selected');
            return;
          }

          workbookPath = String(picked[0] || '').trim();
          if (!workbookPath) {
            abortStart('Excel file not selected');
            return;
          }

          store.set('excelWorkbookPath', workbookPath);
        }
      } catch (err) {
        abortStart('File picker failed: ' + (err && err.message ? err.message : String(err)));
        return;
      }

      const args = ['-u', scriptPath, '--file', workbookPath];
      const cwd = path.dirname(scriptPath);

      const spawnEnv = pySpawnEnv();

      state.excelProc = spawn(py, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], env: spawnEnv });
      console.log('[excel-extractor] spawned pid', state.excelProc.pid);

      state.excelProc.on('spawn', () => {
        state.excelProcStarting = false;
        broadcastExcelStatus();
      });

      // Ensure watcher aligns to Excel Extractor/current_state.json
      try {
        const dumpCandidate = path.join(getExcelExtractorDir(), 'current_state.json');
        const existingDump = store.get('excelDumpPath');
        const needReset = !existingDump || path.normalize(existingDump) !== path.normalize(dumpCandidate);
        if (needReset) {
          store.set('excelDumpPath', dumpCandidate);
        }
      } catch (_) { }

      let stderrBuf = '';
      let gotAnyOutput = false;
      const firstOutputTimer = setTimeout(() => {
        if (!gotAnyOutput && state.excelProc) {
          console.warn('[excel-extractor] no-output-first-4s: возможно скрипт ждёт Excel или не установлен pywin32');
        }
      }, 4000);

      function markOutput() {
        if (!gotAnyOutput) {
          gotAnyOutput = true;
          try { clearTimeout(firstOutputTimer); } catch (_) { }
        }
      }

      state.excelProc.stdout.on('data', d => {
        try {
          markOutput();
        } catch (_) { }
      });

      state.excelProc.stderr.on('data', d => {
        try {
          markOutput();
          stderrBuf += d.toString();
        } catch (_) { }
      });

      state.excelProc.on('exit', (code, sig) => {
        try { clearTimeout(firstOutputTimer); } catch (_) { }
        console.log('[excel-extractor] exit code', code, 'sig', sig || '');

        if (code && code !== 0) {
          if (/pywin32/i.test(stderrBuf)) state.excelProcError = 'pywin32 не установлен (pip install pywin32)';
          else state.excelProcError = 'Exit code ' + code;
        } else if (sig) {
          state.excelProcError = null;
        }

        state.excelProc = null;
        state.excelProcStarting = false;
        
        // Also stop hotkey controller when watcher exits
        stopHotkeyController();
        
        broadcastExcelStatus();

        // Excel not running or workbook not found → clear saved path, ask user to pick file and retry
        if (code === PY_EXIT_EXCEL_NOT_RUNNING || code === PY_EXIT_WORKBOOK_NOT_FOUND) {
          const reason = code === PY_EXIT_EXCEL_NOT_RUNNING
            ? 'Excel is not running.'
            : 'Workbook not found in Excel.';
          try { store.delete('excelWorkbookPath'); } catch (_) { }
          // Show file picker directly
          const mainWindow = getMainWindow && getMainWindow();
          const parent = mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined;
          const picked = dialog && dialog.showOpenDialogSync
            ? dialog.showOpenDialogSync(parent, {
                title: reason + ' Select Excel workbook:',
                properties: ['openFile'],
                filters: [
                  { name: 'Excel', extensions: ['xlsm', 'xlsx', 'xls'] },
                  { name: 'All Files', extensions: ['*'] },
                ],
              })
            : null;
          if (picked && picked.length) {
            const newPath = String(picked[0] || '').trim();
            if (newPath) {
              store.set('excelWorkbookPath', newPath);
              // Open the file in Excel (shell.openPath launches default app)
              shell.openPath(newPath).then(() => {
                // Wait for Excel to load the file, then restart watcher
                setTimeout(() => startExcelExtractor(), 3000);
              }).catch(() => {
                setTimeout(() => startExcelExtractor(), 3000);
              });
            }
          }
        }
      });

      // Start hotkey controller after watcher is running
      setTimeout(() => startHotkeyController(), 500);

      broadcastExcelStatus();
    } catch (err) {
      state.excelProcError = (err && err.message) ? err.message : String(err);
      state.excelProcStarting = false;
      state.excelProc = null;
      console.error('[excel-extractor] spawn failed', state.excelProcError);
      broadcastExcelStatus();
    }
  }

  function startHotkeyController() {
    if (state.hotkeyProc) return; // Already running

    const scriptPath = resolveHotkeyControllerPath();
    if (!scriptPath) {
      state.hotkeyProcError = 'excel_hotkey_controller.py not found';
      return;
    }

    const py = resolvePythonExe();

    const cwd = path.dirname(scriptPath);
    const args = ['-u', scriptPath];

    try {
      state.hotkeyProc = spawn(py, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], env: pySpawnEnv(), windowsHide: true });
      state.hotkeyProcError = null;

      state.hotkeyProc.stdout.on('data', () => {});
      state.hotkeyProc.stderr.on('data', () => {});

      state.hotkeyProc.on('exit', (code, sig) => {
        console.log('[excel-extractor][hotkey] exit code', code, 'sig', sig || '');
        state.hotkeyProc = null;
        if (code && code !== 0) {
          state.hotkeyProcError = 'Hotkey controller exit code ' + code;
        }
        // When hotkey controller exits (e.g., ESC pressed), also stop the watcher
        // This ensures proper cleanup and status update in the board
        if (state.excelProc) {
          console.log('[excel-extractor][hotkey] stopping watcher due to hotkey controller exit');
          stopExcelExtractor();
        }
        broadcastExcelStatus();
      });

    } catch (err) {
      console.error('[excel-extractor][hotkey] spawn failed', err && err.message ? err.message : String(err));
      state.hotkeyProcError = err && err.message ? err.message : String(err);
      state.hotkeyProc = null;
    }
  }

  function stopHotkeyController() {
    try {
      if (state.hotkeyProc) {
        state.hotkeyProc.kill();
        state.hotkeyProc = null;
      }
    } catch (_) { }
  }

  function stopExcelExtractor() {
    // Stop hotkey controller first
    stopHotkeyController();

    const rawPid = state.ahkStatus?.pid;
    const ahkPid = (rawPid != null && !isNaN(Number(rawPid))) ? Number(rawPid) : null;
    const ahkManaged = !!state.ahkStatus?.managed;

    try {
      if (state.excelProc) {
        state.excelProc.kill();
      }
    } catch (_) { }

    // On Windows, process termination may bypass Python atexit; best-effort stop AHK by PID.
    try {
      if (ahkPid) {
        spawn('taskkill', ['/PID', String(ahkPid), '/T', '/F'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      }
    } catch (_) { }

    // Fallback: if Python indicates it launched AHK but PID is unreliable, best-effort stop AutoHotkey by image name.
    try {
      if (!ahkPid && ahkManaged) {
        spawn('taskkill', ['/IM', 'AutoHotkey*.exe', '/T', '/F'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      }
    } catch (_) { }

    state.excelProc = null;
    state.excelProcStarting = false;
  }

  function toggle() {
    try {
      if (state.excelProc || state.excelProcStarting) {
        stopExcelExtractor();
      } else {
        startExcelExtractor();
      }
    } catch (_) { }
  }

  function setExcelScriptPath(p) {
    try {
      if (!p || typeof p !== 'string') return;
      const trimmed = p.trim();
      if (!trimmed) return;
      if (!fs.existsSync(trimmed)) return;
      store.set('excelScriptPath', trimmed);
      if (!state.excelProc) startExcelExtractor();
      else broadcastExcelStatus();
    } catch (err) {
      console.warn('[excel-extractor] set-path error', err && err.message ? err.message : String(err));
    }
  }

  function getStatus() { return buildStatusPayload(false); }

  function dispose() {
    try { clearInterval(ahkPoll); } catch (_) { }
    try { stopExcelExtractor(); } catch (_) { }
  }

  // Initial status broadcast (keeps UI consistent on fresh load)
  setTimeout(() => {
    try { broadcastExcelStatus(); } catch (_) { }
  }, 500);

  // Safety: stop children on app quit.
  try {
    if (app && app.on) {
      app.on('before-quit', () => {
        try { stopExcelExtractor(); } catch (_) { }
      });
    }
  } catch (_) { }

  return {
    start: startExcelExtractor,
    stop: stopExcelExtractor,
    toggle,
    getStatus,
    setExcelScriptPath,
    broadcastExcelStatus,
    dispose,
  };
}

module.exports = { createExcelExtractorController };

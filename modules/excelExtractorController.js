const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

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

  function broadcast(channel, payload) {
    try {
      const mainWindow = getMainWindow && getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        try { mainWindow.webContents.send(channel, payload); } catch (_) { }
      }
    } catch (_) { }

    try {
      const bwc = getBoardWebContents && getBoardWebContents();
      if (bwc && !bwc.isDestroyed()) {
        try { bwc.send(channel, payload); } catch (_) { }
      }
    } catch (_) { }

    try {
      const list = getStatsWebContentsList ? getStatsWebContentsList() : [];
      (list || []).forEach(wc => {
        try {
          if (wc && !wc.isDestroyed()) wc.send(channel, payload);
        } catch (_) { }
      });
    } catch (_) { }
  }

  function excelLog() {
    const msg = Array.from(arguments)
      .map(a => {
        if (a instanceof Error) return a.stack || a.message;
        if (typeof a === 'object') {
          try { return JSON.stringify(a); } catch (_) { return String(a); }
        }
        return String(a);
      })
      .join(' ');

    try { console.log('[excel-extractor][log]', msg); } catch (_) { }
    broadcast('excel-extractor-log', { ts: Date.now(), msg });
  }

  function getAppRoot() {
    // This file lives under modules/, so parent is the app root.
    return path.resolve(__dirname, '..');
  }

  function getExcelExtractorDir() {
    return path.join(getAppRoot(), 'Excel Extractor');
  }

  function resolveExcelScriptPath() {
    try {
      const custom = store.get('excelScriptPath');
      if (custom && typeof custom === 'string' && fs.existsSync(custom.trim())) return custom.trim();
    } catch (_) { }

    const base = getExcelExtractorDir();
    const candidates = [
      path.join(base, 'excel_watcher.py'),
      path.join(base, 'excel-watcher.py'),
      path.join(base, 'excelWatcher.py'),
    ];
    for (const p of candidates) {
      try { if (fs.existsSync(p)) return p; } catch (_) { }
    }
    return null;
  }

  function resolveHotkeyControllerPath() {
    const base = getExcelExtractorDir();
    const candidates = [
      path.join(base, 'excel_hotkey_controller.py'),
      path.join(base, 'excel-hotkey-controller.py'),
    ];
    for (const p of candidates) {
      try { if (fs.existsSync(p)) return p; } catch (_) { }
    }
    return null;
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
    excelLog('Checking Python dependencies...');

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
        excelLog('All Python dependencies are installed');
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
        excelLog('Failed to check dependencies:', stderr || output || 'unknown error');
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

      excelLog('Installing missing packages:', missing.join(', '));

      // Устанавливаем отсутствующие пакеты
      const installArgs = ['-m', 'pip', 'install', '--upgrade', ...missing];
      const installProc = spawn(py, installArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
      
      let installOut = '';
      let installErr = '';
      installProc.stdout.on('data', d => { 
        installOut += d.toString();
        excelLog('[pip]', d.toString().trim());
      });
      installProc.stderr.on('data', d => { 
        installErr += d.toString();
      });

      installProc.on('close', (installCode) => {
        state.excelDepsInstalling = false;
        broadcastExcelStatus();

        if (installCode === 0) {
          excelLog('Successfully installed:', missing.join(', '));
          depsChecked = true;
          callback(null);
        } else {
          const errMsg = installErr || installOut || 'pip install failed';
          excelLog('Failed to install packages:', errMsg);
          callback(new Error('pip install failed: ' + errMsg.slice(0, 200)));
        }
      });

      installProc.on('error', (err) => {
        state.excelDepsInstalling = false;
        broadcastExcelStatus();
        excelLog('pip spawn error:', err.message);
        callback(err);
      });
    });

    checkProc.on('error', (err) => {
      state.excelDepsInstalling = false;
      broadcastExcelStatus();
      excelLog('Python check spawn error:', err.message);
      callback(err);
    });
  }

  function readAhkFromCurrentState() {
    try {
      const file = (() => {
        try {
          const custom = store.get('excelDumpPath');
          if (custom && typeof custom === 'string') return custom;
        } catch (_) { }
        return path.join(getExcelExtractorDir(), 'current_state.json');
      })();

      if (!file || !fs.existsSync(file)) return;
      const txt = fs.readFileSync(file, 'utf8');
      const data = JSON.parse(txt);
      if (!data || typeof data !== 'object') return;
      const ahk = data.ahk;
      if (!ahk || typeof ahk !== 'object') return;

      const next = {
        running: !!ahk.running,
        starting: false,
        error: ahk.error != null ? String(ahk.error) : null,
        pid: (ahk.pid != null && !isNaN(Number(ahk.pid))) ? Number(ahk.pid) : null,
        exe: 'python',
        script: ahk.script != null ? String(ahk.script) : null,
        managed: !!ahk.managed,
        cwd: null,
        lastStderr: null,
      };

      state.ahkStatus = Object.assign({}, state.ahkStatus, next);
    } catch (_) { }
  }

  const ahkPoll = setInterval(() => {
    try {
      readAhkFromCurrentState();
      broadcastExcelStatus();
    } catch (_) { }
  }, 1200);

  function broadcastExcelStatus() {
    try { readAhkFromCurrentState(); } catch (_) { }
    const payload = {
      running: !!state.excelProc,
      starting: !!state.excelProcStarting,
      error: state.excelProcError,
      installing: !!state.excelDepsInstalling,
      ahk: Object.assign({}, state.ahkStatus, { lastStderr: short(state.ahkStatus.lastStderr, 220) }),
      hotkey: {
        running: !!state.hotkeyProc,
        error: state.hotkeyProcError,
      },
    };

    broadcast('excel-extractor-status', payload);
  }

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
        state.excelProcError = 'excel_watcher.py not found in "Excel Extractor"';
        state.excelProcStarting = false;
        broadcastExcelStatus();
        return;
      }

      let py = 'python';
      try { const pyOverride = store.get('excelPythonPath'); if (pyOverride) py = pyOverride; } catch (_) { }

      // Сначала проверяем и устанавливаем зависимости
      checkAndInstallDeps(py, (depsErr) => {
        if (depsErr) {
          state.excelProcError = 'Deps install failed: ' + depsErr.message;
          state.excelProcStarting = false;
          broadcastExcelStatus();
          return;
        }

        // Продолжаем запуск после установки зависимостей
        startExcelExtractorAfterDeps(py, scriptPath);
      });

    } catch (err) {
      state.excelProcError = 'Startup error: ' + (err && err.message ? err.message : String(err));
      state.excelProcStarting = false;
      broadcastExcelStatus();
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
            state.excelProcError = 'Excel file not selected';
            state.excelProcStarting = false;
            broadcastExcelStatus();
            return;
          }

          workbookPath = String(picked[0] || '').trim();
          if (!workbookPath) {
            state.excelProcError = 'Excel file not selected';
            state.excelProcStarting = false;
            broadcastExcelStatus();
            return;
          }

          store.set('excelWorkbookPath', workbookPath);
          excelLog('excelWorkbookPath set', workbookPath);
        }
      } catch (err) {
        state.excelProcError = 'File picker failed: ' + (err && err.message ? err.message : String(err));
        state.excelProcStarting = false;
        broadcastExcelStatus();
        return;
      }

      const args = ['-u', scriptPath, '--file', workbookPath];
      const cwd = path.dirname(scriptPath);

      excelLog('spawn attempt', JSON.stringify({ python: py, args, cwd, scriptPath }));

      const spawnEnv = Object.assign({}, process.env, {
        PYTHONUNBUFFERED: '1',
        PYTHONIOENCODING: 'utf-8',
      });

      state.excelProc = spawn(py, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], env: spawnEnv });
      excelLog('spawned pid', state.excelProc.pid, 'script', scriptPath);

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
          excelLog('excelDumpPath synced to', dumpCandidate);
        }
      } catch (_) { }

      let stderrBuf = '';
      let gotAnyOutput = false;
      const firstOutputTimer = setTimeout(() => {
        if (!gotAnyOutput && state.excelProc) {
          excelLog('no-output-first-4s: возможно скрипт ждёт Excel или не установлен pywin32. Убедитесь что: Excel открыт с нужной книгой и выполнен pip install pywin32');
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
          const s = d.toString();
          excelLog('[stdout]', String(s || '').trim());
        } catch (_) { }
      });

      state.excelProc.stderr.on('data', d => {
        try {
          markOutput();
          const t = d.toString();
          stderrBuf += t;
          excelLog('[stderr]', String(t || '').trim());
        } catch (_) { }
      });

      state.excelProc.on('exit', (code, sig) => {
        try { clearTimeout(firstOutputTimer); } catch (_) { }
        excelLog('exit code', code, 'sig', sig || '');

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
      });

      // Start hotkey controller after watcher is running
      setTimeout(() => startHotkeyController(), 500);

      broadcastExcelStatus();
    } catch (err) {
      state.excelProcError = (err && err.message) ? err.message : String(err);
      state.excelProcStarting = false;
      state.excelProc = null;
      excelLog('spawn failed', state.excelProcError);
      broadcastExcelStatus();
    }
  }

  function startHotkeyController() {
    if (state.hotkeyProc) return; // Already running

    const scriptPath = resolveHotkeyControllerPath();
    if (!scriptPath) {
      excelLog('[hotkey] excel_hotkey_controller.py not found');
      state.hotkeyProcError = 'excel_hotkey_controller.py not found';
      return;
    }

    let py = 'python';
    try { const pyOverride = store.get('excelPythonPath'); if (pyOverride) py = pyOverride; } catch (_) { }

    const cwd = path.dirname(scriptPath);
    const args = ['-u', scriptPath];

    excelLog('[hotkey] starting', scriptPath);

    const spawnEnv = Object.assign({}, process.env, {
      PYTHONUNBUFFERED: '1',
      PYTHONIOENCODING: 'utf-8',
    });

    try {
      state.hotkeyProc = spawn(py, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], env: spawnEnv, windowsHide: true });
      state.hotkeyProcError = null;

      excelLog('[hotkey] spawned pid', state.hotkeyProc.pid);

      state.hotkeyProc.stdout.on('data', d => {
        try { excelLog('[hotkey][stdout]', d.toString().trim()); } catch (_) { }
      });

      state.hotkeyProc.stderr.on('data', d => {
        try { excelLog('[hotkey][stderr]', d.toString().trim()); } catch (_) { }
      });

      state.hotkeyProc.on('exit', (code, sig) => {
        excelLog('[hotkey] exit code', code, 'sig', sig || '');
        state.hotkeyProc = null;
        if (code && code !== 0) {
          state.hotkeyProcError = 'Hotkey controller exit code ' + code;
        }
        // When hotkey controller exits (e.g., ESC pressed), also stop the watcher
        // This ensures proper cleanup and status update in the board
        if (state.excelProc) {
          excelLog('[hotkey] stopping watcher due to hotkey controller exit');
          stopExcelExtractor();
        }
        broadcastExcelStatus();
      });

    } catch (err) {
      excelLog('[hotkey] spawn failed', err && err.message ? err.message : String(err));
      state.hotkeyProcError = err && err.message ? err.message : String(err);
      state.hotkeyProc = null;
    }
  }

  function stopHotkeyController() {
    try {
      if (state.hotkeyProc) {
        excelLog('[hotkey] stopping pid', state.hotkeyProc.pid);
        state.hotkeyProc.kill();
        state.hotkeyProc = null;
      }
    } catch (_) { }
  }

  function stopExcelExtractor() {
    // Stop hotkey controller first
    stopHotkeyController();

    const ahkPid = (() => {
      try {
        const v = state.ahkStatus && state.ahkStatus.pid;
        if (v != null && !isNaN(Number(v))) return Number(v);
      } catch (_) { }
      return null;
    })();

    const ahkManaged = (() => {
      try { return !!(state.ahkStatus && state.ahkStatus.managed); } catch (_) { return false; }
    })();

    try {
      if (state.excelProc) {
        excelLog('[python] stopping pid', state.excelProc.pid);
        state.excelProc.kill();
      }
    } catch (_) { }

    // On Windows, process termination may bypass Python atexit; best-effort stop AHK by PID.
    try {
      if (ahkPid) {
        excelLog('[ahk] stopping pid (from python status)', ahkPid);
        spawn('taskkill', ['/PID', String(ahkPid), '/T', '/F'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      }
    } catch (_) { }

    // Fallback: if Python indicates it launched AHK but PID is unreliable, best-effort stop AutoHotkey by image name.
    try {
      if (!ahkPid && ahkManaged) {
        excelLog('[ahk] stopping by image name (managed by python)');
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
      excelLog('[excel-extractor] custom script path set', trimmed);
      if (!state.excelProc) startExcelExtractor();
      else broadcastExcelStatus();
    } catch (err) {
      excelLog('[excel-extractor] set-path error', err && err.message ? err.message : String(err));
    }
  }

  function installDeps() {
    if (state.excelDepsInstalling) return;

    let py = 'python';
    try { const pyOverride = store.get('excelPythonPath'); if (pyOverride) py = pyOverride; } catch (_) { }

    state.excelDepsInstalling = true;
    state.excelProcError = null;
    broadcastExcelStatus();

    try {
      const inst = spawn(py, ['-m', 'pip', 'install', 'pywin32'], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
      let errBuf = '';
      inst.stdout.on('data', d => { try { excelLog('[install][stdout]', d.toString().trim()); } catch (_) { } });
      inst.stderr.on('data', d => { try { const s = d.toString(); errBuf += s; excelLog('[install][stderr]', s.trim()); } catch (_) { } });
      inst.on('exit', (code) => {
        state.excelDepsInstalling = false;
        if (code === 0) {
          state.excelProcError = null;
          setTimeout(() => { if (!state.excelProc) startExcelExtractor(); }, 400);
        } else {
          state.excelProcError = 'Install failed (code ' + code + ')' + (errBuf ? (': ' + short(errBuf, 140)) : '');
        }
        broadcastExcelStatus();
      });
    } catch (err) {
      state.excelDepsInstalling = false;
      state.excelProcError = 'Install spawn err: ' + (err && err.message ? err.message : String(err));
      broadcastExcelStatus();
    }
  }

  function getStatus() {
    return {
      running: !!state.excelProc,
      starting: !!state.excelProcStarting,
      error: state.excelProcError,
      installing: !!state.excelDepsInstalling,
      ahk: Object.assign({}, state.ahkStatus),
    };
  }

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
    installDeps,
    broadcastExcelStatus,
    dispose,
  };
}

module.exports = { createExcelExtractorController };

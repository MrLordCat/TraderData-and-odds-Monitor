// Splash Screen Manager
// Shows loading screen while app warms up components

const { BrowserWindow, ipcMain } = require('electron');
const path = require('path');

function createSplashManager({ app }) {
  let splashWindow = null;
  let mainWindowRef = null;
  let progress = 0;
  let tasks = [];
  let completedTasks = 0;
  let isReady = false;
  let splashReady = false;
  
  // Create splash window
  function create() {
    splashWindow = new BrowserWindow({
      width: 380,
      height: 260,
      frame: false,
      transparent: true,
      resizable: false,
      center: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });
    
    splashWindow.loadFile(path.join(__dirname, '..', '..', '..', 'renderer', 'pages', 'splash.html'));
    
    // Wait for splash to signal it's ready
    ipcMain.once('splash-ready', () => {
      splashReady = true;
      // Send initial progress
      updateProgress(0, 'Initializing...');
      // Send version
      try {
        const version = app.getVersion();
        splashWindow.webContents.send('splash-progress', { version });
      } catch(_){}
    });
    
    return splashWindow;
  }
  
  // Set reference to main window (will show it when ready)
  function setMainWindow(win) {
    mainWindowRef = win;
  }
  
  // Register a warm-up task
  // task: { name: string, fn: () => Promise<void> | void }
  function registerTask(name, fn) {
    tasks.push({ name, fn, done: false });
  }
  
  // Update progress bar
  function updateProgress(pct, status) {
    progress = pct;
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.webContents.send('splash-progress', { progress: pct, status });
    }
  }
  
  // Run all registered tasks
  async function runTasks() {
    const totalTasks = tasks.length;
    if (totalTasks === 0) {
      finish();
      return;
    }
    
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      updateProgress((i / totalTasks) * 100, task.name);
      
      try {
        const result = task.fn();
        if (result && typeof result.then === 'function') {
          await result;
        }
      } catch (e) {
        console.warn(`[splash] Task "${task.name}" failed:`, e.message);
      }
      
      task.done = true;
      completedTasks++;
      updateProgress(((i + 1) / totalTasks) * 100, task.name);
    }
    
    // Small delay before finishing for visual smoothness
    updateProgress(100, 'Ready!');
    await new Promise(r => setTimeout(r, 300));
    finish();
  }
  
  // Finish loading - show main window, close splash
  function finish() {
    if (isReady) return;
    isReady = true;
    
    // Show main window
    if (mainWindowRef && !mainWindowRef.isDestroyed()) {
      // Apply maximize if needed (before show to avoid flicker)
      if (mainWindowRef.__shouldMaximize) {
        mainWindowRef.maximize();
      }
      mainWindowRef.show();
      mainWindowRef.focus();
    }
    
    // Close splash with fade
    if (splashWindow && !splashWindow.isDestroyed()) {
      // Quick fade out
      splashWindow.webContents.executeJavaScript(`
        document.body.style.transition = 'opacity 200ms ease-out';
        document.body.style.opacity = '0';
      `).catch(() => {});
      
      setTimeout(() => {
        try { splashWindow.close(); } catch(_){}
        splashWindow = null;
      }, 250);
    }
  }
  
  // Emergency close (if something goes wrong)
  function forceClose() {
    if (splashWindow && !splashWindow.isDestroyed()) {
      try { splashWindow.close(); } catch(_){}
      splashWindow = null;
    }
    if (mainWindowRef && !mainWindowRef.isDestroyed() && !mainWindowRef.isVisible()) {
      if (mainWindowRef.__shouldMaximize) {
        mainWindowRef.maximize();
      }
      mainWindowRef.show();
    }
  }
  
  return {
    create,
    setMainWindow,
    registerTask,
    runTasks,
    updateProgress,
    finish,
    forceClose,
    get isReady() { return isReady; }
  };
}

module.exports = { createSplashManager };

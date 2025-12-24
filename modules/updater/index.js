// Auto-Update Manager for portable Electron app
// Supports two channels: stable (GitHub Releases) and dev (latest commits)

const { app, dialog, shell, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const { checkForUpdates, getLatestRelease, getDevRelease } = require('./githubApi');
const { downloadUpdate, extractUpdate } = require('./downloader');

const REPO_OWNER = 'MrLordCat';
const REPO_NAME = 'TraderData-and-odds-Monitor';

function createUpdateManager({ store, mainWindow }) {
  // State
  let checking = false;
  let downloading = false;
  let downloadProgress = 0;
  let lastCheck = null;
  let availableUpdate = null;

  // Settings from store
  const getChannel = () => store.get('updateChannel', 'stable'); // 'stable' | 'dev'
  const getAutoCheck = () => store.get('autoCheckUpdates', true);
  const getCheckInterval = () => store.get('updateCheckInterval', 3600000); // 1 hour

  // Get current version info
  function getCurrentVersion() {
    try {
      const pkgPath = path.join(app.getAppPath(), 'package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      return pkg.version || '0.0.0';
    } catch (e) {
      return '0.0.0';
    }
  }

  function getCurrentCommit() {
    try {
      const buildInfoPath = path.join(app.getAppPath(), 'build-info.json');
      if (fs.existsSync(buildInfoPath)) {
        const info = JSON.parse(fs.readFileSync(buildInfoPath, 'utf8'));
        return info.commit || null;
      }
    } catch (e) {}
    return null;
  }

  function getBuildInfo() {
    try {
      const buildInfoPath = path.join(app.getAppPath(), 'build-info.json');
      if (fs.existsSync(buildInfoPath)) {
        return JSON.parse(fs.readFileSync(buildInfoPath, 'utf8'));
      }
    } catch (e) {}
    return { channel: 'stable', commit: null, commitShort: null, buildTime: null };
  }

  // Compare versions (semver-like)
  function isNewerVersion(remote, local) {
    // Handle dev versions like 0.0.7-dev.abc123
    const parseVersion = (v) => {
      const match = v.match(/^(\d+)\.(\d+)\.(\d+)(?:-dev\.(.+))?$/);
      if (!match) return { major: 0, minor: 0, patch: 0, dev: null };
      return {
        major: parseInt(match[1], 10),
        minor: parseInt(match[2], 10),
        patch: parseInt(match[3], 10),
        dev: match[4] || null
      };
    };

    const r = parseVersion(remote);
    const l = parseVersion(local);

    if (r.major !== l.major) return r.major > l.major;
    if (r.minor !== l.minor) return r.minor > l.minor;
    if (r.patch !== l.patch) return r.patch > l.patch;
    
    // If same version, non-dev is newer than dev
    if (r.dev === null && l.dev !== null) return true;
    
    return false;
  }

  // Check for updates
  async function check(silent = false) {
    if (checking) return null;
    checking = true;
    lastCheck = Date.now();

    try {
      const channel = getChannel();
      const currentVersion = getCurrentVersion();
      const currentCommit = getCurrentCommit();

      console.log(`[updater] Checking for updates (channel: ${channel}, current: ${currentVersion})`);

      let release;
      if (channel === 'dev') {
        release = await getDevRelease(REPO_OWNER, REPO_NAME);
        // For dev channel, compare commit SHA
        if (release && release.commit && release.commit !== currentCommit) {
          availableUpdate = {
            version: release.version,
            commit: release.commit,
            commitShort: release.commitShort,
            downloadUrl: release.downloadUrl,
            releaseUrl: release.releaseUrl,
            channel: 'dev',
            publishedAt: release.publishedAt
          };
        } else {
          availableUpdate = null;
        }
      } else {
        // Stable channel - compare version tags
        release = await getLatestRelease(REPO_OWNER, REPO_NAME);
        if (release && isNewerVersion(release.version, currentVersion)) {
          availableUpdate = {
            version: release.version,
            downloadUrl: release.downloadUrl,
            releaseUrl: release.releaseUrl,
            channel: 'stable',
            publishedAt: release.publishedAt,
            releaseNotes: release.body
          };
        } else {
          availableUpdate = null;
        }
      }

      checking = false;

      if (availableUpdate) {
        console.log(`[updater] Update available: ${availableUpdate.version}`);
        broadcast('update-available', availableUpdate);
        
        if (!silent) {
          showUpdateDialog(availableUpdate);
        }
      } else {
        console.log('[updater] No updates available');
        if (!silent) {
          broadcast('update-not-available', { currentVersion, channel });
        }
      }

      return availableUpdate;
    } catch (err) {
      console.error('[updater] Check failed:', err.message);
      checking = false;
      broadcast('update-error', { message: err.message });
      return null;
    }
  }

  // Show update confirmation dialog
  async function showUpdateDialog(update) {
    if (!mainWindow || mainWindow.isDestroyed()) return;

    const channelLabel = update.channel === 'dev' ? 'Dev Build' : 'Release';
    const versionInfo = update.channel === 'dev' 
      ? `${update.version} (${update.commitShort})`
      : `v${update.version}`;

    const result = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Available',
      message: `A new ${channelLabel} is available`,
      detail: `Version: ${versionInfo}\n\nWould you like to download and install it now?`,
      buttons: ['Update Now', 'View Release', 'Later'],
      defaultId: 0,
      cancelId: 2
    });

    if (result.response === 0) {
      downloadAndInstall(update);
    } else if (result.response === 1) {
      shell.openExternal(update.releaseUrl);
    }
  }

  // Download and install update
  async function downloadAndInstall(update) {
    if (downloading) return;
    downloading = true;
    downloadProgress = 0;

    try {
      broadcast('update-downloading', { progress: 0 });

      // Download zip to temp
      const tempDir = app.getPath('temp');
      const zipPath = path.join(tempDir, `oddsmoni-update-${Date.now()}.zip`);

      console.log(`[updater] Downloading update from ${update.downloadUrl}`);

      await downloadUpdate(update.downloadUrl, zipPath, (progress) => {
        downloadProgress = progress;
        broadcast('update-downloading', { progress });
      });

      broadcast('update-extracting', {});

      // Extract to temp folder
      const extractDir = path.join(tempDir, `oddsmoni-update-${Date.now()}`);
      await extractUpdate(zipPath, extractDir);

      // Clean up zip
      try { fs.unlinkSync(zipPath); } catch (_) {}

      downloading = false;
      broadcast('update-ready', { extractDir });

      // Show restart dialog
      const result = await dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update Ready',
        message: 'Update downloaded successfully',
        detail: 'The application needs to restart to apply the update. Restart now?',
        buttons: ['Restart Now', 'Later'],
        defaultId: 0
      });

      if (result.response === 0) {
        applyUpdateAndRestart(extractDir);
      } else {
        // Save pending update path for later
        store.set('pendingUpdate', extractDir);
      }
    } catch (err) {
      console.error('[updater] Download failed:', err.message);
      downloading = false;
      broadcast('update-error', { message: err.message });
      
      dialog.showErrorBox('Update Failed', `Failed to download update: ${err.message}`);
    }
  }

  // Apply update and restart
  function applyUpdateAndRestart(extractDir) {
    try {
      const appPath = app.getAppPath();
      const isAsar = appPath.includes('.asar');
      
      // For non-asar (portable) builds
      if (!isAsar) {
        // Create update script that runs after app exits
        const updateScript = createUpdateScript(extractDir, appPath);
        
        // Store script path and quit
        store.set('pendingUpdateScript', updateScript);
        
        // Relaunch with update flag
        app.relaunch({ args: ['--apply-update', updateScript] });
        app.quit();
      } else {
        dialog.showErrorBox('Update Error', 'Cannot update ASAR-packed application. Please download manually.');
      }
    } catch (err) {
      console.error('[updater] Apply update failed:', err.message);
      dialog.showErrorBox('Update Failed', err.message);
    }
  }

  // Create PowerShell script for file replacement
  function createUpdateScript(sourceDir, targetDir) {
    const scriptPath = path.join(app.getPath('temp'), `oddsmoni-update-${Date.now()}.ps1`);
    const exePath = path.join(targetDir, 'OddsMoni.exe');
    
    const script = `
# OddsMoni Update Script
$ErrorActionPreference = "Stop"
$sourceDir = "${sourceDir.replace(/\\/g, '\\\\')}"
$targetDir = "${targetDir.replace(/\\/g, '\\\\')}"
$exePath = "${exePath.replace(/\\/g, '\\\\')}"

# Wait for app to close
Start-Sleep -Seconds 2

# Backup current version (optional)
$backupDir = "$targetDir\\..\\OddsMoni-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"

try {
    # Copy new files over old ones
    Write-Host "Updating files..."
    Copy-Item -Path "$sourceDir\\*" -Destination "$targetDir" -Recurse -Force
    
    # Clean up temp extract folder
    Remove-Item -Path "$sourceDir" -Recurse -Force -ErrorAction SilentlyContinue
    
    Write-Host "Update complete. Starting application..."
    
    # Start updated app
    Start-Process -FilePath $exePath
    
} catch {
    Write-Host "Update failed: $_"
    Write-Host "Press any key to exit..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}
`;

    fs.writeFileSync(scriptPath, script, 'utf8');
    return scriptPath;
  }

  // Broadcast to renderer
  function broadcast(channel, data) {
    try {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(`updater-${channel}`, data);
      }
      // Also send to all BrowserWindows
      BrowserWindow.getAllWindows().forEach(win => {
        try {
          if (!win.isDestroyed()) {
            win.webContents.send(`updater-${channel}`, data);
          }
        } catch (_) {}
      });
    } catch (_) {}
  }

  // Get status
  function getStatus() {
    return {
      checking,
      downloading,
      downloadProgress,
      lastCheck,
      availableUpdate,
      currentVersion: getCurrentVersion(),
      currentCommit: getCurrentCommit(),
      buildInfo: getBuildInfo(),
      channel: getChannel(),
      autoCheck: getAutoCheck()
    };
  }

  // Set channel
  function setChannel(channel) {
    if (channel !== 'stable' && channel !== 'dev') return;
    store.set('updateChannel', channel);
    availableUpdate = null; // Reset available update when channel changes
    broadcast('update-channel-changed', { channel });
  }

  // Set auto-check
  function setAutoCheck(enabled) {
    store.set('autoCheckUpdates', !!enabled);
  }

  // Initialize - check on startup if enabled
  let checkTimer = null;
  function init() {
    // Check for pending update on startup
    const pendingScript = store.get('pendingUpdateScript');
    if (pendingScript && fs.existsSync(pendingScript)) {
      // Clear it
      store.delete('pendingUpdateScript');
    }

    // Auto-check on startup after delay
    if (getAutoCheck()) {
      setTimeout(() => check(true), 10000); // 10 sec after startup
      
      // Periodic check
      checkTimer = setInterval(() => {
        if (getAutoCheck()) check(true);
      }, getCheckInterval());
    }
  }

  function destroy() {
    if (checkTimer) {
      clearInterval(checkTimer);
      checkTimer = null;
    }
  }

  return {
    init,
    destroy,
    check,
    getStatus,
    setChannel,
    setAutoCheck,
    downloadAndInstall,
    getCurrentVersion,
    getCurrentCommit,
    getBuildInfo
  };
}

module.exports = { createUpdateManager };

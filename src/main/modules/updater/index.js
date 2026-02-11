// Auto-Update Manager for portable Electron app
// Supports two channels: stable (GitHub Releases) and dev (latest commits)

const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const { checkForUpdates, getLatestRelease, getDevRelease } = require('./githubApi');
const { downloadUpdate, extractUpdate } = require('./downloader');
const { isNewer } = require('../utils/version');

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
      // First try build-info.json
      const buildInfoPath = path.join(app.getAppPath(), 'build-info.json');
      if (fs.existsSync(buildInfoPath)) {
        const info = JSON.parse(fs.readFileSync(buildInfoPath, 'utf8'));
        if (info.commit) return info.commit;
        if (info.commitShort) return info.commitShort;
      }
      
      // Fallback: extract from version string (0.1.1-dev.abc1234)
      const version = getCurrentVersion();
      const match = version.match(/-dev\.([a-f0-9]+)$/i);
      if (match) return match[1];
      
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

  // Check for updates
  async function check(silent = false) {
    if (checking) return null;
    checking = true;
    lastCheck = Date.now();

    try {
      const channel = getChannel();
      const currentVersion = getCurrentVersion();
      const currentCommit = getCurrentCommit();

      console.log(`[updater] Checking for updates (channel: ${channel}, current: v${currentVersion}, commit: ${currentCommit || 'none'})`);

      let release;
      if (channel === 'dev') {
        release = await getDevRelease(REPO_OWNER, REPO_NAME);
        console.log(`[updater] Dev release response:`, release ? { commitShort: release.commitShort, downloadUrl: release.downloadUrl?.substring(0, 50) + '...' } : 'null');
        
        // For dev channel, compare commit SHA (handle short vs full SHA)
        if (release && release.commitShort) {
          const currentShort = currentCommit ? currentCommit.substring(0, 7) : null;
          const remoteShort = release.commitShort.substring(0, 7);
          
          console.log(`[updater] Dev compare: current="${currentShort}" vs remote="${remoteShort}" -> ${currentShort !== remoteShort ? 'UPDATE AVAILABLE' : 'SAME'}`);
          
          if (currentShort !== remoteShort) {
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
            console.log('[updater] No updates available (same commit)');
          }
        } else {
          availableUpdate = null;
        }
      } else {
        // Stable channel - compare version tags
        release = await getLatestRelease(REPO_OWNER, REPO_NAME);
        if (release && isNewer(release.version, currentVersion)) {
          availableUpdate = {
            version: release.version,
            downloadUrl: release.downloadUrl,
            assetId: release.assetId,
            releaseUrl: release.releaseUrl,
            channel: 'stable',
            publishedAt: release.publishedAt,
            releaseNotes: release.body
          };
        } else if (release && release.version === currentVersion && release.assetId) {
          // Same version — check if the release asset was re-uploaded (patch)
          const installedAssetId = store.get('installedAssetId');
          if (installedAssetId && release.assetId !== installedAssetId) {
            console.log(`[updater] Patch detected: same version ${currentVersion} but asset changed (${installedAssetId} → ${release.assetId})`);
            availableUpdate = {
              version: release.version,
              downloadUrl: release.downloadUrl,
              assetId: release.assetId,
              releaseUrl: release.releaseUrl,
              channel: 'stable',
              publishedAt: release.publishedAt,
              releaseNotes: release.body,
              isPatch: true
            };
          } else {
            availableUpdate = null;
          }
        } else {
          availableUpdate = null;
        }
      }

      checking = false;

      if (availableUpdate) {
        console.log(`[updater] Update available: ${availableUpdate.version}`);
        broadcast('update-available', availableUpdate);
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

  // Download and install update
  async function downloadAndInstall(update) {
    if (downloading) return;
    downloading = true;
    downloadProgress = 0;

    try {
      broadcast('downloading', { percent: 0 });

      // Download zip to temp
      const tempDir = app.getPath('temp');
      const zipPath = path.join(tempDir, `oddsmoni-update-${Date.now()}.zip`);

      console.log(`[updater] Downloading update from ${update.downloadUrl}`);
      console.log(`[updater] Saving to: ${zipPath}`);

      await downloadUpdate(update.downloadUrl, zipPath, (progress) => {
        downloadProgress = progress;
        broadcast('downloading', { percent: progress });
      });

      console.log(`[updater] Download complete, starting extraction...`);
      broadcast('extracting', { percent: 100 });

      // Extract to temp folder
      const extractDir = path.join(tempDir, `oddsmoni-update-${Date.now()}`);
      console.log(`[updater] Extracting to: ${extractDir}`);
      
      await extractUpdate(zipPath, extractDir);
      
      console.log(`[updater] Extraction complete!`);

      // Clean up zip
      try { fs.unlinkSync(zipPath); } catch (_) {}

      downloading = false;
      
      // Save asset ID so patch detection works after install
      if (update.assetId) {
        store.set('installedAssetId', update.assetId);
        console.log(`[updater] Saved installedAssetId: ${update.assetId}`);
      }

      // Save pending update path for restart
      store.set('pendingUpdate', extractDir);
      console.log(`[updater] Broadcasting update-ready`);
      broadcast('update-ready', { extractDir });
    } catch (err) {
      console.error('[updater] Download/extract failed:', err.message);
      downloading = false;
      broadcast('update-error', { message: err.message });
    }
  }

  // Apply update and restart
  function applyUpdateAndRestart(extractDir) {
    try {
      // For portable builds, get the directory containing the exe
      const exePath = process.execPath; // Full path to OddsMoni.exe
      const appDir = path.dirname(exePath); // Directory containing the app
      
      console.log('[updater] Applying update...');
      console.log('[updater] Extract dir:', extractDir);
      console.log('[updater] App dir:', appDir);
      console.log('[updater] Exe path:', exePath);
      
      // Create update script that runs after app exits
      const updateScript = createUpdateScript(extractDir, appDir, exePath);
      
      console.log('[updater] Update script:', updateScript);
      
      // Relaunch with update flag - this will run the PS script and exit
      app.relaunch({ args: ['--apply-update', updateScript] });
      app.quit();
    } catch (err) {
      console.error('[updater] Apply update failed:', err.message);
      dialog.showErrorBox('Update Failed', err.message);
    }
  }

  // Create batch file for file replacement (no PowerShell required)
  function createUpdateScript(sourceDir, targetDir, exePath) {
    const scriptPath = path.join(app.getPath('temp'), `oddsmoni-update-${Date.now()}.bat`);
    
    // Batch file - completely silent, no window
    const script = `@echo off
chcp 65001 >nul

REM Wait for application to close
ping -n 4 127.0.0.1 >nul

REM Kill process if still running
taskkill /F /IM OddsMoni.exe >nul 2>&1
ping -n 2 127.0.0.1 >nul

REM Copy updated files
xcopy /E /Y /Q "${sourceDir}\\*" "${targetDir}\\" >nul

REM Cleanup temp files
rmdir /S /Q "${sourceDir}" >nul 2>&1

REM Start application (hidden using wscript)
echo CreateObject("WScript.Shell").Run """${exePath.replace(/\\/g, '\\\\')}""", 1, False > "%TEMP%\\oddsmoni-start.vbs"
wscript "%TEMP%\\oddsmoni-start.vbs"
del "%TEMP%\\oddsmoni-start.vbs" >nul 2>&1
`;

    fs.writeFileSync(scriptPath, script, 'utf8');
    return scriptPath;
  }

  // Broadcast to renderer (windows and views)
  function broadcast(channel, data) {
    const { broadcastGlobal } = require('../utils/broadcast');
    broadcastGlobal(`updater-${channel}`, data);
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
  async function init() {
    // Check for pending update on startup
    const pendingScript = store.get('pendingUpdateScript');
    if (pendingScript && fs.existsSync(pendingScript)) {
      // Clear it
      store.delete('pendingUpdateScript');
    }

    // Seed installedAssetId on first run (so patch detection has a baseline)
    if (!store.get('installedAssetId') && getChannel() === 'stable') {
      try {
        const rel = await getLatestRelease(REPO_OWNER, REPO_NAME);
        if (rel && rel.assetId && rel.version === getCurrentVersion()) {
          store.set('installedAssetId', rel.assetId);
          console.log(`[updater] Seeded installedAssetId: ${rel.assetId}`);
        }
      } catch (_) { /* non-critical */ }
    }

    // Auto-check on startup after delay
    if (getAutoCheck()) {
      setTimeout(async () => {
        // check() will broadcast 'update-available' if update found
        await check(true);
      }, 10000); // 10 sec after startup
      
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

  // Restart to apply pending update
  function restart() {
    const extractDir = store.get('pendingUpdate');
    if (extractDir && fs.existsSync(extractDir)) {
      applyUpdateAndRestart(extractDir);
    } else {
      // No pending update, just restart
      app.relaunch();
      app.exit(0);
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
    restart,
    getCurrentVersion,
    getCurrentCommit,
    getBuildInfo
  };
}

module.exports = { createUpdateManager };

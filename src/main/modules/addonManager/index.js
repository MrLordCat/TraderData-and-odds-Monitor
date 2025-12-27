/**
 * Addon Manager - Download, install, and manage addon modules
 * 
 * Addons are downloaded from GitHub releases and installed to userData/addons/
 * Each addon has a manifest.json describing its metadata and entry point.
 * 
 * Flow:
 * 1. User opens Settings → Addons tab
 * 2. Available addons fetched from GitHub (addon-registry branch or releases)
 * 3. User clicks Install → downloads zip → extracts to addons/<id>/
 * 4. On next app start (or hot-reload), addon's sidebar module is loaded
 */

const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const AdmZip = require('adm-zip');

const REPO_OWNER = 'MrLordCat';
const REPO_NAME = 'TraderData-and-odds-Monitor';

// Registry of available addons (fetched from GitHub main branch)
const ADDON_REGISTRY_URL = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/addon-registry.json`;

function createAddonManager({ store, mainWindow }) {
  // Paths
  const addonsDir = path.join(app.getPath('userData'), 'addons');
  
  // Ensure addons directory exists
  if (!fs.existsSync(addonsDir)) {
    fs.mkdirSync(addonsDir, { recursive: true });
  }
  
  // State
  let availableAddons = [];  // From registry
  let installedAddons = [];  // Locally installed
  let enabledAddons = store.get('enabledAddons', []);
  
  /**
   * Get path to addons directory
   */
  function getAddonsDir() {
    return addonsDir;
  }
  
  /**
   * Load manifest from addon directory
   */
  function loadManifest(addonDir) {
    const manifestPath = path.join(addonDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      return null;
    }
    try {
      return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } catch (e) {
      console.error(`[AddonManager] Failed to load manifest from ${addonDir}:`, e);
      return null;
    }
  }
  
  /**
   * Scan installed addons
   */
  function scanInstalledAddons() {
    installedAddons = [];
    
    if (!fs.existsSync(addonsDir)) return installedAddons;
    
    const entries = fs.readdirSync(addonsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      
      const addonDir = path.join(addonsDir, entry.name);
      const manifest = loadManifest(addonDir);
      
      if (manifest) {
        installedAddons.push({
          id: manifest.id,
          name: manifest.name,
          version: manifest.version,
          description: manifest.description,
          author: manifest.author,
          main: manifest.main,
          icon: manifest.icon,
          path: addonDir,
          enabled: enabledAddons.includes(manifest.id)
        });
      }
    }
    
    return installedAddons;
  }
  
  /**
   * Fetch available addons from registry
   */
  async function fetchAvailableAddons() {
    return new Promise((resolve) => {
      https.get(ADDON_REGISTRY_URL, (res) => {
        if (res.statusCode !== 200) {
          console.warn(`[AddonManager] Registry fetch failed: ${res.statusCode}`);
          resolve([]);
          return;
        }
        
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const registry = JSON.parse(data);
            availableAddons = registry.addons || [];
            resolve(availableAddons);
          } catch (e) {
            console.error('[AddonManager] Failed to parse registry:', e);
            resolve([]);
          }
        });
      }).on('error', (e) => {
        console.error('[AddonManager] Registry fetch error:', e);
        resolve([]);
      });
    });
  }
  
  /**
   * Download file from URL
   */
  function downloadFile(url, destPath) {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(destPath);
      
      const request = (url) => {
        https.get(url, (res) => {
          // Handle redirects
          if (res.statusCode === 301 || res.statusCode === 302) {
            request(res.headers.location);
            return;
          }
          
          if (res.statusCode !== 200) {
            reject(new Error(`Download failed: ${res.statusCode}`));
            return;
          }
          
          const totalSize = parseInt(res.headers['content-length'], 10) || 0;
          let downloadedSize = 0;
          
          res.on('data', (chunk) => {
            downloadedSize += chunk.length;
            if (totalSize > 0) {
              const progress = Math.round((downloadedSize / totalSize) * 100);
              broadcast('addon-download-progress', { progress });
            }
          });
          
          res.pipe(file);
          
          file.on('finish', () => {
            file.close();
            resolve(destPath);
          });
        }).on('error', (e) => {
          fs.unlink(destPath, () => {});
          reject(e);
        });
      };
      
      request(url);
    });
  }
  
  /**
   * Install addon from URL
   */
  async function installAddon(addonId, downloadUrl) {
    const tempDir = app.getPath('temp');
    const zipPath = path.join(tempDir, `addon-${addonId}-${Date.now()}.zip`);
    
    try {
      broadcast('addon-install-status', { addonId, status: 'downloading' });
      
      // Download zip
      await downloadFile(downloadUrl, zipPath);
      
      broadcast('addon-install-status', { addonId, status: 'extracting' });
      
      // Extract
      const zip = new AdmZip(zipPath);
      const addonDir = path.join(addonsDir, addonId);
      
      // Remove old version if exists
      if (fs.existsSync(addonDir)) {
        fs.rmSync(addonDir, { recursive: true, force: true });
      }
      
      zip.extractAllTo(addonDir, true);
      
      // Handle nested directory (GitHub releases often have root folder)
      const entries = fs.readdirSync(addonDir);
      if (entries.length === 1) {
        const nested = path.join(addonDir, entries[0]);
        if (fs.statSync(nested).isDirectory() && fs.existsSync(path.join(nested, 'manifest.json'))) {
          // Move contents up
          const nestedEntries = fs.readdirSync(nested);
          for (const e of nestedEntries) {
            fs.renameSync(path.join(nested, e), path.join(addonDir, e));
          }
          fs.rmdirSync(nested);
        }
      }
      
      // Verify manifest exists
      const manifest = loadManifest(addonDir);
      if (!manifest) {
        throw new Error('Invalid addon: manifest.json not found');
      }
      
      // Auto-enable on install
      if (!enabledAddons.includes(addonId)) {
        enabledAddons.push(addonId);
        store.set('enabledAddons', enabledAddons);
      }
      
      // Cleanup
      fs.unlinkSync(zipPath);
      
      // Rescan
      scanInstalledAddons();
      
      broadcast('addon-install-status', { addonId, status: 'installed', requiresRestart: true });
      
      return { success: true, requiresRestart: true };
      
    } catch (e) {
      console.error(`[AddonManager] Install failed for ${addonId}:`, e);
      broadcast('addon-install-status', { addonId, status: 'error', error: e.message });
      
      // Cleanup on error
      try { fs.unlinkSync(zipPath); } catch (_) {}
      
      return { success: false, error: e.message };
    }
  }
  
  /**
   * Uninstall addon
   */
  function uninstallAddon(addonId) {
    const addonDir = path.join(addonsDir, addonId);
    
    try {
      if (fs.existsSync(addonDir)) {
        fs.rmSync(addonDir, { recursive: true, force: true });
      }
      
      // Remove from enabled
      enabledAddons = enabledAddons.filter(id => id !== addonId);
      store.set('enabledAddons', enabledAddons);
      
      // Rescan
      scanInstalledAddons();
      
      broadcast('addon-uninstalled', { addonId });
      
      return { success: true, requiresRestart: true };
      
    } catch (e) {
      console.error(`[AddonManager] Uninstall failed for ${addonId}:`, e);
      return { success: false, error: e.message };
    }
  }
  
  /**
   * Enable/disable addon
   */
  function setAddonEnabled(addonId, enabled) {
    if (enabled && !enabledAddons.includes(addonId)) {
      enabledAddons.push(addonId);
    } else if (!enabled) {
      enabledAddons = enabledAddons.filter(id => id !== addonId);
    }
    
    store.set('enabledAddons', enabledAddons);
    scanInstalledAddons(); // Refresh enabled status
    
    broadcast('addon-enabled-changed', { addonId, enabled });
    
    return { success: true, requiresRestart: true };
  }
  
  /**
   * Get list of enabled addon paths for sidebar loading
   */
  function getEnabledAddonPaths() {
    scanInstalledAddons();
    
    return installedAddons
      .filter(a => a.enabled)
      .map(a => ({
        id: a.id,
        path: path.join(a.path, a.main || 'index.js')
      }));
  }
  
  /**
   * Broadcast message to renderer
   */
  function broadcast(channel, data) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel, data);
    }
  }
  
  /**
   * Get addon info for UI
   */
  function getAddonsInfo() {
    scanInstalledAddons();
    
    return {
      installed: installedAddons,
      available: availableAddons,
      addonsDir: addonsDir
    };
  }
  
  // Initial scan
  scanInstalledAddons();
  
  return {
    getAddonsDir,
    scanInstalledAddons,
    fetchAvailableAddons,
    installAddon,
    uninstallAddon,
    setAddonEnabled,
    getEnabledAddonPaths,
    getAddonsInfo
  };
}

module.exports = { createAddonManager };

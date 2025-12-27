/**
 * Addon Manager - Download, install, and manage addon modules
 * 
 * Addons are downloaded from GitHub releases and installed to userData/addons/
 * Each addon has a manifest.json describing its metadata and entry point.
 * 
 * Supports dev/release channels like the main updater.
 * 
 * Flow:
 * 1. User opens Settings → Addons tab
 * 2. Available addons fetched from GitHub releases based on channel
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

// GitHub API for releases
const GITHUB_API_BASE = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`;
// Fallback registry (for release channel, updated by workflow)
const ADDON_REGISTRY_URL = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/addon-registry.json`;

function createAddonManager({ store, mainWindow }) {
  // Paths
  const addonsDir = path.join(app.getPath('userData'), 'addons');
  
  // Ensure addons directory exists
  if (!fs.existsSync(addonsDir)) {
    fs.mkdirSync(addonsDir, { recursive: true });
  }
  
  // State
  let availableAddons = [];  // From registry/releases
  let installedAddons = [];  // Locally installed
  let enabledAddons = store.get('enabledAddons', []);
  let addonChannel = store.get('addonChannel', 'dev');  // 'dev' or 'release'
  
  /**
   * Get/set addon channel
   */
  function getAddonChannel() {
    return addonChannel;
  }
  
  function setAddonChannel(channel) {
    if (channel === 'dev' || channel === 'release') {
      addonChannel = channel;
      store.set('addonChannel', channel);
      return true;
    }
    return false;
  }
  
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
   * Fetch JSON from URL
   */
  function fetchJSON(url) {
    return new Promise((resolve, reject) => {
      const options = {
        headers: {
          'User-Agent': 'OddsMoni-AddonManager',
          'Accept': 'application/vnd.github.v3+json'
        }
      };
      
      https.get(url, options, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          fetchJSON(res.headers.location).then(resolve).catch(reject);
          return;
        }
        
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      }).on('error', reject);
    });
  }
  
  /**
   * Fetch available addons from GitHub releases based on channel
   */
  async function fetchAvailableAddons() {
    try {
      const channel = addonChannel;
      console.log(`[AddonManager] Fetching addons for channel: ${channel}`);
      
      // Fetch releases from GitHub API
      const releases = await fetchJSON(`${GITHUB_API_BASE}/releases`);
      
      // Filter addon releases (tag starts with 'addon-')
      const addonReleases = releases.filter(r => r.tag_name.startsWith('addon-'));
      
      // Group by addon ID and find latest for each
      const addonMap = new Map();
      
      for (const release of addonReleases) {
        const tag = release.tag_name;
        const isDev = tag.endsWith('-dev') || release.prerelease;
        
        // Skip if wrong channel
        if (channel === 'dev' && !isDev) continue;
        if (channel === 'release' && isDev) continue;
        
        // Extract addon ID: addon-power-towers-dev or addon-power-towers-v1.0.0
        let addonId;
        if (isDev) {
          addonId = tag.replace(/^addon-/, '').replace(/-dev$/, '');
        } else {
          addonId = tag.replace(/^addon-/, '').replace(/-v[\d.]+$/, '');
        }
        
        // Find zip asset
        const zipAsset = release.assets.find(a => a.name.endsWith('.zip'));
        if (!zipAsset) continue;
        
        // Extract version from asset name or tag
        let version;
        if (isDev) {
          // power-towers-dev-abc1234.zip → extract from release body or use tag
          const match = zipAsset.name.match(/-dev-([a-f0-9]+)\.zip$/);
          version = match ? `dev.${match[1]}` : 'dev';
        } else {
          // power-towers-v1.0.0.zip
          const match = tag.match(/-v([\d.]+)$/);
          version = match ? match[1] : '0.0.0';
        }
        
        // Only keep latest for each addon
        if (!addonMap.has(addonId) || new Date(release.published_at) > new Date(addonMap.get(addonId).publishedAt)) {
          addonMap.set(addonId, {
            id: addonId,
            name: release.name.replace(/ v[\d.]+.*$/, '').replace(/ dev.*$/i, ''),
            version,
            description: release.body ? release.body.split('\n').find(l => l && !l.startsWith('#') && !l.startsWith('*')) || '' : '',
            downloadUrl: zipAsset.browser_download_url,
            publishedAt: release.published_at,
            channel: isDev ? 'dev' : 'release',
            prerelease: release.prerelease
          });
        }
      }
      
      availableAddons = Array.from(addonMap.values());
      console.log(`[AddonManager] Found ${availableAddons.length} addons for ${channel} channel`);
      
      return availableAddons;
      
    } catch (e) {
      console.error('[AddonManager] Failed to fetch from GitHub API:', e.message);
      
      // Fallback to registry for release channel
      if (addonChannel === 'release') {
        console.log('[AddonManager] Falling back to registry...');
        return fetchFromRegistry();
      }
      
      return [];
    }
  }
  
  /**
   * Fallback: fetch from static registry file
   */
  async function fetchFromRegistry() {
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
   * Compare semver versions (basic)
   * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
   */
  function compareVersions(v1, v2) {
    if (!v1 || !v2) return 0;
    
    const parse = (v) => {
      const parts = v.replace(/^v/, '').split('.').map(p => parseInt(p, 10) || 0);
      while (parts.length < 3) parts.push(0);
      return parts;
    };
    
    const p1 = parse(v1);
    const p2 = parse(v2);
    
    for (let i = 0; i < 3; i++) {
      if (p1[i] > p2[i]) return 1;
      if (p1[i] < p2[i]) return -1;
    }
    return 0;
  }
  
  /**
   * Check for addon updates
   * Returns list of addons with available updates
   */
  async function checkForUpdates() {
    await fetchAvailableAddons();
    scanInstalledAddons();
    
    const updates = [];
    
    for (const installed of installedAddons) {
      const available = availableAddons.find(a => a.id === installed.id);
      if (available && compareVersions(available.version, installed.version) > 0) {
        updates.push({
          id: installed.id,
          name: installed.name,
          currentVersion: installed.version,
          newVersion: available.version,
          downloadUrl: available.downloadUrl
        });
      }
    }
    
    console.log('[AddonManager] Updates available:', updates);
    return updates;
  }
  
  /**
   * Update addon to latest version
   */
  async function updateAddon(addonId) {
    const available = availableAddons.find(a => a.id === addonId);
    if (!available) {
      return { success: false, error: 'Addon not found in registry' };
    }
    
    // Use installAddon which handles removal of old version
    const result = await installAddon(addonId, available.downloadUrl);
    
    if (result.success) {
      broadcast('addon-updated', { addonId, version: available.version });
    }
    
    return result;
  }
  
  /**
   * Get list of enabled addon sidebar module paths for sidebar loading
   */
  function getEnabledAddonPaths() {
    scanInstalledAddons();
    
    const result = [];
    
    for (const addon of installedAddons.filter(a => a.enabled)) {
      // Load manifest to get sidebarModules
      const manifest = loadManifest(addon.path);
      if (!manifest) continue;
      
      // If addon has sidebarModules, return those paths
      if (manifest.sidebarModules && Array.isArray(manifest.sidebarModules)) {
        for (const mod of manifest.sidebarModules) {
          result.push({
            id: `${addon.id}:${mod.id || mod.path}`,
            addonId: addon.id,
            path: path.join(addon.path, mod.path)
          });
        }
      } else {
        // Fallback to main entry point
        result.push({
          id: addon.id,
          addonId: addon.id,
          path: path.join(addon.path, addon.main || 'index.js')
        });
      }
    }
    
    console.log('[AddonManager] getEnabledAddonPaths:', result);
    return result;
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
    getAddonChannel,
    setAddonChannel,
    scanInstalledAddons,
    fetchAvailableAddons,
    installAddon,
    uninstallAddon,
    setAddonEnabled,
    getEnabledAddonPaths,
    getAddonsInfo,
    checkForUpdates,
    updateAddon,
    compareVersions
  };
}

module.exports = { createAddonManager };

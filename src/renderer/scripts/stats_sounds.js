/**
 * LoL Stats Sound Notifications
 * 
 * Plays audio notifications for LoL match events.
 * Events are detected in inject-stats.js and sent via IPC.
 * 
 * Architecture:
 *   inject-stats.js (Grid BrowserView) → postMessage → statsContent.js (preload)
 *   → IPC 'lol-sound-event' → main process → stats_panel → this module
 * 
 * All event filtering (freshness, backlog) happens in inject-stats.js
 */

(function initStatsSounds() {
  'use strict';

  const path = require('path');
  const fs = require('fs');

  // ═══════════════════════════════════════════════════════════════════
  // SETTINGS
  // ═══════════════════════════════════════════════════════════════════
  let soundsEnabled = true;
  let soundsVolume = 70; // 0-100

  // ═══════════════════════════════════════════════════════════════════
  // SOUND FILE PATHS
  // ═══════════════════════════════════════════════════════════════════
  const ASSET_DIR = path.join(__dirname, '..', '..', 'assets');
  const SOUNDS = {
    gameStart: [
      null, // index 0 unused
      path.join(ASSET_DIR, 'GameOneStarted.mp3'),
      path.join(ASSET_DIR, 'GameTwoStarted.mp3'),
      path.join(ASSET_DIR, 'GameThreeStarted.mp3'),
      path.join(ASSET_DIR, 'GameFourStarted.mp3'),
      path.join(ASSET_DIR, 'GameFiveStarted.mp3')
    ],
    firstBlood: path.join(ASSET_DIR, 'FirstBlood.mp3'),
    firstTower: path.join(ASSET_DIR, 'FirstTower.mp3'),
    firstBaron: path.join(ASSET_DIR, 'FirstBaron.mp3'),
    firstInhibitor: path.join(ASSET_DIR, 'FirstInhibitor.mp3'),
    quadraKill: path.join(ASSET_DIR, 'QuadraKill.mp3'),
    pentaKill: path.join(ASSET_DIR, 'PentaKill.mp3')
  };

  // ═══════════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════════
  let currentGame = 0; // 0 = no game, 1-5 = current game number
  const audioCache = new Map();

  // ═══════════════════════════════════════════════════════════════════
  // AUDIO HELPERS
  // ═══════════════════════════════════════════════════════════════════
  
  function getAudio(filePath) {
    if (!filePath || !fs.existsSync(filePath)) {
      console.warn('[stats-sounds] Sound file not found:', filePath);
      return null;
    }

    if (!audioCache.has(filePath)) {
      try {
        const audio = new Audio(filePath);
        audioCache.set(filePath, audio);
      } catch (e) {
        console.error('[stats-sounds] Failed to create Audio:', e);
        return null;
      }
    }

    const audio = audioCache.get(filePath);
    if (audio) {
      audio.volume = soundsVolume / 100;
    }
    return audio;
  }

  function playSound(filePath) {
    if (!filePath || !soundsEnabled) return;

    try {
      const audio = getAudio(filePath);
      if (!audio) return;

      audio.currentTime = 0;
      audio.play().catch(e => {
        console.warn('[stats-sounds] Play failed:', e.message);
      });

      console.log('[stats-sounds] ▶️ Played:', path.basename(filePath));
    } catch (e) {
      console.error('[stats-sounds] playSound error:', e);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // MAIN ENTRY POINT - TRIGGER SOUND BY TYPE
  // ═══════════════════════════════════════════════════════════════════
  
  // Lookup table for simple sound types (type → SOUNDS key)
  const SOUND_MAP = {
    firstBlood: 'firstBlood', firstTower: 'firstTower', firstBaron: 'firstBaron',
    firstInhibitor: 'firstInhibitor', quadraKill: 'quadraKill', pentaKill: 'pentaKill'
  };

  function triggerSound(soundType, _eventTimestamp) {
    console.log(`[stats-sounds] 🔔 triggerSound: ${soundType}`);
    if (!soundsEnabled) { console.log('[stats-sounds] ⏸️ SKIPPED: sounds disabled'); return; }

    if (soundType === 'seriesStart') { currentGame = 0; return; }
    if (soundType === 'seriesEnd') return;
    if (soundType === 'gameStart') {
      currentGame++;
      if (currentGame >= 1 && currentGame <= 5) playSound(SOUNDS.gameStart[currentGame]);
      return;
    }
    const key = SOUND_MAP[soundType];
    if (key) { playSound(SOUNDS[key]); return; }
    console.warn(`[stats-sounds] Unknown sound type: ${soundType}`);
  }

  // ═══════════════════════════════════════════════════════════════════
  // STATE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════

  function reset() {
    currentGame = 0;
    console.log('[stats-sounds] State reset');
  }

  function handleGameComplete(gameNumber) {
    if (gameNumber > currentGame) {
      currentGame = gameNumber;
      console.log(`[stats-sounds] Game ${gameNumber} completed`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // SETTINGS MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════

  async function loadSettings() {
    try {
      const { ipcRenderer } = require('electron');
      const enabled = await ipcRenderer.invoke('get-setting', 'soundsEnabled');
      const volume = await ipcRenderer.invoke('get-setting', 'soundsVolume');
      
      if (typeof enabled === 'boolean') soundsEnabled = enabled;
      if (typeof volume === 'number') soundsVolume = Math.max(0, Math.min(100, volume));
      
      console.log(`[stats-sounds] Settings: enabled=${soundsEnabled}, volume=${soundsVolume}`);
    } catch (e) {
      console.warn('[stats-sounds] Failed to load settings:', e);
    }
  }

  function updateSettings(enabled, volume) {
    if (typeof enabled === 'boolean') soundsEnabled = enabled;
    if (typeof volume === 'number') soundsVolume = Math.max(0, Math.min(100, volume));
    console.log(`[stats-sounds] Settings updated: enabled=${soundsEnabled}, volume=${soundsVolume}`);
  }

  // ═══════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════

  function init() {
    // Listen to sound events via IPC from Grid BrowserView
    try {
      const { ipcRenderer } = require('electron');
      ipcRenderer.on('lol-sound-event', (_e, { type, timestamp }) => {
        console.log(`[stats-sounds] 📨 IPC: ${type}`);
        triggerSound(type, timestamp);
      });
      console.log('[stats-sounds] IPC listener registered');
    } catch (err) {
      console.warn('[stats-sounds] Failed to register IPC listener:', err);
    }

    // Listen to stats reset button
    const resetBtn = document.getElementById('lolReset');
    if (resetBtn) {
      resetBtn.addEventListener('click', reset);
    }

    console.log('[stats-sounds] Initialized');
  }

  // ═══════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════

  window.__STATS_SOUNDS__ = {
    triggerSound,
    playSound,
    handleGameComplete,
    reset,
    getState: () => ({ currentGame }),
    updateSettings,
    getSettings: () => ({ enabled: soundsEnabled, volume: soundsVolume }),
    loadSettings
  };

  // Auto-initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { init(); loadSettings(); });
  } else {
    init();
    loadSettings();
  }

})();

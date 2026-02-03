/**
 * LoL Stats Sound Notifications
 * 
 * Plays audio notifications for LoL match events based on Grid data.
 * Handles game start detection via ban phase logs.
 */

(function initStatsSounds() {
  'use strict';

  const path = require('path');
  const fs = require('fs');

  // Settings state
  let soundsEnabled = true;
  let soundsVolume = 70; // 0-100

  // Sound file paths
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
    quadraKill: path.join(ASSET_DIR, 'QuadraKill.mp3'),
    pentaKill: path.join(ASSET_DIR, 'PentaKill.mp3')
  };

  // State tracking
  let currentGame = 0; // Last known completed game (0 = none, 1-5 = completed games)
  let banPhaseDetected = false; // Flag for current ban phase
  let lastBanTimestamp = 0; // Debounce rapid ban events
  const BAN_DEBOUNCE_MS = 5000; // Time window to group bans into one phase
  
  // Protection against mass historical log loading
  const initTime = Date.now(); // Script initialization time
  const INIT_GRACE_PERIOD_MS = 5000; // Ignore events during first 5 seconds after init
  const MAX_EVENT_AGE_MS = 15000; // Ignore events older than 15 seconds

  // Audio player pool
  const audioCache = new Map();

  /**
   * Get or create Audio instance for a sound file
   */
  function getAudio(filePath) {
    if (!filePath || !fs.existsSync(filePath)) {
      console.warn('[stats-sounds] Sound file not found:', filePath);
      return null;
    }

    if (!audioCache.has(filePath)) {
      try {
        const audio = new Audio(filePath);
        audio.volume = soundsVolume / 100; // Use setting
        audioCache.set(filePath, audio);
      } catch (e) {
        console.error('[stats-sounds] Failed to create Audio:', e);
        return null;
      }
    }

    const audio = audioCache.get(filePath);
    if (audio) {
      audio.volume = soundsVolume / 100; // Update volume on each get
    }
    return audio;
  }

  /**
   * Check if event is fresh enough to play sound
   * Prevents sound spam when Grid loads historical logs
   * @param {number} eventTimestamp - Event timestamp in ms
   * @param {string} soundType - Type of sound for logging
   */
  function shouldPlaySound(eventTimestamp, soundType = 'unknown') {
    const now = Date.now();
    
    // Grace period: ignore all events during first few seconds after init
    const sinceInit = now - initTime;
    if (sinceInit < INIT_GRACE_PERIOD_MS) {
      console.log(`[stats-sounds] ⏸️ SKIPPED ${soundType}: grace period (${Math.round(sinceInit/1000)}s < ${INIT_GRACE_PERIOD_MS/1000}s since init)`);
      return false;
    }
    
    // If event has timestamp, check if it's recent enough
    if (eventTimestamp) {
      const age = now - eventTimestamp;
      if (age > MAX_EVENT_AGE_MS) {
        console.log(`[stats-sounds] ⏸️ SKIPPED ${soundType}: event too old (${Math.round(age/1000)}s > ${MAX_EVENT_AGE_MS/1000}s) - likely historical data`);
        return false; // Event too old, likely from history dump
      }
    }
    
    return true;
  }

  /**
   * Play sound file
   */
  function playSound(filePath, eventTimestamp) {
    if (!filePath || !soundsEnabled) return;
    if (!shouldPlaySound(eventTimestamp)) return;

    try {
      const audio = getAudio(filePath);
      if (!audio) return;

      // Reset and play (allows overlapping sounds)
      audio.currentTime = 0;
      audio.play().catch(e => {
        console.warn('[stats-sounds] Play failed:', e.message);
      });

      console.log('[stats-sounds] Played:', path.basename(filePath));
    } catch (e) {
      console.error('[stats-sounds] playSound error:', e);
    }
  }

  /**
   * Detect game start from ban phase
   * Grid reports game start only after picks/bans, so we detect it early via ban events
   */
  function handleBanPhase() {
    const now = Date.now();

    // Debounce: group rapid bans into one phase
    if (banPhaseDetected && now - lastBanTimestamp < BAN_DEBOUNCE_MS) {
      lastBanTimestamp = now;
      return; // Still in same ban phase
    }

    // New ban phase detected
    lastBanTimestamp = now;

    // If we weren't in ban phase, this is a new game starting
    if (!banPhaseDetected) {
      banPhaseDetected = true;
      
      // Determine game number
      const gameNumber = currentGame + 1;
      
      if (gameNumber >= 1 && gameNumber <= 5) {
        console.log(`[stats-sounds] Ban phase detected - Game ${gameNumber} starting`);
        playSound(SOUNDS.gameStart[gameNumber]);
      }
    }
  }

  /**
   * Handle game completion (called when stats update shows game ended)
   */
  function handleGameComplete(gameNumber) {
    if (gameNumber > currentGame) {
      currentGame = gameNumber;
      banPhaseDetected = false; // Reset for next game
      console.log(`[stats-sounds] Game ${gameNumber} completed`);
    }
  }

  /**
   * Parse live log text for ban events
   */
  function parseLiveLog(text) {
    if (!text) return null;

    const lower = text.toLowerCase();

    // Ban detection: "banned <champion>"
    if (/\bbanned\b/i.test(text)) {
      return { type: 'ban', text };
    }

    // First Blood
    if (/first blood/i.test(text)) {
      return { type: 'firstBlood', text };
    }

    // First Tower
    if (/first tower|destroyed.*tower/i.test(text)) {
      return { type: 'firstTower', text };
    }

    // Quadra Kill
    if (/quadra kill/i.test(text)) {
      return { type: 'quadraKill', text };
    }

    // Penta Kill
    if (/penta kill/i.test(text)) {
      return { type: 'pentaKill', text };
    }

    return null;
  }

  /**
   * Handle live log event from Grid
   */
  function handleLiveLog(event) {
    try {
      const { text, ts } = event.detail || {};
      
      console.log(`[stats-sounds] Live log received: "${text}" ts=${ts}`);
      
      const parsed = parseLiveLog(text);

      if (!parsed) {
        // Not an event we care about
        return;
      }
      
      console.log(`[stats-sounds] Parsed event: ${parsed.type}`);
      
      // Convert timestamp to milliseconds if present
      const eventTimestamp = ts ? (ts * 1000) : Date.now();

      switch (parsed.type) {
        case 'ban':
          // Ban phase only triggers if it's a fresh event
          if (shouldPlaySound(eventTimestamp)) {
            console.log(`[stats-sounds] Triggering ban phase handler`);
            handleBanPhase();
          }
          break;

        case 'firstBlood':
          playSound(SOUNDS.firstBlood, eventTimestamp);
          break;

        case 'firstTower':
          playSound(SOUNDS.firstTower, eventTimestamp);
          break;

        case 'quadraKill':
          playSound(SOUNDS.quadraKill, eventTimestamp);
          break;

        case 'pentaKill':
          playSound(SOUNDS.pentaKill, eventTimestamp);
          break;
      }
    } catch (e) {
      console.error('[stats-sounds] handleLiveLog error:', e);
    }
  }

  /**
   * Reset state (e.g., when match resets or new series)
   */
  function reset() {
    currentGame = 0;
    banPhaseDetected = false;
    lastBanTimestamp = 0;
    console.log('[stats-sounds] State reset');
  }

  /**
   * Initialize sound system
   */
  function init() {
    // Listen to live log events from Grid (legacy - direct events)
    window.addEventListener('lol-live-log-update', handleLiveLog);

    // Listen to sound events via IPC from Grid BrowserView
    // stats_panel has nodeIntegration:true, so use ipcRenderer directly
    try {
      const { ipcRenderer } = require('electron');
      ipcRenderer.on('lol-sound-event', (_e, { type, timestamp }) => {
        console.log(`[stats-sounds] 📨 IPC sound event: ${type} (ts=${timestamp})`);
        triggerSound(type, timestamp);
      });
      console.log('[stats-sounds] IPC listener registered via ipcRenderer');
    } catch (err) {
      console.warn('[stats-sounds] Failed to register IPC listener:', err);
      // Fallback to desktopAPI if available
      if (window.desktopAPI && window.desktopAPI.onLolSoundEvent) {
        window.desktopAPI.onLolSoundEvent(({ type, timestamp }) => {
          console.log(`[stats-sounds] 📨 IPC sound event (desktopAPI): ${type} (ts=${timestamp})`);
          triggerSound(type, timestamp);
        });
        console.log('[stats-sounds] IPC listener registered via desktopAPI');
      }
    }

    // Listen to stats reset button
    try {
      const resetBtn = document.getElementById('lolReset');
      if (resetBtn) {
        resetBtn.addEventListener('click', reset);
      }
    } catch (e) {
      console.warn('[stats-sounds] Reset button not found');
    }

    console.log('[stats-sounds] Initialized');
  }

  /**
   * Load settings from electron-store
   */
  async function loadSettings() {
    try {
      // stats_panel has nodeIntegration:true, use ipcRenderer directly
      const { ipcRenderer } = require('electron');
      const enabled = await ipcRenderer.invoke('get-setting', 'soundsEnabled');
      const volume = await ipcRenderer.invoke('get-setting', 'soundsVolume');
      
      if (typeof enabled === 'boolean') {
        soundsEnabled = enabled;
      }
      if (typeof volume === 'number') {
        soundsVolume = Math.max(0, Math.min(100, volume));
      }
      
      console.log(`[stats-sounds] Settings loaded: enabled=${soundsEnabled}, volume=${soundsVolume}`);
    } catch (e) {
      console.warn('[stats-sounds] Failed to load settings:', e);
    }
  }

  /**
   * Update settings (called when user changes settings)
   */
  function updateSettings(enabled, volume) {
    if (typeof enabled === 'boolean') {
      soundsEnabled = enabled;
    }
    if (typeof volume === 'number') {
      soundsVolume = Math.max(0, Math.min(100, volume));
    }
    console.log(`[stats-sounds] Settings updated: enabled=${soundsEnabled}, volume=${soundsVolume}`);
  }

  /**
   * Trigger sound from inject script (called by iframe)
   * @param {string} soundType - 'gameStart', 'firstBlood', 'firstTower', 'quadraKill', 'pentaKill'
   * @param {number} eventTimestamp - Event timestamp in milliseconds
   */
  function triggerSound(soundType, eventTimestamp) {
    console.log(`[stats-sounds] 🔔 triggerSound: ${soundType} (ts=${eventTimestamp}, age=${Math.round((Date.now()-eventTimestamp)/1000)}s)`);
    
    if (!soundsEnabled) {
      console.log('[stats-sounds] ⏸️ SKIPPED: sounds disabled in settings');
      return;
    }
    
    if (!shouldPlaySound(eventTimestamp, soundType)) {
      return;
    }
    
    switch (soundType) {
      case 'seriesStart':
        // New series - reset game counter
        console.log('[stats-sounds] 🆕 Series started - resetting game counter');
        currentGame = 0;
        banPhaseDetected = false;
        // No sound for series start, just reset state
        break;
      
      case 'seriesEnd':
        // Series ended - log only
        console.log('[stats-sounds] 🏁 Series ended');
        // No sound for series end
        break;
      
      case 'gameStart':
        // Determine game number and play appropriate sound
        const gameNumber = currentGame + 1;
        if (gameNumber >= 1 && gameNumber <= 5) {
          console.log(`[stats-sounds] ▶️ Playing game ${gameNumber} start sound`);
          playSound(SOUNDS.gameStart[gameNumber], eventTimestamp);
          // Update state after playing
          currentGame = gameNumber;
          banPhaseDetected = false;
        }
        break;
      
      case 'firstBlood':
        console.log('[stats-sounds] 🩸 Playing first blood sound');
        playSound(SOUNDS.firstBlood, eventTimestamp);
        break;
      
      case 'firstTower':
        console.log('[stats-sounds] 🏰 Playing first tower sound');
        playSound(SOUNDS.firstTower, eventTimestamp);
        break;
      
      case 'quadraKill':
        console.log('[stats-sounds] 💀 Playing quadra kill sound');
        playSound(SOUNDS.quadraKill, eventTimestamp);
        break;
      
      case 'pentaKill':
        console.log('[stats-sounds] ☠️ Playing penta kill sound');
        playSound(SOUNDS.pentaKill, eventTimestamp);
        break;
      
      default:
        console.warn(`[stats-sounds] Unknown sound type: ${soundType}`);
    }
  }

  // Expose API for external control
  window.__STATS_SOUNDS__ = {
    playSound,
    handleGameComplete,
    reset,
    getState: () => ({ currentGame, banPhaseDetected }),
    updateSettings,
    getSettings: () => ({ enabled: soundsEnabled, volume: soundsVolume }),
    loadSettings,
    triggerSound // Add new method for iframe calls
  };

  // Auto-initialize when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      init();
      loadSettings();
    });
  } else {
    init();
    loadSettings();
  }

})();

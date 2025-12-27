/**
 * Game Core - Central game engine (singleton)
 * 
 * Architecture:
 * - GameCore runs game logic in sidebar (the "brain")
 * - Renderers subscribe to receive state updates
 * - Detached window is JUST a display - no logic duplication
 * 
 * Flow:
 *   GameCore.tick() → broadcast('tick', state) → [embedded canvas, detached window]
 *   Input from detached window → IPC → GameCore.input()
 */

// ============================================
// SUBSCRIBERS
// ============================================

const localSubscribers = new Set();   // Embedded renderer callbacks
let ipcBroadcast = null;              // Function to send to detached window via IPC

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  tickRate: 100,          // ms between ticks
  canvasWidth: 280,
  canvasHeight: 280,
  gridSize: 20
};

// ============================================
// GAME STATE
// ============================================

const state = {
  running: false,
  paused: false,
  score: 0,
  highScore: 0,
  gameData: null,         // Game-specific data (override per game)
  inputQueue: []
};

let loopId = null;
let lastTick = 0;

// ============================================
// BROADCAST SYSTEM
// ============================================

/**
 * Broadcast event to all subscribers (local + detached)
 * @param {string} type - Event type
 * @param {object} payload - Event data
 */
function broadcast(type, payload = {}) {
  const message = { type, payload, ts: Date.now() };
  
  // Local subscribers
  localSubscribers.forEach(cb => {
    try { cb(message); } catch (e) { console.error('[GameCore] subscriber error:', e); }
  });
  
  // IPC to detached window (if connected)
  if (ipcBroadcast) {
    try { ipcBroadcast(message); } catch (e) { console.error('[GameCore] IPC broadcast error:', e); }
  }
}

/**
 * Subscribe to game events (for embedded renderer)
 * @param {Function} callback - (message: {type, payload, ts}) => void
 * @returns {Function} Unsubscribe function
 */
function subscribe(callback) {
  localSubscribers.add(callback);
  // Immediate sync
  callback({ type: 'sync', payload: getSnapshot(), ts: Date.now() });
  return () => localSubscribers.delete(callback);
}

/**
 * Set IPC broadcast function (for detached window communication)
 * @param {Function|null} fn - (message) => void, or null to disconnect
 */
function setIpcBroadcast(fn) {
  ipcBroadcast = fn;
  // Sync new connection
  if (fn) {
    fn({ type: 'sync', payload: getSnapshot(), ts: Date.now() });
  }
}

/**
 * Check if detached window is connected
 */
function hasDetachedWindow() {
  return ipcBroadcast !== null;
}

// ============================================
// STATE MANAGEMENT
// ============================================

/**
 * Get full state snapshot
 */
function getSnapshot() {
  return {
    running: state.running,
    paused: state.paused,
    score: state.score,
    highScore: state.highScore,
    gameData: state.gameData ? JSON.parse(JSON.stringify(state.gameData)) : null,
    config: { ...CONFIG }
  };
}

/**
 * Get config
 */
function getConfig() {
  return { ...CONFIG };
}

// ============================================
// GAME LIFECYCLE
// ============================================

/**
 * Initialize new game
 */
function init() {
  state.score = 0;
  state.inputQueue = [];
  state.gameData = createGameData();
  broadcast('init', getSnapshot());
}

/**
 * Create initial game data - override for specific game
 */
function createGameData() {
  return { type: 'placeholder', ready: true };
}

/**
 * Start game
 */
function start() {
  if (state.running && !state.paused) return;
  
  if (!state.running) {
    init();
  }
  
  state.running = true;
  state.paused = false;
  lastTick = Date.now();
  
  broadcast('start', { running: true, paused: false });
  runLoop();
}

/**
 * Stop game
 */
function stop() {
  state.running = false;
  state.paused = false;
  stopLoop();
  broadcast('stop', { running: false });
}

/**
 * Toggle pause
 */
function togglePause() {
  if (!state.running) return;
  
  state.paused = !state.paused;
  
  if (state.paused) {
    stopLoop();
    broadcast('pause', { paused: true });
  } else {
    lastTick = Date.now();
    broadcast('resume', { paused: false });
    runLoop();
  }
}

/**
 * Reset game
 */
function reset() {
  stop();
  state.score = 0;
  state.gameData = null;
  broadcast('reset', getSnapshot());
}

/**
 * Handle game over
 */
function triggerGameOver() {
  const isNewHigh = state.score > state.highScore;
  if (isNewHigh) {
    state.highScore = state.score;
    saveHighScore();
  }
  
  stop();
  broadcast('gameover', { 
    score: state.score, 
    highScore: state.highScore, 
    isNewHigh 
  });
}

// ============================================
// GAME LOOP
// ============================================

function runLoop() {
  if (!state.running || state.paused) return;
  
  const now = Date.now();
  if (now - lastTick >= CONFIG.tickRate) {
    lastTick = now;
    tick();
  }
  
  loopId = requestAnimationFrame(runLoop);
}

function stopLoop() {
  if (loopId) {
    cancelAnimationFrame(loopId);
    loopId = null;
  }
}

/**
 * Main tick - override processInput/updateState/checkGameOver for game logic
 */
function tick() {
  // Process queued inputs
  while (state.inputQueue.length > 0) {
    processInput(state.inputQueue.shift());
  }
  
  // Update game state
  updateState();
  
  // Check end condition
  if (checkGameOver()) {
    triggerGameOver();
    return;
  }
  
  // Broadcast tick for rendering
  broadcast('tick', {
    score: state.score,
    gameData: state.gameData
  });
}

/**
 * Process single input - override for game
 */
function processInput(action) {
  // Default: no-op
}

/**
 * Update game state - override for game
 */
function updateState() {
  // Default: no-op
}

/**
 * Check game over - override for game
 */
function checkGameOver() {
  return false;
}

// ============================================
// INPUT
// ============================================

/**
 * Queue input action
 * @param {string} action - 'up', 'down', 'left', 'right', 'action'
 */
function input(action) {
  if (!state.running || state.paused) return;
  state.inputQueue.push(action);
}

// ============================================
// SCORING
// ============================================

function addScore(pts) {
  state.score += pts;
  broadcast('score', { score: state.score });
}

function getScore() {
  return state.score;
}

function getHighScore() {
  return state.highScore;
}

// ============================================
// PERSISTENCE
// ============================================

function loadHighScore() {
  try {
    const saved = localStorage.getItem('game-core-highscore');
    if (saved) state.highScore = parseInt(saved, 10) || 0;
  } catch (e) { /* ignore */ }
}

function saveHighScore() {
  try {
    localStorage.setItem('game-core-highscore', String(state.highScore));
  } catch (e) { /* ignore */ }
}

// Load on module init
loadHighScore();

// ============================================
// EXPORTS
// ============================================

const GameCore = {
  // Config
  getConfig,
  CONFIG,
  
  // State
  getSnapshot,
  getScore,
  getHighScore,
  
  // Subscriptions
  subscribe,
  setIpcBroadcast,
  hasDetachedWindow,
  broadcast,
  
  // Lifecycle
  start,
  stop,
  reset,
  togglePause,
  
  // Input
  input,
  
  // Scoring (for game implementations)
  addScore,
  
  // Direct state access (for game implementations)
  _state: state,
  _setGameData: (data) => { state.gameData = data; },
  _triggerGameOver: triggerGameOver
};

// CommonJS export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { GameCore };
}

// Global export
if (typeof window !== 'undefined') {
  window.GameCore = GameCore;
}

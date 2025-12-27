/**
 * Game Module - Mini-game for the sidebar
 * 
 * Architecture:
 * - GameCore (core.js): Central game logic, runs here in sidebar
 * - GameRenderer (renderer.js): Display-only canvas renderer
 * - Detached window: Just displays, no logic duplication
 * 
 * The core broadcasts state to all connected renderers (embedded + detached).
 */

const { SidebarModule, registerModule, eventBus } = require('../../core/sidebar-base');
const { GameCore } = require('./core');
const { GameRenderer } = require('./renderer');

class GameModule extends SidebarModule {
  static id = 'game';
  static title = 'Mini Game';
  static icon = `<svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-10 7H8v3H6v-3H3v-2h3V8h2v3h3v2zm4.5 2c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4-3c-.83 0-1.5-.67-1.5-1.5S18.67 9 19.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
  </svg>`;
  static order = 100; // Lower in sidebar (after odds-board)

  constructor(options) {
    super(options);
    this.gameState = {
      running: false,
      paused: false,
      score: 0,
      highScore: 0
    };
    this.canvas = null;
    this.ctx = null;
    this.animationId = null;
    
    // Detach state
    this.isDetached = false;
    this.detachedWindowId = null;
    this.renderer = null;
    this.coreUnsubscribe = null;
  }

  getTemplate() {
    return `
      <div class="game-container">
        <div class="game-header">
          <div class="game-score">
            <span class="score-label">Score:</span>
            <span class="score-value" id="game-score">0</span>
          </div>
          <div class="game-high-score">
            <span class="score-label">Best:</span>
            <span class="score-value" id="game-high-score">0</span>
          </div>
          <button id="game-detach" class="game-btn game-btn-icon" title="Detach to separate window">
            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
              <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
            </svg>
          </button>
        </div>
        
        <div class="game-canvas-wrapper" id="game-canvas-wrapper">
          <canvas id="game-canvas" width="280" height="280"></canvas>
          <div class="game-overlay" id="game-overlay">
            <div class="overlay-content">
              <div class="overlay-title" id="overlay-title">🎮 Ready?</div>
              <div class="overlay-subtitle" id="overlay-subtitle">Press Start to play</div>
            </div>
          </div>
        </div>
        
        <div class="game-controls">
          <button id="game-start" class="game-btn game-btn-primary">
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
              <path d="M8 5v14l11-7z"/>
            </svg>
            <span>Start</span>
          </button>
          <button id="game-pause" class="game-btn" disabled>
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
            </svg>
            <span>Pause</span>
          </button>
          <button id="game-reset" class="game-btn">
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
              <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
            </svg>
          </button>
        </div>
        
        <div class="game-instructions">
          <p id="game-instructions-text">Select a game to play!</p>
        </div>
      </div>
    `;
  }

  onMount(container) {
    super.onMount(container);
    
    this.canvas = this.$('#game-canvas');
    this.ctx = this.canvas?.getContext('2d');
    
    // Initialize renderer and connect to GameCore
    this.renderer = new GameRenderer(this.canvas);
    this.setupCoreConnection();
    
    this.loadHighScore();
    this.bindEvents();
    this.drawInitialState();
  }

  onUnmount() {
    this.stopGame();
    this.disconnectCore();
    if (this.detachedWindowId) {
      this.attachWindow();
    }
    super.onUnmount();
  }

  /**
   * Connect to GameCore for state updates
   */
  setupCoreConnection() {
    // Subscribe to GameCore events
    this.coreUnsubscribe = GameCore.subscribe((message) => {
      this.handleCoreMessage(message);
    });
    
    // Setup IPC listeners for detached window communication
    this.setupDetachIpc();
  }

  /**
   * Disconnect from GameCore
   */
  disconnectCore() {
    if (this.coreUnsubscribe) {
      this.coreUnsubscribe();
      this.coreUnsubscribe = null;
    }
  }

  /**
   * Handle messages from GameCore
   */
  handleCoreMessage(message) {
    const { type, payload } = message;
    
    // Update local state
    switch (type) {
      case 'sync':
      case 'init':
        this.gameState = { ...this.gameState, ...payload };
        this.updateScoreDisplay();
        break;
      case 'start':
        this.gameState.running = true;
        this.gameState.paused = false;
        this.hideOverlay();
        this.updateButtonStates();
        break;
      case 'pause':
        this.gameState.paused = true;
        this.showOverlay('⏸️ Paused', 'Press Pause or Esc to continue');
        this.updateButtonStates();
        break;
      case 'resume':
        this.gameState.paused = false;
        this.hideOverlay();
        this.updateButtonStates();
        break;
      case 'stop':
      case 'reset':
        this.gameState.running = false;
        this.gameState.paused = false;
        this.showOverlay('🎮 Ready?', 'Press Start to play');
        this.updateScoreDisplay();
        this.updateButtonStates();
        break;
      case 'gameover':
        this.gameState.running = false;
        this.gameState.score = payload.score;
        this.gameState.highScore = payload.highScore;
        if (payload.isNewHigh) {
          this.showOverlay('🏆 New High Score!', `Score: ${payload.score}`);
        } else {
          this.showOverlay('💀 Game Over', `Score: ${payload.score}`);
        }
        this.updateScoreDisplay();
        this.updateButtonStates();
        break;
      case 'tick':
      case 'score':
        this.gameState.score = payload.score ?? this.gameState.score;
        this.updateScoreDisplay();
        break;
    }
    
    // Forward to detached window if connected
    if (this.isDetached && this.detachedWindowId) {
      this.broadcastToDetached(message);
    }
    
    // Renderer handles its own rendering via subscription
    if (this.renderer && !this.isDetached) {
      this.renderer.handleMessage(message);
    }
  }

  bindEvents() {
    // Start button
    this.$('#game-start')?.addEventListener('click', () => {
      if (!this.gameState.running) {
        GameCore.start();
      }
    });

    // Pause button
    this.$('#game-pause')?.addEventListener('click', () => {
      GameCore.togglePause();
    });

    // Reset button
    this.$('#game-reset')?.addEventListener('click', () => {
      GameCore.reset();
    });

    // Detach button
    this.$('#game-detach')?.addEventListener('click', () => {
      this.toggleDetach();
    });

    // Keyboard controls
    this._keyHandler = (e) => this.handleKeydown(e);
    document.addEventListener('keydown', this._keyHandler);
  }

  handleKeydown(e) {
    // Escape always works for pause
    if (e.key === 'Escape' && this.gameState.running) {
      GameCore.togglePause();
      return;
    }
    
    if (!this.gameState.running || this.gameState.paused) return;
    
    // Forward input to GameCore
    switch (e.key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        GameCore.input('up');
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        GameCore.input('down');
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        GameCore.input('left');
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        GameCore.input('right');
        break;
      case ' ':
        GameCore.input('action');
        break;
    }
  }

  // ============================================
  // DETACH FUNCTIONALITY
  // ============================================

  /**
   * Setup IPC listeners for detach communication
   */
  setupDetachIpc() {
    const api = window.desktopAPI;
    if (!api) return;

    // Listen for detached window ready
    if (api.onGameWindowReady) {
      this._ipcCleanup.push(
        api.onGameWindowReady(({ windowId }) => {
          if (windowId === this.detachedWindowId) {
            // Send current state to newly connected window
            this.broadcastToDetached({ type: 'sync', payload: GameCore.getSnapshot() });
          }
        })
      );
    }

    // Listen for detached window closed
    if (api.onGameWindowClosed) {
      this._ipcCleanup.push(
        api.onGameWindowClosed(({ windowId }) => {
          if (windowId === this.detachedWindowId) {
            this.onDetachedWindowClosed();
          }
        })
      );
    }

    // Listen for input from detached window
    if (api.onGameDetachedInput) {
      this._ipcCleanup.push(
        api.onGameDetachedInput(({ action }) => {
          GameCore.input(action);
        })
      );
    }

    // Listen for commands from detached window
    if (api.onGameDetachedCommand) {
      this._ipcCleanup.push(
        api.onGameDetachedCommand(({ cmd }) => {
          this.handleDetachedCommand(cmd);
        })
      );
    }
  }

  /**
   * Handle commands from detached window
   */
  handleDetachedCommand(cmd) {
    switch (cmd) {
      case 'start':
        GameCore.start();
        break;
      case 'stop':
        GameCore.stop();
        break;
      case 'reset':
        GameCore.reset();
        break;
      case 'togglePause':
        GameCore.togglePause();
        break;
      case 'attach':
        this.attachWindow();
        break;
    }
  }

  /**
   * Toggle between embedded and detached mode
   */
  async toggleDetach() {
    if (this.isDetached) {
      await this.attachWindow();
    } else {
      await this.detachWindow();
    }
  }

  /**
   * Open detached window
   */
  async detachWindow() {
    const api = window.desktopAPI;
    if (!api?.invoke) {
      console.warn('[Game] desktopAPI.invoke not available');
      return;
    }

    try {
      const result = await api.invoke('game-detach', {
        width: 340,
        height: 460
      });

      if (result?.success && result.windowId) {
        this.detachedWindowId = result.windowId;
        this.isDetached = true;
        this.updateDetachButton();
        this.hideEmbeddedCanvas();
        
        console.log('[Game] Detached to window:', result.windowId);
      } else {
        console.error('[Game] Failed to detach:', result?.error);
      }
    } catch (err) {
      console.error('[Game] Detach error:', err);
    }
  }

  /**
   * Close detached window and return to embedded
   */
  async attachWindow() {
    const api = window.desktopAPI;
    
    if (this.detachedWindowId && api?.invoke) {
      try {
        await api.invoke('game-attach', { windowId: this.detachedWindowId });
      } catch (e) { /* ignore */ }
    }

    this.detachedWindowId = null;
    this.isDetached = false;
    this.updateDetachButton();
    this.showEmbeddedCanvas();
    
    // Re-sync renderer
    if (this.renderer) {
      this.renderer.handleMessage({ type: 'sync', payload: GameCore.getSnapshot() });
    }
    
    console.log('[Game] Attached back to sidebar');
  }

  /**
   * Handle detached window closed externally
   */
  onDetachedWindowClosed() {
    this.detachedWindowId = null;
    this.isDetached = false;
    this.updateDetachButton();
    this.showEmbeddedCanvas();
    
    // Re-sync renderer
    if (this.renderer) {
      this.renderer.handleMessage({ type: 'sync', payload: GameCore.getSnapshot() });
    }
  }

  /**
   * Send message to detached window via IPC
   */
  broadcastToDetached(message) {
    const api = window.desktopAPI;
    if (!api?.send || !this.detachedWindowId) return;

    try {
      api.send('game-broadcast', {
        windowId: this.detachedWindowId,
        message
      });
    } catch (e) {
      console.warn('[Game] Broadcast error:', e);
    }
  }

  /**
   * Update detach button appearance
   */
  updateDetachButton() {
    const btn = this.$('#game-detach');
    if (!btn) return;

    if (this.isDetached) {
      btn.title = 'Attach back to sidebar';
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
          <path d="M19 11H7.83l4.88-4.88c.39-.39.39-1.03 0-1.42-.39-.39-1.02-.39-1.41 0l-6.59 6.59c-.39.39-.39 1.02 0 1.41l6.59 6.59c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41L7.83 13H19c.55 0 1-.45 1-1s-.45-1-1-1z"/>
        </svg>
      `;
      btn.classList.add('detached');
    } else {
      btn.title = 'Detach to separate window';
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
          <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
        </svg>
      `;
      btn.classList.remove('detached');
    }
  }

  /**
   * Hide embedded canvas when detached
   */
  hideEmbeddedCanvas() {
    const wrapper = this.$('#game-canvas-wrapper');
    if (wrapper) {
      wrapper.classList.add('detached-mode');
    }
    // Show "detached" message
    this.showOverlay('📺 Detached', 'Game is running in separate window');
  }

  /**
   * Show embedded canvas when attached
   */
  showEmbeddedCanvas() {
    const wrapper = this.$('#game-canvas-wrapper');
    if (wrapper) {
      wrapper.classList.remove('detached-mode');
    }
  }

  // ============================================
  // GAME LIFECYCLE - Now delegated to GameCore
  // These methods are kept for backwards compatibility
  // ============================================

  /**
   * @deprecated Use GameCore.start() instead
   */
  initGame() {
    // GameCore handles initialization
  }

  /**
   * @deprecated Use GameCore.input() instead
   */
  onInput(direction) {
    GameCore.input(direction);
  }

  /**
   * @deprecated Rendering handled by GameRenderer
   */
  render() {
    // Renderer handles this
  }

  /**
   * @deprecated Use GameCore checkGameOver
   */
  checkGameOver() {
    return false;
  }

  // ============================================
  // GAME CONTROL METHODS - Delegate to GameCore
  // ============================================

  startGame() {
    GameCore.start();
  }

  stopGame() {
    GameCore.stop();
  }

  togglePause() {
    GameCore.togglePause();
  }

  resetGame() {
    GameCore.reset();
  }

  gameOver() {
    // Handled by GameCore
  }

  gameLoop() {
    // Handled by GameCore
  }

  gameTick() {
    // Handled by GameCore
  }

  // ============================================
  // UI HELPERS
  // ============================================

  drawInitialState() {
    if (!this.ctx) return;
    
    const { width, height } = this.canvas;
    
    // Background
    this.ctx.fillStyle = '#1a1a2e';
    this.ctx.fillRect(0, 0, width, height);
    
    // Grid pattern
    this.ctx.strokeStyle = '#25254033';
    this.ctx.lineWidth = 1;
    const gridSize = 20;
    
    for (let x = 0; x <= width; x += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, height);
      this.ctx.stroke();
    }
    
    for (let y = 0; y <= height; y += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(width, y);
      this.ctx.stroke();
    }
  }

  showOverlay(title, subtitle) {
    const overlay = this.$('#game-overlay');
    const titleEl = this.$('#overlay-title');
    const subtitleEl = this.$('#overlay-subtitle');
    
    if (titleEl) titleEl.textContent = title;
    if (subtitleEl) subtitleEl.textContent = subtitle;
    if (overlay) overlay.classList.remove('hidden');
  }

  hideOverlay() {
    const overlay = this.$('#game-overlay');
    if (overlay) overlay.classList.add('hidden');
  }

  updateScoreDisplay() {
    const scoreEl = this.$('#game-score');
    const highScoreEl = this.$('#game-high-score');
    
    if (scoreEl) scoreEl.textContent = this.gameState.score;
    if (highScoreEl) highScoreEl.textContent = this.gameState.highScore;
  }

  updateButtonStates() {
    const startBtn = this.$('#game-start');
    const pauseBtn = this.$('#game-pause');
    
    if (startBtn) {
      startBtn.disabled = this.gameState.running && !this.gameState.paused;
    }
    if (pauseBtn) {
      pauseBtn.disabled = !this.gameState.running;
      const span = pauseBtn.querySelector('span');
      if (span) span.textContent = this.gameState.paused ? 'Resume' : 'Pause';
    }
  }

  addScore(points) {
    this.gameState.score += points;
    this.updateScoreDisplay();
    
    // Emit score event for other modules
    eventBus.emit('game:score', { score: this.gameState.score });
  }

  // ============================================
  // PERSISTENCE
  // ============================================

  loadHighScore() {
    try {
      const saved = localStorage.getItem('game-high-score');
      if (saved) {
        this.gameState.highScore = parseInt(saved, 10) || 0;
        this.updateScoreDisplay();
      }
    } catch (e) {
      console.warn('[Game] Failed to load high score:', e);
    }
  }

  saveHighScore() {
    try {
      localStorage.setItem('game-high-score', String(this.gameState.highScore));
    } catch (e) {
      console.warn('[Game] Failed to save high score:', e);
    }
  }
}

// Register the module
registerModule(GameModule);

module.exports = { GameModule };

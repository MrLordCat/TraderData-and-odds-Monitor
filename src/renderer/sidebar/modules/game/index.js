/**
 * Game Module - Mini-game for the sidebar
 * 
 * This is a placeholder game module that can be customized
 * to implement any mini-game (Snake, Tetris, Tic-Tac-Toe, etc.)
 */

const { SidebarModule, registerModule, eventBus } = require('../../core/sidebar-base');

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
        </div>
        
        <div class="game-canvas-wrapper">
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
    
    this.loadHighScore();
    this.bindEvents();
    this.drawInitialState();
  }

  onUnmount() {
    this.stopGame();
    super.onUnmount();
  }

  bindEvents() {
    // Start button
    this.$('#game-start')?.addEventListener('click', () => {
      if (!this.gameState.running) {
        this.startGame();
      }
    });

    // Pause button
    this.$('#game-pause')?.addEventListener('click', () => {
      this.togglePause();
    });

    // Reset button
    this.$('#game-reset')?.addEventListener('click', () => {
      this.resetGame();
    });

    // Keyboard controls
    this._keyHandler = (e) => this.handleKeydown(e);
    document.addEventListener('keydown', this._keyHandler);
  }

  handleKeydown(e) {
    if (!this.gameState.running || this.gameState.paused) return;
    
    // Override in game implementation
    // Example: Arrow keys, WASD, Space, etc.
    switch (e.key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        this.onInput('up');
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        this.onInput('down');
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        this.onInput('left');
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        this.onInput('right');
        break;
      case ' ':
        this.onInput('action');
        break;
      case 'Escape':
        this.togglePause();
        break;
    }
  }

  // ============================================
  // GAME LIFECYCLE - Override these in subclass
  // ============================================

  /**
   * Initialize game state
   * Override in game implementation
   */
  initGame() {
    this.gameState.score = 0;
    this.updateScoreDisplay();
  }

  /**
   * Main game loop tick
   * Override in game implementation
   */
  gameTick() {
    // Game logic here
    this.render();
  }

  /**
   * Handle player input
   * @param {string} direction - 'up', 'down', 'left', 'right', 'action'
   */
  onInput(direction) {
    // Handle input in game implementation
    console.log('[Game] Input:', direction);
  }

  /**
   * Render game state to canvas
   * Override in game implementation
   */
  render() {
    if (!this.ctx) return;
    
    const { width, height } = this.canvas;
    
    // Clear canvas
    this.ctx.fillStyle = 'var(--md-sys-color-surface-container-lowest, #1a1a1a)';
    this.ctx.fillRect(0, 0, width, height);
    
    // Draw placeholder
    this.ctx.fillStyle = 'var(--md-sys-color-on-surface, #fff)';
    this.ctx.font = '16px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('Game Running...', width / 2, height / 2);
  }

  /**
   * Check for game over condition
   * @returns {boolean}
   */
  checkGameOver() {
    return false;
  }

  // ============================================
  // GAME CONTROL METHODS
  // ============================================

  startGame() {
    this.initGame();
    this.gameState.running = true;
    this.gameState.paused = false;
    
    this.hideOverlay();
    this.updateButtonStates();
    
    this.gameLoop();
  }

  stopGame() {
    this.gameState.running = false;
    this.gameState.paused = false;
    
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  togglePause() {
    if (!this.gameState.running) return;
    
    this.gameState.paused = !this.gameState.paused;
    
    if (this.gameState.paused) {
      this.showOverlay('⏸️ Paused', 'Press Pause or Esc to continue');
    } else {
      this.hideOverlay();
      this.gameLoop();
    }
    
    this.updateButtonStates();
  }

  resetGame() {
    this.stopGame();
    this.gameState.score = 0;
    this.updateScoreDisplay();
    this.drawInitialState();
    this.showOverlay('🎮 Ready?', 'Press Start to play');
    this.updateButtonStates();
  }

  gameOver() {
    this.stopGame();
    
    if (this.gameState.score > this.gameState.highScore) {
      this.gameState.highScore = this.gameState.score;
      this.saveHighScore();
      this.showOverlay('🏆 New High Score!', `Score: ${this.gameState.score}`);
    } else {
      this.showOverlay('💀 Game Over', `Score: ${this.gameState.score}`);
    }
    
    this.updateButtonStates();
  }

  gameLoop() {
    if (!this.gameState.running || this.gameState.paused) return;
    
    this.gameTick();
    
    if (this.checkGameOver()) {
      this.gameOver();
      return;
    }
    
    // ~60 FPS, можно настроить скорость
    this.animationId = requestAnimationFrame(() => {
      setTimeout(() => this.gameLoop(), 100); // Adjust speed here
    });
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

/**
 * Game Renderer - Display-only canvas renderer
 * 
 * This renderer can work in both embedded (sidebar) and detached (window) contexts.
 * It subscribes to GameCore events and renders to canvas.
 * NO GAME LOGIC HERE - only rendering.
 */

class GameRenderer {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas?.getContext('2d');
    this.options = {
      showGrid: true,
      gridSize: 20,
      backgroundColor: '#1a1a2e',
      gridColor: '#25254033',
      textColor: '#ffffff',
      ...options
    };
    
    this.state = null;
    this.unsubscribe = null;
  }

  /**
   * Connect to GameCore and start rendering
   * @param {object} GameCore - GameCore instance
   */
  connect(GameCore) {
    if (!GameCore) {
      console.warn('[GameRenderer] No GameCore provided');
      return;
    }
    
    this.unsubscribe = GameCore.subscribe((message) => {
      this.handleMessage(message);
    });
  }

  /**
   * Disconnect from GameCore
   */
  disconnect() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  /**
   * Handle message from GameCore
   */
  handleMessage(message) {
    const { type, payload } = message;
    
    switch (type) {
      case 'sync':
      case 'init':
        this.state = payload;
        this.render();
        break;
        
      case 'tick':
        this.state = { ...this.state, ...payload };
        this.render();
        break;
        
      case 'start':
      case 'resume':
        if (this.state) {
          this.state.running = true;
          this.state.paused = false;
        }
        this.render();
        break;
        
      case 'pause':
        if (this.state) {
          this.state.paused = true;
        }
        this.renderPaused();
        break;
        
      case 'stop':
      case 'reset':
        this.state = payload || this.state;
        this.renderInitial();
        break;
        
      case 'gameover':
        this.state = { ...this.state, ...payload };
        this.renderGameOver(payload);
        break;
        
      case 'score':
        if (this.state) {
          this.state.score = payload.score;
        }
        break;
    }
  }

  /**
   * Main render - override for specific game
   */
  render() {
    if (!this.ctx) return;
    
    const { width, height } = this.canvas;
    
    // Clear
    this.ctx.fillStyle = this.options.backgroundColor;
    this.ctx.fillRect(0, 0, width, height);
    
    // Grid
    if (this.options.showGrid) {
      this.drawGrid();
    }
    
    // Game-specific rendering
    if (this.state?.gameData) {
      this.renderGame(this.state.gameData);
    } else {
      // Placeholder
      this.ctx.fillStyle = this.options.textColor;
      this.ctx.font = '14px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('Game Running...', width / 2, height / 2);
    }
  }

  /**
   * Render game data - override for specific game
   */
  renderGame(gameData) {
    // Override in subclass
    if (!this.ctx) return;
    
    const { width, height } = this.canvas;
    this.ctx.fillStyle = this.options.textColor;
    this.ctx.font = '12px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`Score: ${this.state?.score || 0}`, width / 2, height / 2);
  }

  /**
   * Render initial state
   */
  renderInitial() {
    if (!this.ctx) return;
    
    const { width, height } = this.canvas;
    
    this.ctx.fillStyle = this.options.backgroundColor;
    this.ctx.fillRect(0, 0, width, height);
    
    if (this.options.showGrid) {
      this.drawGrid();
    }
  }

  /**
   * Render paused state
   */
  renderPaused() {
    this.render();
    
    if (!this.ctx) return;
    const { width, height } = this.canvas;
    
    // Dim overlay
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    this.ctx.fillRect(0, 0, width, height);
    
    // Pause text
    this.ctx.fillStyle = '#fff';
    this.ctx.font = 'bold 24px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('⏸️ PAUSED', width / 2, height / 2);
  }

  /**
   * Render game over state
   */
  renderGameOver(data) {
    this.render();
    
    if (!this.ctx) return;
    const { width, height } = this.canvas;
    
    // Dim overlay
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(0, 0, width, height);
    
    // Game over text
    this.ctx.fillStyle = '#fff';
    this.ctx.font = 'bold 20px sans-serif';
    this.ctx.textAlign = 'center';
    
    if (data.isNewHigh) {
      this.ctx.fillText('🏆 NEW HIGH SCORE!', width / 2, height / 2 - 20);
    } else {
      this.ctx.fillText('💀 GAME OVER', width / 2, height / 2 - 20);
    }
    
    this.ctx.font = '16px sans-serif';
    this.ctx.fillText(`Score: ${data.score}`, width / 2, height / 2 + 15);
  }

  /**
   * Draw grid pattern
   */
  drawGrid() {
    if (!this.ctx) return;
    
    const { width, height } = this.canvas;
    const { gridSize, gridColor } = this.options;
    
    this.ctx.strokeStyle = gridColor;
    this.ctx.lineWidth = 1;
    
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

  /**
   * Update canvas size
   */
  resize(width, height) {
    if (this.canvas) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.render();
    }
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { GameRenderer };
}

if (typeof window !== 'undefined') {
  window.GameRenderer = GameRenderer;
}

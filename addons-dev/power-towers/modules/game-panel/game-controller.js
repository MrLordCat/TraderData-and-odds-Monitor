/**
 * Power Towers TD - Game Controller
 * Handles game logic, canvas, events for detached mode
 */

class GameController {
  constructor(options = {}) {
    // Game modules (loaded externally)
    this.GameCore = options.GameCore;
    this.GameRenderer = options.GameRenderer;
    this.Camera = options.Camera;
    this.GameEvents = options.GameEvents;
    this.TOWER_PATHS = options.TOWER_PATHS;
    this.CONFIG = options.CONFIG;
    
    // DOM elements
    this.canvas = null;
    this.canvasContainer = null;
    this.elements = {};
    this.screens = {};
    
    // Game state
    this.game = null;
    this.renderer = null;
    this.camera = null;
    this.resizeObserver = null;
    
    this.placingTower = false;
    this.selectedPath = 'fire';
    this.currentScreen = 'menu';
    
    this._savedState = options.savedState || null;
  }
  
  /**
   * Initialize controller with container
   */
  init(container) {
    // Cache screen elements
    this.screens = {
      menu: container.querySelector('#screen-menu'),
      upgrades: container.querySelector('#screen-upgrades'),
      tips: container.querySelector('#screen-tips'),
      settings: container.querySelector('#screen-settings'),
      game: container.querySelector('#screen-game')
    };
    
    // Cache game elements
    this.canvas = container.querySelector('#game-canvas');
    this.canvasContainer = container.querySelector('.canvas-container');
    this.elements = {
      gold: container.querySelector('#stat-gold'),
      lives: container.querySelector('#stat-lives'),
      energy: container.querySelector('#stat-energy'),
      wave: container.querySelector('#stat-wave'),
      overlay: container.querySelector('#game-overlay'),
      overlayTitle: container.querySelector('#overlay-title'),
      overlayMessage: container.querySelector('#overlay-message'),
      overlayBtn: container.querySelector('#overlay-btn'),
      towerSelect: container.querySelector('#tower-select'),
      towerInfo: container.querySelector('#tower-info'),
      towerName: container.querySelector('#tower-name'),
      towerTier: container.querySelector('#tower-tier'),
      towerDmg: container.querySelector('#tower-dmg'),
      towerRng: container.querySelector('#tower-rng'),
      towerSpd: container.querySelector('#tower-spd'),
      btnStart: container.querySelector('#btn-start'),
      btnTower: container.querySelector('#btn-tower'),
      btnUpgrade: container.querySelector('#btn-upgrade'),
      btnSell: container.querySelector('#btn-sell')
    };
    
    // Setup navigation
    this.setupScreenNavigation(container);
    
    // Setup resize observer
    this.setupResizeObserver();
    
    // Check saved state
    if (this._savedState) {
      this.restoreFromSavedState(this._savedState);
    } else {
      this.showScreen('menu');
    }
  }
  
  /**
   * Setup resize observer for dynamic canvas
   */
  setupResizeObserver() {
    if (!this.canvasContainer) return;
    
    this.resizeObserver = new ResizeObserver(() => {
      this.resizeCanvas();
    });
    this.resizeObserver.observe(this.canvasContainer);
    
    // Initial resize
    setTimeout(() => this.resizeCanvas(), 50);
  }
  
  /**
   * Resize canvas to fit container
   */
  resizeCanvas() {
    if (!this.canvas || !this.canvasContainer) return;
    
    const rect = this.canvasContainer.getBoundingClientRect();
    const size = Math.floor(Math.min(rect.width, rect.height) - 10);
    
    if (size < 200 || Math.abs(this.canvas.width - size) < 5) return;
    
    console.log('[game-controller] Canvas resize:', size);
    
    this.canvas.width = size;
    this.canvas.height = size;
    
    if (this.camera) {
      this.camera.setViewportSize(size, size);
    }
    if (this.renderer) {
      this.renderer.width = size;
      this.renderer.height = size;
    }
    
    this.renderGame();
  }
  
  /**
   * Get serialized state for save
   */
  getSerializedState() {
    const state = { currentScreen: this.currentScreen };
    if (this.game) state.gameState = this.game.serialize();
    return state;
  }
  
  /**
   * Setup screen navigation
   */
  setupScreenNavigation(container) {
    container.querySelectorAll('.menu-btn[data-screen]').forEach(btn => {
      btn.addEventListener('click', () => {
        const screen = btn.dataset.screen;
        this.showScreen(screen);
        if (screen === 'game' && !this.game) {
          this.initializeGame();
        }
      });
    });
    
    container.querySelectorAll('.back-btn[data-screen]').forEach(btn => {
      btn.addEventListener('click', () => {
        const screen = btn.dataset.screen;
        this.showScreen(screen);
        if (screen === 'menu' && this.game) {
          this.resetGame();
        }
      });
    });
  }
  
  /**
   * Reset game state
   */
  resetGame() {
    if (this.game) {
      if (this.game.running && !this.game.paused) this.game.pause();
      this.game = null;
    }
    this.renderer = null;
    this.placingTower = false;
    this.selectedPath = 'fire';
    if (this.elements.btnStart) this.elements.btnStart.textContent = '▶ Start Wave';
  }
  
  /**
   * Show screen by ID
   */
  showScreen(screenId) {
    this.currentScreen = screenId;
    Object.entries(this.screens).forEach(([id, el]) => {
      if (el) el.style.display = id === screenId ? 'flex' : 'none';
    });
    if (screenId === 'game') {
      requestAnimationFrame(() => this.resizeCanvas());
    }
  }
  
  /**
   * Initialize new game
   */
  initializeGame() {
    if (!this.GameCore || !this.GameRenderer || !this.Camera) {
      this.showError('Failed to load game engine');
      return;
    }
    
    // Initial canvas size
    this.resizeCanvas();
    
    this.camera = new this.Camera();
    this.camera.setViewportSize(this.canvas.width, this.canvas.height);
    
    this.game = new this.GameCore();
    this.renderer = new this.GameRenderer(this.canvas, this.camera);
    
    // Center on base
    const basePos = this.game.map.base;
    if (basePos) this.camera.centerOn(basePos.x, basePos.y);
    
    this.setupEventListeners();
    this.setupGameEvents();
    this.renderGame();
    this.updateUI(this.game.getState());
    
    console.log('[game-controller] Game initialized');
  }
  
  /**
   * Restore game from saved state
   */
  restoreFromSavedState(state) {
    if (!state) return;
    
    this.currentScreen = state.currentScreen || 'menu';
    
    if (state.currentScreen === 'game' && state.gameState) {
      this.resizeCanvas();
      
      this.camera = new this.Camera();
      this.camera.setViewportSize(this.canvas.width, this.canvas.height);
      
      this.game = this.GameCore.deserialize(state.gameState);
      this.renderer = new this.GameRenderer(this.canvas, this.camera);
      
      const basePos = this.game.map.base;
      if (basePos) this.camera.centerOn(basePos.x, basePos.y);
      
      this.setupEventListeners();
      this.setupGameEvents();
      this.showScreen('game');
      this.renderGame();
      this.updateUI(this.game.getState());
      
      // Update buttons
      if (this.game.gameOver) {
        this.elements.btnStart.textContent = '▶ Start';
        this.elements.btnTower.disabled = true;
      } else if (this.game.running && !this.game.paused) {
        this.elements.btnStart.textContent = '⏸ Pause';
        this.elements.btnTower.disabled = this.game.economy.gold < 50;
      } else if (this.game.paused) {
        this.elements.btnStart.textContent = '▶ Resume';
        this.elements.btnTower.disabled = true;
      }
    } else {
      this.showScreen(this.currentScreen);
    }
  }

  /**
   * Setup UI event listeners
   */
  setupEventListeners() {
    const el = this.elements;
    
    el.btnStart.addEventListener('click', () => this.toggleGame());
    el.btnTower.addEventListener('click', () => this.togglePlacementMode());
    el.overlayBtn.addEventListener('click', () => this.restartGame());
    el.btnUpgrade.addEventListener('click', () => this.upgradeSelectedTower());
    el.btnSell.addEventListener('click', () => this.sellSelectedTower());
    
    // Tower path selection
    el.towerSelect.querySelectorAll('.tower-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        el.towerSelect.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.selectedPath = btn.dataset.path;
      });
    });
    
    // Select fire by default
    const fireBtn = el.towerSelect.querySelector('[data-path="fire"]');
    if (fireBtn) {
      fireBtn.classList.add('selected');
      this.selectedPath = 'fire';
    }
    
    // Canvas events
    this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
    this.canvas.addEventListener('mousemove', (e) => this.handleCanvasMove(e));
    this.canvas.addEventListener('wheel', (e) => this.handleCanvasWheel(e));
    
    // Pan with middle/right mouse
    let isPanning = false, lastX = 0, lastY = 0;
    
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 1 || e.button === 2) {
        isPanning = true;
        lastX = e.clientX;
        lastY = e.clientY;
        e.preventDefault();
      }
    });
    
    this.canvas.addEventListener('mousemove', (e) => {
      if (isPanning && this.camera) {
        this.camera.pan(-(e.clientX - lastX) / this.camera.zoom, -(e.clientY - lastY) / this.camera.zoom);
        lastX = e.clientX;
        lastY = e.clientY;
        this.renderGame();
      }
    });
    
    window.addEventListener('mouseup', (e) => {
      if (e.button === 1 || e.button === 2) isPanning = false;
    });
    
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /**
   * Setup game event handlers
   */
  setupGameEvents() {
    if (!this.game) return;
    
    this.game.on(this.GameEvents.STATE_CHANGE, (state) => {
      this.updateUI(state);
      this.renderGame();
    });
    
    this.game.on(this.GameEvents.TOWER_PLACED, () => {
      this.placingTower = false;
      this.elements.btnTower.classList.remove('active');
    });
    
    this.game.on(this.GameEvents.TOWER_SELECTED, (tower) => {
      tower ? this.showTowerInfo(tower) : this.hideTowerInfo();
    });
    
    this.game.on(this.GameEvents.WAVE_COMPLETE, () => {
      this.elements.btnStart.textContent = '▶ Start Wave';
      this.elements.btnTower.disabled = false;
    });
    
    this.game.on(this.GameEvents.GAME_OVER, (data) => {
      this.showOverlay('Game Over!', `Reached Wave ${data.wave}`, 'Try Again');
      this.elements.btnStart.disabled = true;
      this.elements.btnTower.disabled = true;
    });
  }

  /**
   * Toggle game start/pause/resume
   */
  toggleGame() {
    if (!this.game) return;
    
    if (this.game.gameOver) {
      this.restartGame();
      return;
    }
    
    if (!this.game.running) {
      this.game.start();
      this.elements.btnStart.textContent = '⏸ Pause';
      this.elements.btnTower.disabled = true;
      this.gameLoop();
    } else if (this.game.paused) {
      this.game.resume();
      this.elements.btnStart.textContent = '⏸ Pause';
      this.gameLoop();
    } else {
      this.game.pause();
      this.elements.btnStart.textContent = '▶ Resume';
    }
  }

  /**
   * Main game loop
   */
  gameLoop() {
    if (!this.game || !this.game.running || this.game.paused) return;
    this.game.tick();
    this.renderGame();
    requestAnimationFrame(() => this.gameLoop());
  }

  /**
   * Restart game
   */
  restartGame() {
    this.hideOverlay();
    this.game = new this.GameCore();
    
    const basePos = this.game.map.base;
    if (basePos && this.camera) this.camera.centerOn(basePos.x, basePos.y);
    
    this.setupGameEvents();
    this.renderGame();
    this.updateUI(this.game.getState());
    
    this.elements.btnStart.disabled = false;
    this.elements.btnStart.textContent = '▶ Start Wave';
    this.elements.btnTower.disabled = true;
  }

  /**
   * Toggle tower placement mode
   */
  togglePlacementMode() {
    this.placingTower = !this.placingTower;
    this.elements.btnTower.classList.toggle('active', this.placingTower);
    if (this.placingTower && this.game.selectedTower) {
      this.game.deselectTower();
    }
  }

  /**
   * Handle canvas click
   */
  handleCanvasClick(e) {
    if (!this.game || !this.camera) return;
    
    const rect = this.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    
    const worldPos = this.camera.screenToWorld(screenX, screenY);
    const gridX = Math.floor(worldPos.x / this.CONFIG.GRID_SIZE);
    const gridY = Math.floor(worldPos.y / this.CONFIG.GRID_SIZE);
    
    if (this.placingTower) {
      const pathIndex = this.TOWER_PATHS.findIndex(p => p.id === this.selectedPath);
      this.game.placeTower(gridX, gridY, pathIndex >= 0 ? pathIndex : 0);
    } else {
      this.game.selectTowerAt(gridX, gridY);
    }
    
    this.renderGame();
  }

  /**
   * Handle canvas mouse move
   */
  handleCanvasMove(e) {
    if (!this.game || !this.renderer || !this.camera) return;
    
    const rect = this.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    
    const worldPos = this.camera.screenToWorld(screenX, screenY);
    const gridX = Math.floor(worldPos.x / this.CONFIG.GRID_SIZE);
    const gridY = Math.floor(worldPos.y / this.CONFIG.GRID_SIZE);
    
    if (this.placingTower) {
      const canPlace = this.game.canPlaceTower(gridX, gridY);
      this.renderer.setHoverCell(gridX, gridY, canPlace);
    } else {
      this.renderer.setHoverCell(-1, -1, false);
    }
    
    this.renderGame();
  }

  /**
   * Handle canvas wheel (zoom)
   */
  handleCanvasWheel(e) {
    if (!this.camera) return;
    e.preventDefault();
    
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    this.camera.zoomAt(mouseX, mouseY, zoomFactor);
    this.renderGame();
  }

  /**
   * Show tower info panel
   */
  showTowerInfo(tower) {
    const el = this.elements;
    const pathInfo = this.TOWER_PATHS[tower.pathIndex];
    
    el.towerName.textContent = pathInfo ? pathInfo.name : 'Tower';
    el.towerTier.textContent = `Tier ${tower.tier}`;
    el.towerDmg.textContent = tower.damage.toFixed(0);
    el.towerRng.textContent = tower.range.toFixed(0);
    el.towerSpd.textContent = tower.attackSpeed.toFixed(1);
    
    el.towerInfo.style.display = 'block';
    
    const canUpgrade = this.game.economy.gold >= tower.upgradeCost && tower.tier < 3;
    el.btnUpgrade.disabled = !canUpgrade;
    el.btnUpgrade.textContent = tower.tier >= 3 ? 'MAX' : `⬆️ ${tower.upgradeCost}g`;
  }

  /**
   * Hide tower info panel
   */
  hideTowerInfo() {
    this.elements.towerInfo.style.display = 'none';
  }

  /**
   * Upgrade selected tower
   */
  upgradeSelectedTower() {
    if (!this.game?.selectedTower) return;
    this.game.upgradeTower(this.game.selectedTower.id);
    this.showTowerInfo(this.game.selectedTower);
  }

  /**
   * Sell selected tower
   */
  sellSelectedTower() {
    if (!this.game?.selectedTower) return;
    this.game.sellTower(this.game.selectedTower.id);
    this.hideTowerInfo();
  }

  /**
   * Update UI from game state
   */
  updateUI(state) {
    const el = this.elements;
    if (!el.gold) return;
    
    el.gold.textContent = state.gold;
    el.lives.textContent = state.lives;
    el.lives.classList.toggle('danger', state.lives <= 5);
    el.lives.classList.toggle('warning', state.lives > 5 && state.lives <= 10);
    el.energy.textContent = state.energy.current;
    el.wave.textContent = state.wave.wave;
  }

  /**
   * Render game frame
   */
  renderGame() {
    if (!this.game || !this.renderer) return;
    if (this.camera) this.camera.update();
    this.renderer.render(this.game.getRenderData());
  }

  /**
   * Show overlay message
   */
  showOverlay(title, message, buttonText) {
    const el = this.elements;
    el.overlayTitle.textContent = title;
    el.overlayMessage.textContent = message;
    el.overlayBtn.textContent = buttonText;
    el.overlay.style.display = 'flex';
  }

  /**
   * Hide overlay
   */
  hideOverlay() {
    this.elements.overlay.style.display = 'none';
  }

  /**
   * Show error message
   */
  showError(message) {
    const el = this.elements;
    if (el.overlay) {
      el.overlayTitle.textContent = 'Error';
      el.overlayTitle.style.color = '#fc8181';
      el.overlayMessage.textContent = message;
      el.overlayBtn.style.display = 'none';
      el.overlay.style.display = 'flex';
    }
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    
    if (this.game && this.game.running && !this.game.paused) {
      this.game.pause();
    }
    
    this.renderer = null;
    this.camera = null;
    this.game = null;
  }
}

module.exports = { GameController };

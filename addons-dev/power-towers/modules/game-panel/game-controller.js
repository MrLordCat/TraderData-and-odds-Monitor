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
      buildToolbar: container.querySelector('#build-toolbar'),
      towerSelect: container.querySelector('#tower-select'),
      towerItems: container.querySelectorAll('.tower-item'),
      towerInfo: container.querySelector('#tower-info'),
      towerName: container.querySelector('#tower-name'),
      towerTier: container.querySelector('#tower-tier'),
      towerDmg: container.querySelector('#tower-dmg'),
      towerRng: container.querySelector('#tower-rng'),
      towerSpd: container.querySelector('#tower-spd'),
      btnStart: container.querySelector('#btn-start'),
      btnUpgrade: container.querySelector('#btn-upgrade'),
      btnSell: container.querySelector('#btn-sell')
    };
    
    // Tower costs for UI
    this.towerCosts = {
      fire: 100,
      ice: 80,
      lightning: 150,
      nature: 60,
      dark: 200
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
   * Resize canvas to fit container (uses full available space)
   */
  resizeCanvas() {
    if (!this.canvas || !this.canvasContainer) return;
    
    const rect = this.canvasContainer.getBoundingClientRect();
    const width = Math.floor(rect.width);
    const height = Math.floor(rect.height);
    
    if (width < 200 || height < 200) return;
    if (Math.abs(this.canvas.width - width) < 5 && Math.abs(this.canvas.height - height) < 5) return;
    
    console.log('[game-controller] Canvas resize:', width, 'x', height);
    
    this.canvas.width = width;
    this.canvas.height = height;
    
    if (this.camera) {
      this.camera.setViewportSize(width, height);
    }
    if (this.renderer) {
      this.renderer.width = width;
      this.renderer.height = height;
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
    this.selectedPath = null;
    
    // Reset tower item UI
    if (this.elements.towerItems) {
      this.elements.towerItems.forEach(item => {
        item.classList.remove('placing', 'selected', 'disabled');
      });
    }
    
    if (this.elements.btnStart) this.elements.btnStart.textContent = '▶ Start Wave';
  }
  
  /**
   * Update tower affordability based on current gold
   */
  updateTowerAffordability() {
    if (!this.game) return;
    
    const gold = this.game.getState().gold || 0;
    
    this.elements.towerItems.forEach(item => {
      const path = item.dataset.path;
      const cost = this.towerCosts[path] || 100;
      const canAfford = gold >= cost;
      
      item.classList.toggle('disabled', !canAfford);
      
      // Update price color
      const priceEl = item.querySelector('.tower-price');
      if (priceEl) {
        priceEl.style.color = canAfford ? '#ffd700' : '#fc8181';
      }
    });
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
    
    // Center on base (last waypoint)
    const waypoints = this.game.waypoints;
    if (waypoints && waypoints.length > 0) {
      const basePos = waypoints[waypoints.length - 1];
      this.camera.centerOn(basePos.x, basePos.y);
    }
    
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
      
      // Center on base (last waypoint)
      const waypoints = this.game.waypoints;
      if (waypoints && waypoints.length > 0) {
        const basePos = waypoints[waypoints.length - 1];
        this.camera.centerOn(basePos.x, basePos.y);
      }
      
      this.setupEventListeners();
      this.setupGameEvents();
      this.showScreen('game');
      this.renderGame();
      this.updateUI(this.game.getState());
      
      // Update buttons
      if (this.game.gameOver) {
        this.elements.btnStart.textContent = '▶ Start';
        this.exitPlacementMode();
      } else if (this.game.running && !this.game.paused) {
        this.elements.btnStart.textContent = '⏸ Pause';
        this.updateTowerAffordability();
      } else if (this.game.paused) {
        this.elements.btnStart.textContent = '▶ Resume';
        this.updateTowerAffordability();
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
    
    // Re-query tower items as they might not have been available during init
    el.towerItems = this.screens.game?.querySelectorAll('.tower-item') || [];
    
    console.log('[game-controller] setupEventListeners, towerItems:', el.towerItems.length);
    
    el.btnStart.addEventListener('click', () => this.toggleGame());
    el.overlayBtn.addEventListener('click', () => this.restartGame());
    el.btnUpgrade.addEventListener('click', () => this.upgradeSelectedTower());
    el.btnSell.addEventListener('click', () => this.sellSelectedTower());
    
    // Tower selection - click to enter build mode
    el.towerItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const path = item.dataset.path;
        console.log('[game-controller] Tower item clicked:', path, 'disabled:', item.classList.contains('disabled'));
        if (item.classList.contains('disabled')) return;
        
        // Toggle: if already placing this tower, cancel; otherwise select it
        if (this.placingTower && this.selectedPath === path) {
          this.exitPlacementMode();
        } else {
          this.enterPlacementMode(path);
        }
      });
    });
    
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
    
    // Render on every game tick
    this.game.on(this.GameEvents.GAME_TICK, () => {
      this.renderGame();
      this.updateUI(this.game.getState());
    });
    
    this.game.on(this.GameEvents.STATE_CHANGE, (state) => {
      this.updateUI(state);
      this.renderGame();
    });
    
    this.game.on(this.GameEvents.TOWER_PLACED, () => {
      // Stay in placement mode for quick building
      // Player can click again to place more towers
      this.updateTowerAffordability();
    });
    
    this.game.on(this.GameEvents.TOWER_SELECTED, (tower) => {
      tower ? this.showTowerInfo(tower) : this.hideTowerInfo();
    });
    
    this.game.on(this.GameEvents.WAVE_COMPLETE, () => {
      this.elements.btnStart.textContent = '▶ Start Wave';
      this.updateTowerAffordability();
    });
    
    this.game.on(this.GameEvents.GAME_OVER, (data) => {
      this.showOverlay('Game Over!', `Reached Wave ${data.wave}`, 'Try Again');
      this.elements.btnStart.disabled = true;
      this.exitPlacementMode();
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
    } else if (this.game.paused) {
      this.game.resume();
      this.elements.btnStart.textContent = '⏸ Pause';
    } else {
      this.game.pause();
      this.elements.btnStart.textContent = '▶ Resume';
    }
  }

  /**
   * Restart game
   */
  restartGame() {
    this.hideOverlay();
    this.game = new this.GameCore();
    
    // Center on base (last waypoint)
    const waypoints = this.game.waypoints;
    if (waypoints && waypoints.length > 0 && this.camera) {
      const basePos = waypoints[waypoints.length - 1];
      this.camera.centerOn(basePos.x, basePos.y);
    }
    
    this.setupGameEvents();
    this.renderGame();
    this.updateUI(this.game.getState());
    
    this.elements.btnStart.disabled = false;
    this.elements.btnStart.textContent = '▶ Start Wave';
    this.exitPlacementMode();
  }

  /**
   * Enter tower placement mode for specific path
   */
  enterPlacementMode(path) {
    console.log('[game-controller] enterPlacementMode:', path);
    this.placingTower = true;
    this.selectedPath = path;
    
    // Update UI - remove placing from all, add to selected
    this.elements.towerItems.forEach(item => {
      item.classList.remove('placing', 'selected');
      if (item.dataset.path === path) {
        item.classList.add('placing');
      }
    });
    
    // Deselect tower if any
    if (this.game && this.game.selectedTower) {
      this.game.selectTower(null);
    }
    
    // Force re-render to show hover
    this.renderGame();
  }
  
  /**
   * Exit tower placement mode
   */
  exitPlacementMode() {
    console.log('[game-controller] exitPlacementMode');
    this.placingTower = false;
    this.selectedPath = null;
    
    // Update UI
    this.elements.towerItems.forEach(item => {
      item.classList.remove('placing');
    });
    
    // Clear hover and re-render
    if (this.renderer) {
      this.renderer.clearHover();
      this.renderGame();
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
    
    console.log('[game-controller] Canvas click at grid:', gridX, gridY, 'placingTower:', this.placingTower, 'selectedPath:', this.selectedPath);
    
    if (this.placingTower && this.selectedPath) {
      // Place tower with selected path type
      const result = this.game.placeTower(gridX, gridY, this.selectedPath);
      console.log('[game-controller] placeTower result:', result);
    } else {
      // Find tower at grid position
      const tower = this.game.towers.find(t => t.gridX === gridX && t.gridY === gridY);
      if (tower) {
        this.game.selectTower(tower.id);
      } else {
        this.game.selectTower(null);
      }
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
      this.renderer.setHover(gridX, gridY, canPlace);
    } else {
      this.renderer.clearHover();
    }
    
    this.renderGame();
  }

  /**
   * Handle canvas wheel (zoom)
   */
  handleCanvasWheel(e) {
    if (!this.camera) return;
    e.preventDefault();
    
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    this.camera.zoomBy(zoomFactor);
    this.renderGame();
  }

  /**
   * Show tower info panel
   */
  showTowerInfo(tower) {
    const el = this.elements;
    const pathInfo = this.TOWER_PATHS[tower.path] || this.TOWER_PATHS[tower.pathIndex];
    
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
    
    // Update tower affordability
    this.updateTowerAffordability();
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

/**
 * Power Towers TD - Game Controller
 * Handles game logic, canvas, events for detached mode
 * 
 * Modular architecture using mixins:
 * - TowerTooltipMixin: Tooltip display and positioning
 * - TowerUpgradesUIMixin: Stat upgrades panel in tooltip
 * - CanvasEventsMixin: Canvas click/move/wheel/pan
 * - GameEventsMixin: Game event subscriptions
 * - UIEventsMixin: Button and toolbar interactions
 */

const { TowerTooltipMixin } = require('./tower-tooltip');
const { CanvasEventsMixin } = require('./canvas-events');
const { GameEventsMixin } = require('./game-events');
const { UIEventsMixin } = require('./ui-events');
const { TowerUpgradesUIMixin } = require('./tower-upgrades-ui');

/**
 * Base GameController class
 */
class GameControllerBase {
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
    
    // Tooltip position tracking
    this.tooltipTowerPosition = null;
    
    // Single tower cost
    this.towerCost = 50;
    
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
      // Tower tooltip
      towerTooltip: container.querySelector('#tower-tooltip'),
      tooltipIcon: container.querySelector('#tooltip-icon'),
      tooltipName: container.querySelector('#tooltip-name'),
      tooltipLevel: container.querySelector('#tooltip-level'),
      tooltipLevelProgress: container.querySelector('#tooltip-level-progress'),
      tooltipLevelText: container.querySelector('#tooltip-level-text'),
      tooltipAttackType: container.querySelector('#tooltip-attack-type'),
      tooltipElement: container.querySelector('#tooltip-element'),
      tooltipDmg: container.querySelector('#tooltip-dmg'),
      tooltipRng: container.querySelector('#tooltip-rng'),
      tooltipSpd: container.querySelector('#tooltip-spd'),
      tooltipCrit: container.querySelector('#tooltip-crit'),
      tooltipCritdmg: container.querySelector('#tooltip-critdmg'),
      tooltipSplashRow: container.querySelector('#tooltip-splash-row'),
      tooltipSplash: container.querySelector('#tooltip-splash'),
      tooltipHp: container.querySelector('#tooltip-hp'),
      tooltipEnergy: container.querySelector('#tooltip-energy'),
      tooltipClose: container.querySelector('#tooltip-close'),
      tooltipAttackSection: container.querySelector('#tooltip-attack-section'),
      tooltipElementSection: container.querySelector('#tooltip-element-section'),
      tooltipTypeBtns: container.querySelectorAll('.tooltip-type-btn'),
      tooltipElementBtns: container.querySelectorAll('.tooltip-element-btn'),
      btnStart: container.querySelector('#btn-start'),
      btnUpgrade: container.querySelector('#btn-upgrade'),
      btnSell: container.querySelector('#btn-sell'),
      // Stat upgrades section
      tooltipUpgradesSection: container.querySelector('#tooltip-upgrades-section'),
      upgradesGrid: container.querySelector('#upgrades-grid')
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
    const width = Math.floor(rect.width);
    const height = Math.floor(rect.height);
    
    if (width < 200 || height < 200) return;
    if (Math.abs(this.canvas.width - width) < 5 && Math.abs(this.canvas.height - height) < 5) return;
    
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
    return { 
      currentScreen: this.currentScreen
    };
  }
  
  /**
   * Setup screen navigation
   */
  setupScreenNavigation(container) {
    container.querySelectorAll('.menu-btn[data-screen]').forEach(btn => {
      btn.addEventListener('click', () => {
        const screen = btn.dataset.screen;
        this.showScreen(screen);
        if (screen === 'game') {
          // Delay init to let screen become visible first
          requestAnimationFrame(() => {
            if (!this.game) {
              this.initializeGame();
            } else {
              // Game exists, just force resize
              this.resizeCanvas();
            }
            // Close menu module so game updates run
            if (this.game && this.game.modules && this.game.modules.menu) {
              this.game.modules.menu.isOpen = false;
            }
          });
        }
      });
    });
    
    container.querySelectorAll('.back-btn[data-screen]').forEach(btn => {
      btn.addEventListener('click', () => {
        const screen = btn.dataset.screen;
        this.showScreen(screen);
        if (screen === 'menu') {
          // Open menu module to pause game updates
          if (this.game && this.game.modules && this.game.modules.menu) {
            this.game.modules.menu.isOpen = true;
          }
          if (this.game) {
            this.resetGame();
          }
        }
      });
    });
  }
  
  /**
   * Reset game state
   */
  resetGame() {
    // Cleanup game
    if (this.game) {
      if (this.game.running && !this.game.paused) this.game.pause();
      this.game.destroy();
      this.game = null;
    }
    
    // Cleanup renderer
    this.renderer = null;
    
    // Reset placement state
    this.placingTower = false;
    this.selectedPath = null;
    
    // Reset tower item UI
    if (this.elements.towerItems) {
      this.elements.towerItems.forEach(item => {
        item.classList.remove('placing', 'selected', 'disabled');
      });
    }
    
    // Hide tooltip if visible
    this.hideTowerInfo();
    
    if (this.elements.btnStart) this.elements.btnStart.textContent = '▶ Start Wave';
    
    // Mark that we need to re-setup UI events on next game init
    this._needsUIEventSetup = true;
  }
  
  /**
   * Show screen by ID
   */
  showScreen(screenId) {
    Object.values(this.screens).forEach(screen => {
      if (screen) {
        screen.classList.remove('active');
        screen.style.display = 'none';
      }
    });
    
    if (this.screens[screenId]) {
      this.screens[screenId].classList.add('active');
      this.screens[screenId].style.display = '';
      this.currentScreen = screenId;
    }
  }
  
  /**
   * Initialize game
   */
  initializeGame() {
    if (!this.GameCore || !this.GameRenderer || !this.Camera) {
      console.error('[GameController] Missing required game classes');
      return;
    }
    
    // Cleanup any existing game first
    if (this.game) {
      this.game.destroy();
      this.game = null;
    }
    
    this.game = new this.GameCore();
    
    const ctx = this.canvas?.getContext('2d');
    if (!ctx) {
      console.error('[GameController] No canvas context');
      return;
    }
    
    // Force canvas size update from container
    if (this.canvasContainer) {
      const rect = this.canvasContainer.getBoundingClientRect();
      const width = Math.floor(rect.width);
      const height = Math.floor(rect.height);
      console.log(`[GameController] Container rect: ${width}x${height}`);
      if (width > 200 && height > 200) {
        this.canvas.width = width;
        this.canvas.height = height;
      }
    }
    
    console.log(`[GameController] Canvas size: ${this.canvas.width}x${this.canvas.height}`);
    
    // Initialize camera (no constructor params - use setViewportSize)
    this.camera = new this.Camera();
    this.camera.setViewportSize(this.canvas.width, this.canvas.height);
    console.log(`[GameController] Camera viewport: ${this.camera.viewportWidth}x${this.camera.viewportHeight}, zoom: ${this.camera.zoom}`);
    
    // Initialize renderer (pass canvas, not ctx)
    this.renderer = new this.GameRenderer(this.canvas, this.camera);
    
    // Center on base (last waypoint)
    const waypoints = this.game.waypoints;
    if (waypoints && waypoints.length > 0) {
      const basePos = waypoints[waypoints.length - 1];
      this.camera.centerOn(basePos.x, basePos.y);
    }
    
    // Only setup UI events if needed (first time or after reset)
    if (!this._uiEventsSetup || this._needsUIEventSetup) {
      this.setupEventListeners();
      this._uiEventsSetup = true;
      this._needsUIEventSetup = false;
    }
    
    // Always setup game events (new game instance)
    this.setupGameEvents();
    
    // Force immediate render
    this.renderGame();
    this.updateUI(this.game.getState());
    
    // Schedule another resize/render after a brief delay to catch late layout
    setTimeout(() => {
      this.resizeCanvas();
      this.renderGame();
    }, 100);
  }
  
  /**
   * Restore game from saved state
   */
  restoreFromSavedState(state) {
    if (!state) return;
    
    this.currentScreen = state.currentScreen || 'menu';
    this.showScreen(this.currentScreen);
    
    // If was in game, initialize fresh game
    if (this.currentScreen === 'game') {
      this.initializeGame();
    }
  }

  /**
   * Setup all event listeners
   */
  setupEventListeners() {
    this.setupUIEvents();
    this.setupCanvasEvents();
  }

  /**
   * Update tower affordability based on current gold
   */
  updateTowerAffordability() {
    if (!this.game) return;
    
    const gold = this.game.getState().gold || 0;
    
    // Update base tower affordability
    this.elements.towerItems.forEach(item => {
      const canAfford = gold >= this.towerCost;
      item.classList.toggle('disabled', !canAfford);
      
      const priceEl = item.querySelector('.tower-price');
      if (priceEl) {
        priceEl.style.color = canAfford ? '#ffd700' : '#fc8181';
      }
    });
    
    // Update tooltip buttons if tower is selected
    if (this.game.selectedTower) {
      this.updateTooltipButtonStates(this.game.selectedTower);
    }
  }

  /**
   * Enter tower placement mode
   */
  enterPlacementMode() {
    this.placingTower = true;
    
    // Update UI
    this.elements.towerItems.forEach(item => {
      item.classList.add('placing');
    });
    
    // Hide attack/element sections while placing
    if (this.elements.attackTypeSection) {
      this.elements.attackTypeSection.style.display = 'none';
    }
    if (this.elements.elementSection) {
      this.elements.elementSection.style.display = 'none';
    }
    
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
    this.placingTower = false;
    
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
   * Set attack type for selected tower
   */
  setTowerAttackType(attackTypeId) {
    if (!this.game || !this.game.selectedTower) return;
    
    const tower = this.game.selectedTower;
    
    // Check if tower already has attack type
    if (tower.attackTypeId !== 'base') {
      console.log('Tower already has attack type');
      return;
    }
    
    // Emit event to set attack type
    this.game.emit('tower:set-attack-type', { 
      towerId: tower.id, 
      attackTypeId 
    });
    
    // Update UI
    this.updateTooltipSections(tower);
    this.updateTowerAffordability();
  }
  
  /**
   * Set element path for selected tower
   */
  setTowerElement(elementId) {
    if (!this.game || !this.game.selectedTower) return;
    
    const tower = this.game.selectedTower;
    
    // Check if tower already has element
    if (tower.elementPath) {
      console.log('Tower already has element');
      return;
    }
    
    // Emit event to set element
    this.game.emit('tower:set-element', { 
      towerId: tower.id, 
      elementId 
    });
    
    // Update UI
    this.updateTooltipSections(tower);
    this.updateTowerAffordability();
  }

  /**
   * Upgrade selected tower
   */
  upgradeSelectedTower() {
    if (!this.game?.selectedTower) return;
    // TODO: Open upgrade menu
    console.log('Upgrade tower - not yet implemented');
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
    el.energy.textContent = Math.floor(state.energy?.energy || 0);
    
    // Show wave with timer for next wave (always shows after first wave started)
    if (state.firstWaveStarted) {
      const nextWaveIn = Math.ceil(state.nextWaveIn || 0);
      el.wave.textContent = `${state.wave || 0} (${nextWaveIn}s)`;
    } else {
      el.wave.textContent = state.wave || 0;
    }
    
    // Update start button text based on game state
    if (state.firstWaveStarted) {
      // After first wave started, button is only pause/resume
      if (state.paused) {
        el.btnStart.textContent = '▶ Resume';
      } else {
        el.btnStart.textContent = '⏸ Pause';
      }
    }
    
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
      el.overlayBtn.textContent = 'OK';
      el.overlay.style.display = 'flex';
    }
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (this.game) {
      this.game.stop();
    }
  }
}

// Apply mixins in order
const GameController = TowerTooltipMixin(
  TowerUpgradesUIMixin(
    CanvasEventsMixin(
      GameEventsMixin(
        UIEventsMixin(GameControllerBase)
      )
    )
  )
);

module.exports = { GameController };

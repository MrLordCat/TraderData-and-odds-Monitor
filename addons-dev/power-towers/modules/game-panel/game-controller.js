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
const CONFIG = require('../../core/config');

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
    this.placingEnergy = false;
    this.placingEnergyType = null;
    this.selectedPath = 'fire';
    this.currentScreen = 'menu';
    
    // Tooltip position tracking
    this.tooltipTowerPosition = null;
    
    // Single tower cost (from config)
    this.towerCost = CONFIG.BASE_TOWER_COST;
    
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
      upgradesGrid: container.querySelector('#upgrades-grid'),
      // Energy building tooltip
      energyTooltip: container.querySelector('#energy-tooltip'),
      energyTooltipIcon: container.querySelector('#energy-tooltip-icon'),
      energyTooltipName: container.querySelector('#energy-tooltip-name'),
      energyTooltipLevel: container.querySelector('#energy-tooltip-level'),
      energyTooltipType: container.querySelector('#energy-tooltip-type'),
      energyTooltipConnections: container.querySelector('#energy-tooltip-connections'),
      energyTooltipStored: container.querySelector('#energy-tooltip-stored'),
      energyTooltipOutput: container.querySelector('#energy-tooltip-output'),
      energyTooltipRange: container.querySelector('#energy-tooltip-range'),
      energyTooltipGenRow: container.querySelector('#energy-tooltip-gen-row'),
      energyTooltipGen: container.querySelector('#energy-tooltip-gen'),
      energyTooltipEffRow: container.querySelector('#energy-tooltip-eff-row'),
      energyTooltipEff: container.querySelector('#energy-tooltip-eff'),
      energyTooltipClose: container.querySelector('#energy-tooltip-close'),
      energyXpBarFill: container.querySelector('#energy-xp-bar-fill'),
      energyXpBarText: container.querySelector('#energy-xp-bar-text'),
      energyUpgradesSection: container.querySelector('#energy-upgrades-section'),
      energyUpgradesGrid: container.querySelector('#energy-upgrades-grid'),
      energyBtnConnect: container.querySelector('#energy-btn-connect'),
      energyBtnUpgrade: container.querySelector('#energy-btn-upgrade'),
      energyBtnSell: container.querySelector('#energy-btn-sell'),
      energyUpgradeBtns: container.querySelectorAll('#energy-upgrades-grid .upgrade-stat-btn')
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
    
    // Update tower price display from config
    this.updateTowerPriceDisplay();
    
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
   * OPTIMIZED: Only updates if gold threshold changed
   */
  updateTowerAffordability() {
    if (!this.game) return;
    
    const gold = this.game.getState().gold || 0;
    const canAfford = gold >= this.towerCost;
    
    // Skip if affordability hasn't changed
    if (this._lastCanAfford === canAfford) return;
    this._lastCanAfford = canAfford;
    
    // Update base tower affordability
    this.elements.towerItems.forEach(item => {
      item.classList.toggle('disabled', !canAfford);
      
      const priceEl = item.querySelector('.tower-price');
      if (priceEl) {
        priceEl.style.color = canAfford ? '#ffd700' : '#fc8181';
      }
    });
    
    // Update energy building affordability
    this.updateEnergyAffordability();
    
    // Update tooltip buttons if tower is selected
    if (this.game.selectedTower) {
      this.updateTooltipButtonStates(this.game.selectedTower);
    }
  }

  /**
   * Update tower price display from config
   */
  updateTowerPriceDisplay() {
    // Update all tower-price elements
    this.elements.towerItems?.forEach(item => {
      const priceEl = item.querySelector('.tower-price');
      if (priceEl) {
        priceEl.textContent = `${this.towerCost}g`;
      }
      // Update title tooltip too
      item.title = `Build Tower (${this.towerCost}g)`;
    });
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
   * Enter energy building placement mode
   */
  enterEnergyPlacementMode(buildingType) {
    this.placingEnergy = true;
    this.placingEnergyType = buildingType;
    
    // Update UI - highlight selected energy building
    const energyItems = this.screens.game?.querySelectorAll('.energy-item') || [];
    energyItems.forEach(item => {
      if (item.dataset.building === buildingType) {
        item.classList.add('placing');
      } else {
        item.classList.remove('placing');
      }
    });
    
    // Deselect tower if any
    if (this.game && this.game.selectedTower) {
      this.game.selectTower(null);
    }
    
    this.renderGame();
  }
  
  /**
   * Exit energy building placement mode
   */
  exitEnergyPlacementMode() {
    this.placingEnergy = false;
    this.placingEnergyType = null;
    
    // Update UI
    const energyItems = this.screens.game?.querySelectorAll('.energy-item') || [];
    energyItems.forEach(item => {
      item.classList.remove('placing');
    });
    
    if (this.renderer) {
      this.renderer.clearHover();
      this.renderGame();
    }
  }
  
  /**
   * Place energy building at position
   */
  placeEnergyBuilding(gridX, gridY) {
    if (!this.game || !this.placingEnergy || !this.placingEnergyType) return;
    
    const energyModule = this.game.getModule('energy');
    if (!energyModule) {
      console.warn('[GameController] Energy module not found');
      return;
    }
    
    // Convert grid to world coordinates
    const worldX = gridX * this.CONFIG.GRID_SIZE + this.CONFIG.GRID_SIZE / 2;
    const worldY = gridY * this.CONFIG.GRID_SIZE + this.CONFIG.GRID_SIZE / 2;
    
    // Try to place building
    const building = energyModule.placeBuilding(
      this.placingEnergyType,
      gridX, gridY,
      worldX, worldY
    );
    
    if (building) {
      console.log(`[GameController] Placed ${this.placingEnergyType} at (${gridX}, ${gridY})`);
      this.updateUI(this.game.getState());
      this.updateEnergyAffordability();
      this.renderGame();
    }
  }
  
  /**
   * Update energy building affordability
   */
  updateEnergyAffordability() {
    if (!this.game) return;
    
    const gold = this.game.getState().gold || 0;
    const energyModule = this.game.getModule('energy');
    if (!energyModule) return;
    
    const defs = energyModule.getBuildingDefinitions();
    
    const energyItems = this.screens.game?.querySelectorAll('.energy-item') || [];
    energyItems.forEach(item => {
      const buildingType = item.dataset.building;
      const def = defs[buildingType];
      const cost = def?.cost || 999;
      const canAfford = gold >= cost;
      
      item.classList.toggle('disabled', !canAfford);
      
      const priceEl = item.querySelector('.energy-price');
      if (priceEl) {
        priceEl.style.color = canAfford ? '#ffd700' : '#fc8181';
      }
    });
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
   * OPTIMIZED: Only updates DOM if values changed
   */
  updateUI(state) {
    const el = this.elements;
    if (!el.gold) return;
    
    // Cache previous values to avoid unnecessary DOM updates
    if (!this._lastUIState) this._lastUIState = {};
    const last = this._lastUIState;
    
    // Gold
    if (last.gold !== state.gold) {
      el.gold.textContent = state.gold;
      last.gold = state.gold;
    }
    
    // Lives
    if (last.lives !== state.lives) {
      el.lives.textContent = state.lives;
      el.lives.classList.toggle('danger', state.lives <= 5);
      el.lives.classList.toggle('warning', state.lives > 5 && state.lives <= 10);
      last.lives = state.lives;
    }
    
    // Energy
    const energyVal = Math.floor(state.energy?.energy || 0);
    if (last.energy !== energyVal) {
      el.energy.textContent = energyVal;
      last.energy = energyVal;
    }
    
    // Wave with timer
    let waveText;
    if (state.firstWaveStarted) {
      const nextWaveIn = Math.ceil(state.nextWaveIn || 0);
      waveText = `${state.wave || 0} (${nextWaveIn}s)`;
    } else {
      waveText = String(state.wave || 0);
    }
    if (last.waveText !== waveText) {
      el.wave.textContent = waveText;
      last.waveText = waveText;
    }
    
    // Update start button text based on game state
    if (state.firstWaveStarted) {
      const btnText = state.paused ? '▶ Resume' : '⏸ Pause';
      if (last.btnText !== btnText) {
        el.btnStart.textContent = btnText;
        last.btnText = btnText;
      }
    }
    
    // Update tower affordability (has its own optimization)
    this.updateTowerAffordability();
  }

  /**
   * Render game frame
   */
  renderGame() {
    if (!this.game || !this.renderer) return;
    if (this.camera) this.camera.update();
    
    // Get render data and add controller state
    const renderData = this.game.getRenderData();
    
    // Add connection mode state for range visualization
    if (this.isConnectingEnergy && this.connectingFromBuilding) {
      renderData.connectingFromBuilding = this.connectingFromBuilding;
    }
    
    this.renderer.render(renderData);
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

  // =============================================
  // Energy Building Tooltip
  // =============================================
  
  /**
   * Show energy building info tooltip
   */
  showEnergyBuildingInfo(building) {
    const el = this.elements;
    if (!el.energyTooltip || !this.camera) return;
    
    this.selectedEnergyBuilding = building;
    
    // Update icon
    const { BUILDING_ICONS } = require('../../modules/energy/building-defs');
    if (el.energyTooltipIcon) {
      el.energyTooltipIcon.textContent = BUILDING_ICONS[building.type] || '⚡';
    }
    
    // Update name
    if (el.energyTooltipName) {
      const names = {
        'base-generator': 'Basic Generator',
        'bio-generator': 'Bio Generator',
        'wind-generator': 'Wind Turbine',
        'solar-generator': 'Solar Panel',
        'water-generator': 'Hydro Generator',
        'battery': 'Battery',
        'power-transfer': 'Relay'
      };
      el.energyTooltipName.textContent = names[building.type] || building.type;
    }
    
    // Update level with XP progress
    const xpProgress = building.getXpProgress?.() || { current: 0, needed: 10, percent: 0 };
    if (el.energyTooltipLevel) {
      el.energyTooltipLevel.textContent = `Lvl ${building.level || 1}`;
      el.energyTooltipLevel.title = `XP: ${xpProgress.current}/${xpProgress.needed} (${Math.floor(xpProgress.percent)}%)`;
    }
    
    // Update XP bar
    if (el.energyXpBarFill) {
      el.energyXpBarFill.style.width = `${Math.min(100, xpProgress.percent)}%`;
    }
    if (el.energyXpBarText) {
      el.energyXpBarText.textContent = `${xpProgress.current}/${xpProgress.needed} XP`;
    }
    
    // Update type with XP info
    if (el.energyTooltipType) {
      const typeNames = {
        'generator': '⚡ Generator',
        'storage': '🔋 Storage',
        'transfer': '📡 Relay'
      };
      const xp = building.xp || 0;
      el.energyTooltipType.textContent = `${typeNames[building.nodeType] || building.nodeType} • ${xp} XP`;
    }
    
    // Update connections count
    if (el.energyTooltipConnections) {
      const energyModule = this.game.getModule('energy');
      const connections = energyModule?.getConnectionsCount?.(building.id) || 0;
      el.energyTooltipConnections.textContent = `${connections} links`;
    }
    
    // Update stored energy
    if (el.energyTooltipStored) {
      const stored = Math.floor(building.stored || 0);
      const capacity = Math.floor(building.getEffectiveCapacity?.() || building.capacity || 100);
      el.energyTooltipStored.textContent = `${stored}/${capacity}`;
    }
    
    // Update output rate
    if (el.energyTooltipOutput) {
      const outputRate = building.getEffectiveOutputRate?.() || building.outputRate || 0;
      el.energyTooltipOutput.textContent = `${outputRate.toFixed(1)}/s`;
    }
    
    // Update range (in grid cells)
    if (el.energyTooltipRange) {
      const range = building.getEffectiveRange?.() || building.range || 0;
      el.energyTooltipRange.textContent = `${range} cells`;
    }
    
    // Generation (for generators only)
    if (el.energyTooltipGenRow && el.energyTooltipGen) {
      if (building.nodeType === 'generator' && building.generation !== undefined) {
        el.energyTooltipGenRow.style.display = '';
        el.energyTooltipGen.textContent = `${building.generation?.toFixed(1) || 0}/s`;
      } else {
        el.energyTooltipGenRow.style.display = 'none';
      }
    }
    
    // Efficiency (for generators only)
    if (el.energyTooltipEffRow && el.energyTooltipEff) {
      const state = building.getState?.() || {};
      if (state.efficiency !== undefined) {
        el.energyTooltipEffRow.style.display = '';
        el.energyTooltipEff.textContent = `${Math.round(state.efficiency * 100)}%`;
      } else {
        el.energyTooltipEffRow.style.display = 'none';
      }
    }
    
    // Position tooltip near the building
    const screenPos = this.camera.worldToScreen(building.worldX, building.worldY);
    const tooltipRect = el.energyTooltip.getBoundingClientRect();
    const containerRect = this.canvasContainer.getBoundingClientRect();
    
    let left = screenPos.x + 30;
    let top = screenPos.y - 50;
    
    // Keep within bounds
    if (left + 200 > containerRect.width) {
      left = screenPos.x - 220;
    }
    if (top < 10) top = 10;
    if (top + 200 > containerRect.height) {
      top = containerRect.height - 210;
    }
    
    el.energyTooltip.style.left = `${left}px`;
    el.energyTooltip.style.top = `${top}px`;
    el.energyTooltip.classList.add('visible');
    
    this.energyTooltipBuildingPosition = { x: building.gridX, y: building.gridY };
  }
  
  /**
   * Hide energy building tooltip
   */
  hideEnergyBuildingInfo() {
    const el = this.elements;
    if (el.energyTooltip) {
      el.energyTooltip.classList.remove('visible');
    }
    this.selectedEnergyBuilding = null;
    this.energyTooltipBuildingPosition = null;
  }
  
  /**
   * Sell selected energy building
   */
  sellSelectedEnergyBuilding() {
    if (!this.selectedEnergyBuilding || !this.game) return;
    
    const building = this.selectedEnergyBuilding;
    const energyModule = this.game.getModule('energy');
    const economy = this.game.getModule('economy');
    
    if (energyModule && economy) {
      // Get sell price (50% of cost)
      const { ENERGY_BUILDINGS } = require('../../modules/energy/building-defs');
      const def = ENERGY_BUILDINGS[building.type];
      const sellPrice = Math.floor((def?.cost || 50) * 0.5);
      
      // Remove building
      energyModule.removeBuilding(building.id);
      
      // Add gold
      economy.addGold(sellPrice);
      
      // Hide tooltip
      this.hideEnergyBuildingInfo();
      
      // Update UI
      this.updateUI(this.game.getState());
      this.renderGame();
    }
  }
  
  /**
   * Toggle energy upgrades panel
   */
  toggleEnergyUpgradesPanel() {
    const el = this.elements;
    if (!el.energyUpgradesSection) return;
    
    const isHidden = el.energyUpgradesSection.style.display === 'none';
    el.energyUpgradesSection.style.display = isHidden ? 'block' : 'none';
    
    if (el.energyBtnUpgrade) {
      el.energyBtnUpgrade.classList.toggle('active', isHidden);
    }
    
    if (isHidden && this.selectedEnergyBuilding) {
      this.updateEnergyUpgradesCosts();
    }
  }
  
  /**
   * Update energy upgrades costs display
   */
  updateEnergyUpgradesCosts() {
    if (!this.selectedEnergyBuilding || !this.game) return;
    
    const building = this.selectedEnergyBuilding;
    const gold = this.game.getState().gold || 0;
    const el = this.elements;
    
    // Base upgrade costs (increase with level)
    const baseCosts = {
      capacity: 20,
      outputRate: 25,
      range: 30
    };
    
    const maxLevel = 5;
    const upgrades = building.upgrades || { capacity: 0, outputRate: 0, range: 0 };
    
    Object.keys(baseCosts).forEach(stat => {
      const level = upgrades[stat] || 0;
      const cost = Math.floor(baseCosts[stat] * Math.pow(1.5, level));
      const canAfford = gold >= cost;
      const atMax = level >= maxLevel;
      
      // Update cost display with level indicator
      const costEl = el.energyUpgradesGrid?.querySelector(`[data-stat="${stat}"] .stat-cost`);
      if (costEl) {
        costEl.textContent = atMax ? 'MAX' : `Lv${level + 1} ${cost}g`;
        costEl.style.color = atMax ? '#a0aec0' : (canAfford ? '#ffd700' : '#fc8181');
      }
      
      // Update button state
      const btn = el.energyUpgradesGrid?.querySelector(`[data-stat="${stat}"]`);
      if (btn) {
        btn.classList.toggle('disabled', !canAfford || atMax);
      }
    });
  }
  
  /**
   * Upgrade energy building stat
   */
  upgradeEnergyBuildingStat(stat) {
    if (!this.selectedEnergyBuilding || !this.game) return;
    
    const building = this.selectedEnergyBuilding;
    const economy = this.game.getModule('economy');
    if (!economy) return;
    
    const baseCosts = {
      capacity: 20,
      outputRate: 25,
      range: 30
    };
    
    const upgrades = building.upgrades || { capacity: 0, outputRate: 0, range: 0 };
    const level = upgrades[stat] || 0;
    const cost = Math.floor(baseCosts[stat] * Math.pow(1.5, level));
    
    if (!economy.canAfford(cost)) return;
    if (level >= 5) return; // Max level
    
    // Spend gold
    economy.spendGold(cost);
    
    // Apply upgrade using PowerNode's upgrade method if available
    if (building.upgrade) {
      building.upgrade(stat);
    } else {
      // Fallback: directly modify upgrades
      building.upgrades = building.upgrades || { capacity: 0, outputRate: 0, range: 0 };
      building.upgrades[stat]++;
    }
    
    console.log(`[GameController] Upgraded ${stat} to level ${building.upgrades[stat]}, effective range: ${building.getEffectiveRange?.()}`);
    
    // Update displays
    this.showEnergyBuildingInfo(building);
    this.updateEnergyUpgradesCosts();
    this.updateUI(this.game.getState());
    this.renderGame();
  }
  
  /**
   * Start energy connection mode
   */
  startEnergyConnectionMode() {
    if (!this.selectedEnergyBuilding || !this.game) return;
    
    const energyModule = this.game.getModule('energy');
    if (!energyModule) return;
    
    this.connectingFromBuilding = this.selectedEnergyBuilding;
    this.isConnectingEnergy = true;
    
    // Update button appearance
    const el = this.elements;
    if (el.energyBtnConnect) {
      el.energyBtnConnect.textContent = '❌ Cancel';
      el.energyBtnConnect.classList.add('active');
    }
    
    // Get effective range for message
    const range = this.connectingFromBuilding.getEffectiveRange?.() || this.connectingFromBuilding.range || 4;
    
    // Show message
    this.game.eventBus?.emit('ui:toast', { 
      message: `Click building or tower within ${range} cells to connect`, 
      type: 'info' 
    });
    
    // Render to show range indicator
    this.renderGame();
  }
  
  /**
   * Cancel energy connection mode
   */
  cancelEnergyConnectionMode() {
    this.connectingFromBuilding = null;
    this.isConnectingEnergy = false;
    
    const el = this.elements;
    if (el.energyBtnConnect) {
      el.energyBtnConnect.textContent = '🔗 Connect';
      el.energyBtnConnect.classList.remove('active');
    }
  }
  
  /**
   * Complete energy connection
   */
  completeEnergyConnection(targetBuilding) {
    if (!this.connectingFromBuilding || !targetBuilding || !this.game) return;
    
    const energyModule = this.game.getModule('energy');
    if (!energyModule) return;
    
    const from = this.connectingFromBuilding;
    const to = targetBuilding;
    
    // Don't connect to self
    if (from.id === to.id) {
      this.cancelEnergyConnectionMode();
      return;
    }
    
    // Check range
    const dx = from.gridX - to.gridX;
    const dy = from.gridY - to.gridY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxRange = Math.max(from.range || 4, to.range || 4);
    
    if (distance > maxRange) {
      this.game.eventBus?.emit('ui:toast', { 
        message: 'Buildings too far apart!', 
        type: 'error' 
      });
      this.cancelEnergyConnectionMode();
      return;
    }
    
    // Create connection via network
    const success = energyModule.connectBuildings?.(from.id, to.id);
    
    if (success !== false) {
      this.game.eventBus?.emit('ui:toast', { 
        message: 'Connection established!', 
        type: 'success' 
      });
    }
    
    this.cancelEnergyConnectionMode();
    this.renderGame();
  }
  
  /**
   * Complete energy connection to a tower (tower as consumer)
   */
  completeEnergyConnectionToTower(tower) {
    if (!this.connectingFromBuilding || !tower || !this.game) return;
    
    const energyModule = this.game.getModule('energy');
    if (!energyModule) return;
    
    const from = this.connectingFromBuilding;
    
    // Check range
    const dx = from.gridX - tower.gridX;
    const dy = from.gridY - tower.gridY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxRange = from.range || 4;
    
    if (distance > maxRange) {
      this.game.eventBus?.emit('ui:toast', { 
        message: 'Tower too far from energy building!', 
        type: 'error' 
      });
      this.cancelEnergyConnectionMode();
      return;
    }
    
    // Connect tower to energy network as consumer
    const success = energyModule.connectTower?.(from.id, tower);
    
    if (success) {
      this.game.eventBus?.emit('ui:toast', { 
        message: `⚡ Tower connected to power!`, 
        type: 'success' 
      });
    } else {
      this.game.eventBus?.emit('ui:toast', { 
        message: 'Failed to connect tower', 
        type: 'error' 
      });
    }
    
    this.cancelEnergyConnectionMode();
    this.renderGame();
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

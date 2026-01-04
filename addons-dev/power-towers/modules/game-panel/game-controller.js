/**
 * Power Towers TD - Game Controller
 * Handles game logic, canvas, events for detached mode
 * 
 * Modular architecture using mixins:
 * - TowerTooltipMixin: Tower tooltip display and positioning
 * - TowerUpgradesUIMixin: Stat upgrades panel in tooltip
 * - AbilityUpgradesUIMixin: Element ability upgrades panel
 * - EnergyTooltipMixin: Energy building tooltip and connections
 * - CanvasEventsMixin: Canvas click/move/wheel/pan
 * - GameEventsMixin: Game event subscriptions
 * - UIEventsMixin: Button and toolbar interactions
 */

const { TowerTooltipMixin } = require('./tower-tooltip');
const { TowerUpgradesUIMixin } = require('./tower-upgrades-ui');
const { AbilityUpgradesUIMixin } = require('./ability-upgrades-ui');
const { EnergyTooltipMixin } = require('./energy-tooltip-ui');
const { CanvasEventsMixin } = require('./canvas-events');
const { GameEventsMixin } = require('./game-events');
const { UIEventsMixin } = require('./ui-events');
const { BottomPanelMixin } = require('./bottom-panel-ui');
const { PlacementManager, BUILDING_TYPES } = require('../placement');
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
    
    // Unified placement manager
    this.placementManager = null;
    
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
    // Store container reference for child mixins
    this.container = container;
    
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
      wave: container.querySelector('#stat-wave'),
      // New energy HUD elements
      energyProd: container.querySelector('#stat-energy-prod'),
      energyCons: container.querySelector('#stat-energy-cons'),
      energyStored: container.querySelector('#stat-energy-stored'),
      energyCap: container.querySelector('#stat-energy-cap'),
      overlay: container.querySelector('#game-overlay'),
      overlayTitle: container.querySelector('#overlay-title'),
      overlayMessage: container.querySelector('#overlay-message'),
      overlayBtn: container.querySelector('#overlay-btn'),
      btnStart: container.querySelector('#btn-start'),
      // Energy building tooltip (still used for energy buildings)
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
      energyTooltipSpecialRow: container.querySelector('#energy-tooltip-special-row'),
      energyTooltipSpecial: container.querySelector('#energy-tooltip-special'),
      energyTooltipClose: container.querySelector('#energy-tooltip-close'),
      // Energy level bar (new unified)
      energyLevelProgress: container.querySelector('#energy-level-progress'),
      energyLevelText: container.querySelector('#energy-level-text'),
      // Energy Biome section
      energyBiomeSection: container.querySelector('#energy-biome-section'),
      energyBiomeIcon: container.querySelector('#energy-biome-icon'),
      energyBiomeName: container.querySelector('#energy-biome-name'),
      energyBiomeBonus: container.querySelector('#energy-biome-bonus'),
      // Energy stat detail popups
      energyDetailStored: container.querySelector('#energy-detail-stored'),
      energyDetailOutput: container.querySelector('#energy-detail-output'),
      energyDetailRange: container.querySelector('#energy-detail-range'),
      energyDetailGen: container.querySelector('#energy-detail-gen'),
      energyDetailEfficiency: container.querySelector('#energy-detail-efficiency'),
      energyDetailSpecial: container.querySelector('#energy-detail-special'),
      energyUpgradesSection: container.querySelector('#energy-upgrades-section'),
      energyUpgradesGrid: container.querySelector('#energy-upgrades-grid'),
      energyBtnConnect: container.querySelector('#energy-btn-connect'),
      energyBtnUpgrade: container.querySelector('#energy-btn-upgrade'),
      energyBtnSell: container.querySelector('#energy-btn-sell'),
      energyUpgradeBtns: container.querySelectorAll('#energy-upgrades-grid .upgrade-stat-btn'),
      // Pause menu
      pauseMenuOverlay: container.querySelector('#pause-menu-overlay'),
      pauseBtnResume: container.querySelector('#pause-btn-resume'),
      pauseBtnSettings: container.querySelector('#pause-btn-settings'),
      pauseBtnQuit: container.querySelector('#pause-btn-quit'),
      // Bottom panel
      bottomPanel: container.querySelector('#bottom-panel'),
      panelStats: container.querySelector('#panel-stats'),
      panelStatsEmpty: container.querySelector('.panel-stats-empty'),
      panelStatsContent: container.querySelector('#panel-stats-content'),
      statsGridTower: container.querySelector('#stats-grid-tower'),
      statsGridEnergy: container.querySelector('#stats-grid-energy'),
      // Panel stats values (tower)
      panelDmg: container.querySelector('#panel-dmg'),
      panelRng: container.querySelector('#panel-rng'),
      panelSpd: container.querySelector('#panel-spd'),
      panelCrit: container.querySelector('#panel-crit'),
      panelCritdmg: container.querySelector('#panel-critdmg'),
      panelPower: container.querySelector('#panel-power'),
      panelHp: container.querySelector('#panel-hp'),
      panelSplash: container.querySelector('#panel-splash'),
      panelChain: container.querySelector('#panel-chain'),
      // Element ability stats
      panelBurn: container.querySelector('#panel-burn'),
      panelSpread: container.querySelector('#panel-spread'),
      panelSlow: container.querySelector('#panel-slow'),
      panelFreeze: container.querySelector('#panel-freeze'),
      panelPoison: container.querySelector('#panel-poison'),
      panelShock: container.querySelector('#panel-shock'),
      panelDrain: container.querySelector('#panel-drain'),
      // Panel stats values (energy)
      panelStored: container.querySelector('#panel-stored'),
      panelOutput: container.querySelector('#panel-output'),
      panelChannels: container.querySelector('#panel-channels'),
      panelRange: container.querySelector('#panel-range'),
      panelGen: container.querySelector('#panel-gen'),
      panelTrees: container.querySelector('#panel-trees'),
      statRowTrees: container.querySelector('#stat-row-trees'),
      // Avatar section
      panelAvatar: container.querySelector('#panel-avatar'),
      avatarEmpty: container.querySelector('.avatar-empty'),
      avatarContent: container.querySelector('#avatar-content'),
      avatarIcon: container.querySelector('#avatar-icon'),
      avatarName: container.querySelector('#avatar-name'),
      avatarLevel: container.querySelector('#avatar-level'),
      avatarXpFill: container.querySelector('#avatar-xp-fill'),
      avatarXpValue: container.querySelector('#avatar-xp-value'),
      avatarEnergyFill: container.querySelector('#avatar-energy-fill'),
      avatarEnergyValue: container.querySelector('#avatar-energy-value'),
      avatarBtnSell: container.querySelector('#avatar-btn-sell'),
      // Actions section - using new IDs from bottom-panel module
      panelActions: container.querySelector('#panel-build'),
      actionsBuild: container.querySelector('#build-menu'), // New ID
      actionsTower: container.querySelector('#actions-tower'),
      actionsEnergy: container.querySelector('#actions-energy'),
      buildGrid: container.querySelector('.build-cards-grid'), // New class
      buildItems: container.querySelectorAll('.build-card'), // New class
      // Tower actions
      actionAttackType: container.querySelector('#action-attack-type'),
      actionElement: container.querySelector('#action-element'),
      upgradesPanel: container.querySelector('#upgrades-panel'),
      abilitiesPanel: container.querySelector('#abilities-panel'),
      upgradesGridPanel: container.querySelector('#upgrades-grid-panel'),
      abilitiesGridPanel: container.querySelector('#abilities-grid-panel'),
      // Energy actions
      actionConnect: container.querySelector('#action-connect'),
      actionUpgradeEnergy: container.querySelector('#action-upgrade-energy'),
      energyUpgradesPanel: container.querySelector('#energy-upgrades-panel'),
      energyChannelsBtn: container.querySelector('#energy-channels-btn'),
      // Wave control
      waveControl: container.querySelector('#wave-control')
    };
    
    // Setup navigation
    this.setupScreenNavigation(container);
    
    // Setup bottom panel events (build cards, etc.)
    this.setupBottomPanelEvents();
    
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
    
    // ResizeObserver for container size changes
    this.resizeObserver = new ResizeObserver(() => {
      this.resizeCanvas();
    });
    this.resizeObserver.observe(this.canvasContainer);
    
    // Also listen to window resize for fullscreen/maximize changes
    this._windowResizeHandler = () => {
      // Small delay to let layout settle
      setTimeout(() => this.resizeCanvas(), 50);
    };
    window.addEventListener('resize', this._windowResizeHandler);
    
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
    
    // Update canvas dimensions
    this.canvas.width = width;
    this.canvas.height = height;
    
    // Update camera viewport
    if (this.camera) {
      this.camera.setViewportSize(width, height);
    }
    
    // Update renderer (WebGL viewport, projections, text canvases)
    if (this.renderer) {
      this.renderer.resize(width, height);
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
    
    // Reset build card UI
    const buildCards = this.screens.game?.querySelectorAll('.build-card') || [];
    buildCards.forEach(item => {
      item.classList.remove('placing', 'selected', 'disabled');
    });
    
    // Hide tooltip if visible
    this.hideTowerInfo();
    
    if (this.elements.btnStart) this.elements.btnStart.innerHTML = '▶ Start Wave <span class="hotkey-hint">[Space]</span>';
    
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
    
    // Initialize unified PlacementManager
    this.placementManager = new PlacementManager(this.game, {
      gridSize: this.CONFIG?.GRID_SIZE || 32,
      towerCost: this.towerCost
    });
    
    // Pass PlacementManager to energy module if available
    const energyModule = this.game.getModule?.('energy');
    if (energyModule?.buildingManager) {
      energyModule.buildingManager.setPlacementManager(this.placementManager);
    }
    
    // Check canvas exists
    if (!this.canvas) {
      console.error('[GameController] No canvas element');
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
    
    // Initialize renderer (WebGL - pass canvas, not ctx)
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
    
    // Start render loop (independent of game loop for animations)
    this.startRenderLoop();
    
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
    this.setupBottomPanelEvents();
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
    const towerCards = this.screens.game?.querySelectorAll('.build-card[data-type="tower"]') || [];
    towerCards.forEach(item => {
      item.classList.toggle('disabled', !canAfford);
      
      const priceEl = item.querySelector('.build-card-price');
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
    const towerCards = this.screens.game?.querySelectorAll('.build-card[data-type="tower"]') || [];
    towerCards.forEach(item => {
      const priceEl = item.querySelector('.build-card-price');
      if (priceEl) {
        priceEl.textContent = `${this.towerCost}g`;
      }
    });
  }

  /**
   * Enter tower placement mode
   */
  enterPlacementMode() {
    this.placingTower = true;
    
    // Update UI - highlight tower build card
    const buildCards = this.screens.game?.querySelectorAll('.build-card') || [];
    buildCards.forEach(card => {
      if (card.dataset.type === 'tower') {
        card.classList.add('placing');
      }
    });
    
    // Update PlacementManager state
    if (this.placementManager) {
      this.placementManager.enterPlacementMode(BUILDING_TYPES.TOWER);
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
    
    // Update PlacementManager state
    if (this.placementManager) {
      this.placementManager.exitPlacementMode();
    }
    
    // Update UI - remove highlight
    const buildCards = this.screens.game?.querySelectorAll('.build-card') || [];
    buildCards.forEach(card => {
      card.classList.remove('placing');
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
    
    // Update PlacementManager state
    if (this.placementManager) {
      this.placementManager.enterPlacementMode(BUILDING_TYPES.ENERGY, buildingType);
    }
    
    // Update UI - highlight selected energy building card
    const buildCards = this.screens.game?.querySelectorAll('.build-card') || [];
    buildCards.forEach(card => {
      if (card.dataset.type === 'energy' && card.dataset.building === buildingType) {
        card.classList.add('placing');
      } else {
        card.classList.remove('placing');
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
    
    // Update PlacementManager state
    if (this.placementManager) {
      this.placementManager.exitPlacementMode();
    }
    
    // Update UI - remove highlights
    const buildCards = this.screens.game?.querySelectorAll('.build-card') || [];
    buildCards.forEach(card => {
      card.classList.remove('placing');
    });
    
    if (this.renderer) {
      this.renderer.clearHover();
      this.renderGame();
    }
  }
  
  /**
   * Place energy building at position
   * Uses unified PlacementManager for position calculations
   */
  placeEnergyBuilding(gridX, gridY) {
    if (!this.game || !this.placingEnergy || !this.placingEnergyType) return;
    
    const energyModule = this.game.getModule('energy');
    if (!energyModule) {
      console.warn('[GameController] Energy module not found');
      return;
    }
    
    // Get building definition and world coordinates from PlacementManager
    const { ENERGY_BUILDINGS } = require('./../../modules/energy/building-defs');
    const def = ENERGY_BUILDINGS[this.placingEnergyType];
    
    // Use PlacementManager for center calculation
    const center = this.placementManager
      ? this.placementManager.getBuildingCenter(gridX, gridY, def)
      : this._calculateBuildingCenter(gridX, gridY, def);
    
    // Try to place building
    const building = energyModule.placeBuilding(
      this.placingEnergyType,
      gridX, gridY,
      center.x, center.y
    );
    
    if (building) {
      console.log(`[GameController] Placed ${this.placingEnergyType} at (${gridX}, ${gridY})`);
      this.updateUI(this.game.getState());
      this.updateEnergyAffordability();
      this.renderGame();
    }
  }
  
  /**
   * Calculate building center (fallback if no PlacementManager)
   * @private
   */
  _calculateBuildingCenter(gridX, gridY, def) {
    const gs = this.CONFIG.GRID_SIZE;
    const gw = def?.gridWidth || 1;
    const gh = def?.gridHeight || 1;
    const shape = def?.shape || 'rect';
    
    if (shape === 'L' && gw === 2 && gh === 2) {
      return {
        x: gridX * gs + gs,
        y: gridY * gs + gs
      };
    }
    
    return {
      x: gridX * gs + (gw * gs) / 2,
      y: gridY * gs + (gh * gs) / 2
    };
  }
  
  /**
   * Update energy building affordability
   * Uses unified PlacementManager for cost checks
   */
  updateEnergyAffordability() {
    if (!this.game) return;
    
    const energyItems = this.screens.game?.querySelectorAll('.energy-item') || [];
    
    // Use PlacementManager if available
    if (this.placementManager) {
      energyItems.forEach(item => {
        const buildingType = item.dataset.building;
        const canAfford = this.placementManager.canAffordEnergy(buildingType);
        
        item.classList.toggle('disabled', !canAfford);
        
        const priceEl = item.querySelector('.energy-price');
        if (priceEl) {
          priceEl.style.color = canAfford ? '#ffd700' : '#fc8181';
        }
      });
      return;
    }
    
    // Fallback: get defs from energy module
    const gold = this.game.getState().gold || 0;
    const energyModule = this.game.getModule('energy');
    if (!energyModule) return;
    
    const defs = energyModule.getBuildingDefinitions();
    
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
    
    // Update UI - refresh the bottom panel
    setTimeout(() => {
      if (this.game?.selectedTower) {
        this.showTowerInBottomPanel(this.game.selectedTower);
      }
    }, 50);
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
    
    // Update UI - refresh the bottom panel
    setTimeout(() => {
      if (this.game?.selectedTower) {
        this.showTowerInBottomPanel(this.game.selectedTower);
      }
    }, 50);
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
    
    // Energy - New detailed display
    const energyState = state.energy || {};
    const energyProd = Math.floor(energyState.totalGeneration || 0);
    const energyCons = Math.floor(energyState.totalConsumption || 0);
    const energyStored = Math.floor(energyState.totalStored || 0);
    const energyCap = Math.floor(energyState.totalCapacity || 0);
    
    if (last.energyProd !== energyProd && el.energyProd) {
      el.energyProd.textContent = `+${energyProd}`;
      last.energyProd = energyProd;
    }
    if (last.energyCons !== energyCons && el.energyCons) {
      el.energyCons.textContent = `-${energyCons}`;
      last.energyCons = energyCons;
    }
    if (last.energyStored !== energyStored && el.energyStored) {
      el.energyStored.textContent = energyStored;
      last.energyStored = energyStored;
    }
    if (last.energyCap !== energyCap && el.energyCap) {
      el.energyCap.textContent = energyCap;
      last.energyCap = energyCap;
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
        el.btnStart.innerHTML = `${btnText} <span class="hotkey-hint">[Space]</span>`;
        last.btnText = btnText;
      }
    }
    
    // Update tower affordability (has its own optimization)
    this.updateTowerAffordability();
  }

  /**
   * Start independent render loop for animations
   * Runs at 60 FPS regardless of game pause state
   */
  startRenderLoop() {
    // Stop existing loop if any
    if (this._renderLoopId) {
      cancelAnimationFrame(this._renderLoopId);
    }
    
    const loop = () => {
      if (!this.game || !this.renderer) {
        this._renderLoopId = null;
        return;
      }
      
      this.renderGame();
      this._renderLoopId = requestAnimationFrame(loop);
    };
    
    this._renderLoopId = requestAnimationFrame(loop);
  }
  
  /**
   * Stop render loop
   */
  stopRenderLoop() {
    if (this._renderLoopId) {
      cancelAnimationFrame(this._renderLoopId);
      this._renderLoopId = null;
    }
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
    
    // Add selected energy building for range display
    if (this.selectedEnergyBuilding) {
      renderData.selectedEnergyBuilding = this.selectedEnergyBuilding;
    }
    
    this.renderer.render(renderData);
    
    // Update energy building tooltip in real-time if visible
    if (this.selectedEnergyBuilding && this.elements.energyTooltip?.classList.contains('visible')) {
      this.updateEnergyTooltipRealtime(this.selectedEnergyBuilding);
    }
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
    if (this._windowResizeHandler) {
      window.removeEventListener('resize', this._windowResizeHandler);
    }
    if (this.game) {
      this.game.stop();
    }
  }
}

// Apply mixins in order (BottomPanel inside so its methods are available to tooltip mixins)
const GameController = TowerTooltipMixin(
  TowerUpgradesUIMixin(
    AbilityUpgradesUIMixin(
      EnergyTooltipMixin(
        BottomPanelMixin(
          CanvasEventsMixin(
            GameEventsMixin(
              UIEventsMixin(GameControllerBase)
            )
          )
        )
      )
    )
  )
);

module.exports = { GameController };

/**
 * Power Towers TD - Game Core (Modular Architecture)
 * 
 * Main game orchestrator - connects independent modules via EventBus.
 * Each module handles its own domain logic and communicates through events.
 * 
 * @version 0.2.0 - Removed legacy code
 */

const CONFIG = require('./config');
const { EventBus, GameEvents } = require('./event-bus');

// Import modules
const { MapModule } = require('../modules/map');
const { TowersModule, TOWER_TYPES } = require('../modules/towers');
const { EnemiesModule, ENEMY_TYPES } = require('../modules/enemies');
const { CombatModule } = require('../modules/combat');
const { EconomyModule } = require('../modules/economy');
const { EnergyModule } = require('../modules/energy');
const { PlayerModule } = require('../modules/player');
const { MenuModule, MENU_SCREENS } = require('../modules/menu');

/**
 * GameCore - Main game orchestrator
 * 
 * Responsibilities:
 * - Initialize and connect modules
 * - Run game loop
 * - Coordinate inter-module communication
 * - Provide unified API for renderer
 */
class GameCore {
  constructor() {
    // Event system (shared by all modules)
    this.eventBus = new EventBus();

    // Game state
    this.running = false;
    this.paused = false;
    this.gameOver = false;
    
    // Timing
    this.lastTick = 0;
    this.tickRate = 1000 / CONFIG.TARGET_FPS;
    this.animationId = null;
    
    // Selection state (UI)
    this.selectedTower = null;
    this.placingTowerPath = null;

    // Initialize modules
    this.initModules();
    
    // Bind event handlers
    this.setupEventHandlers();
  }

  /**
   * Initialize modular architecture
   */
  initModules() {
    // Create modules
    this.modules = {
      menu: new MenuModule(this.eventBus, CONFIG),
      map: new MapModule(this.eventBus, CONFIG),
      towers: new TowersModule(this.eventBus, CONFIG),
      enemies: new EnemiesModule(this.eventBus, CONFIG),
      combat: new CombatModule(this.eventBus, CONFIG),
      economy: new EconomyModule(this.eventBus, CONFIG),
      energy: new EnergyModule(this.eventBus, CONFIG),
      player: new PlayerModule(this.eventBus, CONFIG)
    };
    
    // Initialize all modules
    for (const [name, module] of Object.entries(this.modules)) {
      module.init();
    }
    
    // Generate initial map (for menu preview)
    this.modules.map.generateMap();
    
    // Set initial gold and lives for UI display
    this.modules.economy.gold = CONFIG.STARTING_GOLD;
    this.modules.player.lives = CONFIG.STARTING_LIVES;
    this.modules.player.maxLives = CONFIG.STARTING_LIVES;

    // Keep the game loop stopped until the first wave starts.
    // (UI expects `running === false` at this point.)
    this.running = false;
    this.paused = false;
    
    // Create proxy getter for towers array (for backwards compatibility with renderer)
    Object.defineProperty(this, 'towers', {
      get: () => this.modules.towers.getTowersArray(),
      configurable: true
    });
    
    // Proxy for waypoints
    Object.defineProperty(this, 'waypoints', {
      get: () => this.modules.map.waypoints,
      configurable: true
    });
    
    // Proxy for economy
    Object.defineProperty(this, 'economy', {
      get: () => this.modules.economy,
      configurable: true
    });
  }

  /**
   * Setup event handlers for inter-module communication
   */
  setupEventHandlers() {
    // Menu events
    this.eventBus.on(GameEvents.GAME_START, (data) => this.onGameStart(data));
    this.eventBus.on(GameEvents.GAME_OVER, (data) => this.onGameOver(data));
    
    // Pause/resume from menu (use internal methods, don't re-emit)
    this.eventBus.on('menu:pause-game', () => this.pauseInternal());
    this.eventBus.on('menu:resume-game', () => this.resumeInternal());
    
    // Wave events
    this.eventBus.on('wave:complete', () => this.onWaveComplete());
    
    // Provide nearby enemies for chain lightning
    this.eventBus.on('enemies:get-nearby', (data) => {
      const enemies = this.modules.enemies.getEnemiesArray();
      const nearby = enemies
        .filter(e => e.id !== data.excludeId && e.health > 0)
        .filter(e => {
          const dist = Math.sqrt(Math.pow(e.x - data.x, 2) + Math.pow(e.y - data.y, 2));
          return dist <= data.radius;
        })
        .slice(0, data.maxCount || 3);
      data.callback(nearby);
    });
  }

  /**
   * Game start handler - called when starting first wave
   */
  onGameStart(data = {}) {
    // Close menu if open
    this.modules.menu.isOpen = false;
  }

  /**
   * Wave complete handler
   */
  onWaveComplete() {
    // Auto-start next wave after delay
    setTimeout(() => {
      if (this.running && !this.paused && !this.gameOver) {
        this.eventBus.emit('wave:start');
      }
    }, 2000);
  }

  /**
   * Game over handler
   */
  onGameOver(data) {
    this.gameOver = true;
    this.running = false;
    
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  /**
   * Start game loop (legacy / external callers)
   */
  start() {
    if (this.gameOver) return;

    if (!this.running) {
      this.running = true;
      this.paused = false;
      this.lastTick = performance.now();
      this.eventBus.emit(GameEvents.GAME_START, this.getState());
      this.gameLoop();
    }
  }

  /**
   * Start next wave (called from "Start Wave" button)
   */
  startWave() {
    if (this.gameOver) return;

    // First wave click should start the main loop.
    if (!this.running) {
      this.running = true;
      this.paused = false;
      this.lastTick = performance.now();
      this.eventBus.emit(GameEvents.GAME_START, this.getState());
      this.gameLoop();
    }

    this.eventBus.emit('wave:start');
  }

  /**
   * Open menu (for external use)
   */
  openMenu() {
    this.modules.menu.openMenu();
  }

  /**
   * Internal pause (no event emit - called from event handler)
   */
  pauseInternal() {
    this.paused = true;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  /**
   * Pause game (with event emit - called from external)
   */
  pause() {
    this.pauseInternal();
    this.eventBus.emit(GameEvents.GAME_PAUSE, this.getState());
  }

  /**
   * Internal resume (no event emit)
   */
  resumeInternal() {
    if (!this.running || !this.paused) return;
    
    this.paused = false;
    this.lastTick = performance.now();
    this.gameLoop();
  }

  /**
   * Resume game (with event emit)
   */
  resume() {
    if (!this.running || !this.paused) return;
    
    this.paused = false;
    this.lastTick = performance.now();
    this.eventBus.emit(GameEvents.GAME_RESUME, this.getState());
    this.gameLoop();
  }

  /**
   * Toggle pause
   */
  togglePause() {
    if (this.paused) {
      this.resume();
    } else {
      this.pause();
    }
  }

  /**
   * Main game loop
   */
  gameLoop() {
    if (!this.running || this.paused) return;
    
    const now = performance.now();
    const deltaTime = (now - this.lastTick) / 1000; // Convert to seconds
    
    this.update(deltaTime);
    this.eventBus.emit(GameEvents.GAME_TICK, { deltaTime, state: this.getState() });
    
    this.lastTick = now;
    this.animationId = requestAnimationFrame(() => this.gameLoop());
  }

  /**
   * Update game state
   */
  update(deltaTime) {
    // Update modules in order
    this.modules.menu.update(deltaTime);
    
    if (this.modules.menu.isOpen) {
      // Don't update game while menu is open
      return;
    }
    
    this.modules.energy.update(deltaTime);
    this.modules.enemies.update(deltaTime);
    
    // Get enemies for towers
    const enemies = this.modules.enemies.getEnemiesArray();
    this.modules.towers.update(deltaTime, enemies);
    this.modules.combat.update(deltaTime, enemies);
    this.modules.player.update(deltaTime);
    this.modules.economy.update(deltaTime);
  }

  // ============= PUBLIC API =============

  /**
   * Check if a tower can be placed at grid position
   */
  canPlaceTower(gridX, gridY) {
    // Check if position is valid for building
    if (!this.modules.map.isBuildable(gridX, gridY)) {
      return false;
    }
    // Check if tower already exists
    if (this.modules.towers.getTowerAt(gridX, gridY)) {
      return false;
    }
    return true;
  }

  /**
   * Place a tower at grid position
   */
  placeTower(gridX, gridY, towerType = 'fire') {
    // Check if position is valid
    if (!this.modules.map.isBuildable(gridX, gridY)) {
      this.eventBus.emit(GameEvents.UI_MESSAGE, { type: 'error', text: 'Cannot build here!' });
      return false;
    }
    
    // Check if tower already exists
    if (this.modules.towers.getTowerAt(gridX, gridY)) {
      this.eventBus.emit(GameEvents.UI_MESSAGE, { type: 'error', text: 'Tower already exists!' });
      return false;
    }
    
    // Check cost
    const cost = TOWER_TYPES[towerType]?.baseCost || 100;
    if (!this.modules.economy.canAfford(cost)) {
      this.eventBus.emit(GameEvents.UI_MESSAGE, { type: 'error', text: 'Not enough gold!' });
      return false;
    }
    
    // Build tower via event
    this.eventBus.emit('tower:build-request', { type: towerType, gridX, gridY });
    return true;
  }

  /**
   * Upgrade a tower
   */
  upgradeTower(towerId, upgradeType) {
    this.eventBus.emit('tower:upgrade-request', { towerId, upgradeType });
  }

  /**
   * Sell a tower
   */
  sellTower(towerId) {
    this.eventBus.emit('tower:sell-request', towerId);
  }

  /**
   * Select a tower
   */
  selectTower(towerId) {
    this.eventBus.emit('tower:select', towerId);
  }

  /**
   * Get current game state
   */
  getState() {
    return {
      running: this.running,
      paused: this.paused,
      gameOver: this.gameOver,
      menuOpen: this.modules.menu.isOpen,
      lives: this.modules.player.lives,
      gold: this.modules.economy.gold,
      energy: this.modules.energy.getRenderData(),
      wave: this.modules.enemies.currentWave,
      waveInProgress: this.modules.enemies.waveInProgress,
      towers: this.modules.towers.getTowersArray().length,
      enemies: this.modules.enemies.getEnemiesArray().length,
      player: this.modules.player.getRenderData()
    };
  }

  /**
   * Get all data for rendering
   * Flattens module data for renderer compatibility
   */
  getRenderData() {
    const mapData = this.modules.map.getRenderData();
    const towersData = this.modules.towers.getRenderData();
    const enemiesData = this.modules.enemies.getRenderData();
    const combatData = this.modules.combat.getRenderData();
    const economyData = this.modules.economy.getRenderData();
    const energyData = this.modules.energy.getRenderData();
    const playerData = this.modules.player.getRenderData();
    const menuData = this.modules.menu.getRenderData();
    
    // Debug: check if map data exists
    if (!mapData.terrain || mapData.terrain.length === 0) {
      console.warn('[GameCore] getRenderData: terrain is empty!', mapData);
    }
    
    return {
      // Map data
      terrain: mapData.terrain,
      terrainTypes: mapData.terrainTypes,
      waypoints: mapData.waypoints,
      pathCells: mapData.pathCells,
      energyNodes: mapData.energyNodes,
      resourceVeins: mapData.resourceVeins,
      
      // Towers
      towers: towersData.towers || [],
      selectedTower: this.selectedTower,
      towerTypes: towersData.towerTypes,
      
      // Enemies & Combat
      enemies: enemiesData.enemies || [],
      projectiles: combatData.projectiles || [],
      
      // Economy
      gold: economyData.gold,
      
      // Energy (getRenderData returns {energy, maxEnergy, percent})
      energy: energyData.energy,
      maxEnergy: energyData.maxEnergy,
      energyRegen: this.modules.energy.regenRate,
      
      // Player
      lives: playerData.lives,
      maxLives: playerData.maxLives,
      // Wave comes from enemies module, not player
      wave: enemiesData.currentWave || 0,
      
      // Menu
      menu: menuData,
      
      // State
      state: this.getState()
    };
  }

  /**
   * Subscribe to events
   */
  on(event, callback) {
    return this.eventBus.on(event, callback);
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    
    for (const module of Object.values(this.modules)) {
      module.destroy();
    }
    
    this.eventBus.clear();
  }

  /**
   * Reset game
   */
  reset() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    
    this.running = false;
    this.paused = false;
    this.gameOver = false;
    
    for (const module of Object.values(this.modules)) {
      module.reset();
    }
    
    this.eventBus.emit(GameEvents.GAME_INIT, this.getState());
  }
}

module.exports = { GameCore, GameEvents, TOWER_TYPES, ENEMY_TYPES, MENU_SCREENS };

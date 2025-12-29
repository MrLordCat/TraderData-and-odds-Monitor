/**
 * Power Towers TD - Game Core (Modular Architecture)
 * 
 * Main game orchestrator - connects independent modules via EventBus.
 * Each module handles its own domain logic and communicates through events.
 * 
 * @version 0.1.0 - Version change only when explicitly requested
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

// Legacy imports for backwards compatibility
const { Tower, createTower, getUpgradeCost, TOWER_PATHS } = require('./entities/tower');
const { Enemy, createEnemy } = require('./entities/enemy');
const { Projectile } = require('./entities/projectile');
const { WaveSystem } = require('./systems/wave-system');
const { EnergySystem } = require('./systems/energy-system');
const { Economy } = require('./systems/economy');

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
    
    // Use modular architecture?
    this.useModularArchitecture = true; // Set false for legacy mode
    
    if (this.useModularArchitecture) {
      this.initModules();
    } else {
      this.initLegacy();
    }
    
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
    
    // Create proxy getter for towers array (for backwards compatibility)
    Object.defineProperty(this, 'towers', {
      get: () => this.modules.towers.getTowersArray(),
      configurable: true
    });
  }

  /**
   * Initialize legacy systems (for backwards compatibility)
   */
  initLegacy() {
    // Legacy systems
    this.waveSystem = new WaveSystem(this.eventBus);
    this.energySystem = new EnergySystem(this.eventBus);
    this.economy = new Economy(this.eventBus);
    
    // Legacy entities
    this.towers = [];
    this.enemies = [];
    this.projectiles = [];
    
    // Legacy state
    this.lives = CONFIG.STARTING_LIVES;
    this.waypoints = [];
    this.pathCells = [];
    
    // Legacy stats
    this.stats = {
      enemiesKilled: 0,
      damageDealt: 0,
      towersBuilt: 0
    };
    
    // Initialize path
    this.initLegacyPath();
  }

  /**
   * Setup event handlers for inter-module communication
   */
  setupEventHandlers() {
    // Menu events
    this.eventBus.on(GameEvents.GAME_START, (data) => this.onGameStart(data));
    this.eventBus.on(GameEvents.GAME_OVER, (data) => this.onGameOver(data));
    this.eventBus.on('game:pause', () => this.pause());
    this.eventBus.on('game:resume', () => this.resume());
    
    // Wave events
    this.eventBus.on('wave:complete', () => this.onWaveComplete());
    
    // Provide nearby enemies for chain lightning
    this.eventBus.on('enemies:get-nearby', (data) => {
      if (this.useModularArchitecture) {
        const enemies = this.modules.enemies.getEnemiesArray();
        const nearby = enemies
          .filter(e => e.id !== data.excludeId && e.health > 0)
          .filter(e => {
            const dist = Math.sqrt(Math.pow(e.x - data.x, 2) + Math.pow(e.y - data.y, 2));
            return dist <= data.radius;
          })
          .slice(0, data.maxCount || 3);
        data.callback(nearby);
      }
    });
  }

  /**
   * Game start handler
   */
  onGameStart(data = {}) {
    this.running = true;
    this.paused = false;
    this.gameOver = false;
    this.lastTick = performance.now();
    
    // Apply bonuses from permanent upgrades
    if (data.bonuses) {
      // Bonuses applied via events to modules
    }
    
    // Generate map (triggers cascade)
    if (this.useModularArchitecture) {
      this.modules.map.generateMap();
    }
    
    this.gameLoop();
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
   * Start game (from external call)
   */
  start() {
    if (this.useModularArchitecture) {
      // Open menu
      this.modules.menu.openMenu();
    } else {
      this.startLegacy();
    }
  }

  /**
   * Pause game
   */
  pause() {
    this.paused = true;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.eventBus.emit(GameEvents.GAME_PAUSE, this.getState());
  }

  /**
   * Resume game
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
    if (this.useModularArchitecture) {
      this.updateModular(deltaTime);
    } else {
      this.updateLegacy(deltaTime);
    }
  }

  /**
   * Update using modular architecture
   */
  updateModular(deltaTime) {
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
    if (this.useModularArchitecture) {
      // Check if position is valid for building
      if (!this.modules.map.isBuildable(gridX, gridY)) {
        return false;
      }
      // Check if tower already exists
      if (this.modules.towers.getTowerAt(gridX, gridY)) {
        return false;
      }
      return true;
    } else {
      // Legacy: check map and existing towers
      const map = this.map;
      if (!map || gridX < 0 || gridY < 0 || gridX >= map[0]?.length || gridY >= map.length) {
        return false;
      }
      if (map[gridY][gridX] !== 0) return false;
      if (this.towers?.some(t => t.gridX === gridX && t.gridY === gridY)) return false;
      return true;
    }
  }

  /**
   * Place a tower at grid position
   */
  placeTower(gridX, gridY, towerType = 'fire') {
    console.log('[game-core] placeTower called:', gridX, gridY, towerType, 'modular:', this.useModularArchitecture);
    
    if (this.useModularArchitecture) {
      // Check if position is valid
      if (!this.modules.map.isBuildable(gridX, gridY)) {
        console.log('[game-core] Cannot build here - not buildable');
        this.eventBus.emit(GameEvents.UI_MESSAGE, { type: 'error', text: 'Cannot build here!' });
        return false;
      }
      
      // Check if tower already exists
      if (this.modules.towers.getTowerAt(gridX, gridY)) {
        console.log('[game-core] Tower already exists');
        this.eventBus.emit(GameEvents.UI_MESSAGE, { type: 'error', text: 'Tower already exists!' });
        return false;
      }
      
      // Check cost
      const cost = TOWER_TYPES[towerType]?.baseCost || 100;
      console.log('[game-core] Tower cost:', cost, 'canAfford:', this.modules.economy.canAfford(cost));
      if (!this.modules.economy.canAfford(cost)) {
        this.eventBus.emit(GameEvents.UI_MESSAGE, { type: 'error', text: 'Not enough gold!' });
        return false;
      }
      
      // Build tower via event
      console.log('[game-core] Emitting tower:build-request');
      this.eventBus.emit('tower:build-request', { type: towerType, gridX, gridY });
      return true;
    } else {
      return this.placeTowerLegacy(gridX, gridY);
    }
  }

  /**
   * Upgrade a tower
   */
  upgradeTower(towerId, upgradeType) {
    if (this.useModularArchitecture) {
      this.eventBus.emit('tower:upgrade-request', { towerId, upgradeType });
    } else {
      return this.upgradeTowerLegacy(towerId, upgradeType);
    }
  }

  /**
   * Sell a tower
   */
  sellTower(towerId) {
    if (this.useModularArchitecture) {
      this.eventBus.emit('tower:sell-request', towerId);
    } else {
      return this.sellTowerLegacy(towerId);
    }
  }

  /**
   * Select a tower
   */
  selectTower(towerId) {
    if (this.useModularArchitecture) {
      this.eventBus.emit('tower:select', towerId);
    } else {
      this.selectedTower = this.towers?.find(t => t.id === towerId) || null;
    }
  }

  /**
   * Start next wave
   */
  startWave() {
    this.eventBus.emit('wave:start');
  }

  /**
   * Get current game state
   */
  getState() {
    if (this.useModularArchitecture) {
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
    } else {
      return this.getStateLegacy();
    }
  }

  /**
   * Get all data for rendering
   */
  getRenderData() {
    if (this.useModularArchitecture) {
      return {
        map: this.modules.map.getRenderData(),
        towers: this.modules.towers.getRenderData(),
        enemies: this.modules.enemies.getRenderData(),
        combat: this.modules.combat.getRenderData(),
        economy: this.modules.economy.getRenderData(),
        energy: this.modules.energy.getRenderData(),
        player: this.modules.player.getRenderData(),
        menu: this.modules.menu.getRenderData(),
        state: this.getState(),
        // Compatibility with old renderer
        waypoints: this.modules.map.waypoints,
        pathCells: this.modules.map.pathCells,
        selectedTower: this.selectedTower
      };
    } else {
      return this.getRenderDataLegacy();
    }
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
    
    if (this.useModularArchitecture) {
      for (const module of Object.values(this.modules)) {
        module.destroy();
      }
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
    
    if (this.useModularArchitecture) {
      for (const module of Object.values(this.modules)) {
        module.reset();
      }
    } else {
      this.resetLegacy();
    }
    
    this.eventBus.emit(GameEvents.GAME_INIT, this.getState());
  }

  // ============= LEGACY METHODS =============
  // Kept for backwards compatibility

  initLegacyPath() {
    this.waypoints = CONFIG.PATH_WAYPOINTS.map(wp => ({
      x: wp.x * CONFIG.MAP_WIDTH,
      y: wp.y * CONFIG.MAP_HEIGHT
    }));
    this.calculatePathCells();
    this.waveSystem?.init(this.waypoints[0]);
  }

  calculatePathCells() {
    this.pathCells = [];
    const gridSize = CONFIG.GRID_SIZE;
    
    for (let i = 0; i < this.waypoints.length - 1; i++) {
      const start = this.waypoints[i];
      const end = this.waypoints[i + 1];
      const dist = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
      const steps = Math.ceil(dist / (gridSize / 2));
      
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const x = start.x + (end.x - start.x) * t;
        const y = start.y + (end.y - start.y) * t;
        const gridX = Math.floor(x / gridSize);
        const gridY = Math.floor(y / gridSize);
        
        if (!this.pathCells.some(c => c.x === gridX && c.y === gridY)) {
          this.pathCells.push({ x: gridX, y: gridY });
        }
      }
    }
  }

  startLegacy() {
    if (this.gameOver) this.reset();
    this.running = true;
    this.paused = false;
    this.lastTick = performance.now();
    this.eventBus.emit(GameEvents.GAME_START, this.getState());
    if (this.waveSystem.currentWave === 0) {
      this.waveSystem.startWave();
    }
    this.gameLoop();
  }

  updateLegacy(deltaTime) {
    this.energySystem?.update(deltaTime * 1000);
    const newEnemy = this.waveSystem?.update(deltaTime * 1000);
    if (newEnemy) this.enemies.push(newEnemy);
    this.updateEnemiesLegacy();
    this.updateTowersLegacy(deltaTime * 1000);
    this.updateProjectilesLegacy();
    if (this.lives <= 0) this.onGameOver({});
  }

  updateEnemiesLegacy() {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      const reachedEnd = enemy.update(this.waypoints);
      if (reachedEnd) {
        this.lives--;
        this.enemies.splice(i, 1);
        this.waveSystem?.enemyRemoved();
        continue;
      }
      if (!enemy.alive) {
        this.economy?.addGold(enemy.reward, 'kill');
        this.enemies.splice(i, 1);
        this.waveSystem?.enemyRemoved();
        this.stats.enemiesKilled++;
      }
    }
  }

  updateTowersLegacy(deltaTime) {
    for (const tower of this.towers) {
      const attack = tower.update(this.enemies, deltaTime);
      if (attack && this.energySystem?.consume(attack.energyCost)) {
        const projectile = new Projectile({ ...attack, speed: CONFIG.PROJECTILE_SPEED, color: tower.color });
        this.projectiles.push(projectile);
      }
    }
  }

  updateProjectilesLegacy() {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      const target = this.enemies.find(e => e.id === proj.targetId);
      const hit = proj.update(target);
      if (hit || !proj.alive) this.projectiles.splice(i, 1);
    }
  }

  placeTowerLegacy(gridX, gridY, path) {
    if (!Tower.canPlace(gridX, gridY, this.towers, this.pathCells)) return false;
    if (!this.economy?.canAfford(CONFIG.BASE_TOWER_COST)) return false;
    const tower = createTower(gridX, gridY, path, path ? 1 : 0);
    this.economy.spend(CONFIG.BASE_TOWER_COST, 'tower');
    this.towers.push(tower);
    this.stats.towersBuilt++;
    return true;
  }

  getStateLegacy() {
    return {
      running: this.running,
      paused: this.paused,
      gameOver: this.gameOver,
      lives: this.lives,
      gold: this.economy?.gold || 0,
      energy: this.energySystem?.getState() || {},
      wave: this.waveSystem?.getState() || {},
      towers: this.towers.length,
      enemies: this.enemies.length,
      stats: this.stats
    };
  }

  getRenderDataLegacy() {
    return {
      towers: this.towers,
      enemies: this.enemies,
      projectiles: this.projectiles,
      waypoints: this.waypoints,
      pathCells: this.pathCells,
      selectedTower: this.selectedTower,
      state: this.getState()
    };
  }

  resetLegacy() {
    this.lives = CONFIG.STARTING_LIVES;
    this.towers = [];
    this.enemies = [];
    this.projectiles = [];
    this.waveSystem?.init(this.waypoints[0]);
    this.energySystem?.reset();
    this.economy?.reset();
    this.stats = { enemiesKilled: 0, damageDealt: 0, towersBuilt: 0 };
    this.selectedTower = null;
    this.placingTowerPath = null;
  }
}

module.exports = { GameCore, GameEvents, TOWER_TYPES, ENEMY_TYPES, MENU_SCREENS };

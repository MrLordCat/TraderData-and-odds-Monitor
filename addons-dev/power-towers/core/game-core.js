/**
 * Power Towers TD - Game Core
 * Main game engine - manages game loop, entities, and systems
 */

const CONFIG = require('./config');
const { EventBus, GameEvents } = require('./event-bus');
const { Tower, createTower, getUpgradeCost, TOWER_PATHS } = require('./entities/tower');
const { Enemy, createEnemy } = require('./entities/enemy');
const { Projectile } = require('./entities/projectile');
const { WaveSystem } = require('./systems/wave-system');
const { EnergySystem } = require('./systems/energy-system');
const { Economy } = require('./systems/economy');
const { MapModule, TERRAIN_TYPES } = require('../modules/map');

class GameCore {
  constructor() {
    // Event system
    this.eventBus = new EventBus();
    
    // Systems
    this.waveSystem = new WaveSystem(this.eventBus);
    this.energySystem = new EnergySystem(this.eventBus);
    this.economy = new Economy(this.eventBus);
    
    // Map module for procedural generation
    this.mapModule = new MapModule(this.eventBus, CONFIG);
    this.mapModule.init();
    
    // Entities
    this.towers = [];
    this.enemies = [];
    this.projectiles = [];
    
    // Game state
    this.lives = CONFIG.STARTING_LIVES;
    this.running = false;
    this.paused = false;
    this.gameOver = false;
    
    // Path (waypoints in absolute coords) - will be populated by MapModule
    this.waypoints = [];
    this.pathCells = [];  // grid cells occupied by path
    
    // Terrain data - will be populated by MapModule
    this.terrain = [];
    this.energyNodes = [];
    this.resourceVeins = [];
    
    // Timing
    this.lastTick = 0;
    this.tickRate = 1000 / CONFIG.TARGET_FPS;
    this.animationId = null;
    
    // Selection state
    this.selectedTower = null;
    this.placingTowerPath = null;  // which path is being placed
    
    // Stats
    this.stats = {
      enemiesKilled: 0,
      damageDealt: 0,
      towersBuilt: 0
    };
    
    // Initialize path
    this.initPath();
  }

  /**
   * Initialize path using procedural map generation
   */
  initPath() {
    // Generate procedural map
    this.mapModule.generateMap();
    
    // Get generated data from MapModule
    this.waypoints = this.mapModule.waypoints;
    this.pathCells = this.mapModule.pathCells;
    this.terrain = this.mapModule.terrain;
    this.energyNodes = this.mapModule.energyNodes;
    this.resourceVeins = this.mapModule.resourceVeins;
    
    // Set wave system start position
    if (this.waypoints.length > 0) {
      this.waveSystem.init(this.waypoints[0]);
    }
    
    console.log('[GameCore] Map initialized with', this.pathCells.length, 'path cells');
  }

  /**
   * Regenerate map with optional seed
   * @param {number} seed - Optional seed for reproducible generation
   */
  regenerateMap(seed = null) {
    this.mapModule.generateMap(seed);
    
    // Update local references
    this.waypoints = this.mapModule.waypoints;
    this.pathCells = this.mapModule.pathCells;
    this.terrain = this.mapModule.terrain;
    this.energyNodes = this.mapModule.energyNodes;
    this.resourceVeins = this.mapModule.resourceVeins;
    
    // Reset wave system position
    if (this.waypoints.length > 0) {
      this.waveSystem.init(this.waypoints[0]);
    }
    
    this.eventBus.emit(GameEvents.GAME_RESET);
  }

  /**
   * Calculate which grid cells the path occupies
   * @deprecated - Now handled by MapModule
   */
  calculatePathCells() {
    this.pathCells = [];
    const gridSize = CONFIG.GRID_SIZE;
    
    for (let i = 0; i < this.waypoints.length - 1; i++) {
      const start = this.waypoints[i];
      const end = this.waypoints[i + 1];
      
      // Interpolate between waypoints
      const dist = Math.sqrt(
        Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2)
      );
      const steps = Math.ceil(dist / (gridSize / 2));
      
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const x = start.x + (end.x - start.x) * t;
        const y = start.y + (end.y - start.y) * t;
        
        const gridX = Math.floor(x / gridSize);
        const gridY = Math.floor(y / gridSize);
        
        // Add if not already in list
        if (!this.pathCells.some(c => c.x === gridX && c.y === gridY)) {
          this.pathCells.push({ x: gridX, y: gridY });
        }
      }
    }
  }

  /**
   * Start or resume game
   */
  start() {
    if (this.gameOver) {
      this.reset();
    }
    
    this.running = true;
    this.paused = false;
    this.lastTick = performance.now();
    
    this.eventBus.emit(GameEvents.GAME_START, this.getState());
    
    // Start first wave if not already started
    if (this.waveSystem.currentWave === 0) {
      this.waveSystem.startWave();
    }
    
    this.gameLoop();
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
    const deltaTime = now - this.lastTick;
    
    this.update(deltaTime);
    this.eventBus.emit(GameEvents.GAME_TICK, { deltaTime, state: this.getState() });
    
    this.lastTick = now;
    this.animationId = requestAnimationFrame(() => this.gameLoop());
  }

  /**
   * Update game state
   */
  update(deltaTime) {
    // Update systems
    this.energySystem.update(deltaTime);
    
    // Spawn enemies
    const newEnemy = this.waveSystem.update(deltaTime);
    if (newEnemy) {
      this.enemies.push(newEnemy);
    }
    
    // Update enemies
    this.updateEnemies();
    
    // Update towers
    this.updateTowers(deltaTime);
    
    // Update projectiles
    this.updateProjectiles();
    
    // Check game over
    if (this.lives <= 0) {
      this.onGameOver();
    }
  }

  /**
   * Update all enemies
   */
  updateEnemies() {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      
      // Update movement
      const reachedEnd = enemy.update(this.waypoints);
      
      if (reachedEnd) {
        // Enemy reached base
        this.lives--;
        this.enemies.splice(i, 1);
        this.waveSystem.enemyRemoved();
        this.eventBus.emit(GameEvents.ENEMY_REACHED_BASE, { enemy, lives: this.lives });
        this.eventBus.emit(GameEvents.LIVES_CHANGED, { lives: this.lives });
        continue;
      }
      
      if (!enemy.alive) {
        // Enemy killed
        this.economy.addGold(enemy.reward, 'kill');
        this.enemies.splice(i, 1);
        this.waveSystem.enemyRemoved();
        this.stats.enemiesKilled++;
        this.eventBus.emit(GameEvents.ENEMY_DEATH, { enemy });
      }
    }
  }

  /**
   * Update all towers
   */
  updateTowers(deltaTime) {
    for (const tower of this.towers) {
      const attack = tower.update(this.enemies, deltaTime);
      
      if (attack) {
        // Check energy
        if (this.energySystem.consume(attack.energyCost)) {
          // Create projectile
          const projectile = new Projectile({
            ...attack,
            speed: CONFIG.PROJECTILE_SPEED,
            color: tower.color
          });
          this.projectiles.push(projectile);
          
          this.eventBus.emit(GameEvents.TOWER_ATTACK, { tower, attack });
        }
      }
    }
  }

  /**
   * Update all projectiles
   */
  updateProjectiles() {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      
      // Find target enemy
      const target = this.enemies.find(e => e.id === proj.targetId);
      const hit = proj.update(target);
      
      if (hit) {
        this.processProjectileHit(proj, target);
        this.projectiles.splice(i, 1);
      } else if (!proj.alive) {
        this.projectiles.splice(i, 1);
      }
    }
  }

  /**
   * Process projectile hitting target
   */
  processProjectileHit(proj, target) {
    proj.hit();
    
    // Apply damage to main target
    if (target && target.alive) {
      const damage = target.takeDamage(proj.damage, proj.damageType);
      this.stats.damageDealt += damage;
      
      // Apply effects
      if (proj.slowPercent > 0) {
        target.applySlow(proj.slowPercent, proj.slowDuration);
      }
      if (proj.burnDamage > 0) {
        target.applyBurn(proj.burnDamage, proj.burnDuration);
      }
      
      // Track on tower
      const tower = this.towers.find(t => t.id === proj.towerId);
      if (tower) {
        tower.recordDamage(damage);
        if (!target.alive) {
          tower.recordKill();
        }
      }
      
      this.eventBus.emit(GameEvents.PROJECTILE_HIT, { proj, target, damage });
      
      // Splash damage
      if (proj.splashRadius > 0) {
        const splashTargets = proj.getEnemiesInSplash(this.enemies);
        for (const e of splashTargets) {
          const splashDmg = e.takeDamage(proj.damage * 0.5, proj.damageType);
          this.stats.damageDealt += splashDmg;
        }
      }
      
      // Chain lightning
      if (proj.chainCount > 0) {
        const nextTarget = proj.getNextChainTarget(this.enemies);
        if (nextTarget) {
          proj.chainedTargets.push(target.id);
          const chainProj = new Projectile({
            ...proj,
            startX: proj.x,
            startY: proj.y,
            targetX: nextTarget.x,
            targetY: nextTarget.y,
            targetId: nextTarget.id,
            chainCount: proj.chainCount - 1,
            damage: proj.damage * 0.7  // reduced chain damage
          });
          chainProj.chainedTargets = [...proj.chainedTargets];
          this.projectiles.push(chainProj);
        }
      }
    }
  }

  /**
   * Place a new tower
   */
  placeTower(gridX, gridY, path = null) {
    // Validate placement
    if (!Tower.canPlace(gridX, gridY, this.towers, this.pathCells)) {
      this.eventBus.emit(GameEvents.UI_MESSAGE, { 
        type: 'error', 
        text: 'Cannot place tower here!' 
      });
      return false;
    }
    
    // Check cost
    const cost = CONFIG.BASE_TOWER_COST;
    if (!this.economy.canAfford(cost)) {
      this.eventBus.emit(GameEvents.UI_MESSAGE, { 
        type: 'error', 
        text: 'Not enough gold!' 
      });
      return false;
    }
    
    // Create tower
    const tower = createTower(gridX, gridY, path, path ? 1 : 0);
    
    // Spend gold
    this.economy.spend(cost, 'tower');
    
    // Add tower
    this.towers.push(tower);
    this.stats.towersBuilt++;
    
    this.eventBus.emit(GameEvents.TOWER_PLACED, { tower });
    
    return true;
  }

  /**
   * Upgrade a tower
   */
  upgradeTower(towerId, path) {
    const tower = this.towers.find(t => t.id === towerId);
    if (!tower) return false;
    
    // Check if can upgrade
    const nextTier = tower.tier + 1;
    if (nextTier > 3) {
      this.eventBus.emit(GameEvents.UI_MESSAGE, { 
        type: 'error', 
        text: 'Tower is max level!' 
      });
      return false;
    }
    
    // If base tower, must choose path
    if (tower.tier === 0 && !path) {
      this.eventBus.emit(GameEvents.UI_MESSAGE, { 
        type: 'error', 
        text: 'Choose an upgrade path!' 
      });
      return false;
    }
    
    // If already has path, must continue same path
    if (tower.path && path && tower.path !== path) {
      this.eventBus.emit(GameEvents.UI_MESSAGE, { 
        type: 'error', 
        text: 'Cannot change tower path!' 
      });
      return false;
    }
    
    const upgradePath = path || tower.path;
    const cost = getUpgradeCost(tower.tier);
    
    if (!this.economy.canAfford(cost)) {
      this.eventBus.emit(GameEvents.UI_MESSAGE, { 
        type: 'error', 
        text: 'Not enough gold!' 
      });
      return false;
    }
    
    // Apply upgrade
    const pathData = TOWER_PATHS[upgradePath];
    const tierData = pathData.tiers[nextTier - 1];
    
    this.economy.spend(cost, 'upgrade');
    
    tower.path = upgradePath;
    tower.tier = nextTier;
    tower.type = tierData.name;
    tower.damage = tierData.damage;
    tower.range = tierData.range;
    tower.fireRate = tierData.fireRate;
    tower.energyCost = tierData.energyCost;
    tower.damageType = pathData.damageType;
    tower.splashRadius = tierData.splashRadius || 0;
    tower.chainCount = tierData.chainCount || 0;
    tower.slowPercent = tierData.slowPercent || 0;
    tower.slowDuration = tierData.slowDuration || 0;
    tower.burnDamage = tierData.burnDamage || 0;
    tower.burnDuration = tierData.burnDuration || 0;
    tower.color = tower.getColor();
    
    this.eventBus.emit(GameEvents.TOWER_UPGRADED, { tower, path: upgradePath, tier: nextTier });
    
    return true;
  }

  /**
   * Sell a tower
   */
  sellTower(towerId) {
    const index = this.towers.findIndex(t => t.id === towerId);
    if (index === -1) return false;
    
    const tower = this.towers[index];
    const refund = Math.floor(CONFIG.BASE_TOWER_COST * 0.5);  // 50% refund
    
    this.economy.addGold(refund, 'sell');
    this.towers.splice(index, 1);
    
    if (this.selectedTower === tower) {
      this.selectedTower = null;
    }
    
    this.eventBus.emit(GameEvents.TOWER_SOLD, { tower, refund });
    
    return true;
  }

  /**
   * Select a tower
   */
  selectTower(towerId) {
    this.selectedTower = this.towers.find(t => t.id === towerId) || null;
  }

  /**
   * Game over handler
   */
  onGameOver() {
    this.gameOver = true;
    this.running = false;
    
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    
    this.eventBus.emit(GameEvents.GAME_OVER, {
      wave: this.waveSystem.currentWave,
      stats: this.stats
    });
  }

  /**
   * Reset game to initial state
   */
  reset() {
    // Stop game loop
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    
    // Reset state
    this.running = false;
    this.paused = false;
    this.gameOver = false;
    this.lives = CONFIG.STARTING_LIVES;
    
    // Clear entities
    this.towers = [];
    this.enemies = [];
    this.projectiles = [];
    
    // Reset systems
    this.waveSystem.init(this.waypoints[0]);
    this.energySystem.reset();
    this.economy.reset();
    
    // Reset stats
    this.stats = {
      enemiesKilled: 0,
      damageDealt: 0,
      towersBuilt: 0
    };
    
    // Reset selection
    this.selectedTower = null;
    this.placingTowerPath = null;
    
    this.eventBus.emit(GameEvents.GAME_INIT, this.getState());
  }

  /**
   * Get current game state
   */
  getState() {
    return {
      running: this.running,
      paused: this.paused,
      gameOver: this.gameOver,
      lives: this.lives,
      gold: this.economy.gold,
      energy: this.energySystem.getState(),
      wave: this.waveSystem.getState(),
      towers: this.towers.length,
      enemies: this.enemies.length,
      stats: this.stats
    };
  }

  /**
   * Get all data for rendering
   */
  getRenderData() {
    return {
      towers: this.towers,
      enemies: this.enemies,
      projectiles: this.projectiles,
      waypoints: this.waypoints,
      pathCells: this.pathCells,
      terrain: this.terrain,
      terrainTypes: TERRAIN_TYPES,
      energyNodes: this.energyNodes,
      resourceVeins: this.resourceVeins,
      selectedTower: this.selectedTower,
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
   * Serialize game state for transfer between windows
   */
  serialize() {
    return {
      // Game state
      lives: this.lives,
      running: this.running,
      paused: this.paused,
      gameOver: this.gameOver,
      stats: { ...this.stats },
      
      // Economy
      economy: {
        gold: this.economy.gold,
        totalEarned: this.economy.totalEarned,
        totalSpent: this.economy.totalSpent
      },
      
      // Energy
      energy: {
        current: this.energySystem.current,
        max: this.energySystem.max,
        regenRate: this.energySystem.regenRate
      },
      
      // Wave system
      wave: {
        currentWave: this.waveSystem.currentWave,
        enemiesRemaining: this.waveSystem.enemiesRemaining,
        enemiesSpawned: this.waveSystem.enemiesSpawned,
        totalEnemiesInWave: this.waveSystem.totalEnemiesInWave,
        isSpawning: this.waveSystem.isSpawning,
        spawnTimer: this.waveSystem.spawnTimer,
        waveDelayTimer: this.waveSystem.waveDelayTimer,
        waitingForNextWave: this.waveSystem.waitingForNextWave,
        spawnQueue: [...this.waveSystem.spawnQueue]
      },
      
      // Towers (full data for restoration)
      towers: this.towers.map(t => ({
        id: t.id,
        type: t.type,
        path: t.path,
        tier: t.tier,
        gridX: t.gridX,
        gridY: t.gridY,
        x: t.x,
        y: t.y,
        damage: t.damage,
        range: t.range,
        fireRate: t.fireRate,
        energyCost: t.energyCost,
        damageType: t.damageType,
        splashRadius: t.splashRadius,
        chainCount: t.chainCount,
        slowPercent: t.slowPercent,
        slowDuration: t.slowDuration,
        burnDamage: t.burnDamage,
        burnDuration: t.burnDuration,
        size: t.size,
        color: t.color,
        cooldown: t.cooldown,
        rotation: t.rotation,
        totalDamageDealt: t.totalDamageDealt,
        totalKills: t.totalKills
      })),
      
      // Enemies (full data for restoration)
      enemies: this.enemies.map(e => ({
        id: e.id,
        type: e.type,
        x: e.x,
        y: e.y,
        waypointIndex: e.waypointIndex,
        speed: e.speed,
        hp: e.hp,
        maxHp: e.maxHp,
        armor: e.armor,
        armorType: e.armorType,
        reward: e.reward,
        size: e.size,
        color: e.color,
        alive: e.alive,
        slowEffect: e.slowEffect,
        slowDuration: e.slowDuration,
        burnDamage: e.burnDamage,
        burnDuration: e.burnDuration
      })),
      
      // Projectiles (can be lost during transfer - acceptable)
      projectiles: []
    };
  }

  /**
   * Restore game state from serialized data
   */
  restoreFromSerialized(data) {
    if (!data) return false;
    
    try {
      // Stop any running loop
      if (this.animationId) {
        cancelAnimationFrame(this.animationId);
        this.animationId = null;
      }
      
      // Restore game state
      this.lives = data.lives;
      this.running = false; // Will be resumed after restore
      this.paused = data.paused;
      this.gameOver = data.gameOver;
      this.stats = { ...data.stats };
      
      // Restore economy
      this.economy.gold = data.economy.gold;
      this.economy.totalEarned = data.economy.totalEarned;
      this.economy.totalSpent = data.economy.totalSpent;
      
      // Restore energy
      this.energySystem.current = data.energy.current;
      this.energySystem.max = data.energy.max;
      this.energySystem.regenRate = data.energy.regenRate;
      
      // Restore wave system
      this.waveSystem.currentWave = data.wave.currentWave;
      this.waveSystem.enemiesRemaining = data.wave.enemiesRemaining;
      this.waveSystem.enemiesSpawned = data.wave.enemiesSpawned;
      this.waveSystem.totalEnemiesInWave = data.wave.totalEnemiesInWave;
      this.waveSystem.isSpawning = data.wave.isSpawning;
      this.waveSystem.spawnTimer = data.wave.spawnTimer;
      this.waveSystem.waveDelayTimer = data.wave.waveDelayTimer;
      this.waveSystem.waitingForNextWave = data.wave.waitingForNextWave;
      this.waveSystem.spawnQueue = [...data.wave.spawnQueue];
      
      // Restore towers
      this.towers = data.towers.map(tData => {
        const tower = new Tower(tData);
        tower.id = tData.id;
        tower.cooldown = tData.cooldown;
        tower.rotation = tData.rotation;
        tower.totalDamageDealt = tData.totalDamageDealt;
        tower.totalKills = tData.totalKills;
        return tower;
      });
      
      // Restore enemies
      this.enemies = data.enemies.map(eData => {
        const enemy = new Enemy(eData);
        enemy.id = eData.id;
        enemy.waypointIndex = eData.waypointIndex;
        enemy.slowEffect = eData.slowEffect;
        enemy.slowDuration = eData.slowDuration;
        enemy.burnDamage = eData.burnDamage;
        enemy.burnDuration = eData.burnDuration;
        return enemy;
      });
      
      // Clear projectiles (acceptable loss)
      this.projectiles = [];
      
      // Resume if was running
      if (data.running && !data.gameOver) {
        this.running = true;
        if (!data.paused) {
          this.lastTick = performance.now();
          this.gameLoop();
        }
      }
      
      console.log('[GameCore] State restored successfully');
      return true;
      
    } catch (e) {
      console.error('[GameCore] Failed to restore state:', e);
      return false;
    }
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    this.eventBus.clear();
  }
}

module.exports = { GameCore, GameEvents };

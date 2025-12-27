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

class GameCore {
  constructor() {
    // Event system
    this.eventBus = new EventBus();
    
    // Systems
    this.waveSystem = new WaveSystem(this.eventBus);
    this.energySystem = new EnergySystem(this.eventBus);
    this.economy = new Economy(this.eventBus);
    
    // Entities
    this.towers = [];
    this.enemies = [];
    this.projectiles = [];
    
    // Game state
    this.lives = CONFIG.STARTING_LIVES;
    this.running = false;
    this.paused = false;
    this.gameOver = false;
    
    // Path (waypoints in absolute coords)
    this.waypoints = [];
    this.pathCells = [];  // grid cells occupied by path
    
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
   * Initialize path waypoints
   */
  initPath() {
    // Convert relative waypoints to absolute
    this.waypoints = CONFIG.PATH_WAYPOINTS.map(wp => ({
      x: wp.x * CONFIG.CANVAS_WIDTH,
      y: wp.y * CONFIG.CANVAS_HEIGHT
    }));
    
    // Calculate grid cells occupied by path
    this.calculatePathCells();
    
    // Set wave system start position
    this.waveSystem.init(this.waypoints[0]);
  }

  /**
   * Calculate which grid cells the path occupies
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

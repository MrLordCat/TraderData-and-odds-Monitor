/**
 * Power Towers TD - Towers Module
 * 
 * Manages tower creation, upgrades, targeting, and attacks.
 * Each tower type has unique behavior and upgrade paths.
 */

const { GameEvents } = require('../../core/event-bus');

// Tower type definitions
const TOWER_TYPES = {
  fire: {
    name: 'Fire Tower',
    emoji: '🔥',
    baseRange: 80,
    baseDamage: 25,
    baseAttackSpeed: 1.0, // attacks per second
    baseCost: 100,
    color: '#ff4500',
    description: 'Burns enemies with fire damage'
  },
  ice: {
    name: 'Ice Tower',
    emoji: '❄️',
    baseRange: 70,
    baseDamage: 15,
    baseAttackSpeed: 0.8,
    baseCost: 80,
    color: '#00bfff',
    description: 'Slows enemies with frost'
  },
  lightning: {
    name: 'Lightning Tower',
    emoji: '⚡',
    baseRange: 100,
    baseDamage: 40,
    baseAttackSpeed: 0.5,
    baseCost: 150,
    color: '#ffd700',
    description: 'Chain lightning damage'
  },
  nature: {
    name: 'Nature Tower',
    emoji: '🌿',
    baseRange: 60,
    baseDamage: 10,
    baseAttackSpeed: 1.5,
    baseCost: 60,
    color: '#32cd32',
    description: 'Poison damage over time'
  },
  dark: {
    name: 'Dark Tower',
    emoji: '💀',
    baseRange: 90,
    baseDamage: 35,
    baseAttackSpeed: 0.7,
    baseCost: 200,
    color: '#800080',
    description: 'Life drain and debuffs'
  }
};

class TowersModule {
  /**
   * @param {EventBus} eventBus - Event system
   * @param {object} config - Game configuration
   */
  constructor(eventBus, config) {
    this.eventBus = eventBus;
    this.config = config;
    
    // Tower instances
    this.towers = new Map(); // towerId -> tower instance
    this.nextTowerId = 1;
    
    // Selected tower for UI
    this.selectedTowerId = null;
  }

  /**
   * Initialize module
   */
  init() {
    this.eventBus.on(GameEvents.GAME_START, () => this.onGameStart());
    this.eventBus.on('tower:build-request', (data) => this.handleBuildRequest(data));
    this.eventBus.on('tower:sell-request', (towerId) => this.handleSellRequest(towerId));
    this.eventBus.on('tower:upgrade-request', (data) => this.handleUpgradeRequest(data));
    this.eventBus.on('tower:select', (towerId) => this.selectTower(towerId));
  }

  /**
   * Update all towers
   */
  update(deltaTime, enemies) {
    for (const [id, tower] of this.towers) {
      this.updateTower(tower, deltaTime, enemies);
    }
  }

  /**
   * Reset towers
   */
  reset() {
    this.towers.clear();
    this.nextTowerId = 1;
    this.selectedTowerId = null;
  }

  /**
   * Cleanup
   */
  destroy() {
    this.reset();
  }

  /**
   * On game start
   */
  onGameStart() {
    this.reset();
  }

  /**
   * Handle tower build request
   */
  handleBuildRequest({ type, gridX, gridY }) {
    const towerDef = TOWER_TYPES[type];
    if (!towerDef) {
      this.eventBus.emit('tower:build-failed', { reason: 'Invalid tower type' });
      return;
    }

    // Check if position is valid (via MapModule event)
    // For now, just create the tower
    const tower = this.createTower(type, gridX, gridY);
    
    if (tower) {
      this.eventBus.emit('economy:spend', towerDef.baseCost);
      this.eventBus.emit('tower:built', { tower });
      this.eventBus.emit(GameEvents.TOWER_PLACED, { tower });
    }
  }

  /**
   * Create a new tower
   */
  createTower(type, gridX, gridY) {
    const towerDef = TOWER_TYPES[type];
    if (!towerDef) return null;

    const gridSize = this.config.GRID_SIZE;
    const tower = {
      id: this.nextTowerId++,
      type,
      gridX,
      gridY,
      // Center position in pixels
      x: gridX * gridSize + gridSize / 2,
      y: gridY * gridSize + gridSize / 2,
      // Stats
      range: towerDef.baseRange,
      damage: towerDef.baseDamage,
      attackSpeed: towerDef.baseAttackSpeed,
      // State
      level: 1,
      tier: 1,  // Visual tier indicator
      attackCooldown: 0,
      target: null,
      rotation: 0,  // Turret rotation in radians
      // Visual
      size: gridSize,  // Tower size in pixels
      emoji: towerDef.emoji,
      color: towerDef.color,
      // Combat stats
      kills: 0,
      totalDamage: 0
    };

    this.towers.set(tower.id, tower);
    return tower;
  }

  /**
   * Handle sell request
   */
  handleSellRequest(towerId) {
    const tower = this.towers.get(towerId);
    if (!tower) return;

    const towerDef = TOWER_TYPES[tower.type];
    const sellValue = Math.floor(towerDef.baseCost * 0.6 * tower.level);

    this.towers.delete(towerId);
    
    this.eventBus.emit('economy:gain', sellValue);
    this.eventBus.emit('tower:sold', { towerId, sellValue });
    
    if (this.selectedTowerId === towerId) {
      this.selectedTowerId = null;
      this.eventBus.emit('tower:deselected');
    }
  }

  /**
   * Handle upgrade request
   */
  handleUpgradeRequest({ towerId, upgradeType }) {
    const tower = this.towers.get(towerId);
    if (!tower) return;

    const upgradeCost = this.getUpgradeCost(tower);
    
    // Request economy check
    this.eventBus.emit('economy:check-afford', {
      amount: upgradeCost,
      callback: (canAfford) => {
        if (canAfford) {
          this.upgradeTower(tower, upgradeType);
          this.eventBus.emit('economy:spend', upgradeCost);
          this.eventBus.emit('tower:upgraded', { tower });
        } else {
          this.eventBus.emit('tower:upgrade-failed', { reason: 'Not enough gold' });
        }
      }
    });
  }

  /**
   * Upgrade a tower
   */
  upgradeTower(tower, upgradeType) {
    tower.level++;
    tower.tier = tower.level;  // Update visual tier
    
    // Increase stats based on upgrade type or general upgrade
    switch (upgradeType) {
      case 'damage':
        tower.damage *= 1.3;
        break;
      case 'range':
        tower.range *= 1.15;
        break;
      case 'speed':
        tower.attackSpeed *= 1.2;
        break;
      default:
        // General upgrade
        tower.damage *= 1.2;
        tower.range *= 1.05;
        tower.attackSpeed *= 1.1;
    }
  }

  /**
   * Get upgrade cost
   */
  getUpgradeCost(tower) {
    const towerDef = TOWER_TYPES[tower.type];
    return Math.floor(towerDef.baseCost * tower.level * 0.75);
  }

  /**
   * Select a tower
   */
  selectTower(towerId) {
    this.selectedTowerId = towerId;
    const tower = this.towers.get(towerId);
    
    if (tower) {
      this.eventBus.emit('tower:selected', { tower });
    }
  }

  /**
   * Update single tower
   */
  updateTower(tower, deltaTime, enemies) {
    // Reduce cooldown
    if (tower.attackCooldown > 0) {
      tower.attackCooldown -= deltaTime;
    }

    // Find target if none or current target out of range/dead
    if (!tower.target || !this.isValidTarget(tower, tower.target, enemies)) {
      tower.target = this.findTarget(tower, enemies);
    }

    // Rotate towards target
    if (tower.target) {
      const dx = tower.target.x - tower.x;
      const dy = tower.target.y - tower.y;
      tower.rotation = Math.atan2(dy, dx);
    }

    // Attack if target and ready
    if (tower.target && tower.attackCooldown <= 0) {
      this.attack(tower);
    }
  }

  /**
   * Check if target is still valid
   */
  isValidTarget(tower, target, enemies) {
    // Check if enemy still exists
    const enemy = enemies.find(e => e.id === target.id);
    if (!enemy || enemy.health <= 0) return false;

    // Check range
    const dist = Math.sqrt(
      Math.pow(enemy.x - tower.x, 2) + Math.pow(enemy.y - tower.y, 2)
    );
    return dist <= tower.range;
  }

  /**
   * Find best target for tower
   */
  findTarget(tower, enemies) {
    let bestTarget = null;
    let bestScore = -Infinity;

    for (const enemy of enemies) {
      if (enemy.health <= 0) continue;

      const dist = Math.sqrt(
        Math.pow(enemy.x - tower.x, 2) + Math.pow(enemy.y - tower.y, 2)
      );

      if (dist > tower.range) continue;

      // Score: prefer enemies closest to base (furthest along path)
      const score = enemy.pathProgress - dist * 0.01;
      
      if (score > bestScore) {
        bestScore = score;
        bestTarget = enemy;
      }
    }

    return bestTarget;
  }

  /**
   * Perform attack
   */
  attack(tower) {
    if (!tower.target) return;

    // Set cooldown
    tower.attackCooldown = 1 / tower.attackSpeed;

    // Emit attack event for combat module
    this.eventBus.emit('combat:tower-attack', {
      towerId: tower.id,
      towerType: tower.type,
      targetId: tower.target.id,
      damage: tower.damage,
      position: { x: tower.x, y: tower.y },
      targetPosition: { x: tower.target.x, y: tower.target.y }
    });

    // Update stats
    tower.totalDamage += tower.damage;
  }

  /**
   * Handle kill notification
   */
  onEnemyKilled(towerId) {
    const tower = this.towers.get(towerId);
    if (tower) {
      tower.kills++;
    }
  }

  /**
   * Get tower at grid position
   */
  getTowerAt(gridX, gridY) {
    for (const [id, tower] of this.towers) {
      if (tower.gridX === gridX && tower.gridY === gridY) {
        return tower;
      }
    }
    return null;
  }

  /**
   * Get all towers for rendering
   */
  getTowersArray() {
    return Array.from(this.towers.values());
  }

  /**
   * Get render data
   */
  getRenderData() {
    return {
      towers: this.getTowersArray(),
      selectedId: this.selectedTowerId,
      towerTypes: TOWER_TYPES
    };
  }
}

module.exports = { TowersModule, TOWER_TYPES };

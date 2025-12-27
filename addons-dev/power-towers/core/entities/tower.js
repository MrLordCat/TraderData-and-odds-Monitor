/**
 * Power Towers TD - Tower Entity
 */

const CONFIG = require('../config');

let towerIdCounter = 0;

class Tower {
  constructor(data = {}) {
    this.id = ++towerIdCounter;
    this.type = data.type || 'base';
    this.path = data.path || null;    // fire, ice, lightning, nature, dark
    this.tier = data.tier || 0;
    
    // Position (grid-based, then converted to pixels)
    this.gridX = data.gridX || 0;
    this.gridY = data.gridY || 0;
    this.x = data.x || (this.gridX * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2);
    this.y = data.y || (this.gridY * CONFIG.GRID_SIZE + CONFIG.GRID_SIZE / 2);
    
    // Stats (base values, modified by path/tier)
    this.damage = data.damage || CONFIG.TOWER_BASE_DAMAGE;
    this.range = data.range || CONFIG.TOWER_BASE_RANGE;
    this.fireRate = data.fireRate || CONFIG.TOWER_BASE_FIRE_RATE;  // attacks per second
    this.energyCost = data.energyCost || CONFIG.TOWER_BASE_ENERGY_COST;
    
    // Attack properties
    this.damageType = data.damageType || 'physical';
    this.splashRadius = data.splashRadius || 0;
    this.chainCount = data.chainCount || 0;
    this.slowPercent = data.slowPercent || 0;
    this.slowDuration = data.slowDuration || 0;
    this.burnDamage = data.burnDamage || 0;
    this.burnDuration = data.burnDuration || 0;
    
    // Visual
    this.size = data.size || 20;
    this.color = this.getColor();
    
    // State
    this.cooldown = 0;          // ticks until can fire again
    this.target = null;         // current target enemy
    this.rotation = 0;          // facing direction
    this.totalDamageDealt = 0;
    this.totalKills = 0;
  }

  /**
   * Get tower color based on path
   */
  getColor() {
    if (this.path && CONFIG.COLORS.tower[this.path]) {
      return CONFIG.COLORS.tower[this.path];
    }
    return CONFIG.COLORS.tower.base;
  }

  /**
   * Update tower (cooldown, targeting)
   * @param {Array} enemies - Available targets
   * @param {number} deltaTime - Time since last update (ms)
   * @returns {Object|null} Attack info if fired, null otherwise
   */
  update(enemies, deltaTime) {
    // Reduce cooldown
    if (this.cooldown > 0) {
      this.cooldown -= deltaTime;
    }

    // Find target if none or current is invalid
    if (!this.target || !this.target.alive || this.distanceTo(this.target) > this.range) {
      this.target = this.findTarget(enemies);
    }

    // Update rotation to face target
    if (this.target) {
      const dx = this.target.x - this.x;
      const dy = this.target.y - this.y;
      this.rotation = Math.atan2(dy, dx);
    }

    // Can we attack?
    if (this.cooldown <= 0 && this.target) {
      return this.createAttack();
    }

    return null;
  }

  /**
   * Find best target in range
   */
  findTarget(enemies) {
    let bestTarget = null;
    let bestProgress = -1;  // Target enemy closest to base (furthest along path)

    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      
      const dist = this.distanceTo(enemy);
      if (dist > this.range) continue;

      // Prioritize enemies further along the path
      if (enemy.waypointIndex > bestProgress) {
        bestProgress = enemy.waypointIndex;
        bestTarget = enemy;
      }
    }

    return bestTarget;
  }

  /**
   * Create attack info (does not apply damage, just returns data)
   */
  createAttack() {
    if (!this.target) return null;

    // Set cooldown (convert fireRate to ms)
    this.cooldown = 1000 / this.fireRate;

    return {
      towerId: this.id,
      targetId: this.target.id,
      damage: this.damage,
      damageType: this.damageType,
      splashRadius: this.splashRadius,
      chainCount: this.chainCount,
      slowPercent: this.slowPercent,
      slowDuration: this.slowDuration,
      burnDamage: this.burnDamage,
      burnDuration: this.burnDuration,
      energyCost: this.energyCost,
      startX: this.x,
      startY: this.y,
      targetX: this.target.x,
      targetY: this.target.y
    };
  }

  /**
   * Record a kill
   */
  recordKill() {
    this.totalKills++;
  }

  /**
   * Record damage dealt
   */
  recordDamage(amount) {
    this.totalDamageDealt += amount;
  }

  /**
   * Get distance to an enemy
   */
  distanceTo(enemy) {
    const dx = this.x - enemy.x;
    const dy = this.y - enemy.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Check if can be placed at position
   */
  static canPlace(gridX, gridY, existingTowers, pathCells) {
    // Check grid bounds
    const maxGrid = Math.floor(CONFIG.CANVAS_WIDTH / CONFIG.GRID_SIZE);
    if (gridX < 0 || gridX >= maxGrid || gridY < 0 || gridY >= maxGrid) {
      return false;
    }

    // Check if on path
    if (pathCells && pathCells.some(c => c.x === gridX && c.y === gridY)) {
      return false;
    }

    // Check if tower already exists
    if (existingTowers.some(t => t.gridX === gridX && t.gridY === gridY)) {
      return false;
    }

    return true;
  }
}

/**
 * Tower upgrade paths data
 */
const TOWER_PATHS = {
  fire: {
    name: 'Fire Path',
    icon: '🔥',
    damageType: 'magical',
    strongVs: ['heavy', 'undead'],
    weakVs: ['fire_immune'],
    tiers: [
      {
        tier: 1,
        name: 'Flame Tower',
        damage: 15,
        range: 65,
        fireRate: 1.0,
        energyCost: 3,
        burnDamage: 2,
        burnDuration: 60
      },
      {
        tier: 2,
        name: 'Inferno Tower',
        damage: 25,
        range: 70,
        fireRate: 0.8,
        energyCost: 5,
        splashRadius: 25,
        burnDamage: 3,
        burnDuration: 90
      },
      {
        tier: 3,
        name: 'Phoenix Spire',
        damage: 40,
        range: 80,
        fireRate: 0.7,
        energyCost: 8,
        splashRadius: 35,
        burnDamage: 5,
        burnDuration: 120
      }
    ]
  },
  ice: {
    name: 'Ice Path',
    icon: '❄️',
    damageType: 'magical',
    strongVs: ['light', 'flying'],
    weakVs: ['ice_immune'],
    tiers: [
      {
        tier: 1,
        name: 'Frost Tower',
        damage: 10,
        range: 60,
        fireRate: 1.2,
        energyCost: 3,
        slowPercent: 0.3,
        slowDuration: 60
      },
      {
        tier: 2,
        name: 'Blizzard Tower',
        damage: 18,
        range: 70,
        fireRate: 1.0,
        energyCost: 5,
        splashRadius: 30,
        slowPercent: 0.5,
        slowDuration: 90
      },
      {
        tier: 3,
        name: 'Absolute Zero',
        damage: 30,
        range: 80,
        fireRate: 0.8,
        energyCost: 8,
        splashRadius: 40,
        slowPercent: 0.8,
        slowDuration: 120
      }
    ]
  },
  lightning: {
    name: 'Lightning Path',
    icon: '⚡',
    damageType: 'physical',
    strongVs: ['medium', 'mech'],
    weakVs: ['grounded'],
    tiers: [
      {
        tier: 1,
        name: 'Spark Tower',
        damage: 12,
        range: 70,
        fireRate: 1.5,
        energyCost: 4
      },
      {
        tier: 2,
        name: 'Tesla Coil',
        damage: 20,
        range: 75,
        fireRate: 1.3,
        energyCost: 6,
        chainCount: 2
      },
      {
        tier: 3,
        name: 'Storm Nexus',
        damage: 35,
        range: 85,
        fireRate: 1.2,
        energyCost: 10,
        chainCount: 4
      }
    ]
  },
  nature: {
    name: 'Nature Path',
    icon: '🌿',
    damageType: 'poison',
    strongVs: ['organic', 'light'],
    weakVs: ['undead', 'mech'],
    tiers: [
      {
        tier: 1,
        name: 'Thorn Tower',
        damage: 8,
        range: 55,
        fireRate: 1.0,
        energyCost: 2,
        burnDamage: 3,   // poison as burn
        burnDuration: 90
      },
      {
        tier: 2,
        name: 'Treant Tower',
        damage: 15,
        range: 60,
        fireRate: 0.8,
        energyCost: 4,
        burnDamage: 5,
        burnDuration: 120
      },
      {
        tier: 3,
        name: 'World Tree',
        damage: 25,
        range: 70,
        fireRate: 0.6,
        energyCost: 7,
        splashRadius: 30,
        burnDamage: 8,
        burnDuration: 150
      }
    ]
  },
  dark: {
    name: 'Dark Path',
    icon: '💀',
    damageType: 'true',  // ignores armor
    strongVs: ['all'],
    weakVs: ['holy'],
    tiers: [
      {
        tier: 1,
        name: 'Shadow Tower',
        damage: 12,
        range: 60,
        fireRate: 0.9,
        energyCost: 4
      },
      {
        tier: 2,
        name: 'Vampire Spire',
        damage: 22,
        range: 65,
        fireRate: 0.8,
        energyCost: 6
      },
      {
        tier: 3,
        name: 'Void Obelisk',
        damage: 40,
        range: 75,
        fireRate: 0.6,
        energyCost: 10
      }
    ]
  }
};

/**
 * Factory to create tower from path and tier
 */
function createTower(gridX, gridY, path = null, tier = 0) {
  const baseData = {
    gridX,
    gridY,
    path,
    tier
  };

  if (path && TOWER_PATHS[path]) {
    const pathData = TOWER_PATHS[path];
    const tierData = pathData.tiers[tier - 1];
    
    if (tierData) {
      return new Tower({
        ...baseData,
        ...tierData,
        type: tierData.name,
        damageType: pathData.damageType
      });
    }
  }

  // Return base tower if no path selected
  return new Tower(baseData);
}

/**
 * Get upgrade cost for a tower
 */
function getUpgradeCost(currentTier) {
  return CONFIG.BASE_TOWER_COST * Math.pow(CONFIG.UPGRADE_COST_MULTIPLIER, currentTier + 1);
}

module.exports = { Tower, TOWER_PATHS, createTower, getUpgradeCost };

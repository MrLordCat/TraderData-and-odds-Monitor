/**
 * Power Towers TD - Tower Entity
 */

const CONFIG = require('../config');
const { 
  getAttackType, 
  applyAttackTypeModifiers, 
  calculateMagicDamage,
  rollCritical 
} = require('../attack-types');
const { TOWER_PATHS } = require('./tower-paths');

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
    
    // =========================================
    // BASE STATS (before attack type modifiers)
    // =========================================
    this.baseDamage = data.baseDamage || CONFIG.TOWER_BASE_DAMAGE;
    this.baseRange = data.baseRange || CONFIG.TOWER_BASE_RANGE;
    this.baseFireRate = data.baseFireRate || CONFIG.TOWER_BASE_FIRE_RATE;
    this.baseEnergyCost = data.baseEnergyCost || CONFIG.TOWER_BASE_ENERGY_COST;
    
    // =========================================
    // ATTACK TYPE SYSTEM
    // =========================================
    this.attackTypeId = data.attackTypeId || 'base';
    this.attackTypeConfig = getAttackType(this.attackTypeId);
    
    // Apply attack type modifiers to get effective stats
    const modifiedStats = applyAttackTypeModifiers({
      damage: this.baseDamage,
      fireRate: this.baseFireRate,
      range: this.baseRange,
      energyCost: this.baseEnergyCost
    }, this.attackTypeId);
    
    // =========================================
    // EFFECTIVE STATS (after attack type modifiers)
    // =========================================
    this.damage = modifiedStats.damage;
    this.range = modifiedStats.range;
    this.fireRate = modifiedStats.fireRate;
    this.energyCost = modifiedStats.energyCost;
    
    // Attack type properties
    this.critChance = modifiedStats.critChance;
    this.critDmgMod = modifiedStats.critDmgMod;
    this.splashRadius = modifiedStats.splashRadius;
    this.splashDmgFalloff = modifiedStats.splashDmgFalloff;
    this.chainCount = modifiedStats.chainCount;
    this.chainDmgFalloff = modifiedStats.chainDmgFalloff;
    
    // Magic system properties
    this.powerScaling = modifiedStats.powerScaling;
    this.minPowerDraw = modifiedStats.minPowerDraw;
    this.maxPowerDraw = modifiedStats.maxPowerDraw;
    this.overdriveEfficiency = modifiedStats.overdriveEfficiency;
    this.currentPowerDraw = data.currentPowerDraw || 50;
    
    // DoT properties
    this.burnDamage = modifiedStats.burnDamage;
    this.burnDuration = modifiedStats.burnDuration;
    this.poisonDamage = modifiedStats.poisonDamage;
    this.poisonDuration = modifiedStats.poisonDuration;
    
    // Debuff properties
    this.slowPercent = modifiedStats.slowPercent;
    this.slowDuration = modifiedStats.slowDuration;
    this.armorReduction = modifiedStats.armorReduction;
    this.armorReductionDuration = modifiedStats.armorReductionDuration;
    
    // Projectile visuals
    this.projectileColor = modifiedStats.projectileColor;
    this.projectileSize = modifiedStats.projectileSize;
    this.projectileSpeed = modifiedStats.projectileSpeed;
    
    // Legacy property
    this.damageType = data.damageType || 'physical';
    
    // Visual
    this.size = data.size || 20;
    this.color = this.getColor();
    
    // State
    this.cooldown = 0;
    this.target = null;
    this.rotation = 0;
    this.totalDamageDealt = 0;
    this.totalKills = 0;
    this.totalCrits = 0;
    
    // =========================================
    // STAT UPGRADES TRACKING
    // =========================================
    this.upgradeLevels = data.upgradeLevels || {
      damage: 0,
      attackSpeed: 0,
      range: 0,
      critChance: 0,
      critDamage: 0,
      health: 0,
      energyStorage: 0,
      energyRegen: 0,
      armor: 0,
      lifesteal: 0,
      cooldownReduction: 0,
      multishot: 0,
      aoeSize: 0
    };
  }

  /**
   * Change attack type and recalculate stats
   */
  setAttackType(newAttackTypeId) {
    this.attackTypeId = newAttackTypeId;
    this.attackTypeConfig = getAttackType(newAttackTypeId);
    
    const modifiedStats = applyAttackTypeModifiers({
      damage: this.baseDamage,
      fireRate: this.baseFireRate,
      range: this.baseRange,
      energyCost: this.baseEnergyCost
    }, this.attackTypeId);
    
    // Update all stats
    this.damage = modifiedStats.damage;
    this.range = modifiedStats.range;
    this.fireRate = modifiedStats.fireRate;
    this.energyCost = modifiedStats.energyCost;
    this.critChance = modifiedStats.critChance;
    this.critDmgMod = modifiedStats.critDmgMod;
    this.splashRadius = modifiedStats.splashRadius;
    this.splashDmgFalloff = modifiedStats.splashDmgFalloff;
    this.chainCount = modifiedStats.chainCount;
    this.chainDmgFalloff = modifiedStats.chainDmgFalloff;
    this.powerScaling = modifiedStats.powerScaling;
    this.minPowerDraw = modifiedStats.minPowerDraw;
    this.maxPowerDraw = modifiedStats.maxPowerDraw;
    this.overdriveEfficiency = modifiedStats.overdriveEfficiency;
    this.burnDamage = modifiedStats.burnDamage;
    this.burnDuration = modifiedStats.burnDuration;
    this.poisonDamage = modifiedStats.poisonDamage;
    this.poisonDuration = modifiedStats.poisonDuration;
    this.slowPercent = modifiedStats.slowPercent;
    this.slowDuration = modifiedStats.slowDuration;
    this.armorReduction = modifiedStats.armorReduction;
    this.armorReductionDuration = modifiedStats.armorReductionDuration;
    this.projectileColor = modifiedStats.projectileColor;
    this.projectileSize = modifiedStats.projectileSize;
    this.projectileSpeed = modifiedStats.projectileSpeed;
    
    this.color = this.getColor();
  }

  /**
   * Apply a stat upgrade
   * @param {string} upgradeId - Upgrade ID (damage, attackSpeed, range, etc.)
   * @param {Object} upgradeConfig - Upgrade config with effect data
   * @returns {boolean} Success
   */
  applyStatUpgrade(upgradeId, upgradeConfig) {
    if (!this.upgradeLevels.hasOwnProperty(upgradeId)) {
      console.warn(`Unknown upgrade: ${upgradeId}`);
      return false;
    }
    
    // Increment upgrade level
    this.upgradeLevels[upgradeId]++;
    
    const effect = upgradeConfig.effect;
    const value = effect.valuePerLevel;
    
    // Apply upgrade based on stat type
    switch (effect.stat) {
      case 'baseDamage':
        this.baseDamage += value;
        this.damage = this.baseDamage * this.attackTypeConfig.dmgMod;
        break;
      case 'baseFireRate':
        this.baseFireRate += value;
        this.fireRate = this.baseFireRate * this.attackTypeConfig.atkSpdMod;
        break;
      case 'baseRange':
        this.baseRange += value;
        this.range = this.baseRange * this.attackTypeConfig.rangeMod;
        break;
      case 'critChance':
        const maxCrit = effect.maxValue || 0.75;
        this.critChance = Math.min(this.critChance + value, maxCrit);
        break;
      case 'critDmgMod':
        const maxCritDmg = effect.maxValue || 5.0;
        this.critDmgMod = Math.min(this.critDmgMod + value, maxCritDmg);
        break;
      case 'maxHp':
        this.maxHp += value;
        this.currentHp = Math.min(this.currentHp + value, this.maxHp);
        break;
      case 'energyStorage':
        this.energyStorage = (this.energyStorage || 50) + value;
        break;
      case 'energyRegen':
        this.energyRegen = (this.energyRegen || 1) + value;
        break;
      case 'armor':
        this.armor = (this.armor || 0) + value;
        break;
      case 'lifesteal':
        const maxLifesteal = effect.maxValue || 0.5;
        this.lifesteal = Math.min((this.lifesteal || 0) + value, maxLifesteal);
        break;
      case 'cooldownReduction':
        const maxCdr = effect.maxValue || 0.5;
        this.cooldownReduction = Math.min((this.cooldownReduction || 0) + value, maxCdr);
        break;
      case 'multishot':
        const maxMs = effect.maxValue || 5;
        this.multishot = Math.min((this.multishot || 1) + value, maxMs);
        break;
      case 'splashRadius':
        const maxAoe = effect.maxValue || 100;
        this.splashRadius = Math.min((this.splashRadius || 0) + value, maxAoe);
        break;
      default:
        console.warn(`Unknown stat: ${effect.stat}`);
        return false;
    }
    
    return true;
  }

  /**
   * Get current upgrade level for a stat
   * @param {string} upgradeId - Upgrade ID
   * @returns {number} Current level
   */
  getUpgradeLevel(upgradeId) {
    return this.upgradeLevels[upgradeId] || 0;
  }

  /**
   * Upgrade base stat (additive)
   */
  upgradeBaseStat(stat, amount) {
    switch (stat) {
      case 'damage':
        this.baseDamage += amount;
        this.damage = this.baseDamage * this.attackTypeConfig.dmgMod;
        break;
      case 'range':
        this.baseRange += amount;
        this.range = this.baseRange * this.attackTypeConfig.rangeMod;
        break;
      case 'fireRate':
        this.baseFireRate += amount;
        this.fireRate = this.baseFireRate * this.attackTypeConfig.atkSpdMod;
        break;
      case 'energyCost':
        this.baseEnergyCost += amount;
        this.energyCost = this.baseEnergyCost * this.attackTypeConfig.energyCostMod;
        break;
    }
  }

  /**
   * Set power draw for Magic attack type
   */
  setPowerDraw(percent) {
    const maxWithOverdrive = this.overdriveEfficiency > 0 ? 200 : this.maxPowerDraw;
    this.currentPowerDraw = Math.max(this.minPowerDraw, Math.min(maxWithOverdrive, percent));
  }

  /**
   * Get tower color
   */
  getColor() {
    if (this.path && CONFIG.COLORS.tower[this.path]) {
      return CONFIG.COLORS.tower[this.path];
    }
    if (this.attackTypeConfig && this.attackTypeConfig.color) {
      return this.attackTypeConfig.color;
    }
    return CONFIG.COLORS.tower.base;
  }

  /**
   * Update tower
   */
  update(enemies, deltaTime) {
    if (this.cooldown > 0) {
      this.cooldown -= deltaTime;
    }

    if (!this.target || !this.target.alive || this.distanceTo(this.target) > this.range) {
      this.target = this.findTarget(enemies);
    }

    if (this.target) {
      const dx = this.target.x - this.x;
      const dy = this.target.y - this.y;
      this.rotation = Math.atan2(dy, dx);
    }

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
    let bestProgress = -1;

    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      
      const dist = this.distanceTo(enemy);
      if (dist > this.range) continue;

      if (enemy.waypointIndex > bestProgress) {
        bestProgress = enemy.waypointIndex;
        bestTarget = enemy;
      }
    }

    return bestTarget;
  }

  /**
   * Create attack info
   */
  createAttack() {
    if (!this.target) return null;

    this.cooldown = 1000 / this.fireRate;

    let finalDamage = this.damage;
    let powerCost = 0;
    let isOverdrive = false;
    let effectivePower = 0;
    
    // Handle Magic attack type
    if (this.attackTypeId === 'magic' && this.powerScaling > 0) {
      const magicResult = calculateMagicDamage(
        this.damage,
        this.currentPowerDraw,
        this.attackTypeConfig
      );
      finalDamage = magicResult.finalDamage;
      powerCost = magicResult.powerCost;
      isOverdrive = magicResult.isOverdrive;
      effectivePower = magicResult.effectivePower;
    }
    
    // Roll for critical hit
    const critResult = rollCritical(this.attackTypeConfig);
    if (critResult.isCrit) {
      finalDamage *= critResult.multiplier;
      this.totalCrits++;
    }

    return {
      towerId: this.id,
      targetId: this.target.id,
      damage: finalDamage,
      baseDamage: this.damage,
      damageType: this.damageType,
      isCrit: critResult.isCrit,
      critMultiplier: critResult.multiplier,
      attackTypeId: this.attackTypeId,
      splashRadius: this.splashRadius,
      splashDmgFalloff: this.splashDmgFalloff,
      chainCount: this.chainCount,
      chainDmgFalloff: this.chainDmgFalloff,
      slowPercent: this.slowPercent,
      slowDuration: this.slowDuration,
      burnDamage: this.burnDamage,
      burnDuration: this.burnDuration,
      poisonDamage: this.poisonDamage,
      poisonDuration: this.poisonDuration,
      armorReduction: this.armorReduction,
      armorReductionDuration: this.armorReductionDuration,
      energyCost: this.energyCost,
      powerCost: powerCost,
      isOverdrive: isOverdrive,
      effectivePower: effectivePower,
      startX: this.x,
      startY: this.y,
      targetX: this.target.x,
      targetY: this.target.y,
      projectileColor: this.projectileColor,
      projectileSize: this.projectileSize,
      projectileSpeed: this.projectileSpeed
    };
  }

  /**
   * Get stats summary for UI
   */
  getStatsForUI() {
    return {
      id: this.id,
      attackType: this.attackTypeId,
      attackTypeName: this.attackTypeConfig.name,
      attackTypeEmoji: this.attackTypeConfig.emoji,
      baseDamage: this.baseDamage,
      baseRange: this.baseRange,
      baseFireRate: this.baseFireRate,
      baseEnergyCost: this.baseEnergyCost,
      damage: this.damage,
      range: this.range,
      fireRate: this.fireRate,
      energyCost: this.energyCost,
      critChance: this.critChance,
      critDmgMod: this.critDmgMod,
      splashRadius: this.splashRadius,
      chainCount: this.chainCount,
      powerScaling: this.powerScaling,
      currentPowerDraw: this.currentPowerDraw,
      overdriveEfficiency: this.overdriveEfficiency,
      totalDamageDealt: this.totalDamageDealt,
      totalKills: this.totalKills,
      totalCrits: this.totalCrits
    };
  }

  recordKill() {
    this.totalKills++;
  }

  recordDamage(amount) {
    this.totalDamageDealt += amount;
  }

  distanceTo(enemy) {
    const dx = this.x - enemy.x;
    const dy = this.y - enemy.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  static canPlace(gridX, gridY, existingTowers, pathCells) {
    const maxGrid = Math.floor(CONFIG.CANVAS_WIDTH / CONFIG.GRID_SIZE);
    if (gridX < 0 || gridX >= maxGrid || gridY < 0 || gridY >= maxGrid) {
      return false;
    }

    if (pathCells && pathCells.some(c => c.x === gridX && c.y === gridY)) {
      return false;
    }

    if (existingTowers.some(t => t.gridX === gridX && t.gridY === gridY)) {
      return false;
    }

    return true;
  }
}

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

  return new Tower(baseData);
}

/**
 * Get upgrade cost for a tower
 */
function getUpgradeCost(currentTier) {
  return CONFIG.BASE_TOWER_COST * Math.pow(CONFIG.UPGRADE_COST_MULTIPLIER, currentTier + 1);
}

module.exports = { Tower, TOWER_PATHS, createTower, getUpgradeCost };

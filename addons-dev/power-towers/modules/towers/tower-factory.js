/**
 * Power Towers TD - Tower Factory
 * 
 * Creates new tower instances with proper stat initialization.
 */

const { getAttackType } = require('../../core/attack-types');
const { BASE_TOWER } = require('../../core/tower-upgrades');

/**
 * Create a new BASE tower instance
 * @param {number} gridX - Grid X position
 * @param {number} gridY - Grid Y position
 * @param {number} gridSize - Size of each grid cell
 * @param {number} towerId - Unique tower ID
 * @returns {Object} Tower instance
 */
function createTowerInstance(gridX, gridY, gridSize, towerId) {
  const baseStats = BASE_TOWER.baseStats;
  
  const tower = {
    id: towerId,
    gridX,
    gridY,
    
    // Center position in pixels
    x: gridX * gridSize + gridSize / 2,
    y: gridY * gridSize + gridSize / 2,
    
    // =========================================
    // BASE STATS (before modifiers)
    // =========================================
    baseDamage: baseStats.damage,
    baseRange: baseStats.range,
    baseFireRate: baseStats.fireRate,
    baseEnergyCost: baseStats.energyCost,
    
    // Tower HP
    baseHp: baseStats.hp,
    hpMultiplier: baseStats.hpMultiplier,
    currentHp: baseStats.hp * baseStats.hpMultiplier,
    maxHp: baseStats.hp * baseStats.hpMultiplier,
    isDestroyed: false,
    
    // =========================================
    // ATTACK TYPE
    // =========================================
    attackTypeId: 'base',
    attackTypeConfig: getAttackType('base'),
    
    // Secondary attack type (dual-type system)
    secondaryAttackTypeId: null,
    hasSecondaryAttackType: false,
    secondaryAttackTypeWeight: 0.5,
    
    // =========================================
    // EFFECTIVE STATS (after modifiers)
    // =========================================
    damage: baseStats.damage,
    range: baseStats.range,
    fireRate: baseStats.fireRate,
    energyCost: baseStats.energyCost,
    
    // Crit stats
    critChance: baseStats.critChance,
    critDmgMod: baseStats.critDmgMod,
    
    // AoE stats (from attack type)
    splashRadius: 0,
    splashDmgFalloff: 0,
    chainCount: 0,
    chainDmgFalloff: 0,
    
    // Magic system
    powerScaling: 0,
    minPowerDraw: 0,
    maxPowerDraw: 100,
    overdriveEfficiency: 0,
    currentPowerDraw: 50,
    
    // DoT/Debuffs (from element path)
    burnDamage: 0,
    burnDuration: 0,
    poisonDamage: 0,
    poisonDuration: 0,
    slowPercent: 0,
    slowDuration: 0,
    armorReduction: 0,
    armorReductionDuration: 0,
    trueDamagePercent: 0,
    
    // Element bonuses
    elementDmgBonus: 0,
    elementRangeBonus: 0,
    elementAtkSpdBonus: 0,
    
    // =========================================
    // UPGRADE TRACKING
    // =========================================
    upgradeLevels: {},     // { damage: 2, range: 1, ... }
    elementPath: null,     // 'fire', 'ice', etc.
    elementTier: 0,        // 0-3
    elementEffects: {},    // Current element effects
    
    // =========================================
    // STATE
    // =========================================
    attackCooldown: 0,
    target: null,
    rotation: 0,
    
    // =========================================
    // VISUAL
    // =========================================
    size: gridSize,
    emoji: BASE_TOWER.emoji,
    color: BASE_TOWER.color,
    elementColor: null,
    elementEmoji: null,
    projectileColor: '#cccccc',
    projectileSize: 4,
    projectileSpeed: 5,
    
    // =========================================
    // COMBAT STATS
    // =========================================
    kills: 0,
    totalDamage: 0,
    totalCrits: 0,
    
    // =========================================
    // METHODS (bound later)
    // =========================================
    recalculateStats: null,
    
    /**
     * Get current upgrade level for a stat
     * @param {string} upgradeId - Upgrade ID
     * @returns {number} Current level
     */
    getUpgradeLevel(upgradeId) {
      return this.upgradeLevels[upgradeId] || 0;
    },
    
    /**
     * Apply a stat upgrade
     * @param {string} upgradeId - Upgrade ID
     * @param {Object} upgradeConfig - Upgrade config with effect data
     * @returns {boolean} Success
     */
    applyStatUpgrade(upgradeId, upgradeConfig) {
      // Increment upgrade level
      if (!this.upgradeLevels[upgradeId]) {
        this.upgradeLevels[upgradeId] = 0;
      }
      this.upgradeLevels[upgradeId]++;
      
      const effect = upgradeConfig.effect;
      const value = effect.valuePerLevel;
      
      // Apply upgrade based on stat type
      switch (effect.stat) {
        case 'baseDamage':
          this.baseDamage += value;
          break;
        case 'baseFireRate':
          this.baseFireRate += value;
          break;
        case 'baseRange':
          this.baseRange += value;
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
      
      // Recalculate effective stats
      if (this.recalculateStats) {
        this.recalculateStats();
      }
      
      return true;
    }
  };
  
  return tower;
}

module.exports = { createTowerInstance };

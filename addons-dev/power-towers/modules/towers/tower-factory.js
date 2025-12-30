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
    
    // Tower Energy
    maxEnergy: 100,
    currentEnergy: 100,
    energyRegen: 0,        // disabled - use energy buildings
    energyCostPerShot: 5,  // energy cost per attack
    
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
    
    // Crit stats (base + upgrades)
    baseCritChance: baseStats.critChance,
    baseCritDmgMod: baseStats.critDmgMod,
    critChanceUpgrade: 0,   // from stat upgrades
    critDmgUpgrade: 0,      // from stat upgrades
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
     * NEW SYSTEM: Just increment upgradeLevels, tower-stats.js handles % bonuses
     * @param {string} upgradeId - Upgrade ID (e.g., 'damage', 'range')
     * @param {Object} upgradeConfig - Upgrade config (unused, kept for compatibility)
     * @returns {boolean} Success
     */
    applyStatUpgrade(upgradeId, upgradeConfig) {
      // Increment upgrade level
      if (!this.upgradeLevels[upgradeId]) {
        this.upgradeLevels[upgradeId] = 0;
      }
      this.upgradeLevels[upgradeId]++;
      
      // HP Regen is additive (not percentage based)
      if (upgradeId === 'hpRegen' && upgradeConfig?.effect?.valuePerLevel) {
        this.hpRegen = (this.hpRegen || 0) + upgradeConfig.effect.valuePerLevel;
      }
      
      // Add upgrade points for level calculation
      this.upgradePoints = (this.upgradePoints || 0) + 1;
      
      // Check for level up
      const newLevel = this.calculateLevel();
      if (newLevel > (this.level || 1)) {
        this.level = newLevel;
      }
      
      // Recalculate effective stats with new upgradeLevels
      if (this.recalculateStats) {
        this.recalculateStats();
      }
      
      return true;
    },
    
    /**
     * Calculate tower level from upgrade points
     */
    calculateLevel() {
      const points = this.upgradePoints || 0;
      const pointsPerLevel = [0, 3, 8, 15, 25, 40, 60, 85, 115, 150];
      
      for (let i = pointsPerLevel.length - 1; i >= 0; i--) {
        if (points >= pointsPerLevel[i]) {
          if (i === pointsPerLevel.length - 1) {
            const extraPoints = points - pointsPerLevel[i];
            const extraLevels = Math.floor(extraPoints / 40);
            return i + 1 + extraLevels;
          }
          return i + 1;
        }
      }
      return 1;
    }
  };
  
  return tower;
}

module.exports = { createTowerInstance };

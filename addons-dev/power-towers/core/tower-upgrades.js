/**
 * Power Towers TD - Tower Upgrades System
 * 
 * This file contains:
 * 1. BASE_TOWER - Base tower definition
 * 2. ELEMENT_PATHS - Element path configurations
 * 3. Tower level system
 * 4. Functions to apply upgrades from tower-upgrade-list.js
 * 
 * For upgrade/ability definitions, see: tower-upgrade-list.js
 */

const {
  STAT_UPGRADES,
  ABILITIES,
  PASSIVE_EFFECTS,
  calculateUpgradeCost,
  calculateAbilityCost,
  getUpgradeEffectValue,
  getAbilityEffects
} = require('./tower-upgrade-list');

// =========================================
// TOWER LEVEL SYSTEM
// Tower level is based on total upgrades purchased
// Higher level = cheaper upgrades
// =========================================
const TOWER_LEVEL_CONFIG = {
  // Points needed per level
  // Level 1: 0 points (start)
  // Level 2: 3 points (3 upgrades)
  // Level 3: 8 points (5 more upgrades)
  // etc.
  pointsPerLevel: [0, 3, 8, 15, 25, 40, 60, 85, 115, 150],
  
  // After level 10, each level needs +40 points
  extraPointsPerLevel: 40,
  
  // Points awarded per upgrade type
  points: {
    statUpgrade: 1,
    abilityTier: 2,
    passiveTier: 2,
    attackType: 3,
    elementPath: 3
  }
};

// =========================================
// ATTACK TYPE COSTS
// One-time cost to select attack type
// =========================================
const ATTACK_TYPE_COSTS = {
  base: 0,        // Free (default)
  siege: 75,
  normal: 50,
  magic: 100,
  piercing: 60
};

// =========================================
// BASE TOWER DEFINITION
// The only tower type - starting point for all builds
// =========================================
const BASE_TOWER = {
  id: 'base',
  name: 'Tower',
  emoji: '🏗️',
  description: 'Build a tower and choose its development path',
  cost: 50,
  
  // Starting stats (before any upgrades or attack type modifiers)
  baseStats: {
    damage: 13,
    range: 70,
    fireRate: 1.0,      // attacks per second
    energyCost: 2,
    critChance: 0.05,
    critDmgMod: 1.5,
    
    // Tower survivability
    hp: 100,
    hpMultiplier: 1.0,
    hpRegen: 0,          // HP per second
    
    // Energy storage
    energyStorage: 50,   // Base energy capacity
    energyStorageMod: 1.0 // Multiplier from attack type
  },
  
  // Secondary attack type (unlocked via special cards/upgrades)
  allowSecondaryAttackType: false,
  secondaryAttackTypeWeight: 0.5,
  
  // Visual
  color: '#718096',
  size: 20
};

// =========================================
// ELEMENT PATHS
// Special effects that stack with attack types
// =========================================
const ELEMENT_PATHS = {
  fire: {
    id: 'fire',
    name: 'Fire Path',
    emoji: '🔥',
    color: '#ff4500',
    description: 'Burns enemies with fire damage over time',
    
    // Bonus effects granted by this path
    bonuses: {
      dmgBonus: 0.05  // +5% damage
    },
    
    // Path unlocks these abilities
    unlocksAbilities: ['burn'],
    
    // Cost to select this path
    cost: 100
  },
  
  ice: {
    id: 'ice',
    name: 'Ice Path',
    emoji: '❄️',
    color: '#00bfff',
    description: 'Slows and freezes enemies',
    
    bonuses: {
      rangeBonus: 0.10  // +10% range
    },
    
    unlocksAbilities: ['slow'],
    cost: 100
  },
  
  lightning: {
    id: 'lightning',
    name: 'Lightning Path',
    emoji: '⚡',
    color: '#ffd700',
    description: 'Chain lightning between enemies',
    
    bonuses: {
      atkSpdBonus: 0.10  // +10% attack speed
    },
    
    unlocksAbilities: ['chainCount'],
    cost: 120
  },
  
  nature: {
    id: 'nature',
    name: 'Nature Path',
    emoji: '🌿',
    color: '#32cd32',
    description: 'Poison damage and life drain',
    
    bonuses: {
      energyEfficiency: 0.15  // -15% energy cost
    },
    
    unlocksAbilities: ['poison', 'lifeSteal'],
    cost: 100
  },
  
  dark: {
    id: 'dark',
    name: 'Dark Path',
    emoji: '💀',
    color: '#800080',
    description: 'True damage and debuffs',
    
    bonuses: {
      critBonus: 0.05  // +5% crit chance
    },
    
    unlocksAbilities: ['trueDamage', 'armorShred'],
    cost: 150
  }
};

// =========================================
// HELPER FUNCTIONS
// =========================================

/**
 * Calculate tower level from upgrade points
 * @param {Object} tower - Tower instance
 * @returns {number} Tower level
 */
function calculateTowerLevel(tower) {
  const points = tower.upgradePoints || 0;
  const config = TOWER_LEVEL_CONFIG;
  
  // Check defined levels
  for (let i = config.pointsPerLevel.length - 1; i >= 0; i--) {
    if (points >= config.pointsPerLevel[i]) {
      // Check if we're beyond defined levels
      if (i === config.pointsPerLevel.length - 1) {
        const extraPoints = points - config.pointsPerLevel[i];
        const extraLevels = Math.floor(extraPoints / config.extraPointsPerLevel);
        return i + 1 + extraLevels;
      }
      return i + 1;
    }
  }
  
  return 1;
}

/**
 * Add upgrade points to tower
 * @param {Object} tower - Tower instance
 * @param {string} upgradeType - Type of upgrade ('statUpgrade', 'abilityTier', etc.)
 */
function addUpgradePoints(tower, upgradeType) {
  const points = TOWER_LEVEL_CONFIG.points[upgradeType] || 1;
  tower.upgradePoints = (tower.upgradePoints || 0) + points;
  
  const newLevel = calculateTowerLevel(tower);
  if (newLevel > (tower.level || 1)) {
    tower.level = newLevel;
    return true; // Leveled up
  }
  
  return false;
}

/**
 * Get cost for attack type selection
 * @param {string} attackTypeId
 * @returns {number}
 */
function getAttackTypeCost(attackTypeId) {
  return ATTACK_TYPE_COSTS[attackTypeId] || 0;
}

/**
 * Get cost for element path selection
 * @param {string} elementId
 * @returns {number}
 */
function getElementPathCost(elementId) {
  const element = ELEMENT_PATHS[elementId];
  return element ? element.cost : 0;
}

/**
 * Apply stat upgrade to tower
 * 
 * NEW SYSTEM:
 * - Just increments upgrade level in tower.upgradeLevels
 * - Actual % bonuses are applied in tower-stats.js recalculateTowerStats()
 * 
 * @param {Object} tower - Tower instance
 * @param {string} statId - Stat to upgrade
 * @returns {boolean} Success
 */
function applyStatUpgrade(tower, statId) {
  const upgrade = STAT_UPGRADES[statId];
  if (!upgrade) return false;
  
  // Initialize tracking
  if (!tower.upgradeLevels) tower.upgradeLevels = {};
  
  const currentLevel = tower.upgradeLevels[statId] || 0;
  tower.upgradeLevels[statId] = currentLevel + 1;
  
  // For additive effects that tower-stats.js doesn't handle, apply directly
  const effect = upgrade.effect;
  if (effect.type === 'additive' && !['critChance', 'critDamage', 'chainCount'].includes(statId)) {
    // HP Regen is additive and not in tower-stats.js
    if (statId === 'hpRegen') {
      tower.hpRegen = (tower.hpRegen || 0) + effect.valuePerLevel;
    }
  }
  
  // Add upgrade points
  addUpgradePoints(tower, 'statUpgrade');
  
  // Recalculate effective stats - this applies all % bonuses
  if (tower.recalculateStats) {
    tower.recalculateStats();
  }
  
  return true;
}

/**
 * @deprecated Use applyElementAbilityUpgrade instead
 * Apply ability tier upgrade to tower (OLD tier-based system)
 * @param {Object} tower - Tower instance
 * @param {string} abilityId - Ability to upgrade
 * @returns {boolean} Success
 */
function applyAbilityUpgrade(tower, abilityId) {
  console.warn('[DEPRECATED] applyAbilityUpgrade - use applyElementAbilityUpgrade instead');
  const ability = ABILITIES[abilityId];
  if (!ability) return false;
  
  // Initialize tracking
  if (!tower.abilityTiers) tower.abilityTiers = {};
  
  const currentTier = tower.abilityTiers[abilityId] || 0;
  const newTier = currentTier + 1;
  tower.abilityTiers[abilityId] = newTier;
  
  // Get and apply effects
  const effects = getAbilityEffects(ability, newTier);
  if (effects) {
    // Copy all effects to tower
    for (const [key, value] of Object.entries(effects)) {
      tower[key] = value;
    }
  }
  
  // Add upgrade points
  addUpgradePoints(tower, 'abilityTier');
  
  // Recalculate stats
  if (tower.recalculateStats) {
    tower.recalculateStats();
  }
  
  return true;
}

/**
 * Apply element ability upgrade to tower (NEW system)
 * @param {Object} tower - Tower instance
 * @param {string} upgradeId - Ability upgrade ID (e.g., 'burn_damage', 'spread_chance')
 * @returns {boolean} Success
 */
function applyElementAbilityUpgrade(tower, upgradeId) {
  const elementPath = tower.elementPath;
  if (!elementPath) return false;
  
  try {
    const { ELEMENT_ABILITIES, getElementAbilities, getAbilityUpgradeCost: getElemAbilityCost } = require('./element-abilities');
    
    const elementConfig = ELEMENT_ABILITIES[elementPath];
    if (!elementConfig || !elementConfig.upgrades || !elementConfig.upgrades[upgradeId]) {
      return false;
    }
    
    const upgrade = elementConfig.upgrades[upgradeId];
    
    // Initialize tracking
    if (!tower.abilityUpgrades) tower.abilityUpgrades = {};
    
    const currentLevel = tower.abilityUpgrades[upgradeId] || 0;
    
    // Check max level
    if (currentLevel >= upgrade.maxLevel) return false;
    
    // Increment level
    tower.abilityUpgrades[upgradeId] = currentLevel + 1;
    
    // Recalculate element abilities with new upgrades
    tower.elementAbilities = getElementAbilities(elementPath, tower.abilityUpgrades);
    
    // Add upgrade points
    addUpgradePoints(tower, 'elementAbility');
    
    // Recalculate stats
    if (tower.recalculateStats) {
      tower.recalculateStats();
    }
    
    return true;
  } catch (e) {
    console.error('Error applying element ability upgrade:', e);
    return false;
  }
}

/**
 * Get element ability upgrade cost
 * @param {Object} tower - Tower instance
 * @param {string} upgradeId - Ability upgrade ID
 * @returns {number} Cost
 */
function getElementAbilityUpgradeCost(tower, upgradeId) {
  const elementPath = tower.elementPath;
  if (!elementPath) return Infinity;
  
  try {
    const { getAbilityUpgradeCost: getElemAbilityCost } = require('./element-abilities');
    const currentLevel = tower.abilityUpgrades?.[upgradeId] || 0;
    return getElemAbilityCost(elementPath, upgradeId, currentLevel);
  } catch (e) {
    return Infinity;
  }
}

/**
 * Apply passive effect tier to tower
 * @param {Object} tower - Tower instance
 * @param {string} passiveId - Passive to upgrade
 * @returns {boolean} Success
 */
function applyPassiveUpgrade(tower, passiveId) {
  const passive = PASSIVE_EFFECTS[passiveId];
  if (!passive) return false;
  
  // Initialize tracking
  if (!tower.passiveTiers) tower.passiveTiers = {};
  
  const currentTier = tower.passiveTiers[passiveId] || 0;
  
  // Check max tier
  if (currentTier >= passive.tiers.length) return false;
  
  const newTier = currentTier + 1;
  tower.passiveTiers[passiveId] = newTier;
  
  // Apply effects
  const tierData = passive.tiers[newTier - 1];
  for (const [key, value] of Object.entries(tierData.effects)) {
    tower[key] = value;
  }
  
  // Add upgrade points
  addUpgradePoints(tower, 'passiveTier');
  
  return true;
}

/**
 * Apply element path to tower
 * @param {Object} tower - Tower instance
 * @param {string} elementId - Element path ID
 * @returns {boolean} Success
 */
function applyElementPath(tower, elementId) {
  const element = ELEMENT_PATHS[elementId];
  if (!element) return false;
  
  // Can only select element once
  if (tower.elementPath && tower.elementPath !== elementId) {
    return false;
  }
  
  tower.elementPath = elementId;
  tower.elementColor = element.color;
  tower.elementEmoji = element.emoji;
  
  // Apply bonuses
  if (element.bonuses) {
    tower.elementDmgBonus = element.bonuses.dmgBonus || 0;
    tower.elementRangeBonus = element.bonuses.rangeBonus || 0;
    tower.elementAtkSpdBonus = element.bonuses.atkSpdBonus || 0;
  }
  
  // Initialize element abilities (NEW)
  try {
    const { getElementAbilities } = require('./element-abilities');
    tower.elementAbilities = getElementAbilities(elementId, tower.abilityUpgrades || {});
    
    // Enable lightning charge for lightning towers
    if (elementId === 'lightning') {
      tower.lightningChargeEnabled = true;
      tower.lightningChargeTarget = 50;
      tower.lightningCurrentCharge = 0;
    }
  } catch (e) {
    console.warn('Could not load element abilities:', e);
  }
  
  // Add upgrade points
  addUpgradePoints(tower, 'elementPath');
  
  // Recalculate stats
  if (tower.recalculateStats) {
    tower.recalculateStats();
  }
  
  return true;
}

/**
 * Get stat upgrade cost for tower
 * @param {string} statId - Stat upgrade ID
 * @param {Object} tower - Tower instance
 * @returns {number} Cost
 */
function getStatUpgradeCost(statId, tower) {
  const upgrade = STAT_UPGRADES[statId];
  if (!upgrade) return Infinity;
  
  const currentLevel = tower.upgradeLevels?.[statId] || 0;
  const towerLevel = tower.level || 1;
  
  return calculateUpgradeCost(upgrade, currentLevel, towerLevel);
}

/**
 * @deprecated Use getElementAbilityUpgradeCost instead
 * Get ability upgrade cost for tower (OLD tier-based system)
 * @param {string} abilityId - Ability ID
 * @param {Object} tower - Tower instance
 * @returns {number} Cost
 */
function getAbilityUpgradeCost(abilityId, tower) {
  console.warn('[DEPRECATED] getAbilityUpgradeCost - use getElementAbilityUpgradeCost instead');
  const ability = ABILITIES[abilityId];
  if (!ability) return Infinity;
  
  const currentTier = tower.abilityTiers?.[abilityId] || 0;
  const towerLevel = tower.level || 1;
  
  return calculateAbilityCost(ability, currentTier + 1, towerLevel);
}

/**
 * Get passive upgrade cost for tower
 * @param {string} passiveId - Passive ID
 * @param {Object} tower - Tower instance
 * @returns {number} Cost
 */
function getPassiveUpgradeCost(passiveId, tower) {
  const passive = PASSIVE_EFFECTS[passiveId];
  if (!passive) return Infinity;
  
  const currentTier = tower.passiveTiers?.[passiveId] || 0;
  
  if (currentTier >= passive.tiers.length) return Infinity;
  
  const baseCost = passive.tiers[currentTier].cost;
  const towerLevel = tower.level || 1;
  
  // Apply tower level discount
  const { COST_CONFIG } = require('./tower-upgrade-list');
  const discountPercent = Math.min(
    COST_CONFIG.maxDiscount,
    (towerLevel - 1) * COST_CONFIG.discountPerTowerLevel
  );
  
  return Math.floor(baseCost * (1 - discountPercent));
}

/**
 * Get tower build summary
 * @param {Object} tower
 * @returns {Object}
 */
function getTowerBuildSummary(tower) {
  return {
    level: tower.level || 1,
    upgradePoints: tower.upgradePoints || 0,
    attackType: tower.attackTypeId || 'base',
    secondaryAttackType: tower.secondaryAttackTypeId || null,
    elementPath: tower.elementPath || null,
    upgradeLevels: tower.upgradeLevels || {},
    abilityTiers: tower.abilityTiers || {},
    passiveTiers: tower.passiveTiers || {},
    totalInvested: calculateTotalInvested(tower)
  };
}

/**
 * Calculate total gold invested in tower
 * @param {Object} tower
 * @returns {number}
 */
function calculateTotalInvested(tower) {
  let total = BASE_TOWER.cost;
  
  // Track all costs spent (would need to store this on tower)
  total += tower.totalSpent || 0;
  
  return total;
}

module.exports = {
  // Configs
  BASE_TOWER,
  ELEMENT_PATHS,
  ATTACK_TYPE_COSTS,
  TOWER_LEVEL_CONFIG,
  
  // Tower level
  calculateTowerLevel,
  addUpgradePoints,
  
  // Cost functions
  getAttackTypeCost,
  getElementPathCost,
  getStatUpgradeCost,
  getAbilityUpgradeCost,      // @deprecated - use getElementAbilityUpgradeCost
  getPassiveUpgradeCost,
  getElementAbilityUpgradeCost,  // NEW - element ability upgrades
  
  // Apply functions
  applyStatUpgrade,
  applyAbilityUpgrade,        // @deprecated - use applyElementAbilityUpgrade
  applyPassiveUpgrade,
  applyElementPath,
  applyElementAbilityUpgrade,    // NEW - element ability upgrades
  
  // Info functions
  getTowerBuildSummary,
  calculateTotalInvested
};


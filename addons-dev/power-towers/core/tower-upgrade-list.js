/**
 * Power Towers TD - Tower Upgrade List & Abilities
 * 
 * Main upgrade system entry point.
 * Imports and re-exports all upgrade data and helper functions.
 * 
 * UPGRADE SYSTEM:
 * - Upgrades are infinite (no max level)
 * - Cost scales with upgrade level
 * - Tower level reduces upgrade costs
 * - Each upgrade has clear effects defined here
 * 
 * STRUCTURE:
 * - upgrades/stat-upgrades.js - Basic stat improvements
 * - upgrades/abilities.js - Special abilities with tiers
 * - upgrades/passive-effects.js - Passive bonuses
 */

const { STAT_UPGRADES } = require('./upgrades/stat-upgrades');
const { ABILITIES } = require('./upgrades/abilities');
const { PASSIVE_EFFECTS } = require('./upgrades/passive-effects');
const CONFIG = require('./config');

// =========================================
// COST CONFIGURATION (from CONFIG)
// =========================================
const COST_CONFIG = {
  // Base upgrade cost formula: baseCost * (scaleFactor ^ upgradeLevel)
  // Tower level discount: cost * (1 - (towerLevel - 1) * discountPerLevel)
  
  discountPerTowerLevel: CONFIG.TOWER_UPGRADE_DISCOUNT_PER_LEVEL || 0.05,  // 5% discount per tower level
  maxDiscount: CONFIG.TOWER_UPGRADE_MAX_DISCOUNT || 0.5,             // Max 50% discount
  
  // When upgrade is purchased, next upgrade costs more
  // But when tower levels up, discount resets the effective price
};

// =========================================
// HELPER FUNCTIONS
// =========================================

/**
 * Calculate upgrade cost with tower level discount
 * @param {Object} upgrade - Upgrade config
 * @param {number} currentLevel - Current upgrade level
 * @param {number} towerLevel - Tower's overall level
 * @returns {number} Cost
 */
function calculateUpgradeCost(upgrade, currentLevel, towerLevel = 1) {
  const baseCost = upgrade.cost.base;
  const scaleFactor = upgrade.cost.scaleFactor;
  
  // Raw cost = base * scale^level
  const rawCost = baseCost * Math.pow(scaleFactor, currentLevel);
  
  // Tower level discount
  const discountPercent = Math.min(
    COST_CONFIG.maxDiscount,
    (towerLevel - 1) * COST_CONFIG.discountPerTowerLevel
  );
  
  const finalCost = rawCost * (1 - discountPercent);
  
  return Math.floor(finalCost);
}

/**
 * Calculate ability tier cost with tower level discount
 * @param {Object} ability - Ability config
 * @param {number} targetTier - Tier to unlock (1-4+)
 * @param {number} towerLevel - Tower's level
 * @returns {number} Cost
 */
function calculateAbilityCost(ability, targetTier, towerLevel = 1) {
  let baseCost;
  
  // Within defined tiers
  if (targetTier <= ability.tiers.length) {
    baseCost = ability.tiers[targetTier - 1].cost;
  } else {
    // Infinite scaling beyond max tier
    const extraLevels = targetTier - ability.tiers.length;
    const scaling = ability.infiniteScaling;
    baseCost = scaling.costBase * Math.pow(scaling.costScale, extraLevels);
  }
  
  // Tower level discount
  const discountPercent = Math.min(
    COST_CONFIG.maxDiscount,
    (towerLevel - 1) * COST_CONFIG.discountPerTowerLevel
  );
  
  return Math.floor(baseCost * (1 - discountPercent));
}

/**
 * Get upgrade effect value at level
 * @param {Object} upgrade - Upgrade config
 * @param {number} level - Upgrade level
 * @returns {number} Effect value
 */
function getUpgradeEffectValue(upgrade, level) {
  const effect = upgrade.effect;
  let value = effect.valuePerLevel * level;
  
  // Apply caps
  if (effect.maxValue !== undefined) {
    value = Math.min(effect.maxValue, value);
  }
  if (effect.minValue !== undefined) {
    value = Math.max(effect.minValue, value);
  }
  
  return value;
}

/**
 * Get ability effects at tier (including infinite scaling)
 * @param {Object} ability - Ability config
 * @param {number} tier - Current tier
 * @returns {Object} Effects
 */
function getAbilityEffects(ability, tier) {
  if (tier <= 0) return null;
  
  // Within defined tiers
  if (tier <= ability.tiers.length) {
    return { ...ability.tiers[tier - 1].effects };
  }
  
  // Infinite scaling: start from max tier effects and add scaling
  const baseEffects = { ...ability.tiers[ability.tiers.length - 1].effects };
  const scaling = ability.infiniteScaling;
  const extraLevels = tier - ability.tiers.length;
  
  // Add scaling bonus
  let bonusValue = scaling.valuePerLevel * extraLevels;
  if (scaling.maxValue !== undefined) {
    const currentValue = baseEffects[scaling.stat] || 0;
    bonusValue = Math.min(bonusValue, scaling.maxValue - currentValue);
  }
  
  baseEffects[scaling.stat] = (baseEffects[scaling.stat] || 0) + bonusValue;
  
  return baseEffects;
}

/**
 * Check if upgrade is available for tower
 * @param {Object} upgrade - Upgrade config
 * @param {Object} tower - Tower instance
 * @returns {boolean}
 */
function isUpgradeAvailable(upgrade, tower) {
  if (!upgrade.requires) return true;
  
  if (upgrade.requires.attackTypes) {
    if (!upgrade.requires.attackTypes.includes(tower.attackTypeId)) {
      return false;
    }
  }
  
  if (upgrade.requires.elementPaths) {
    if (!upgrade.requires.elementPaths.includes(tower.elementPath)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Get all available upgrades for a tower
 * @param {Object} tower - Tower instance
 * @returns {Object} Available upgrades grouped by category
 */
function getAvailableUpgradesForTower(tower) {
  const available = {
    stats: [],
    abilities: [],
    passives: []
  };
  
  // Stat upgrades
  for (const [id, upgrade] of Object.entries(STAT_UPGRADES)) {
    if (isUpgradeAvailable(upgrade, tower)) {
      const currentLevel = tower.upgradeLevels?.[id] || 0;
      available.stats.push({
        ...upgrade,
        currentLevel,
        cost: calculateUpgradeCost(upgrade, currentLevel, tower.level || 1),
        effectValue: getUpgradeEffectValue(upgrade, currentLevel + 1)
      });
    }
  }
  
  // Abilities
  for (const [id, ability] of Object.entries(ABILITIES)) {
    if (isUpgradeAvailable(ability, tower)) {
      const currentTier = tower.abilityTiers?.[id] || 0;
      const nextTier = currentTier + 1;
      available.abilities.push({
        id: ability.id,
        name: ability.name,
        emoji: ability.emoji,
        description: ability.description,
        color: ability.color,
        currentTier,
        nextTierEffects: getAbilityEffects(ability, nextTier),
        cost: calculateAbilityCost(ability, nextTier, tower.level || 1)
      });
    }
  }
  
  // Passives
  for (const [id, passive] of Object.entries(PASSIVE_EFFECTS)) {
    const currentTier = tower.passiveTiers?.[id] || 0;
    if (currentTier < passive.tiers.length) {
      const nextTier = currentTier + 1;
      available.passives.push({
        id: passive.id,
        name: passive.name,
        emoji: passive.emoji,
        description: passive.description,
        color: passive.color,
        currentTier,
        maxTier: passive.tiers.length,
        nextTierEffects: passive.tiers[nextTier - 1].effects,
        cost: passive.tiers[nextTier - 1].cost
      });
    }
  }
  
  return available;
}

module.exports = {
  // Configs
  COST_CONFIG,
  STAT_UPGRADES,
  ABILITIES,
  PASSIVE_EFFECTS,
  
  // Functions
  calculateUpgradeCost,
  calculateAbilityCost,
  getUpgradeEffectValue,
  getAbilityEffects,
  isUpgradeAvailable,
  getAvailableUpgradesForTower
};

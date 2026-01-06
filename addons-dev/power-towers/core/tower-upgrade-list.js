/**
 * Power Towers TD - Tower Upgrade List
 * 
 * Stat upgrades and passive effects.
 * For element ability upgrades, use element-abilities.js
 * 
 * UPGRADE SYSTEM:
 * - Upgrades are infinite (no max level)
 * - Cost scales with upgrade level
 * - Tower level reduces upgrade costs
 */

const { STAT_UPGRADES } = require('./upgrades/stat-upgrades');
const { PASSIVE_EFFECTS } = require('./upgrades/passive-effects');
const CONFIG = require('./config/index');

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

module.exports = {
  // Configs
  COST_CONFIG,
  STAT_UPGRADES,
  PASSIVE_EFFECTS,
  
  // Functions
  calculateUpgradeCost,
  getUpgradeEffectValue,
  isUpgradeAvailable
};

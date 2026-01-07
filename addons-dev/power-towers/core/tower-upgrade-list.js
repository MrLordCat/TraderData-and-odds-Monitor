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
// COST/DISCOUNT CONFIGURATION (from CONFIG)
// =========================================
const { DISCOUNT_CONFIG, COST_CONFIG: UPGRADE_COST_CONFIG } = CONFIG;

const COST_CONFIG = {
  // For backward compatibility with existing code
  discountPerTowerLevel: DISCOUNT_CONFIG.percentPerStack,  // 5% discount per stack
  maxDiscount: DISCOUNT_CONFIG.maxPercent,                 // Max 50% discount
};

// =========================================
// HELPER FUNCTIONS
// =========================================

/**
 * Calculate upgrade cost with individual discount stacks
 * Each upgrade has its own discount counter that accumulates on level up
 * and resets when that specific upgrade is purchased
 * @param {Object} upgrade - Upgrade config
 * @param {number} currentLevel - Current upgrade level
 * @param {number} discountStacks - Individual discount stacks for this upgrade
 * @returns {number} Cost
 */
function calculateUpgradeCost(upgrade, currentLevel, discountStacks = 0) {
  const baseCost = upgrade.cost.base;
  const scaleFactor = upgrade.cost.scaleFactor;
  
  // Raw cost = base * scale^level
  const rawCost = baseCost * Math.pow(scaleFactor, currentLevel);
  
  // Discount from stacks (5% per stack, max 50%)
  const discountPercent = Math.min(
    COST_CONFIG.maxDiscount,
    discountStacks * COST_CONFIG.discountPerTowerLevel
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
  
  // Check if required upgrades are purchased
  if (upgrade.requires.upgrades) {
    const towerUpgrades = tower.upgradeLevels || {};
    for (const reqUpgradeId of upgrade.requires.upgrades) {
      if (!towerUpgrades[reqUpgradeId] || towerUpgrades[reqUpgradeId] < 1) {
        return false;
      }
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

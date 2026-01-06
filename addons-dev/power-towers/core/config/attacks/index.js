/**
 * Power Towers TD - Attack Types Configuration Index
 * 
 * Aggregates all attack type configs into one object
 * Also exports helper functions for attack type upgrades
 */

const NORMAL_ATTACK_CONFIG = require('./normal');
const SIEGE_ATTACK_CONFIG = require('./siege');
const MAGIC_ATTACK_CONFIG = require('./magic');
const PIERCING_ATTACK_CONFIG = require('./piercing');

// ╔════════════════════════════════════════════════════════════════════════════╗
// ║                      COMBINED ATTACK TYPE CONFIG                           ║
// ╚════════════════════════════════════════════════════════════════════════════╝

const ATTACK_TYPE_CONFIG = {
  normal: NORMAL_ATTACK_CONFIG,
  siege: SIEGE_ATTACK_CONFIG,
  magic: MAGIC_ATTACK_CONFIG,
  piercing: PIERCING_ATTACK_CONFIG,
};

// ╔════════════════════════════════════════════════════════════════════════════╗
// ║                          HELPER FUNCTIONS                                  ║
// ╚════════════════════════════════════════════════════════════════════════════╝

/**
 * Get attack type specific upgrades
 * @param {string} attackTypeId - Attack type ID
 * @returns {Object} Upgrades config for that attack type
 */
function getAttackTypeUpgrades(attackTypeId) {
  const config = ATTACK_TYPE_CONFIG[attackTypeId];
  return config?.upgrades || {};
}

/**
 * Calculate upgrade cost for attack type upgrade
 * Discount based on tower level (5% per level above 1, max 50%)
 * @param {string} attackTypeId - Attack type ID
 * @param {string} upgradeId - Upgrade ID
 * @param {number} currentLevel - Current upgrade level
 * @param {number} towerLevel - Tower level for discount calculation
 * @returns {number} Cost
 */
function calculateAttackTypeUpgradeCost(attackTypeId, upgradeId, currentLevel, towerLevel = 1) {
  const upgrades = getAttackTypeUpgrades(attackTypeId);
  const upgrade = upgrades[upgradeId];
  
  if (!upgrade) return 0;
  
  const baseCost = upgrade.cost.base;
  const scaleFactor = upgrade.cost.scaleFactor;
  
  // Raw cost = base * scale^level
  const rawCost = baseCost * Math.pow(scaleFactor, currentLevel);
  
  // Discount from tower level (5% per level above 1, max 50%)
  const discountPerLevel = 0.05;  // 5% per level
  const maxDiscount = 0.5;        // Max 50%
  const discountPercent = Math.min(maxDiscount, (towerLevel - 1) * discountPerLevel);
  
  return Math.floor(rawCost * (1 - discountPercent));
}

/**
 * Apply attack type upgrade effect to tower stats
 * @param {Object} tower - Tower instance
 * @param {string} upgradeId - Upgrade ID
 * @param {number} level - Upgrade level
 */
function applyAttackTypeUpgradeEffect(tower, upgradeId, level) {
  if (tower.attackTypeId !== 'normal') return;
  
  const upgrades = getAttackTypeUpgrades('normal');
  const upgrade = upgrades[upgradeId];
  if (!upgrade || level <= 0) return;
  
  const effect = upgrade.effect;
  let value = effect.valuePerLevel * level;
  
  // Apply caps
  if (effect.maxValue !== undefined) {
    value = Math.min(effect.maxValue, value);
  }
  if (effect.minValue !== undefined) {
    value = Math.max(effect.minValue, value);
  }
  
  // Apply to tower based on stat type
  switch (effect.stat) {
    case 'comboDmgPerStack':
      tower.comboDmgPerStack = (tower.comboDmgPerStack || 0.05) + value;
      break;
    case 'comboMaxStacks':
      tower.comboMaxStacks = (tower.comboMaxStacks || 10) + value;
      break;
    case 'comboDecayTime':
      tower.comboDecayTime = (tower.comboDecayTime || 2.0) + value;
      break;
    case 'focusFireHits':
      tower.focusFireHitsRequired = Math.max(
        effect.minValue || 2, 
        (tower.focusFireHitsRequired || 5) + value
      );
      break;
    case 'focusFireCritBonus':
      tower.focusFireCritBonus = (tower.focusFireCritBonus || 0.5) + value;
      break;
  }
}

/**
 * Get display stats for Normal attack type
 * @param {Object} tower - Tower instance
 * @returns {Array} Stats array for UI display
 */
function getNormalAttackStats(tower) {
  if (tower.attackTypeId !== 'normal') return [];
  
  const comboState = tower.comboState || { stacks: 0, focusHits: 0 };
  const maxStacks = tower.comboMaxStacks || 10;
  const dmgPerStack = tower.comboDmgPerStack || 0.05;
  const focusHitsReq = tower.focusFireHitsRequired || 5;
  const focusCritBonus = tower.focusFireCritBonus || 0.5;
  
  // Calculate current combo bonus
  const comboDmgBonus = comboState.stacks * dmgPerStack;
  const focusProgress = comboState.focusHits || 0;
  
  return [
    {
      id: 'comboStacks',
      name: 'Combo',
      emoji: '🎯',
      value: `${comboState.stacks}/${maxStacks}`,
      detail: `+${Math.round(comboDmgBonus * 100)}% DMG`,
      color: '#4a90d9',
      isLive: true,  // Updates in real-time
    },
    {
      id: 'comboDmgPerStack',
      name: 'Combo Power',
      emoji: '📊',
      value: `+${Math.round(dmgPerStack * 100)}%`,
      detail: 'per stack',
      color: '#3080d9',
    },
    {
      id: 'focusProgress',
      name: 'Focus',
      emoji: '🔥',
      value: `${focusProgress}/${focusHitsReq}`,
      detail: focusProgress >= focusHitsReq ? 'READY!' : 'hits',
      color: focusProgress >= focusHitsReq ? '#ffd700' : '#6ab0e8',
      isLive: true,
    },
    {
      id: 'focusCritBonus',
      name: 'Focus Crit',
      emoji: '💥',
      value: `${Math.round((1.5 + focusCritBonus) * 100)}%`,
      detail: `+${Math.round(focusCritBonus * 100)}% bonus`,
      color: '#ff6b6b',
    },
  ];
}

module.exports = {
  // Combined config
  ATTACK_TYPE_CONFIG,
  
  // Individual configs (for direct access)
  NORMAL_ATTACK_CONFIG,
  SIEGE_ATTACK_CONFIG,
  MAGIC_ATTACK_CONFIG,
  PIERCING_ATTACK_CONFIG,
  
  // Helper functions
  getAttackTypeUpgrades,
  calculateAttackTypeUpgradeCost,
  applyAttackTypeUpgradeEffect,
  getNormalAttackStats,
};

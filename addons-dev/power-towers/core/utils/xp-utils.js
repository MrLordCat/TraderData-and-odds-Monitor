/**
 * XP Calculation Utilities
 * 
 * Centralized XP calculations for towers and energy buildings.
 * Uses scaling formula instead of hardcoded thresholds.
 */

const CONFIG = require('../config');

// ╔════════════════════════════════════════════════════════════════════════╗
// ║                         TOWER XP FUNCTIONS                             ║
// ╚════════════════════════════════════════════════════════════════════════╝

/**
 * Get cumulative XP threshold for a tower level
 * Formula: sum of (BASE_XP * SCALE^(i-2)) for i from 2 to level
 * 
 * Example with BASE_XP=3, SCALE=1.5:
 *   Level 1: 0 XP
 *   Level 2: 3 XP (3 * 1.5^0 = 3)
 *   Level 3: 8 XP (3 + 3*1.5 = 3 + 4.5 ≈ 8)
 *   Level 4: 15 XP (8 + 3*1.5^2 = 8 + 6.75 ≈ 15)
 *   etc.
 * 
 * @param {number} level - Target level (1-based)
 * @returns {number} Cumulative XP needed to reach this level
 */
function getTowerXpThreshold(level) {
  if (level <= 1) return 0;
  
  const baseXp = CONFIG.TOWER_BASE_XP || 3;
  const scale = CONFIG.TOWER_XP_SCALE || 1.5;
  
  let total = 0;
  for (let i = 2; i <= level; i++) {
    total += Math.round(baseXp * Math.pow(scale, i - 2));
  }
  return total;
}

/**
 * Calculate tower level from XP points
 * @param {number} xp - Current XP points
 * @returns {number} Current level (1-based)
 */
function calculateTowerLevel(xp) {
  const maxLevel = CONFIG.TOWER_MAX_LEVEL || 10;
  let level = 1;
  
  while (level < maxLevel && xp >= getTowerXpThreshold(level + 1)) {
    level++;
  }
  
  return level;
}

/**
 * Get XP progress info for tower
 * @param {number} xp - Current XP points  
 * @param {number} level - Current level
 * @returns {{ current: number, needed: number, percent: number }}
 */
function getTowerXpProgress(xp, level) {
  const maxLevel = CONFIG.TOWER_MAX_LEVEL || 10;
  
  if (level >= maxLevel) {
    return { current: 0, needed: 0, percent: 100 };
  }
  
  const currentThreshold = getTowerXpThreshold(level);
  const nextThreshold = getTowerXpThreshold(level + 1);
  const xpInLevel = xp - currentThreshold;
  const xpNeeded = nextThreshold - currentThreshold;
  const percent = Math.max(0, Math.min(100, (xpInLevel / xpNeeded) * 100));
  
  return { current: xpInLevel, needed: xpNeeded, percent };
}

// ╔════════════════════════════════════════════════════════════════════════╗
// ║                      ENERGY BUILDING XP FUNCTIONS                      ║
// ╚════════════════════════════════════════════════════════════════════════╝

/**
 * Get XP threshold for energy building level (linear scaling)
 * @param {number} level - Target level (1-based)
 * @returns {number} Cumulative XP needed
 */
function getEnergyXpThreshold(level) {
  if (level <= 1) return 0;
  const xpPerLevel = CONFIG.ENERGY_XP_PER_LEVEL || 10;
  return (level - 1) * xpPerLevel;
}

/**
 * Calculate energy building level from XP
 * @param {number} xp - Current XP points
 * @returns {number} Current level (1-based)
 */
function calculateEnergyLevel(xp) {
  const xpPerLevel = CONFIG.ENERGY_XP_PER_LEVEL || 10;
  const maxLevel = CONFIG.ENERGY_MAX_LEVEL || 20;
  return Math.min(Math.floor(1 + (xp / xpPerLevel)), maxLevel);
}

/**
 * Get XP progress info for energy building
 * @param {number} xp - Current XP points
 * @param {number} level - Current level
 * @returns {{ current: number, needed: number, percent: number }}
 */
function getEnergyXpProgress(xp, level) {
  const xpPerLevel = CONFIG.ENERGY_XP_PER_LEVEL || 10;
  const maxLevel = CONFIG.ENERGY_MAX_LEVEL || 20;
  
  if (level >= maxLevel) {
    return { current: xpPerLevel, needed: xpPerLevel, percent: 100 };
  }
  
  const xpForCurrentLevel = (level - 1) * xpPerLevel;
  const xpIntoLevel = xp - xpForCurrentLevel;
  const percent = Math.max(0, Math.min(100, (xpIntoLevel / xpPerLevel) * 100));
  
  return { current: xpIntoLevel, needed: xpPerLevel, percent };
}

module.exports = {
  // Tower XP
  getTowerXpThreshold,
  calculateTowerLevel,
  getTowerXpProgress,
  // Energy XP
  getEnergyXpThreshold,
  calculateEnergyLevel,
  getEnergyXpProgress,
};

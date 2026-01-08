/**
 * Power Towers TD - Wave Scaling Configuration
 * 
 * Formulas for scaling enemy stats by wave number
 */

/**
 * Base scaling config
 */
const SCALING = {
  // HP scales exponentially
  health: {
    base: 1.0,           // Wave 1 multiplier
    perWave: 0.08,       // +8% per wave
    formula: 'exponential', // 1.08^(wave-1)
    hardcap: 50.0,       // Max multiplier
    
    // Boss HP multipliers (on top of base scaling)
    bossMultiplier: {
      mini: 3.0,         // Mini-boss: ×3
      main: 10.0,        // Main boss: ×10
    },
  },
  
  // Speed scales linearly with soft cap
  speed: {
    base: 1.0,
    perWave: 0.02,       // +2% per wave
    formula: 'linear',
    softcap: 2.0,        // Soft cap at ×2
    softcapStart: 20,    // Soft cap kicks in at wave 20
    softcapFactor: 0.5,  // Scaling reduced by 50% after soft cap
  },
  
  // Reward scales slower than HP
  reward: {
    base: 1.0,
    perWave: 0.05,       // +5% per wave
    formula: 'exponential',
    hardcap: 20.0,
  },
  
  // Enemy count per wave
  count: {
    baseMin: 5,
    baseMax: 8,
    perWave: 0.5,        // +0.5 enemies per wave
    hardcap: 30,         // Max enemies per wave
    
    // Boss waves have fewer regular enemies
    bossWaveReduction: {
      mini: 0.6,         // 60% enemies on mini-boss wave
      main: 0.3,         // 30% enemies on main boss wave
    },
  },
};

/**
 * Calculate health multiplier for a wave
 * @param {number} wave - Wave number
 * @param {string} bossType - 'mini', 'main', or null
 * @returns {number} Health multiplier
 */
function getHealthMultiplier(wave, bossType = null) {
  const config = SCALING.health;
  let multiplier = config.base * Math.pow(1 + config.perWave, wave - 1);
  
  // Apply hard cap
  multiplier = Math.min(multiplier, config.hardcap);
  
  // Apply boss multiplier if applicable
  if (bossType && config.bossMultiplier[bossType]) {
    multiplier *= config.bossMultiplier[bossType];
  }
  
  return multiplier;
}

/**
 * Calculate speed multiplier for a wave
 * @param {number} wave - Wave number
 * @returns {number} Speed multiplier
 */
function getSpeedMultiplier(wave) {
  const config = SCALING.speed;
  
  if (wave <= config.softcapStart) {
    // Before soft cap: linear scaling
    return config.base + config.perWave * (wave - 1);
  } else {
    // After soft cap: reduced scaling
    const beforeCap = config.base + config.perWave * (config.softcapStart - 1);
    const afterCap = config.perWave * config.softcapFactor * (wave - config.softcapStart);
    return Math.min(beforeCap + afterCap, config.softcap);
  }
}

/**
 * Calculate reward multiplier for a wave
 * @param {number} wave - Wave number
 * @returns {number} Reward multiplier
 */
function getRewardMultiplier(wave) {
  const config = SCALING.reward;
  let multiplier = config.base * Math.pow(1 + config.perWave, wave - 1);
  return Math.min(multiplier, config.hardcap);
}

/**
 * Calculate enemy count for a wave
 * @param {number} wave - Wave number
 * @param {string} bossType - 'mini', 'main', or null
 * @returns {Object} { min, max }
 */
function getEnemyCount(wave, bossType = null) {
  const config = SCALING.count;
  
  // Base count scales with wave
  let baseCount = config.baseMin + config.perWave * (wave - 1);
  baseCount = Math.min(baseCount, config.hardcap);
  
  // Min/max range
  let min = Math.floor(baseCount);
  let max = Math.ceil(baseCount + (config.baseMax - config.baseMin));
  
  // Reduce count on boss waves
  if (bossType && config.bossWaveReduction[bossType]) {
    const reduction = config.bossWaveReduction[bossType];
    min = Math.max(1, Math.floor(min * reduction));
    max = Math.max(2, Math.floor(max * reduction));
  }
  
  return { min, max };
}

/**
 * Apply scaling to base enemy stats
 * @param {Object} baseStats - Base enemy stats
 * @param {number} wave - Wave number
 * @returns {Object} Scaled stats
 */
function applyScaling(baseStats, wave) {
  return {
    ...baseStats,
    health: Math.round(baseStats.baseHealth * getHealthMultiplier(wave)),
    speed: Math.round(baseStats.baseSpeed * getSpeedMultiplier(wave)),
    reward: Math.round(baseStats.reward * getRewardMultiplier(wave)),
  };
}

/**
 * Get all multipliers for a wave (for debugging/UI)
 * @param {number} wave - Wave number
 * @returns {Object} All multipliers
 */
function getWaveMultipliers(wave) {
  return {
    health: getHealthMultiplier(wave),
    speed: getSpeedMultiplier(wave),
    reward: getRewardMultiplier(wave),
    enemyCount: getEnemyCount(wave),
  };
}

module.exports = {
  SCALING,
  getHealthMultiplier,
  getSpeedMultiplier,
  getRewardMultiplier,
  getEnemyCount,
  applyScaling,
  getWaveMultipliers,
};

/**
 * Power Towers TD - Waves Configuration Aggregator
 * 
 * Central module for all wave-related configurations
 */

// Aura system
const {
  AURAS,
  AURA_TIER_CONFIG,
  HASTE,
  FORTIFIED,
  REGENERATION,
  ENERGIZED,
  ETHEREAL,
  BERSERKER,
  SWARM_MIND,
  getMaxAurasForWave,
  getAvailableAuras,
  areAurasCompatible,
  selectAurasForWave,
  applyAurasToEnemy,
  getAuraInfo,
  getAurasInfo,
} = require('./auras');

// Scaling formulas
const {
  SCALING,
  getHealthMultiplier,
  getSpeedMultiplier,
  getRewardMultiplier,
  getEnemyCount,
  applyScaling,
  getWaveMultipliers,
} = require('./scaling');

// Wave compositions
const {
  WAVE_COMPOSITIONS,
  SPAWN_PATTERNS,
  TYPE_WEIGHTS,
  getWaveComposition,
  getSpawnPattern,
  getWaveBoss,
  getWaveEnemyCount,
} = require('./compositions');

// Wave generation
const {
  generateWave,
  createEnemyInstance,
  createBossInstance,
  generateEndlessWave,
  getWavePreview,
} = require('./generation');

/**
 * Main wave config object for backwards compatibility
 */
const WAVE_CONFIG = {
  // Timing
  waveDelay: 3000,           // ms between waves
  
  // Scaling (references)
  scaling: SCALING,
  
  // Auras
  auras: AURAS,
  auraTierConfig: AURA_TIER_CONFIG,
  
  // Compositions
  compositions: WAVE_COMPOSITIONS,
  patterns: SPAWN_PATTERNS,
  typeWeights: TYPE_WEIGHTS,
  
  // Total waves in campaign
  totalWaves: 40,
  
  // Endless mode starts after this
  endlessStartWave: 41,
};

module.exports = {
  // Main config
  WAVE_CONFIG,
  
  // Auras
  AURAS,
  AURA_TIER_CONFIG,
  HASTE,
  FORTIFIED,
  REGENERATION,
  ENERGIZED,
  ETHEREAL,
  BERSERKER,
  SWARM_MIND,
  
  // Aura functions
  getMaxAurasForWave,
  getAvailableAuras,
  areAurasCompatible,
  selectAurasForWave,
  applyAurasToEnemy,
  getAuraInfo,
  getAurasInfo,
  
  // Scaling
  SCALING,
  getHealthMultiplier,
  getSpeedMultiplier,
  getRewardMultiplier,
  getEnemyCount,
  applyScaling,
  getWaveMultipliers,
  
  // Compositions
  WAVE_COMPOSITIONS,
  SPAWN_PATTERNS,
  TYPE_WEIGHTS,
  getWaveComposition,
  getSpawnPattern,
  getWaveBoss,
  getWaveEnemyCount,
  
  // Generation
  generateWave,
  createEnemyInstance,
  createBossInstance,
  generateEndlessWave,
  getWavePreview,
};

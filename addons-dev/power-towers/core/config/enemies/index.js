/**
 * Power Towers TD - Enemies Configuration Aggregator
 * 
 * Central module for all enemy-related configurations
 */

const { 
  BASE_ENEMY_TYPES, 
  getBaseEnemyType, 
  getBaseEnemyTypeIds,
  isBaseEnemyType,
  MINION, SCOUT, BRUTE, SWARMLING,
} = require('./base');

const { 
  SPECIAL_ENEMY_TYPES, 
  SPECIAL_MODIFIERS,
  getSpecialModifier,
  getAvailableSpecialModifiers,
  isSpecialAvailable,
} = require('./special');

const {
  ELITE_CONFIG,
  getEliteChance,
  rollForElite,
  applyEliteModifiers,
  getEliteInfo,
} = require('./elite');

const {
  BOSSES,
  BOSS_WAVES,
  isBossWave,
  isMiniBossWave,
  isMainBossWave,
  isFinalBossWave,
  getBossForWave,
  getBossConfig,
  getBossById,
  getAllBossWaves,
  getMiniBossWaves,
  getMainBossWaves,
  // Individual bosses
  IRON_GUARDIAN,
  STORM_HERALD,
  CRYSTAL_WYRM,
  VOID_SENTINEL,
  GOLEM_KING,
  SHADOW_LORD,
  INFERNO_TITAN,
  ANCIENT_DESTROYER,
} = require('./bosses');

/**
 * Combined enemy types for backwards compatibility
 * Maps old ids to new structure
 */
const ENEMY_TYPES = {
  basic: MINION,
  fast: SCOUT,
  tank: BRUTE,
  swarm: SWARMLING,
  // Boss is now fetched via getBossConfig()
};

// Alias for new code
const BASE_ENEMIES = {
  minion: MINION,
  scout: SCOUT,
  brute: BRUTE,
  swarmling: SWARMLING,
};

/**
 * Get enemy config by type id
 * @param {string} typeId - Enemy type (basic, fast, tank, swarm, boss)
 * @returns {Object|null} Enemy config
 */
function getEnemyType(typeId) {
  // Check base types first
  const baseType = getBaseEnemyType(typeId);
  if (baseType) return baseType;
  
  // Check old-style ids
  if (ENEMY_TYPES[typeId]) return ENEMY_TYPES[typeId];
  
  // Check if it's a boss
  if (typeId === 'boss') return BOSS_PLACEHOLDER;
  
  return null;
}

/**
 * Get enemy size by type
 * @param {string} typeId - Enemy type
 * @returns {number} Size in pixels
 */
function getEnemySize(typeId) {
  const enemy = getEnemyType(typeId);
  return enemy?.size || 10;
}

/**
 * Create enemy instance with all modifiers applied
 * @param {string} baseTypeId - Base enemy type id
 * @param {Object} options - Creation options
 * @param {string} options.specialType - Special modifier to apply
 * @param {boolean} options.isElite - Force elite status
 * @param {number} options.wave - Wave number for scaling
 * @returns {Object} Enemy instance data
 */
function createEnemyData(baseTypeId, options = {}) {
  const { specialType, isElite, wave = 1 } = options;
  
  let enemyData = { ...getEnemyType(baseTypeId) };
  if (!enemyData) return null;
  
  // Apply special modifier if specified
  if (specialType) {
    const modifier = getSpecialModifier(specialType);
    if (modifier) {
      enemyData.specialType = specialType;
      enemyData.displayName = `${modifier.prefix} ${enemyData.name}`;
      // Detailed modifiers applied by special type files
    }
  }
  
  // Apply elite if specified or rolled
  if (isElite || (wave && rollForElite(wave))) {
    enemyData = applyEliteModifiers(enemyData);
  }
  
  return enemyData;
}

module.exports = {
  // Base types
  BASE_ENEMY_TYPES,
  BASE_ENEMIES,
  MINION, SCOUT, BRUTE, SWARMLING,
  getBaseEnemyType,
  getBaseEnemyTypeIds,
  isBaseEnemyType,
  
  // Special types
  SPECIAL_ENEMY_TYPES,
  SPECIAL_MODIFIERS,
  getSpecialModifier,
  getAvailableSpecialModifiers,
  isSpecialAvailable,
  
  // Elite
  ELITE_CONFIG,
  getEliteChance,
  rollForElite,
  applyEliteModifiers,
  getEliteInfo,
  
  // Bosses
  BOSSES,
  BOSS_WAVES,
  isBossWave,
  isMiniBossWave,
  isMainBossWave,
  isFinalBossWave,
  getBossForWave,
  getBossConfig,
  getBossById,
  getAllBossWaves,
  getMiniBossWaves,
  getMainBossWaves,
  // Individual bosses
  IRON_GUARDIAN,
  STORM_HERALD,
  CRYSTAL_WYRM,
  VOID_SENTINEL,
  GOLEM_KING,
  SHADOW_LORD,
  INFERNO_TITAN,
  ANCIENT_DESTROYER,
  
  // Backwards compatibility
  ENEMY_TYPES,
  getEnemyType,
  getEnemySize,
  
  // Factory
  createEnemyData,
};

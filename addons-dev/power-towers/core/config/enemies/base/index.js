/**
 * Power Towers TD - Base Enemy Types Aggregator
 * 
 * Exports all base enemy types
 */

const MINION = require('./minion');
const SCOUT = require('./scout');
const BRUTE = require('./brute');
const SWARMLING = require('./swarmling');

/**
 * Base enemy types - standard enemies without special abilities
 */
const BASE_ENEMY_TYPES = {
  minion: MINION,
  scout: SCOUT,
  brute: BRUTE,
  swarmling: SWARMLING,
};

/**
 * Get base enemy type by id
 * @param {string} typeId - Enemy type id
 * @returns {Object|null} Enemy config or null
 */
function getBaseEnemyType(typeId) {
  return BASE_ENEMY_TYPES[typeId] || null;
}

/**
 * Get all base enemy type ids
 * @returns {string[]} Array of type ids
 */
function getBaseEnemyTypeIds() {
  return Object.keys(BASE_ENEMY_TYPES);
}

/**
 * Check if enemy type is a base type
 * @param {string} typeId - Enemy type id
 * @returns {boolean}
 */
function isBaseEnemyType(typeId) {
  return typeId in BASE_ENEMY_TYPES;
}

module.exports = {
  BASE_ENEMY_TYPES,
  MINION,
  SCOUT,
  BRUTE,
  SWARMLING,
  getBaseEnemyType,
  getBaseEnemyTypeIds,
  isBaseEnemyType,
};

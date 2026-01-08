/**
 * Power Towers TD - Special Enemy Types Aggregator
 * 
 * Exports all special enemy types (Flying, Armored, etc.)
 * Each special type is in its own file for complex mechanics
 */

// Implemented special types
const { FLYING, applyFlyingModifier, canTargetFlying, getFlyingDamageModifier } = require('./flying');
const { ARMORED, applyArmoredModifier, calculateArmoredDamage, applyArmorShred, getArmorDisplayInfo } = require('./armored');

// Future special types (will be added later)
// const MAGIC_IMMUNE = require('./magic-immune');
// const PHASING = require('./phasing');
// const REGENERATING = require('./regenerating');
// const UNDEAD = require('./undead');
// const SHIELDED = require('./shielded');
// const SPLITTER = require('./splitter');

/**
 * Special enemy types - enemies with unique mechanics
 * These modify base types (e.g., flying_scout, armored_brute)
 */
const SPECIAL_ENEMY_TYPES = {
  flying: FLYING,
  armored: ARMORED,
};

/**
 * Special type modifiers - applied to base enemy stats
 * Quick reference for all special types with availability info
 */
const SPECIAL_MODIFIERS = {
  flying: {
    id: 'flying',
    name: 'Flying',
    prefix: '🦅',
    availableFromWave: FLYING.availableFromWave,
    baseSpawnChance: FLYING.baseSpawnChance,
    applicableTo: FLYING.applicableTo,
    config: FLYING,
    applyModifier: applyFlyingModifier,
  },
  armored: {
    id: 'armored', 
    name: 'Armored',
    prefix: '🛡️',
    availableFromWave: ARMORED.availableFromWave,
    baseSpawnChance: ARMORED.baseSpawnChance,
    applicableTo: ARMORED.applicableTo,
    config: ARMORED,
    applyModifier: applyArmoredModifier,
  },
  // Placeholder entries for future types
  magic_immune: {
    id: 'magic_immune',
    name: 'Magic-Immune',
    prefix: '✨',
    availableFromWave: 15,
    baseSpawnChance: 0.1,
    applicableTo: ['minion', 'brute'],
  },
  phasing: {
    id: 'phasing',
    name: 'Phasing',
    prefix: '⚡',
    availableFromWave: 18,
    baseSpawnChance: 0.08,
    applicableTo: ['scout', 'minion'],
  },
  regenerating: {
    id: 'regenerating',
    name: 'Regenerating',
    prefix: '🩹',
    availableFromWave: 20,
    baseSpawnChance: 0.1,
    applicableTo: ['brute', 'minion'],
  },
  undead: {
    id: 'undead',
    name: 'Undead',
    prefix: '💀',
    availableFromWave: 22,
    baseSpawnChance: 0.08,
    applicableTo: ['minion', 'swarmling'],
  },
  shielded: {
    id: 'shielded',
    name: 'Shielded',
    prefix: '🔮',
    availableFromWave: 25,
    baseSpawnChance: 0.1,
    applicableTo: ['minion', 'brute'],
  },
  splitter: {
    id: 'splitter',
    name: 'Splitter',
    prefix: '👥',
    availableFromWave: 28,
    baseSpawnChance: 0.08,
    applicableTo: ['minion', 'swarmling'],
  },
};

/**
 * Get special modifier by id
 * @param {string} modifierId - Special modifier id
 * @returns {Object|null}
 */
function getSpecialModifier(modifierId) {
  return SPECIAL_MODIFIERS[modifierId] || null;
}

/**
 * Get full special config by id
 * @param {string} modifierId - Special modifier id
 * @returns {Object|null}
 */
function getSpecialConfig(modifierId) {
  return SPECIAL_ENEMY_TYPES[modifierId] || null;
}

/**
 * Get all special modifiers available for a wave
 * @param {number} wave - Current wave number
 * @returns {Object[]} Array of available special modifiers
 */
function getAvailableSpecialModifiers(wave) {
  return Object.values(SPECIAL_MODIFIERS).filter(
    mod => wave >= mod.availableFromWave
  );
}

/**
 * Get implemented special modifiers available for a wave
 * Only returns types that have full implementation
 * @param {number} wave - Current wave number
 * @returns {Object[]} Array of available implemented modifiers
 */
function getImplementedSpecialModifiers(wave) {
  return Object.values(SPECIAL_MODIFIERS).filter(
    mod => wave >= mod.availableFromWave && mod.applyModifier
  );
}

/**
 * Check if special type is available for wave
 * @param {string} modifierId - Special modifier id
 * @param {number} wave - Wave number
 * @returns {boolean}
 */
function isSpecialAvailable(modifierId, wave) {
  const mod = SPECIAL_MODIFIERS[modifierId];
  return mod ? wave >= mod.availableFromWave : false;
}

/**
 * Check if special type is implemented (not just placeholder)
 * @param {string} modifierId - Special modifier id
 * @returns {boolean}
 */
function isSpecialImplemented(modifierId) {
  const mod = SPECIAL_MODIFIERS[modifierId];
  return mod && typeof mod.applyModifier === 'function';
}

/**
 * Apply special modifier to base enemy
 * @param {Object} baseEnemy - Base enemy data
 * @param {string} modifierId - Special modifier id
 * @returns {Object} Modified enemy or original if modifier not found
 */
function applySpecialModifier(baseEnemy, modifierId) {
  const modifier = SPECIAL_MODIFIERS[modifierId];
  
  if (!modifier || typeof modifier.applyModifier !== 'function') {
    console.warn(`[SpecialEnemies] Modifier '${modifierId}' not implemented`);
    return baseEnemy;
  }
  
  // Check if base type is applicable
  if (modifier.applicableTo && !modifier.applicableTo.includes(baseEnemy.id || baseEnemy.type)) {
    console.warn(`[SpecialEnemies] Modifier '${modifierId}' not applicable to '${baseEnemy.id}'`);
    return baseEnemy;
  }
  
  return modifier.applyModifier(baseEnemy);
}

/**
 * Roll for special enemy type based on wave
 * @param {string} baseEnemyType - Base enemy type id
 * @param {number} wave - Current wave
 * @returns {string|null} Special modifier id or null
 */
function rollForSpecialType(baseEnemyType, wave) {
  const available = getImplementedSpecialModifiers(wave);
  
  // Filter to types applicable to this base enemy
  const applicable = available.filter(mod => 
    !mod.applicableTo || mod.applicableTo.includes(baseEnemyType)
  );
  
  if (applicable.length === 0) return null;
  
  // Roll for each applicable type
  for (const mod of applicable) {
    // Scale spawn chance slightly with wave
    const waveBonus = (wave - mod.availableFromWave) * 0.005; // +0.5% per wave after unlock
    const spawnChance = Math.min(0.25, (mod.baseSpawnChance || 0.1) + waveBonus);
    
    if (Math.random() < spawnChance) {
      return mod.id;
    }
  }
  
  return null;
}

module.exports = {
  // Full configs
  SPECIAL_ENEMY_TYPES,
  FLYING,
  ARMORED,
  
  // Quick reference
  SPECIAL_MODIFIERS,
  
  // Getters
  getSpecialModifier,
  getSpecialConfig,
  getAvailableSpecialModifiers,
  getImplementedSpecialModifiers,
  isSpecialAvailable,
  isSpecialImplemented,
  
  // Modifiers
  applySpecialModifier,
  rollForSpecialType,
  
  // Flying helpers
  applyFlyingModifier,
  canTargetFlying,
  getFlyingDamageModifier,
  
  // Armored helpers
  applyArmoredModifier,
  calculateArmoredDamage,
  applyArmorShred,
  getArmorDisplayInfo,
};

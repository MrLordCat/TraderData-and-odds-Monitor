/**
 * Power Towers TD - Special Enemy Types Aggregator
 * 
 * Exports all special enemy types (Flying, Armored, etc.)
 * Each special type is in its own file for complex mechanics
 */

// Special types will be added as they are implemented
// const FLYING = require('./flying');
// const ARMORED = require('./armored');
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
  // Will be populated as types are implemented
};

/**
 * Special type modifiers - applied to base enemy stats
 */
const SPECIAL_MODIFIERS = {
  flying: {
    id: 'flying',
    name: 'Flying',
    prefix: '🦅',
    availableFromWave: 8,
    // Full implementation in ./flying.js
  },
  armored: {
    id: 'armored', 
    name: 'Armored',
    prefix: '🛡️',
    availableFromWave: 12,
    // Full implementation in ./armored.js
  },
  magic_immune: {
    id: 'magic_immune',
    name: 'Magic-Immune',
    prefix: '✨',
    availableFromWave: 15,
  },
  phasing: {
    id: 'phasing',
    name: 'Phasing',
    prefix: '⚡',
    availableFromWave: 18,
  },
  regenerating: {
    id: 'regenerating',
    name: 'Regenerating',
    prefix: '🩹',
    availableFromWave: 20,
  },
  undead: {
    id: 'undead',
    name: 'Undead',
    prefix: '💀',
    availableFromWave: 22,
  },
  shielded: {
    id: 'shielded',
    name: 'Shielded',
    prefix: '🔮',
    availableFromWave: 25,
  },
  splitter: {
    id: 'splitter',
    name: 'Splitter',
    prefix: '👥',
    availableFromWave: 28,
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
 * Check if special type is available for wave
 * @param {string} modifierId - Special modifier id
 * @param {number} wave - Wave number
 * @returns {boolean}
 */
function isSpecialAvailable(modifierId, wave) {
  const mod = SPECIAL_MODIFIERS[modifierId];
  return mod ? wave >= mod.availableFromWave : false;
}

module.exports = {
  SPECIAL_ENEMY_TYPES,
  SPECIAL_MODIFIERS,
  getSpecialModifier,
  getAvailableSpecialModifiers,
  isSpecialAvailable,
};

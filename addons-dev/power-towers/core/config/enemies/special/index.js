/**
 * Power Towers TD - Special Enemy Types Aggregator
 * 
 * Exports all special enemy types (Flying, Armored, etc.)
 * Each special type is in its own file for complex mechanics
 */

// Implemented special types
const { FLYING, applyFlyingModifier, canTargetFlying, getFlyingDamageModifier } = require('./flying');
const { ARMORED, applyArmoredModifier, calculateArmoredDamage, applyArmorShred, getArmorDisplayInfo } = require('./armored');
const { MAGIC_IMMUNE, applyMagicImmuneModifier, isMagicImmune, calculateMagicImmuneDamage } = require('./magic-immune');
const { REGENERATING, applyRegeneratingModifier, isRegenerating, applyRegeneration, calculateRegenAmount } = require('./regenerating');
const { SHIELDED, applyShieldedModifier, isShielded, hasActiveShield, applyShieldedDamage, calculateShieldedDamage } = require('./shielded');

// Future special types (will be added later)
// const PHASING = require('./phasing');
// const UNDEAD = require('./undead');
// const SPLITTER = require('./splitter');

/**
 * Special enemy types - enemies with unique mechanics
 * These modify base types (e.g., flying_scout, armored_brute)
 */
const SPECIAL_ENEMY_TYPES = {
  flying: FLYING,
  armored: ARMORED,
  magic_immune: MAGIC_IMMUNE,
  regenerating: REGENERATING,
  shielded: SHIELDED,
};

/**
 * Tracks first appearance state for special types per run
 * Reset this at the start of each game run
 */
const specialTypeAppearanceState = {
  flying: { hasAppeared: false, firstAppearanceWave: null },
  armored: { hasAppeared: false, firstAppearanceWave: null },
  magic_immune: { hasAppeared: false, firstAppearanceWave: null },
  regenerating: { hasAppeared: false, firstAppearanceWave: null },
  shielded: { hasAppeared: false, firstAppearanceWave: null },
};

/**
 * Reset appearance state at start of new run
 */
function resetSpecialAppearanceState() {
  Object.keys(specialTypeAppearanceState).forEach(key => {
    specialTypeAppearanceState[key] = { hasAppeared: false, firstAppearanceWave: null };
  });
}

/**
 * Get appearance state for special type
 * @param {string} modifierId - Special modifier id
 * @returns {Object} Appearance state
 */
function getAppearanceState(modifierId) {
  return specialTypeAppearanceState[modifierId] || { hasAppeared: false, firstAppearanceWave: null };
}

/**
 * Mark special type as appeared
 * @param {string} modifierId - Special modifier id
 * @param {number} wave - Wave when first appeared
 */
function markSpecialAsAppeared(modifierId, wave) {
  if (specialTypeAppearanceState[modifierId]) {
    specialTypeAppearanceState[modifierId].hasAppeared = true;
    specialTypeAppearanceState[modifierId].firstAppearanceWave = wave;
  }
}

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
    availability: FLYING.availability,
    baseSpawnChance: FLYING.baseSpawnChance,
    spawnChanceScaling: FLYING.spawnChanceScaling,
    applicableTo: FLYING.applicableTo,
    config: FLYING,
    applyModifier: applyFlyingModifier,
  },
  armored: {
    id: 'armored', 
    name: 'Armored',
    prefix: '🛡️',
    availableFromWave: ARMORED.availableFromWave,
    availability: ARMORED.availability,
    baseSpawnChance: ARMORED.baseSpawnChance,
    spawnChanceScaling: ARMORED.spawnChanceScaling,
    applicableTo: ARMORED.applicableTo,
    config: ARMORED,
    applyModifier: applyArmoredModifier,
  },
  magic_immune: {
    id: 'magic_immune',
    name: 'Magic-Immune',
    prefix: '✨',
    availableFromWave: MAGIC_IMMUNE.availableFromWave,
    availability: MAGIC_IMMUNE.availability,
    baseSpawnChance: MAGIC_IMMUNE.baseSpawnChance,
    spawnChanceScaling: MAGIC_IMMUNE.spawnChanceScaling,
    applicableTo: MAGIC_IMMUNE.applicableTo,
    config: MAGIC_IMMUNE,
    applyModifier: applyMagicImmuneModifier,
  },
  regenerating: {
    id: 'regenerating',
    name: 'Regenerating',
    prefix: '🩹',
    availableFromWave: REGENERATING.availableFromWave,
    availability: REGENERATING.availability,
    baseSpawnChance: REGENERATING.baseSpawnChance,
    spawnChanceScaling: REGENERATING.spawnChanceScaling,
    applicableTo: REGENERATING.applicableTo,
    config: REGENERATING,
    applyModifier: applyRegeneratingModifier,
  },
  shielded: {
    id: 'shielded',
    name: 'Shielded',
    prefix: '🔮',
    availableFromWave: SHIELDED.availableFromWave,
    availability: SHIELDED.availability,
    baseSpawnChance: SHIELDED.baseSpawnChance,
    spawnChanceScaling: SHIELDED.spawnChanceScaling,
    applicableTo: SHIELDED.applicableTo,
    config: SHIELDED,
    applyModifier: applyShieldedModifier,
  },
  // Placeholder entries for future types
  phasing: {
    id: 'phasing',
    name: 'Phasing',
    prefix: '⚡',
    availability: { firstAppearanceRange: [14, 20], guaranteedBy: 22 },
    availableFromWave: 14,
    baseSpawnChance: 0.08,
    spawnChanceScaling: { perWaveAfterFirst: 0.01, maxChance: 0.18 },
    applicableTo: ['scout', 'minion'],
  },
  undead: {
    id: 'undead',
    name: 'Undead',
    prefix: '💀',
    availability: { firstAppearanceRange: [18, 26], guaranteedBy: 28 },
    availableFromWave: 18,
    baseSpawnChance: 0.08,
    spawnChanceScaling: { perWaveAfterFirst: 0.01, maxChance: 0.18 },
    applicableTo: ['minion', 'swarmling'],
  },
  splitter: {
    id: 'splitter',
    name: 'Splitter',
    prefix: '👥',
    availability: { firstAppearanceRange: [24, 32], guaranteedBy: 34 },
    availableFromWave: 24,
    baseSpawnChance: 0.08,
    spawnChanceScaling: { perWaveAfterFirst: 0.01, maxChance: 0.18 },
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
 * Uses new randomized availability system
 * @param {number} wave - Current wave number
 * @returns {Object[]} Array of available special modifiers
 */
function getAvailableSpecialModifiers(wave) {
  return Object.values(SPECIAL_MODIFIERS).filter(mod => {
    const state = getAppearanceState(mod.id);
    
    // If already appeared, always available from that point
    if (state.hasAppeared) return true;
    
    // Check if wave is in the possible appearance range or past guaranteed
    if (mod.availability) {
      const [minWave] = mod.availability.firstAppearanceRange;
      return wave >= minWave;
    }
    
    // Fallback to legacy check
    return wave >= mod.availableFromWave;
  });
}

/**
 * Get implemented special modifiers available for a wave
 * Only returns types that have full implementation
 * @param {number} wave - Current wave number
 * @returns {Object[]} Array of available implemented modifiers
 */
function getImplementedSpecialModifiers(wave) {
  return getAvailableSpecialModifiers(wave).filter(mod => mod.applyModifier);
}

/**
 * Check if special type is available for wave
 * Uses new randomized availability system
 * @param {string} modifierId - Special modifier id
 * @param {number} wave - Wave number
 * @returns {boolean}
 */
function isSpecialAvailable(modifierId, wave) {
  const mod = SPECIAL_MODIFIERS[modifierId];
  if (!mod) return false;
  
  const state = getAppearanceState(modifierId);
  
  // If already appeared, always available
  if (state.hasAppeared) return true;
  
  // Check new availability range
  if (mod.availability) {
    const [minWave] = mod.availability.firstAppearanceRange;
    return wave >= minWave;
  }
  
  // Fallback to legacy
  return wave >= mod.availableFromWave;
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
 * Uses new randomized appearance system:
 * - First appearance: random within firstAppearanceRange
 * - Guaranteed by: forced spawn if not appeared by guaranteedBy wave
 * - After first: uses spawnChanceScaling
 * 
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
    const state = getAppearanceState(mod.id);
    const avail = mod.availability;
    
    // Calculate spawn chance based on state
    let spawnChance;
    
    if (state.hasAppeared) {
      // After first appearance: use scaling
      const wavesSinceFirst = wave - state.firstAppearanceWave;
      const scaling = mod.spawnChanceScaling || { perWaveAfterFirst: 0.01, maxChance: 0.25 };
      const waveBonus = wavesSinceFirst * scaling.perWaveAfterFirst;
      spawnChance = Math.min(scaling.maxChance, (mod.baseSpawnChance || 0.1) + waveBonus);
    } else if (avail) {
      // Not appeared yet - check if we should try to spawn for first time
      const [minWave, maxWave] = avail.firstAppearanceRange;
      const guaranteedBy = avail.guaranteedBy;
      
      // Force spawn if past guaranteed wave
      if (wave >= guaranteedBy) {
        spawnChance = 1.0; // 100% chance - guaranteed spawn
      } else if (wave >= minWave && wave <= maxWave) {
        // Within first appearance range - calculate progressive chance
        // Chance increases from 0 at minWave to ~50% at maxWave
        const rangeProgress = (wave - minWave) / (maxWave - minWave);
        spawnChance = 0.15 + (rangeProgress * 0.35); // 15% to 50%
      } else if (wave > maxWave && wave < guaranteedBy) {
        // Past optimal range but before guaranteed - high chance
        spawnChance = 0.6; // 60% chance
      } else {
        spawnChance = 0; // Not in range yet
      }
    } else {
      // Legacy fallback
      const waveBonus = (wave - mod.availableFromWave) * 0.005;
      spawnChance = Math.min(0.25, (mod.baseSpawnChance || 0.1) + waveBonus);
    }
    
    if (Math.random() < spawnChance) {
      // Mark as appeared if first time
      if (!state.hasAppeared) {
        markSpecialAsAppeared(mod.id, wave);
        console.log(`[SpecialEnemies] ${mod.name} first appearance on wave ${wave}!`);
      }
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
  MAGIC_IMMUNE,
  REGENERATING,
  SHIELDED,
  
  // Quick reference
  SPECIAL_MODIFIERS,
  
  // Appearance state management
  resetSpecialAppearanceState,
  getAppearanceState,
  markSpecialAsAppeared,
  
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
  
  // Magic-Immune helpers
  applyMagicImmuneModifier,
  isMagicImmune,
  calculateMagicImmuneDamage,
  
  // Regenerating helpers
  applyRegeneratingModifier,
  isRegenerating,
  applyRegeneration,
  calculateRegenAmount,
  
  // Shielded helpers
  applyShieldedModifier,
  isShielded,
  hasActiveShield,
  applyShieldedDamage,
  calculateShieldedDamage,
};

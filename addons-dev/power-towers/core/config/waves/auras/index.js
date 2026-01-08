/**
 * Power Towers TD - Wave Auras Aggregator
 * 
 * Central module for all wave aura configurations
 * Handles aura selection and application logic
 */

const HASTE = require('./haste');
const FORTIFIED = require('./fortified');
const REGENERATION = require('./regeneration');
const ENERGIZED = require('./energized');
const ETHEREAL = require('./ethereal');
const BERSERKER = require('./berserker');
const SWARM_MIND = require('./swarm-mind');

/**
 * All available auras
 */
const AURAS = {
  haste: HASTE,
  fortified: FORTIFIED,
  regeneration: REGENERATION,
  energized: ENERGIZED,
  ethereal: ETHEREAL,
  berserker: BERSERKER,
  swarm_mind: SWARM_MIND,
};

/**
 * Aura tier configuration
 * Determines max auras per wave tier
 */
const AURA_TIER_CONFIG = {
  maxAurasPerTier: [1, 2, 3, 4],  // Waves 1-10, 11-20, 21-30, 31-40
  tierWaves: 10,                  // Waves per tier
};

/**
 * Get max auras for a wave
 * @param {number} wave - Wave number
 * @returns {number} Maximum auras
 */
function getMaxAurasForWave(wave) {
  const tierIndex = Math.min(
    Math.floor((wave - 1) / AURA_TIER_CONFIG.tierWaves),
    AURA_TIER_CONFIG.maxAurasPerTier.length - 1
  );
  return AURA_TIER_CONFIG.maxAurasPerTier[tierIndex];
}

/**
 * Get all auras available for a wave
 * @param {number} wave - Wave number
 * @returns {Object[]} Array of available auras
 */
function getAvailableAuras(wave) {
  return Object.values(AURAS).filter(aura => wave >= aura.availableFromWave);
}

/**
 * Check if two auras are compatible
 * @param {string} auraId1 - First aura id
 * @param {string} auraId2 - Second aura id
 * @returns {boolean} True if compatible
 */
function areAurasCompatible(auraId1, auraId2) {
  const aura1 = AURAS[auraId1];
  const aura2 = AURAS[auraId2];
  
  if (!aura1 || !aura2) return true;
  
  return !aura1.incompatibleWith.includes(auraId2) &&
         !aura2.incompatibleWith.includes(auraId1);
}

/**
 * Select random auras for a wave
 * @param {number} wave - Wave number
 * @param {number} count - Number of auras to select (0 = random up to max)
 * @returns {string[]} Array of selected aura ids
 */
function selectAurasForWave(wave, count = 0) {
  const maxAuras = getMaxAurasForWave(wave);
  const targetCount = count > 0 ? Math.min(count, maxAuras) : Math.floor(Math.random() * (maxAuras + 1));
  
  if (targetCount === 0) return [];
  
  const available = getAvailableAuras(wave);
  if (available.length === 0) return [];
  
  // Weighted selection
  const selected = [];
  const pool = [...available];
  
  while (selected.length < targetCount && pool.length > 0) {
    // Calculate total weight
    const totalWeight = pool.reduce((sum, aura) => sum + aura.weight, 0);
    
    // Random weighted selection
    let random = Math.random() * totalWeight;
    let selectedAura = null;
    
    for (const aura of pool) {
      random -= aura.weight;
      if (random <= 0) {
        selectedAura = aura;
        break;
      }
    }
    
    if (selectedAura) {
      selected.push(selectedAura.id);
      
      // Remove selected and incompatible auras from pool
      const toRemove = new Set([selectedAura.id, ...selectedAura.incompatibleWith]);
      pool.splice(0, pool.length, ...pool.filter(a => !toRemove.has(a.id)));
    }
  }
  
  return selected;
}

/**
 * Apply auras to enemy
 * @param {Object} enemy - Enemy to modify
 * @param {string[]} auraIds - Array of aura ids to apply
 * @param {Object} context - Context (allyCount, etc.)
 * @returns {Object} Modified enemy
 */
function applyAurasToEnemy(enemy, auraIds, context = {}) {
  let modifiedEnemy = { ...enemy, auras: auraIds };
  
  for (const auraId of auraIds) {
    const aura = AURAS[auraId];
    if (aura && aura.apply) {
      if (auraId === 'swarm_mind') {
        modifiedEnemy = aura.apply(modifiedEnemy, context.allyCount || 0);
      } else {
        modifiedEnemy = aura.apply(modifiedEnemy);
      }
    }
  }
  
  return modifiedEnemy;
}

/**
 * Get aura info for UI
 * @param {string} auraId - Aura id
 * @returns {Object|null} Aura info
 */
function getAuraInfo(auraId) {
  const aura = AURAS[auraId];
  if (!aura) return null;
  
  return {
    id: aura.id,
    name: aura.name,
    emoji: aura.emoji,
    description: aura.description,
    icon: aura.icon,
  };
}

/**
 * Get all aura infos for wave (for UI)
 * @param {string[]} auraIds - Active aura ids
 * @returns {Object[]} Array of aura info objects
 */
function getAurasInfo(auraIds) {
  return auraIds.map(getAuraInfo).filter(Boolean);
}

module.exports = {
  // All auras
  AURAS,
  HASTE,
  FORTIFIED,
  REGENERATION,
  ENERGIZED,
  ETHEREAL,
  BERSERKER,
  SWARM_MIND,
  
  // Config
  AURA_TIER_CONFIG,
  
  // Functions
  getMaxAurasForWave,
  getAvailableAuras,
  areAurasCompatible,
  selectAurasForWave,
  applyAurasToEnemy,
  getAuraInfo,
  getAurasInfo,
};

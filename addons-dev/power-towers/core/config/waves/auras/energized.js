/**
 * Power Towers TD - Energized Wave Aura
 * 
 * Enemies are immune to slow effects
 */

const ENERGIZED_AURA = {
  id: 'energized',
  name: 'Energized',
  emoji: '⚡',
  
  // Effect
  effect: {
    type: 'slow_immunity',
    value: true,
  },
  
  // Availability
  availableFromWave: 8,
  weight: 7,
  
  // Incompatible with
  incompatibleWith: [],
  
  // Visual
  visual: {
    particleColor: '#9b59b6',
    particleType: 'sparks',
    enemyTint: '#bb8fce',
  },
  
  // UI
  description: 'Enemies are immune to slow effects',
  icon: '⚡',
};

/**
 * Apply energized effect to enemy
 * @param {Object} enemy - Enemy to modify
 * @returns {Object} Modified enemy
 */
function applyEnergized(enemy) {
  return {
    ...enemy,
    isSlowImmune: true,
    isEnergized: true,
  };
}

module.exports = {
  ...ENERGIZED_AURA,
  apply: applyEnergized,
};

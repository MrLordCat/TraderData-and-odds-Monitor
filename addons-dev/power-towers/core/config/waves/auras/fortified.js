/**
 * Power Towers TD - Fortified Wave Aura
 * 
 * Increases enemy health
 */

const FORTIFIED_AURA = {
  id: 'fortified',
  name: 'Fortified',
  emoji: '🛡️',
  
  // Effect
  effect: {
    type: 'hp_multiplier',
    value: 1.4,               // +40% HP
  },
  
  // Availability
  availableFromWave: 1,
  weight: 10,
  
  // Incompatible with
  incompatibleWith: ['regeneration'], // Too strong together early
  
  // Visual
  visual: {
    particleColor: '#f1c40f',
    particleType: 'shield',
    enemyTint: '#f7dc6f',
  },
  
  // UI
  description: 'Enemies have 40% more health',
  icon: '🛡️',
};

/**
 * Apply fortified effect to enemy
 * @param {Object} enemy - Enemy to modify
 * @returns {Object} Modified enemy
 */
function applyFortified(enemy) {
  const newMaxHp = Math.round(enemy.maxHp * FORTIFIED_AURA.effect.value);
  return {
    ...enemy,
    maxHp: newMaxHp,
    hp: newMaxHp,
    isFortified: true,
  };
}

module.exports = {
  ...FORTIFIED_AURA,
  apply: applyFortified,
};

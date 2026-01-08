/**
 * Power Towers TD - Haste Wave Aura
 * 
 * Increases enemy movement speed
 */

const HASTE_AURA = {
  id: 'haste',
  name: 'Haste',
  emoji: '💨',
  
  // Effect
  effect: {
    type: 'speed_multiplier',
    value: 1.25,              // +25% speed
  },
  
  // Availability
  availableFromWave: 1,
  weight: 10,                  // Selection weight (higher = more common)
  
  // Incompatible with
  incompatibleWith: ['berserker'],
  
  // Visual
  visual: {
    particleColor: '#3498db',
    particleType: 'speed_lines',
    enemyTint: '#5dade2',
  },
  
  // UI
  description: 'Enemies move 25% faster',
  icon: '💨',
};

/**
 * Apply haste effect to enemy
 * @param {Object} enemy - Enemy to modify
 * @returns {Object} Modified enemy
 */
function applyHaste(enemy) {
  return {
    ...enemy,
    baseSpeed: enemy.baseSpeed * HASTE_AURA.effect.value,
    speed: enemy.speed * HASTE_AURA.effect.value,
    hasHaste: true,
  };
}

module.exports = {
  ...HASTE_AURA,
  apply: applyHaste,
};

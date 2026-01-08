/**
 * Power Towers TD - Ethereal Wave Aura
 * 
 * Enemies have a chance to dodge attacks
 */

const ETHEREAL_AURA = {
  id: 'ethereal',
  name: 'Ethereal',
  emoji: '👻',
  
  // Effect
  effect: {
    type: 'dodge_chance',
    value: 0.20,              // 20% dodge chance
  },
  
  // Availability
  availableFromWave: 12,
  weight: 6,
  
  // Incompatible with
  incompatibleWith: [],
  
  // Visual
  visual: {
    particleColor: '#bdc3c7',
    particleType: 'ghost',
    enemyTint: null,          // Semi-transparent instead
    opacity: 0.7,
  },
  
  // UI
  description: 'Enemies have 20% chance to dodge attacks',
  icon: '👻',
};

/**
 * Apply ethereal effect to enemy
 * @param {Object} enemy - Enemy to modify
 * @returns {Object} Modified enemy
 */
function applyEthereal(enemy) {
  return {
    ...enemy,
    dodgeChance: ETHEREAL_AURA.effect.value,
    isEthereal: true,
    opacity: ETHEREAL_AURA.visual.opacity,
  };
}

/**
 * Roll for dodge
 * @param {Object} enemy - Enemy that might dodge
 * @returns {boolean} True if attack is dodged
 */
function rollDodge(enemy) {
  if (!enemy.isEthereal || !enemy.dodgeChance) return false;
  return Math.random() < enemy.dodgeChance;
}

module.exports = {
  ...ETHEREAL_AURA,
  apply: applyEthereal,
  rollDodge,
};

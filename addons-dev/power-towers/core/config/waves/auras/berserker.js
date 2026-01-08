/**
 * Power Towers TD - Berserker Wave Aura
 * 
 * Enemies gain speed when low health
 */

const BERSERKER_AURA = {
  id: 'berserker',
  name: 'Berserker',
  emoji: '🔥',
  
  // Effect
  effect: {
    type: 'berserk',
    hpThreshold: 0.30,        // Below 30% HP
    speedBonus: 0.50,         // +50% speed
  },
  
  // Availability
  availableFromWave: 10,
  weight: 7,
  
  // Incompatible with
  incompatibleWith: ['haste'],
  
  // Visual
  visual: {
    particleColor: '#e74c3c',
    particleType: 'fire',
    enemyTint: '#e74c3c',
    activeGlow: '#ff0000',
  },
  
  // UI
  description: 'Enemies gain 50% speed when below 30% HP',
  icon: '🔥',
};

/**
 * Apply berserker effect to enemy
 * @param {Object} enemy - Enemy to modify
 * @returns {Object} Modified enemy
 */
function applyBerserker(enemy) {
  return {
    ...enemy,
    hasBerserk: true,
    berserkThreshold: BERSERKER_AURA.effect.hpThreshold,
    berserkSpeedBonus: BERSERKER_AURA.effect.speedBonus,
    isBerserking: false,
  };
}

/**
 * Update berserker status based on current HP
 * @param {Object} enemy - Enemy to check
 * @returns {boolean} True if berserker status changed
 */
function updateBerserkStatus(enemy) {
  if (!enemy.hasBerserk) return false;
  
  const hpPercent = enemy.hp / enemy.maxHp;
  const shouldBerserk = hpPercent <= enemy.berserkThreshold;
  
  if (shouldBerserk && !enemy.isBerserking) {
    enemy.isBerserking = true;
    enemy.speed = enemy.baseSpeed * (1 + enemy.berserkSpeedBonus);
    return true;
  }
  
  return false;
}

module.exports = {
  ...BERSERKER_AURA,
  apply: applyBerserker,
  updateStatus: updateBerserkStatus,
};

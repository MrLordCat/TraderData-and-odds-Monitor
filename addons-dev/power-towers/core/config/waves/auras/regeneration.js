/**
 * Power Towers TD - Regeneration Wave Aura
 * 
 * Enemies regenerate health over time
 */

const REGENERATION_AURA = {
  id: 'regeneration',
  name: 'Regeneration',
  emoji: '🔄',
  
  // Effect
  effect: {
    type: 'regen',
    value: 0.02,              // 2% HP per second
    tickRate: 0.5,            // Regen every 0.5s
  },
  
  // Availability
  availableFromWave: 6,       // Not too early
  weight: 8,
  
  // Incompatible with
  incompatibleWith: ['fortified'],
  
  // Visual
  visual: {
    particleColor: '#2ecc71',
    particleType: 'healing',
    enemyTint: '#58d68d',
  },
  
  // UI
  description: 'Enemies regenerate 2% HP per second',
  icon: '🔄',
};

/**
 * Apply regeneration effect to enemy
 * @param {Object} enemy - Enemy to modify
 * @returns {Object} Modified enemy
 */
function applyRegeneration(enemy) {
  return {
    ...enemy,
    hasRegen: true,
    regenPercent: REGENERATION_AURA.effect.value,
    regenTickRate: REGENERATION_AURA.effect.tickRate,
    regenTimer: 0,
  };
}

/**
 * Process regeneration tick
 * @param {Object} enemy - Enemy with regen
 * @param {number} deltaTime - Time since last update
 * @returns {number} HP regenerated
 */
function processRegenTick(enemy, deltaTime) {
  if (!enemy.hasRegen) return 0;
  
  enemy.regenTimer += deltaTime;
  if (enemy.regenTimer >= enemy.regenTickRate) {
    enemy.regenTimer -= enemy.regenTickRate;
    const regenAmount = Math.round(enemy.maxHp * enemy.regenPercent * enemy.regenTickRate);
    enemy.hp = Math.min(enemy.maxHp, enemy.hp + regenAmount);
    return regenAmount;
  }
  return 0;
}

module.exports = {
  ...REGENERATION_AURA,
  apply: applyRegeneration,
  processTick: processRegenTick,
};

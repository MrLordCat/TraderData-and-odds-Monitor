/**
 * Power Towers TD - Swarm Mind Wave Aura
 * 
 * Enemies get stronger based on living wave members
 */

const SWARM_MIND_AURA = {
  id: 'swarm_mind',
  name: 'Swarm Mind',
  emoji: '🧠',
  
  // Effect
  effect: {
    type: 'swarm_bonus',
    hpPerAlly: 0.05,          // +5% HP per living ally
    maxBonus: 1.0,            // Cap at +100% HP
  },
  
  // Availability
  availableFromWave: 15,
  weight: 5,
  
  // Incompatible with
  incompatibleWith: [],
  
  // Visual
  visual: {
    particleColor: '#8e44ad',
    particleType: 'connection',
    enemyTint: '#9b59b6',
    connectionLines: true,
  },
  
  // UI
  description: 'Enemies gain +5% HP per living ally (max +100%)',
  icon: '🧠',
};

/**
 * Apply swarm mind effect to enemy
 * @param {Object} enemy - Enemy to modify
 * @param {number} allyCount - Number of living allies
 * @returns {Object} Modified enemy
 */
function applySwarmMind(enemy, allyCount = 0) {
  const { hpPerAlly, maxBonus } = SWARM_MIND_AURA.effect;
  const bonus = Math.min(maxBonus, allyCount * hpPerAlly);
  const newMaxHp = Math.round(enemy.maxHp * (1 + bonus));
  
  return {
    ...enemy,
    hasSwarmMind: true,
    swarmMindBonus: bonus,
    maxHp: newMaxHp,
    hp: newMaxHp,
  };
}

/**
 * Calculate swarm bonus for current ally count
 * @param {number} allyCount - Number of living allies
 * @returns {number} HP multiplier bonus (0-1)
 */
function calculateSwarmBonus(allyCount) {
  const { hpPerAlly, maxBonus } = SWARM_MIND_AURA.effect;
  return Math.min(maxBonus, allyCount * hpPerAlly);
}

module.exports = {
  ...SWARM_MIND_AURA,
  apply: applySwarmMind,
  calculateBonus: calculateSwarmBonus,
};

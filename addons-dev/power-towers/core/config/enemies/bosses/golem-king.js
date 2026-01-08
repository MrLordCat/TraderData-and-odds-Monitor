/**
 * Power Towers TD - Golem King Boss
 * 
 * Main boss for Wave 10 (Tier 1 Final)
 * Massive tank with ground slam ability
 */

const GOLEM_KING = {
  id: 'golem_king',
  name: 'Golem King',
  emoji: '👑',
  
  // Base stats (before wave scaling)
  baseHealth: 200,
  baseSpeed: 18,
  reward: 300,
  xp: 30,
  
  // Boss type
  type: 'main',
  wave: 10,
  tier: 1,
  
  // Visual
  color: '#8B4513',  // Saddle brown
  size: 45,
  
  // Special abilities
  abilities: [
    {
      id: 'stone_armor',
      name: 'Stone Armor',
      description: 'Reduces damage by 25%, but vulnerable to magic (+15%)',
      type: 'passive',
      effect: {
        damageReduction: 0.25,
        magicVulnerability: 0.15,
      },
    },
    {
      id: 'ground_slam',
      name: 'Ground Slam',
      description: 'Every 10 seconds stuns nearby towers for 2 sec',
      type: 'active',
      cooldown: 10000,
      effect: {
        radius: 120,
        stunDuration: 2000,
        targetType: 'towers',
      },
    },
    {
      id: 'summon_shards',
      name: 'Summon Shards',
      description: 'At 50% HP summons 3 stone minions',
      type: 'threshold',
      trigger: { healthPercent: 0.5 },
      effect: {
        summonType: 'stone_minion',
        summonCount: 3,
      },
    },
  ],
  
  // Phase transitions
  phases: [
    {
      healthThreshold: 1.0,
      speedMod: 1.0,
      description: 'Full power',
    },
    {
      healthThreshold: 0.5,
      speedMod: 0.8,
      triggerAbility: 'summon_shards',
      description: 'Summon shards',
    },
    {
      healthThreshold: 0.25,
      speedMod: 1.3,
      enraged: true,
      description: 'Rage - speed boost!',
    },
  ],
  
  // Loot table
  loot: {
    guaranteed: [
      { type: 'gold', amount: 300 },
      { type: 'gem', amount: 2 },
    ],
    chance: [
      { type: 'rare_gem', amount: 1, chance: 0.15 },
    ],
  },
  
  // Death effect
  onDeath: {
    effect: 'shatter',
    radius: 100,
    particles: 20,
    sound: 'boss_death_epic',
  },
  
  description: 'Tier 1 Final Boss. Ancient golem awakened from eternal slumber.',
};

/**
 * Apply Golem King abilities to boss instance
 * @param {Object} boss - Boss instance
 * @returns {Object} Modified boss
 */
function applyAbilities(boss) {
  const modified = { ...boss };
  
  // Stone Armor
  const stoneArmor = GOLEM_KING.abilities[0].effect;
  modified.damageReduction = stoneArmor.damageReduction;
  modified.magicVulnerability = stoneArmor.magicVulnerability;
  
  // Ground Slam - cooldown tracking
  modified.groundSlamCooldown = 0;
  modified.groundSlamConfig = GOLEM_KING.abilities[1];
  
  // Summon Shards - threshold tracking
  modified.summonedShards = false;
  modified.summonConfig = GOLEM_KING.abilities[2];
  
  // Phase tracking
  modified.currentPhase = 0;
  modified.phases = GOLEM_KING.phases;
  
  return modified;
}

/**
 * Update boss phase based on health
 * @param {Object} boss - Boss instance
 * @returns {Object} Phase change info or null
 */
function updatePhase(boss) {
  const healthPercent = boss.currentHealth / boss.maxHealth;
  
  for (let i = GOLEM_KING.phases.length - 1; i >= 0; i--) {
    const phase = GOLEM_KING.phases[i];
    if (healthPercent <= phase.healthThreshold && boss.currentPhase < i) {
      boss.currentPhase = i;
      boss.speed = boss.baseSpeed * phase.speedMod;
      
      return {
        phase: i,
        ...phase,
      };
    }
  }
  
  return null;
}

module.exports = {
  ...GOLEM_KING,
  applyAbilities,
  updatePhase,
};

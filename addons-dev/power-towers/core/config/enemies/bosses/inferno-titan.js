/**
 * Power Towers TD - Inferno Titan Boss
 * 
 * Main boss for Wave 30 (Tier 3 Final)
 * Fire giant with devastating AoE abilities
 */

const INFERNO_TITAN = {
  id: 'inferno_titan',
  name: 'Инферно Титан',
  emoji: '🔥',
  
  // Base stats
  baseHealth: 6000,
  baseSpeed: 22,
  reward: 800,
  xp: 60,
  
  // Boss type
  type: 'main',
  wave: 30,
  tier: 3,
  
  // Visual
  color: '#FF4500',  // Orange red
  size: 50,
  
  // Special abilities
  abilities: [
    {
      id: 'burning_aura',
      name: 'Пылающая Аура',
      description: 'Постоянно наносит 5 урона/сек башням в радиусе 100px',
      type: 'passive',
      effect: {
        radius: 100,
        damagePerSecond: 5,
        targetType: 'towers',
      },
    },
    {
      id: 'meteor_strike',
      name: 'Удар Метеора',
      description: 'Каждые 15 сек призывает метеор на случайную башню',
      type: 'active',
      cooldown: 15000,
      effect: {
        damage: 50,
        radius: 80,
        stunDuration: 1500,
        burnDuration: 5000,
        burnDamage: 3,
      },
    },
    {
      id: 'molten_armor',
      name: 'Расплавленная Броня',
      description: 'При получении физ. урона наносит 10% урона атакующему',
      type: 'passive',
      effect: {
        reflectPercent: 0.1,
        damageType: 'physical',
      },
    },
    {
      id: 'inferno_rage',
      name: 'Инферно Ярость',
      description: 'При 30% HP - взрывная волна и +50% скорость',
      type: 'threshold',
      trigger: { healthPercent: 0.3 },
      effect: {
        explosionDamage: 30,
        explosionRadius: 150,
        speedBoost: 1.5,
        burnAllInRadius: true,
      },
    },
  ],
  
  // Phase transitions
  phases: [
    {
      healthThreshold: 1.0,
      auraDamage: 5,
      description: 'Пробуждение',
    },
    {
      healthThreshold: 0.7,
      auraDamage: 8,
      meteorCooldownMod: 0.8,
      description: 'Разогрев',
    },
    {
      healthThreshold: 0.4,
      auraDamage: 12,
      meteorCooldownMod: 0.6,
      description: 'Пик жара',
    },
    {
      healthThreshold: 0.3,
      auraDamage: 15,
      speedMod: 1.5,
      enraged: true,
      description: 'ИНФЕРНО!',
    },
  ],
  
  // Loot
  loot: {
    guaranteed: [
      { type: 'gold', amount: 800 },
      { type: 'gem', amount: 5 },
    ],
    chance: [
      { type: 'rare_gem', amount: 2, chance: 0.35 },
      { type: 'inferno_core', amount: 1, chance: 0.15 },
    ],
  },
  
  // Death effect
  onDeath: {
    effect: 'volcanic_eruption',
    radius: 200,
    lavaPoolDuration: 10000,
    lavaPoolDamage: 8,
    sound: 'boss_death_inferno',
  },
  
  description: 'Tier 3 Final Boss. Огненный гигант, оставляющий пепел на своём пути.',
};

/**
 * Apply abilities
 */
function applyAbilities(boss) {
  const modified = { ...boss };
  
  // Burning Aura
  modified.auraConfig = INFERNO_TITAN.abilities[0].effect;
  
  // Meteor Strike
  modified.meteorCooldown = 5000;  // Initial delay
  modified.meteorConfig = INFERNO_TITAN.abilities[1];
  
  // Molten Armor
  modified.physicalReflect = INFERNO_TITAN.abilities[2].effect.reflectPercent;
  
  // Inferno Rage - not triggered yet
  modified.rageTriggered = false;
  modified.rageConfig = INFERNO_TITAN.abilities[3];
  
  // Phase
  modified.currentPhase = 0;
  modified.phases = INFERNO_TITAN.phases;
  
  return modified;
}

/**
 * Update meteor cooldown and check for cast
 */
function updateMeteor(boss, deltaTime, towers) {
  boss.meteorCooldown -= deltaTime;
  
  if (boss.meteorCooldown <= 0) {
    // Reset cooldown with phase modifier
    const phase = boss.phases[boss.currentPhase];
    const cooldownMod = phase?.meteorCooldownMod || 1;
    boss.meteorCooldown = boss.meteorConfig.cooldown * cooldownMod;
    
    // Select random tower
    if (towers && towers.length > 0) {
      const target = towers[Math.floor(Math.random() * towers.length)];
      return {
        type: 'meteor_strike',
        target,
        ...boss.meteorConfig.effect,
      };
    }
  }
  
  return null;
}

/**
 * Check and trigger rage phase
 */
function checkRage(boss) {
  if (boss.rageTriggered) return null;
  
  const healthPercent = boss.currentHealth / boss.maxHealth;
  if (healthPercent <= boss.rageConfig.trigger.healthPercent) {
    boss.rageTriggered = true;
    boss.speed *= boss.rageConfig.effect.speedBoost;
    
    return {
      type: 'inferno_rage',
      explosionDamage: boss.rageConfig.effect.explosionDamage,
      explosionRadius: boss.rageConfig.effect.explosionRadius,
      burnAll: boss.rageConfig.effect.burnAllInRadius,
    };
  }
  
  return null;
}

/**
 * Get burning aura damage for current phase
 */
function getAuraDamage(boss) {
  const phase = boss.phases[boss.currentPhase];
  return phase?.auraDamage || boss.auraConfig.damagePerSecond;
}

module.exports = {
  ...INFERNO_TITAN,
  applyAbilities,
  updateMeteor,
  checkRage,
  getAuraDamage,
};

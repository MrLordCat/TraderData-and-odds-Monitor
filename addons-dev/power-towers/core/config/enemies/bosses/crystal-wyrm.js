/**
 * Power Towers TD - Crystal Wyrm Boss
 * 
 * Mini-boss for Wave 25
 * Magic-resistant serpent with reflection
 */

const CRYSTAL_WYRM = {
  id: 'crystal_wyrm',
  name: 'Crystal Wyrm',
  emoji: '🐉',
  
  // Base stats
  baseHealth: 120,
  baseSpeed: 40,
  reward: 200,
  xp: 25,
  
  // Boss type
  type: 'mini',
  wave: 25,
  
  // Visual
  color: '#E6E6FA',  // Lavender
  size: 35,
  
  // Special abilities
  abilities: [
    {
      id: 'crystal_scales',
      name: 'Crystal Scales',
      description: 'Reflects 20% of magic damage back to tower',
      type: 'passive',
      effect: {
        reflectPercent: 0.2,
        damageType: 'magic',
      },
    },
    {
      id: 'prismatic_shield',
      name: 'Prismatic Shield',
      description: 'Immune to magic for 2 sec every 10 sec',
      type: 'active',
      cooldown: 10000,
      effect: {
        duration: 2000,
        immuneToMagic: true,
      },
    },
    {
      id: 'crystal_trail',
      name: 'Crystal Trail',
      description: 'Leaves slowing crystals along the path',
      type: 'passive',
      effect: {
        trailInterval: 3000,  // Every 3 seconds
        trailDuration: 5000,
        slowAmount: 0.15,    // 15% tower attack speed slow
        trailRadius: 30,
      },
    },
  ],
  
  // Loot
  loot: {
    guaranteed: [
      { type: 'gold', amount: 200 },
      { type: 'gem', amount: 1 },
    ],
    chance: [
      { type: 'crystal_shard', amount: 1, chance: 0.3 },
    ],
  },
  
  // Death effect
  onDeath: {
    effect: 'crystal_shatter',
    radius: 90,
    dropCrystals: 5,
    sound: 'crystal_break',
  },
  
  description: 'Mini-boss with magic protection and damage reflection.',
};

/**
 * Apply abilities
 */
function applyAbilities(boss) {
  const modified = { ...boss };
  
  // Crystal Scales - reflection
  modified.magicReflect = CRYSTAL_WYRM.abilities[0].effect.reflectPercent;
  
  // Prismatic Shield
  modified.shieldCooldown = 0;
  modified.shieldActive = false;
  modified.shieldDuration = 0;
  modified.shieldConfig = CRYSTAL_WYRM.abilities[1];
  
  // Crystal Trail
  modified.trailTimer = 0;
  modified.trailConfig = CRYSTAL_WYRM.abilities[2].effect;
  modified.crystalTrails = [];
  
  return modified;
}

/**
 * Process magic damage with reflection
 * @returns {Object} { finalDamage, reflectedDamage }
 */
function processMagicDamage(boss, damage) {
  if (boss.shieldActive) {
    return { finalDamage: 0, reflectedDamage: 0, blocked: true };
  }
  
  const reflectedDamage = Math.round(damage * boss.magicReflect);
  return {
    finalDamage: damage,
    reflectedDamage,
    blocked: false,
  };
}

/**
 * Update shield and trail
 */
function update(boss, deltaTime) {
  const events = [];
  
  // Shield update
  if (boss.shieldActive) {
    boss.shieldDuration -= deltaTime;
    if (boss.shieldDuration <= 0) {
      boss.shieldActive = false;
    }
  } else {
    boss.shieldCooldown -= deltaTime;
    if (boss.shieldCooldown <= 0) {
      boss.shieldActive = true;
      boss.shieldDuration = boss.shieldConfig.effect.duration;
      boss.shieldCooldown = boss.shieldConfig.cooldown;
      events.push({ type: 'shield_activated' });
    }
  }
  
  // Trail update
  boss.trailTimer += deltaTime;
  if (boss.trailTimer >= boss.trailConfig.trailInterval) {
    boss.trailTimer = 0;
    events.push({
      type: 'trail_created',
      position: { x: boss.x, y: boss.y },
      duration: boss.trailConfig.trailDuration,
      slowAmount: boss.trailConfig.slowAmount,
      radius: boss.trailConfig.trailRadius,
    });
  }
  
  return events;
}

module.exports = {
  ...CRYSTAL_WYRM,
  applyAbilities,
  processMagicDamage,
  update,
};

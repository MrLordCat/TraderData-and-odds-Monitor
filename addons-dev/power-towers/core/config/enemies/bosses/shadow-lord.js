/**
 * Power Towers TD - Shadow Lord Boss
 * 
 * Main boss for Wave 20 (Tier 2 Final)
 * Stealth specialist with shadow clones
 */

const SHADOW_LORD = {
  id: 'shadow_lord',
  name: 'Повелитель Теней',
  emoji: '👤',
  
  // Base stats
  baseHealth: 3500,
  baseSpeed: 35,
  reward: 500,
  xp: 45,
  
  // Boss type
  type: 'main',
  wave: 20,
  tier: 2,
  
  // Visual
  color: '#2F4F4F',  // Dark slate gray
  size: 40,
  
  // Special abilities
  abilities: [
    {
      id: 'shadow_cloak',
      name: 'Теневая Маскировка',
      description: 'Невидимость на 3 сек каждые 12 сек (башни не атакуют)',
      type: 'active',
      cooldown: 12000,
      effect: {
        duration: 3000,
        untargetable: true,
      },
    },
    {
      id: 'shadow_clones',
      name: 'Теневые Клоны',
      description: 'Создаёт 2 клона с 30% HP при получении урона (кд 15 сек)',
      type: 'triggered',
      cooldown: 15000,
      effect: {
        cloneCount: 2,
        cloneHealthPercent: 0.3,
        cloneDamage: 0,  // Clones don't deal damage
      },
    },
    {
      id: 'life_drain',
      name: 'Похищение Жизни',
      description: 'При убийстве клона восстанавливает 10% HP',
      type: 'passive',
      effect: {
        healPercent: 0.1,
      },
    },
  ],
  
  // Phase transitions
  phases: [
    {
      healthThreshold: 1.0,
      cloakCooldownMod: 1.0,
      description: 'Начальная фаза',
    },
    {
      healthThreshold: 0.6,
      cloakCooldownMod: 0.8,  // 20% faster cloak
      description: 'Тени сгущаются',
    },
    {
      healthThreshold: 0.3,
      cloakCooldownMod: 0.5,  // 50% faster cloak
      permanentClones: true,   // Always has clones
      description: 'Повелитель Тьмы',
    },
  ],
  
  // Loot
  loot: {
    guaranteed: [
      { type: 'gold', amount: 500 },
      { type: 'gem', amount: 3 },
    ],
    chance: [
      { type: 'rare_gem', amount: 1, chance: 0.25 },
      { type: 'shadow_essence', amount: 1, chance: 0.1 },
    ],
  },
  
  // Death effect
  onDeath: {
    effect: 'shadow_implosion',
    radius: 120,
    spawnShadowlings: 5,
    sound: 'boss_death_shadow',
  },
  
  description: 'Tier 2 Final Boss. Мастер теней, способный становиться невидимым и создавать клонов.',
};

/**
 * Apply abilities
 */
function applyAbilities(boss) {
  const modified = { ...boss };
  
  // Shadow Cloak
  modified.cloakCooldown = 0;
  modified.isCloaked = false;
  modified.cloakDuration = 0;
  modified.cloakConfig = SHADOW_LORD.abilities[0];
  
  // Shadow Clones
  modified.cloneCooldown = 0;
  modified.activeClones = [];
  modified.cloneConfig = SHADOW_LORD.abilities[1];
  
  // Life Drain
  modified.lifeDrainPercent = SHADOW_LORD.abilities[2].effect.healPercent;
  
  // Phase
  modified.currentPhase = 0;
  modified.phases = SHADOW_LORD.phases;
  
  return modified;
}

/**
 * Update cloak status
 */
function updateCloak(boss, deltaTime) {
  if (boss.isCloaked) {
    boss.cloakDuration -= deltaTime;
    if (boss.cloakDuration <= 0) {
      boss.isCloaked = false;
    }
  } else {
    boss.cloakCooldown -= deltaTime;
    if (boss.cloakCooldown <= 0) {
      // Activate cloak
      boss.isCloaked = true;
      boss.cloakDuration = boss.cloakConfig.effect.duration;
      
      // Apply phase modifier
      const phase = boss.phases[boss.currentPhase];
      boss.cloakCooldown = boss.cloakConfig.cooldown * (phase?.cloakCooldownMod || 1);
      
      return { cloakActivated: true };
    }
  }
  return null;
}

/**
 * Create shadow clone
 */
function createClone(boss) {
  return {
    id: `clone_${boss.id}_${Date.now()}`,
    parentId: boss.id,
    health: boss.maxHealth * boss.cloneConfig.effect.cloneHealthPercent,
    maxHealth: boss.maxHealth * boss.cloneConfig.effect.cloneHealthPercent,
    speed: boss.speed,
    isClone: true,
    reward: 0,
    xp: 0,
    color: '#1a1a2e',
    size: boss.size * 0.8,
  };
}

module.exports = {
  ...SHADOW_LORD,
  applyAbilities,
  updateCloak,
  createClone,
};

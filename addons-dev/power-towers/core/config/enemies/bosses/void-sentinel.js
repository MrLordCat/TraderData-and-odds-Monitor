/**
 * Power Towers TD - Void Sentinel Boss
 * 
 * Mini-boss for Wave 35
 * Reality-warping defender with void abilities
 */

const VOID_SENTINEL = {
  id: 'void_sentinel',
  name: 'Страж Пустоты',
  emoji: '🌀',
  
  // Base stats
  baseHealth: 2000,
  baseSpeed: 30,
  reward: 300,
  xp: 35,
  
  // Boss type
  type: 'mini',
  wave: 35,
  
  // Visual
  color: '#4B0082',  // Indigo
  size: 38,
  
  // Special abilities
  abilities: [
    {
      id: 'void_rift',
      name: 'Разлом Пустоты',
      description: 'Создаёт зону, блокирующую снаряды на 4 сек',
      type: 'active',
      cooldown: 12000,
      effect: {
        duration: 4000,
        radius: 70,
        blocksProjectiles: true,
      },
    },
    {
      id: 'reality_anchor',
      name: 'Якорь Реальности',
      description: 'Иммунитет к контролю (замедление, стан)',
      type: 'passive',
      effect: {
        immuneToSlow: true,
        immuneToStun: true,
        immuneToFreeze: true,
      },
    },
    {
      id: 'entropy',
      name: 'Энтропия',
      description: 'Каждые 8 сек снижает урон ближайшей башни на 30% на 5 сек',
      type: 'active',
      cooldown: 8000,
      effect: {
        damageReduction: 0.3,
        duration: 5000,
        targetCount: 1,
        range: 150,
      },
    },
  ],
  
  // Loot
  loot: {
    guaranteed: [
      { type: 'gold', amount: 300 },
      { type: 'gem', amount: 2 },
    ],
    chance: [
      { type: 'void_essence', amount: 1, chance: 0.25 },
    ],
  },
  
  // Death effect
  onDeath: {
    effect: 'void_collapse',
    radius: 100,
    pullStrength: 50,  // Pulls projectiles toward center
    duration: 2000,
    sound: 'void_implosion',
  },
  
  description: 'Мини-босс, манипулирующий пространством. Иммунен к контролю.',
};

/**
 * Apply abilities
 */
function applyAbilities(boss) {
  const modified = { ...boss };
  
  // Void Rift
  modified.riftCooldown = 3000;  // Initial delay
  modified.riftActive = false;
  modified.riftDuration = 0;
  modified.riftPosition = null;
  modified.riftConfig = VOID_SENTINEL.abilities[0];
  
  // Reality Anchor - CC immunity
  modified.immuneToSlow = true;
  modified.immuneToStun = true;
  modified.immuneToFreeze = true;
  
  // Entropy
  modified.entropyCooldown = 4000;  // Initial delay
  modified.entropyConfig = VOID_SENTINEL.abilities[2];
  
  return modified;
}

/**
 * Update abilities
 */
function update(boss, deltaTime, context = {}) {
  const events = [];
  
  // Void Rift update
  if (boss.riftActive) {
    boss.riftDuration -= deltaTime;
    if (boss.riftDuration <= 0) {
      boss.riftActive = false;
      boss.riftPosition = null;
      events.push({ type: 'rift_ended' });
    }
  } else {
    boss.riftCooldown -= deltaTime;
    if (boss.riftCooldown <= 0) {
      boss.riftActive = true;
      boss.riftDuration = boss.riftConfig.effect.duration;
      boss.riftCooldown = boss.riftConfig.cooldown;
      boss.riftPosition = { x: boss.x, y: boss.y };
      events.push({
        type: 'rift_created',
        position: boss.riftPosition,
        radius: boss.riftConfig.effect.radius,
        duration: boss.riftConfig.effect.duration,
      });
    }
  }
  
  // Entropy update
  boss.entropyCooldown -= deltaTime;
  if (boss.entropyCooldown <= 0) {
    boss.entropyCooldown = boss.entropyConfig.cooldown;
    
    // Find nearest tower
    if (context.towers && context.towers.length > 0) {
      let nearestTower = null;
      let nearestDist = Infinity;
      
      for (const tower of context.towers) {
        const dx = tower.x - boss.x;
        const dy = tower.y - boss.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < nearestDist && dist <= boss.entropyConfig.effect.range) {
          nearestDist = dist;
          nearestTower = tower;
        }
      }
      
      if (nearestTower) {
        events.push({
          type: 'entropy_applied',
          target: nearestTower,
          damageReduction: boss.entropyConfig.effect.damageReduction,
          duration: boss.entropyConfig.effect.duration,
        });
      }
    }
  }
  
  return events;
}

/**
 * Check if projectile is blocked by rift
 */
function isProjectileBlocked(boss, projectile) {
  if (!boss.riftActive || !boss.riftPosition) return false;
  
  const dx = projectile.x - boss.riftPosition.x;
  const dy = projectile.y - boss.riftPosition.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  
  return dist <= boss.riftConfig.effect.radius;
}

module.exports = {
  ...VOID_SENTINEL,
  applyAbilities,
  update,
  isProjectileBlocked,
};

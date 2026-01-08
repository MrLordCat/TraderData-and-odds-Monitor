/**
 * Power Towers TD - Ancient Destroyer Boss
 * 
 * FINAL BOSS for Wave 40
 * The ultimate challenge - ancient being of pure destruction
 */

const ANCIENT_DESTROYER = {
  id: 'ancient_destroyer',
  name: 'Древний Разрушитель',
  emoji: '💀',
  
  // Base stats (massive)
  baseHealth: 15000,
  baseSpeed: 15,
  reward: 2000,
  xp: 100,
  
  // Boss type
  type: 'final',
  wave: 40,
  tier: 4,
  
  // Visual
  color: '#8B0000',  // Dark red
  size: 60,
  glowColor: '#FF0000',
  
  // Special abilities
  abilities: [
    {
      id: 'annihilation_beam',
      name: 'Луч Аннигиляции',
      description: 'Каждые 20 сек - луч, уничтожающий снаряды и наносящий 100 урона башням на линии',
      type: 'active',
      cooldown: 20000,
      effect: {
        damage: 100,
        width: 50,
        duration: 2000,
        destroysProjectiles: true,
      },
    },
    {
      id: 'dark_resurrection',
      name: 'Тёмное Воскрешение',
      description: 'При падении до 0 HP - восстанавливает 30% и становится неуязвимым на 3 сек (один раз)',
      type: 'threshold',
      trigger: { healthPercent: 0 },
      effect: {
        healPercent: 0.3,
        invulnerableDuration: 3000,
        usesRemaining: 1,
      },
    },
    {
      id: 'void_corruption',
      name: 'Порча Пустоты',
      description: 'Каждые 10 сек накладывает дебафф на случайную башню (-50% атаки на 8 сек)',
      type: 'active',
      cooldown: 10000,
      effect: {
        attackSpeedReduction: 0.5,
        duration: 8000,
      },
    },
    {
      id: 'summon_heralds',
      name: 'Призыв Вестников',
      description: 'При 75%, 50%, 25% HP призывает волну врагов',
      type: 'threshold',
      triggers: [0.75, 0.5, 0.25],
      effect: {
        summonTypes: ['minion', 'scout', 'brute'],
        summonCounts: [5, 3, 2],
      },
    },
    {
      id: 'despair_aura',
      name: 'Аура Отчаяния',
      description: 'Все башни в радиусе 200px наносят на 20% меньше урона',
      type: 'passive',
      effect: {
        radius: 200,
        damageReduction: 0.2,
      },
    },
  ],
  
  // Phase transitions
  phases: [
    {
      healthThreshold: 1.0,
      name: 'Пробуждение',
      description: 'Древний открывает глаза',
      auraMod: 1.0,
    },
    {
      healthThreshold: 0.75,
      name: 'Призыв I',
      description: 'Призывает первую волну слуг',
      summonWave: 1,
      auraMod: 1.0,
    },
    {
      healthThreshold: 0.5,
      name: 'Призыв II',
      description: 'Мощь возрастает',
      summonWave: 2,
      speedMod: 1.2,
      auraMod: 1.3,
    },
    {
      healthThreshold: 0.25,
      name: 'Призыв III',
      description: 'Последняя волна защитников',
      summonWave: 3,
      speedMod: 1.5,
      auraMod: 1.5,
      damageReduction: 0.2,  // 20% less damage taken
    },
    {
      healthThreshold: 0,
      name: 'Воскрешение',
      description: 'Смерть - лишь начало',
      resurrection: true,
    },
  ],
  
  // Loot (massive rewards)
  loot: {
    guaranteed: [
      { type: 'gold', amount: 2000 },
      { type: 'gem', amount: 10 },
      { type: 'rare_gem', amount: 3 },
    ],
    chance: [
      { type: 'legendary_core', amount: 1, chance: 0.5 },
      { type: 'ancient_relic', amount: 1, chance: 0.2 },
    ],
  },
  
  // Epic death effect
  onDeath: {
    effect: 'apocalypse',
    radius: 300,
    screenShake: true,
    slowMotion: true,
    particleExplosion: 100,
    victorySequence: true,
    sound: 'final_boss_death',
  },
  
  description: 'ФИНАЛЬНЫЙ БОСС. Древнее зло, пробудившееся после тысячелетий сна. Победа над ним завершает кампанию.',
};

/**
 * Apply abilities
 */
function applyAbilities(boss) {
  const modified = { ...boss };
  
  // Annihilation Beam
  modified.beamCooldown = 8000;  // Initial delay
  modified.beamConfig = ANCIENT_DESTROYER.abilities[0];
  
  // Dark Resurrection
  modified.resurrectionUsed = false;
  modified.resurrectionConfig = ANCIENT_DESTROYER.abilities[1];
  modified.isInvulnerable = false;
  modified.invulnerableTimer = 0;
  
  // Void Corruption
  modified.corruptionCooldown = 5000;
  modified.corruptionConfig = ANCIENT_DESTROYER.abilities[2];
  
  // Summon Heralds - track which thresholds triggered
  modified.summonTriggered = [false, false, false];  // 75%, 50%, 25%
  modified.summonConfig = ANCIENT_DESTROYER.abilities[3];
  
  // Despair Aura
  modified.auraConfig = ANCIENT_DESTROYER.abilities[4].effect;
  
  // Phase
  modified.currentPhase = 0;
  modified.phases = ANCIENT_DESTROYER.phases;
  
  return modified;
}

/**
 * Main update function
 */
function update(boss, deltaTime, context = {}) {
  const events = [];
  
  // Invulnerability timer
  if (boss.isInvulnerable) {
    boss.invulnerableTimer -= deltaTime;
    if (boss.invulnerableTimer <= 0) {
      boss.isInvulnerable = false;
      events.push({ type: 'invulnerability_ended' });
    }
  }
  
  // Annihilation Beam
  boss.beamCooldown -= deltaTime;
  if (boss.beamCooldown <= 0) {
    boss.beamCooldown = boss.beamConfig.cooldown;
    
    // Fire beam in random direction toward towers
    const angle = Math.random() * Math.PI * 2;
    events.push({
      type: 'annihilation_beam',
      origin: { x: boss.x, y: boss.y },
      angle,
      ...boss.beamConfig.effect,
    });
  }
  
  // Void Corruption
  boss.corruptionCooldown -= deltaTime;
  if (boss.corruptionCooldown <= 0 && context.towers?.length > 0) {
    boss.corruptionCooldown = boss.corruptionConfig.cooldown;
    
    const target = context.towers[Math.floor(Math.random() * context.towers.length)];
    events.push({
      type: 'void_corruption',
      target,
      ...boss.corruptionConfig.effect,
    });
  }
  
  // Check summon thresholds
  const healthPercent = boss.currentHealth / boss.maxHealth;
  const thresholds = boss.summonConfig.triggers;
  
  for (let i = 0; i < thresholds.length; i++) {
    if (healthPercent <= thresholds[i] && !boss.summonTriggered[i]) {
      boss.summonTriggered[i] = true;
      events.push({
        type: 'summon_heralds',
        wave: i + 1,
        enemies: boss.summonConfig.effect.summonTypes.map((type, idx) => ({
          type,
          count: boss.summonConfig.effect.summonCounts[idx],
        })),
      });
    }
  }
  
  return events;
}

/**
 * Process death - check for resurrection
 * @returns {Object|null} Resurrection event or null if truly dead
 */
function processDeath(boss) {
  if (!boss.resurrectionUsed) {
    boss.resurrectionUsed = true;
    
    // Resurrect
    const healAmount = boss.maxHealth * boss.resurrectionConfig.effect.healPercent;
    boss.currentHealth = healAmount;
    boss.isInvulnerable = true;
    boss.invulnerableTimer = boss.resurrectionConfig.effect.invulnerableDuration;
    
    return {
      type: 'dark_resurrection',
      newHealth: healAmount,
      invulnerableDuration: boss.invulnerableTimer,
    };
  }
  
  // Truly dead
  return null;
}

/**
 * Get despair aura debuff for towers in range
 */
function getDespairDebuff(boss, tower) {
  const dx = tower.x - boss.x;
  const dy = tower.y - boss.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  
  if (dist <= boss.auraConfig.radius) {
    // Apply phase modifier
    const phase = boss.phases[boss.currentPhase];
    const auraMod = phase?.auraMod || 1.0;
    return boss.auraConfig.damageReduction * auraMod;
  }
  
  return 0;
}

/**
 * Check if boss takes reduced damage (phase 4)
 */
function getDamageReduction(boss) {
  const phase = boss.phases[boss.currentPhase];
  return phase?.damageReduction || 0;
}

module.exports = {
  ...ANCIENT_DESTROYER,
  applyAbilities,
  update,
  processDeath,
  getDespairDebuff,
  getDamageReduction,
};

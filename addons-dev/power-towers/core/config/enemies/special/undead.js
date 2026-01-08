/**
 * Power Towers TD - Undead Enemy Modifier
 * 
 * Undead enemies resurrect once after death with partial HP.
 * Counter strategies:
 * - Fire damage (prevents resurrection)
 * - Overkill damage (reduces resurrect HP)
 * - Focus fire to kill twice quickly
 */

const UNDEAD = {
  id: 'undead',
  name: 'Undead',
  emoji: '💀',
  prefix: '💀',
  
  // Wave availability - randomized first appearance
  availability: {
    firstAppearanceRange: [18, 26],  // First appears between waves 18-26
    guaranteedBy: 28,                // Guaranteed to appear by wave 28 if not yet
  },
  
  // Legacy field (minimum possible)
  availableFromWave: 18,
  
  // Base spawn chance when available
  baseSpawnChance: 0.08,  // 8% chance to replace applicable enemies
  
  // Chance scaling after first appearance
  spawnChanceScaling: {
    perWaveAfterFirst: 0.01,   // +1% per wave after first appearance
    maxChance: 0.16,           // Cap at 16%
  },
  
  // Which base types can become undead
  applicableTo: ['minion', 'swarmling'],  // Weak enemies that come back
  
  // Stat modifiers
  stats: {
    healthMultiplier: 0.7,     // 30% less HP (but resurrects)
    speedMultiplier: 0.85,     // 15% slower (shambling)
    rewardMultiplier: 2.0,     // 100% more reward (kill twice)
    sizeMultiplier: 1.0,       // Same size
  },
  
  // Resurrection config
  resurrection: {
    // HP percentage when resurrected
    resurrectHealthPercent: 0.5,   // 50% of max HP
    
    // Overkill reduces resurrect HP
    overkillReducesHealth: true,
    overkillReductionRate: 0.5,    // Each 1 overkill damage = 0.5 less resurrect HP
    minResurrectPercent: 0.2,      // Minimum 20% HP on resurrect
    
    // Resurrection delay
    resurrectDelay: 1.0,           // 1 second as corpse before rising
    
    // Fire damage prevents resurrection
    firePreventsResurrect: true,
    
    // Visual effect during resurrection
    corpseFlashRate: 0.2,          // Flash while resurrecting
  },
  
  // Combat interactions
  combat: {
    // All attack types work normally
    vulnerableTo: ['normal', 'siege', 'magic', 'piercing'],
    
    // Fire does extra damage and prevents resurrection
    fireBonus: 1.3,                // 30% extra fire damage
    
    // Damage modifiers
    damageModifiers: {
      normal: 1.0,
      siege: 1.0,
      magic: 1.0,
      piercing: 1.0,
      fire: 1.3,    // Fire is super effective
      ice: 0.8,     // Ice less effective (already dead)
      nature: 0.8,  // Nature less effective
    },
  },
  
  // Visual properties
  visual: {
    // Undead appearance
    tint: {
      r: 0.5,
      g: 0.8,
      b: 0.5,      // Greenish tint
    },
    
    // Decay particles
    decayParticles: {
      enabled: true,
      color: '#88aa66',
      rate: 3,     // Particles per second
    },
    
    // Corpse state
    corpseAlpha: 0.5,
    corpseColor: '#445533',
    
    // Resurrection effect
    resurrectEffect: {
      enabled: true,
      color: '#66ff66',
      particleCount: 12,
      duration: 500,   // ms
    },
    
    // Soul indicator (shows can resurrect)
    soulIndicator: {
      enabled: true,
      color: '#aaffaa',
      position: 'above',
    },
  },
  
  // Status effect interactions
  statusEffects: {
    // Fire prevents resurrection
    burnPreventsResurrect: true,
    
    // Poison doesn't prevent (already rotting)
    poisonPreventsResurrect: false,
  },
  
  // Description for UI
  description: 'Resurrects once after death with 50% HP. Fire prevents resurrection.',
};

/**
 * Check if enemy is undead type
 * @param {Object} enemy - Enemy instance
 * @returns {boolean}
 */
function isUndead(enemy) {
  return enemy.isUndead === true || enemy.specialType === 'undead';
}

/**
 * Check if undead enemy can still resurrect
 * @param {Object} enemy - Enemy instance
 * @returns {boolean}
 */
function canResurrect(enemy) {
  if (!isUndead(enemy)) return false;
  return !enemy.hasResurrected && !enemy.resurrectPrevented;
}

/**
 * Check if fire effect should prevent resurrection
 * @param {Object} enemy - Enemy instance
 * @returns {boolean}
 */
function shouldPreventResurrect(enemy) {
  if (!UNDEAD.resurrection.firePreventsResurrect) return false;
  
  // Check for burn status effect
  const hasBurn = enemy.statusEffects?.some(e => e.type === 'burn');
  if (hasBurn) return true;
  
  // Check if last damage was fire
  if (enemy.lastDamageElement === 'fire') return true;
  
  return false;
}

/**
 * Calculate resurrect HP based on overkill damage
 * @param {Object} enemy - Enemy instance
 * @param {number} overkillDamage - Damage beyond 0 HP
 * @returns {number} HP to resurrect with
 */
function calculateResurrectHP(enemy, overkillDamage = 0) {
  const config = UNDEAD.resurrection;
  const maxHealth = enemy.maxHealth;
  
  let resurrectPercent = config.resurrectHealthPercent;
  
  // Reduce by overkill
  if (config.overkillReducesHealth && overkillDamage > 0) {
    const reduction = overkillDamage * config.overkillReductionRate / maxHealth;
    resurrectPercent = Math.max(config.minResurrectPercent, resurrectPercent - reduction);
  }
  
  return Math.round(maxHealth * resurrectPercent);
}

/**
 * Process undead death - start resurrection or final death
 * @param {Object} enemy - Enemy instance
 * @param {number} overkillDamage - Damage beyond 0 HP
 * @returns {Object} { shouldResurrect, resurrectHP, delay }
 */
function processUndeadDeath(enemy, overkillDamage = 0) {
  if (!isUndead(enemy)) {
    return { shouldResurrect: false };
  }
  
  // Check if can resurrect
  if (!canResurrect(enemy)) {
    return { shouldResurrect: false };
  }
  
  // Check if fire prevents
  if (shouldPreventResurrect(enemy)) {
    enemy.resurrectPrevented = true;
    return { shouldResurrect: false, preventedByFire: true };
  }
  
  // Calculate resurrect HP
  const resurrectHP = calculateResurrectHP(enemy, overkillDamage);
  
  return {
    shouldResurrect: true,
    resurrectHP,
    delay: UNDEAD.resurrection.resurrectDelay * 1000, // Convert to ms
  };
}

/**
 * Resurrect the undead enemy
 * @param {Object} enemy - Enemy instance
 * @param {number} resurrectHP - HP to resurrect with
 * @returns {Object} Updated enemy
 */
function resurrectEnemy(enemy, resurrectHP) {
  enemy.health = resurrectHP;
  enemy.hasResurrected = true;
  enemy.isCorpse = false;
  
  // Clear corpse state
  enemy.corpseTimer = 0;
  
  return enemy;
}

/**
 * Apply undead modifier to base enemy
 * @param {Object} baseEnemy - Base enemy config
 * @returns {Object} Modified enemy with undead properties
 */
function applyUndeadModifier(baseEnemy) {
  const stats = UNDEAD.stats;
  const visual = UNDEAD.visual;
  
  return {
    ...baseEnemy,
    
    // Modified stats
    health: Math.round((baseEnemy.health || baseEnemy.baseHealth) * stats.healthMultiplier),
    maxHealth: Math.round((baseEnemy.maxHealth || baseEnemy.health || baseEnemy.baseHealth) * stats.healthMultiplier),
    speed: (baseEnemy.speed || baseEnemy.baseSpeed) * stats.speedMultiplier,
    reward: Math.round((baseEnemy.reward) * stats.rewardMultiplier),
    size: (baseEnemy.size || 10) * stats.sizeMultiplier,
    
    // Special type flags
    isUndead: true,
    specialType: 'undead',
    
    // Resurrection state
    hasResurrected: false,
    resurrectPrevented: false,
    isCorpse: false,
    corpseTimer: 0,
    
    // Visual properties
    undeadTint: visual.tint,
    decayParticles: visual.decayParticles,
    soulIndicator: visual.soulIndicator,
    
    // Display name update
    displayName: `${UNDEAD.emoji} ${baseEnemy.displayName || baseEnemy.name}`,
  };
}

module.exports = {
  UNDEAD,
  isUndead,
  canResurrect,
  shouldPreventResurrect,
  calculateResurrectHP,
  processUndeadDeath,
  resurrectEnemy,
  applyUndeadModifier,
};

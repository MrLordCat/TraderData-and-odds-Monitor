/**
 * Power Towers TD - Shielded Enemy Modifier
 * 
 * Shielded enemies have a protective barrier that absorbs damage.
 * Counter strategies:
 * - Multi-hit attacks (each hit depletes shield)
 * - Fast attack speed towers
 * - Piercing attacks (partial shield bypass)
 * - Siege AoE (multiple hits per attack)
 */

const SHIELDED = {
  id: 'shielded',
  name: 'Shielded',
  emoji: '🔮',
  prefix: '🔮',
  
  // Wave availability - randomized first appearance
  availability: {
    firstAppearanceRange: [20, 28],  // First appears between waves 20-28
    guaranteedBy: 30,                // Guaranteed to appear by wave 30 if not yet
  },
  
  // Legacy field (minimum possible)
  availableFromWave: 20,
  
  // Base spawn chance when available
  baseSpawnChance: 0.08,  // 8% chance to replace applicable enemies
  
  // Chance scaling after first appearance
  spawnChanceScaling: {
    perWaveAfterFirst: 0.01,   // +1% per wave after first appearance
    maxChance: 0.18,           // Cap at 18%
  },
  
  // Which base types can become shielded
  applicableTo: ['minion', 'scout', 'brute'],
  
  // Stat modifiers
  stats: {
    healthMultiplier: 0.85,    // 15% less HP (has shield instead)
    speedMultiplier: 0.9,      // 10% slower
    rewardMultiplier: 1.8,     // 80% more reward
    sizeMultiplier: 1.0,       // Same size
  },
  
  // Shield config
  shield: {
    // Base shield amount (absorbs this much damage)
    baseShieldAmount: 50,
    
    // Shield scales with wave
    shieldPerWave: 5,          // +5 shield per wave after unlock
    
    // Maximum shield cap
    maxShield: 200,
    
    // Shield regeneration (if enabled)
    regenEnabled: false,
    regenDelay: 5.0,           // Seconds after last hit
    regenRate: 10,             // Shield/second
    
    // Minimum damage that affects shield
    // (prevents chip damage from being completely absorbed)
    minDamageThreshold: 5,     // Damage below this does 1 damage to shield
    
    // Shield break bonus
    breakBonus: {
      enabled: true,
      stunDuration: 0.5,       // 0.5s stun when shield breaks
      damageVulnerability: 1.2, // 20% extra damage for 2s after break
      vulnerabilityDuration: 2.0,
    },
  },
  
  // Combat interactions
  combat: {
    // All attack types can damage shield
    vulnerableTo: ['normal', 'siege', 'magic', 'piercing'],
    
    // Damage modifiers to SHIELD (not health)
    shieldDamageModifiers: {
      normal: 1.0,             // Standard damage
      siege: 0.8,              // Less effective (shield disperses AoE)
      magic: 1.2,              // More effective against magic shields
      piercing: 1.5,           // Best at breaking shields
    },
    
    // Piercing bypass
    piercingBypass: 0.2,       // 20% of piercing damage bypasses shield
  },
  
  // Visual properties
  visual: {
    // Shield bubble
    bubble: {
      enabled: true,
      color: '#4488ff',
      innerColor: '#88bbff',
      alpha: 0.4,
      radius: 1.3,             // Relative to enemy size
    },
    
    // Shield health indicator
    shieldBar: {
      enabled: true,
      color: '#4488ff',
      position: 'above',       // Above health bar
      height: 3,
    },
    
    // Shield hit effect
    hitEffect: {
      enabled: true,
      color: '#ffffff',
      flashDuration: 100,      // ms
      rippleEffect: true,
    },
    
    // Shield break effect
    breakEffect: {
      enabled: true,
      color: '#4488ff',
      particleCount: 8,
      duration: 500,           // ms
    },
    
    // Hexagon pattern on shield
    hexPattern: {
      enabled: true,
      color: '#66aaff',
      alpha: 0.2,
    },
  },
  
  // Description for UI
  description: 'Has a 50 HP shield that absorbs damage. Piercing attacks bypass 20% of shield.',
};

/**
 * Check if enemy is shielded type
 * @param {Object} enemy - Enemy instance
 * @returns {boolean}
 */
function isShielded(enemy) {
  return enemy.isShielded === true || enemy.specialType === 'shielded';
}

/**
 * Check if shield is active
 * @param {Object} enemy - Enemy instance
 * @returns {boolean}
 */
function hasActiveShield(enemy) {
  return isShielded(enemy) && (enemy.shieldHealth || 0) > 0;
}

/**
 * Calculate damage to shield and health
 * @param {number} baseDamage - Original damage
 * @param {string} attackType - Attack type
 * @param {Object} enemy - Enemy instance
 * @returns {Object} { shieldDamage, healthDamage, shieldBroken }
 */
function calculateShieldedDamage(baseDamage, attackType, enemy) {
  if (!isShielded(enemy)) {
    return { shieldDamage: 0, healthDamage: baseDamage, shieldBroken: false };
  }
  
  const config = SHIELDED.shield;
  const combat = SHIELDED.combat;
  
  let shieldHealth = enemy.shieldHealth || 0;
  
  // If shield is broken, check for vulnerability bonus
  if (shieldHealth <= 0) {
    let healthDamage = baseDamage;
    
    // Apply vulnerability if recently broken
    if (enemy.shieldBrokenTime) {
      const timeSinceBreak = (Date.now() - enemy.shieldBrokenTime) / 1000;
      if (timeSinceBreak < config.breakBonus.vulnerabilityDuration) {
        healthDamage *= config.breakBonus.damageVulnerability;
      }
    }
    
    return { shieldDamage: 0, healthDamage: Math.round(healthDamage), shieldBroken: false };
  }
  
  // Calculate shield damage modifier
  const shieldMod = combat.shieldDamageModifiers[attackType] || 1.0;
  
  // Calculate bypass damage (piercing)
  let bypassDamage = 0;
  if (attackType === 'piercing') {
    bypassDamage = baseDamage * combat.piercingBypass;
  }
  
  // Remaining damage goes to shield
  let shieldDamage = (baseDamage - bypassDamage) * shieldMod;
  
  // Apply minimum damage threshold
  if (shieldDamage > 0 && shieldDamage < config.minDamageThreshold) {
    shieldDamage = 1;
  }
  
  // Calculate actual damage distribution
  let healthDamage = bypassDamage;
  let shieldBroken = false;
  
  if (shieldDamage >= shieldHealth) {
    // Shield breaks, overflow goes to health
    healthDamage += (shieldDamage - shieldHealth);
    shieldDamage = shieldHealth;
    shieldBroken = true;
  }
  
  return {
    shieldDamage: Math.round(shieldDamage),
    healthDamage: Math.round(healthDamage),
    shieldBroken,
  };
}

/**
 * Apply damage to shielded enemy
 * @param {Object} enemy - Enemy instance
 * @param {number} baseDamage - Damage amount
 * @param {string} attackType - Attack type
 * @returns {Object} Updated enemy and damage info
 */
function applyShieldedDamage(enemy, baseDamage, attackType) {
  const result = calculateShieldedDamage(baseDamage, attackType, enemy);
  
  // Apply shield damage
  if (result.shieldDamage > 0) {
    enemy.shieldHealth = Math.max(0, (enemy.shieldHealth || 0) - result.shieldDamage);
  }
  
  // Handle shield break
  if (result.shieldBroken) {
    enemy.shieldBrokenTime = Date.now();
    enemy.isStunned = true;
    enemy.stunEndTime = Date.now() + SHIELDED.shield.breakBonus.stunDuration * 1000;
  }
  
  // Health damage is applied by caller
  return {
    enemy,
    healthDamage: result.healthDamage,
    shieldDamage: result.shieldDamage,
    shieldBroken: result.shieldBroken,
  };
}

/**
 * Get shield amount for wave
 * @param {number} wave - Current wave
 * @returns {number} Shield HP
 */
function getShieldAmount(wave) {
  const config = SHIELDED.shield;
  const waveBonus = Math.max(0, wave - SHIELDED.availableFromWave) * config.shieldPerWave;
  return Math.min(config.maxShield, config.baseShieldAmount + waveBonus);
}

/**
 * Apply shielded modifier to base enemy
 * @param {Object} baseEnemy - Base enemy config
 * @param {number} wave - Current wave (for shield scaling)
 * @returns {Object} Modified enemy with shield properties
 */
function applyShieldedModifier(baseEnemy, wave = 25) {
  const stats = SHIELDED.stats;
  const visual = SHIELDED.visual;
  const shieldAmount = getShieldAmount(wave);
  
  return {
    ...baseEnemy,
    
    // Modified stats
    health: Math.round((baseEnemy.health || baseEnemy.baseHealth) * stats.healthMultiplier),
    maxHealth: Math.round((baseEnemy.maxHealth || baseEnemy.health || baseEnemy.baseHealth) * stats.healthMultiplier),
    speed: (baseEnemy.speed || baseEnemy.baseSpeed) * stats.speedMultiplier,
    reward: Math.round((baseEnemy.reward) * stats.rewardMultiplier),
    size: (baseEnemy.size || 10) * stats.sizeMultiplier,
    
    // Special type flags
    isShielded: true,
    specialType: 'shielded',
    
    // Shield properties
    shieldHealth: shieldAmount,
    maxShieldHealth: shieldAmount,
    shieldBrokenTime: null,
    
    // Visual properties
    shieldBubble: visual.bubble,
    shieldBar: visual.shieldBar,
    shieldHexPattern: visual.hexPattern,
    
    // Display name update
    displayName: `${SHIELDED.emoji} ${baseEnemy.displayName || baseEnemy.name}`,
  };
}

module.exports = {
  SHIELDED,
  isShielded,
  hasActiveShield,
  calculateShieldedDamage,
  applyShieldedDamage,
  getShieldAmount,
  applyShieldedModifier,
};

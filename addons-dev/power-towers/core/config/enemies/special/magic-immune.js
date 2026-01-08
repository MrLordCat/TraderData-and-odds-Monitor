/**
 * Power Towers TD - Magic-Immune Enemy Modifier
 * 
 * Magic-immune enemies are completely immune to Magic attack type.
 * They must be killed using:
 * - Normal attacks (physical)
 * - Siege attacks (AoE)
 * - Piercing attacks (precision)
 * 
 * They have an anti-magic aura that also reduces elemental damage.
 */

const MAGIC_IMMUNE = {
  id: 'magic_immune',
  name: 'Magic-Immune',
  emoji: '✨',
  prefix: '✨',
  
  // Wave availability
  availableFromWave: 15,
  
  // Base spawn chance when available
  baseSpawnChance: 0.12,  // 12% chance to replace applicable enemies
  
  // Which base types can become magic-immune
  applicableTo: ['minion', 'brute'],  // Standard and tank enemies
  
  // Stat modifiers
  stats: {
    healthMultiplier: 1.2,     // 20% more HP
    speedMultiplier: 0.9,      // 10% slower (heavy anti-magic armor)
    rewardMultiplier: 1.6,     // 60% more reward
    sizeMultiplier: 1.05,      // Slightly larger
  },
  
  // Combat interactions
  combat: {
    // Attack types that work normally
    vulnerableTo: ['normal', 'siege', 'piercing'],
    
    // Elements with reduced damage
    resistantToElements: ['fire', 'ice', 'lightning', 'nature', 'dark'],
    
    // Attack type immunity
    immuneTo: ['magic'],
    
    // Damage modifiers when hit
    damageModifiers: {
      magic: 0.0,              // IMMUNE to magic
      normal: 1.0,             // Normal damage
      siege: 1.0,              // Normal damage
      piercing: 1.2,           // 20% extra (armor piercing)
      
      // Element damage reduction
      fire: 0.5,               // 50% fire resistance
      ice: 0.5,                // 50% ice resistance
      lightning: 0.5,          // 50% lightning resistance
      nature: 0.5,             // 50% nature resistance
      dark: 0.5,               // 50% dark resistance
    },
  },
  
  // Visual properties
  visual: {
    // Anti-magic glow
    aura: {
      enabled: true,
      color: '#9966ff',        // Purple glow
      innerColor: '#cc99ff',   // Lighter inner
      radius: 1.4,             // Relative to enemy size
      pulseSpeed: 0.002,       // Pulse animation speed
      pulseAmplitude: 0.15,    // How much it pulses
    },
    
    // Rune markings
    runes: {
      enabled: true,
      count: 4,
      color: '#6633cc',
      rotationSpeed: 0.001,
    },
    
    // Particle effect
    particles: {
      enabled: true,
      color: '#bb88ff',
      count: 2,
      speed: 0.5,
    },
  },
  
  // Status effect interactions
  statusEffects: {
    // Reduced duration for magic-based effects
    burnDurationMultiplier: 0.5,
    freezeDurationMultiplier: 0.3,
    poisonDurationMultiplier: 0.5,
    // Physical effects work normally
    bleedDurationMultiplier: 1.0,
    slowDurationMultiplier: 1.0,
  },
  
  // Description for UI
  description: 'Immune to Magic attacks. 50% resistance to elemental damage.',
};

/**
 * Check if enemy is magic-immune
 * @param {Object} enemy - Enemy instance
 * @returns {boolean}
 */
function isMagicImmune(enemy) {
  return enemy.isMagicImmune === true || enemy.specialType === 'magic_immune';
}

/**
 * Calculate damage against magic-immune enemy
 * @param {number} baseDamage - Original damage
 * @param {string} attackType - Attack type (normal, siege, magic, piercing)
 * @param {string} element - Element type if any
 * @param {Object} enemy - Enemy instance
 * @returns {number} Modified damage
 */
function calculateMagicImmuneDamage(baseDamage, attackType, element, enemy) {
  if (!isMagicImmune(enemy)) return baseDamage;
  
  const modifiers = MAGIC_IMMUNE.combat.damageModifiers;
  
  // Check attack type immunity first
  if (attackType === 'magic') {
    return 0; // Complete immunity
  }
  
  // Apply attack type modifier
  let damage = baseDamage * (modifiers[attackType] || 1.0);
  
  // Apply element resistance if applicable
  if (element && modifiers[element] !== undefined && element !== attackType) {
    damage *= modifiers[element];
  }
  
  return Math.round(damage);
}

/**
 * Apply magic-immune modifier to base enemy
 * @param {Object} baseEnemy - Base enemy config
 * @returns {Object} Modified enemy with magic-immune properties
 */
function applyMagicImmuneModifier(baseEnemy) {
  const stats = MAGIC_IMMUNE.stats;
  const visual = MAGIC_IMMUNE.visual;
  
  return {
    ...baseEnemy,
    
    // Modified stats
    health: Math.round((baseEnemy.health || baseEnemy.baseHealth) * stats.healthMultiplier),
    maxHealth: Math.round((baseEnemy.maxHealth || baseEnemy.health || baseEnemy.baseHealth) * stats.healthMultiplier),
    speed: (baseEnemy.speed || baseEnemy.baseSpeed) * stats.speedMultiplier,
    reward: Math.round((baseEnemy.reward) * stats.rewardMultiplier),
    size: (baseEnemy.size || 10) * stats.sizeMultiplier,
    
    // Special type flags
    isMagicImmune: true,
    specialType: 'magic_immune',
    
    // Visual properties
    magicAura: visual.aura,
    magicRunes: visual.runes,
    magicParticles: visual.particles,
    
    // Display name update
    displayName: `${MAGIC_IMMUNE.emoji} ${baseEnemy.displayName || baseEnemy.name}`,
    
    // Status effect modifiers
    statusEffectModifiers: MAGIC_IMMUNE.statusEffects,
  };
}

module.exports = {
  MAGIC_IMMUNE,
  isMagicImmune,
  calculateMagicImmuneDamage,
  applyMagicImmuneModifier,
};

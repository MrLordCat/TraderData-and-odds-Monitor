/**
 * Power Towers TD - Flying Enemy Modifier
 * 
 * Flying enemies can only be targeted by specific attack types:
 * - Magic attacks (always can target flying)
 * - Lightning element (chain lightning reaches them)
 * - Towers with "Anti-Air" upgrade
 * 
 * Normal, Siege, and Piercing attacks cannot hit flying enemies by default.
 */

const FLYING = {
  id: 'flying',
  name: 'Flying',
  emoji: '🦅',
  prefix: '🦅',
  
  // Wave availability
  availableFromWave: 8,
  
  // Base spawn chance when available (can be overridden per wave)
  baseSpawnChance: 0.15,  // 15% chance to replace scout/minion
  
  // Which base types can become flying
  applicableTo: ['scout', 'minion'],  // Only fast/light enemies
  
  // Stat modifiers
  stats: {
    healthMultiplier: 0.8,     // 20% less HP (fragile flyers)
    speedMultiplier: 1.25,     // 25% faster
    rewardMultiplier: 1.5,     // 50% more reward (harder to kill)
    sizeMultiplier: 0.9,       // Slightly smaller
  },
  
  // Combat interactions
  combat: {
    // Attack types that can target flying
    vulnerableTo: ['magic'],
    
    // Elements that can target flying (regardless of attack type)
    vulnerableToElements: ['lightning'],
    
    // Attack types that CANNOT target flying (unless have special upgrade)
    immuneTo: ['normal', 'siege', 'piercing'],
    
    // Damage modifiers when hit
    damageModifiers: {
      magic: 1.0,        // Normal damage from magic
      lightning: 1.2,    // 20% extra from lightning
      antiAir: 1.5,      // 50% extra from anti-air towers
    },
  },
  
  // Visual properties
  visual: {
    // Flying enemies hover above ground
    hoverHeight: 15,           // Pixels above normal position
    hoverAnimation: {
      amplitude: 3,            // Hover bob amount
      frequency: 0.003,        // Hover speed
    },
    
    // Shadow offset (further due to height)
    shadowOffset: 20,
    shadowScale: 0.6,          // Smaller shadow (higher up)
    shadowAlpha: 0.2,          // Fainter shadow
    
    // Wing animation
    wings: {
      enabled: true,
      size: 0.8,               // Relative to enemy size
      flapSpeed: 0.02,         // Animation speed
      color: null,             // Use enemy color if null
    },
    
    // Trail effect
    trail: {
      enabled: true,
      color: 'rgba(200, 220, 255, 0.3)',
      length: 3,
    },
  },
  
  // Description for UI
  description: 'Летающий враг. Только Magic и Lightning башни могут атаковать.',
  shortDescription: 'Иммунитет к наземным атакам',
};

/**
 * Apply flying modifier to base enemy
 * @param {Object} baseEnemy - Base enemy stats
 * @returns {Object} Modified enemy with flying properties
 */
function applyFlyingModifier(baseEnemy) {
  const { stats, visual, combat } = FLYING;
  
  return {
    ...baseEnemy,
    
    // Mark as flying
    isFlying: true,
    specialType: 'flying',
    
    // Apply stat modifiers
    baseHealth: Math.round(baseEnemy.baseHealth * stats.healthMultiplier),
    health: Math.round((baseEnemy.health || baseEnemy.baseHealth) * stats.healthMultiplier),
    maxHealth: Math.round((baseEnemy.maxHealth || baseEnemy.baseHealth) * stats.healthMultiplier),
    baseSpeed: Math.round(baseEnemy.baseSpeed * stats.speedMultiplier),
    speed: Math.round((baseEnemy.speed || baseEnemy.baseSpeed) * stats.speedMultiplier),
    reward: Math.round(baseEnemy.reward * stats.rewardMultiplier),
    size: (baseEnemy.size || 10) * stats.sizeMultiplier,
    
    // Visual properties
    hoverHeight: visual.hoverHeight,
    hoverAnimation: visual.hoverAnimation,
    shadowOffset: visual.shadowOffset,
    shadowScale: visual.shadowScale,
    shadowAlpha: visual.shadowAlpha,
    hasWings: visual.wings.enabled,
    wingSize: visual.wings.size,
    wingFlapSpeed: visual.wings.flapSpeed,
    
    // Combat properties
    flyingCombat: combat,
    
    // Update display name
    displayName: `${FLYING.emoji} ${baseEnemy.displayName || baseEnemy.name}`,
    emoji: FLYING.emoji,
  };
}

/**
 * Check if tower can target flying enemy
 * @param {Object} tower - Tower data
 * @param {Object} enemy - Enemy data (must have isFlying: true)
 * @returns {boolean} True if tower can target this flying enemy
 */
function canTargetFlying(tower, enemy) {
  if (!enemy.isFlying) return true;  // Not flying, can always target
  
  const { combat } = FLYING;
  const attackType = tower.attackTypeId || 'normal';
  const element = tower.elementPath || 'none';
  
  // Check if attack type can hit flying
  if (combat.vulnerableTo.includes(attackType)) return true;
  
  // Check if element can hit flying
  if (combat.vulnerableToElements.includes(element)) return true;
  
  // Check for anti-air upgrade
  if (tower.hasAntiAir || tower.canTargetFlying) return true;
  
  // Cannot target
  return false;
}

/**
 * Get damage modifier for flying enemy
 * @param {Object} tower - Tower data
 * @param {Object} enemy - Flying enemy
 * @returns {number} Damage multiplier
 */
function getFlyingDamageModifier(tower, enemy) {
  if (!enemy.isFlying) return 1.0;
  
  const { combat } = FLYING;
  const element = tower.elementPath || 'none';
  
  if (tower.hasAntiAir) {
    return combat.damageModifiers.antiAir;
  }
  
  if (combat.vulnerableToElements.includes(element)) {
    return combat.damageModifiers.lightning;
  }
  
  return combat.damageModifiers.magic;
}

module.exports = {
  FLYING,
  applyFlyingModifier,
  canTargetFlying,
  getFlyingDamageModifier,
};

/**
 * Power Towers TD - Phasing Enemy Modifier
 * 
 * Phasing enemies periodically become intangible/invulnerable.
 * Counter strategies:
 * - Time attacks during vulnerable phase
 * - Status effects (burn, poison) continue during phase
 * - Fast attack speed to maximize damage window
 * - AoE attacks to hit multiple times in vulnerable window
 */

const PHASING = {
  id: 'phasing',
  name: 'Phasing',
  emoji: '👻',
  prefix: '👻',
  
  // Wave availability - randomized first appearance
  availability: {
    firstAppearanceRange: [14, 20],  // First appears between waves 14-20
    guaranteedBy: 22,                // Guaranteed to appear by wave 22 if not yet
  },
  
  // Legacy field (minimum possible)
  availableFromWave: 14,
  
  // Base spawn chance when available
  baseSpawnChance: 0.08,  // 8% chance to replace applicable enemies
  
  // Chance scaling after first appearance
  spawnChanceScaling: {
    perWaveAfterFirst: 0.01,   // +1% per wave after first appearance
    maxChance: 0.18,           // Cap at 18%
  },
  
  // Which base types can become phasing
  applicableTo: ['scout', 'minion'],  // Fast/agile enemies
  
  // Stat modifiers
  stats: {
    healthMultiplier: 0.75,    // 25% less HP (balanced by invulnerability)
    speedMultiplier: 1.1,      // 10% faster
    rewardMultiplier: 1.8,     // 80% more reward
    sizeMultiplier: 0.95,      // Slightly smaller
  },
  
  // Phasing config
  phasing: {
    // Duration of invulnerable (phased) state
    phasedDuration: 1.5,       // 1.5 seconds invulnerable
    
    // Duration of vulnerable (solid) state
    solidDuration: 3.0,        // 3 seconds vulnerable
    
    // Initial state - start solid so players can damage immediately
    startsPhased: false,
    
    // Can status effects (DoT) damage during phased state?
    dotDamageWhilePhased: true,   // DoT still works
    
    // Does phasing pause while enemy has certain effects?
    pausePhaseWhile: ['frozen', 'stunned'],
    
    // Damage reduction while phasing IN/OUT (transition)
    transitionDamageReduction: 0.5,  // 50% reduction during transition
    transitionDuration: 0.3,         // 0.3 seconds to phase in/out
  },
  
  // Combat interactions
  combat: {
    // All attack types work during solid phase
    vulnerableTo: ['normal', 'siege', 'magic', 'piercing'],
    
    // No attack can hit during phased state (except DoT)
    immuneWhilePhased: true,
    
    // Damage modifiers
    damageModifiers: {
      normal: 1.0,
      siege: 1.0,
      magic: 1.0,
      piercing: 1.0,
    },
  },
  
  // Visual properties
  visual: {
    // Phased state appearance
    phasedAlpha: 0.3,          // Very transparent when phased
    solidAlpha: 1.0,           // Fully visible when solid
    
    // Ghost effect
    ghostEffect: {
      enabled: true,
      color: '#88ccff',        // Light blue ghost
      glowRadius: 1.2,         // Glow around enemy
    },
    
    // Transition effect
    transitionEffect: {
      enabled: true,
      particleColor: '#aaddff',
      particleCount: 8,
    },
    
    // Phase indicator
    phaseIndicator: {
      enabled: true,
      solidColor: '#ffffff',
      phasedColor: '#88ccff',
      position: 'below',       // Below enemy
    },
  },
  
  // Status effect interactions
  statusEffects: {
    // DoT effects continue during phased
    burnContinues: true,
    poisonContinues: true,
    bleedContinues: true,
    
    // Slow/freeze effects pause phasing timer
    slowPausesPhase: false,
    freezePausesPhase: true,
  },
  
  // Description for UI
  description: 'Periodically becomes intangible. DoT effects continue during phase.',
};

/**
 * Check if enemy is phasing type
 * @param {Object} enemy - Enemy instance
 * @returns {boolean}
 */
function isPhasing(enemy) {
  return enemy.isPhasing === true || enemy.specialType === 'phasing';
}

/**
 * Check if enemy is currently in phased (invulnerable) state
 * @param {Object} enemy - Enemy instance
 * @returns {boolean}
 */
function isCurrentlyPhased(enemy) {
  if (!isPhasing(enemy)) return false;
  return enemy.phasingState === 'phased' || enemy.phasingState === 'phasing_in';
}

/**
 * Check if enemy is in transition (phasing in/out)
 * @param {Object} enemy - Enemy instance
 * @returns {boolean}
 */
function isInTransition(enemy) {
  if (!isPhasing(enemy)) return false;
  return enemy.phasingState === 'phasing_in' || enemy.phasingState === 'phasing_out';
}

/**
 * Initialize phasing state for enemy
 * @param {Object} enemy - Enemy instance
 * @returns {Object} Enemy with phasing state
 */
function initPhasingState(enemy) {
  if (!isPhasing(enemy)) return enemy;
  
  const config = PHASING.phasing;
  
  enemy.phasingState = config.startsPhased ? 'phased' : 'solid';
  enemy.phasingTimer = config.startsPhased ? config.phasedDuration : config.solidDuration;
  enemy.phasingAlpha = config.startsPhased ? PHASING.visual.phasedAlpha : PHASING.visual.solidAlpha;
  
  return enemy;
}

/**
 * Update phasing state (call each tick)
 * @param {Object} enemy - Enemy instance
 * @param {number} deltaTime - Time since last update (ms)
 * @returns {Object} Updated enemy
 */
function updatePhasingState(enemy, deltaTime) {
  if (!isPhasing(enemy)) return enemy;
  
  const config = PHASING.phasing;
  const deltaSeconds = deltaTime / 1000;
  
  // Check if phasing should be paused
  const isPaused = config.pausePhaseWhile.some(effect => 
    enemy.statusEffects?.some(e => e.type === effect)
  );
  
  if (isPaused) return enemy;
  
  // Update timer
  enemy.phasingTimer -= deltaSeconds;
  
  if (enemy.phasingTimer <= 0) {
    // Transition to next state
    switch (enemy.phasingState) {
      case 'solid':
        enemy.phasingState = 'phasing_out';
        enemy.phasingTimer = config.transitionDuration;
        break;
      case 'phasing_out':
        enemy.phasingState = 'phased';
        enemy.phasingTimer = config.phasedDuration;
        enemy.phasingAlpha = PHASING.visual.phasedAlpha;
        break;
      case 'phased':
        enemy.phasingState = 'phasing_in';
        enemy.phasingTimer = config.transitionDuration;
        break;
      case 'phasing_in':
        enemy.phasingState = 'solid';
        enemy.phasingTimer = config.solidDuration;
        enemy.phasingAlpha = PHASING.visual.solidAlpha;
        break;
    }
  }
  
  // Update alpha during transitions
  if (enemy.phasingState === 'phasing_out') {
    const progress = 1 - (enemy.phasingTimer / config.transitionDuration);
    enemy.phasingAlpha = PHASING.visual.solidAlpha - 
      (PHASING.visual.solidAlpha - PHASING.visual.phasedAlpha) * progress;
  } else if (enemy.phasingState === 'phasing_in') {
    const progress = 1 - (enemy.phasingTimer / config.transitionDuration);
    enemy.phasingAlpha = PHASING.visual.phasedAlpha + 
      (PHASING.visual.solidAlpha - PHASING.visual.phasedAlpha) * progress;
  }
  
  return enemy;
}

/**
 * Calculate damage against phasing enemy
 * @param {number} baseDamage - Original damage
 * @param {Object} enemy - Enemy instance
 * @param {boolean} isDot - Is this DoT damage?
 * @returns {Object} { damage, blocked, reason }
 */
function calculatePhasingDamage(baseDamage, enemy, isDot = false) {
  if (!isPhasing(enemy)) {
    return { damage: baseDamage, blocked: false, reason: null };
  }
  
  const config = PHASING.phasing;
  
  // DoT damage goes through during phased state
  if (isDot && config.dotDamageWhilePhased) {
    return { damage: baseDamage, blocked: false, reason: null };
  }
  
  // During phased state - immune to direct damage
  if (enemy.phasingState === 'phased') {
    return { damage: 0, blocked: true, reason: 'phased' };
  }
  
  // During transition - reduced damage
  if (isInTransition(enemy)) {
    const reducedDamage = Math.round(baseDamage * (1 - config.transitionDamageReduction));
    return { damage: reducedDamage, blocked: false, reason: 'transitioning' };
  }
  
  // Solid state - full damage
  return { damage: baseDamage, blocked: false, reason: null };
}

/**
 * Apply phasing modifier to base enemy
 * @param {Object} baseEnemy - Base enemy config
 * @returns {Object} Modified enemy with phasing properties
 */
function applyPhasingModifier(baseEnemy) {
  const stats = PHASING.stats;
  const visual = PHASING.visual;
  const config = PHASING.phasing;
  
  const enemy = {
    ...baseEnemy,
    
    // Modified stats
    health: Math.round((baseEnemy.health || baseEnemy.baseHealth) * stats.healthMultiplier),
    maxHealth: Math.round((baseEnemy.maxHealth || baseEnemy.health || baseEnemy.baseHealth) * stats.healthMultiplier),
    speed: (baseEnemy.speed || baseEnemy.baseSpeed) * stats.speedMultiplier,
    reward: Math.round((baseEnemy.reward) * stats.rewardMultiplier),
    size: (baseEnemy.size || 10) * stats.sizeMultiplier,
    
    // Special type flags
    isPhasing: true,
    specialType: 'phasing',
    
    // Phasing state
    phasingState: config.startsPhased ? 'phased' : 'solid',
    phasingTimer: config.startsPhased ? config.phasedDuration : config.solidDuration,
    phasingAlpha: config.startsPhased ? visual.phasedAlpha : visual.solidAlpha,
    
    // Visual properties
    ghostEffect: visual.ghostEffect,
    phaseIndicator: visual.phaseIndicator,
    
    // Display name update
    displayName: `${PHASING.emoji} ${baseEnemy.displayName || baseEnemy.name}`,
  };
  
  return enemy;
}

module.exports = {
  PHASING,
  isPhasing,
  isCurrentlyPhased,
  isInTransition,
  initPhasingState,
  updatePhasingState,
  calculatePhasingDamage,
  applyPhasingModifier,
};

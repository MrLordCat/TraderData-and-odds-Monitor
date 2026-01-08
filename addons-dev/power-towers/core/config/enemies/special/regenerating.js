/**
 * Power Towers TD - Regenerating Enemy Modifier
 * 
 * Regenerating enemies heal over time.
 * Counter strategies:
 * - Burst damage (kill before they heal)
 * - Bleed effects (damage over time counters regen)
 * - Focus fire (concentrate damage)
 */

const REGENERATING = {
  id: 'regenerating',
  name: 'Regenerating',
  emoji: '🩹',
  prefix: '🩹',
  
  // Wave availability - randomized first appearance
  availability: {
    firstAppearanceRange: [15, 22],  // First appears between waves 15-22
    guaranteedBy: 24,                // Guaranteed to appear by wave 24 if not yet
  },
  
  // Legacy field (minimum possible)
  availableFromWave: 15,
  
  // Base spawn chance when available
  baseSpawnChance: 0.10,  // 10% chance to replace applicable enemies
  
  // Chance scaling after first appearance
  spawnChanceScaling: {
    perWaveAfterFirst: 0.012,  // +1.2% per wave after first appearance
    maxChance: 0.22,           // Cap at 22%
  },
  
  // Which base types can become regenerating
  applicableTo: ['minion', 'brute', 'scout'],
  
  // Stat modifiers
  stats: {
    healthMultiplier: 0.9,     // 10% less base HP (balanced by regen)
    speedMultiplier: 0.95,     // 5% slower
    rewardMultiplier: 1.7,     // 70% more reward
    sizeMultiplier: 1.0,       // Same size
  },
  
  // Regeneration config
  regeneration: {
    // Base regen rate (percentage of max HP per second)
    baseRegenPercent: 0.03,    // 3% HP/sec
    
    // Flat regen (added on top of percentage)
    flatRegenPerSecond: 2,     // +2 HP/sec
    
    // Regen scaling with wave
    regenScalePerWave: 0.001,  // +0.1% per wave after unlock
    
    // Maximum regen cap (percentage of max HP)
    maxRegenPercent: 0.08,     // Cap at 8% HP/sec
    
    // Regen is paused while taking damage
    regenPauseOnDamage: 1.0,   // 1 second pause after damage
    
    // Bleed effect reduces regen
    bleedRegenReduction: 0.5,  // -50% regen while bleeding
  },
  
  // Combat interactions
  combat: {
    // All attack types work normally
    vulnerableTo: ['normal', 'siege', 'magic', 'piercing'],
    
    // Damage modifiers
    damageModifiers: {
      normal: 1.0,
      siege: 1.0,
      magic: 1.0,
      piercing: 1.0,
      
      // Bleed does extra damage to regenerating enemies
      bleed: 1.3,  // 30% extra bleed damage
    },
    
    // Effects that counter regen
    counters: ['bleed', 'burn'],
  },
  
  // Visual properties
  visual: {
    // Healing glow
    glow: {
      enabled: true,
      color: '#44ff44',        // Green glow
      innerColor: '#88ff88',
      pulseSpeed: 0.003,
      pulseOnHeal: true,       // Extra pulse when healing
    },
    
    // Healing particles
    particles: {
      enabled: true,
      color: '#66ff66',
      type: 'rising',          // Float upward
      count: 3,
      speed: 0.8,
      interval: 500,           // ms between particle bursts
    },
    
    // Health bar effect
    healthBar: {
      regenIndicator: true,    // Show regen tick on health bar
      indicatorColor: '#00ff00',
    },
  },
  
  // Status effect interactions
  statusEffects: {
    // DoT effects are more effective
    burnDamageMultiplier: 1.0,
    poisonDamageMultiplier: 1.0,
    bleedDamageMultiplier: 1.3,  // Extra bleed damage
  },
  
  // Description for UI
  description: 'Regenerates 3% HP per second. Bleed effects reduce regeneration.',
};

/**
 * Check if enemy is regenerating type
 * @param {Object} enemy - Enemy instance
 * @returns {boolean}
 */
function isRegenerating(enemy) {
  return enemy.isRegenerating === true || enemy.specialType === 'regenerating';
}

/**
 * Calculate regen amount for this tick
 * @param {Object} enemy - Enemy instance
 * @param {number} deltaTime - Time since last update (ms)
 * @param {number} wave - Current wave number
 * @returns {number} HP to regenerate
 */
function calculateRegenAmount(enemy, deltaTime, wave) {
  if (!isRegenerating(enemy)) return 0;
  
  const config = REGENERATING.regeneration;
  
  // Check if regen is paused (recently took damage)
  if (enemy.lastDamageTime) {
    const timeSinceDamage = Date.now() - enemy.lastDamageTime;
    if (timeSinceDamage < config.regenPauseOnDamage * 1000) {
      return 0;
    }
  }
  
  // Calculate base regen rate
  let regenPercent = config.baseRegenPercent;
  
  // Add wave scaling
  const waveBonus = Math.max(0, wave - REGENERATING.availableFromWave) * config.regenScalePerWave;
  regenPercent = Math.min(config.maxRegenPercent, regenPercent + waveBonus);
  
  // Calculate regen amount
  const maxHealth = enemy.maxHealth || enemy.health;
  let regenAmount = (maxHealth * regenPercent + config.flatRegenPerSecond) * (deltaTime / 1000);
  
  // Check for bleed effect reducing regen
  const hasBleed = enemy.statusEffects?.some(e => e.type === 'bleed');
  if (hasBleed) {
    regenAmount *= (1 - config.bleedRegenReduction);
  }
  
  // Don't overheal
  const currentHealth = enemy.health || enemy.currentHealth;
  return Math.min(regenAmount, maxHealth - currentHealth);
}

/**
 * Apply regeneration to enemy (call each tick)
 * @param {Object} enemy - Enemy instance
 * @param {number} deltaTime - Time since last update (ms)
 * @param {number} wave - Current wave number
 * @returns {Object} Updated enemy
 */
function applyRegeneration(enemy, deltaTime, wave) {
  if (!isRegenerating(enemy)) return enemy;
  
  const regenAmount = calculateRegenAmount(enemy, deltaTime, wave);
  
  if (regenAmount > 0) {
    enemy.health = Math.min(enemy.maxHealth, enemy.health + regenAmount);
    enemy.lastRegenTime = Date.now();
    enemy.lastRegenAmount = regenAmount;
  }
  
  return enemy;
}

/**
 * Apply regenerating modifier to base enemy
 * @param {Object} baseEnemy - Base enemy config
 * @returns {Object} Modified enemy with regenerating properties
 */
function applyRegeneratingModifier(baseEnemy) {
  const stats = REGENERATING.stats;
  const visual = REGENERATING.visual;
  
  return {
    ...baseEnemy,
    
    // Modified stats
    health: Math.round((baseEnemy.health || baseEnemy.baseHealth) * stats.healthMultiplier),
    maxHealth: Math.round((baseEnemy.maxHealth || baseEnemy.health || baseEnemy.baseHealth) * stats.healthMultiplier),
    speed: (baseEnemy.speed || baseEnemy.baseSpeed) * stats.speedMultiplier,
    reward: Math.round((baseEnemy.reward) * stats.rewardMultiplier),
    size: (baseEnemy.size || 10) * stats.sizeMultiplier,
    
    // Special type flags
    isRegenerating: true,
    specialType: 'regenerating',
    
    // Regen tracking
    lastDamageTime: null,
    lastRegenTime: null,
    lastRegenAmount: 0,
    
    // Visual properties
    regenGlow: visual.glow,
    regenParticles: visual.particles,
    
    // Display name update
    displayName: `${REGENERATING.emoji} ${baseEnemy.displayName || baseEnemy.name}`,
  };
}

module.exports = {
  REGENERATING,
  isRegenerating,
  calculateRegenAmount,
  applyRegeneration,
  applyRegeneratingModifier,
};

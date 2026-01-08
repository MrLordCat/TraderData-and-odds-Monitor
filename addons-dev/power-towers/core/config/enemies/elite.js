/**
 * Power Towers TD - Elite Enemy Modifiers
 * 
 * Elite enemies are enhanced versions of any base/special enemy
 * They have increased stats and special visual effects
 */

const ELITE_CONFIG = {
  // Chance scaling
  baseChance: 0.01,          // 1% base chance
  chancePerWave: 0.005,      // +0.5% per wave
  maxChance: 0.15,           // Cap at 15%
  
  // Stat modifiers
  modifiers: {
    hpMultiplier: 2.0,       // ×2 HP
    speedMultiplier: 1.1,    // ×1.1 speed (slightly faster)
    rewardMultiplier: 2.5,   // ×2.5 gold reward
    xpMultiplier: 3.0,       // ×3 XP
  },
  
  // Visual
  visual: {
    glowColor: '#ffd700',    // Gold glow
    sizeMultiplier: 1.2,     // 20% larger
    particleEffect: 'stars', // Star particles
  },
  
  // Name prefix
  prefix: '⭐',
  nameSuffix: ' Elite',
};

/**
 * Calculate elite chance for a given wave
 * @param {number} wave - Wave number
 * @returns {number} Elite chance (0-1)
 */
function getEliteChance(wave) {
  const { baseChance, chancePerWave, maxChance } = ELITE_CONFIG;
  return Math.min(maxChance, baseChance + wave * chancePerWave);
}

/**
 * Roll for elite status
 * @param {number} wave - Wave number
 * @returns {boolean} True if should be elite
 */
function rollForElite(wave) {
  return Math.random() < getEliteChance(wave);
}

/**
 * Apply elite modifiers to enemy stats
 * @param {Object} enemy - Enemy object with base stats
 * @returns {Object} Modified enemy stats
 */
function applyEliteModifiers(enemy) {
  const { modifiers, visual, prefix, nameSuffix } = ELITE_CONFIG;
  
  return {
    ...enemy,
    isElite: true,
    
    // Stats
    maxHp: Math.round(enemy.maxHp * modifiers.hpMultiplier),
    hp: Math.round(enemy.maxHp * modifiers.hpMultiplier),
    baseSpeed: enemy.baseSpeed * modifiers.speedMultiplier,
    speed: enemy.speed * modifiers.speedMultiplier,
    reward: Math.round(enemy.reward * modifiers.rewardMultiplier),
    xp: Math.round(enemy.xp * modifiers.xpMultiplier),
    
    // Visual
    size: enemy.size * visual.sizeMultiplier,
    eliteGlow: visual.glowColor,
    eliteParticles: visual.particleEffect,
    
    // Name
    displayName: `${prefix} ${enemy.displayName || enemy.name}${nameSuffix}`,
  };
}

/**
 * Get elite info for UI display
 * @param {number} wave - Current wave
 * @returns {Object} Elite info
 */
function getEliteInfo(wave) {
  return {
    chance: getEliteChance(wave),
    chancePercent: Math.round(getEliteChance(wave) * 100),
    modifiers: ELITE_CONFIG.modifiers,
  };
}

module.exports = {
  ELITE_CONFIG,
  getEliteChance,
  rollForElite,
  applyEliteModifiers,
  getEliteInfo,
};

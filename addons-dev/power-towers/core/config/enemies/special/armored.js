/**
 * Power Towers TD - Armored Enemy Modifier
 * 
 * Armored enemies have damage resistance against physical attacks.
 * - 50% resistance to Normal attacks
 * - 25% resistance to Piercing attacks
 * - No resistance to Magic attacks
 * - Siege attacks can shred their armor
 */

const ARMORED = {
  id: 'armored',
  name: 'Armored',
  emoji: '🛡️',
  prefix: '🛡️',
  
  // Wave availability - randomized first appearance
  availability: {
    firstAppearanceRange: [8, 14],   // First appears between waves 8-14
    guaranteedBy: 16,                // Guaranteed to appear by wave 16 if not yet
  },
  
  // Legacy field (minimum possible)
  availableFromWave: 8,
  
  // Base spawn chance when available
  baseSpawnChance: 0.12,  // 12% chance to replace brute/minion
  
  // Chance scaling after first appearance
  spawnChanceScaling: {
    perWaveAfterFirst: 0.015,  // +1.5% per wave after first appearance
    maxChance: 0.25,           // Cap at 25%
  },
  
  // Which base types can become armored
  applicableTo: ['brute', 'minion'],  // Tanky or standard enemies
  
  // Stat modifiers
  stats: {
    healthMultiplier: 1.3,      // 30% more HP
    speedMultiplier: 0.85,      // 15% slower (heavy armor)
    rewardMultiplier: 1.75,     // 75% more reward
    sizeMultiplier: 1.15,       // Slightly larger
  },
  
  // Armor system
  armor: {
    baseArmor: 50,              // Base armor value (50% physical damage reduction)
    maxArmor: 50,               // Max armor (for UI display)
    
    // Damage type resistances (multiplier on incoming damage)
    resistances: {
      normal: 0.5,              // 50% damage from Normal
      piercing: 0.75,           // 25% damage reduction vs Piercing (armor pen helps)
      siege: 1.0,               // Full damage from Siege
      magic: 1.0,               // Full damage from Magic (ignores armor)
    },
    
    // Armor shred interaction
    shredEffectiveness: 1.0,    // Full effectiveness of armor shred
    
    // Minimum armor after shred
    minArmor: 10,               // Can't go below 10% resistance
  },
  
  // Visual properties
  visual: {
    // Metallic appearance
    metallic: {
      enabled: true,
      baseColor: '#6a6a6a',     // Steel gray
      highlightColor: '#a0a0a0', // Bright steel
      rimColor: '#404040',       // Dark edge
    },
    
    // Shield icon overlay
    shieldIcon: {
      enabled: true,
      size: 0.5,                // Relative to enemy size
      position: 'front',        // In front of enemy
    },
    
    // Armor plates visual
    plates: {
      enabled: true,
      count: 4,                 // Number of visible armor plates
      size: 0.3,                // Relative to enemy size
    },
    
    // When armor is shredded
    damaged: {
      showCracks: true,
      crackColor: '#8b0000',    // Dark red cracks
      sparkOnHit: true,         // Sparks when hit
    },
  },
  
  // Description for UI
  description: 'Armored enemy. 50% physical damage resistance. Magic and Siege effective.',
  shortDescription: 'High physical damage resistance',
};

/**
 * Apply armored modifier to base enemy
 * @param {Object} baseEnemy - Base enemy stats
 * @returns {Object} Modified enemy with armored properties
 */
function applyArmoredModifier(baseEnemy) {
  const { stats, armor, visual } = ARMORED;
  
  return {
    ...baseEnemy,
    
    // Mark as armored
    isArmored: true,
    specialType: 'armored',
    
    // Apply stat modifiers
    baseHealth: Math.round(baseEnemy.baseHealth * stats.healthMultiplier),
    health: Math.round((baseEnemy.health || baseEnemy.baseHealth) * stats.healthMultiplier),
    maxHealth: Math.round((baseEnemy.maxHealth || baseEnemy.baseHealth) * stats.healthMultiplier),
    baseSpeed: Math.round(baseEnemy.baseSpeed * stats.speedMultiplier),
    speed: Math.round((baseEnemy.speed || baseEnemy.baseSpeed) * stats.speedMultiplier),
    reward: Math.round(baseEnemy.reward * stats.rewardMultiplier),
    size: (baseEnemy.size || 10) * stats.sizeMultiplier,
    
    // Armor stats
    armor: armor.baseArmor,
    maxArmor: armor.maxArmor,
    armorResistances: armor.resistances,
    minArmor: armor.minArmor,
    currentArmorShred: 0,       // Tracks total shred applied
    
    // Visual properties
    metallic: visual.metallic,
    hasShieldIcon: visual.shieldIcon.enabled,
    hasArmorPlates: visual.plates.enabled,
    armorPlateCount: visual.plates.count,
    
    // Update display name
    displayName: `${ARMORED.emoji} ${baseEnemy.displayName || baseEnemy.name}`,
    emoji: ARMORED.emoji,
  };
}

/**
 * Calculate damage after armor reduction
 * @param {number} baseDamage - Incoming damage
 * @param {Object} enemy - Armored enemy
 * @param {Object} tower - Attacking tower
 * @returns {Object} { finalDamage, wasReduced, reductionPercent }
 */
function calculateArmoredDamage(baseDamage, enemy, tower) {
  if (!enemy.isArmored) {
    return { finalDamage: baseDamage, wasReduced: false, reductionPercent: 0 };
  }
  
  const attackType = tower.attackTypeId || 'normal';
  const resistances = enemy.armorResistances || ARMORED.armor.resistances;
  
  // Get base resistance for attack type
  let resistance = resistances[attackType] || 1.0;
  
  // Apply armor shred reduction if enemy has been shredded
  if (enemy.currentArmorShred > 0) {
    // Each shred point reduces armor effectiveness
    const shredReduction = enemy.currentArmorShred * 0.1; // 10% per shred stack
    const currentArmor = Math.max(enemy.minArmor || 10, enemy.armor - enemy.currentArmorShred * 10);
    
    // Recalculate resistance based on current armor
    const armorEffectiveness = currentArmor / enemy.maxArmor;
    resistance = 1 - ((1 - resistance) * armorEffectiveness);
  }
  
  // Magic ignores armor completely
  if (attackType === 'magic') {
    resistance = 1.0;
  }
  
  // Piercing has innate armor penetration
  if (attackType === 'piercing' && tower.armorPenetration) {
    resistance = Math.min(1.0, resistance + tower.armorPenetration * 0.01);
  }
  
  const finalDamage = Math.round(baseDamage * resistance);
  const reductionPercent = Math.round((1 - resistance) * 100);
  
  return {
    finalDamage,
    wasReduced: resistance < 1.0,
    reductionPercent,
    originalDamage: baseDamage,
  };
}

/**
 * Apply armor shred to enemy
 * @param {Object} enemy - Armored enemy
 * @param {number} shredAmount - Amount of armor to shred
 * @returns {Object} Updated armor stats
 */
function applyArmorShred(enemy, shredAmount) {
  if (!enemy.isArmored) return enemy;
  
  const newShred = (enemy.currentArmorShred || 0) + shredAmount;
  const maxShred = enemy.maxArmor - enemy.minArmor;
  
  enemy.currentArmorShred = Math.min(newShred, maxShred / 10); // Cap at max shred stacks
  enemy.armor = Math.max(enemy.minArmor, enemy.maxArmor - enemy.currentArmorShred * 10);
  
  return {
    currentArmor: enemy.armor,
    shredStacks: enemy.currentArmorShred,
    isFullyShredded: enemy.armor <= enemy.minArmor,
  };
}

/**
 * Get armor display info for UI
 * @param {Object} enemy - Armored enemy
 * @returns {Object} Display info
 */
function getArmorDisplayInfo(enemy) {
  if (!enemy.isArmored) {
    return { hasArmor: false };
  }
  
  const currentArmor = enemy.armor || ARMORED.armor.baseArmor;
  const maxArmor = enemy.maxArmor || ARMORED.armor.maxArmor;
  const shredStacks = enemy.currentArmorShred || 0;
  
  return {
    hasArmor: true,
    current: currentArmor,
    max: maxArmor,
    percent: Math.round((currentArmor / maxArmor) * 100),
    shredStacks,
    isShredded: shredStacks > 0,
  };
}

module.exports = {
  ARMORED,
  applyArmoredModifier,
  calculateArmoredDamage,
  applyArmorShred,
  getArmorDisplayInfo,
};

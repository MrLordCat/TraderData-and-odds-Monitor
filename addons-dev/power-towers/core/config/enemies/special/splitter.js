/**
 * Power Towers TD - Splitter Enemy Modifier
 * 
 * Splitter enemies split into smaller copies on death.
 * Counter strategies:
 * - AoE damage (Siege) to kill splits quickly
 * - High damage to prevent splits entirely (massive overkill)
 * - Magic attacks (spawned splits inherit parent element weakness)
 */

const SPLITTER = {
  id: 'splitter',
  name: 'Splitter',
  emoji: '👥',
  prefix: '👥',
  
  // Wave availability - randomized first appearance
  availability: {
    firstAppearanceRange: [24, 32],  // First appears between waves 24-32
    guaranteedBy: 34,                // Guaranteed to appear by wave 34 if not yet
  },
  
  // Legacy field (minimum possible)
  availableFromWave: 24,
  
  // Base spawn chance when available
  baseSpawnChance: 0.06,  // 6% chance to replace applicable enemies
  
  // Chance scaling after first appearance
  spawnChanceScaling: {
    perWaveAfterFirst: 0.008,  // +0.8% per wave after first appearance
    maxChance: 0.14,           // Cap at 14%
  },
  
  // Which base types can become splitter
  applicableTo: ['minion', 'swarmling'],  // Enemies that can split into swarms
  
  // Stat modifiers (for parent)
  stats: {
    healthMultiplier: 1.2,     // 20% more HP (harder to prevent split)
    speedMultiplier: 0.9,      // 10% slower
    rewardMultiplier: 0.5,     // 50% reward (rest from children)
    sizeMultiplier: 1.3,       // 30% larger (visually shows will split)
  },
  
  // Split config
  split: {
    // Number of children spawned on death
    baseChildCount: 2,
    
    // Can scale with wave
    childCountScaling: {
      enabled: true,
      additionalPerWaves: 10,   // +1 child every 10 waves after first appearance
      maxChildren: 4,           // Maximum 4 children
    },
    
    // Child stats (relative to parent)
    childStats: {
      healthPercent: 0.3,       // 30% of parent HP each
      speedMultiplier: 1.3,     // 30% faster than parent
      rewardPercent: 0.25,      // 25% of parent reward each
      sizeMultiplier: 0.5,      // Half size of parent
    },
    
    // Overkill damage can prevent splitting
    overkillPrevents: true,
    overkillThreshold: 2.0,    // Need 200% of remaining HP to prevent split
    
    // Spawn pattern
    spawnPattern: 'circle',     // 'circle', 'line', 'random'
    spawnRadius: 30,            // Pixels from parent position
    spawnDelay: 100,            // ms between each child spawn
    
    // Children don't inherit splitter trait
    childrenCanSplit: false,
  },
  
  // Combat interactions
  combat: {
    // All attack types work normally
    vulnerableTo: ['normal', 'siege', 'magic', 'piercing'],
    
    // AoE is good against splits
    siegeBonus: 1.0,            // Normal damage (but good vs children)
    
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
    // Pulsing effect (shows will split)
    pulseEffect: {
      enabled: true,
      color: '#ffaa00',        // Orange glow
      minScale: 0.95,
      maxScale: 1.1,
      frequency: 0.003,        // Pulse speed
    },
    
    // Split indicator
    splitIndicator: {
      enabled: true,
      color: '#ffcc00',
      emoji: '×2',             // Shows split count
      position: 'above',
    },
    
    // Death/split effect
    splitEffect: {
      enabled: true,
      color: '#ffdd44',
      particleCount: 16,
      duration: 400,           // ms
    },
    
    // Children have slightly different color
    childTint: {
      r: 1.1,
      g: 1.0,
      b: 0.9,                  // Slightly yellowish
    },
  },
  
  // Description for UI
  description: 'Splits into 2-4 smaller copies on death. Massive overkill prevents splitting.',
};

/**
 * Check if enemy is splitter type
 * @param {Object} enemy - Enemy instance
 * @returns {boolean}
 */
function isSplitter(enemy) {
  return enemy.isSplitter === true || enemy.specialType === 'splitter';
}

/**
 * Check if enemy is a split child (doesn't split again)
 * @param {Object} enemy - Enemy instance
 * @returns {boolean}
 */
function isSplitChild(enemy) {
  return enemy.isSplitChild === true;
}

/**
 * Calculate number of children to spawn
 * @param {number} wave - Current wave number
 * @returns {number} Number of children
 */
function getChildCount(wave) {
  const config = SPLITTER.split;
  let count = config.baseChildCount;
  
  if (config.childCountScaling.enabled) {
    const wavesAfterUnlock = Math.max(0, wave - SPLITTER.availableFromWave);
    const extraChildren = Math.floor(wavesAfterUnlock / config.childCountScaling.additionalPerWaves);
    count += extraChildren;
  }
  
  return Math.min(count, config.childCountScaling.maxChildren);
}

/**
 * Check if overkill prevents splitting
 * @param {Object} enemy - Enemy instance
 * @param {number} overkillDamage - Damage beyond 0 HP
 * @returns {boolean}
 */
function shouldPreventSplit(enemy, overkillDamage) {
  if (!SPLITTER.split.overkillPrevents) return false;
  
  const maxHealth = enemy.maxHealth;
  const threshold = maxHealth * SPLITTER.split.overkillThreshold;
  
  return overkillDamage >= threshold;
}

/**
 * Create child enemy data
 * @param {Object} parent - Parent enemy that died
 * @param {number} index - Child index (for positioning)
 * @param {number} totalChildren - Total number of children
 * @returns {Object} Child enemy data
 */
function createSplitChild(parent, index, totalChildren) {
  const config = SPLITTER.split;
  const childStats = config.childStats;
  
  // Calculate spawn position
  let offsetX = 0, offsetY = 0;
  
  if (config.spawnPattern === 'circle') {
    const angle = (2 * Math.PI * index) / totalChildren;
    offsetX = Math.cos(angle) * config.spawnRadius;
    offsetY = Math.sin(angle) * config.spawnRadius;
  } else if (config.spawnPattern === 'line') {
    const spacing = config.spawnRadius * 2 / (totalChildren - 1 || 1);
    offsetX = -config.spawnRadius + spacing * index;
    offsetY = 0;
  } else {
    // Random
    offsetX = (Math.random() - 0.5) * config.spawnRadius * 2;
    offsetY = (Math.random() - 0.5) * config.spawnRadius * 2;
  }
  
  const childHealth = Math.round(parent.maxHealth * childStats.healthPercent);
  
  return {
    // Base type from parent
    type: parent.type,
    baseType: parent.type,
    
    // Position
    x: parent.x + offsetX,
    y: parent.y + offsetY,
    
    // Stats
    health: childHealth,
    maxHealth: childHealth,
    speed: parent.speed * childStats.speedMultiplier,
    baseSpeed: parent.baseSpeed * childStats.speedMultiplier,
    reward: Math.round(parent.reward * childStats.rewardPercent),
    xp: Math.round((parent.xp || 1) * childStats.rewardPercent),
    size: parent.size * childStats.sizeMultiplier,
    
    // Path - inherit from parent
    waypointIndex: parent.waypointIndex,
    pathProgress: parent.pathProgress,
    
    // Visual
    emoji: parent.emoji,
    color: parent.color,
    displayName: `${parent.displayName} (split)`,
    
    // Flags
    isSplitChild: true,
    isSplitter: false,        // Children don't split again
    specialType: null,
    
    // Inherit wave/auras
    wave: parent.wave,
    auras: parent.auras || [],
    
    // Status effects - don't inherit
    statusEffects: [],
    slowMultiplier: 1,
    
    // Visual tint
    childTint: SPLITTER.visual.childTint,
    
    // Spawn delay for staggered appearance
    spawnDelay: index * config.spawnDelay,
  };
}

/**
 * Process splitter death - generate children data
 * @param {Object} enemy - Enemy instance that died
 * @param {number} overkillDamage - Damage beyond 0 HP
 * @param {number} wave - Current wave number
 * @returns {Object} { shouldSplit, children, prevented }
 */
function processSplitterDeath(enemy, overkillDamage = 0, wave = 1) {
  if (!isSplitter(enemy)) {
    return { shouldSplit: false, children: [] };
  }
  
  // Children don't split
  if (isSplitChild(enemy)) {
    return { shouldSplit: false, children: [] };
  }
  
  // Check if overkill prevents split
  if (shouldPreventSplit(enemy, overkillDamage)) {
    return { shouldSplit: false, children: [], prevented: true, reason: 'overkill' };
  }
  
  // Generate children
  const childCount = getChildCount(wave);
  const children = [];
  
  for (let i = 0; i < childCount; i++) {
    children.push(createSplitChild(enemy, i, childCount));
  }
  
  return {
    shouldSplit: true,
    children,
    childCount,
  };
}

/**
 * Apply splitter modifier to base enemy
 * @param {Object} baseEnemy - Base enemy config
 * @returns {Object} Modified enemy with splitter properties
 */
function applySplitterModifier(baseEnemy) {
  const stats = SPLITTER.stats;
  const visual = SPLITTER.visual;
  
  return {
    ...baseEnemy,
    
    // Modified stats
    health: Math.round((baseEnemy.health || baseEnemy.baseHealth) * stats.healthMultiplier),
    maxHealth: Math.round((baseEnemy.maxHealth || baseEnemy.health || baseEnemy.baseHealth) * stats.healthMultiplier),
    speed: (baseEnemy.speed || baseEnemy.baseSpeed) * stats.speedMultiplier,
    reward: Math.round((baseEnemy.reward) * stats.rewardMultiplier),
    size: (baseEnemy.size || 10) * stats.sizeMultiplier,
    
    // Special type flags
    isSplitter: true,
    isSplitChild: false,
    specialType: 'splitter',
    
    // Visual properties
    pulseEffect: visual.pulseEffect,
    splitIndicator: visual.splitIndicator,
    
    // Display name update
    displayName: `${SPLITTER.emoji} ${baseEnemy.displayName || baseEnemy.name}`,
  };
}

module.exports = {
  SPLITTER,
  isSplitter,
  isSplitChild,
  getChildCount,
  shouldPreventSplit,
  createSplitChild,
  processSplitterDeath,
  applySplitterModifier,
};

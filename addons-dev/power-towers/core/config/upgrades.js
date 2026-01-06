/**
 * Power Towers TD - Upgrades Configuration
 * 
 * Centralized configuration for the upgrade system:
 * - Discount system parameters
 * - Stat upgrade definitions
 * - Cost scaling formulas
 * - Passive effects
 */

// ╔════════════════════════════════════════════════════════════════════════════╗
// ║                         DISCOUNT SYSTEM                                     ║
// ╚════════════════════════════════════════════════════════════════════════════╝

const DISCOUNT_CONFIG = {
  // Discount per stack (5% = 0.05)
  percentPerStack: 0.05,
  
  // Maximum discount (50% = 0.5)
  maxPercent: 0.50,
  
  // How discounts accumulate:
  // - On tower level up: all upgrades gain +1 stack
  // - On upgrade purchase: that upgrade's stacks reset to 0
  // - Stacks = current_tower_level - level_when_last_purchased
};

// ╔════════════════════════════════════════════════════════════════════════════╗
// ║                         COST SCALING                                        ║
// ╚════════════════════════════════════════════════════════════════════════════╝

const COST_CONFIG = {
  // Default scale factor for upgrade costs (cost * scaleFactor^level)
  defaultScaleFactor: 1.15,
  
  // Minimum cost for any upgrade
  minCost: 5,
};

// ╔════════════════════════════════════════════════════════════════════════════╗
// ║                         STAT UPGRADES                                       ║
// ╚════════════════════════════════════════════════════════════════════════════╝

/**
 * Stat upgrade definitions
 * Each upgrade has:
 * - name, emoji, description: Display info
 * - cost: { base, scaleFactor } - base cost and scaling per level
 * - effect: { type, stat, valuePerLevel, maxValue? } - what it does
 * - requirements: { attackType?, elementPath?, minTowerLevel? } - when available
 */
const STAT_UPGRADES = {
  // === CORE COMBAT STATS ===
  damage: {
    name: 'Damage',
    emoji: '⚔️',
    description: 'Increase base damage',
    cost: { base: 20, scaleFactor: 1.15 },
    effect: {
      type: 'percentage',
      stat: 'damage',
      percentPerLevel: 0.05,  // +5% per level
    }
  },
  
  attackSpeed: {
    name: 'Attack Speed',
    emoji: '⚡',
    description: 'Increase attack speed',
    cost: { base: 25, scaleFactor: 1.18 },
    effect: {
      type: 'percentage',
      stat: 'fireRate',
      percentPerLevel: 0.04,  // +4% per level
    }
  },
  
  range: {
    name: 'Range',
    emoji: '🎯',
    description: 'Increase attack range',
    cost: { base: 18, scaleFactor: 1.12 },
    effect: {
      type: 'percentage',
      stat: 'range',
      percentPerLevel: 0.05,  // +5% per level
    }
  },
  
  // === CRITICAL STATS ===
  critChance: {
    name: 'Crit Chance',
    emoji: '🎲',
    description: 'Increase critical hit chance',
    cost: { base: 30, scaleFactor: 1.20 },
    effect: {
      type: 'additive',
      stat: 'critChance',
      valuePerLevel: 0.01,    // +1% per level
      maxValue: 0.50          // Max 50%
    }
  },
  
  critDamage: {
    name: 'Crit Damage',
    emoji: '💥',
    description: 'Increase critical damage multiplier',
    cost: { base: 35, scaleFactor: 1.22 },
    effect: {
      type: 'additive',
      stat: 'critDmgMod',
      valuePerLevel: 0.10,    // +10% (0.1x) per level
      maxValue: 3.0           // Max 3.0x
    }
  },
  
  // === ENERGY/EFFICIENCY ===
  powerEfficiency: {
    name: 'Power Efficiency',
    emoji: '🔋',
    description: 'Reduce energy cost per shot',
    cost: { base: 22, scaleFactor: 1.15 },
    effect: {
      type: 'percentage',
      stat: 'energyCost',
      percentPerLevel: -0.03, // -3% per level (reduction)
    }
  },
  
  energyStorage: {
    name: 'Energy Storage',
    emoji: '📦',
    description: 'Increase energy capacity',
    cost: { base: 28, scaleFactor: 1.18 },
    effect: {
      type: 'percentage',
      stat: 'energyStorage',
      percentPerLevel: 0.08,  // +8% per level
    },
    requirements: {
      minTowerLevel: 2
    }
  },
  
  powerScaling: {
    name: 'Power Scaling',
    emoji: '📈',
    description: 'Increase damage bonus from energy',
    cost: { base: 40, scaleFactor: 1.25 },
    effect: {
      type: 'percentage',
      stat: 'powerDamageScaling',
      percentPerLevel: 0.05,  // +5% per level
    },
    requirements: {
      minTowerLevel: 3
    }
  },
  
  // === SURVIVABILITY ===
  hp: {
    name: 'Health',
    emoji: '❤️',
    description: 'Increase tower hit points',
    cost: { base: 25, scaleFactor: 1.15 },
    effect: {
      type: 'percentage',
      stat: 'hp',
      percentPerLevel: 0.08,  // +8% per level
    }
  },
  
  hpRegen: {
    name: 'HP Regen',
    emoji: '💚',
    description: 'Regenerate HP over time',
    cost: { base: 30, scaleFactor: 1.20 },
    effect: {
      type: 'additive',
      stat: 'hpRegen',
      valuePerLevel: 1,       // +1 HP/sec per level
      maxValue: 20            // Max 20 HP/sec
    }
  },
  
  // === SPECIAL (ATTACK TYPE SPECIFIC) ===
  splashRadius: {
    name: 'Splash Radius',
    emoji: '💢',
    description: 'Increase area of effect',
    cost: { base: 35, scaleFactor: 1.20 },
    effect: {
      type: 'percentage',
      stat: 'splashRadius',
      percentPerLevel: 0.10,  // +10% per level
    },
    requirements: {
      attackType: 'siege'
    }
  },
  
  chainCount: {
    name: 'Chain Count',
    emoji: '🔗',
    description: 'Hit additional enemies',
    cost: { base: 50, scaleFactor: 1.30 },
    effect: {
      type: 'additive',
      stat: 'chainCount',
      valuePerLevel: 1,       // +1 target per level
      maxValue: 5             // Max 5 chains
    },
    requirements: {
      attackType: 'magic'
    }
  },
};

// ╔════════════════════════════════════════════════════════════════════════════╗
// ║                         PASSIVE EFFECTS                                     ║
// ╚════════════════════════════════════════════════════════════════════════════╝

const PASSIVE_EFFECTS = {
  vampiric: {
    name: 'Vampiric',
    emoji: '🧛',
    description: 'Heal on kill',
    tiers: [
      { healPercent: 0.01 },  // Tier 1: 1% of damage dealt
      { healPercent: 0.02 },  // Tier 2: 2%
      { healPercent: 0.03 },  // Tier 3: 3%
    ],
    cost: { base: 60, scaleFactor: 1.5 }
  },
  
  executioner: {
    name: 'Executioner',
    emoji: '⚰️',
    description: 'Bonus damage to low HP enemies',
    tiers: [
      { threshold: 0.20, bonusDamage: 0.15 },  // +15% to enemies <20% HP
      { threshold: 0.25, bonusDamage: 0.25 },  // +25% to enemies <25% HP
      { threshold: 0.30, bonusDamage: 0.40 },  // +40% to enemies <30% HP
    ],
    cost: { base: 50, scaleFactor: 1.4 }
  },
  
  momentum: {
    name: 'Momentum',
    emoji: '🏃',
    description: 'Attack speed increases over time',
    tiers: [
      { maxStacks: 5, atkSpdPerStack: 0.02 },   // 5 stacks, +2% each
      { maxStacks: 8, atkSpdPerStack: 0.025 },  // 8 stacks, +2.5% each
      { maxStacks: 10, atkSpdPerStack: 0.03 },  // 10 stacks, +3% each
    ],
    cost: { base: 45, scaleFactor: 1.35 }
  },
  
  overcharge: {
    name: 'Overcharge',
    emoji: '⚡',
    description: 'Store excess energy for burst damage',
    tiers: [
      { bonusDamagePerEnergy: 0.005 },  // +0.5% damage per stored energy
      { bonusDamagePerEnergy: 0.008 },  // +0.8%
      { bonusDamagePerEnergy: 0.012 },  // +1.2%
    ],
    cost: { base: 55, scaleFactor: 1.45 }
  },
};

// ╔════════════════════════════════════════════════════════════════════════════╗
// ║                         TOWER LEVEL CONFIG                                  ║
// ╚════════════════════════════════════════════════════════════════════════════╝

const TOWER_LEVEL_CONFIG = {
  // Points awarded per upgrade type (for calculating tower level)
  points: {
    statUpgrade: 1,
    abilityTier: 2,
    passiveTier: 2,
    attackType: 3,
    elementPath: 3,
    elementAbility: 1,
  },
  
  // XP curve: level = floor(sqrt(points / baseXP))
  baseXP: 2,
  xpScale: 1.0,
};

// ╔════════════════════════════════════════════════════════════════════════════╗
// ║                         HELPER FUNCTIONS                                    ║
// ╚════════════════════════════════════════════════════════════════════════════╝

/**
 * Calculate upgrade cost with discount
 * @param {Object} upgrade - Upgrade definition from STAT_UPGRADES
 * @param {number} currentLevel - Current upgrade level
 * @param {number} discountStacks - Number of discount stacks
 * @returns {number} Final cost
 */
function calculateUpgradeCost(upgrade, currentLevel, discountStacks = 0) {
  const baseCost = upgrade.cost.base;
  const scaleFactor = upgrade.cost.scaleFactor || COST_CONFIG.defaultScaleFactor;
  
  // Raw cost = base * scale^level
  const rawCost = baseCost * Math.pow(scaleFactor, currentLevel);
  
  // Apply discount (5% per stack, max 50%)
  const discountPercent = Math.min(
    DISCOUNT_CONFIG.maxPercent,
    discountStacks * DISCOUNT_CONFIG.percentPerStack
  );
  
  const finalCost = rawCost * (1 - discountPercent);
  
  return Math.max(COST_CONFIG.minCost, Math.floor(finalCost));
}

/**
 * Get effect value at a given level
 * @param {Object} upgrade - Upgrade definition
 * @param {number} level - Upgrade level
 * @returns {number} Effect value
 */
function getUpgradeEffectValue(upgrade, level) {
  const effect = upgrade.effect;
  
  if (effect.percentPerLevel !== undefined) {
    return effect.percentPerLevel * level;
  }
  
  let value = effect.valuePerLevel * level;
  
  // Apply caps
  if (effect.maxValue !== undefined) {
    value = Math.min(effect.maxValue, value);
  }
  if (effect.minValue !== undefined) {
    value = Math.max(effect.minValue, value);
  }
  
  return value;
}

/**
 * Check if upgrade is available for this tower
 * @param {Object} upgrade - Upgrade definition
 * @param {Object} tower - Tower instance
 * @returns {boolean}
 */
function isUpgradeAvailable(upgrade, tower) {
  if (!upgrade.requirements) return true;
  
  const req = upgrade.requirements;
  
  // Check attack type requirement
  if (req.attackType && tower.attackTypeId !== req.attackType) {
    return false;
  }
  
  // Check element path requirement
  if (req.elementPath && tower.elementPath !== req.elementPath) {
    return false;
  }
  
  // Check minimum tower level
  if (req.minTowerLevel && (tower.level || 1) < req.minTowerLevel) {
    return false;
  }
  
  return true;
}

/**
 * Calculate discount stacks for an upgrade
 * @param {Object} tower - Tower instance
 * @param {string} upgradeId - Upgrade ID
 * @returns {number} Discount stacks
 */
function getUpgradeDiscountStacks(tower, upgradeId) {
  const currentLevel = tower.level || 1;
  
  // If never purchased, stacks = currentLevel - 1
  if (!tower.lastPurchaseLevel || tower.lastPurchaseLevel[upgradeId] === undefined) {
    return Math.max(0, currentLevel - 1);
  }
  
  // If purchased, stacks = currentLevel - levelWhenPurchased
  return Math.max(0, currentLevel - tower.lastPurchaseLevel[upgradeId]);
}

/**
 * Calculate discount percentage from stacks
 * @param {number} stacks - Number of discount stacks
 * @returns {number} Discount percentage (0.0 to 0.5)
 */
function getDiscountPercent(stacks) {
  return Math.min(DISCOUNT_CONFIG.maxPercent, stacks * DISCOUNT_CONFIG.percentPerStack);
}

// ╔════════════════════════════════════════════════════════════════════════════╗
// ║                              EXPORTS                                        ║
// ╚════════════════════════════════════════════════════════════════════════════╝

module.exports = {
  // Config objects
  DISCOUNT_CONFIG,
  COST_CONFIG,
  STAT_UPGRADES,
  PASSIVE_EFFECTS,
  TOWER_LEVEL_CONFIG,
  
  // Helper functions
  calculateUpgradeCost,
  getUpgradeEffectValue,
  isUpgradeAvailable,
  getUpgradeDiscountStacks,
  getDiscountPercent,
};

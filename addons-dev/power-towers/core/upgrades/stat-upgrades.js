/**
 * Power Towers TD - Stat Upgrades
 * 
 * NEW PERCENTAGE SYSTEM:
 * - Each upgrade level gives a % bonus to the stat
 * - Percentages are applied in tower-stats.js after level bonuses
 * - Effect values now represent % per level (0.05 = 5%)
 * 
 * Exceptions with fixed values:
 * - critChance: additive % (0.01 = +1%)
 * - critDamage: additive multiplier (+0.1)
 * - chainCount: fixed +1
 */

const STAT_UPGRADES = {
  // =========================================
  // DAMAGE (+5% per level)
  // =========================================
  damage: {
    id: 'damage',
    name: 'Damage',
    emoji: '⚔️',
    category: 'offense',
    description: '+5% damage per level',
    
    effect: {
      type: 'percentage',
      stat: 'damage',
      percentPerLevel: 0.05,
    },
    
    cost: {
      base: 20,
      scaleFactor: 1.15,
    },
    
    color: '#ff6b6b'
  },

  // =========================================
  // ATTACK SPEED (+4% per level)
  // =========================================
  attackSpeed: {
    id: 'attackSpeed',
    name: 'Attack Speed',
    emoji: '⚡',
    category: 'offense',
    description: '+4% attack speed per level',
    
    effect: {
      type: 'percentage',
      stat: 'fireRate',
      percentPerLevel: 0.04,
    },
    
    cost: {
      base: 25,
      scaleFactor: 1.18,
    },
    
    color: '#ffd93d'
  },

  // =========================================
  // RANGE (+5% per level)
  // =========================================
  range: {
    id: 'range',
    name: 'Range',
    emoji: '🎯',
    category: 'utility',
    description: '+5% range per level',
    
    effect: {
      type: 'percentage',
      stat: 'range',
      percentPerLevel: 0.05,
    },
    
    cost: {
      base: 18,
      scaleFactor: 1.12,
    },
    
    color: '#74b9ff'
  },

  // =========================================
  // CRITICAL CHANCE (+1% per level, cap 75%)
  // =========================================
  critChance: {
    id: 'critChance',
    name: 'Critical Chance',
    emoji: '🎲',
    category: 'offense',
    description: '+1% crit chance per level',
    
    effect: {
      type: 'additive',
      stat: 'critChance',
      valuePerLevel: 0.01,
      maxValue: 0.75,
    },
    
    cost: {
      base: 30,
      scaleFactor: 1.20,
    },
    
    color: '#e17055'
  },

  // =========================================
  // CRITICAL DAMAGE (+10% multiplier per level)
  // =========================================
  critDamage: {
    id: 'critDamage',
    name: 'Critical Damage',
    emoji: '💥',
    category: 'offense',
    description: '+10% crit multiplier per level',
    
    effect: {
      type: 'additive',
      stat: 'critDmgMod',
      valuePerLevel: 0.1,
    },
    
    cost: {
      base: 35,
      scaleFactor: 1.18,
    },
    
    color: '#d63031'
  },

  // =========================================
  // POWER EFFICIENCY (-3% PWR/Shot per level)
  // =========================================
  powerEfficiency: {
    id: 'powerEfficiency',
    name: 'Power Efficiency',
    emoji: '⚡',
    category: 'utility',
    description: '-3% PWR/Shot per level',
    
    effect: {
      type: 'percentage',
      stat: 'energyCostPerShot',
      percentPerLevel: -0.03,
      minFactor: 0.2, // Can't go below 20% of original
    },
    
    cost: {
      base: 22,
      scaleFactor: 1.14,
    },
    
    color: '#f1c40f'
  },

  // =========================================
  // HP / FORTIFICATION (+8% per level)
  // DISABLED - no longer available as upgrade
  // =========================================
  hp: {
    id: 'hp',
    name: 'Fortification',
    emoji: '🛡️',
    category: 'defense',
    description: '+8% health per level',
    
    effect: {
      type: 'percentage',
      stat: 'maxHp',
      percentPerLevel: 0.08,
    },
    
    // Disabled - not available for any tower
    requires: {
      attackTypes: []  // Empty array = never available
    },
    
    cost: {
      base: 15,
      scaleFactor: 1.10,
    },
    
    color: '#636e72'
  },

  // =========================================
  // HP REGEN (+0.5 per level, fixed)
  // DISABLED - no longer available as upgrade
  // =========================================
  hpRegen: {
    id: 'hpRegen',
    name: 'Regeneration',
    emoji: '💚',
    category: 'defense',
    description: '+0.5 HP/s per level',
    
    effect: {
      type: 'additive',
      stat: 'hpRegen',
      valuePerLevel: 0.5,
    },
    
    // Disabled - not available for any tower
    requires: {
      attackTypes: []  // Empty array = never available
    },
    
    cost: {
      base: 20,
      scaleFactor: 1.12,
    },
    
    color: '#00b894'
  },

  // =========================================
  // ENERGY STORAGE (+10% per level)
  // Only available for Lightning element
  // =========================================
  energyStorage: {
    id: 'energyStorage',
    name: 'Energy Storage',
    emoji: '🔋',
    category: 'utility',
    description: '+10% energy storage per level',
    
    effect: {
      type: 'percentage',
      stat: 'energyStorage',
      percentPerLevel: 0.10,
    },
    
    // Only available for Lightning element towers
    requires: {
      elementPaths: ['lightning']
    },
    
    cost: {
      base: 18,
      scaleFactor: 1.10,
    },
    
    color: '#fdcb6e'
  },

  // =========================================
  // SPLASH RADIUS (+8% per level, Siege only)
  // =========================================
  splashRadius: {
    id: 'splashRadius',
    name: 'Blast Radius',
    emoji: '💣',
    category: 'offense',
    description: '+8% splash radius per level',
    
    effect: {
      type: 'percentage',
      stat: 'splashRadius',
      percentPerLevel: 0.08,
    },
    
    requires: {
      attackTypes: ['siege']
    },
    
    cost: {
      base: 28,
      scaleFactor: 1.16,
    },
    
    color: '#ff7675'
  },

  // =========================================
  // CHAIN COUNT (+1 per level, Lightning only)
  // =========================================
  chainCount: {
    id: 'chainCount',
    name: 'Chain Targets',
    emoji: '⛓️',
    category: 'offense',
    description: '+1 chain target per level',
    
    effect: {
      type: 'additive',
      stat: 'chainCount',
      valuePerLevel: 1,
      maxValue: 10,
    },
    
    requires: {
      elementPaths: ['lightning']
    },
    
    cost: {
      base: 50,
      scaleFactor: 1.25,
    },
    
    color: '#fdcb6e'
  },

  // =========================================
  // POWER SCALING (+10% per level, Magic only)
  // DEPRECATED - Use charge system upgrades below
  // =========================================
  powerScaling: {
    id: 'powerScaling',
    name: 'Power Amplification',
    emoji: '✨',
    category: 'offense',
    description: '+10% power scaling per level',
    
    effect: {
      type: 'percentage',
      stat: 'powerScaling',
      percentPerLevel: 0.10,
    },
    
    // Disabled - using new charge system
    requires: {
      attackTypes: []
    },
    
    cost: {
      base: 35,
      scaleFactor: 1.18,
    },
    
    color: '#a29bfe'
  },

  // =========================================
  // MAGIC EFFICIENCY (-0.1 divisor per level)
  // Lower divisor = more damage per energy spent
  // =========================================
  magicEfficiency: {
    id: 'magicEfficiency',
    name: 'Arcane Efficiency',
    emoji: '✨',
    category: 'utility',
    description: 'More damage per energy spent',
    
    effect: {
      type: 'custom',
      stat: 'magicEfficiencyDivisor',
      valuePerLevel: -0.1,
      minValue: 0.5, // Min divisor (max efficiency)
    },
    
    requires: {
      attackTypes: ['magic']
    },
    
    cost: {
      base: 30,
      scaleFactor: 1.20,
    },
    
    color: '#a29bfe'
  },

  // =========================================
  // OVERFLOW RANGE (+20px per level)
  // =========================================
  overflowRange: {
    id: 'overflowRange',
    name: 'Arcane Reach',
    emoji: '🌀',
    category: 'offense',
    description: '+20px overflow radius per level',
    
    effect: {
      type: 'additive',
      stat: 'magicOverflowRadius',
      valuePerLevel: 20,
    },
    
    requires: {
      attackTypes: ['magic']
    },
    
    cost: {
      base: 35,
      scaleFactor: 1.16,
    },
    
    color: '#9b59b6'
  },

  // =========================================
  // OVERFLOW DAMAGE (+10% transfer per level)
  // =========================================
  overflowDamage: {
    id: 'overflowDamage',
    name: 'Arcane Cascade',
    emoji: '⚡',
    category: 'offense',
    description: '+10% overkill damage transfer',
    
    effect: {
      type: 'additive',
      stat: 'magicOverflowTransfer',
      valuePerLevel: 0.10,
      maxValue: 1.0, // Cap at 100% transfer
    },
    
    requires: {
      attackTypes: ['magic']
    },
    
    cost: {
      base: 45,
      scaleFactor: 1.22,
    },
    
    color: '#8e44ad'
  },

  // =========================================
  // CHARGE SPEED (+15% per level)
  // =========================================
  chargeSpeed: {
    id: 'chargeSpeed',
    name: 'Quick Charge',
    emoji: '⏩',
    category: 'utility',
    description: '+15% charge rate per level',
    
    effect: {
      type: 'percentage',
      stat: 'magicChargeRate',
      percentPerLevel: 0.15,
    },
    
    requires: {
      attackTypes: ['magic']
    },
    
    cost: {
      base: 25,
      scaleFactor: 1.14,
    },
    
    color: '#6c5ce7'
  },

  // =========================================
  // ARMOR SHRED - SUNDER (+2% per level, Siege only)
  // =========================================
  shredAmount: {
    id: 'shredAmount',
    name: 'Sunder',
    emoji: '🔨',
    category: 'offense',
    description: '+2% armor shred per hit per level',
    
    effect: {
      type: 'additive',
      stat: 'armorShredAmount',
      valuePerLevel: 0.02,
    },
    
    requires: {
      attackTypes: ['siege']
    },
    
    cost: {
      base: 40,
      scaleFactor: 1.18,
    },
    
    color: '#e74c3c'
  },

  // =========================================
  // ARMOR SHRED - MAX STACKS (+1 per level, Siege only)
  // =========================================
  shredStacks: {
    id: 'shredStacks',
    name: 'Deep Wounds',
    emoji: '🩸',
    category: 'offense',
    description: '+1 max armor shred stack per level',
    
    effect: {
      type: 'additive',
      stat: 'armorShredMaxStacks',
      valuePerLevel: 1,
      maxValue: 10,
    },
    
    requires: {
      attackTypes: ['siege']
    },
    
    cost: {
      base: 50,
      scaleFactor: 1.22,
    },
    
    color: '#c0392b'
  },

  // =========================================
  // ARMOR SHRED - DURATION (+1s per level, Siege only)
  // =========================================
  shredDuration: {
    id: 'shredDuration',
    name: 'Lasting Impact',
    emoji: '⏱️',
    category: 'offense',
    description: '+1s armor shred duration per level',
    
    effect: {
      type: 'additive',
      stat: 'armorShredDuration',
      valuePerLevel: 1000, // 1 second in ms
    },
    
    requires: {
      attackTypes: ['siege']
    },
    
    cost: {
      base: 35,
      scaleFactor: 1.15,
    },
    
    color: '#d35400'
  },

  // =========================================
  // GROUND ZONE UNLOCK (one-time, Siege only)
  // =========================================
  groundZoneUnlock: {
    id: 'groundZoneUnlock',
    name: 'Crater Zone',
    emoji: '🕳️',
    category: 'offense',
    description: 'Explosions leave slowing craters',
    
    effect: {
      type: 'unlock',
      stat: 'groundZoneEnabled',
      valuePerLevel: 1,
      maxValue: 1, // One-time unlock
    },
    
    requires: {
      attackTypes: ['siege']
    },
    
    cost: {
      base: 75,
      scaleFactor: 1.0, // No scaling (one-time)
    },
    
    color: '#8B4513'
  },

  // =========================================
  // GROUND ZONE - SLOW (+5% per level, requires unlock)
  // =========================================
  groundZoneSlow: {
    id: 'groundZoneSlow',
    name: 'Tar Pit',
    emoji: '🐢',
    category: 'offense',
    description: '+5% crater slow per level',
    
    effect: {
      type: 'additive',
      stat: 'groundZoneSlow',
      valuePerLevel: 0.05,
      maxValue: 0.80, // Cap at 80% slow
    },
    
    requires: {
      attackTypes: ['siege'],
      upgrades: ['groundZoneUnlock'] // Requires unlock first
    },
    
    cost: {
      base: 40,
      scaleFactor: 1.16,
    },
    
    color: '#5d4037'
  },

  // =========================================
  // GROUND ZONE - DURATION (+0.5s per level)
  // =========================================
  groundZoneDuration: {
    id: 'groundZoneDuration',
    name: 'Lingering',
    emoji: '⌛',
    category: 'offense',
    description: '+0.5s crater duration per level',
    
    effect: {
      type: 'additive',
      stat: 'groundZoneDuration',
      valuePerLevel: 500, // 0.5 seconds in ms
    },
    
    requires: {
      attackTypes: ['siege'],
      upgrades: ['groundZoneUnlock']
    },
    
    cost: {
      base: 35,
      scaleFactor: 1.14,
    },
    
    color: '#795548'
  },

  // =========================================
  // GROUND ZONE - RADIUS (+5 per level)
  // =========================================
  groundZoneRadius: {
    id: 'groundZoneRadius',
    name: 'Wide Crater',
    emoji: '⭕',
    category: 'offense',
    description: '+5 crater radius per level',
    
    effect: {
      type: 'additive',
      stat: 'groundZoneRadius',
      valuePerLevel: 5,
    },
    
    requires: {
      attackTypes: ['siege'],
      upgrades: ['groundZoneUnlock']
    },
    
    cost: {
      base: 45,
      scaleFactor: 1.17,
    },
    
    color: '#6d4c41'
  },

  // =========================================
  // SPLASH FALLOFF (-5% per level, Siege only)
  // Reduces damage dropoff at edge of splash
  // =========================================
  splashFalloff: {
    id: 'splashFalloff',
    name: 'Concentrated Blast',
    emoji: '💫',
    category: 'offense',
    description: '-5% splash damage falloff per level',
    
    effect: {
      type: 'additive',
      stat: 'splashDmgFalloff',
      valuePerLevel: -0.05,
      minValue: 0.1, // Min 10% falloff
    },
    
    requires: {
      attackTypes: ['siege']
    },
    
    cost: {
      base: 35,
      scaleFactor: 1.15,
    },
    
    color: '#ff6347'
  },
};

module.exports = { STAT_UPGRADES };

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
    
    cost: {
      base: 15,
      scaleFactor: 1.10,
    },
    
    color: '#636e72'
  },

  // =========================================
  // HP REGEN (+0.5 per level, fixed)
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
    
    cost: {
      base: 20,
      scaleFactor: 1.12,
    },
    
    color: '#00b894'
  },

  // =========================================
  // ENERGY STORAGE (+10% per level)
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
    
    requires: {
      attackTypes: ['magic']
    },
    
    cost: {
      base: 35,
      scaleFactor: 1.18,
    },
    
    color: '#a29bfe'
  },
};

module.exports = { STAT_UPGRADES };

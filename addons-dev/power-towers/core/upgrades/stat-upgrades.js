/**
 * Power Towers TD - Stat Upgrades
 * Infinite upgrades with scaling costs
 */

const STAT_UPGRADES = {
  // =========================================
  // DAMAGE
  // =========================================
  damage: {
    id: 'damage',
    name: 'Damage',
    emoji: '⚔️',
    category: 'offense',
    description: 'Increases base damage',
    
    effect: {
      type: 'additive',
      stat: 'baseDamage',
      valuePerLevel: 3,
    },
    
    cost: {
      base: 20,
      scaleFactor: 1.15,
    },
    
    color: '#ff6b6b'
  },

  // =========================================
  // ATTACK SPEED
  // =========================================
  attackSpeed: {
    id: 'attackSpeed',
    name: 'Attack Speed',
    emoji: '⚡',
    category: 'offense',
    description: 'Increases attacks per second',
    
    effect: {
      type: 'additive',
      stat: 'baseFireRate',
      valuePerLevel: 0.08,
    },
    
    cost: {
      base: 25,
      scaleFactor: 1.18,
    },
    
    color: '#ffd93d'
  },

  // =========================================
  // RANGE
  // =========================================
  range: {
    id: 'range',
    name: 'Range',
    emoji: '🎯',
    category: 'utility',
    description: 'Increases attack range',
    
    effect: {
      type: 'additive',
      stat: 'baseRange',
      valuePerLevel: 5,
    },
    
    cost: {
      base: 18,
      scaleFactor: 1.12,
    },
    
    color: '#74b9ff'
  },

  // =========================================
  // CRITICAL CHANCE
  // =========================================
  critChance: {
    id: 'critChance',
    name: 'Critical Chance',
    emoji: '🎲',
    category: 'offense',
    description: 'Increases chance to deal critical damage',
    
    effect: {
      type: 'additive',
      stat: 'critChance',
      valuePerLevel: 0.015,
      maxValue: 0.75,
    },
    
    cost: {
      base: 30,
      scaleFactor: 1.20,
    },
    
    color: '#e17055'
  },

  // =========================================
  // CRITICAL DAMAGE
  // =========================================
  critDamage: {
    id: 'critDamage',
    name: 'Critical Damage',
    emoji: '💥',
    category: 'offense',
    description: 'Increases critical hit damage multiplier',
    
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
  // ENERGY EFFICIENCY
  // =========================================
  energyEfficiency: {
    id: 'energyEfficiency',
    name: 'Energy Efficiency',
    emoji: '💎',
    category: 'utility',
    description: 'Reduces energy cost per attack',
    
    effect: {
      type: 'additive',
      stat: 'baseEnergyCost',
      valuePerLevel: -0.15,
      minValue: 0.2,
    },
    
    cost: {
      base: 22,
      scaleFactor: 1.14,
    },
    
    color: '#00cec9'
  },

  // =========================================
  // HP / FORTIFICATION
  // =========================================
  hp: {
    id: 'hp',
    name: 'Fortification',
    emoji: '🛡️',
    category: 'defense',
    description: 'Increases tower health',
    
    effect: {
      type: 'additive',
      stat: 'baseHp',
      valuePerLevel: 15,
    },
    
    cost: {
      base: 15,
      scaleFactor: 1.10,
    },
    
    color: '#636e72'
  },

  // =========================================
  // HP REGEN
  // =========================================
  hpRegen: {
    id: 'hpRegen',
    name: 'Regeneration',
    emoji: '💚',
    category: 'defense',
    description: 'Tower regenerates health over time',
    
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
  // ENERGY STORAGE
  // =========================================
  energyStorage: {
    id: 'energyStorage',
    name: 'Energy Storage',
    emoji: '🔋',
    category: 'utility',
    description: 'Increases tower energy storage capacity',
    
    effect: {
      type: 'additive',
      stat: 'baseEnergyStorage',
      valuePerLevel: 10,
    },
    
    cost: {
      base: 18,
      scaleFactor: 1.10,
    },
    
    color: '#fdcb6e'
  },

  // =========================================
  // SPLASH RADIUS (for Siege type)
  // =========================================
  splashRadius: {
    id: 'splashRadius',
    name: 'Blast Radius',
    emoji: '💣',
    category: 'offense',
    description: 'Increases area of effect radius',
    
    effect: {
      type: 'additive',
      stat: 'splashRadius',
      valuePerLevel: 5,
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
  // CHAIN COUNT (for Lightning element)
  // =========================================
  chainCount: {
    id: 'chainCount',
    name: 'Chain Targets',
    emoji: '⛓️',
    category: 'offense',
    description: 'Attack chains to additional enemies',
    
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
  // POWER SCALING (for Magic type)
  // =========================================
  powerScaling: {
    id: 'powerScaling',
    name: 'Power Amplification',
    emoji: '✨',
    category: 'offense',
    description: 'Increases damage bonus from power draw',
    
    effect: {
      type: 'additive',
      stat: 'powerScaling',
      valuePerLevel: 0.1,
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

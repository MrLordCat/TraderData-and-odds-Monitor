/**
 * Power Towers TD - Element Abilities Configuration
 * 
 * Defines all element-specific abilities, effects, and upgrades.
 * Single source of truth for balancing element powers.
 */

/**
 * Status Effect Types
 */
const EFFECT_TYPES = {
  BURN: 'burn',           // Fire DoT
  IGNITE: 'ignite',       // Fire spread chance
  SLOW: 'slow',           // Ice slow
  FREEZE: 'freeze',       // Ice stun
  POISON: 'poison',       // Nature DoT
  WEAKEN: 'weaken',       // Nature armor reduction
  SHOCK: 'shock',         // Lightning stun
  OVERLOAD: 'overload',   // Lightning chain damage
  DRAIN: 'drain',         // Dark life steal
  CURSE: 'curse',         // Dark damage amplify
};

/**
 * Element Abilities Configuration
 * Each element has base abilities that can be upgraded
 */
const ELEMENT_ABILITIES = {
  // =========================================
  // FIRE - DoT + Spread
  // =========================================
  fire: {
    name: 'Fire',
    icon: '🔥',
    description: 'Burns enemies, can spread to nearby targets',
    
    // Primary ability: Burn
    burn: {
      enabled: true,
      baseDamage: 5,           // DPS
      baseDuration: 3,        // seconds
      tickRate: 0.1,          // damage every 0.1s (visual feedback)
      stackable: true,        // multiple burns stack
      maxStacks: 3,
      canCrit: false,         // Can burn damage crit? (unlockable via cards)
    },
    
    // Secondary ability: Ignite (spread)
    ignite: {
      enabled: true,
      spreadChance: 0.15,     // 15% chance to spread per tick
      spreadRadius: 40,       // pixels
      spreadDamageMod: 0.7,   // spread burn does 70% damage
      canCrit: false,         // Can spread burn crit? (inherits from source burn)
    },
    
    // Ability upgrades (unlocked via upgrade menu)
    upgrades: {
      burn_damage: {
        name: 'Searing Flames',
        icon: '🔥',
        description: '+{value} burn DPS',
        maxLevel: 5,
        costBase: 50,
        costMult: 1.5,
        valuePerLevel: 2,     // +2 DPS per level
        stat: 'burn.baseDamage',
      },
      burn_duration: {
        name: 'Lasting Fire',
        icon: '⏱️',
        description: '+{value}s burn duration',
        maxLevel: 3,
        costBase: 75,
        costMult: 1.6,
        valuePerLevel: 1,     // +1s per level
        stat: 'burn.baseDuration',
      },
      spread_chance: {
        name: 'Wildfire',
        icon: '🌋',
        description: '+{value}% spread chance',
        maxLevel: 4,
        costBase: 100,
        costMult: 1.7,
        valuePerLevel: 0.08,  // +8% per level
        stat: 'ignite.spreadChance',
      },
      spread_radius: {
        name: 'Firestorm',
        icon: '🌪️',
        description: '+{value} spread radius',
        maxLevel: 3,
        costBase: 80,
        costMult: 1.5,
        valuePerLevel: 15,    // +15 pixels per level
        stat: 'ignite.spreadRadius',
      },
    },
  },
  
  // =========================================
  // ICE - Slow + Freeze
  // =========================================
  ice: {
    name: 'Ice',
    icon: '❄️',
    description: 'Slows enemies, can freeze them solid',
    
    // Primary ability: Slow
    slow: {
      enabled: true,
      basePercent: 0.3,       // 30% slow
      baseDuration: 2,        // seconds
      stackable: false,       // stronger slow replaces
      canCrit: false,         // Can slow damage crit? (N/A - no damage)
    },
    
    // Secondary ability: Freeze (stun)
    freeze: {
      enabled: true,
      baseChance: 0.08,       // 8% chance per hit
      baseDuration: 1.5,      // seconds frozen
      cooldown: 5,            // can't freeze same enemy for 5s
      canCrit: false,         // Can freeze proc crit? (unlockable via cards)
    },
    
    // Ability upgrades
    upgrades: {
      slow_percent: {
        name: 'Bitter Cold',
        icon: '❄️',
        description: '+{value}% slow strength',
        maxLevel: 5,
        costBase: 50,
        costMult: 1.5,
        valuePerLevel: 0.08,  // +8% per level
        stat: 'slow.basePercent',
      },
      slow_duration: {
        name: 'Permafrost',
        icon: '🧊',
        description: '+{value}s slow duration',
        maxLevel: 3,
        costBase: 60,
        costMult: 1.6,
        valuePerLevel: 0.5,   // +0.5s per level
        stat: 'slow.baseDuration',
      },
      freeze_chance: {
        name: 'Flash Freeze',
        icon: '💎',
        description: '+{value}% freeze chance',
        maxLevel: 4,
        costBase: 100,
        costMult: 1.8,
        valuePerLevel: 0.04,  // +4% per level
        stat: 'freeze.baseChance',
      },
      freeze_duration: {
        name: 'Deep Freeze',
        icon: '🏔️',
        description: '+{value}s freeze duration',
        maxLevel: 3,
        costBase: 120,
        costMult: 1.7,
        valuePerLevel: 0.5,   // +0.5s per level
        stat: 'freeze.baseDuration',
      },
    },
  },
  
  // =========================================
  // LIGHTNING - Charge System + Chain
  // =========================================
  lightning: {
    name: 'Lightning',
    icon: '⚡',
    description: 'Charge attacks for massive damage, chains to nearby enemies',
    
    // Primary ability: Charge Attack
    charge: {
      enabled: true,
      minChargePercent: 0,    // Can fire at 0% charge
      maxChargePercent: 100,  // Full charge
      chargeSlider: 50,       // Default charge target (user adjustable)
      
      // Energy cost scaling (exponential)
      baseCost: 20,           // Base shot cost
      costExponent: 2.5,      // Cost = baseCost * (1 + charge%)^exponent
      
      // Damage scaling
      damageExponent: 2.0,    // Damage multiplier scales exponentially
      
      // Charge rate (based on energy income)
      chargeFromEnergy: true, // Charge speed = energy input rate
    },
    
    // Secondary ability: Chain Lightning
    chain: {
      enabled: true,
      baseTargets: 2,         // Chains to 2 additional targets
      chainRange: 80,         // pixels
      chainDamageFalloff: 0.5, // Each chain does 50% of previous
      canCrit: false,         // Can chain damage crit? (unlockable via cards)
    },
    
    // Tertiary ability: Shock (stun on crit)
    shock: {
      enabled: true,
      onCritOnly: true,       // Only procs on critical hits
      baseDuration: 0.5,      // Short stun
    },
    
    // Ability upgrades
    upgrades: {
      chain_targets: {
        name: 'Arc Lightning',
        icon: '⚡',
        description: '+{value} chain targets',
        maxLevel: 3,
        costBase: 100,
        costMult: 2.0,
        valuePerLevel: 1,
        stat: 'chain.baseTargets',
      },
      chain_damage: {
        name: 'Conductive',
        icon: '🔗',
        description: '+{value}% chain damage',
        maxLevel: 4,
        costBase: 80,
        costMult: 1.6,
        valuePerLevel: 0.1,   // +10% (less falloff)
        stat: 'chain.chainDamageFalloff',
        invert: true,         // Higher = less falloff
      },
      charge_efficiency: {
        name: 'Capacitor',
        icon: '🔋',
        description: '-{value}% charge cost',
        maxLevel: 5,
        costBase: 60,
        costMult: 1.5,
        valuePerLevel: -0.15, // -15% cost exponent
        stat: 'charge.costExponent',
      },
      shock_duration: {
        name: 'Overcharge',
        icon: '💥',
        description: '+{value}s shock duration',
        maxLevel: 3,
        costBase: 90,
        costMult: 1.7,
        valuePerLevel: 0.3,
        stat: 'shock.baseDuration',
      },
    },
  },
  
  // =========================================
  // NATURE/POISON - Long DoT + Weaken
  // =========================================
  nature: {
    name: 'Nature',
    icon: '🌿',
    description: 'Poisons enemies with lasting damage, weakens armor',
    
    // Primary ability: Poison
    poison: {
      enabled: true,
      baseDamage: 3,          // DPS (lower than fire)
      baseDuration: 8,        // seconds (much longer)
      tickRate: 0.2,          // damage every 0.2s (visual feedback)
      stackable: true,
      maxStacks: 5,           // More stacks than fire
      canCrit: false,         // Can poison damage crit? (unlockable via cards)
    },
    
    // Secondary ability: Weaken (armor reduction)
    weaken: {
      enabled: true,
      armorReduction: 0.15,   // -15% armor
      baseDuration: 4,        // seconds
      stackable: true,
      maxStacks: 3,           // Up to -45% armor
      canCrit: false,         // Can weaken proc crit? (N/A - no damage)
    },
    
    // Ability upgrades
    upgrades: {
      poison_damage: {
        name: 'Virulent Toxin',
        icon: '☠️',
        description: '+{value} poison DPS',
        maxLevel: 5,
        costBase: 50,
        costMult: 1.5,
        valuePerLevel: 1.5,
        stat: 'poison.baseDamage',
      },
      poison_duration: {
        name: 'Lingering Venom',
        icon: '⏳',
        description: '+{value}s poison duration',
        maxLevel: 4,
        costBase: 60,
        costMult: 1.5,
        valuePerLevel: 2,
        stat: 'poison.baseDuration',
      },
      poison_stacks: {
        name: 'Neurotoxin',
        icon: '🧪',
        description: '+{value} max poison stacks',
        maxLevel: 3,
        costBase: 100,
        costMult: 1.8,
        valuePerLevel: 2,
        stat: 'poison.maxStacks',
      },
      weaken_strength: {
        name: 'Corrosive',
        icon: '💀',
        description: '+{value}% armor reduction',
        maxLevel: 4,
        costBase: 80,
        costMult: 1.6,
        valuePerLevel: 0.05,
        stat: 'weaken.armorReduction',
      },
    },
  },
  
  // =========================================
  // DARK - Life Steal + Curse
  // =========================================
  dark: {
    name: 'Dark',
    icon: '💀',
    description: 'Drains life from enemies, curses them to take more damage',
    
    // Primary ability: Drain (life steal)
    drain: {
      enabled: true,
      basePercent: 0.1,       // 10% life steal
      healTower: false,       // Heals tower HP (if tower has HP)
      healEnergy: true,       // Converts to energy instead
      energyConversion: 0.5,  // 50% of drain becomes energy
      canCrit: false,         // Can drain amount crit? (unlockable via cards)
    },
    
    // Secondary ability: Curse (damage amplify)
    curse: {
      enabled: true,
      damageAmplify: 0.15,    // +15% damage taken
      baseDuration: 4,        // seconds
      stackable: true,
      maxStacks: 3,           // Up to +45% damage taken
      canCrit: false,         // Can curse proc crit? (N/A - debuff)
    },
    
    // Ability upgrades
    upgrades: {
      drain_percent: {
        name: 'Soul Siphon',
        icon: '👻',
        description: '+{value}% life drain',
        maxLevel: 5,
        costBase: 60,
        costMult: 1.5,
        valuePerLevel: 0.05,
        stat: 'drain.basePercent',
      },
      drain_energy: {
        name: 'Dark Harvest',
        icon: '🌙',
        description: '+{value}% energy conversion',
        maxLevel: 4,
        costBase: 80,
        costMult: 1.6,
        valuePerLevel: 0.1,
        stat: 'drain.energyConversion',
      },
      curse_amplify: {
        name: 'Hex',
        icon: '🔮',
        description: '+{value}% damage amplify',
        maxLevel: 4,
        costBase: 100,
        costMult: 1.7,
        valuePerLevel: 0.08,
        stat: 'curse.damageAmplify',
      },
      curse_duration: {
        name: 'Eternal Damnation',
        icon: '⚰️',
        description: '+{value}s curse duration',
        maxLevel: 3,
        costBase: 70,
        costMult: 1.5,
        valuePerLevel: 1,
        stat: 'curse.baseDuration',
      },
    },
  },
};

/**
 * Get element abilities config for a tower
 * @param {string} elementPath - Element type (fire, ice, lightning, nature, dark)
 * @param {Object} [towerUpgrades] - Tower's ability upgrade levels
 * @returns {Object} Computed abilities with upgrades applied
 */
function getElementAbilities(elementPath, towerUpgrades = {}) {
  const baseConfig = ELEMENT_ABILITIES[elementPath];
  if (!baseConfig) return null;
  
  // Deep clone the config
  const config = JSON.parse(JSON.stringify(baseConfig));
  
  // Apply upgrades
  if (towerUpgrades && config.upgrades) {
    for (const [upgradeId, level] of Object.entries(towerUpgrades)) {
      const upgrade = config.upgrades[upgradeId];
      if (!upgrade || level <= 0) continue;
      
      // Parse stat path (e.g., 'burn.baseDamage')
      const [category, stat] = upgrade.stat.split('.');
      if (config[category] && config[category][stat] !== undefined) {
        const bonus = upgrade.valuePerLevel * level;
        if (upgrade.invert) {
          // For inverted stats (like damage falloff)
          config[category][stat] = Math.max(0.1, config[category][stat] - bonus);
        } else {
          config[category][stat] += bonus;
        }
      }
    }
  }
  
  return config;
}

/**
 * Calculate lightning charge cost
 * @param {number} chargePercent - 0 to 100
 * @param {Object} chargeConfig - Lightning charge config
 * @returns {number} Energy cost
 */
function calculateLightningChargeCost(chargePercent, chargeConfig) {
  const { baseCost, costExponent } = chargeConfig;
  const chargeRatio = chargePercent / 100;
  
  // Cost = baseCost * (1 + chargeRatio)^exponent
  return Math.round(baseCost * Math.pow(1 + chargeRatio, costExponent));
}

/**
 * Calculate lightning charge damage multiplier
 * @param {number} chargePercent - 0 to 100
 * @param {Object} chargeConfig - Lightning charge config
 * @returns {number} Damage multiplier
 */
function calculateLightningChargeDamage(chargePercent, chargeConfig) {
  const { damageExponent } = chargeConfig;
  const chargeRatio = chargePercent / 100;
  
  // Damage = (1 + chargeRatio)^exponent
  return Math.pow(1 + chargeRatio, damageExponent);
}

/**
 * Get upgrade cost for ability upgrade
 * Uses individual discount stacks per upgrade
 * @param {string} elementPath - Element type
 * @param {string} upgradeId - Upgrade ID
 * @param {number} currentLevel - Current upgrade level
 * @param {number} [discountStacks=0] - Individual discount stacks for this upgrade
 * @returns {number} Gold cost for next level
 */
function getAbilityUpgradeCost(elementPath, upgradeId, currentLevel, discountStacks = 0) {
  const config = ELEMENT_ABILITIES[elementPath];
  if (!config || !config.upgrades || !config.upgrades[upgradeId]) return 0;
  
  const upgrade = config.upgrades[upgradeId];
  if (currentLevel >= upgrade.maxLevel) return Infinity;
  
  const rawCost = Math.round(upgrade.costBase * Math.pow(upgrade.costMult, currentLevel));
  
  // Apply discount from stacks (5% per stack, max 50%)
  const discountPercent = Math.min(0.5, discountStacks * 0.05);
  return Math.floor(rawCost * (1 - discountPercent));
}

module.exports = {
  EFFECT_TYPES,
  ELEMENT_ABILITIES,
  getElementAbilities,
  calculateLightningChargeCost,
  calculateLightningChargeDamage,
  getAbilityUpgradeCost,
};

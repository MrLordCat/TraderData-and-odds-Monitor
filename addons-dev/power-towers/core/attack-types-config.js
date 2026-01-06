/**
 * Power Towers TD - Attack Types Configuration
 * 
 * Configurable parameters for attack type mechanics.
 * Separates tunable values from attack-types.js for easier balancing.
 * 
 * SECTIONS:
 * 1. NORMAL ATTACK - Combo System & Focus Fire
 * 2. SIEGE ATTACK  - Splash damage mechanics (future)
 * 3. MAGIC ATTACK  - Power scaling mechanics (future)
 * 4. PIERCING      - Critical mechanics (future)
 */

const ATTACK_TYPE_CONFIG = {
  // ╔════════════════════════════════════════════════════════════════════════╗
  // ║              1. NORMAL ATTACK - Combo & Focus Fire                     ║
  // ╚════════════════════════════════════════════════════════════════════════╝
  
  normal: {
    // --- 1.1 Combo System ---
    // Each hit on same target increases damage
    combo: {
      enabled: true,
      baseDmgPerStack: 0.05,      // +5% damage per stack (base)
      maxStacks: 10,              // Max stacks (before upgrades)
      decayTime: 2.0,             // Seconds before losing stacks
      
      // Stack persistence
      decayRate: 1,               // Stacks lost per decay interval
      fullDecayOnTargetChange: false,  // If true, lose ALL stacks on target change
    },
    
    // --- 1.2 Focus Fire ---
    // Guaranteed crit after X hits on same target
    focusFire: {
      enabled: true,
      baseHitsRequired: 5,        // Hits needed to trigger (base)
      baseCritBonus: 0.5,         // +50% extra crit damage on focus fire
      
      // Visual
      effectColor: '#ffd700',     // Gold color for focus fire
      effectSize: 30,             // Burst effect size
    },
    
    // --- 1.3 Upgrade Bonuses ---
    // Values applied per upgrade level
    upgrades: {
      comboDamage: {
        id: 'comboDamage',
        name: 'Combo Power',
        emoji: '🎯',
        description: '+1% combo damage per stack per level',
        category: 'normal-attack',
        
        effect: {
          type: 'additive',
          stat: 'comboDmgPerStack',
          valuePerLevel: 0.01,    // +1% per stack per upgrade level
        },
        
        cost: {
          base: 25,
          scaleFactor: 1.15,
        },
        
        color: '#4a90d9'
      },
      
      comboMaxStacks: {
        id: 'comboMaxStacks',
        name: 'Combo Mastery',
        emoji: '📈',
        description: '+2 max combo stacks per level',
        category: 'normal-attack',
        
        effect: {
          type: 'flat',
          stat: 'comboMaxStacks',
          valuePerLevel: 2,       // +2 max stacks per level
          maxValue: 20,           // Cap at 20 total stacks
        },
        
        cost: {
          base: 40,
          scaleFactor: 1.25,
        },
        
        color: '#3080d9'
      },
      
      comboDecay: {
        id: 'comboDecay',
        name: 'Combo Persistence',
        emoji: '⏱️',
        description: '+0.5s combo decay time per level',
        category: 'normal-attack',
        
        effect: {
          type: 'flat',
          stat: 'comboDecayTime',
          valuePerLevel: 0.5,     // +0.5 seconds per level
          maxValue: 5.0,          // Max 5 seconds total
        },
        
        cost: {
          base: 30,
          scaleFactor: 1.18,
        },
        
        color: '#6ab0e8'
      },
      
      focusFire: {
        id: 'focusFire',
        name: 'Focus Training',
        emoji: '🔥',
        description: '-1 hit required for Focus Fire per level',
        category: 'normal-attack',
        
        effect: {
          type: 'flat',
          stat: 'focusFireHits',
          valuePerLevel: -1,      // -1 hit required per level
          minValue: 2,            // Minimum 2 hits required
        },
        
        cost: {
          base: 50,
          scaleFactor: 1.30,
        },
        
        color: '#ffd700'
      },
      
      focusCritBonus: {
        id: 'focusCritBonus',
        name: 'Lethal Focus',
        emoji: '💀',
        description: '+15% Focus Fire crit damage per level',
        category: 'normal-attack',
        
        effect: {
          type: 'additive',
          stat: 'focusFireCritBonus',
          valuePerLevel: 0.15,    // +15% per level
        },
        
        cost: {
          base: 45,
          scaleFactor: 1.22,
        },
        
        color: '#ff6b6b'
      },
    },
    
    // --- 1.4 Visual Colors ---
    // Projectile colors based on combo stacks
    comboColors: [
      '#87ceeb',  // 0 stacks - light blue
      '#6ab0e8',  // 1-2 stacks
      '#4d96e1',  // 3-4 stacks
      '#3080d9',  // 5-6 stacks
      '#1a6ad1',  // 7-8 stacks
      '#0055c9'   // 9+ stacks - deep blue
    ],
  },
  
  // ╔════════════════════════════════════════════════════════════════════════╗
  // ║              2. SIEGE ATTACK - Splash Mechanics                        ║
  // ╚════════════════════════════════════════════════════════════════════════╝
  
  siege: {
    // Placeholder for future siege-specific config
    splash: {
      baseRadius: 60,
      baseFalloff: 0.5,
    },
    upgrades: {
      // Will be added later
    }
  },
  
  // ╔════════════════════════════════════════════════════════════════════════╗
  // ║              3. MAGIC ATTACK - Power Scaling                           ║
  // ╚════════════════════════════════════════════════════════════════════════╝
  
  magic: {
    // Placeholder for future magic-specific config
    powerScaling: {
      baseScaling: 1.5,
      overdriveEnabled: true,
    },
    upgrades: {
      // Will be added later
    }
  },
  
  // ╔════════════════════════════════════════════════════════════════════════╗
  // ║              4. PIERCING ATTACK - Critical Mechanics                   ║
  // ╚════════════════════════════════════════════════════════════════════════╝
  
  piercing: {
    // Placeholder for future piercing-specific config
    critical: {
      baseCritChance: 0.15,
      baseCritDamage: 2.5,
    },
    upgrades: {
      // Will be added later
    }
  },
};

/**
 * Get attack type specific upgrades
 * @param {string} attackTypeId - Attack type ID
 * @returns {Object} Upgrades config for that attack type
 */
function getAttackTypeUpgrades(attackTypeId) {
  const config = ATTACK_TYPE_CONFIG[attackTypeId];
  return config?.upgrades || {};
}

/**
 * Calculate upgrade cost for attack type upgrade
 * @param {string} attackTypeId - Attack type ID
 * @param {string} upgradeId - Upgrade ID
 * @param {number} currentLevel - Current upgrade level
 * @param {number} towerLevel - Tower level for discount
 * @returns {number} Cost
 */
function calculateAttackTypeUpgradeCost(attackTypeId, upgradeId, currentLevel, towerLevel = 1) {
  const upgrades = getAttackTypeUpgrades(attackTypeId);
  const upgrade = upgrades[upgradeId];
  
  if (!upgrade) return 0;
  
  const baseCost = upgrade.cost.base;
  const scaleFactor = upgrade.cost.scaleFactor;
  
  // Raw cost = base * scale^level
  const rawCost = baseCost * Math.pow(scaleFactor, currentLevel);
  
  // Tower level discount (same as stat upgrades)
  const discountPerLevel = 0.05;  // 5% per tower level
  const maxDiscount = 0.5;        // Max 50%
  const discountPercent = Math.min(maxDiscount, (towerLevel - 1) * discountPerLevel);
  
  return Math.floor(rawCost * (1 - discountPercent));
}

/**
 * Apply attack type upgrade effect to tower stats
 * @param {Object} tower - Tower instance
 * @param {string} upgradeId - Upgrade ID
 * @param {number} level - Upgrade level
 */
function applyAttackTypeUpgradeEffect(tower, upgradeId, level) {
  if (tower.attackTypeId !== 'normal') return;
  
  const upgrades = getAttackTypeUpgrades('normal');
  const upgrade = upgrades[upgradeId];
  if (!upgrade || level <= 0) return;
  
  const effect = upgrade.effect;
  let value = effect.valuePerLevel * level;
  
  // Apply caps
  if (effect.maxValue !== undefined) {
    value = Math.min(effect.maxValue, value);
  }
  if (effect.minValue !== undefined) {
    value = Math.max(effect.minValue, value);
  }
  
  // Apply to tower based on stat type
  switch (effect.stat) {
    case 'comboDmgPerStack':
      tower.comboDmgPerStack = (tower.comboDmgPerStack || 0.05) + value;
      break;
    case 'comboMaxStacks':
      tower.comboMaxStacks = (tower.comboMaxStacks || 10) + value;
      break;
    case 'comboDecayTime':
      tower.comboDecayTime = (tower.comboDecayTime || 2.0) + value;
      break;
    case 'focusFireHits':
      tower.focusFireHitsRequired = Math.max(
        effect.minValue || 2, 
        (tower.focusFireHitsRequired || 5) + value
      );
      break;
    case 'focusFireCritBonus':
      tower.focusFireCritBonus = (tower.focusFireCritBonus || 0.5) + value;
      break;
  }
}

/**
 * Get display stats for Normal attack type
 * @param {Object} tower - Tower instance
 * @returns {Array} Stats array for UI display
 */
function getNormalAttackStats(tower) {
  if (tower.attackTypeId !== 'normal') return [];
  
  const comboState = tower.comboState || { stacks: 0, focusHits: 0 };
  const maxStacks = tower.comboMaxStacks || 10;
  const dmgPerStack = tower.comboDmgPerStack || 0.05;
  const focusHitsReq = tower.focusFireHitsRequired || 5;
  const focusCritBonus = tower.focusFireCritBonus || 0.5;
  
  // Calculate current combo bonus
  const comboDmgBonus = comboState.stacks * dmgPerStack;
  const focusProgress = comboState.focusHits || 0;
  
  return [
    {
      id: 'comboStacks',
      name: 'Combo',
      emoji: '🎯',
      value: `${comboState.stacks}/${maxStacks}`,
      detail: `+${Math.round(comboDmgBonus * 100)}% DMG`,
      color: '#4a90d9',
      isLive: true,  // Updates in real-time
    },
    {
      id: 'comboDmgPerStack',
      name: 'Combo Power',
      emoji: '📊',
      value: `+${Math.round(dmgPerStack * 100)}%`,
      detail: 'per stack',
      color: '#3080d9',
    },
    {
      id: 'focusProgress',
      name: 'Focus',
      emoji: '🔥',
      value: `${focusProgress}/${focusHitsReq}`,
      detail: focusProgress >= focusHitsReq ? 'READY!' : 'hits',
      color: focusProgress >= focusHitsReq ? '#ffd700' : '#6ab0e8',
      isLive: true,
    },
    {
      id: 'focusCritBonus',
      name: 'Focus Crit',
      emoji: '💥',
      value: `${Math.round((1.5 + focusCritBonus) * 100)}%`,
      detail: `+${Math.round(focusCritBonus * 100)}% bonus`,
      color: '#ff6b6b',
    },
  ];
}

module.exports = {
  ATTACK_TYPE_CONFIG,
  getAttackTypeUpgrades,
  calculateAttackTypeUpgradeCost,
  applyAttackTypeUpgradeEffect,
  getNormalAttackStats,
};

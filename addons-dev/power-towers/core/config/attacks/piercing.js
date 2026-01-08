/**
 * Power Towers TD - Piercing Attack Configuration
 * 
 * Critical-focused mechanics with Execute, Momentum, and Bleed
 * Best for: High burst damage, boss killing, crit synergies
 * 
 * Unique Mechanics:
 * - Precision System: Guaranteed crit after N hits + bonus damage
 * - Deadly Momentum: Crit increases next crit chance (stacking, decay)
 * - Execute: Bonus damage to low HP enemies, crits deal extra
 * - Bleed: DoT from crits only, stacks
 */

const PIERCING_ATTACK_CONFIG = {
  // ╔════════════════════════════════════════════════════════════════════════╗
  // ║                      STAT MODIFIERS (vs base tower)                    ║
  // ╚════════════════════════════════════════════════════════════════════════╝
  
  statModifiers: {
    damage: 0.85,           // 85% base damage (offset by crits)
    attackSpeed: 1.1,       // 110% attack speed
    range: 0.9,             // 90% range (precision weapon)
    energyCost: 0.9,        // 90% energy per shot
  },
  
  // ╔════════════════════════════════════════════════════════════════════════╗
  // ║                       CRITICAL SYSTEM                                  ║
  // ╚════════════════════════════════════════════════════════════════════════╝
  
  critical: {
    enabled: true,
    baseCritChance: 0.15,       // 15% base crit chance
    baseCritDamage: 2.5,        // 250% crit damage
    armorPenetration: 0.2,      // 20% armor ignore (always)
  },
  
  // ╔════════════════════════════════════════════════════════════════════════╗
  // ║                      PRECISION SYSTEM                                  ║
  // ║  Guaranteed crit after N hits with bonus damage                        ║
  // ╚════════════════════════════════════════════════════════════════════════╝
  
  precision: {
    enabled: true,
    baseHitsRequired: 8,        // Hits until guaranteed crit
    baseBonusDamage: 0.25,      // +25% damage on precision crit
    resetOnNewTarget: false,    // Keep counter when switching targets
  },
  
  // ╔════════════════════════════════════════════════════════════════════════╗
  // ║                      DEADLY MOMENTUM                                   ║
  // ║  Each crit increases chance of next crit (stacking, decays)            ║
  // ╚════════════════════════════════════════════════════════════════════════╝
  
  momentum: {
    enabled: true,
    baseChancePerStack: 0.03,   // +3% crit chance per stack
    maxStacks: 5,               // Max 5 stacks (+15% crit chance)
    decayTime: 3.0,             // Seconds until stack decays
    decayRate: 1,               // Lose 1 stack per decay interval
  },
  
  // ╔════════════════════════════════════════════════════════════════════════╗
  // ║                          EXECUTE SYSTEM                                ║
  // ║  Bonus damage to low HP enemies, enhanced by crits                     ║
  // ╚════════════════════════════════════════════════════════════════════════╝
  
  execute: {
    enabled: true,
    baseThreshold: 0.15,        // Below 15% HP
    baseBonusDamage: 0.50,      // +50% damage to execute targets
    critExecuteBonus: 0.25,     // Additional +25% on crit vs execute target
  },
  
  // ╔════════════════════════════════════════════════════════════════════════╗
  // ║                           BLEED SYSTEM                                 ║
  // ║  DoT applied on crits, stacks for increased damage                     ║
  // ╚════════════════════════════════════════════════════════════════════════╝
  
  bleed: {
    enabled: false,             // Unlocked via upgrade
    baseDamage: 3,              // DPS per stack
    baseDuration: 3,            // Seconds
    tickRate: 0.5,              // Damage every 0.5s
    maxStacks: 5,               // Max stacks
    appliedOnCrit: true,        // Only applied on critical hits
    stackable: true,
  },
  
  // ╔════════════════════════════════════════════════════════════════════════╗
  // ║                            VISUALS                                     ║
  // ╚════════════════════════════════════════════════════════════════════════╝
  
  visuals: {
    baseColor: '#e74c3c',       // Red
    critColor: '#ff0000',       // Bright red for crits
    executeColor: '#8b0000',    // Dark red for execute
    precisionColor: '#ffd700',  // Gold for precision strike
    bleedColor: '#dc143c',      // Crimson for bleed
    momentumColors: [           // Colors by momentum stacks
      '#e74c3c',                // 0 stacks - base red
      '#ef4444',                // 1 stack
      '#f87171',                // 2 stacks
      '#fca5a5',                // 3 stacks
      '#fecaca',                // 4 stacks
      '#fef2f2',                // 5 stacks - near white (max momentum)
    ],
  },
  
  // ╔════════════════════════════════════════════════════════════════════════╗
  // ║                      UPGRADE DEFINITIONS                               ║
  // ╚════════════════════════════════════════════════════════════════════════╝
  
  upgrades: {
    // === PRECISION UPGRADES ===
    precisionHits: {
      id: 'precisionHits',
      name: 'Deadly Precision',
      emoji: '🎯',
      description: 'Reduce hits needed for guaranteed crit',
      category: 'piercing-attack',
      
      effect: {
        type: 'flat',
        stat: 'precisionHitsRequired',
        valuePerLevel: -1,        // -1 hit per level
        minValue: 3,              // Minimum 3 hits
      },
      
      cost: {
        base: 40,
        scaleFactor: 1.4,
      },
      maxLevel: 5,
      
      color: '#ffd700',
    },
    
    precisionDamage: {
      id: 'precisionDamage',
      name: 'Perfect Strike',
      emoji: '💫',
      description: 'Increase precision crit bonus damage',
      category: 'piercing-attack',
      
      effect: {
        type: 'additive',
        stat: 'precisionBonusDamage',
        valuePerLevel: 0.10,      // +10% per level
      },
      
      cost: {
        base: 35,
        scaleFactor: 1.3,
      },
      
      color: '#ffd700',
    },
    
    // === MOMENTUM UPGRADES ===
    momentumStacks: {
      id: 'momentumStacks',
      name: 'Killing Spree',
      emoji: '⚡',
      description: 'Increase max momentum stacks',
      category: 'piercing-attack',
      
      effect: {
        type: 'flat',
        stat: 'momentumMaxStacks',
        valuePerLevel: 1,         // +1 max stack per level
      },
      
      cost: {
        base: 45,
        scaleFactor: 1.5,
      },
      maxLevel: 5,
      
      color: '#f59e0b',
    },
    
    momentumDecay: {
      id: 'momentumDecay',
      name: 'Sustained Fury',
      emoji: '🔥',
      description: 'Increase time before momentum decays',
      category: 'piercing-attack',
      
      effect: {
        type: 'flat',
        stat: 'momentumDecayTime',
        valuePerLevel: 0.5,       // +0.5s per level
      },
      
      cost: {
        base: 30,
        scaleFactor: 1.2,
      },
      
      color: '#f59e0b',
    },
    
    // === EXECUTE UPGRADES ===
    executeThreshold: {
      id: 'executeThreshold',
      name: 'Executioner',
      emoji: '💀',
      description: 'Increase HP threshold for execute damage',
      category: 'piercing-attack',
      
      effect: {
        type: 'additive',
        stat: 'executeThreshold',
        valuePerLevel: 0.05,      // +5% HP threshold per level
        maxValue: 0.40,           // Cap at 40% HP
      },
      
      cost: {
        base: 50,
        scaleFactor: 1.4,
      },
      maxLevel: 5,
      
      color: '#991b1b',
    },
    
    executeDamage: {
      id: 'executeDamage',
      name: 'Coup de Grace',
      emoji: '⚔️',
      description: 'Increase bonus damage vs low HP enemies',
      category: 'piercing-attack',
      
      effect: {
        type: 'additive',
        stat: 'executeBonusDamage',
        valuePerLevel: 0.15,      // +15% execute damage per level
      },
      
      cost: {
        base: 40,
        scaleFactor: 1.3,
      },
      
      color: '#991b1b',
    },
    
    executeCrit: {
      id: 'executeCrit',
      name: 'Merciless',
      emoji: '☠️',
      description: 'Crits vs execute targets deal even more damage',
      category: 'piercing-attack',
      
      effect: {
        type: 'additive',
        stat: 'executeCritBonus',
        valuePerLevel: 0.10,      // +10% crit vs execute per level
      },
      
      cost: {
        base: 45,
        scaleFactor: 1.35,
      },
      
      color: '#991b1b',
    },
    
    // === BLEED UPGRADES ===
    bleedUnlock: {
      id: 'bleedUnlock',
      name: 'Hemorrhage',
      emoji: '🩸',
      description: 'Crits apply bleeding (DoT that stacks)',
      category: 'piercing-attack',
      
      effect: {
        type: 'unlock',
        stat: 'bleedEnabled',
        valuePerLevel: 1,
      },
      
      cost: {
        base: 60,
        scaleFactor: 1.0,
      },
      maxLevel: 1,
      
      color: '#dc143c',
    },
    
    bleedDamage: {
      id: 'bleedDamage',
      name: 'Deep Cuts',
      emoji: '🗡️',
      description: 'Increase bleed damage per second',
      category: 'piercing-attack',
      
      requires: {
        upgrade: 'bleedUnlock',
        level: 1,
      },
      
      effect: {
        type: 'additive',
        stat: 'bleedDamage',
        valuePerLevel: 1,         // +1 DPS per level
      },
      
      cost: {
        base: 35,
        scaleFactor: 1.25,
      },
      
      color: '#dc143c',
    },
    
    bleedDuration: {
      id: 'bleedDuration',
      name: 'Lingering Wounds',
      emoji: '⏱️',
      description: 'Increase bleed duration',
      category: 'piercing-attack',
      
      requires: {
        upgrade: 'bleedUnlock',
        level: 1,
      },
      
      effect: {
        type: 'flat',
        stat: 'bleedDuration',
        valuePerLevel: 1,         // +1s per level
      },
      
      cost: {
        base: 30,
        scaleFactor: 1.2,
      },
      
      color: '#dc143c',
    },
    
    bleedStacks: {
      id: 'bleedStacks',
      name: 'Arterial Strike',
      emoji: '💉',
      description: 'Increase maximum bleed stacks',
      category: 'piercing-attack',
      
      requires: {
        upgrade: 'bleedUnlock',
        level: 1,
      },
      
      effect: {
        type: 'flat',
        stat: 'bleedMaxStacks',
        valuePerLevel: 1,         // +1 max stack per level
      },
      
      cost: {
        base: 40,
        scaleFactor: 1.3,
      },
      maxLevel: 5,
      
      color: '#dc143c',
    },
    
    // === ARMOR PENETRATION ===
    armorPen: {
      id: 'armorPen',
      name: 'Armor Piercing',
      emoji: '🛡️',
      description: 'Increase armor penetration',
      category: 'piercing-attack',
      
      effect: {
        type: 'additive',
        stat: 'armorPenetration',
        valuePerLevel: 0.05,      // +5% armor pen per level
        maxValue: 0.50,           // Cap at 50%
      },
      
      cost: {
        base: 35,
        scaleFactor: 1.3,
      },
      maxLevel: 6,
      
      color: '#64748b',
    },
  },
};

module.exports = PIERCING_ATTACK_CONFIG;

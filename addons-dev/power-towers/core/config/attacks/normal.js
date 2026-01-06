/**
 * Power Towers TD - Normal Attack Configuration
 * 
 * Combo System & Focus Fire mechanics
 * Best for: Single-target sustained damage, boss killing
 */

const NORMAL_ATTACK_CONFIG = {
  // ╔════════════════════════════════════════════════════════════════════════╗
  // ║                        COMBO SYSTEM                                    ║
  // ║  Each hit on same target increases damage                              ║
  // ╚════════════════════════════════════════════════════════════════════════╝
  
  combo: {
    enabled: true,
    baseDmgPerStack: 0.05,      // +5% damage per stack (base)
    maxStacks: 10,              // Max stacks (before upgrades)
    decayTime: 2.0,             // Seconds before losing stacks
    
    // Stack persistence
    decayRate: 1,               // Stacks lost per decay interval
    fullDecayOnTargetChange: false,  // If true, lose ALL stacks on target change
  },
  
  // ╔════════════════════════════════════════════════════════════════════════╗
  // ║                        FOCUS FIRE                                      ║
  // ║  Guaranteed crit after X hits on same target                           ║
  // ╚════════════════════════════════════════════════════════════════════════╝
  
  focusFire: {
    enabled: true,
    baseHitsRequired: 5,        // Hits needed to trigger (base)
    baseCritBonus: 0.5,         // +50% extra crit damage on focus fire
    
    // Visual
    effectColor: '#ffd700',     // Gold color for focus fire
    effectSize: 30,             // Burst effect size
  },
  
  // ╔════════════════════════════════════════════════════════════════════════╗
  // ║                      UPGRADE DEFINITIONS                               ║
  // ╚════════════════════════════════════════════════════════════════════════╝
  
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
  
  // ╔════════════════════════════════════════════════════════════════════════╗
  // ║                      VISUAL COLORS                                     ║
  // ╚════════════════════════════════════════════════════════════════════════╝
  
  // Projectile colors based on combo stacks
  comboColors: [
    '#87ceeb',  // 0 stacks - light blue
    '#6ab0e8',  // 1-2 stacks
    '#4d96e1',  // 3-4 stacks
    '#3080d9',  // 5-6 stacks
    '#1a6ad1',  // 7-8 stacks
    '#0055c9'   // 9+ stacks - deep blue
  ],
};

module.exports = NORMAL_ATTACK_CONFIG;

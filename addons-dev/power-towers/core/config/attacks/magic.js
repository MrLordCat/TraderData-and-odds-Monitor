/**
 * Power Towers TD - Magic Attack Configuration
 * 
 * Energy charging system with Arcane Overflow
 * Best for: High burst damage with energy investment
 */

const MAGIC_ATTACK_CONFIG = {
  // ╔════════════════════════════════════════════════════════════════════════╗
  // ║                       STAT MODIFIERS                                   ║
  // ╚════════════════════════════════════════════════════════════════════════╝
  
  statModifiers: {
    attackSpeed: 0.7,      // Slower attack speed
    damage: 0.9,           // Slightly lower base damage
    range: 1.2,            // Extended range
    energyStorage: 1.2,    // More energy capacity
  },
  
  // ╔════════════════════════════════════════════════════════════════════════╗
  // ║                       CHARGE SYSTEM                                    ║
  // ╚════════════════════════════════════════════════════════════════════════╝
  
  charge: {
    // Shot Cost = (DMG / dmgDivisor) + chargePercent + (chargePercent² / 100)
    dmgDivisor: 50,              // Divisor for damage component
    minChargePercent: 1,         // Minimum charge setting (%)
    maxChargePercent: 100,       // Maximum charge setting (%)
    defaultChargePercent: 50,    // Default charge setting (%)
    
    // Charge accumulation
    chargeRate: 1.0,             // Energy units accumulated per tick (base)
    chargeFromConnection: true,  // Can charge from connected energy buildings
  },
  
  // ╔════════════════════════════════════════════════════════════════════════╗
  // ║                     ENERGY EFFICIENCY                                  ║
  // ╚════════════════════════════════════════════════════════════════════════╝
  
  efficiency: {
    // Final Damage = DMG + (shotCost / efficiencyDivisor)
    baseDivisor: 2.0,            // Base efficiency divisor
    minDivisor: 0.5,             // Minimum divisor (after upgrades)
  },
  
  // ╔════════════════════════════════════════════════════════════════════════╗
  // ║                      ARCANE OVERFLOW                                   ║
  // ╚════════════════════════════════════════════════════════════════════════╝
  
  arcaneOverflow: {
    enabled: true,
    baseRadius: 80,              // Search radius for overflow target (px)
    baseDamageTransfer: 0.75,    // 75% of overkill damage transfers
    targetNearest: true,         // Target nearest enemy to killed one
  },
  
  // ╔════════════════════════════════════════════════════════════════════════╗
  // ║                       VISUAL EFFECTS                                   ║
  // ╚════════════════════════════════════════════════════════════════════════╝
  
  visuals: {
    chargeBarColor: '#9f7aea',          // Purple charge bar
    chargeBarGlowColor: '#805ad5',      // Glow color
    chargeGlowIntensity: 0.8,           // Max glow intensity at full charge
    particleColor: '#b794f4',           // Charging particles
    overflowArcColor: '#e9d8fd',        // Arc to overflow target
  },
  
  // ╔════════════════════════════════════════════════════════════════════════╗
  // ║                      UPGRADE DEFINITIONS                               ║
  // ╚════════════════════════════════════════════════════════════════════════╝
  
  upgrades: {
    // Energy Efficiency - reduces divisor (more damage per energy)
    energyEfficiency: {
      id: 'energyEfficiency',
      name: 'Arcane Efficiency',
      description: 'Improves energy to damage conversion',
      maxLevel: 10,
      cost: { base: 40, scaleFactor: 1.25 },
      requires: null,
      effect: {
        type: 'efficiencyDivisor',
        valuePerLevel: -0.1,   // -0.1 divisor per level (2.0 → 1.0 at max)
      },
    },
    
    // Overflow Range - increases overflow search radius
    overflowRange: {
      id: 'overflowRange',
      name: 'Overflow Reach',
      description: 'Increases Arcane Overflow target range',
      maxLevel: 5,
      cost: { base: 35, scaleFactor: 1.3 },
      requires: null,
      effect: {
        type: 'overflowRadius',
        valuePerLevel: 20,    // +20px per level
      },
    },
    
    // Overflow Damage - increases damage transfer percentage
    overflowDamage: {
      id: 'overflowDamage',
      name: 'Arcane Cascade',
      description: 'Increases overflow damage transfer',
      maxLevel: 5,
      cost: { base: 45, scaleFactor: 1.35 },
      requires: null,
      effect: {
        type: 'overflowTransfer',
        valuePerLevel: 0.1,   // +10% transfer per level (75% → 125% at max)
      },
    },
    
    // Charge Speed - faster energy accumulation
    chargeSpeed: {
      id: 'chargeSpeed',
      name: 'Quick Charge',
      description: 'Faster energy charging',
      maxLevel: 5,
      cost: { base: 30, scaleFactor: 1.25 },
      requires: null,
      effect: {
        type: 'chargeRate',
        valuePerLevel: 0.15,  // +15% charge rate per level
      },
    },
  },
};

module.exports = MAGIC_ATTACK_CONFIG;


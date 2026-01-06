/**
 * Power Towers TD - Energy System Configuration
 * 
 * Energy buildings (Generator, Battery, Relay), upgrades, power bonuses
 */

const ENERGY_CONFIG = {
  // ╔════════════════════════════════════════════════════════════════════════╗
  // ║                   ENERGY BUILDING LEVEL BONUSES                        ║
  // ╚════════════════════════════════════════════════════════════════════════╝
  
  ENERGY_LEVEL_BONUS_PERCENT: 0.02,  // +2% per level to all stats
  ENERGY_RANGE_PER_LEVEL: 0.2,       // +0.2 range per level (flat)
  
  // ╔════════════════════════════════════════════════════════════════════════╗
  // ║                  ENERGY BUILDING UPGRADE BONUSES                       ║
  // ╚════════════════════════════════════════════════════════════════════════╝
  
  ENERGY_UPGRADE_BONUSES: {
    inputRate: 0.05,     // +5% per level
    outputRate: 0.05,    // +5% per level
    capacity: 0.10,      // +10% per level
    range: 1,            // +1 per level (flat)
    channels: 1,         // +1 input AND +1 output per level
    efficiency: 0.10,    // +10% per level
    generation: 0.15,    // +15% per level
  },
  
  // ╔════════════════════════════════════════════════════════════════════════╗
  // ║               ENERGY BUILDING UPGRADE COSTS (Bottom Panel)             ║
  // ╚════════════════════════════════════════════════════════════════════════╝
  
  ENERGY_UPGRADE_COSTS: {
    capacity: 30,
    output: 40,
    channels: 60,
    range: 50,
    efficiency: 35,
    generation: 45,
  },
  ENERGY_UPGRADE_COST_MULTIPLIER: 1.2,  // Cost multiplier per level
  
  // ╔════════════════════════════════════════════════════════════════════════╗
  // ║            ENERGY TOOLTIP UPGRADES (legacy system)                     ║
  // ╚════════════════════════════════════════════════════════════════════════╝
  
  ENERGY_TOOLTIP_COSTS: {
    capacity: 20,
    outputRate: 25,
    range: 30,
    channels: 50,
  },
  ENERGY_TOOLTIP_MAX_LEVELS: {
    capacity: 5,
    outputRate: 5,
    range: 5,
  },
  ENERGY_TOOLTIP_COST_MULTIPLIER: 1.5,
  
  // ╔════════════════════════════════════════════════════════════════════════╗
  // ║                     XP FOR ENERGY BUILDINGS                            ║
  // ╚════════════════════════════════════════════════════════════════════════╝
  
  ENERGY_XP_PER_100_ENERGY: 2,    // 1 XP per 100 energy processed
  ENERGY_XP_PER_LEVEL: 10,        // XP needed per level
  ENERGY_MAX_LEVEL: 20,           // Max level from XP
  
  // ╔════════════════════════════════════════════════════════════════════════╗
  // ║                    TOWER POWER BONUSES                                 ║
  // ╚════════════════════════════════════════════════════════════════════════╝
  
  TOWER_POWER_BONUSES: {
    powered: {
      damage: 1.1,      // +10% damage when powered
      fireRate: 1.15,   // +15% fire rate
    },
    unpowered: {
      damage: 0.9,      // -10% damage when unpowered
      fireRate: 0.8,    // -20% fire rate
    },
  },
  TOWER_OVERCHARGE_BONUS_SCALE: 0.5,  // Overcharge bonus = (multiplier - 1) * 0.5
  TOWER_MAX_POWER_DRAW_MULTIPLIER: 2, // Max power draw multiplier
};

module.exports = ENERGY_CONFIG;

/**
 * Power Towers TD - Tower Configuration
 * 
 * Tower base stats, level bonuses, upgrade bonuses, caps
 */

const TOWER_CONFIG = {
  // ╔════════════════════════════════════════════════════════════════════════╗
  // ║                         BASE STATS                                     ║
  // ╚════════════════════════════════════════════════════════════════════════╝
  
  TOWER_BASE_DAMAGE: 10,
  TOWER_BASE_RANGE: 60,
  TOWER_BASE_FIRE_RATE: 1,
  TOWER_BASE_ENERGY_COST: 2,
  TOWER_BASE_HP: 100,
  TOWER_BASE_MAX_ENERGY: 50,
  TOWER_BASE_CRIT_CHANCE: 0.05,
  TOWER_BASE_CRIT_DAMAGE: 1.5,
  
  // ╔════════════════════════════════════════════════════════════════════════╗
  // ║                        LEVEL BONUSES                                   ║
  // ╚════════════════════════════════════════════════════════════════════════╝
  
  TOWER_LEVEL_BONUS_PERCENT: 0.02,     // +2% per tower level to base stats
  
  // ╔════════════════════════════════════════════════════════════════════════╗
  // ║                    UPGRADE BONUSES (per level)                         ║
  // ╚════════════════════════════════════════════════════════════════════════╝
  
  TOWER_UPGRADE_BONUSES: {
    damage: 0.05,           // +5% per level
    attackSpeed: 0.04,      // +4% per level
    range: 0.05,            // +5% per level
    hp: 0.08,               // +8% per level
    critChance: 0.01,       // +1% per level (additive)
    critDamage: 0.1,        // +10% per level (additive to multiplier)
    splashRadius: 0.08,     // +8% per level
    splashFalloff: -0.05,   // -5% falloff per level (additive, negative)
    chainCount: 1,          // +1 per level (flat)
    powerScaling: 0.10,     // +10% per level
    energyStorage: 0.10,    // +10% per level
    powerEfficiency: 0.03,  // -3% energy cost per level
    // Siege Armor Shred
    shredAmount: 0.02,      // +2% armor reduction per level
    shredStacks: 1,         // +1 max stack per level
    shredDuration: 1000,    // +1s duration per level (in ms)
    // Siege Ground Zone
    groundZoneRadius: 5,    // +5 radius per level
    groundZoneDuration: 500, // +0.5s duration per level (in ms)
    groundZoneSlow: 0.05,   // +5% slow per level
  },
  
  // ╔════════════════════════════════════════════════════════════════════════╗
  // ║                          STAT CAPS                                     ║
  // ╚════════════════════════════════════════════════════════════════════════╝
  
  TOWER_CRIT_CHANCE_CAP: 0.75,      // 75% max crit chance
  TOWER_CHAIN_COUNT_CAP: 10,        // Max chain targets
  TOWER_POWER_EFFICIENCY_CAP: 0.8,  // Max 80% energy cost reduction
  TOWER_BASE_POWER_COST_RATIO: 0.5, // Energy cost per shot = damage * this
  
  // ╔════════════════════════════════════════════════════════════════════════╗
  // ║                       XP & LEVELING                                    ║
  // ╚════════════════════════════════════════════════════════════════════════╝
  
  // Global XP multiplier (applies to all XP gains)
  XP_MULTIPLIER: 2,
  
  // Tower XP scaling
  TOWER_BASE_XP: 10,               // XP needed for level 2
  TOWER_XP_SCALE: 1.1,            // Each level needs X times more XP
  TOWER_MAX_LEVEL: 100,            // Max tower level
};

module.exports = TOWER_CONFIG;

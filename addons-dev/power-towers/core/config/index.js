/**
 * Power Towers TD - Configuration Entry Point
 * 
 * Aggregates all configuration files into one unified CONFIG object.
 * All game files should import from this file:
 * 
 *   const CONFIG = require('./config');  // from core folder
 *   const CONFIG = require('../config'); // from core subfolder
 * 
 * Structure:
 *   config/
 *   ├── index.js      <- THIS FILE (entry point)
 *   ├── base.js       <- Map, display, visuals
 *   ├── economy.js    <- Gold, costs
 *   ├── waves.js      <- Enemies, spawning
 *   ├── tower.js      <- Tower stats, upgrades
 *   ├── energy.js     <- Energy system
 *   └── attacks/
 *       ├── index.js  <- Attack type aggregator
 *       ├── normal.js <- Normal attack
 *       ├── siege.js  <- Siege attack
 *       ├── magic.js  <- Magic attack
 *       └── piercing.js <- Piercing attack
 */

// Import all config modules
const BASE_CONFIG = require('./base');
const ECONOMY_CONFIG = require('./economy');
const WAVES_CONFIG = require('./waves');
const TOWER_CONFIG = require('./tower');
const ENERGY_CONFIG = require('./energy');

// Import attack configs with helpers
const {
  ATTACK_TYPE_CONFIG,
  NORMAL_ATTACK_CONFIG,
  SIEGE_ATTACK_CONFIG,
  MAGIC_ATTACK_CONFIG,
  PIERCING_ATTACK_CONFIG,
  getAttackTypeUpgrades,
  calculateAttackTypeUpgradeCost,
  applyAttackTypeUpgradeEffect,
  getNormalAttackStats,
} = require('./attacks');

// ╔════════════════════════════════════════════════════════════════════════════╗
// ║                        UNIFIED CONFIG OBJECT                               ║
// ╚════════════════════════════════════════════════════════════════════════════╝

const CONFIG = {
  // Spread all configs into one flat object for backwards compatibility
  ...BASE_CONFIG,
  ...ECONOMY_CONFIG,
  ...WAVES_CONFIG,
  ...TOWER_CONFIG,
  ...ENERGY_CONFIG,
  
  // Attack type config as nested object
  ATTACK_TYPE_CONFIG,
};

// Copy computed properties (getters)
Object.defineProperties(CONFIG, {
  VISUAL_MAP_WIDTH: {
    get() { return this.MAP_WIDTH * (1 + this.VISUAL_PADDING * 2); }
  },
  VISUAL_MAP_HEIGHT: {
    get() { return this.MAP_HEIGHT * (1 + this.VISUAL_PADDING * 2); }
  },
  BUILDABLE_OFFSET_X: {
    get() { return this.MAP_WIDTH * this.VISUAL_PADDING; }
  },
  BUILDABLE_OFFSET_Y: {
    get() { return this.MAP_HEIGHT * this.VISUAL_PADDING; }
  },
});

// ╔════════════════════════════════════════════════════════════════════════════╗
// ║                              EXPORTS                                       ║
// ╚════════════════════════════════════════════════════════════════════════════╝

module.exports = CONFIG;

// Also export individual configs and helpers for direct access
module.exports.BASE_CONFIG = BASE_CONFIG;
module.exports.ECONOMY_CONFIG = ECONOMY_CONFIG;
module.exports.WAVES_CONFIG = WAVES_CONFIG;
module.exports.TOWER_CONFIG = TOWER_CONFIG;
module.exports.ENERGY_CONFIG = ENERGY_CONFIG;
module.exports.ATTACK_TYPE_CONFIG = ATTACK_TYPE_CONFIG;
module.exports.NORMAL_ATTACK_CONFIG = NORMAL_ATTACK_CONFIG;
module.exports.SIEGE_ATTACK_CONFIG = SIEGE_ATTACK_CONFIG;
module.exports.MAGIC_ATTACK_CONFIG = MAGIC_ATTACK_CONFIG;
module.exports.PIERCING_ATTACK_CONFIG = PIERCING_ATTACK_CONFIG;

// Helper functions
module.exports.getAttackTypeUpgrades = getAttackTypeUpgrades;
module.exports.calculateAttackTypeUpgradeCost = calculateAttackTypeUpgradeCost;
module.exports.applyAttackTypeUpgradeEffect = applyAttackTypeUpgradeEffect;
module.exports.getNormalAttackStats = getNormalAttackStats;

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
 *   ├── waves.js      <- Enemies, spawning (legacy)
 *   ├── tower.js      <- Tower stats, upgrades
 *   ├── energy.js     <- Energy system
 *   ├── attacks/      <- Attack type configs
 *   ├── enemies/      <- Enemy configs (NEW)
 *   │   ├── base/     <- Base enemy types
 *   │   ├── special/  <- Special enemy types
 *   │   ├── bosses/   <- Boss configs
 *   │   └── elite.js  <- Elite system
 *   └── waves/        <- Wave system (NEW)
 *       ├── auras/    <- Wave auras
 *       ├── scaling.js
 *       ├── compositions.js
 *       └── generation.js
 */

// Import all config modules
const BASE_CONFIG = require('./base');
const ECONOMY_CONFIG = require('./economy');
const WAVES_LEGACY_CONFIG = require('./waves-legacy');  // Legacy wave config
const TOWER_CONFIG = require('./tower');
const ENERGY_CONFIG = require('./energy');
const UPGRADES_CONFIG = require('./upgrades');

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

// Import new modular enemy system
const {
  BASE_ENEMIES,
  SPECIAL_MODIFIERS,
  ELITE_CONFIG,
  BOSSES,
  BOSS_WAVES,
  ENEMY_TYPES,
  createEnemyData,
  rollForElite,
  applyEliteModifiers,
  isBossWave,
  getBossConfig,
} = require('./enemies');

// Import new modular wave system
const {
  WAVE_CONFIG,
  AURAS,
  SCALING,
  WAVE_COMPOSITIONS,
  SPAWN_PATTERNS,
  generateWave,
  getWavePreview,
  selectAurasForWave,
  applyAurasToEnemy,
} = require('./waves');

// ╔════════════════════════════════════════════════════════════════════════════╗
// ║                        UNIFIED CONFIG OBJECT                               ║
// ╚════════════════════════════════════════════════════════════════════════════╝

const CONFIG = {
  // Spread all configs into one flat object for backwards compatibility
  ...BASE_CONFIG,
  ...ECONOMY_CONFIG,
  ...WAVES_LEGACY_CONFIG,
  ...TOWER_CONFIG,
  ...ENERGY_CONFIG,
  ...UPGRADES_CONFIG,
  
  // Attack type config as nested object
  ATTACK_TYPE_CONFIG,
  
  // New modular systems (nested for organization)
  enemies: {
    BASE_ENEMIES,
    SPECIAL_MODIFIERS,
    ELITE_CONFIG,
    BOSSES,
    BOSS_WAVES,
  },
  waves: {
    WAVE_CONFIG,
    AURAS,
    SCALING,
    WAVE_COMPOSITIONS,
    SPAWN_PATTERNS,
  },
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
module.exports.WAVES_LEGACY_CONFIG = WAVES_LEGACY_CONFIG;
module.exports.TOWER_CONFIG = TOWER_CONFIG;
module.exports.ENERGY_CONFIG = ENERGY_CONFIG;
module.exports.UPGRADES_CONFIG = UPGRADES_CONFIG;
module.exports.DISCOUNT_CONFIG = UPGRADES_CONFIG.DISCOUNT_CONFIG;
module.exports.COST_CONFIG = UPGRADES_CONFIG.COST_CONFIG;
module.exports.TOWER_LEVEL_CONFIG = UPGRADES_CONFIG.TOWER_LEVEL_CONFIG;
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

// New enemy system helpers
module.exports.BASE_ENEMIES = BASE_ENEMIES;
module.exports.ENEMY_TYPES = ENEMY_TYPES;
module.exports.BOSSES = BOSSES;
module.exports.BOSS_WAVES = BOSS_WAVES;
module.exports.createEnemyData = createEnemyData;
module.exports.rollForElite = rollForElite;
module.exports.applyEliteModifiers = applyEliteModifiers;
module.exports.isBossWave = isBossWave;
module.exports.getBossConfig = getBossConfig;

// New wave system helpers
module.exports.WAVE_CONFIG = WAVE_CONFIG;
module.exports.AURAS = AURAS;
module.exports.SCALING = SCALING;
module.exports.WAVE_COMPOSITIONS = WAVE_COMPOSITIONS;
module.exports.generateWave = generateWave;
module.exports.getWavePreview = getWavePreview;
module.exports.selectAurasForWave = selectAurasForWave;
module.exports.applyAurasToEnemy = applyAurasToEnemy;

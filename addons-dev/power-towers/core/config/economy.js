/**
 * Power Towers TD - Economy Configuration
 * 
 * Gold, costs, starting values, upgrade costs
 */

const ECONOMY_CONFIG = {
  // ╔════════════════════════════════════════════════════════════════════════╗
  // ║                           ECONOMY                                      ║
  // ╚════════════════════════════════════════════════════════════════════════╝
  
  // Starting resources
  STARTING_GOLD: 4000,
  STARTING_LIVES: 200,
  
  // Tower costs
  BASE_TOWER_COST: 30,
  UPGRADE_COST_MULTIPLIER: 1.5,
  
  // Tower upgrade cost discounts (per tower level)
  TOWER_UPGRADE_DISCOUNT_PER_LEVEL: 0.05,  // 5% discount per tower level
  TOWER_UPGRADE_MAX_DISCOUNT: 0.5,          // Max 50% discount
  
  // Menu/meta upgrades (permanent gems system)
  MENU_UPGRADE_COST_MULTIPLIER: 1.5,  // Cost scaling per level
};

module.exports = ECONOMY_CONFIG;

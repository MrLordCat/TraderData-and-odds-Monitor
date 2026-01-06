/**
 * Power Towers TD - Magic Attack Configuration
 * 
 * Power scaling mechanics
 * Best for: High damage with energy investment
 */

const MAGIC_ATTACK_CONFIG = {
  // ╔════════════════════════════════════════════════════════════════════════╗
  // ║                       POWER SCALING                                    ║
  // ╚════════════════════════════════════════════════════════════════════════╝
  
  powerScaling: {
    enabled: true,
    baseScaling: 1.5,           // Damage scales 1.5x with power
    overdriveEnabled: true,     // Can consume extra power for bonus damage
    overdriveMultiplier: 2.0,   // Max overdrive multiplier
  },
  
  // ╔════════════════════════════════════════════════════════════════════════╗
  // ║                      UPGRADE DEFINITIONS                               ║
  // ╚════════════════════════════════════════════════════════════════════════╝
  
  upgrades: {
    // TODO: Add magic-specific upgrades
    // powerScaling, overdrive, etc.
  },
};

module.exports = MAGIC_ATTACK_CONFIG;

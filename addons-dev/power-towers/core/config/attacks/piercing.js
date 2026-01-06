/**
 * Power Towers TD - Piercing Attack Configuration
 * 
 * Critical hit mechanics
 * Best for: High burst damage, lucky kills
 */

const PIERCING_ATTACK_CONFIG = {
  // ╔════════════════════════════════════════════════════════════════════════╗
  // ║                       CRITICAL SYSTEM                                  ║
  // ╚════════════════════════════════════════════════════════════════════════╝
  
  critical: {
    enabled: true,
    baseCritChance: 0.15,       // 15% base crit chance (higher than normal)
    baseCritDamage: 2.5,        // 250% crit damage (higher than normal)
    armorPenetration: 0.2,      // 20% armor ignore
  },
  
  // ╔════════════════════════════════════════════════════════════════════════╗
  // ║                      UPGRADE DEFINITIONS                               ║
  // ╚════════════════════════════════════════════════════════════════════════╝
  
  upgrades: {
    // TODO: Add piercing-specific upgrades
    // critChance, critDamage, armorPen, etc.
  },
};

module.exports = PIERCING_ATTACK_CONFIG;

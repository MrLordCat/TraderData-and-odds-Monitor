/**
 * Power Towers TD - Siege Attack Configuration
 * 
 * Splash damage mechanics
 * Best for: Crowd control, swarm clearing
 */

const SIEGE_ATTACK_CONFIG = {
  // ╔════════════════════════════════════════════════════════════════════════╗
  // ║                        SPLASH DAMAGE                                   ║
  // ╚════════════════════════════════════════════════════════════════════════╝
  
  splash: {
    enabled: true,
    baseRadius: 60,             // Base splash radius
    baseFalloff: 0.5,           // Damage falloff at edge (50%)
    minDamagePercent: 0.25,     // Minimum damage at edge
  },
  
  // ╔════════════════════════════════════════════════════════════════════════╗
  // ║                      UPGRADE DEFINITIONS                               ║
  // ╚════════════════════════════════════════════════════════════════════════╝
  
  upgrades: {
    // TODO: Add siege-specific upgrades
    // splashRadius, splashFalloff, etc.
  },
};

module.exports = SIEGE_ATTACK_CONFIG;

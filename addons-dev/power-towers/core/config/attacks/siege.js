/**
 * Power Towers TD - Siege Attack Configuration
 * 
 * Splash damage mechanics with Armor Shred and Ground Zone
 * Best for: Crowd control, swarm clearing, armor reduction
 * 
 * UNIQUE MECHANICS:
 * - Splash Damage: AoE damage with falloff
 * - Armor Shred: Reduces enemy armor in splash zone (stacks)
 * - Ground Zone: Leaves slowing crater after explosion
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
  // ║                        ARMOR SHRED                                     ║
  // ║  Reduces enemy armor on hit, making them take more damage              ║
  // ╚════════════════════════════════════════════════════════════════════════╝
  
  armorShred: {
    enabled: true,
    baseAmount: 0.05,           // -5% armor per hit (base)
    maxStacks: 5,               // Max 5 stacks = -25% armor (base)
    duration: 4000,             // 4 seconds duration
    stackable: true,            // Multiple hits stack
    refreshOnHit: true,         // Hitting refreshes duration
  },
  
  // ╔════════════════════════════════════════════════════════════════════════╗
  // ║                        GROUND ZONE (CRATER)                            ║
  // ║  Leaves a slowing zone on the ground after explosion                   ║
  // ╚════════════════════════════════════════════════════════════════════════╝
  
  groundZone: {
    enabled: false,             // Disabled by default, unlocked via upgrade
    baseRadius: 40,             // Zone radius (smaller than splash)
    baseDuration: 2000,         // 2 seconds
    baseSlowPercent: 0.25,      // 25% slow
    // No damage - purely utility
  },
  
  // ╔════════════════════════════════════════════════════════════════════════╗
  // ║                      UPGRADE DEFINITIONS                               ║
  // ╚════════════════════════════════════════════════════════════════════════╝
  
  upgrades: {
    // === SPLASH UPGRADES ===
    splashRadius: {
      name: 'Blast Radius',
      emoji: '💫',
      description: 'Increases explosion radius',
      effect: { stat: 'splashRadius', valuePerLevel: 8 },  // +8 radius per level
      cost: { base: 30, scaleFactor: 1.2 },
    },
    splashFalloff: {
      name: 'Concentrated Blast',
      emoji: '🎯',
      description: 'Reduces damage falloff at edges',
      effect: { stat: 'splashFalloff', valuePerLevel: -0.05 },  // -5% falloff per level
      cost: { base: 35, scaleFactor: 1.25 },
    },
    
    // === ARMOR SHRED UPGRADES ===
    shredAmount: {
      name: 'Sunder',
      emoji: '🔨',
      description: 'Increases armor reduction per hit',
      effect: { stat: 'armorShredAmount', valuePerLevel: 0.02 },  // +2% per level
      cost: { base: 40, scaleFactor: 1.3 },
    },
    shredStacks: {
      name: 'Deep Wounds',
      emoji: '💀',
      description: 'Increases maximum armor shred stacks',
      effect: { stat: 'armorShredMaxStacks', valuePerLevel: 1 },  // +1 max stack
      cost: { base: 50, scaleFactor: 1.4 },
    },
    shredDuration: {
      name: 'Lasting Impact',
      emoji: '⏱️',
      description: 'Increases armor shred duration',
      effect: { stat: 'armorShredDuration', valuePerLevel: 1000 },  // +1 sec
      cost: { base: 35, scaleFactor: 1.2 },
    },
    
    // === GROUND ZONE UPGRADES ===
    groundZoneUnlock: {
      name: 'Crater Zone',
      emoji: '🕳️',
      description: 'Explosions leave slowing zones on the ground',
      effect: { stat: 'groundZoneEnabled', valuePerLevel: 1 },  // Unlock at level 1
      maxLevel: 1,
      cost: { base: 75, scaleFactor: 1 },
    },
    groundZoneSlow: {
      name: 'Tar Pit',
      emoji: '🦶',
      description: 'Increases ground zone slow effect',
      effect: { stat: 'groundZoneSlow', valuePerLevel: 0.05 },  // +5% slow
      requires: { upgrade: 'groundZoneUnlock', level: 1 },
      cost: { base: 40, scaleFactor: 1.25 },
    },
    groundZoneDuration: {
      name: 'Lingering',
      emoji: '⌛',
      description: 'Increases ground zone duration',
      effect: { stat: 'groundZoneDuration', valuePerLevel: 500 },  // +0.5 sec
      requires: { upgrade: 'groundZoneUnlock', level: 1 },
      cost: { base: 35, scaleFactor: 1.2 },
    },
    groundZoneRadius: {
      name: 'Wide Crater',
      emoji: '⭕',
      description: 'Increases ground zone radius',
      effect: { stat: 'groundZoneRadius', valuePerLevel: 5 },  // +5 radius
      requires: { upgrade: 'groundZoneUnlock', level: 1 },
      cost: { base: 45, scaleFactor: 1.3 },
    },
  },
};

module.exports = SIEGE_ATTACK_CONFIG;


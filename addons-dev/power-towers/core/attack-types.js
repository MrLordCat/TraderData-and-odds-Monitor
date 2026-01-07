/**
 * Power Towers TD - Attack Types Configuration
 * 
 * Defines all attack type modifiers and their properties.
 * All types inherit from BASE and apply their own modifiers.
 * 
 * BALANCE GUIDE:
 * - All values are multipliers applied to BASE stats
 * - dmgMod: 1.0 = 100% base damage
 * - atkSpdMod: 1.0 = 100% base attack speed
 * - critDmgMod: multiplier for critical hit damage (0 = no bonus)
 * - splashRadius: 0 = single target, >0 = AoE radius in pixels
 * - powerScaling: for Magic type - how much extra damage per power%
 * - powerHitCostMod: multiplier for energy cost per shot (base = 50% of damage)
 */

const ATTACK_TYPES = {
  // =========================================
  // BASE - Default attack, no modifications
  // =========================================
  base: {
    id: 'base',
    name: 'Base Attack',
    emoji: '⚪',
    description: 'Standard attack with no modifications',
    
    // Damage modifiers
    dmgMod: 1.0,           // Base damage multiplier
    atkSpdMod: 1.0,        // Attack speed multiplier
    rangeMod: 1.0,         // Range multiplier
    energyCostMod: 1.0,  // Energy cost multiplier
    
    // Power Hit Cost: energy per shot = damage * 0.5 * powerHitCostMod
    powerHitCostMod: 1.0,  // Multiplier for power cost per shot
    
    // Critical hit
    critChance: 0.05,      // 5% base crit chance
    critDmgMod: 1.5,       // 150% damage on crit
    
    // Energy storage
    energyStorageMod: 1.0, // Energy storage multiplier
    
    // AoE / Splash
    splashRadius: 0,       // No splash by default
    splashDmgFalloff: 0,   // Damage reduction per pixel from center (%)
    splashCanCrit: false,  // Can splash damage crit? (unlockable via cards)
    
    // Special mechanics
    chainCount: 0,         // Number of chain targets
    chainDmgFalloff: 0,    // Damage reduction per chain (%)
    
    // Magic system (for Magic type)
    powerScaling: 0,       // Extra damage per power% used
    minPowerDraw: 0,       // Minimum power draw (0-100)
    maxPowerDraw: 100,     // Maximum power draw (overdrive can exceed)
    overdriveEfficiency: 0,// Efficiency above 100% (0 = disabled)
    
    // Visual
    color: '#888888',
    projectileColor: '#cccccc',
    projectileSize: 4,
    projectileSpeed: 300
  },

  // =========================================
  // SIEGE - Area damage, slower attack
  // Unique: Armor Shred + Ground Zone
  // =========================================
  siege: {
    id: 'siege',
    name: 'Siege Attack',
    emoji: '💥',
    description: 'Devastating area damage. Shreds armor and leaves slowing craters',
    
    // Damage modifiers
    dmgMod: 1.2,           // 120% base damage
    atkSpdMod: 0.5,        // 50% attack speed (slower)
    rangeMod: 1.1,         // 110% range
    energyCostMod: 1.5,    // Energy cost multiplier
    
    // Power Hit Cost: Siege costs 40% more energy per shot
    powerHitCostMod: 1.4,  // 140% power cost
    
    // Critical hit
    critChance: 0.03,      // Lower crit chance
    critDmgMod: 1.5,       // Standard crit multiplier
    
    // Energy storage
    energyStorageMod: 0.8, // Less storage (power hungry)
    
    // AoE / Splash
    splashRadius: 60,      // 60px splash radius
    splashDmgFalloff: 0.5, // 50% damage at edge
    splashCanCrit: false,  // Can splash damage crit? (unlockable via cards)
    
    // === ARMOR SHRED (Siege unique) ===
    // Each hit reduces enemy armor, stacks up
    armorShredEnabled: true,
    armorShredAmount: 0.05,      // -5% armor per hit
    armorShredMaxStacks: 5,      // Max stacks = -25% armor
    armorShredDuration: 4000,    // 4 seconds
    armorShredStackable: true,
    
    // === GROUND ZONE (Siege unique) ===
    // Leaves slowing crater after explosion
    groundZoneEnabled: false,    // Unlocked via upgrade
    groundZoneRadius: 40,
    groundZoneDuration: 2000,    // 2 seconds
    groundZoneSlow: 0.25,        // 25% slow
    
    // Special mechanics (unused by Siege)
    chainCount: 0,
    chainDmgFalloff: 0,
    
    // Magic system (unused by Siege)
    powerScaling: 0,
    minPowerDraw: 0,
    maxPowerDraw: 100,
    overdriveEfficiency: 0,
    
    // Visual
    color: '#ff6b35',
    projectileColor: '#ff4500',
    projectileSize: 8,
    projectileSpeed: 200
  },

  // =========================================
  // NORMAL - Single target, faster attack
  // Best against bosses (Combo + Focus Fire)
  // =========================================
  normal: {
    id: 'normal',
    name: 'Normal Attack',
    emoji: '🎯',
    description: 'Fast single-target attacks. Combo stacks increase damage, Focus Fire guarantees crits',
    
    // Damage modifiers
    dmgMod: 0.9,           // 90% base damage
    atkSpdMod: 1.5,        // 150% attack speed (faster)
    rangeMod: 1.0,         // Standard range
    energyCostMod: 0.8,  // Energy cost multiplier
    
    // Power Hit Cost: Normal is efficient
    powerHitCostMod: 0.8,  // 80% power cost
    
    // Critical hit
    critChance: 0.07,      // Slightly higher crit chance
    critDmgMod: 1.5,       // Standard crit multiplier
    
    // Energy storage
    energyStorageMod: 1.0, // Standard storage
    
    // AoE / Splash
    splashRadius: 0,       // Single target
    splashDmgFalloff: 0,
    
    // Special mechanics
    chainCount: 0,
    chainDmgFalloff: 0,
    
    // === COMBO SYSTEM (Normal unique) ===
    // Each consecutive hit on SAME target increases damage
    comboEnabled: true,
    comboDmgPerStack: 0.05,    // +5% damage per stack
    comboMaxStacks: 10,        // Max 10 stacks (+50% damage)
    comboDecayTime: 2.0,       // Lose 1 stack every 2 sec if not attacking same target
    
    // === FOCUS FIRE (Normal unique) ===
    // After X hits on same target, next hit is guaranteed crit
    focusFireEnabled: true,
    focusFireHitsRequired: 5,  // 5 hits to trigger
    focusFireCritBonus: 0.5,   // +50% crit damage on focus fire
    
    // Magic system
    powerScaling: 0,
    minPowerDraw: 0,
    maxPowerDraw: 100,
    overdriveEfficiency: 0,
    
    // Visual
    color: '#4a90d9',
    projectileColor: '#87ceeb',
    projectileSize: 4,
    projectileSpeed: 400,
    
    // Combo visual colors (projectile changes color with stacks)
    comboColors: [
      '#87ceeb',  // 0 stacks - light blue
      '#6ab0e8',  // 1-2 stacks
      '#4d96e1',  // 3-4 stacks
      '#3080d9',  // 5-6 stacks
      '#1a6ad1',  // 7-8 stacks
      '#0055c9'   // 9-10 stacks - deep blue
    ],
    focusFireColor: '#ffd700'  // Gold color for focus fire shot
  },

  // =========================================
  // MAGIC - Energy charging system + Arcane Overflow
  // Charges energy for powerful shots, overkill transfers to nearby enemies
  // =========================================
  magic: {
    id: 'magic',
    name: 'Magic Attack',
    emoji: '✨',
    description: 'Charges energy for powerful shots. Overkill damage chains to nearby enemies',
    
    // Damage modifiers (applied via config/attacks/magic.js statModifiers)
    // These are kept for backwards compatibility but actual values come from config
    dmgMod: 0.9,           // 90% base damage (before charge bonus)
    atkSpdMod: 0.7,        // 70% attack speed (slower - needs time to charge)
    rangeMod: 1.2,         // 120% range (magic reach)
    energyCostMod: 0.5,    // Lower base cost (main cost is from charging)
    
    // Power Hit Cost: Magic uses charge system instead
    powerHitCostMod: 0.5,  // Low base (charge system handles cost)
    
    // Critical hit
    critChance: 0.05,      // Standard crit chance
    critDmgMod: 1.5,       // Standard crit multiplier
    
    // Energy storage - Magic towers store more
    energyStorageMod: 1.2, // 120% storage
    
    // AoE / Splash
    splashRadius: 0,       // Single target (but has Arcane Overflow)
    splashDmgFalloff: 0,
    
    // Special mechanics
    chainCount: 0,
    chainDmgFalloff: 0,
    
    // === CHARGE SYSTEM (Magic unique) ===
    // Configured in core/config/attacks/magic.js
    chargeEnabled: true,
    
    // === ARCANE OVERFLOW (Magic unique) ===
    // Overkill damage transfers to nearest enemy
    arcaneOverflowEnabled: true,
    
    // Legacy magic system (kept for compatibility, not used)
    powerScaling: 0,
    minPowerDraw: 0,
    maxPowerDraw: 100,
    overdriveEfficiency: 0,
    
    // Visual
    color: '#9b59b6',
    projectileColor: '#9f7aea',
    projectileSize: 6,
    projectileSpeed: 350,
    
    // Charge visual colors (glow intensity based on charge)
    chargeColors: [
      '#805ad5',  // 0-25% - dim purple
      '#9f7aea',  // 25-50%
      '#b794f4',  // 50-75%
      '#d6bcfa',  // 75-100% - bright purple
    ],
    overflowArcColor: '#e9d8fd'  // Arc to overflow target
  },

  // =========================================
  // PIERCING - High crit damage
  // =========================================
  piercing: {
    id: 'piercing',
    name: 'Piercing Attack',
    emoji: '🗡️',
    description: 'Precise attacks with devastating critical strikes',
    
    // Damage modifiers
    dmgMod: 0.85,          // 85% base damage
    atkSpdMod: 1.1,        // 110% attack speed
    rangeMod: 0.9,         // 90% range (needs precision)
    energyCostMod: 1.0,  // Energy cost multiplier
    
    // Power Hit Cost: Piercing is efficient
    powerHitCostMod: 0.9,  // 90% power cost
    
    // Critical hit - THIS IS THE KEY FEATURE
    critChance: 0.15,      // 15% crit chance
    critDmgMod: 2.5,       // 250% damage on crit!
    
    // Energy storage
    energyStorageMod: 1.0, // Standard storage
    
    // AoE / Splash
    splashRadius: 0,       // Single target
    splashDmgFalloff: 0,
    
    // Special mechanics
    chainCount: 0,
    chainDmgFalloff: 0,
    
    // Magic system
    powerScaling: 0,
    minPowerDraw: 0,
    maxPowerDraw: 100,
    overdriveEfficiency: 0,
    
    // Visual
    color: '#e74c3c',
    projectileColor: '#ff6b6b',
    projectileSize: 3,
    projectileSpeed: 500
  }
};

/**
 * Get attack type by ID with fallback to base
 * @param {string} attackTypeId 
 * @returns {Object}
 */
function getAttackType(attackTypeId) {
  return ATTACK_TYPES[attackTypeId] || ATTACK_TYPES.base;
}

/**
 * Merge two attack types for dual-type towers
 * Primary type provides base modifiers, secondary adds partial bonuses
 * @param {string} primaryTypeId - Main attack type
 * @param {string} secondaryTypeId - Secondary attack type (partial effects)
 * @param {number} secondaryWeight - How much of secondary to apply (0.0-1.0, default 0.5)
 * @returns {Object} Merged attack type config
 */
function mergeAttackTypes(primaryTypeId, secondaryTypeId, secondaryWeight = 0.5) {
  const primary = getAttackType(primaryTypeId);
  const secondary = getAttackType(secondaryTypeId);
  
  // Start with primary as base
  const merged = { ...primary };
  merged.id = `${primaryTypeId}+${secondaryTypeId}`;
  merged.name = `${primary.name} / ${secondary.name}`;
  merged.emoji = `${primary.emoji}${secondary.emoji}`;
  merged.description = `Dual type: ${primary.name} with ${secondary.name} effects`;
  merged.isDualType = true;
  merged.primaryType = primaryTypeId;
  merged.secondaryType = secondaryTypeId;
  merged.secondaryWeight = secondaryWeight;
  
  // Blend numeric modifiers (primary + weighted secondary bonus)
  // Secondary adds partial bonus on top of primary
  const blendMod = (pVal, sVal) => {
    // If secondary is better, add portion of the difference
    const diff = sVal - 1.0; // How much secondary deviates from neutral
    return pVal + (diff * secondaryWeight);
  };
  
  merged.dmgMod = blendMod(primary.dmgMod, secondary.dmgMod);
  merged.atkSpdMod = blendMod(primary.atkSpdMod, secondary.atkSpdMod);
  merged.rangeMod = blendMod(primary.rangeMod, secondary.rangeMod);
  merged.energyCostMod = blendMod(primary.energyCostMod, secondary.energyCostMod);
  
  // Crit: take best of both, scaled
  merged.critChance = Math.max(primary.critChance, primary.critChance + (secondary.critChance - primary.critChance) * secondaryWeight);
  merged.critDmgMod = Math.max(primary.critDmgMod, primary.critDmgMod + (secondary.critDmgMod - primary.critDmgMod) * secondaryWeight);
  
  // AoE: if either has splash, use the larger (scaled)
  merged.splashRadius = Math.max(primary.splashRadius, secondary.splashRadius * secondaryWeight);
  merged.splashDmgFalloff = primary.splashRadius > 0 ? primary.splashDmgFalloff : secondary.splashDmgFalloff;
  
  // Chain: take max
  merged.chainCount = Math.max(primary.chainCount, Math.floor(secondary.chainCount * secondaryWeight));
  merged.chainDmgFalloff = primary.chainCount > 0 ? primary.chainDmgFalloff : secondary.chainDmgFalloff;
  
  // Magic: if either has power scaling, combine
  if (primary.powerScaling > 0 || secondary.powerScaling > 0) {
    merged.powerScaling = primary.powerScaling + (secondary.powerScaling * secondaryWeight);
    merged.overdriveEfficiency = Math.max(primary.overdriveEfficiency, secondary.overdriveEfficiency * secondaryWeight);
  }
  
  // Visual: blend colors
  merged.color = primary.color; // Keep primary color
  merged.projectileColor = primary.projectileColor;
  
  return merged;
}

/**
 * Calculate final stats for a tower with given attack type
 * @param {Object} baseStats - Base tower stats {damage, fireRate, range, energyCost}
 * @param {string} attackTypeId - Attack type ID
 * @returns {Object} Modified stats
 */
function applyAttackTypeModifiers(baseStats, attackTypeId) {
  const attackType = getAttackType(attackTypeId);
  
  return {
    // Apply multipliers to base stats
    damage: baseStats.damage * attackType.dmgMod,
    fireRate: baseStats.fireRate * attackType.atkSpdMod,
    range: baseStats.range * attackType.rangeMod,
    energyCost: baseStats.energyCost * attackType.energyCostMod,
    
    // Copy all attack type properties
    attackType: attackType.id,
    critChance: attackType.critChance,
    critDmgMod: attackType.critDmgMod,
    splashRadius: attackType.splashRadius,
    splashDmgFalloff: attackType.splashDmgFalloff,
    chainCount: attackType.chainCount,
    chainDmgFalloff: attackType.chainDmgFalloff,
    powerScaling: attackType.powerScaling,
    minPowerDraw: attackType.minPowerDraw,
    maxPowerDraw: attackType.maxPowerDraw,
    overdriveEfficiency: attackType.overdriveEfficiency,
    
    // Visual properties
    projectileColor: attackType.projectileColor,
    projectileSize: attackType.projectileSize,
    projectileSpeed: attackType.projectileSpeed
  };
}

/**
 * Calculate magic damage with power draw
 * @param {number} baseDamage - Tower's current damage
 * @param {number} powerDraw - Power draw percentage (0-200 with overdrive)
 * @param {Object} attackType - Attack type config
 * @returns {Object} {finalDamage, powerCost, isOverdrive}
 */
function calculateMagicDamage(baseDamage, powerDraw, attackType) {
  const maxNormal = attackType.maxPowerDraw || 100;
  const overdriveEff = attackType.overdriveEfficiency || 0;
  
  let effectivePower = Math.min(powerDraw, maxNormal);
  let overdrivePower = 0;
  let isOverdrive = false;
  
  // Handle overdrive
  if (powerDraw > maxNormal && overdriveEff > 0) {
    overdrivePower = (powerDraw - maxNormal) * overdriveEff;
    effectivePower = maxNormal + overdrivePower;
    isOverdrive = true;
  }
  
  // Calculate final damage
  // Base damage + (base damage * powerScaling * (effectivePower / 100))
  const powerBonus = baseDamage * attackType.powerScaling * (effectivePower / 100);
  const finalDamage = baseDamage + powerBonus;
  
  return {
    finalDamage,
    powerCost: powerDraw,
    effectivePower,
    isOverdrive,
    powerBonus
  };
}

/**
 * Calculate splash damage for targets at distance
 * @param {number} baseDamage - Base splash damage
 * @param {number} distance - Distance from center
 * @param {Object} attackType - Attack type config
 * @returns {number} Damage after falloff
 */
function calculateSplashDamage(baseDamage, distance, attackType) {
  if (attackType.splashRadius <= 0) return 0;
  if (distance > attackType.splashRadius) return 0;
  
  // Calculate falloff
  const falloffPercent = attackType.splashDmgFalloff || 0;
  const distanceRatio = distance / attackType.splashRadius;
  const damageMod = 1 - (distanceRatio * falloffPercent);
  
  return baseDamage * Math.max(0, damageMod);
}

/**
 * Roll for critical hit
 * @param {Object} attackType - Attack type config
 * @returns {Object} {isCrit, multiplier}
 */
function rollCritical(attackType) {
  const isCrit = Math.random() < attackType.critChance;
  return {
    isCrit,
    multiplier: isCrit ? attackType.critDmgMod : 1.0
  };
}

/**
 * Get all available attack types (for UI)
 * @returns {Array}
 */
function getAvailableAttackTypes() {
  return Object.values(ATTACK_TYPES).map(at => ({
    id: at.id,
    name: at.name,
    emoji: at.emoji,
    description: at.description,
    color: at.color
  }));
}

module.exports = {
  ATTACK_TYPES,
  getAttackType,
  mergeAttackTypes,
  applyAttackTypeModifiers,
  calculateMagicDamage,
  calculateSplashDamage,
  rollCritical,
  getAvailableAttackTypes
};

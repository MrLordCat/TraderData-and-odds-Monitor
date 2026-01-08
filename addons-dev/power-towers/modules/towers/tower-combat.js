/**
 * Power Towers TD - Tower Combat
 * 
 * Handles targeting, attacks, and damage calculations.
 * Includes Combo System and Focus Fire for Normal Attack type.
 */

const { rollCritical, calculateMagicDamage, getAttackType } = require('../../core/attack-types');
const { getElementAbilities, calculateLightningChargeCost, calculateLightningChargeDamage } = require('../../core/element-abilities');
const { ATTACK_TYPE_CONFIG } = require('../../core/config/attacks');

/**
 * Get combo config for tower (considers upgrades)
 * @param {Object} tower - Tower instance
 * @returns {Object} Combo configuration
 */
function getComboConfig(tower) {
  const baseConfig = ATTACK_TYPE_CONFIG.normal?.combo || {};
  const attackType = tower.attackTypeConfig || getAttackType('normal');
  
  return {
    enabled: attackType.comboEnabled ?? baseConfig.enabled ?? true,
    dmgPerStack: tower.comboDmgPerStack ?? attackType.comboDmgPerStack ?? baseConfig.baseDmgPerStack ?? 0.05,
    maxStacks: tower.comboMaxStacks ?? attackType.comboMaxStacks ?? baseConfig.maxStacks ?? 10,
    decayTime: tower.comboDecayTime ?? attackType.comboDecayTime ?? baseConfig.decayTime ?? 2.0,
  };
}

/**
 * Get focus fire config for tower (considers upgrades)
 * @param {Object} tower - Tower instance
 * @returns {Object} Focus fire configuration
 */
function getFocusFireConfig(tower) {
  const baseConfig = ATTACK_TYPE_CONFIG.normal?.focusFire || {};
  const attackType = tower.attackTypeConfig || getAttackType('normal');
  
  return {
    enabled: attackType.focusFireEnabled ?? baseConfig.enabled ?? true,
    hitsRequired: tower.focusFireHitsRequired ?? attackType.focusFireHitsRequired ?? baseConfig.baseHitsRequired ?? 5,
    critBonus: tower.focusFireCritBonus ?? attackType.focusFireCritBonus ?? baseConfig.baseCritBonus ?? 0.5,
  };
}

/**
 * Initialize combo state for a tower (call when tower is created)
 * @param {Object} tower - Tower instance
 */
function initComboState(tower) {
  tower.comboState = {
    targetId: null,         // Current combo target
    stacks: 0,              // Current combo stacks
    lastHitTime: 0,         // Time of last hit
    focusHits: 0,           // Hits towards focus fire
    focusFireReady: false   // Next shot is guaranteed crit
  };
}

/**
 * Update combo decay (call every frame)
 * @param {Object} tower - Tower instance
 * @param {number} deltaTime - Time since last update
 * @param {number} currentTime - Current game time
 */
function updateComboDecay(tower, deltaTime, currentTime) {
  if (!tower.comboState) return;
  if (tower.attackTypeId !== 'normal') return;
  
  const comboConfig = getComboConfig(tower);
  if (!comboConfig.enabled) return;
  
  const decayTime = comboConfig.decayTime;
  const timeSinceHit = currentTime - tower.comboState.lastHitTime;
  
  // Decay stacks if not attacking
  if (timeSinceHit > decayTime && tower.comboState.stacks > 0) {
    // Lose 1 stack per decay interval
    const stacksToLose = Math.floor(timeSinceHit / decayTime);
    tower.comboState.stacks = Math.max(0, tower.comboState.stacks - stacksToLose);
    tower.comboState.lastHitTime = currentTime - (timeSinceHit % decayTime);
    
    // Reset focus hits if combo fully decayed
    if (tower.comboState.stacks === 0) {
      tower.comboState.focusHits = 0;
      tower.comboState.focusFireReady = false;
    }
  }
}

/**
 * Process combo hit (call when tower attacks)
 * @param {Object} tower - Tower instance
 * @param {string} targetId - Current target ID
 * @param {number} currentTime - Current game time
 * @returns {Object} Combo bonuses { damageMultiplier, isFocusFire, comboStacks }
 */
function processComboHit(tower, targetId, currentTime) {
  if (!tower.comboState) {
    initComboState(tower);
  }
  
  const comboConfig = getComboConfig(tower);
  const focusConfig = getFocusFireConfig(tower);
  
  let damageMultiplier = 1;
  let isFocusFire = false;
  
  // Check if same target
  if (tower.comboState.targetId === targetId) {
    // Same target - build combo
    if (comboConfig.enabled) {
      tower.comboState.stacks = Math.min(tower.comboState.stacks + 1, comboConfig.maxStacks);
      
      // Calculate damage bonus
      damageMultiplier = 1 + (tower.comboState.stacks * comboConfig.dmgPerStack);
    }
    
    // Track focus fire hits
    if (focusConfig.enabled) {
      tower.comboState.focusHits++;
      
      if (tower.comboState.focusHits >= focusConfig.hitsRequired) {
        isFocusFire = true;
        tower.comboState.focusHits = 0; // Reset counter
      }
    }
  } else {
    // New target - reset combo
    tower.comboState.targetId = targetId;
    tower.comboState.stacks = 1; // Start at 1 stack
    tower.comboState.focusHits = 1;
    tower.comboState.focusFireReady = false;
    
    // First hit gets base combo bonus
    damageMultiplier = 1 + comboConfig.dmgPerStack;
  }
  
  tower.comboState.lastHitTime = currentTime;
  
  return {
    damageMultiplier,
    isFocusFire,
    comboStacks: tower.comboState.stacks,
    focusHits: tower.comboState.focusHits
  };
}

/**
 * Get projectile color based on combo state
 * @param {Object} tower - Tower instance
 * @param {boolean} isFocusFire - Is this a focus fire shot
 * @returns {string} Hex color
 */
function getComboProjectileColor(tower, isFocusFire) {
  const focusConfig = getFocusFireConfig(tower);
  const comboConfig = getComboConfig(tower);
  
  // Focus fire uses gold color
  if (isFocusFire) {
    return ATTACK_TYPE_CONFIG.normal?.focusFire?.effectColor || '#ffd700';
  }
  
  // Get combo colors from config
  const colors = ATTACK_TYPE_CONFIG.normal?.comboColors || [
    '#87ceeb', '#6ab0e8', '#4d96e1', '#3080d9', '#1a6ad1', '#0055c9'
  ];
  
  if (tower.comboState) {
    const stacks = tower.comboState.stacks || 0;
    const maxStacks = comboConfig.maxStacks;
    
    // Map stacks to color index
    const colorIndex = Math.min(
      Math.floor((stacks / maxStacks) * (colors.length - 1)),
      colors.length - 1
    );
    return colors[colorIndex];
  }
  
  return '#87ceeb';
}

/**
 * Update single tower combat logic
 * @param {Object} tower - Tower instance
 * @param {number} deltaTime - Time since last update
 * @param {Array} enemies - Current enemies
 * @param {Object} context - Combat context with eventBus
 * @param {number} currentTime - Current game time (for combo system)
 */
function updateTowerCombat(tower, deltaTime, enemies, context, currentTime = Date.now() / 1000) {
  const { 
    isValidTarget: checkValid, 
    findTarget: findBestTarget, 
    performAttack: doAttack, 
    eventBus 
  } = context;
  
  // Update combo decay for Normal attack type
  if (tower.attackTypeId === 'normal') {
    updateComboDecay(tower, deltaTime, currentTime);
  }
  
  // Update piercing momentum decay
  if (tower.attackTypeId === 'piercing') {
    updatePiercingDecay(tower, deltaTime, currentTime);
  }
  
  // Reduce cooldown
  if (tower.attackCooldown > 0) {
    tower.attackCooldown -= deltaTime;
  }

  // Find target if none or current target out of range/dead
  if (!tower.target || !checkValid(tower, tower.target, enemies)) {
    tower.target = findBestTarget(tower, enemies);
  }

  // Rotate towards target
  if (tower.target) {
    const dx = tower.target.x - tower.x;
    const dy = tower.target.y - tower.y;
    tower.rotation = Math.atan2(dy, dx);
  }

  // Attack if target and ready
  if (tower.target && tower.attackCooldown <= 0) {
    doAttack(tower, eventBus, currentTime);
  }
}

/**
 * Check if target is still valid
 * @param {Object} tower - Tower instance
 * @param {Object} target - Current target
 * @param {Array} enemies - All enemies
 * @returns {boolean}
 */
function isValidTarget(tower, target, enemies) {
  const enemy = enemies.find(e => e.id === target.id);
  if (!enemy || enemy.health <= 0) return false;

  const dist = Math.sqrt(
    Math.pow(enemy.x - tower.x, 2) + Math.pow(enemy.y - tower.y, 2)
  );
  return dist <= tower.range;
}

/**
 * Find best target for tower
 * @param {Object} tower - Tower instance
 * @param {Array} enemies - All enemies
 * @returns {Object|null} Best target or null
 */
function findTarget(tower, enemies) {
  let bestTarget = null;
  let bestScore = -Infinity;

  for (const enemy of enemies) {
    if (enemy.health <= 0) continue;

    const dist = Math.sqrt(
      Math.pow(enemy.x - tower.x, 2) + Math.pow(enemy.y - tower.y, 2)
    );

    if (dist > tower.range) continue;

    // Score: prefer enemies closest to base (furthest along path)
    const score = (enemy.pathProgress || 0) - dist * 0.01;
    
    if (score > bestScore) {
      bestScore = score;
      bestTarget = enemy;
    }
  }

  return bestTarget;
}

/**
 * Perform attack on current target
 * @param {Object} tower - Tower instance
 * @param {EventBus} eventBus - Event system
 * @param {number} currentTime - Current game time (for combo tracking)
 */
function performAttack(tower, eventBus, currentTime = Date.now() / 1000) {
  if (!tower.target) return;
  
  const elementPath = tower.elementPath || 'none';
  let energyCost = tower.energyCostPerShot;
  let damageMultiplier = 1;
  
  // === MAGIC CHARGE SYSTEM ===
  if (tower.attackTypeId === 'magic') {
    // Magic towers use charge system - check if ready to fire
    if (!isMagicReady(tower)) {
      return; // Not enough charge accumulated
    }
    
    // Get magic attack data
    const magicAttack = consumeMagicCharge(tower);
    
    // Magic uses charge energy, not per-shot energy
    energyCost = 0; // Energy was consumed during charging
    
    // Set damage from charge system
    tower._magicAttackData = magicAttack;
  }
  
  // === LIGHTNING CHARGE SYSTEM ===
  if (elementPath === 'lightning' && tower.lightningChargeEnabled) {
    const chargeConfig = tower.elementAbilities?.charge || {
      baseCost: 20,
      costExponent: 2.5,
      damageExponent: 2.0,
    };
    const chargeTarget = tower.lightningChargeTarget || 50; // % target
    const currentCharge = tower.lightningCurrentCharge || 0;
    
    // Check if we have enough charge
    if (currentCharge < chargeTarget) {
      // Not enough charge, don't fire yet (handled elsewhere)
      return;
    }
    
    // Calculate cost and damage for charged shot
    energyCost = calculateLightningChargeCost(currentCharge, chargeConfig);
    damageMultiplier = calculateLightningChargeDamage(currentCharge, chargeConfig);
    
    // Reset charge after firing
    tower.lightningCurrentCharge = 0;
  }
  
  // Check energy (non-magic towers)
  if (tower.attackTypeId !== 'magic' && tower.currentEnergy < energyCost) {
    return; // Not enough energy
  }
  
  // Deduct energy cost (non-magic)
  if (tower.attackTypeId !== 'magic') {
    tower.currentEnergy -= energyCost;
  }

  // Set cooldown (convert fireRate to seconds)
  tower.attackCooldown = 1 / tower.fireRate;

  // Calculate damage
  let finalDamage = tower.damage * damageMultiplier;
  let isCrit = false;
  let isOverdrive = false;
  let powerCost = 0;
  let comboStacks = 0;
  let isFocusFire = false;
  let magicBonusDamage = 0;
  
  // Piercing-specific variables
  let isPrecision = false;
  let isExecute = false;
  let applyBleed = false;
  let momentumStacks = 0;
  
  // === MAGIC DAMAGE (Charge System) ===
  if (tower.attackTypeId === 'magic' && tower._magicAttackData) {
    finalDamage = tower._magicAttackData.totalDamage * damageMultiplier;
    magicBonusDamage = tower._magicAttackData.bonusDamage;
    powerCost = tower._magicAttackData.energySpent;
    delete tower._magicAttackData; // Clean up temp data
  }
  
  // === COMBO SYSTEM (Normal Attack) ===
  if (tower.attackTypeId === 'normal') {
    const comboResult = processComboHit(tower, tower.target.id, currentTime);
    finalDamage *= comboResult.damageMultiplier;
    comboStacks = comboResult.comboStacks;
    isFocusFire = comboResult.isFocusFire;
  }
  
  // === PIERCING ATTACK SYSTEM ===
  if (tower.attackTypeId === 'piercing') {
    // Get momentum crit bonus before rolling
    const momentumBonus = getMomentumCritBonus(tower);
    
    // Roll crit with momentum bonus
    const piercingCritChance = (tower.attackTypeConfig?.critChance || 0.15) + momentumBonus;
    const wasNaturalCrit = Math.random() < piercingCritChance;
    
    // Process piercing hit (precision, execute, momentum, bleed)
    const piercingResult = processPiercingHit(tower, tower.target, currentTime, wasNaturalCrit);
    
    finalDamage *= piercingResult.damageMultiplier;
    isCrit = piercingResult.isCrit;
    isPrecision = piercingResult.isPrecision;
    isExecute = piercingResult.isExecute;
    applyBleed = piercingResult.applyBleed;
    momentumStacks = piercingResult.momentumStacks;
    
    // Apply crit multiplier
    if (isCrit) {
      const critMult = tower.attackTypeConfig?.critDmgMod || 2.5;
      finalDamage *= critMult;
      tower.totalCrits++;
    }
  }
  
  // === FOCUS FIRE (Guaranteed Crit) ===
  if (isFocusFire) {
    // Focus Fire: Guaranteed critical with bonus damage from config
    const focusConfig = getFocusFireConfig(tower);
    const attackType = tower.attackTypeConfig || getAttackType('normal');
    const baseCritMult = attackType.critDmgMod || 1.5;
    const focusCritMult = baseCritMult + focusConfig.critBonus; // 1.5 + 0.5 = 2.0x
    
    finalDamage *= focusCritMult;
    isCrit = true;
    tower.totalCrits++;
  } else if (tower.attackTypeId !== 'piercing') {
    // Regular critical hit roll (skip for Piercing - handled above)
    const critResult = rollCritical(tower.attackTypeConfig);
    if (critResult.isCrit) {
      finalDamage *= critResult.multiplier;
      isCrit = true;
      tower.totalCrits++;
    }
  }
  
  // Get element abilities for this tower
  const elementAbilities = tower.elementAbilities || getElementAbilities(elementPath, tower.abilityUpgrades);

  // Determine projectile color
  let projectileColor = tower.projectileColor;
  if (tower.attackTypeId === 'normal') {
    projectileColor = getComboProjectileColor(tower, isFocusFire);
  } else if (tower.attackTypeId === 'magic') {
    // Magic projectile: purple/blue based on charge
    const chargeProgress = tower.magicState?.chargeProgress || 0;
    if (chargeProgress > 0.8) {
      projectileColor = '#ff00ff'; // Bright magenta at high charge
    } else if (chargeProgress > 0.5) {
      projectileColor = '#9932cc'; // Dark orchid
    } else {
      projectileColor = '#6a5acd'; // Slate blue
    }
  } else if (tower.attackTypeId === 'piercing') {
    projectileColor = getPiercingProjectileColor(tower, isPrecision, isExecute);
  }

  // Get piercing config for bleed data
  const piercingConfig = tower.attackTypeId === 'piercing' ? getPiercingConfig(tower) : null;

  // Emit attack event for combat module
  eventBus.emit('combat:tower-attack', {
    towerId: tower.id,
    targetId: tower.target.id,
    
    // Damage info
    damage: finalDamage,
    baseDamage: tower.damage,
    damageMultiplier,
    isCrit,
    isFocusFire,     // Focus fire indicator (Normal)
    comboStacks,     // Current combo stacks (Normal)
    magicBonusDamage, // Bonus damage from charge (Magic)
    critMultiplier: isFocusFire ? 2.0 : (tower.attackTypeId === 'piercing' ? 2.5 : 1.5),
    
    // Piercing-specific data
    isPrecision,              // Precision strike (Piercing)
    isExecute,                // Execute target (Piercing)
    applyBleed,               // Should apply bleed (Piercing)
    momentumStacks,           // Current momentum stacks (Piercing)
    bleedConfig: applyBleed && piercingConfig ? {
      damage: piercingConfig.bleedDamage,
      duration: piercingConfig.bleedDuration,
      tickRate: piercingConfig.bleedTickRate,
      maxStacks: piercingConfig.bleedMaxStacks,
      stackable: true,
    } : null,
    armorPenetration: piercingConfig?.armorPenetration || 0,
    
    // Attack type
    attackTypeId: tower.attackTypeId,
    
    // Magic overflow data
    magicOverflowEnabled: tower.attackTypeId === 'magic' ? getMagicConfig(tower).overflowEnabled : false,
    magicOverflowRadius: tower.attackTypeId === 'magic' ? getMagicConfig(tower).overflowRadius : 0,
    magicOverflowTransfer: tower.attackTypeId === 'magic' ? getMagicConfig(tower).overflowTransfer : 0,
    
    // Element path and abilities
    elementPath,
    elementAbilities,
    
    // AoE
    splashRadius: tower.splashRadius,
    splashDmgFalloff: tower.splashDmgFalloff,
    splashCanCrit: tower.splashCanCrit || false,
    chainCount: tower.chainCount,
    chainDmgFalloff: tower.chainDmgFalloff,
    chainCanCrit: tower.chainCanCrit || false,
    
    // Armor Shred (Siege)
    armorShredEnabled: tower.armorShredEnabled || false,
    armorShredAmount: tower.armorShredAmount || 0,
    armorShredMaxStacks: tower.armorShredMaxStacks || 0,
    armorShredDuration: tower.armorShredDuration || 0,
    
    // Ground Zone (Siege)
    groundZoneEnabled: tower.groundZoneEnabled || false,
    groundZoneRadius: tower.groundZoneRadius || 0,
    groundZoneDuration: tower.groundZoneDuration || 0,
    groundZoneSlow: tower.groundZoneSlow || 0,
    
    // Costs
    energyCost,
    powerCost,
    isOverdrive,
    
    // Positions
    position: { x: tower.x, y: tower.y },
    targetPosition: { x: tower.target.x, y: tower.target.y },
    
    // Projectile visuals
    projectileColor,  // Now uses combo colors
    projectileSize: tower.projectileSize,
    projectileSpeed: tower.projectileSpeed
  });

  // Update stats
  tower.totalDamage += finalDamage;
}

/**
 * Update lightning charge for a tower
 * Called every frame to accumulate charge based on energy input
 */
function updateLightningCharge(tower, deltaTime, energyInputRate) {
  if (tower.elementPath !== 'lightning' || !tower.lightningChargeEnabled) return;
  
  const chargeTarget = tower.lightningChargeTarget || 50;
  const currentCharge = tower.lightningCurrentCharge || 0;
  
  if (currentCharge >= chargeTarget) return; // Already charged
  
  // Charge rate based on energy input
  // More energy = faster charging
  const chargeRate = energyInputRate * 0.5; // 50% of energy input converts to charge
  const newCharge = Math.min(chargeTarget, currentCharge + chargeRate * deltaTime);
  
  tower.lightningCurrentCharge = newCharge;
}

// ╔════════════════════════════════════════════════════════════════════════════╗
// ║                         MAGIC ATTACK SYSTEM                                ║
// ╚════════════════════════════════════════════════════════════════════════════╝

/**
 * Get magic config for tower (considers upgrades)
 * @param {Object} tower - Tower instance
 * @returns {Object} Magic configuration
 */
function getMagicConfig(tower) {
  const baseConfig = ATTACK_TYPE_CONFIG.magic || {};
  const chargeConfig = baseConfig.charge || {};
  const efficiencyConfig = baseConfig.efficiency || {};
  const overflowConfig = baseConfig.arcaneOverflow || {};
  const upgrades = tower.attackTypeUpgrades || {};
  
  // Base values
  const dmgMultiplier = chargeConfig.dmgMultiplier || 1.2;
  let efficiencyDivisor = efficiencyConfig.baseDivisor || 2.0;
  const minDivisor = efficiencyConfig.minDivisor || 0.5;
  let chargeRate = chargeConfig.chargeRate || 1.0;
  let overflowRadius = overflowConfig.baseRadius || 80;
  let overflowTransfer = overflowConfig.baseDamageTransfer || 0.75;
  
  // Apply upgrades
  if (upgrades.energyEfficiency) {
    const upgrade = baseConfig.upgrades?.energyEfficiency;
    efficiencyDivisor = Math.max(minDivisor, efficiencyDivisor + (upgrade?.effect?.valuePerLevel || -0.1) * upgrades.energyEfficiency);
  }
  if (upgrades.chargeSpeed) {
    const upgrade = baseConfig.upgrades?.chargeSpeed;
    chargeRate *= 1 + (upgrade?.effect?.valuePerLevel || 0.15) * upgrades.chargeSpeed;
  }
  if (upgrades.overflowRange) {
    const upgrade = baseConfig.upgrades?.overflowRange;
    overflowRadius += (upgrade?.effect?.valuePerLevel || 20) * upgrades.overflowRange;
  }
  if (upgrades.overflowDamage) {
    const upgrade = baseConfig.upgrades?.overflowDamage;
    overflowTransfer += (upgrade?.effect?.valuePerLevel || 0.1) * upgrades.overflowDamage;
  }
  
  return {
    dmgMultiplier,
    baseDivisor: efficiencyConfig.baseDivisor || 2.0,
    efficiencyDivisor,
    chargeRate,
    overflowEnabled: overflowConfig.enabled !== false,
    overflowRadius,
    overflowTransfer,
    minChargePercent: chargeConfig.minChargePercent || 1,
    maxChargePercent: chargeConfig.maxChargePercent || 100,
    defaultChargePercent: chargeConfig.defaultChargePercent || 50,
  };
}

/**
 * Initialize magic state for a tower
 * @param {Object} tower - Tower instance
 */
function initMagicState(tower) {
  const config = getMagicConfig(tower);
  tower.magicState = {
    chargePercent: config.defaultChargePercent,  // User-set charge target %
    currentCharge: 0,                            // Current accumulated energy
    shotCost: 0,                                 // Calculated shot cost
    bonusDamage: 0,                              // Calculated bonus damage
    isCharging: false,                           // Currently accumulating charge
    chargeProgress: 0,                           // 0-1 progress to shot cost
  };
  
  // Calculate initial shot cost
  updateMagicShotCost(tower);
}

/**
 * Calculate shot cost based on current charge percent setting
 * New Formula: DMG × multiplier × (1 + charge%)²
 * - DMG Component = DMG × multiplier
 * - Linear = DMG Component × (1 + charge%/100)
 * - Quadratic = Linear × (1 + charge%/100)
 * @param {Object} tower - Tower instance
 */
function updateMagicShotCost(tower) {
  if (!tower.magicState) return;
  
  const config = getMagicConfig(tower);
  const chargePercent = tower.magicState.chargePercent;
  const dmg = tower.damage || 10;
  
  // New Formula: DMG × multiplier × (1 + charge%)²
  const dmgComponent = dmg * config.dmgMultiplier;
  const chargeMultiplier = 1 + chargePercent / 100;
  const afterLinear = dmgComponent * chargeMultiplier;
  const afterQuadratic = afterLinear * chargeMultiplier;
  
  tower.magicState.shotCost = Math.ceil(afterQuadratic);
  
  // Store intermediate values for UI display
  tower.magicState.dmgComponent = dmgComponent;
  tower.magicState.afterLinear = afterLinear;
  tower.magicState.afterQuadratic = afterQuadratic;
  
  // Bonus Damage = shotCost / efficiencyDivisor
  tower.magicState.bonusDamage = Math.floor(tower.magicState.shotCost / config.efficiencyDivisor);
}

/**
 * Set magic charge percent (from UI slider)
 * @param {Object} tower - Tower instance
 * @param {number} percent - Charge percent (1-100)
 */
function setMagicChargePercent(tower, percent) {
  if (!tower.magicState) initMagicState(tower);
  
  const config = getMagicConfig(tower);
  tower.magicState.chargePercent = Math.max(
    config.minChargePercent,
    Math.min(config.maxChargePercent, percent)
  );
  
  updateMagicShotCost(tower);
}

/**
 * Update magic charge accumulation (call every frame)
 * INSTANT CHARGING: If tower has energy in storage, charge instantly
 * @param {Object} tower - Tower instance
 * @param {number} deltaTime - Time since last update
 * @param {number} energyAvailable - Energy available for charging
 * @returns {number} Energy consumed for charging
 */
function updateMagicCharge(tower, deltaTime, energyAvailable) {
  if (tower.attackTypeId !== 'magic') return 0;
  if (!tower.magicState) initMagicState(tower);
  
  const shotCost = tower.magicState.shotCost;
  const currentCharge = tower.magicState.currentCharge;
  
  // Already fully charged?
  if (currentCharge >= shotCost) {
    tower.magicState.chargeProgress = 1;
    tower.magicState.isCharging = false;
    return 0;
  }
  
  // INSTANT CHARGE: Draw as much energy as needed (up to available)
  // No rate limit - if tower has energy, it charges instantly
  const chargeNeeded = shotCost - currentCharge;
  const chargeThisFrame = Math.min(chargeNeeded, energyAvailable);
  
  if (chargeThisFrame > 0) {
    tower.magicState.currentCharge += chargeThisFrame;
    tower.magicState.isCharging = true;
  } else {
    tower.magicState.isCharging = false;
  }
  
  // Update progress
  tower.magicState.chargeProgress = tower.magicState.currentCharge / shotCost;
  
  return chargeThisFrame; // Return energy consumed
}

/**
 * Check if magic tower is ready to fire
 * @param {Object} tower - Tower instance
 * @returns {boolean} True if charged and ready
 */
function isMagicReady(tower) {
  if (tower.attackTypeId !== 'magic') return true;
  if (!tower.magicState) return false;
  
  return tower.magicState.currentCharge >= tower.magicState.shotCost;
}

/**
 * Perform magic attack and reset charge
 * @param {Object} tower - Tower instance
 * @returns {Object} Attack data { totalDamage, bonusDamage, energySpent }
 */
function consumeMagicCharge(tower) {
  if (!tower.magicState) return { totalDamage: tower.damage, bonusDamage: 0, energySpent: 0 };
  
  const bonusDamage = tower.magicState.bonusDamage;
  const energySpent = tower.magicState.currentCharge;
  const totalDamage = tower.damage + bonusDamage;
  
  // Reset charge
  tower.magicState.currentCharge = 0;
  tower.magicState.chargeProgress = 0;
  tower.magicState.isCharging = false;
  
  return { totalDamage, bonusDamage, energySpent };
}

/**
 * Process Arcane Overflow (call when enemy dies from magic attack)
 * @param {Object} tower - Tower instance
 * @param {Object} killedEnemy - Enemy that was killed
 * @param {number} overkillDamage - Damage exceeding enemy HP
 * @param {Array} enemies - All enemies
 * @param {Object} eventBus - Event bus for damage events
 * @returns {Object|null} Overflow result or null
 */
function processArcaneOverflow(tower, killedEnemy, overkillDamage, enemies, eventBus) {
  if (tower.attackTypeId !== 'magic') return null;
  if (overkillDamage <= 0) return null;
  
  const config = getMagicConfig(tower);
  if (!config.overflowEnabled) return null;
  
  // Find nearest enemy within overflow radius
  let nearestEnemy = null;
  let nearestDist = Infinity;
  
  for (const enemy of enemies) {
    if (enemy.id === killedEnemy.id) continue;
    if (enemy.health <= 0) continue;
    
    const dist = Math.sqrt(
      Math.pow(enemy.x - killedEnemy.x, 2) + 
      Math.pow(enemy.y - killedEnemy.y, 2)
    );
    
    if (dist <= config.overflowRadius && dist < nearestDist) {
      nearestDist = dist;
      nearestEnemy = enemy;
    }
  }
  
  if (!nearestEnemy) return null;
  
  // Calculate overflow damage
  const overflowDamage = Math.floor(overkillDamage * config.overflowTransfer);
  
  if (overflowDamage <= 0) return null;
  
  // Emit overflow damage event
  eventBus.emit('combat:arcane-overflow', {
    towerId: tower.id,
    sourceEnemyId: killedEnemy.id,
    targetEnemyId: nearestEnemy.id,
    damage: overflowDamage,
    sourcePosition: { x: killedEnemy.x, y: killedEnemy.y },
    targetPosition: { x: nearestEnemy.x, y: nearestEnemy.y },
  });
  
  return {
    targetEnemy: nearestEnemy,
    overflowDamage: overflowDamage,
  };
}

// ╔════════════════════════════════════════════════════════════════════════════╗
// ║                        PIERCING ATTACK SYSTEM                              ║
// ╚════════════════════════════════════════════════════════════════════════════╝

/**
 * Get piercing config for tower (considers upgrades)
 * @param {Object} tower - Tower instance
 * @returns {Object} Piercing configuration
 */
function getPiercingConfig(tower) {
  const baseConfig = ATTACK_TYPE_CONFIG.piercing || {};
  const precisionConfig = baseConfig.precision || {};
  const momentumConfig = baseConfig.momentum || {};
  const executeConfig = baseConfig.execute || {};
  const bleedConfig = baseConfig.bleed || {};
  const critConfig = baseConfig.critical || {};
  const upgrades = tower.attackTypeUpgrades || {};
  
  // Precision values
  let precisionHitsRequired = precisionConfig.baseHitsRequired || 8;
  let precisionBonusDamage = precisionConfig.baseBonusDamage || 0.25;
  
  // Momentum values
  let momentumMaxStacks = momentumConfig.maxStacks || 5;
  let momentumDecayTime = momentumConfig.decayTime || 3.0;
  const momentumChancePerStack = momentumConfig.baseChancePerStack || 0.03;
  
  // Execute values
  let executeThreshold = executeConfig.baseThreshold || 0.15;
  let executeBonusDamage = executeConfig.baseBonusDamage || 0.50;
  let executeCritBonus = executeConfig.critExecuteBonus || 0.25;
  
  // Bleed values
  let bleedEnabled = bleedConfig.enabled || false;
  let bleedDamage = bleedConfig.baseDamage || 3;
  let bleedDuration = bleedConfig.baseDuration || 3;
  let bleedMaxStacks = bleedConfig.maxStacks || 5;
  
  // Armor pen
  let armorPenetration = critConfig.armorPenetration || 0.2;
  
  // Apply upgrades
  if (upgrades.precisionHits) {
    const upgrade = baseConfig.upgrades?.precisionHits;
    const value = (upgrade?.effect?.valuePerLevel || -1) * upgrades.precisionHits;
    precisionHitsRequired = Math.max(upgrade?.effect?.minValue || 3, precisionHitsRequired + value);
  }
  if (upgrades.precisionDamage) {
    const upgrade = baseConfig.upgrades?.precisionDamage;
    precisionBonusDamage += (upgrade?.effect?.valuePerLevel || 0.10) * upgrades.precisionDamage;
  }
  if (upgrades.momentumStacks) {
    const upgrade = baseConfig.upgrades?.momentumStacks;
    momentumMaxStacks += (upgrade?.effect?.valuePerLevel || 1) * upgrades.momentumStacks;
  }
  if (upgrades.momentumDecay) {
    const upgrade = baseConfig.upgrades?.momentumDecay;
    momentumDecayTime += (upgrade?.effect?.valuePerLevel || 0.5) * upgrades.momentumDecay;
  }
  if (upgrades.executeThreshold) {
    const upgrade = baseConfig.upgrades?.executeThreshold;
    const maxValue = upgrade?.effect?.maxValue || 0.40;
    executeThreshold = Math.min(maxValue, executeThreshold + (upgrade?.effect?.valuePerLevel || 0.05) * upgrades.executeThreshold);
  }
  if (upgrades.executeDamage) {
    const upgrade = baseConfig.upgrades?.executeDamage;
    executeBonusDamage += (upgrade?.effect?.valuePerLevel || 0.15) * upgrades.executeDamage;
  }
  if (upgrades.executeCrit) {
    const upgrade = baseConfig.upgrades?.executeCrit;
    executeCritBonus += (upgrade?.effect?.valuePerLevel || 0.10) * upgrades.executeCrit;
  }
  if (upgrades.bleedUnlock) {
    bleedEnabled = true;
  }
  if (upgrades.bleedDamage) {
    const upgrade = baseConfig.upgrades?.bleedDamage;
    bleedDamage += (upgrade?.effect?.valuePerLevel || 1) * upgrades.bleedDamage;
  }
  if (upgrades.bleedDuration) {
    const upgrade = baseConfig.upgrades?.bleedDuration;
    bleedDuration += (upgrade?.effect?.valuePerLevel || 1) * upgrades.bleedDuration;
  }
  if (upgrades.bleedStacks) {
    const upgrade = baseConfig.upgrades?.bleedStacks;
    bleedMaxStacks += (upgrade?.effect?.valuePerLevel || 1) * upgrades.bleedStacks;
  }
  if (upgrades.armorPen) {
    const upgrade = baseConfig.upgrades?.armorPen;
    const maxValue = upgrade?.effect?.maxValue || 0.50;
    armorPenetration = Math.min(maxValue, armorPenetration + (upgrade?.effect?.valuePerLevel || 0.05) * upgrades.armorPen);
  }
  
  return {
    // Precision
    precisionEnabled: precisionConfig.enabled !== false,
    precisionHitsRequired,
    precisionBonusDamage,
    precisionResetOnNewTarget: precisionConfig.resetOnNewTarget ?? false,
    
    // Momentum
    momentumEnabled: momentumConfig.enabled !== false,
    momentumChancePerStack,
    momentumMaxStacks,
    momentumDecayTime,
    momentumDecayRate: momentumConfig.decayRate || 1,
    
    // Execute
    executeEnabled: executeConfig.enabled !== false,
    executeThreshold,
    executeBonusDamage,
    executeCritBonus,
    
    // Bleed
    bleedEnabled,
    bleedDamage,
    bleedDuration,
    bleedTickRate: bleedConfig.tickRate || 0.5,
    bleedMaxStacks,
    bleedAppliedOnCrit: bleedConfig.appliedOnCrit !== false,
    
    // Armor penetration
    armorPenetration,
  };
}

/**
 * Initialize piercing state for a tower
 * @param {Object} tower - Tower instance
 */
function initPiercingState(tower) {
  tower.piercingState = {
    // Precision tracking
    precisionHits: 0,
    precisionReady: false,
    
    // Momentum tracking
    momentumStacks: 0,
    lastCritTime: 0,
    
    // Stats
    totalPrecisionStrikes: 0,
    totalExecutes: 0,
    totalBleedApplied: 0,
  };
}

/**
 * Update piercing momentum decay (call every frame)
 * @param {Object} tower - Tower instance
 * @param {number} deltaTime - Time since last update
 * @param {number} currentTime - Current game time
 */
function updatePiercingDecay(tower, deltaTime, currentTime) {
  if (!tower.piercingState) return;
  if (tower.attackTypeId !== 'piercing') return;
  
  const config = getPiercingConfig(tower);
  if (!config.momentumEnabled) return;
  
  const timeSinceCrit = currentTime - tower.piercingState.lastCritTime;
  
  // Decay momentum stacks if no crit for a while
  if (timeSinceCrit > config.momentumDecayTime && tower.piercingState.momentumStacks > 0) {
    const stacksToLose = Math.floor(timeSinceCrit / config.momentumDecayTime) * config.momentumDecayRate;
    tower.piercingState.momentumStacks = Math.max(0, tower.piercingState.momentumStacks - stacksToLose);
    tower.piercingState.lastCritTime = currentTime - (timeSinceCrit % config.momentumDecayTime);
  }
}

/**
 * Process piercing hit - handles precision, execute, momentum
 * @param {Object} tower - Tower instance
 * @param {Object} target - Target enemy
 * @param {number} currentTime - Current game time
 * @param {boolean} wasNaturalCrit - Whether this was a natural crit roll
 * @returns {Object} Hit result { damageMultiplier, isCrit, isPrecision, isExecute, applyBleed, momentumStacks }
 */
function processPiercingHit(tower, target, currentTime, wasNaturalCrit = false) {
  if (!tower.piercingState) {
    initPiercingState(tower);
  }
  
  const config = getPiercingConfig(tower);
  let damageMultiplier = 1;
  let isCrit = wasNaturalCrit;
  let isPrecision = false;
  let isExecute = false;
  let applyBleed = false;
  
  // === PRECISION SYSTEM ===
  if (config.precisionEnabled) {
    tower.piercingState.precisionHits++;
    
    // Check for guaranteed crit
    if (tower.piercingState.precisionHits >= config.precisionHitsRequired) {
      isPrecision = true;
      isCrit = true;
      tower.piercingState.precisionHits = 0;
      tower.piercingState.totalPrecisionStrikes++;
      
      // Precision bonus damage
      damageMultiplier *= (1 + config.precisionBonusDamage);
    }
  }
  
  // === EXECUTE CHECK ===
  if (config.executeEnabled && target) {
    const hpPercent = target.health / target.maxHealth;
    
    if (hpPercent <= config.executeThreshold) {
      isExecute = true;
      tower.piercingState.totalExecutes++;
      
      // Execute bonus damage
      damageMultiplier *= (1 + config.executeBonusDamage);
      
      // Extra damage on crit vs execute target
      if (isCrit) {
        damageMultiplier *= (1 + config.executeCritBonus);
      }
    }
  }
  
  // === MOMENTUM UPDATE ===
  if (config.momentumEnabled && isCrit) {
    tower.piercingState.momentumStacks = Math.min(
      tower.piercingState.momentumStacks + 1,
      config.momentumMaxStacks
    );
    tower.piercingState.lastCritTime = currentTime;
  }
  
  // === BLEED APPLICATION ===
  if (config.bleedEnabled && config.bleedAppliedOnCrit && isCrit) {
    applyBleed = true;
    tower.piercingState.totalBleedApplied++;
  }
  
  return {
    damageMultiplier,
    isCrit,
    isPrecision,
    isExecute,
    applyBleed,
    momentumStacks: tower.piercingState.momentumStacks,
    precisionHits: tower.piercingState.precisionHits,
    precisionRequired: config.precisionHitsRequired,
  };
}

/**
 * Get current momentum crit bonus
 * @param {Object} tower - Tower instance
 * @returns {number} Bonus crit chance from momentum (0-1)
 */
function getMomentumCritBonus(tower) {
  if (!tower.piercingState) return 0;
  if (tower.attackTypeId !== 'piercing') return 0;
  
  const config = getPiercingConfig(tower);
  if (!config.momentumEnabled) return 0;
  
  return tower.piercingState.momentumStacks * config.momentumChancePerStack;
}

/**
 * Get projectile color based on piercing state
 * @param {Object} tower - Tower instance
 * @param {boolean} isPrecision - Is this a precision strike
 * @param {boolean} isExecute - Is this an execute
 * @returns {string} Hex color
 */
function getPiercingProjectileColor(tower, isPrecision, isExecute) {
  const visuals = ATTACK_TYPE_CONFIG.piercing?.visuals || {};
  
  // Precision strike = gold
  if (isPrecision) {
    return visuals.precisionColor || '#ffd700';
  }
  
  // Execute = dark red
  if (isExecute) {
    return visuals.executeColor || '#8b0000';
  }
  
  // Momentum-based color
  const momentumColors = visuals.momentumColors || ['#e74c3c'];
  if (tower.piercingState) {
    const stacks = tower.piercingState.momentumStacks || 0;
    const colorIndex = Math.min(stacks, momentumColors.length - 1);
    return momentumColors[colorIndex];
  }
  
  return visuals.baseColor || '#e74c3c';
}

module.exports = { 
  updateTowerCombat, 
  isValidTarget, 
  findTarget, 
  performAttack,
  updateLightningCharge,
  // Combo system exports
  initComboState,
  updateComboDecay,
  processComboHit,
  getComboProjectileColor,
  // Config getters (for UI)
  getComboConfig,
  getFocusFireConfig,
  // Magic system exports
  getMagicConfig,
  initMagicState,
  updateMagicShotCost,
  setMagicChargePercent,
  updateMagicCharge,
  isMagicReady,
  consumeMagicCharge,
  processArcaneOverflow,
  // Piercing system exports
  getPiercingConfig,
  initPiercingState,
  updatePiercingDecay,
  processPiercingHit,
  getPiercingProjectileColor,
  getMomentumCritBonus,
};

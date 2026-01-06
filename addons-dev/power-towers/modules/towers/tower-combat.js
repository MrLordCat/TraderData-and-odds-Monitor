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
  
  // Check energy
  if (tower.currentEnergy < energyCost) {
    return; // Not enough energy
  }
  
  // Deduct energy cost
  tower.currentEnergy -= energyCost;

  // Set cooldown (convert fireRate to seconds)
  tower.attackCooldown = 1 / tower.fireRate;

  // Calculate damage
  let finalDamage = tower.damage * damageMultiplier;
  let isCrit = false;
  let isOverdrive = false;
  let powerCost = 0;
  let comboStacks = 0;
  let isFocusFire = false;
  
  // === COMBO SYSTEM (Normal Attack) ===
  if (tower.attackTypeId === 'normal') {
    const comboResult = processComboHit(tower, tower.target.id, currentTime);
    finalDamage *= comboResult.damageMultiplier;
    comboStacks = comboResult.comboStacks;
    isFocusFire = comboResult.isFocusFire;
  }
  
  // Magic damage calculation
  if (tower.attackTypeId === 'magic' && tower.powerScaling > 0) {
    const magicResult = calculateMagicDamage(
      tower.damage,
      tower.currentPowerDraw,
      tower.attackTypeConfig
    );
    finalDamage = magicResult.finalDamage * damageMultiplier;
    powerCost = magicResult.powerCost;
    isOverdrive = magicResult.isOverdrive;
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
  } else {
    // Regular critical hit roll
    const critResult = rollCritical(tower.attackTypeConfig);
    if (critResult.isCrit) {
      finalDamage *= critResult.multiplier;
      isCrit = true;
      tower.totalCrits++;
    }
  }
  
  // Get element abilities for this tower
  const elementAbilities = tower.elementAbilities || getElementAbilities(elementPath, tower.abilityUpgrades);

  // Determine projectile color (combo system colors)
  let projectileColor = tower.projectileColor;
  if (tower.attackTypeId === 'normal') {
    projectileColor = getComboProjectileColor(tower, isFocusFire);
  }

  // Emit attack event for combat module
  eventBus.emit('combat:tower-attack', {
    towerId: tower.id,
    targetId: tower.target.id,
    
    // Damage info
    damage: finalDamage,
    baseDamage: tower.damage,
    damageMultiplier,
    isCrit,
    isFocusFire,     // NEW: Focus fire indicator
    comboStacks,     // NEW: Current combo stacks
    critMultiplier: isFocusFire ? 2.0 : 1.5,
    
    // Attack type
    attackTypeId: tower.attackTypeId,
    
    // Element path and abilities (NEW)
    elementPath,
    elementAbilities,
    
    // AoE
    splashRadius: tower.splashRadius,
    splashDmgFalloff: tower.splashDmgFalloff,
    splashCanCrit: tower.splashCanCrit || false,
    chainCount: tower.chainCount,
    chainDmgFalloff: tower.chainDmgFalloff,
    chainCanCrit: tower.chainCanCrit || false,
    
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
};

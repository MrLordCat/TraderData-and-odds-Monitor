/**
 * Power Towers TD - Tower Combat
 * 
 * Handles targeting, attacks, and damage calculations.
 */

const { rollCritical, calculateMagicDamage } = require('../../core/attack-types');
const { getElementAbilities, calculateLightningChargeCost, calculateLightningChargeDamage } = require('../../core/element-abilities');

/**
 * Update single tower combat logic
 * @param {Object} tower - Tower instance
 * @param {number} deltaTime - Time since last update
 * @param {Array} enemies - Current enemies
 * @param {Object} context - Combat context with eventBus
 */
function updateTowerCombat(tower, deltaTime, enemies, context) {
  const { 
    isValidTarget, 
    findTarget, 
    performAttack, 
    eventBus 
  } = context;
  
  // Reduce cooldown
  if (tower.attackCooldown > 0) {
    tower.attackCooldown -= deltaTime;
  }

  // Find target if none or current target out of range/dead
  if (!tower.target || !isValidTarget(tower, tower.target, enemies)) {
    tower.target = findTarget(tower, enemies);
  }

  // Rotate towards target
  if (tower.target) {
    const dx = tower.target.x - tower.x;
    const dy = tower.target.y - tower.y;
    tower.rotation = Math.atan2(dy, dx);
  }

  // Attack if target and ready
  if (tower.target && tower.attackCooldown <= 0) {
    performAttack(tower, eventBus);
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
 */
function performAttack(tower, eventBus) {
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
  
  // Critical hit
  const critResult = rollCritical(tower.attackTypeConfig);
  if (critResult.isCrit) {
    finalDamage *= critResult.multiplier;
    isCrit = true;
    tower.totalCrits++;
  }
  
  // Get element abilities for this tower
  const elementAbilities = tower.elementAbilities || getElementAbilities(elementPath, tower.abilityUpgrades);

  // Emit attack event for combat module
  eventBus.emit('combat:tower-attack', {
    towerId: tower.id,
    targetId: tower.target.id,
    
    // Damage info
    damage: finalDamage,
    baseDamage: tower.damage,
    damageMultiplier,
    isCrit,
    critMultiplier: critResult.multiplier,
    
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
    
    // DoT/Debuffs (legacy, for compatibility)
    burnDamage: tower.burnDamage,
    burnDuration: tower.burnDuration,
    poisonDamage: tower.poisonDamage,
    poisonDuration: tower.poisonDuration,
    slowPercent: tower.slowPercent,
    slowDuration: tower.slowDuration,
    armorReduction: tower.armorReduction,
    armorReductionDuration: tower.armorReductionDuration,
    trueDamagePercent: tower.trueDamagePercent,
    
    // Element effects (legacy)
    elementEffects: tower.elementEffects,
    
    // Costs
    energyCost,
    powerCost,
    isOverdrive,
    
    // Positions
    position: { x: tower.x, y: tower.y },
    targetPosition: { x: tower.target.x, y: tower.target.y },
    
    // Projectile visuals
    projectileColor: tower.projectileColor,
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
};

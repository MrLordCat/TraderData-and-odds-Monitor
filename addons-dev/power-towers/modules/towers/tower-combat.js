/**
 * Power Towers TD - Tower Combat
 * 
 * Handles targeting, attacks, and damage calculations.
 */

const { rollCritical, calculateMagicDamage } = require('../../core/attack-types');

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

  // Set cooldown (convert fireRate to seconds)
  tower.attackCooldown = 1 / tower.fireRate;

  // Calculate damage
  let finalDamage = tower.damage;
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
    finalDamage = magicResult.finalDamage;
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

  // Emit attack event for combat module
  eventBus.emit('combat:tower-attack', {
    towerId: tower.id,
    targetId: tower.target.id,
    
    // Damage info
    damage: finalDamage,
    baseDamage: tower.damage,
    isCrit,
    critMultiplier: critResult.multiplier,
    
    // Attack type
    attackTypeId: tower.attackTypeId,
    
    // AoE
    splashRadius: tower.splashRadius,
    splashDmgFalloff: tower.splashDmgFalloff,
    chainCount: tower.chainCount,
    chainDmgFalloff: tower.chainDmgFalloff,
    
    // DoT/Debuffs
    burnDamage: tower.burnDamage,
    burnDuration: tower.burnDuration,
    poisonDamage: tower.poisonDamage,
    poisonDuration: tower.poisonDuration,
    slowPercent: tower.slowPercent,
    slowDuration: tower.slowDuration,
    armorReduction: tower.armorReduction,
    armorReductionDuration: tower.armorReductionDuration,
    trueDamagePercent: tower.trueDamagePercent,
    
    // Element effects
    elementEffects: tower.elementEffects,
    
    // Costs
    energyCost: tower.energyCost,
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

module.exports = { 
  updateTowerCombat, 
  isValidTarget, 
  findTarget, 
  performAttack 
};

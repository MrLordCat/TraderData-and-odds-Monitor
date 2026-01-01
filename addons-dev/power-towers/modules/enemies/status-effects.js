/**
 * Power Towers TD - Status Effects System
 * 
 * Manages debuffs/buffs on enemies (burn, slow, freeze, poison, etc.)
 * Handles effect application, stacking, ticking, and expiration.
 */

const { EFFECT_TYPES } = require('../../core/element-abilities');

/**
 * Status effect instance
 * @typedef {Object} StatusEffect
 * @property {string} type - Effect type (burn, slow, freeze, poison, etc.)
 * @property {number} damage - DPS for DoT effects
 * @property {number} value - Effect strength (slow %, armor reduction, etc.)
 * @property {number} duration - Remaining duration in seconds
 * @property {number} maxDuration - Original duration
 * @property {number} tickTimer - Time until next tick (for DoT)
 * @property {number} tickRate - How often DoT ticks
 * @property {number} stacks - Current stack count
 * @property {number} maxStacks - Maximum stacks
 * @property {number} sourceId - Tower ID that applied this
 * @property {Object} [extra] - Additional data (spread chance, etc.)
 */

/**
 * Create a new status effect
 * @param {string} type - Effect type
 * @param {Object} config - Effect configuration
 * @param {number} config.damage - DPS (damage per second), will be converted to per-tick
 * @param {number} config.tickRate - Seconds between ticks
 */
function createStatusEffect(type, config, sourceId) {
  const tickRate = config.tickRate || 1;
  // Convert DPS to damage per tick
  const damagePerTick = (config.damage || 0) * tickRate;
  
  const effect = {
    type,
    sourceId,
    duration: config.duration || 0,
    maxDuration: config.duration || 0,
    stacks: 1,
    maxStacks: config.maxStacks || 1,
    tickTimer: 0,
    tickRate: tickRate,
    // Type-specific values
    damage: damagePerTick, // Stored as damage per tick, not DPS
    value: config.value || 0,
    extra: config.extra || {},
  };
  
  return effect;
}

/**
 * Apply status effect to enemy
 * Handles stacking logic
 */
function applyStatusEffect(enemy, effectType, config, sourceId) {
  if (!enemy.statusEffects) {
    enemy.statusEffects = [];
  }
  
  // Convert DPS to damage-per-tick for comparison
  const tickRate = config.tickRate || 1;
  const newDamagePerTick = (config.damage || 0) * tickRate;
  
  // Find existing effect of same type
  const existing = enemy.statusEffects.find(e => e.type === effectType);
  
  if (existing) {
    // Check if stackable
    if (config.stackable && existing.stacks < (config.maxStacks || 1)) {
      // Add stack
      existing.stacks++;
      existing.duration = Math.max(existing.duration, config.duration);
      existing.maxDuration = config.duration;
      return { applied: true, stacked: true, effect: existing };
    } else if (!config.stackable) {
      // Replace if stronger or refresh duration
      if (config.value > existing.value || newDamagePerTick > existing.damage) {
        existing.value = config.value;
        existing.damage = newDamagePerTick;
      }
      existing.duration = Math.max(existing.duration, config.duration);
      existing.maxDuration = config.duration;
      return { applied: true, refreshed: true, effect: existing };
    }
    // Already at max stacks
    return { applied: false, reason: 'max_stacks', effect: existing };
  }
  
  // Create new effect
  const newEffect = createStatusEffect(effectType, config, sourceId);
  enemy.statusEffects.push(newEffect);
  
  return { applied: true, new: true, effect: newEffect };
}

/**
 * Remove status effect from enemy
 */
function removeStatusEffect(enemy, effectType) {
  if (!enemy.statusEffects) return;
  
  const idx = enemy.statusEffects.findIndex(e => e.type === effectType);
  if (idx >= 0) {
    enemy.statusEffects.splice(idx, 1);
  }
}

/**
 * Get current effect value (considering stacks)
 */
function getEffectValue(effect) {
  return effect.value * effect.stacks;
}

/**
 * Get current effect damage (considering stacks)
 */
function getEffectDamage(effect) {
  return effect.damage * effect.stacks;
}

/**
 * Check if enemy has specific effect
 */
function hasEffect(enemy, effectType) {
  return enemy.statusEffects?.some(e => e.type === effectType) || false;
}

/**
 * Get effect from enemy
 */
function getEffect(enemy, effectType) {
  return enemy.statusEffects?.find(e => e.type === effectType) || null;
}

/**
 * Get total slow percent on enemy (from all slow effects)
 */
function getTotalSlowPercent(enemy) {
  if (!enemy.statusEffects) return 0;
  
  let totalSlow = 0;
  
  for (const effect of enemy.statusEffects) {
    if (effect.type === EFFECT_TYPES.SLOW) {
      totalSlow += getEffectValue(effect);
    }
    if (effect.type === EFFECT_TYPES.FREEZE) {
      // Frozen = 100% slow (can't move)
      return 1;
    }
  }
  
  // Cap slow at 90%
  return Math.min(0.9, totalSlow);
}

/**
 * Get total armor reduction on enemy
 */
function getTotalArmorReduction(enemy) {
  if (!enemy.statusEffects) return 0;
  
  let totalReduction = 0;
  
  for (const effect of enemy.statusEffects) {
    if (effect.type === EFFECT_TYPES.WEAKEN) {
      totalReduction += getEffectValue(effect);
    }
  }
  
  // Cap at 75% reduction
  return Math.min(0.75, totalReduction);
}

/**
 * Get total damage amplification on enemy (from curse)
 */
function getTotalDamageAmplify(enemy) {
  if (!enemy.statusEffects) return 0;
  
  let totalAmplify = 0;
  
  for (const effect of enemy.statusEffects) {
    if (effect.type === EFFECT_TYPES.CURSE) {
      totalAmplify += getEffectValue(effect);
    }
  }
  
  return totalAmplify;
}

/**
 * Check if enemy is frozen (stunned)
 */
function isFrozen(enemy) {
  return hasEffect(enemy, EFFECT_TYPES.FREEZE);
}

/**
 * Check if enemy is shocked (stunned)
 */
function isShocked(enemy) {
  return hasEffect(enemy, EFFECT_TYPES.SHOCK);
}

/**
 * Check if enemy is stunned (any stun effect)
 */
function isStunned(enemy) {
  return isFrozen(enemy) || isShocked(enemy);
}

/**
 * Update all status effects on enemy
 * @returns {Object} Update results { damage, expired[], spreadCandidates[], dotTicks[] }
 */
function updateStatusEffects(enemy, deltaTime) {
  if (!enemy.statusEffects || enemy.statusEffects.length === 0) {
    return { damage: 0, expired: [], spreadCandidates: [], dotTicks: [] };
  }
  
  let totalDamage = 0;
  const expired = [];
  const spreadCandidates = [];
  const dotTicks = []; // Track individual DoT ticks for damage numbers
  
  for (let i = enemy.statusEffects.length - 1; i >= 0; i--) {
    const effect = enemy.statusEffects[i];
    
    // Update duration
    effect.duration -= deltaTime;
    
    // Process DoT ticks
    if (effect.damage > 0) {
      effect.tickTimer -= deltaTime;
      
      if (effect.tickTimer <= 0) {
        // Tick damage
        const tickDamage = getEffectDamage(effect);
        totalDamage += tickDamage;
        effect.tickTimer = effect.tickRate;
        
        // Record this tick for damage number display
        dotTicks.push({
          type: effect.type,
          damage: tickDamage,
          stacks: effect.stacks
        });
        
        // Fire spread check
        if (effect.type === EFFECT_TYPES.BURN && effect.extra.spreadChance) {
          if (Math.random() < effect.extra.spreadChance) {
            spreadCandidates.push({
              type: EFFECT_TYPES.BURN,
              sourceId: effect.sourceId,
              sourcePos: { x: enemy.x, y: enemy.y },
              radius: effect.extra.spreadRadius || 40,
              config: {
                damage: effect.damage * (effect.extra.spreadDamageMod || 0.7),
                duration: effect.duration,
                tickRate: effect.tickRate,
                stackable: true,
                maxStacks: effect.maxStacks,
                extra: { ...effect.extra },
              },
            });
          }
        }
      }
    }
    
    // Check expiration
    if (effect.duration <= 0) {
      expired.push(effect);
      enemy.statusEffects.splice(i, 1);
    }
  }
  
  return { damage: totalDamage, expired, spreadCandidates, dotTicks };
}

/**
 * Get render data for enemy status effects
 * Used for visual indicators
 */
function getStatusEffectsRenderData(enemy) {
  if (!enemy.statusEffects || enemy.statusEffects.length === 0) {
    return [];
  }
  
  return enemy.statusEffects.map(effect => ({
    type: effect.type,
    stacks: effect.stacks,
    remainingPercent: effect.duration / effect.maxDuration,
    intensity: effect.stacks / effect.maxStacks,
  }));
}

/**
 * Apply damage with status effect modifiers
 * @param {Object} enemy - Target enemy
 * @param {number} baseDamage - Base damage before modifiers
 * @returns {Object} { finalDamage, modifiers }
 */
function calculateDamageWithEffects(enemy, baseDamage) {
  let damage = baseDamage;
  const modifiers = [];
  
  // Armor reduction (weaken)
  const armorReduction = getTotalArmorReduction(enemy);
  if (armorReduction > 0) {
    // Armor normally reduces damage, weaken counters that
    // Simplified: armor reduction = bonus damage
    const bonus = damage * armorReduction;
    damage += bonus;
    modifiers.push({ type: 'weaken', bonus });
  }
  
  // Damage amplify (curse)
  const damageAmplify = getTotalDamageAmplify(enemy);
  if (damageAmplify > 0) {
    const bonus = damage * damageAmplify;
    damage += bonus;
    modifiers.push({ type: 'curse', bonus });
  }
  
  return { finalDamage: damage, modifiers };
}

module.exports = {
  createStatusEffect,
  applyStatusEffect,
  removeStatusEffect,
  getEffectValue,
  getEffectDamage,
  hasEffect,
  getEffect,
  getTotalSlowPercent,
  getTotalArmorReduction,
  getTotalDamageAmplify,
  isFrozen,
  isShocked,
  isStunned,
  updateStatusEffects,
  getStatusEffectsRenderData,
  calculateDamageWithEffects,
};

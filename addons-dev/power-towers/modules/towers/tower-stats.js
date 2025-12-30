/**
 * Power Towers TD - Tower Stats Calculator
 * 
 * Recalculates effective tower stats after modifiers.
 */

const { mergeAttackTypes } = require('../../core/attack-types');
const { BASE_TOWER } = require('../../core/tower-upgrades');

/**
 * Recalculate tower's effective stats after any change
 * @param {Object} tower - Tower instance to recalculate
 */
function recalculateTowerStats(tower) {
  // Get effective attack type config (merged if dual-type)
  let attackType;
  if (tower.hasSecondaryAttackType && tower.secondaryAttackTypeId) {
    attackType = mergeAttackTypes(
      tower.attackTypeId, 
      tower.secondaryAttackTypeId,
      tower.secondaryAttackTypeWeight
    );
    tower.attackTypeConfig = attackType;
  } else {
    attackType = tower.attackTypeConfig;
  }
  
  // Apply attack type modifiers to base stats
  tower.damage = tower.baseDamage * attackType.dmgMod;
  tower.range = tower.baseRange * attackType.rangeMod;
  tower.fireRate = tower.baseFireRate * attackType.atkSpdMod;
  tower.energyCost = tower.baseEnergyCost * attackType.energyCostMod;
  
  // Apply TERRAIN bonuses (from biome/terrain type)
  if (tower.terrainDamageBonus && tower.terrainDamageBonus !== 1.0) {
    tower.damage *= tower.terrainDamageBonus;
  }
  if (tower.terrainRangeBonus && tower.terrainRangeBonus !== 1.0) {
    tower.range *= tower.terrainRangeBonus;
  }
  
  // Calculate HP
  tower.maxHp = tower.baseHp * tower.hpMultiplier;
  // Keep current HP ratio when max changes
  if (tower.currentHp > tower.maxHp) {
    tower.currentHp = tower.maxHp;
  }
  
  // Apply element bonuses (additive)
  if (tower.elementDmgBonus) {
    tower.damage *= (1 + tower.elementDmgBonus);
  }
  if (tower.elementRangeBonus) {
    tower.range *= (1 + tower.elementRangeBonus);
  }
  if (tower.elementAtkSpdBonus) {
    tower.fireRate *= (1 + tower.elementAtkSpdBonus);
  }
  
  // Copy attack type properties
  // Crit: base from attack type + upgrades
  const baseCrit = attackType.critChance || tower.baseCritChance || 0.05;
  const baseCritDmg = attackType.critDmgMod || tower.baseCritDmgMod || 1.5;
  tower.critChance = baseCrit + (tower.critChanceUpgrade || 0);
  tower.critDmgMod = baseCritDmg + (tower.critDmgUpgrade || 0);
  tower.splashRadius = attackType.splashRadius;
  tower.splashDmgFalloff = attackType.splashDmgFalloff;
  tower.chainCount = tower.chainCount || attackType.chainCount;  // Element can override
  tower.chainDmgFalloff = tower.chainDmgFalloff !== undefined ? tower.chainDmgFalloff : attackType.chainDmgFalloff;
  tower.powerScaling = attackType.powerScaling;
  tower.minPowerDraw = attackType.minPowerDraw;
  tower.maxPowerDraw = attackType.maxPowerDraw;
  tower.overdriveEfficiency = attackType.overdriveEfficiency;
  
  // Projectile visuals
  tower.projectileColor = tower.elementColor || attackType.projectileColor;
  tower.projectileSize = attackType.projectileSize;
  tower.projectileSpeed = attackType.projectileSpeed;
  
  // Update tower color
  tower.color = tower.elementColor || attackType.color || BASE_TOWER.color;
}

module.exports = { recalculateTowerStats };

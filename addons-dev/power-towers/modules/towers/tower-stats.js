/**
 * Power Towers TD - Tower Stats Calculator
 * 
 * Recalculates effective tower stats after modifiers.
 * 
 * NEW SYSTEM:
 * 1. Tower level gives +1% to ALL base stats per level
 * 2. Attack type modifiers apply to leveled base stats
 * 3. Stat upgrades give % bonus to final values
 * 4. Element/terrain bonuses apply last
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
  
  // Fallback if no attack type config
  if (!attackType) {
    attackType = {
      dmgMod: 1,
      rangeMod: 1,
      atkSpdMod: 1,
      energyCostMod: 1,
      critChance: 0.05,
      critDmgMod: 1.5
    };
  }
  
  // =========================================
  // STEP 1: Apply level bonus to base stats
  // Each level gives +1% to base stats
  // =========================================
  const level = tower.level || 1;
  const levelBonus = 1 + (level - 1) * 0.01; // Level 1 = 1.0, Level 10 = 1.09
  
  const leveledBaseDamage = tower.baseDamage * levelBonus;
  const leveledBaseRange = tower.baseRange * levelBonus;
  const leveledBaseFireRate = tower.baseFireRate * levelBonus;
  const leveledBaseEnergyCost = tower.baseEnergyCost; // Energy cost doesn't scale with level
  
  // =========================================
  // STEP 2: Apply attack type modifiers
  // =========================================
  let damage = leveledBaseDamage * attackType.dmgMod;
  let range = leveledBaseRange * attackType.rangeMod;
  let fireRate = leveledBaseFireRate * attackType.atkSpdMod;
  let energyCost = leveledBaseEnergyCost * attackType.energyCostMod;
  
  // =========================================
  // STEP 3: Apply stat upgrades as % bonus
  // Each upgrade level gives % bonus to current value
  // =========================================
  const upgradeLevels = tower.upgradeLevels || {};
  
  // Damage: +5% per level
  if (upgradeLevels.damage) {
    damage *= (1 + upgradeLevels.damage * 0.05);
  }
  
  // Attack Speed: +4% per level
  if (upgradeLevels.attackSpeed) {
    fireRate *= (1 + upgradeLevels.attackSpeed * 0.04);
  }
  
  // Range: +5% per level
  if (upgradeLevels.range) {
    range *= (1 + upgradeLevels.range * 0.05);
  }
  
  // Apply final values
  tower.damage = damage;
  tower.range = range;
  tower.fireRate = fireRate;
  tower.energyCost = Math.max(0.5, energyCost);
  
  // =========================================
  // STEP 4: Apply TERRAIN bonuses
  // =========================================
  if (tower.terrainDamageBonus && tower.terrainDamageBonus !== 1.0) {
    tower.damage *= tower.terrainDamageBonus;
  }
  if (tower.terrainRangeBonus && tower.terrainRangeBonus !== 1.0) {
    tower.range *= tower.terrainRangeBonus;
  }
  
  // =========================================
  // STEP 5: Calculate HP with level bonus
  // =========================================
  const leveledBaseHp = tower.baseHp * levelBonus;
  tower.maxHp = leveledBaseHp * tower.hpMultiplier;
  
  // HP upgrade: +8% per level
  if (upgradeLevels.hp) {
    tower.maxHp *= (1 + upgradeLevels.hp * 0.08);
  }
  
  // Keep current HP ratio when max changes
  if (tower.currentHp > tower.maxHp) {
    tower.currentHp = tower.maxHp;
  }
  
  // =========================================
  // STEP 6: Apply element bonuses (additive)
  // =========================================
  if (tower.elementDmgBonus) {
    tower.damage *= (1 + tower.elementDmgBonus);
  }
  if (tower.elementRangeBonus) {
    tower.range *= (1 + tower.elementRangeBonus);
  }
  if (tower.elementAtkSpdBonus) {
    tower.fireRate *= (1 + tower.elementAtkSpdBonus);
  }
  
  // =========================================
  // STEP 7: Critical stats
  // =========================================
  const baseCrit = attackType.critChance || tower.baseCritChance || 0.05;
  const baseCritDmg = attackType.critDmgMod || tower.baseCritDmgMod || 1.5;
  
  // Crit Chance: +1% per level (additive)
  tower.critChance = baseCrit + (upgradeLevels.critChance || 0) * 0.01;
  tower.critChance = Math.min(0.75, tower.critChance); // Cap at 75%
  
  // Crit Damage: +10% per level (additive to multiplier)
  tower.critDmgMod = baseCritDmg + (upgradeLevels.critDamage || 0) * 0.1;
  
  // =========================================
  // STEP 8: Copy attack type properties & apply upgrades
  // =========================================
  
  // Splash Radius: +8% per level
  let splashRadius = attackType.splashRadius || 0;
  if (splashRadius && upgradeLevels.splashRadius) {
    splashRadius *= (1 + upgradeLevels.splashRadius * 0.08);
  }
  tower.splashRadius = splashRadius;
  tower.splashDmgFalloff = attackType.splashDmgFalloff;
  tower.splashCanCrit = attackType.splashCanCrit || false; // Unlockable via cards
  
  // Chain Count: +1 per level (additive, capped at 10)
  let chainCount = tower.baseChainCount || attackType.chainCount || 0;
  if (upgradeLevels.chainCount) {
    chainCount += upgradeLevels.chainCount;
    chainCount = Math.min(10, chainCount);
  }
  tower.chainCount = chainCount;
  tower.chainDmgFalloff = tower.chainDmgFalloff !== undefined ? tower.chainDmgFalloff : attackType.chainDmgFalloff;
  tower.chainCanCrit = tower.elementAbilities?.chain?.canCrit || false; // From element abilities
  
  // Power Scaling: +10% per level
  let powerScaling = attackType.powerScaling || 1.0;
  if (upgradeLevels.powerScaling) {
    powerScaling *= (1 + upgradeLevels.powerScaling * 0.10);
  }
  tower.powerScaling = powerScaling;
  tower.minPowerDraw = attackType.minPowerDraw;
  tower.maxPowerDraw = attackType.maxPowerDraw;
  tower.overdriveEfficiency = attackType.overdriveEfficiency;
  
  // =========================================
  // STEP 9: Energy Storage (+10% per level)
  // =========================================
  if (tower.baseEnergyStorage) {
    let energyStorage = tower.baseEnergyStorage * levelBonus;
    if (upgradeLevels.energyStorage) {
      energyStorage *= (1 + upgradeLevels.energyStorage * 0.10);
    }
    tower.energyStorage = energyStorage;
  }
  
  // =========================================
  // STEP 10: Power Hit Cost (NEW SYSTEM)
  // Base formula: damage * 0.5 + level%
  // Then apply attack type modifier and powerEfficiency upgrade
  // =========================================
  const powerHitCostMod = attackType.powerHitCostMod || 1.0;
  
  // Base cost = 50% of effective damage + 1% per tower level
  let basePowerCost = tower.damage * 0.5;
  const levelCostBonus = 1 + (level - 1) * 0.01; // +1% per level
  basePowerCost *= levelCostBonus;
  
  // Apply attack type modifier (Siege = 1.4, Normal = 0.8, etc.)
  basePowerCost *= powerHitCostMod;
  
  // Apply powerEfficiency upgrade: -3% per level (min 20% of original)
  if (upgradeLevels.powerEfficiency) {
    const reduction = Math.min(0.8, upgradeLevels.powerEfficiency * 0.03);
    basePowerCost *= (1 - reduction);
  }
  
  // Store both the cost per shot and the modifier for display
  tower.energyCostPerShot = Math.max(1, Math.round(basePowerCost));
  tower.powerHitCostMod = powerHitCostMod;
  tower.basePowerCost = tower.damage * 0.5; // For tooltip display
  
  // Projectile visuals
  tower.projectileColor = tower.elementColor || attackType.projectileColor;
  tower.projectileSize = attackType.projectileSize;
  tower.projectileSpeed = attackType.projectileSpeed;
  
  // Update tower color
  tower.color = tower.elementColor || attackType.color || BASE_TOWER.color;
}

module.exports = { recalculateTowerStats };

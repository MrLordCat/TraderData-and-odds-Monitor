/**
 * Power Towers TD - Tower Stats Calculator
 * 
 * Recalculates effective tower stats after modifiers.
 * 
 * SYSTEM:
 * 1. Tower level gives bonus to ALL base stats per level (configurable)
 * 2. Attack type modifiers apply to leveled base stats
 * 3. Stat upgrades give % bonus to final values (configurable)
 * 4. Element/terrain bonuses apply last
 */

const { mergeAttackTypes } = require('../../core/attack-types');
const { BASE_TOWER } = require('../../core/tower-upgrades');
const CONFIG = require('../../core/config/index');

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
  // Each level gives configurable % bonus to base stats
  // =========================================
  const level = tower.level || 1;
  const levelBonusPercent = CONFIG.TOWER_LEVEL_BONUS_PERCENT || 0.01;
  const levelBonus = 1 + (level - 1) * levelBonusPercent;
  
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
  // STEP 2b: Apply Magic type stat modifiers
  // =========================================
  if (tower.attackTypeId === 'magic') {
    const { ATTACK_TYPE_CONFIG } = require('../../core/config/attacks');
    const magicModifiers = ATTACK_TYPE_CONFIG.magic?.statModifiers || {};
    
    damage *= magicModifiers.damage || 0.9;           // 0.9x base damage
    fireRate *= magicModifiers.attackSpeed || 0.7;   // 0.7x attack speed (slower)
    range *= magicModifiers.range || 1.2;            // 1.2x range (extended)
    
    // Store energy storage modifier for later
    tower.magicEnergyStorageMod = magicModifiers.energyStorage || 1.2;
  } else {
    tower.magicEnergyStorageMod = 1.0;
  }
  
  // =========================================
  // STEP 3: Apply stat upgrades as % bonus
  // Each upgrade level gives configurable % bonus
  // =========================================
  const upgradeLevels = tower.upgradeLevels || {};
  const bonuses = CONFIG.TOWER_UPGRADE_BONUSES || {};
  
  // Damage
  if (upgradeLevels.damage) {
    damage *= (1 + upgradeLevels.damage * (bonuses.damage || 0.05));
  }
  
  // Attack Speed
  if (upgradeLevels.attackSpeed) {
    fireRate *= (1 + upgradeLevels.attackSpeed * (bonuses.attackSpeed || 0.04));
  }
  
  // Range
  if (upgradeLevels.range) {
    range *= (1 + upgradeLevels.range * (bonuses.range || 0.05));
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
  
  // HP upgrade
  if (upgradeLevels.hp) {
    tower.maxHp *= (1 + upgradeLevels.hp * (bonuses.hp || 0.08));
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
  const baseCrit = attackType.critChance || tower.baseCritChance || (CONFIG.TOWER_BASE_CRIT_CHANCE || 0.05);
  const baseCritDmg = attackType.critDmgMod || tower.baseCritDmgMod || (CONFIG.TOWER_BASE_CRIT_DAMAGE || 1.5);
  
  // Crit Chance (additive)
  tower.critChance = baseCrit + (upgradeLevels.critChance || 0) * (bonuses.critChance || 0.01);
  tower.critChance = Math.min(CONFIG.TOWER_CRIT_CHANCE_CAP || 0.75, tower.critChance);
  
  // Crit Damage (additive to multiplier)
  tower.critDmgMod = baseCritDmg + (upgradeLevels.critDamage || 0) * (bonuses.critDamage || 0.1);
  
  // =========================================
  // STEP 8: Copy attack type properties & apply upgrades
  // =========================================
  
  // Splash Radius
  let splashRadius = attackType.splashRadius || 0;
  if (splashRadius && upgradeLevels.splashRadius) {
    splashRadius *= (1 + upgradeLevels.splashRadius * (bonuses.splashRadius || 0.08));
  }
  tower.splashRadius = splashRadius;
  
  // Splash Damage Falloff (can be reduced by upgrade)
  let splashFalloff = attackType.splashDmgFalloff || 0.5;
  if (upgradeLevels.splashFalloff) {
    splashFalloff += upgradeLevels.splashFalloff * (bonuses.splashFalloff || -0.05);
    splashFalloff = Math.max(0.1, splashFalloff); // Min 10% falloff
  }
  tower.splashDmgFalloff = splashFalloff;
  tower.splashCanCrit = attackType.splashCanCrit || false;
  
  // === ARMOR SHRED (Siege unique) ===
  // Each hit in splash zone reduces enemy armor
  if (attackType.armorShredEnabled) {
    let shredAmount = attackType.armorShredAmount || 0.05;  // Base 5%
    let shredMaxStacks = attackType.armorShredMaxStacks || 5;
    let shredDuration = attackType.armorShredDuration || 4000;
    
    // Apply upgrades
    if (upgradeLevels.shredAmount) {
      shredAmount += upgradeLevels.shredAmount * (bonuses.shredAmount || 0.02);
    }
    if (upgradeLevels.shredStacks) {
      shredMaxStacks += upgradeLevels.shredStacks * (bonuses.shredStacks || 1);
    }
    if (upgradeLevels.shredDuration) {
      shredDuration += upgradeLevels.shredDuration * (bonuses.shredDuration || 1000);
    }
    
    tower.armorShredEnabled = true;
    tower.armorShredAmount = shredAmount;
    tower.armorShredMaxStacks = shredMaxStacks;
    tower.armorShredDuration = shredDuration;
  } else {
    tower.armorShredEnabled = false;
  }
  
  // === GROUND ZONE (Siege unique) ===
  // Leaves slowing crater after splash explosion
  // Only available for Siege attack type, unlocked via groundZoneUnlock upgrade
  const isSiegeType = tower.attackTypeId === 'siege';
  const groundZoneUnlocked = isSiegeType && upgradeLevels.groundZoneUnlock > 0;
  if (groundZoneUnlocked) {
    let zoneRadius = attackType.groundZoneRadius || 40;
    let zoneDuration = attackType.groundZoneDuration || 2000;
    let zoneSlow = attackType.groundZoneSlow || 0.25;
    
    // Apply upgrades
    if (upgradeLevels.groundZoneRadius) {
      zoneRadius += upgradeLevels.groundZoneRadius * (bonuses.groundZoneRadius || 5);
    }
    if (upgradeLevels.groundZoneDuration) {
      zoneDuration += upgradeLevels.groundZoneDuration * (bonuses.groundZoneDuration || 500);
    }
    if (upgradeLevels.groundZoneSlow) {
      zoneSlow += upgradeLevels.groundZoneSlow * (bonuses.groundZoneSlow || 0.05);
      zoneSlow = Math.min(0.8, zoneSlow); // Cap at 80% slow
    }
    
    tower.groundZoneEnabled = true;
    tower.groundZoneRadius = zoneRadius;
    tower.groundZoneDuration = zoneDuration;
    tower.groundZoneSlow = zoneSlow;
  } else {
    tower.groundZoneEnabled = false;
  }
  
  // Chain Count (flat bonus, capped)
  let chainCount = tower.baseChainCount || attackType.chainCount || 0;
  if (upgradeLevels.chainCount) {
    chainCount += upgradeLevels.chainCount * (bonuses.chainCount || 1);
    chainCount = Math.min(CONFIG.TOWER_CHAIN_COUNT_CAP || 10, chainCount);
  }
  tower.chainCount = chainCount;
  tower.chainDmgFalloff = tower.chainDmgFalloff !== undefined ? tower.chainDmgFalloff : attackType.chainDmgFalloff;
  tower.chainCanCrit = tower.elementAbilities?.chain?.canCrit || false;
  
  // Power Scaling
  let powerScaling = attackType.powerScaling || 1.0;
  if (upgradeLevels.powerScaling) {
    powerScaling *= (1 + upgradeLevels.powerScaling * (bonuses.powerScaling || 0.10));
  }
  tower.powerScaling = powerScaling;
  tower.minPowerDraw = attackType.minPowerDraw;
  tower.maxPowerDraw = attackType.maxPowerDraw;
  tower.overdriveEfficiency = attackType.overdriveEfficiency;
  
  // =========================================
  // STEP 9: Energy Storage
  // =========================================
  if (tower.baseEnergyStorage) {
    let energyStorage = tower.baseEnergyStorage * levelBonus;
    
    // Apply Magic type energy storage modifier
    if (tower.magicEnergyStorageMod) {
      energyStorage *= tower.magicEnergyStorageMod;
    }
    
    if (upgradeLevels.energyStorage) {
      energyStorage *= (1 + upgradeLevels.energyStorage * (bonuses.energyStorage || 0.10));
    }
    tower.energyStorage = energyStorage;
    
    // Update maxEnergy for renderer (sync with energyStorage)
    tower.maxEnergy = Math.ceil(energyStorage);
  }
  
  // =========================================
  // STEP 10: Power Hit Cost
  // =========================================
  const powerHitCostMod = attackType.powerHitCostMod || 1.0;
  const levelCostBonusPercent = CONFIG.TOWER_LEVEL_BONUS_PERCENT || 0.01;
  const basePowerCostRatio = CONFIG.TOWER_BASE_POWER_COST_RATIO || 0.5;
  
  let basePowerCost = tower.damage * basePowerCostRatio;
  const levelCostBonus = 1 + (level - 1) * levelCostBonusPercent;
  basePowerCost *= levelCostBonus;
  basePowerCost *= powerHitCostMod;
  
  // Apply powerEfficiency upgrade
  if (upgradeLevels.powerEfficiency) {
    const maxReduction = CONFIG.TOWER_POWER_EFFICIENCY_CAP || 0.8;
    const reductionPerLevel = bonuses.powerEfficiency || 0.03;
    const reduction = Math.min(maxReduction, upgradeLevels.powerEfficiency * reductionPerLevel);
    basePowerCost *= (1 - reduction);
  }
  
  tower.energyCostPerShot = Math.max(1, Math.round(basePowerCost));
  tower.powerHitCostMod = powerHitCostMod;
  tower.basePowerCost = tower.damage * basePowerCostRatio;
  
  // Projectile visuals
  tower.projectileColor = tower.elementColor || attackType.projectileColor;
  tower.projectileSize = attackType.projectileSize;
  tower.projectileSpeed = attackType.projectileSpeed;
  
  // Update tower color
  tower.color = tower.elementColor || attackType.color || BASE_TOWER.color;
}

module.exports = { recalculateTowerStats };

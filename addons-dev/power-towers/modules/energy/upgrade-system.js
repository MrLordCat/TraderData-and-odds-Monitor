/**
 * Power Towers TD - Upgrade System for Energy Buildings
 * 
 * Handles upgrade logic, costs, and effects
 */

const { ENERGY_BUILDINGS, UPGRADE_COST_MULTIPLIER } = require('./building-defs');

class UpgradeSystem {
  constructor(eventBus, economyModule) {
    this.eventBus = eventBus;
    this.economy = economyModule;
  }

  /**
   * Get available upgrades for a building
   */
  getAvailableUpgrades(building) {
    const def = ENERGY_BUILDINGS[building.type];
    if (!def || !def.upgrades) return [];

    const available = [];
    
    for (const upgrade of def.upgrades) {
      // Check if already maxed
      const currentLevel = building.upgrades[upgrade.type] || 0;
      const maxLevel = 5;
      
      if (currentLevel >= maxLevel) continue;
      
      // Calculate cost for next level
      const baseCost = upgrade.cost;
      const levelMultiplier = UPGRADE_COST_MULTIPLIER[currentLevel] || 1;
      const cost = Math.round(baseCost * levelMultiplier);
      
      available.push({
        type: upgrade.type,
        description: upgrade.description,
        currentLevel,
        maxLevel,
        cost,
        canAfford: this.economy?.canAfford(cost) ?? true
      });
    }

    return available;
  }

  /**
   * Apply an upgrade to a building
   */
  applyUpgrade(building, upgradeType) {
    const def = ENERGY_BUILDINGS[building.type];
    if (!def) return { success: false, reason: 'Unknown building type' };

    const upgradeDef = def.upgrades?.find(u => u.type === upgradeType);
    if (!upgradeDef) return { success: false, reason: 'Unknown upgrade type' };

    const currentLevel = building.upgrades[upgradeType] || 0;
    if (currentLevel >= 5) return { success: false, reason: 'Already max level' };

    // Calculate cost
    const baseCost = upgradeDef.cost;
    const levelMultiplier = UPGRADE_COST_MULTIPLIER[currentLevel] || 1;
    const cost = Math.round(baseCost * levelMultiplier);

    // Check and spend gold
    if (this.economy && !this.economy.canAfford(cost)) {
      return { success: false, reason: 'Not enough gold' };
    }

    if (this.economy) {
      this.economy.spend(cost);
    }

    // Apply upgrade based on type
    this.applyUpgradeEffect(building, upgradeType);

    // Emit event
    this.eventBus.emit('energy:building-upgraded', {
      buildingId: building.id,
      upgradeType,
      newLevel: building.upgrades[upgradeType],
      cost
    });

    return { success: true, cost, newLevel: building.upgrades[upgradeType] };
  }

  /**
   * Apply upgrade effect to building stats
   */
  applyUpgradeEffect(building, upgradeType) {
    // Increment upgrade counter
    if (building.upgrades[upgradeType] === undefined) {
      building.upgrades[upgradeType] = 0;
    }
    building.upgrades[upgradeType]++;
    building.level++;

    // Apply specific effects
    switch (upgradeType) {
      case 'generation':
        if (building.baseGeneration !== undefined) {
          building.baseGeneration *= 1.2;
        }
        if (building.generation !== undefined) {
          building.generation *= 1.2;
        }
        break;

      case 'inputRate':
        building.inputRate *= 1.2;
        break;

      case 'outputRate':
        building.outputRate *= 1.2;
        break;

      case 'capacity':
        building.capacity *= 1.25;
        break;

      case 'range':
        building.range += 2;
        break;

      case 'channels':
        if (building.type === 'power-transfer') {
          building.inputChannels++;
          building.outputChannels++;
        }
        break;

      case 'efficiency':
        if (building.efficiency !== undefined) {
          building.efficiency = Math.min(1, building.efficiency + 0.02);
        }
        break;

      case 'stability':
        if (building.instabilityFactor !== undefined) {
          building.instabilityFactor = Math.max(0.05, building.instabilityFactor - 0.1);
        }
        break;

      case 'decay':
        if (building.decayRate !== undefined) {
          building.decayRate *= 0.8;
        }
        break;

      case 'treeRadius':
        if (building.treeRadius !== undefined) {
          building.treeRadius++;
          building.maxTrees = (building.treeRadius * 2 + 1) ** 2 - 1;
        }
        break;

      case 'waterRadius':
        if (building.waterRadius !== undefined) {
          building.waterRadius++;
          building.maxWaterTiles = (building.waterRadius * 2 + 1) ** 2;
        }
        break;

      default:
        console.warn(`[UpgradeSystem] Unknown upgrade type: ${upgradeType}`);
    }
  }

  /**
   * Get upgrade tooltip
   */
  getUpgradeTooltip(building, upgradeType) {
    const upgrades = this.getAvailableUpgrades(building);
    const upgrade = upgrades.find(u => u.type === upgradeType);
    
    if (!upgrade) return null;

    return {
      title: this.getUpgradeName(upgradeType),
      description: upgrade.description,
      level: `${upgrade.currentLevel}/${upgrade.maxLevel}`,
      cost: upgrade.cost,
      canAfford: upgrade.canAfford
    };
  }

  /**
   * Get human-readable upgrade name
   */
  getUpgradeName(type) {
    const names = {
      generation: 'Generation',
      inputRate: 'Input Rate',
      outputRate: 'Output Rate',
      capacity: 'Capacity',
      range: 'Range',
      channels: 'Channels',
      efficiency: 'Efficiency',
      stability: 'Stability',
      decay: 'Decay Reduction',
      treeRadius: 'Tree Detection',
      waterRadius: 'Water Detection'
    };
    return names[type] || type;
  }
}

module.exports = { UpgradeSystem };

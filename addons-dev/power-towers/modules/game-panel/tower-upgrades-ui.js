/**
 * Power Towers TD - Tower Upgrades UI Mixin
 * Handles tower selling (upgrades moved to bottom panel)
 */

const { STAT_UPGRADES, calculateUpgradeCost, isUpgradeAvailable } = require('../../core/tower-upgrade-list');

// Base upgrades shown for all towers
const BASE_UPGRADES = [
  'damage',
  'attackSpeed', 
  'range',
  'hp',
  'energyEfficiency',
  'critChance',
  'critDamage'
];

// Attack type specific upgrades
const ATTACK_TYPE_UPGRADES = {
  siege: ['splashRadius'],
  magic: ['powerScaling'],
  piercing: ['critChance', 'critDamage'],
  normal: ['attackSpeed']
};

// Element path specific upgrades
const ELEMENT_UPGRADES = {
  lightning: ['chainCount']
};

/**
 * Get upgrades to show for a specific tower
 * @param {Object} tower - Tower instance
 * @returns {string[]} Array of upgrade IDs
 */
function getUpgradesForTower(tower) {
  const upgrades = [...BASE_UPGRADES];
  
  if (tower.attackTypeId && ATTACK_TYPE_UPGRADES[tower.attackTypeId]) {
    for (const upgradeId of ATTACK_TYPE_UPGRADES[tower.attackTypeId]) {
      if (!upgrades.includes(upgradeId)) {
        upgrades.push(upgradeId);
      }
    }
  }
  
  if (tower.elementPath && ELEMENT_UPGRADES[tower.elementPath]) {
    for (const upgradeId of ELEMENT_UPGRADES[tower.elementPath]) {
      if (!upgrades.includes(upgradeId)) {
        upgrades.push(upgradeId);
      }
    }
  }
  
  return upgrades.filter(id => {
    const upgrade = STAT_UPGRADES[id];
    return upgrade && isUpgradeAvailable(upgrade, tower);
  });
}

/**
 * Mixin for tower upgrades UI functionality
 * @param {Class} Base - GameController base class
 */
function TowerUpgradesUIMixin(Base) {
  return class extends Base {
    /**
     * Purchase an upgrade for selected tower
     */
    purchaseUpgrade(upgradeId) {
      const tower = this.game?.selectedTower;
      if (!tower) return;
      
      const upgrade = STAT_UPGRADES[upgradeId];
      if (!upgrade) return;
      
      const currentLevel = tower.getUpgradeLevel(upgradeId);
      const towerLevel = tower.level || 1;
      const cost = calculateUpgradeCost(upgrade, currentLevel, towerLevel);
      
      const economy = this.game?.modules?.economy;
      if (!economy || economy.gold < cost) {
        return;
      }
      
      // Spend gold
      economy.spendGold(cost);
      
      // Apply upgrade to tower
      tower.applyStatUpgrade(upgradeId, upgrade);
      
      // Refresh bottom panel
      if (this.showTowerInBottomPanel) {
        this.showTowerInBottomPanel(tower);
      }
      
      // Refresh gold display
      this.updateUI(this.game.getState());
    }

    /**
     * Sell selected tower
     */
    sellSelectedTower() {
      const tower = this.game?.selectedTower;
      if (!tower) return;
      
      // Calculate sell value (50% of build cost + upgrades)
      const baseCost = this.towerCost || 50;
      const sellValue = Math.floor(baseCost * 0.5);
      
      // Add gold
      const economy = this.game?.modules?.economy;
      if (economy) {
        economy.addGold(sellValue);
      }
      
      // Remove tower
      const towerModule = this.game?.modules?.towers;
      if (towerModule) {
        towerModule.removeTower(tower.id);
      }
      
      // Deselect and hide bottom panel selection
      this.deselectTower();
      if (this.hideBottomPanelSelection) {
        this.hideBottomPanelSelection();
      }
      
      // Update UI
      this.updateUI(this.game.getState());
    }
  };
}

module.exports = { TowerUpgradesUIMixin };

/**
 * Power Towers TD - Ability Upgrades UI Mixin
 * Handles element ability upgrades (UI moved to bottom panel)
 */

const { formatUpgradeValue } = require('./ability-upgrades-helpers');
const { ELEMENT_ABILITIES, getAbilityUpgradeCost } = require('../../core/element-abilities');
const { applyElementAbilityUpgrade } = require('../../core/tower-upgrades');

/**
 * Mixin for ability upgrades functionality
 * @param {Class} Base - GameController base class
 */
function AbilityUpgradesUIMixin(Base) {
  return class extends Base {
    /**
     * Update abilities button visibility in bottom panel
     */
    updateAbilitiesButtonVisibility(tower) {
      // Abilities are shown in bottom panel action cards
      // This method can be used for any visibility logic needed
    }

    /**
     * Purchase an ability upgrade for selected tower
     */
    purchaseAbilityUpgrade(upgradeKey) {
      const tower = this.game?.selectedTower;
      if (!tower || !tower.elementPath) return;
      
      const elementConfig = ELEMENT_ABILITIES[tower.elementPath];
      if (!elementConfig?.upgrades?.[upgradeKey]) {
        return;
      }
      
      const upgrade = elementConfig.upgrades[upgradeKey];
      const currentLevel = tower.abilityUpgrades?.[upgradeKey] || 0;
      
      if (currentLevel >= upgrade.maxLevel) {
        return;
      }
      
      const cost = getAbilityUpgradeCost(tower.elementPath, upgradeKey, currentLevel);
      
      const economy = this.game?.modules?.economy;
      if (!economy || economy.gold < cost) {
        return;
      }
      
      // Spend gold
      economy.spendGold(cost);
      
      // Apply upgrade
      applyElementAbilityUpgrade(tower, upgradeKey, upgrade);
      
      // Refresh bottom panel
      if (this.showTowerInBottomPanel) {
        this.showTowerInBottomPanel(tower);
      }
      
      // Update UI
      this.updateUI(this.game.getState());
    }
  };
}

module.exports = { AbilityUpgradesUIMixin };

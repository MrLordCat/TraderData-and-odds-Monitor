/**
 * Power Towers TD - Tower Upgrades UI Mixin
 * Handles the stat upgrade panel in tower tooltip
 */

const { STAT_UPGRADES, calculateUpgradeCost } = require('../../core/tower-upgrade-list');

// Which upgrades to show in tooltip (subset for quick access)
const TOOLTIP_UPGRADES = [
  'damage',
  'attackSpeed', 
  'range',
  'critChance',
  'critDamage',
  'health'
];

/**
 * Mixin for tower upgrades UI functionality
 * @param {Class} Base - GameController base class
 */
function TowerUpgradesUIMixin(Base) {
  return class extends Base {
    /**
     * Toggle upgrades panel visibility
     */
    toggleUpgradesPanel() {
      const el = this.elements;
      if (!el.tooltipUpgradesSection) return;
      
      const isVisible = el.tooltipUpgradesSection.style.display !== 'none';
      
      if (isVisible) {
        this.hideUpgradesPanel();
      } else {
        this.showUpgradesPanel();
      }
    }

    /**
     * Show upgrades panel for selected tower
     */
    showUpgradesPanel() {
      const el = this.elements;
      const tower = this.game?.selectedTower;
      
      if (!el.tooltipUpgradesSection || !el.upgradesGrid || !tower) return;
      
      // Update button state
      if (el.btnUpgrade) {
        el.btnUpgrade.classList.add('active');
      }
      
      // Show section
      el.tooltipUpgradesSection.style.display = 'block';
      
      // Populate upgrades
      this.populateUpgradesGrid(tower);
    }

    /**
     * Hide upgrades panel
     */
    hideUpgradesPanel() {
      const el = this.elements;
      
      if (el.tooltipUpgradesSection) {
        el.tooltipUpgradesSection.style.display = 'none';
      }
      
      if (el.btnUpgrade) {
        el.btnUpgrade.classList.remove('active');
      }
    }

    /**
     * Populate upgrades grid with available upgrades
     */
    populateUpgradesGrid(tower) {
      const el = this.elements;
      if (!el.upgradesGrid) return;
      
      const gold = this.game?.modules?.economy?.gold || 0;
      const towerLevel = tower.level || 1;
      
      el.upgradesGrid.innerHTML = '';
      
      TOOLTIP_UPGRADES.forEach(upgradeId => {
        const upgrade = STAT_UPGRADES[upgradeId];
        if (!upgrade) return;
        
        const currentLevel = tower.getUpgradeLevel(upgradeId);
        const cost = calculateUpgradeCost(upgrade, currentLevel, towerLevel);
        const canAfford = gold >= cost;
        
        // Create upgrade row
        const row = document.createElement('div');
        row.className = `upgrade-row${!canAfford ? ' disabled' : ''}`;
        row.dataset.upgradeId = upgradeId;
        
        // Format effect text
        const effectText = this.formatEffectText(upgrade);
        
        row.innerHTML = `
          <span class="upgrade-emoji">${upgrade.emoji}</span>
          <div class="upgrade-info-col">
            <div class="upgrade-name-row">${upgrade.name}</div>
            <div class="upgrade-effect">${effectText}</div>
          </div>
          <span class="upgrade-lvl">Lv.${currentLevel}</span>
          <button class="upgrade-buy-btn" data-upgrade="${upgradeId}" ${!canAfford ? 'disabled' : ''}>
            ${cost}g
          </button>
        `;
        
        // Add click handler for buy button
        const buyBtn = row.querySelector('.upgrade-buy-btn');
        buyBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.purchaseUpgrade(upgradeId);
        });
        
        el.upgradesGrid.appendChild(row);
      });
    }

    /**
     * Format effect text for upgrade
     */
    formatEffectText(upgrade) {
      const effect = upgrade.effect;
      let value = effect.valuePerLevel;
      
      // Format based on stat type
      switch (effect.stat) {
        case 'critChance':
        case 'lifesteal':
        case 'cooldownReduction':
          return `+${(value * 100).toFixed(1)}% per lvl`;
        case 'critDmgMod':
          return `+${(value * 100).toFixed(0)}% crit dmg`;
        case 'baseFireRate':
          return `+${value.toFixed(2)} atk/s`;
        default:
          return `+${value} per lvl`;
      }
    }

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
        console.log('Not enough gold for upgrade');
        return;
      }
      
      // Spend gold
      economy.spendGold(cost);
      
      // Apply upgrade to tower
      tower.applyStatUpgrade(upgradeId, upgrade);
      
      // Add upgrade points for leveling
      tower.upgradePoints = (tower.upgradePoints || 0) + 3;
      
      // Check for level up (every 10 points = 1 level roughly)
      const newLevel = Math.floor(1 + (tower.upgradePoints / 10));
      if (newLevel > (tower.level || 1)) {
        tower.level = newLevel;
      }
      
      // Refresh UI
      this.populateUpgradesGrid(tower);
      this.showTowerInfo(tower); // Refresh tooltip stats
      this.updateUI(this.game.getState()); // Refresh gold display
    }

    /**
     * Upgrade selected tower (toggle panel)
     */
    upgradeSelectedTower() {
      this.toggleUpgradesPanel();
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
      
      // Deselect and hide tooltip
      this.deselectTower();
      
      // Update UI
      this.updateUI(this.game.getState());
    }
  };
}

module.exports = { TowerUpgradesUIMixin, TOOLTIP_UPGRADES };

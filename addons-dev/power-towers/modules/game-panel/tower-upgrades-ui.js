/**
 * Power Towers TD - Tower Upgrades UI Mixin
 * Handles the stat upgrade panel in tower tooltip
 */

const { STAT_UPGRADES, calculateUpgradeCost, isUpgradeAvailable } = require('../../core/tower-upgrade-list');

// Base upgrades shown for all towers
const BASE_UPGRADES = [
  'damage',
  'attackSpeed', 
  'range',
  'critChance',
  'critDamage'
];

// Attack type specific upgrades
const ATTACK_TYPE_UPGRADES = {
  siege: ['splashRadius'],
  magic: ['powerScaling'],
  piercing: ['critChance', 'critDamage'], // Bonus crit focus
  normal: ['attackSpeed'] // Bonus speed focus
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
  
  // Add attack type specific upgrades
  if (tower.attackTypeId && ATTACK_TYPE_UPGRADES[tower.attackTypeId]) {
    for (const upgradeId of ATTACK_TYPE_UPGRADES[tower.attackTypeId]) {
      if (!upgrades.includes(upgradeId)) {
        upgrades.push(upgradeId);
      }
    }
  }
  
  // Add element path specific upgrades
  if (tower.elementPath && ELEMENT_UPGRADES[tower.elementPath]) {
    for (const upgradeId of ELEMENT_UPGRADES[tower.elementPath]) {
      if (!upgrades.includes(upgradeId)) {
        upgrades.push(upgradeId);
      }
    }
  }
  
  // Filter to only upgrades that are available for this tower
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
      
      // Get dynamic list of upgrades for this tower
      const upgradeIds = getUpgradesForTower(tower);
      
      upgradeIds.forEach(upgradeId => {
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
        case 'splashRadius':
          return `+${value}px AoE`;
        case 'powerScaling':
          return `+${(value * 100).toFixed(0)}% power dmg`;
        case 'chainCount':
          return `+${value} chain target`;
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
      
      // Apply upgrade to tower (no XP from stat upgrades)
      tower.applyStatUpgrade(upgradeId, upgrade);
      
      // Refresh upgrades grid with new prices (panel stays open)
      this.populateUpgradesGrid(tower);
      
      // Refresh tooltip stats without closing panel
      this.refreshTooltipData(tower);
      
      // Refresh gold display
      this.updateUI(this.game.getState());
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

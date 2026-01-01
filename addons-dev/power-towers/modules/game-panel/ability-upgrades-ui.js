/**
 * Power Towers TD - Ability Upgrades UI Mixin
 * Handles the element ability upgrades panel in tower tooltip
 */

const { formatUpgradeValue } = require('./ability-upgrades-helpers');
const { ELEMENT_ABILITIES, getAbilityUpgradeCost, calculateLightningChargeCost, calculateLightningChargeDamage } = require('../../core/element-abilities');
const { applyElementAbilityUpgrade } = require('../../core/tower-upgrades');

/**
 * Mixin for ability upgrades UI functionality
 * @param {Class} Base - GameController base class
 */
function AbilityUpgradesUIMixin(Base) {
  return class extends Base {
    /**
     * Toggle abilities panel visibility
     */
    toggleAbilitiesPanel() {
      const el = this.elements;
      if (!el.tooltipAbilitiesSection) return;
      
      const isVisible = el.tooltipAbilitiesSection.style.display !== 'none';
      
      if (isVisible) {
        this.hideAbilitiesPanel();
      } else {
        this.showAbilitiesPanel();
      }
    }

    /**
     * Show abilities panel for selected tower
     */
    showAbilitiesPanel() {
      const el = this.elements;
      const tower = this.game?.selectedTower;
      
      if (!el.tooltipAbilitiesSection || !el.abilitiesGrid || !tower) return;
      
      // Only show for towers with element path
      if (!tower.elementPath) {
        console.log('Tower has no element path');
        return;
      }
      
      // Update button state
      if (el.btnAbilities) {
        el.btnAbilities.classList.add('active');
      }
      
      // Hide stat upgrades panel if open
      if (el.tooltipUpgradesSection) {
        el.tooltipUpgradesSection.style.display = 'none';
      }
      if (el.btnUpgrade) {
        el.btnUpgrade.classList.remove('active');
      }
      
      // Show section
      el.tooltipAbilitiesSection.style.display = 'block';
      
      // Show/hide lightning charge section
      this.updateLightningChargeSection(tower);
      
      // Populate abilities
      this.populateAbilitiesGrid(tower);
    }

    /**
     * Hide abilities panel
     */
    hideAbilitiesPanel() {
      const el = this.elements;
      
      if (el.tooltipAbilitiesSection) {
        el.tooltipAbilitiesSection.style.display = 'none';
      }
      
      if (el.btnAbilities) {
        el.btnAbilities.classList.remove('active');
      }
    }

    /**
     * Update lightning charge slider section
     */
    updateLightningChargeSection(tower) {
      const el = this.elements;
      const section = el.lightningChargeSection;
      
      if (!section) return;
      
      // Only show for lightning towers
      if (tower.elementPath === 'lightning') {
        section.style.display = 'block';
        
        // Update slider value
        const slider = el.lightningChargeSlider;
        if (slider) {
          const target = tower.lightningChargeTarget || 50;
          slider.value = target;
          
          // Update display
          this.updateLightningChargeDisplay(target);
        }
      } else {
        section.style.display = 'none';
      }
    }

    /**
     * Update lightning charge display values
     */
    updateLightningChargeDisplay(percent) {
      const el = this.elements;
      const chargeConfig = ELEMENT_ABILITIES.lightning?.charge;
      
      if (el.lightningChargeValue) {
        el.lightningChargeValue.textContent = `${percent}%`;
      }
      
      if (el.lightningChargeCost && chargeConfig) {
        const cost = calculateLightningChargeCost(percent, chargeConfig);
        el.lightningChargeCost.textContent = `${cost.toFixed(1)}x`;
      }
      
      if (el.lightningChargeDamage && chargeConfig) {
        const damage = calculateLightningChargeDamage(percent, chargeConfig);
        el.lightningChargeDamage.textContent = `${damage.toFixed(1)}x`;
      }
    }

    /**
     * Handle lightning charge slider change
     */
    onLightningChargeChange(value) {
      const tower = this.game?.selectedTower;
      if (!tower || tower.elementPath !== 'lightning') return;
      
      const percent = parseInt(value, 10);
      tower.lightningChargeTarget = percent;
      
      // Update abilities display (cost, damage multiplier)
      this.updateLightningChargeDisplay(percent);
      
      // Update main tooltip stats (DMG, PWR/Hit) to reflect charge change
      if (this.updateStatWithDetails) {
        this.updateStatWithDetails(tower);
      }
    }

    /**
     * Populate abilities grid with available upgrades
     */
    populateAbilitiesGrid(tower) {
      const el = this.elements;
      if (!el.abilitiesGrid || !tower.elementPath) return;
      
      const gold = this.game?.modules?.economy?.gold || 0;
      const elementConfig = ELEMENT_ABILITIES[tower.elementPath];
      
      if (!elementConfig || !elementConfig.upgrades) {
        el.abilitiesGrid.innerHTML = '<div class="no-abilities">No abilities available</div>';
        return;
      }
      
      el.abilitiesGrid.innerHTML = '';
      
      const towerUpgrades = tower.abilityUpgrades || {};
      
      // Create upgrade rows for each ability upgrade
      Object.entries(elementConfig.upgrades).forEach(([upgradeKey, upgrade]) => {
        const currentLevel = towerUpgrades[upgradeKey] || 0;
        const maxLevel = upgrade.maxLevel;
        const cost = getAbilityUpgradeCost(tower.elementPath, upgradeKey, currentLevel);
        const isMaxed = currentLevel >= maxLevel;
        const canAfford = gold >= cost && !isMaxed;
        
        // Calculate current value
        const baseConfig = ELEMENT_ABILITIES[tower.elementPath];
        const [category, stat] = upgrade.stat.split('.');
        let currentValue = 0;
        if (baseConfig[category] && baseConfig[category][stat] !== undefined) {
          currentValue = baseConfig[category][stat] + (upgrade.valuePerLevel * currentLevel);
        }
        
        const valueText = formatUpgradeValue(upgrade, currentValue, currentLevel);
        
        const row = document.createElement('div');
        row.className = `ability-row${!canAfford && !isMaxed ? ' disabled' : ''}${isMaxed ? ' maxed' : ''}`;
        row.dataset.abilityKey = upgradeKey;
        
        row.innerHTML = `
          <span class="ability-emoji">${upgrade.icon || elementConfig.icon}</span>
          <div class="ability-info-col">
            <div class="ability-name-row">${upgrade.name}</div>
            <div class="ability-effect">${upgrade.description || ''}</div>
          </div>
          <span class="ability-value">${valueText} <span class="ability-level">(${currentLevel}/${maxLevel})</span></span>
          <button class="ability-buy-btn${isMaxed ? ' maxed' : ''}" 
                  data-ability="${upgradeKey}" 
                  ${!canAfford ? 'disabled' : ''}>
            ${isMaxed ? 'MAX' : `${cost}g`}
          </button>
        `;
        
        // Add click handler for buy button (if not maxed)
        if (!isMaxed) {
          const buyBtn = row.querySelector('.ability-buy-btn');
          buyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.purchaseAbilityUpgrade(upgradeKey);
          });
        }
        
        el.abilitiesGrid.appendChild(row);
      });
    }

    /**
     * Purchase an ability upgrade for selected tower
     */
    purchaseAbilityUpgrade(upgradeKey) {
      const tower = this.game?.selectedTower;
      if (!tower || !tower.elementPath) return;
      
      const elementConfig = ELEMENT_ABILITIES[tower.elementPath];
      const upgrade = elementConfig?.upgrades?.[upgradeKey];
      if (!upgrade) return;
      
      const currentLevel = tower.abilityUpgrades?.[upgradeKey] || 0;
      
      // Check max level
      if (currentLevel >= upgrade.maxLevel) {
        console.log('Ability already at max level');
        return;
      }
      
      const cost = getAbilityUpgradeCost(tower.elementPath, upgradeKey, currentLevel);
      
      const economy = this.game?.modules?.economy;
      if (!economy || economy.gold < cost) {
        console.log('Not enough gold for ability upgrade');
        return;
      }
      
      // Spend gold
      economy.spendGold(cost);
      
      // Apply upgrade
      applyElementAbilityUpgrade(tower, upgradeKey);
      
      // Refresh abilities grid with new prices
      this.populateAbilitiesGrid(tower);
      
      // Refresh gold display
      this.updateUI(this.game.getState());
    }

    /**
     * Update abilities button visibility based on tower element path
     */
    updateAbilitiesButtonVisibility(tower) {
      const el = this.elements;
      if (!el.btnAbilities) return;
      
      // Show button only if tower has element path
      if (tower && tower.elementPath) {
        el.btnAbilities.style.display = 'block';
      } else {
        el.btnAbilities.style.display = 'none';
        // Also hide panel if was open
        this.hideAbilitiesPanel();
      }
    }

    /**
     * Setup abilities panel event listeners
     */
    setupAbilitiesEventListeners() {
      const el = this.elements;
      
      // Abilities button click
      if (el.btnAbilities) {
        el.btnAbilities.addEventListener('click', (e) => {
          e.stopPropagation();
          this.toggleAbilitiesPanel();
        });
      }
      
      // Lightning charge slider
      if (el.lightningChargeSlider) {
        el.lightningChargeSlider.addEventListener('input', (e) => {
          this.onLightningChargeChange(e.target.value);
        });
      }
    }
  };
}

module.exports = { AbilityUpgradesUIMixin };

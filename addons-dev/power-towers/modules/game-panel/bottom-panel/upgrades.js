/**
 * Power Towers TD - Upgrades UI
 * Tower and energy building upgrade management
 */

// Import discount config at module level for all methods
const UPGRADES_CFG = require('../../../core/config/upgrades');
const DISCOUNT_CONFIG = UPGRADES_CFG.DISCOUNT_CONFIG;

/**
 * Mixin for upgrade management in bottom panel
 * @param {Class} Base - Base class
 */
function UpgradesMixin(Base) {
  return class extends Base {
    
    /**
     * Update tower upgrades in bottom panel - compact card layout
     */
    updateTowerUpgradesInPanel(tower) {
      const el = this.elements;
      
      // Try to get element directly if not in cache
      if (!el.upgradesGridPanel) {
        el.upgradesGridPanel = el.bottomPanel?.querySelector('#upgrades-grid-panel');
      }
      
      if (!el.upgradesGridPanel) {
        console.warn('[BottomPanel] upgradesGridPanel not found');
        return;
      }
      
      const gold = this.game?.getState?.().gold || 0;
      
      // Clear current upgrades
      el.upgradesGridPanel.innerHTML = '';
      
      // Get upgrade utilities
      const { 
        STAT_UPGRADES, 
        calculateUpgradeCost, 
        isUpgradeAvailable,
        getUpgradeEffectValue 
      } = require('../../../core/tower-upgrade-list');
      
      // Get attack type specific upgrades
      const { 
        getAttackTypeUpgrades, 
        calculateAttackTypeUpgradeCost 
      } = require('../../../core/config/attacks');
      
      // Get discount utilities
      const { getUpgradeDiscount } = require('../../../core/tower-upgrades');
      
      // All possible stat upgrades
      const allUpgrades = [
        'damage', 'attackSpeed', 'range', 'critChance', 'critDamage',
        'powerEfficiency', 'hp', 'hpRegen', 'energyStorage',
        'splashRadius', 'chainCount', 'powerScaling'
      ];
      
      // Filter to available upgrades for this tower
      const availableUpgrades = allUpgrades.filter(id => {
        const upgrade = STAT_UPGRADES[id];
        const available = upgrade && isUpgradeAvailable(upgrade, tower);
        return available;
      });
      
      for (const upgradeId of availableUpgrades) {
        const upgrade = STAT_UPGRADES[upgradeId];
        if (!upgrade) continue;
        
        const currentLevel = tower.getUpgradeLevel?.(upgradeId) || 0;
        
        // Get individual discount stacks for THIS upgrade
        const discountStacks = getUpgradeDiscount(tower, upgradeId);
        const cost = calculateUpgradeCost(upgrade, currentLevel, discountStacks);
        const canAfford = gold >= cost;
        
        // DEBUG: Log discount calculation
        if (upgradeId === 'damage') {
          console.log('[Discount Debug]', {
            upgradeId,
            towerLevel: tower.level,
            discountStacks,
            rawCost: Math.floor(upgrade.cost.base * Math.pow(upgrade.cost.scaleFactor, currentLevel)),
            finalCost: cost
          });
        }
        
        // Calculate discount for display using config
        const rawCost = Math.floor(upgrade.cost.base * Math.pow(upgrade.cost.scaleFactor, currentLevel));
        const discountPercent = Math.min(DISCOUNT_CONFIG.maxPercent, discountStacks * DISCOUNT_CONFIG.percentPerStack);
        const hasDiscount = discountPercent > 0;
        
        // Calculate bonus text
        let bonusText = '';
        if (upgrade.effect.percentPerLevel) {
          bonusText = `+${Math.round(upgrade.effect.percentPerLevel * 100)}%`;
        } else if (upgrade.effect.valuePerLevel) {
          const val = upgrade.effect.valuePerLevel;
          if (val < 1) {
            bonusText = `+${Math.round(val * 100)}%`;
          } else {
            bonusText = `+${val}`;
          }
        }
        
        // Short name for card
        const shortNames = {
          damage: 'DMG',
          attackSpeed: 'SPD',
          range: 'RNG',
          critChance: 'CRIT',
          critDamage: 'CDMG',
          powerEfficiency: 'PWR',
          hp: 'HP',
          hpRegen: 'REGEN',
          energyStorage: 'STOR',
          splashRadius: 'SPLASH',
          chainCount: 'CHAIN',
          powerScaling: 'SCALE'
        };
        
        const card = document.createElement('div');
        card.className = `upgrade-card${!canAfford ? ' disabled' : ''}`;
        card.dataset.upgradeId = upgradeId;
        card.dataset.category = upgrade.category || 'offense';
        
        // Show discounted price with better visibility
        let costHtml2;
        if (hasDiscount) {
          const discountPct = Math.round(discountPercent * 100);
          costHtml2 = `
            <span class="original-price">${rawCost}g</span>
            <span class="discounted-price">${cost}g</span>
            <span class="discount-badge">-${discountPct}%</span>
          `;
        } else {
          costHtml2 = `${cost}g`;
        }
        
        card.innerHTML = `
          <div class="card-top">
            <span class="card-icon">${upgrade.emoji}</span>
            <span class="card-name">${shortNames[upgradeId] || upgrade.name.slice(0, 4)}</span>
          </div>
          <div class="card-bottom">
            <span class="card-cost">${costHtml2}</span>
            <span class="card-level">Lv.${currentLevel}</span>
            <span class="card-bonus">${bonusText}</span>
          </div>
        `;
        
        // Tooltip with discount info (stacks reset on purchase)
        const discountInfo = hasDiscount ? `\n💰 Discount: -${Math.round(discountPercent * 100)}% (${discountStacks} stacks)\n⚠️ Resets on purchase!` : '';
        card.title = `${upgrade.name}\nLevel ${currentLevel} → ${currentLevel + 1}\nCost: ${cost}g${discountInfo}\n${upgrade.description}`;
        
        if (canAfford) {
          card.addEventListener('click', (e) => {
            e.stopPropagation();
            this.purchaseUpgrade(upgradeId);
            // Refresh after purchase
            if (this.game?.selectedTower) {
              this.showTowerInBottomPanel(this.game.selectedTower);
            }
          });
        }
        
        el.upgradesGridPanel.appendChild(card);
      }
      
      // === ATTACK TYPE SPECIFIC UPGRADES ===
      // Add Normal Attack upgrades (Combo/Focus Fire)
      if (tower.attackTypeId === 'normal') {
        this.renderAttackTypeUpgrades(tower, el.upgradesGridPanel, gold);
      }
      
      // Also update abilities panel
      this.updateTowerAbilitiesInPanel(tower);
    }
    
    /**
     * Update upgrade prices in real-time (without rebuilding UI)
     * Called on gold change, tower level up, etc.
     */
    updateUpgradePrices(tower) {
      if (!tower) return;
      const el = this.elements;
      if (!el.upgradesGridPanel) return;
      
      const gold = this.game?.getState?.().gold || 0;
      
      const { STAT_UPGRADES, calculateUpgradeCost } = require('../../../core/tower-upgrade-list');
      const { calculateAttackTypeUpgradeCost, getAttackTypeUpgrades } = require('../../../core/config/attacks');
      const { getUpgradeDiscount } = require('../../../core/tower-upgrades');
      
      // Update all upgrade cards
      const cards = el.upgradesGridPanel.querySelectorAll('.upgrade-card');
      cards.forEach(card => {
        const upgradeId = card.dataset.upgradeId;
        const attackType = card.dataset.attackType;
        
        let cost, rawCost, currentLevel, discountStacks;
        
        if (attackType) {
          // Attack type upgrade
          const upgrades = getAttackTypeUpgrades(attackType);
          const upgrade = upgrades?.[upgradeId];
          if (!upgrade) return;
          
          currentLevel = tower.attackTypeUpgrades?.[upgradeId] || 0;
          discountStacks = getUpgradeDiscount(tower, `attack_${upgradeId}`);
          cost = calculateAttackTypeUpgradeCost(attackType, upgradeId, currentLevel, discountStacks);
          rawCost = Math.floor(upgrade.cost.base * Math.pow(upgrade.cost.scaleFactor, currentLevel));
        } else {
          // Stat upgrade
          const upgrade = STAT_UPGRADES[upgradeId];
          if (!upgrade) return;
          
          currentLevel = tower.getUpgradeLevel?.(upgradeId) || 0;
          discountStacks = getUpgradeDiscount(tower, upgradeId);
          cost = calculateUpgradeCost(upgrade, currentLevel, discountStacks);
          rawCost = Math.floor(upgrade.cost.base * Math.pow(upgrade.cost.scaleFactor, currentLevel));
        }
        
        const canAfford = gold >= cost;
        const discountPercent = Math.min(DISCOUNT_CONFIG.maxPercent, discountStacks * DISCOUNT_CONFIG.percentPerStack);
        const hasDiscount = discountPercent > 0;
        
        // Update affordability
        card.classList.toggle('disabled', !canAfford);
        
        // Update cost display
        const costEl = card.querySelector('.card-cost');
        if (costEl) {
          if (hasDiscount) {
            const discountPct = Math.round(discountPercent * 100);
            costEl.innerHTML = `
              <span class="original-price">${rawCost}g</span>
              <span class="discounted-price">${cost}g</span>
              <span class="discount-badge">-${discountPct}%</span>
            `;
          } else {
            costEl.innerHTML = `${cost}g`;
          }
        }
        
        // Update level display
        const levelEl = card.querySelector('.card-level');
        if (levelEl) {
          levelEl.textContent = `Lv.${currentLevel}`;
        }
      });
    }
    
    /**
     * Render attack type specific upgrades
     */
    renderAttackTypeUpgrades(tower, container, gold) {
      const { 
        getAttackTypeUpgrades, 
        calculateAttackTypeUpgradeCost 
      } = require('../../../core/config/attacks');
      const { getUpgradeDiscount } = require('../../../core/tower-upgrades');
      
      const upgrades = getAttackTypeUpgrades(tower.attackTypeId);
      if (!upgrades || Object.keys(upgrades).length === 0) return;
      
      // Add separator
      const separator = document.createElement('div');
      separator.className = 'upgrade-separator';
      separator.innerHTML = `<span>🎯 Normal Attack</span>`;
      container.appendChild(separator);
      
      // Short names for attack type upgrades
      const shortNames = {
        comboDamage: 'COMBO',
        comboMaxStacks: 'STACK',
        comboDecay: 'DECAY',
        focusFire: 'FOCUS',
        focusCritBonus: 'FCRIT'
      };
      
      for (const [upgradeId, upgrade] of Object.entries(upgrades)) {
        const currentLevel = tower.attackTypeUpgrades?.[upgradeId] || 0;
        
        // Get individual discount stacks for THIS attack type upgrade
        const discountStacks = getUpgradeDiscount(tower, `attack_${upgradeId}`);
        const cost = calculateAttackTypeUpgradeCost(tower.attackTypeId, upgradeId, currentLevel, discountStacks);
        const canAfford = gold >= cost;
        
        // Calculate discount for display
        const baseCost = upgrade.cost.base;
        const scaleFactor = upgrade.cost.scaleFactor;
        const rawCost = Math.floor(baseCost * Math.pow(scaleFactor, currentLevel));
        const discountPercent = Math.min(DISCOUNT_CONFIG.maxPercent, discountStacks * DISCOUNT_CONFIG.percentPerStack);
        const hasDiscount = discountPercent > 0;
        
        // Calculate bonus text
        let bonusText = '';
        const val = upgrade.effect.valuePerLevel;
        if (Math.abs(val) < 1) {
          bonusText = val > 0 ? `+${Math.round(val * 100)}%` : `${Math.round(val * 100)}%`;
        } else {
          bonusText = val > 0 ? `+${val}` : `${val}`;
        }
        
        // Show discounted price with better visibility
        let costHtml;
        if (hasDiscount) {
          const discountPct = Math.round(discountPercent * 100);
          costHtml = `
            <span class="original-price">${rawCost}g</span>
            <span class="discounted-price">${cost}g</span>
            <span class="discount-badge">-${discountPct}%</span>
          `;
        } else {
          costHtml = `${cost}g`;
        }
        
        const card = document.createElement('div');
        card.className = `upgrade-card attack-type-upgrade${!canAfford ? ' disabled' : ''}`;
        card.dataset.upgradeId = upgradeId;
        card.dataset.attackType = tower.attackTypeId;
        card.innerHTML = `
          <div class="card-top">
            <span class="card-icon">${upgrade.emoji}</span>
            <span class="card-name">${shortNames[upgradeId] || upgrade.name.slice(0, 5)}</span>
          </div>
          <div class="card-bottom">
            <span class="card-cost">${costHtml}</span>
            <span class="card-level">Lv.${currentLevel}</span>
            <span class="card-bonus">${bonusText}</span>
          </div>
        `;
        
        // Tooltip with discount info (stacks reset on purchase)
        const discountInfo = hasDiscount ? `\n💰 Discount: -${Math.round(discountPercent * 100)}% (${discountStacks} stacks)\n⚠️ Resets on purchase!` : '';
        card.title = `${upgrade.name}\nLevel ${currentLevel} → ${currentLevel + 1}\nCost: ${cost}g${discountInfo}\n${upgrade.description}`;
        
        if (canAfford) {
          card.addEventListener('click', (e) => {
            e.stopPropagation();
            this.purchaseAttackTypeUpgrade(tower.attackTypeId, upgradeId);
            // Refresh after purchase
            if (this.game?.selectedTower) {
              this.showTowerInBottomPanel(this.game.selectedTower);
            }
          });
        }
        
        container.appendChild(card);
      }
    }
    
    /**
     * Purchase attack type specific upgrade
     */
    purchaseAttackTypeUpgrade(attackTypeId, upgradeId) {
      const tower = this.game?.selectedTower;
      if (!tower) return;
      
      const { 
        calculateAttackTypeUpgradeCost, 
        applyAttackTypeUpgradeEffect 
      } = require('../../../core/config/attacks');
      const { getUpgradeDiscount, resetUpgradeDiscount } = require('../../../core/tower-upgrades');
      
      const currentLevel = tower.attackTypeUpgrades?.[upgradeId] || 0;
      const discountStacks = getUpgradeDiscount(tower, `attack_${upgradeId}`);
      const cost = calculateAttackTypeUpgradeCost(attackTypeId, upgradeId, currentLevel, discountStacks);
      
      const economy = this.game?.modules?.economy;
      if (!economy || economy.gold < cost) return;
      
      // Deduct gold
      economy.spendGold(cost);
      
      // Initialize attackTypeUpgrades if needed
      if (!tower.attackTypeUpgrades) {
        tower.attackTypeUpgrades = {};
      }
      
      // Increase upgrade level
      tower.attackTypeUpgrades[upgradeId] = currentLevel + 1;
      
      // Reset discount for THIS upgrade only
      resetUpgradeDiscount(tower, `attack_${upgradeId}`);
      
      // Apply upgrade effect
      applyAttackTypeUpgradeEffect(tower, upgradeId, tower.attackTypeUpgrades[upgradeId]);
      
      // Emit event for UI update
      this.game?.eventBus?.emit('tower:upgraded', { tower, upgradeId, attackTypeUpgrade: true });
    }
    
    /**
     * Update tower abilities in bottom panel
     * Shows ELEMENT_ABILITIES upgrades (burn_damage, slow_percent, etc.)
     */
    updateTowerAbilitiesInPanel(tower) {
      const el = this.elements;
      if (!el.abilitiesGridPanel) return;
      
      const gold = this.game?.getState?.().gold || 0;
      
      // Clear current abilities
      el.abilitiesGridPanel.innerHTML = '';
      
      // Get element abilities
      const { ELEMENT_ABILITIES, getAbilityUpgradeCost } = require('../../../core/element-abilities');
      
      const elementPath = tower.elementPath;
      if (!elementPath || !ELEMENT_ABILITIES[elementPath]) {
        // No element - show hint
        el.abilitiesGridPanel.innerHTML = `
          <div class="ability-hint">
            Choose an element first
          </div>
        `;
        return;
      }
      
      const elementConfig = ELEMENT_ABILITIES[elementPath];
      const abilityUpgrades = tower.abilityUpgrades || {};
      
      // Get discount utilities
      const { getUpgradeDiscount } = require('../../../core/tower-upgrades');
      
      // Show all upgrades for this element
      for (const [upgradeId, upgrade] of Object.entries(elementConfig.upgrades || {})) {
        const currentLevel = abilityUpgrades[upgradeId] || 0;
        const maxLevel = upgrade.maxLevel;
        const isMaxed = currentLevel >= maxLevel;
        
        // Get individual discount stacks for THIS ability upgrade
        const discountStacks = getUpgradeDiscount(tower, `ability_${upgradeId}`);
        const cost = isMaxed ? 0 : getAbilityUpgradeCost(elementPath, upgradeId, currentLevel, discountStacks);
        const rawCost = isMaxed ? 0 : Math.round(upgrade.costBase * Math.pow(upgrade.costMult, currentLevel));
        const canAfford = gold >= cost;
        
        // Calculate discount for display
        const discountPercent = Math.min(DISCOUNT_CONFIG.maxPercent, discountStacks * DISCOUNT_CONFIG.percentPerStack);
        const hasDiscount = discountPercent > 0;
        
        // Format value for display
        let bonusText = '';
        const value = upgrade.valuePerLevel;
        const stat = upgrade.stat;
        if (stat.includes('Percent') || stat.includes('Chance') || stat.includes('Reduction')) {
          bonusText = `+${Math.round(value * 100)}%`;
        } else if (stat.includes('Duration')) {
          bonusText = `+${value.toFixed(1)}s`;
        } else {
          bonusText = value < 1 ? `+${Math.round(value * 100)}%` : `+${value}`;
        }
        
        // Show discounted price with better visibility
        let costHtml;
        if (isMaxed) {
          costHtml = 'MAX';
        } else if (hasDiscount) {
          const discountPct = Math.round(discountPercent * 100);
          costHtml = `
            <span class="original-price">${rawCost}g</span>
            <span class="discounted-price">${cost}g</span>
            <span class="discount-badge">-${discountPct}%</span>
          `;
        } else {
          costHtml = `${cost}g`;
        }
        
        const card = document.createElement('div');
        card.className = `upgrade-card${isMaxed ? ' maxed' : ''}${!canAfford && !isMaxed ? ' disabled' : ''}`;
        card.dataset.upgradeId = upgradeId;
        card.dataset.element = elementPath;
        card.innerHTML = `
          <div class="card-top">
            <span class="card-icon">${upgrade.icon}</span>
            <span class="card-name">${upgrade.name.slice(0, 6)}</span>
          </div>
          <div class="card-bottom">
            <span class="card-cost">${costHtml}</span>
            <span class="card-level">${currentLevel}/${maxLevel}</span>
            <span class="card-bonus">${bonusText}</span>
          </div>
        `;
        
        // Tooltip with discount info (stacks reset on purchase)
        const discountInfo = hasDiscount && !isMaxed ? `\n💰 Discount: -${Math.round(discountPercent * 100)}% (${discountStacks} stacks)\n⚠️ Resets on purchase!` : '';
        card.title = `${upgrade.name}\nLevel ${currentLevel}/${maxLevel}\n${isMaxed ? 'MAXED' : `Cost: ${cost}g`}${discountInfo}\n${upgrade.description.replace('{value}', bonusText)}`;
        
        if (canAfford && !isMaxed) {
          card.addEventListener('click', (e) => {
            e.stopPropagation();
            // Purchase ability upgrade
            if (this.purchaseAbilityUpgrade) {
              this.purchaseAbilityUpgrade(upgradeId);
            }
          });
        }
        
        el.abilitiesGridPanel.appendChild(card);
      }
    }
    
    /**
     * Update energy upgrades in panel
     */
    updateEnergyUpgradesInPanel(building) {
      const el = this.elements;
      const upgradesGrid = el.bottomPanel?.querySelector('#energy-upgrades-grid');
      if (!upgradesGrid) return;
      
      const gold = this.game?.getState?.().gold || 0;
      const CONFIG = require('../../../core/config/index');
      const costs = CONFIG.ENERGY_UPGRADE_COSTS || {};
      const bonuses = CONFIG.ENERGY_UPGRADE_BONUSES || {};
      const costMultiplier = CONFIG.ENERGY_UPGRADE_COST_MULTIPLIER || 1.2;
      
      // Clear grid
      upgradesGrid.innerHTML = '';
      
      // Energy building upgrade definitions (costs and bonuses from CONFIG)
      const ENERGY_UPGRADES = [
        { id: 'capacity', name: 'Capacity', emoji: '🔋', stat: 'capacity', 
          bonus: `+${Math.round((bonuses.capacity || 0.10) * 100)}%`, baseCost: costs.capacity || 30 },
        { id: 'output', name: 'Output', emoji: '📤', stat: 'outputRate', 
          bonus: `+${Math.round((bonuses.outputRate || 0.05) * 100)}%`, baseCost: costs.output || 40 },
        { id: 'channels', name: 'Channels', emoji: '🔌', stat: 'channels', 
          bonus: `+${bonuses.channels || 1} In/Out`, baseCost: costs.channels || 60 },
        { id: 'range', name: 'Range', emoji: '📡', stat: 'range', 
          bonus: `+${bonuses.range || 1}`, baseCost: costs.range || 50 },
        { id: 'efficiency', name: 'Efficiency', emoji: '⚡', stat: 'efficiency', 
          bonus: `+${Math.round((bonuses.efficiency || 0.10) * 100)}%`, baseCost: costs.efficiency || 35 },
      ];
      
      // Add generation upgrade for generators
      if (building.type === 'generator' || building.type === 'solar' || building.type === 'hydro' || building.type === 'wind' || building.type === 'geo') {
        ENERGY_UPGRADES.push({ id: 'generation', name: 'Gen Rate', emoji: '⚡', stat: 'generationRate', 
          bonus: `+${Math.round((bonuses.generation || 0.15) * 100)}%`, baseCost: costs.generation || 45 });
      }
      
      for (const upgrade of ENERGY_UPGRADES) {
        const currentLevel = building.upgradeLevels?.[upgrade.id] || 0;
        const cost = Math.floor(upgrade.baseCost * Math.pow(costMultiplier, currentLevel));
        const canAfford = gold >= cost;
        
        const card = document.createElement('div');
        card.className = `upgrade-card${!canAfford ? ' disabled' : ''}`;
        card.dataset.upgradeId = upgrade.id;
        card.innerHTML = `
          <div class="card-top">
            <span class="card-icon">${upgrade.emoji}</span>
            <span class="card-name">${upgrade.name}</span>
          </div>
          <div class="card-bottom">
            <span class="card-cost">${cost}g</span>
            <span class="card-level">Lv.${currentLevel}</span>
            <span class="card-bonus">${upgrade.bonus}</span>
          </div>
        `;
        card.title = `${upgrade.name}\nLevel ${currentLevel} → ${currentLevel + 1}\nCost: ${cost}g`;
        
        if (canAfford) {
          card.addEventListener('click', (e) => {
            e.stopPropagation();
            this.purchaseEnergyUpgrade(building, upgrade.id, cost);
          });
        }
        
        upgradesGrid.appendChild(card);
      }
    }
    
    /**
     * Purchase energy building upgrade
     */
    purchaseEnergyUpgrade(building, upgradeId, cost) {
      const economy = this.game?.modules?.economy;
      if (!economy || economy.gold < cost) return;
      
      // Deduct gold
      economy.spendGold(cost);
      
      // Apply upgrade
      if (!building.upgradeLevels) building.upgradeLevels = {};
      building.upgradeLevels[upgradeId] = (building.upgradeLevels[upgradeId] || 0) + 1;
      
      // Get bonuses from CONFIG
      const CONFIG = require('../../../core/config/index');
      const bonuses = CONFIG.ENERGY_UPGRADE_BONUSES || {};
      
      // Apply stat boost based on upgrade type
      const level = building.upgradeLevels[upgradeId];
      switch (upgradeId) {
        case 'capacity':
          building.capacity = Math.floor((building.baseCapacity || 50) * (1 + level * (bonuses.capacity || 0.10)));
          break;
        case 'output':
          building.outputRate = Math.floor((building.baseOutputRate || 10) * (1 + level * (bonuses.outputRate || 0.05)));
          break;
        case 'range':
          building.range = (building.baseRange || 4) + level * (bonuses.range || 1);
          break;
        case 'efficiency':
          building.efficiency = 1 + level * (bonuses.efficiency || 0.10);
          break;
        case 'generation':
          if (building.generationRate !== undefined) {
            building.generationRate = Math.floor((building.baseGenerationRate || 5) * (1 + level * (bonuses.generation || 0.15)));
          }
          break;
        case 'channels':
          // Channels upgrade: +1 input AND +1 output per level
          // BUT only if building has that channel type (generators have 0 inputs)
          const channelsBonus = bonuses.channels || 1;
          const channelsLevel = level * channelsBonus;
          if ((building.baseInputChannels || 0) > 0) {
            building.inputChannels = building.baseInputChannels + channelsLevel;
          }
          if ((building.baseOutputChannels || 0) > 0) {
            building.outputChannels = building.baseOutputChannels + channelsLevel;
          }
          break;
      }
      
      // Also call recalculateStats if building has it (for PowerNode)
      if (building.recalculateStats) {
        building.recalculateStats();
      }
      
      // Refresh panel
      this.showEnergyBuildingInBottomPanel(building);
    }
  };
}

module.exports = { UpgradesMixin };
